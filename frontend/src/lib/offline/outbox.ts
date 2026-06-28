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
  mediaType?: string
  mediaId?: string
  mediaIds?: any
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
    mediaType: op.mediaType,
    mediaId: op.mediaId,
    mediaIds: op.mediaIds,
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

      // Process media before sending (if applicable)
      let mediaProcessed = false
      let mediaUrls: string[] = []
      let audioUrl: string | null = null
      let photoUrl: string | null = null
      let transcript: string | null = null
      let durationSecs: number | null = null

      try {
        const token = await auth.currentUser?.getIdToken()
        
        // --- 1. AUDIO ---
        const audioId = item.mediaIds?.audio || (item.mediaType === 'audio' ? item.mediaId : null)
        if (audioId) {
          const { getPendingAudio } = await import('@/lib/audioOfflineStore')
          const pa = await getPendingAudio(audioId)
          if (pa) {
            const fd = new FormData()
            fd.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
            fd.append('folder', 'bitacora-audio')
            const uploadRes = await fetch('/api/upload', { 
              method: 'POST', 
              body: fd,
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
            if (uploadRes.ok) audioUrl = (await uploadRes.json()).url

            transcript = pa.transcript || ''
            if (!transcript) {
              try {
                const tf = new FormData()
                tf.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
                const tr = await fetch('/api/transcribe-audio', { 
                  method: 'POST', 
                  body: tf,
                  headers: token ? { Authorization: `Bearer ${token}` } : {} 
                })
                if (tr.ok) { const d = await tr.json(); transcript = d.transcript || '' }
              } catch { /* ignore */ }
            }
            durationSecs = pa.durationSecs
            mediaProcessed = true
          }
        }

        // --- 2. PHOTOS ---
        const rawPhotoIds = item.mediaIds?.photos || (item.mediaIds?.photo ? [item.mediaIds.photo] : null) || (item.mediaType === 'photo' ? [item.mediaId] : [])
        const photoIds = Array.isArray(rawPhotoIds) ? rawPhotoIds.filter(Boolean) : []
        
        if (photoIds.length > 0) {
          const { getPendingPhoto } = await import('@/lib/audioOfflineStore')
          for (const ppId of photoIds) {
            if (!ppId) continue
            const pp = await getPendingPhoto(ppId)
            if (pp) {
              const fd = new FormData()
              fd.append('file', new File([pp.blob], `photo-${pp.id}.jpg`, { type: 'image/jpeg' }))
              fd.append('folder', 'bitacora-photos')
              const uploadRes = await fetch('/api/upload', { 
                method: 'POST', 
                body: fd,
                headers: token ? { Authorization: `Bearer ${token}` } : {} 
              })
              if (uploadRes.ok) mediaUrls.push((await uploadRes.json()).url)
              mediaProcessed = true
            }
          }
          if (mediaUrls.length > 0) photoUrl = mediaUrls[0]
        }
      } catch (err) {
        console.warn('[outbox] Error processing media before sending:', err)
      }

      // Update body if media was processed
      let bodyToSent = item.body
      if (mediaProcessed) {
        try {
          const parsed = JSON.parse(bodyToSent)
          if (audioUrl) {
            parsed.audio_url = audioUrl
            if (!parsed.content && transcript && transcript !== '[Sin voz detectable]') parsed.content = transcript
            parsed.audio_duration_secs = durationSecs
          }
          if (mediaUrls.length > 0) {
            if (!parsed.photo_urls) parsed.photo_url = photoUrl
            parsed.photo_urls = mediaUrls
          }
          bodyToSent = JSON.stringify(parsed)
        } catch { /* ignore parse error */ }
      }

      const sent = await trySend({
        type: item.type,
        url: item.url,
        method: item.method,
        body: bodyToSent,
        headers: { ...item.headers, 'X-Idempotency-Key': item.idempotency_key },
        idempotency_key: item.idempotency_key,
      })

      if (sent) {
        await outboxDelete(item.id)
        
        // Clean up media offline store
        try {
          const audioId = item.mediaIds?.audio || (item.mediaType === 'audio' ? item.mediaId : null)
          if (audioId) {
            const { deletePendingAudio } = await import('@/lib/audioOfflineStore')
            await deletePendingAudio(audioId)
          }

          const rawPhotoIds = item.mediaIds?.photos || (item.mediaIds?.photo ? [item.mediaIds.photo] : null) || (item.mediaType === 'photo' ? [item.mediaId] : [])
          const photoIds = Array.isArray(rawPhotoIds) ? rawPhotoIds.filter(Boolean) : []
          if (photoIds.length > 0) {
            const { deletePendingPhoto } = await import('@/lib/audioOfflineStore')
            for (const ppId of photoIds) {
              if (ppId) await deletePendingPhoto(ppId)
            }
          }
        } catch (err) {
          console.warn('[outbox] Error deleting media from store after sync:', err)
        }
        
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
  // NOTA: NO propagar al SW — el SW reenviaba SYNC_COMPLETED a todos los
  // clients, lo que creaba un loop infinito de sync → SYNC_COMPLETED → sync.
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
