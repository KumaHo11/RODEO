/**
 * lib/offline/sync.ts
 * Motor de sincronización para RODEO offline-first.
 *
 * Escucha:
 *  - Evento 'online' del browser
 *  - Mensajes del Service Worker ('SYNC_STARTED')
 *  - BroadcastChannel('rodeo-sync')
 *
 * Al detectar conexión:
 *  1. Procesa el outbox (envía registros pendientes)
 *  2. Re-fetcha datos en background (prefetch incremental)
 *  3. Emite 'rodeo_sync_completed' para que las páginas recarguen
 */

import { processQueue } from './outbox'
import { prefetchAll } from './prefetch'

let _initialized = false
let _isSyncing   = false

// ── Inicialización ─────────────────────────────────────────────────────────────

/**
 * Llama esto una sola vez al montar la app (en OfflineManager).
 * @param getToken - función que devuelve el Firebase ID token actual
 */
export function initSync(getToken: () => Promise<string | null>): void {
  if (_initialized || typeof window === 'undefined') return
  _initialized = true

  // Escuchar evento online del browser
  window.addEventListener('online', () => {
    console.log('[sync] Network online — starting sync')
    triggerSync(getToken)
  })

  // Escuchar mensajes del Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data?.type === 'SYNC_STARTED' || ev.data?.type === 'SYNC_COMPLETED') {
        triggerSync(getToken)
      }
    })

    // Registrar Background Sync para envíos pendientes (funciona incluso con tab cerrado)
    navigator.serviceWorker.ready.then(registration => {
      if ('sync' in registration) {
        (registration as any).sync.register('rodeo-outbox-sync').catch(() => {
          // Background Sync no soportado o denegado — no es crítico
        })
      }
    }).catch(() => {})
  }

  // BroadcastChannel para coordinar entre tabs
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel('rodeo-sync')
    ch.onmessage = (ev) => {
      if (ev.data?.type === 'TRIGGER_SYNC') {
        triggerSync(getToken)
      }
    }
  }

  // Escuchar visibilitychange — sincronizar al volver al tab (común en mobile)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      // Delay corto para que la red se estabilice
      setTimeout(() => triggerSync(getToken), 1500)
    }
  })

  // Si ya estamos online al inicializar, ejecutar sync inicial
  if (navigator.onLine) {
    // Delay corto para no bloquear el primer render
    setTimeout(() => triggerSync(getToken), 2000)
  }
}

// ── Trigger ───────────────────────────────────────────────────────────────────

export async function triggerSync(getToken: () => Promise<string | null>): Promise<void> {
  if (_isSyncing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  _isSyncing = true

  // Notificar inicio a la UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rodeo_sync_start'))
  }

  let result = { processed: 0, failed: 0 }
  try {
    // 1. Procesar cola de escrituras pendientes
    result = await processQueue()
    console.log(`[sync] Outbox: ${result.processed} enviados, ${result.failed} fallidos`)

    // 2. Pre-fetch incremental de datos (solo lo que tiene > 5 min)
    const token = await getToken()
    if (token) {
      await prefetchAll(token)
    }
  } catch (err) {
    console.error('[sync] Error during sync:', err)
  } finally {
    // 3. Notificar que el sync terminó (SIEMPRE, incluso con error)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rodeo_sync_completed', {
        detail: { processed: result.processed, failed: result.failed }
      }))
    }

    // Propagar al SW para notificar otras tabs
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({ type: 'SYNC_COMPLETED' })
      }).catch(() => {})
    }

    // Broadcast a otras tabs abiertas
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel('rodeo-sync')
        ch.postMessage({ type: 'SYNC_DONE', timestamp: Date.now() })
        ch.close()
      } catch { /* ignore */ }
    }

    _isSyncing = false
  }
}

// ── Manual trigger ────────────────────────────────────────────────────────────

/** Fuerza sincronización manual (ej: al pulsar "Sincronizar ahora") */
export async function forceSyncNow(getToken: () => Promise<string | null>): Promise<void> {
  _isSyncing = false // reset lock
  await triggerSync(getToken)
}

export function isSyncing(): boolean {
  return _isSyncing
}
