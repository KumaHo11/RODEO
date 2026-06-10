/**
 * lib/offline/outbox.ts
 * Outbox Pattern para operaciones de escritura offline.
 *
 * Flujo:
 *  1. Llamás `enqueue(op)` en lugar de hacer fetch directo
 *  2. Si hay red → procesa inmediatamente
 *  3. Si no hay red → persiste en IndexedDB
 *  4. Al reconectar, `processQueue()` envía en orden FIFO con reintentos
 */

import {
  outboxPush, outboxGetAll, outboxDelete, outboxUpdate, outboxCount,
  dbUpsert, dbDelete,
} from './db'
import { auth } from '@/lib/firebase/client'

export interface OutboxOperation {
  type: string           // 'farm_event' | 'task' | 'field_note' | 'paddock_update' | ...
  url: string            // '/api/farm-events'
  method: string         // 'POST' | 'PATCH' | 'DELETE'
  body?: any             // objeto a serializar como JSON
  headers?: Record<string, string>
  /** Clave de idempotencia — se genera automáticamente si no se provee */
  idempotency_key?: string
  /** Datos para actualización optimista del store local (opcional) */
  localData?: { store: string; data: any }
  /** ID para eliminación optimista del store local (opcional) */
  localDeleteId?: { store: string; id: string }
}

// ── Lock global: un solo procesamiento simultáneo ────────────────────────────
let _isProcessing = false

// BroadcastChannel para coordinar entre tabs
let _channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!_channel) {
    _channel = new BroadcastChannel('rodeo-outbox')
    _channel.onmessage = (ev) => {
      if (ev.data?.type === 'PROCESSING') {
        // Otra tab está procesando — marcamos lock para evitar duplicación
        _isProcessing = true
        setTimeout(() => { _isProcessing = false }, 30_000)
      }
    }
  }
  return _channel
}

// ── enqueue ───────────────────────────────────────────────────────────────────

/**
 * Encola una operación.
 * - Si hay conexión → intenta enviar inmediatamente, solo persiste si falla
 * - Si no hay conexión → persiste directamente en IndexedDB
 */
export async function enqueue(op: OutboxOperation): Promise<void> {
  const idempotency_key = op.idempotency_key
    ?? `${op.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  // Actualización optimista del store local
  if (op.localData) {
    await dbUpsert(op.localData.store as any, op.localData.data)
  }

  const record = {
    type: op.type,
    url: op.url,
    method: op.method,
    body: JSON.stringify(op.body ?? {}),
    headers: { 'Content-Type': 'application/json', ...op.headers },
    idempotency_key,
  }

  // Intentar envío inmediato si hay red
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const sent = await trySend(record)
    if (sent) return
  }

  // Sin red o envío fallido → persistir en outbox
  await outboxPush(record)

  // Notificar que hay items pendientes
  dispatchQueueEvent()
}

// ── processQueue ──────────────────────────────────────────────────────────────

/**
 * Procesa todos los items del outbox en orden FIFO.
 * Seguro para llamar múltiples veces — el lock evita procesamiento paralelo.
 */
export async function processQueue(): Promise<{ processed: number; failed: number }> {
  if (_isProcessing) return { processed: 0, failed: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { processed: 0, failed: 0 }

  _isProcessing = true

  // Avisar a otras tabs
  getChannel()?.postMessage({ type: 'PROCESSING' })

  let processed = 0
  let failed = 0

  try {
    const items = await outboxGetAll()
    if (!items.length) return { processed: 0, failed: 0 }

    for (const item of items) {
      // Skip items con demasiados reintentos
      if (item.attempts >= 5) {
        await outboxDelete(item.id)
        console.warn('[outbox] Dropped after 5 attempts:', item.id, item.type)
        continue
      }

      const sent = await trySend({
        type: item.type,
        url: item.url,
        method: item.method,
        body: item.body,
        headers: { ...item.headers, 'X-Idempotency-Key': item.idempotency_key },
        idempotency_key: item.idempotency_key,
      })

      if (sent) {
        await outboxDelete(item.id)
        processed++
      } else {
        await outboxUpdate(item.id, {
          attempts: item.attempts + 1,
          last_error: 'send failed',
        })
        failed++
      }

      // Pequeña pausa entre requests para no saturar la red rural
      await sleep(200)
    }
  } finally {
    _isProcessing = false
  }

  if (processed > 0) {
    dispatchSyncCompletedEvent()
  }

  return { processed, failed }
}

// ── trySend ───────────────────────────────────────────────────────────────────

async function trySend(record: {
  type: string
  url: string
  method: string
  body: string
  headers: Record<string, string>
  idempotency_key: string
}): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000) // 10s timeout

    const token = await auth.currentUser?.getIdToken()

    const res = await fetch(record.url, {
      method: record.method,
      headers: {
        ...record.headers,
        'X-Idempotency-Key': record.idempotency_key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: record.method !== 'DELETE' ? record.body : undefined,
      signal: controller.signal,
      credentials: 'same-origin',
    })
    clearTimeout(timeout)

    // 2xx → éxito
    if (res.ok) return true

    // 409 Conflict (ya existe con esa idempotency_key) → considerar enviado
    if (res.status === 409) return true

    // 4xx (excepto 429) → error del cliente, no reintentar
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      console.warn(`[outbox] Client error ${res.status} for ${record.url} — dropping`)
      return true // Eliminamos para no quedar en loop
    }

    return false
  } catch (err: any) {
    if (err.name === 'AbortError') console.warn('[outbox] Request timeout')
    return false
  }
}

// ── Pending count ─────────────────────────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  return outboxCount()
}

// ── Events ────────────────────────────────────────────────────────────────────

function dispatchQueueEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rodeo_queue_updated'))
  }
}

function dispatchSyncCompletedEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rodeo_sync_completed'))
  }
  // También notificar al SW para que propague a otras tabs
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type: 'SYNC_COMPLETED' })
    }).catch(() => {})
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
