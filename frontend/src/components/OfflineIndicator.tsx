'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react'
import { invalidateConnectivityCache } from '@/lib/connectivity'

type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced'

// Lock global para evitar sincronizaciones concurrentes
// iOS dispara 'online' varias veces seguidas — este lock previene doble-sync
let isSyncingGlobal = false

/**
 * Genera un ID único para cada ítem de la cola offline.
 * Se usa como X-Idempotency-Key para deduplicar en el servidor.
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>('online')
  const [pendingCount, setPendingCount] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Leer cantidad de ítems pendientes
    const readPending = async () => {
      try {
        const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
        // Solo contar ítems que no están siendo sincronizados
        const waiting = queue.filter((q: any) => !q.syncing)
        const { countPendingItems } = await import('@/lib/audioOfflineStore')
        const mediaCount = await countPendingItems()
        setPendingCount(Math.max(waiting.length, mediaCount))
      } catch {
        setPendingCount(0)
      }
    }

    readPending()

    const handleOffline = () => {
      invalidateConnectivityCache()
      setStatus('offline')
      setVisible(true)
    }

    const handleOnline = async () => {
      invalidateConnectivityCache()

      // Prevenir doble-sync: iOS dispara 'online' varias veces
      if (isSyncingGlobal) return
      isSyncingGlobal = true

      const queue: any[] = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
      const {
        getPendingAudio, deletePendingAudio,
        getPendingPhoto, deletePendingPhoto,
        getAllPendingAudios, getAllPendingPhotos,
      } = await import('@/lib/audioOfflineStore')
      const { apiFetch } = await import('@/lib/apiFetch')

      const orphanedAudios = await getAllPendingAudios()
      const orphanedPhotos = await getAllPendingPhotos()

      // Ítems pendientes = aquellos que NO están marcados como 'syncing'
      const pendingItems = queue.filter(q => !q.syncing)

      if (pendingItems.length > 0 || orphanedAudios.length > 0 || orphanedPhotos.length > 0) {
        setStatus('syncing')
        setVisible(true)

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SYNC_OFFLINE_QUEUE' })
        }

        // Marcar todos los ítems pendientes como 'syncing' ANTES de procesarlos
        // Esto previene que un segundo disparo de 'online' los procese también
        const updatedQueue = queue.map(q =>
          pendingItems.find(p => p.idempotency_key === q.idempotency_key)
            ? { ...q, syncing: true }
            : q
        )
        localStorage.setItem('rodeo_offline_queue', JSON.stringify(updatedQueue))

        let hasErrors = false
        const failedItems: any[] = []

        // Procesar cada ítem de la cola
        for (const item of pendingItems) {
          try {
            const data = { ...item.data }

            // Adjuntos de audio
            if (item.mediaType === 'audio' && item.mediaId) {
              const pa = await getPendingAudio(item.mediaId)
              if (pa) {
                const fd = new FormData()
                fd.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
                fd.append('folder', 'bitacora-audio')
                const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd, timeout: 60000 })
                if (uploadRes.ok) data.audio_url = (await uploadRes.json()).url

                let transcript = pa.transcript || ''
                if (!transcript) {
                  try {
                    const tf = new FormData()
                    tf.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
                    const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf, timeout: 60000 })
                    if (tr.ok) { const d = await tr.json(); transcript = d.transcript || '' }
                  } catch { /* ignore */ }
                }
                if (!data.content && transcript && transcript !== '[Sin voz detectable]') data.content = transcript
                data.audio_duration_secs = pa.durationSecs
              }
            }
            if (item.mediaType === 'photo' || item.hasPhoto) {
              const ppId = item.mediaId || item.mediaIds?.photo
              if (ppId) {
                const pp = await getPendingPhoto(ppId)
                if (pp) {
                  const fd = new FormData()
                  fd.append('file', new File([pp.blob], `photo-${pp.id}.jpg`, { type: 'image/jpeg' }))
                  fd.append('folder', 'bitacora-photos')
                  const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd, timeout: 60000 })
                  if (uploadRes.ok) data.photo_url = (await uploadRes.json()).url
                }
              }
            }

            // Headers comunes — incluye idempotency key para deduplicación en servidor
            const syncHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
            }
            if (item.idempotency_key) {
              syncHeaders['X-Idempotency-Key'] = item.idempotency_key
            }

            // Ejecutar la llamada a la API según el tipo
            if (item.type === 'field_note') {
              const res = await apiFetch('/api/field-notes', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: syncHeaders,
              })
              if (!res.ok) throw new Error('field_note sync failed')
            } else if (item.type === 'farm_event') {
              const res = await apiFetch('/api/farm-events', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: syncHeaders,
              })
              if (!res.ok) throw new Error('farm_event sync failed')
            } else if (item.type === 'bcs_update') {
              const { herd_id, bcs_score, bcs_label, ...metadata } = data
              await apiFetch(`/api/herds/${herd_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ bcs_score, bcs_label }),
                headers: syncHeaders,
              })
              await apiFetch('/api/movements', {
                method: 'POST',
                body: JSON.stringify({
                  entity_type: 'herd', entity_id: herd_id, entity_name: metadata.herd_name,
                  event_type: 'bcs', bcs_score, quantity: metadata.quantity, weight_kg: metadata.weight_kg,
                  categoria: metadata.categoria, breed: metadata.breed, admission_date: metadata.admission_date,
                  notes: `Condición Corporal registrada offline: ${bcs_score}/5 — ${bcs_label}`, photo_url: data.photo_url,
                  metadata: { bcs_label, head_count: metadata.quantity, ev: metadata.total_ev, photo_url: data.photo_url }
                }),
              })
              await apiFetch('/api/farm-events', {
                method: 'POST',
                body: JSON.stringify({
                  title: `Condición Corporal registrada: ${bcs_score}/5 — ${bcs_label}`,
                  event_type: 'medicion', event_date: new Date().toISOString(),
                  herd_id: herd_id, herd_ids: [herd_id], description: `BCS: ${bcs_score}/5`,
                  photo_url: data.photo_url, status: 'completado'
                }),
                headers: syncHeaders,
              })
            } else if (item.type === 'herd_update') {
              const { herd_id, ...payload } = data
              const res = await apiFetch(`/api/herds/${herd_id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
                headers: syncHeaders,
              })
              if (!res.ok) throw new Error('herd_update sync failed')
            } else if (item.type === 'paddock_update') {
              const { paddock_id, ...payload } = data
              const res = await apiFetch(`/api/paddocks/${paddock_id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
                headers: syncHeaders,
              })
              if (!res.ok) throw new Error('paddock_update sync failed')
            }

            if ((item.mediaType === 'audio' || item.hasAudio) && (item.mediaId || item.mediaIds?.audio)) {
              await deletePendingAudio(item.mediaId || item.mediaIds?.audio)
            }
            if ((item.mediaType === 'photo' || item.hasPhoto) && (item.mediaId || item.mediaIds?.photo)) {
              await deletePendingPhoto(item.mediaId || item.mediaIds?.photo)
            }
          } catch (e) {
            console.error('[Offline Sync] Failed to sync item:', item.type, e)
            failedItems.push({ ...item, syncing: false }) // quitar syncing para reintentar
            hasErrors = true
          }
        }

        // Limpiar ítems sincronizados — dejar solo los que fallaron y los que ya estaban en syncing (de un sync anterior)
        const previouslySyncing = queue.filter(q => q.syncing && !pendingItems.find(p => p.idempotency_key === q.idempotency_key))
        const newQueue = [...previouslySyncing, ...failedItems]
        localStorage.setItem('rodeo_offline_queue', JSON.stringify(newQueue))

        // Limpiar audios/fotos huérfanos (legacy: de implementaciones sin queue)
        const queuedMediaIds = new Set(queue.map((q: any) => q.mediaId).filter(Boolean))
        const trulyOrphanedAudios = orphanedAudios.filter((a: any) => !queuedMediaIds.has(a.id))
        const trulyOrphanedPhotos = orphanedPhotos.filter((p: any) => !queuedMediaIds.has(p.id))

        for (const pa of trulyOrphanedAudios) {
          const fd = new FormData()
          fd.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
          fd.append('folder', 'bitacora-audio')
          const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (up.ok) {
            const { url } = await up.json()
            await apiFetch('/api/field-notes', {
              method: 'POST', body: JSON.stringify({ paddock_id: null, tags: ['GENERAL'], title: pa.title, content: pa.transcript || null, audio_url: url, audio_duration_secs: pa.durationSecs })
            })
          }
          await deletePendingAudio(pa.id)
        }
        for (const pp of trulyOrphanedPhotos) {
          const fd = new FormData()
          fd.append('file', new File([pp.blob], `photo-${pp.id}.jpg`, { type: 'image/jpeg' }))
          fd.append('folder', 'bitacora-photos')
          const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (up.ok) {
            const { url } = await up.json()
            await apiFetch('/api/field-notes', {
              method: 'POST', body: JSON.stringify({ paddock_id: null, tags: ['GENERAL'], title: pp.title, photo_url: url })
            })
          }
          await deletePendingPhoto(pp.id)
        }

        readPending()

        if (newQueue.filter(q => !q.syncing).length === 0) {
          setStatus('synced')
          // Notificar a todas las páginas que el sync terminó → pueden recargar datos
          window.dispatchEvent(new Event('rodeo_sync_completed'))
          // También notificar al SW para que difunda a otras tabs
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SYNC_COMPLETED' })
          }
        } else {
          setStatus('offline') // algunos fallaron, siguen pendientes
        }

        setTimeout(() => {
          setVisible(false)
          if (newQueue.filter(q => !q.syncing).length === 0) setStatus('online')
          isSyncingGlobal = false
        }, 3000)
      } else {
        setStatus('online')
        setVisible(true)
        setTimeout(() => { setVisible(false); isSyncingGlobal = false }, 2000)
      }
    }

    // Estado inicial
    if (!navigator.onLine) {
      setStatus('offline')
      setVisible(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('rodeo_queue_updated', readPending)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('rodeo_queue_updated', readPending)
    }
  }, [])

  if (!visible && status === 'online') return null

  const configs = {
    offline: {
      bg: 'bg-gray-900', border: 'border-gray-700', icon: WifiOff, iconColor: 'text-red-400',
      text: 'Sin conexión',
      sub: pendingCount > 0
        ? `${pendingCount} registro${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} — se sincronizan al reconectar`
        : 'Podés seguir usando RODEO sin internet',
      subColor: 'text-gray-400',
    },
    syncing: {
      bg: 'bg-gray-900', border: 'border-amber-700', icon: RefreshCw, iconColor: 'text-amber-400',
      text: 'Sincronizando...',
      sub: pendingCount > 0
        ? `Subiendo ${pendingCount} registro${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}...`
        : 'Actualizando datos...',
      subColor: 'text-amber-400',
    },
    synced: {
      bg: 'bg-gray-900', border: 'border-green-800', icon: CheckCircle2, iconColor: 'text-green-400',
      text: '¡Todo sincronizado!', sub: 'Tus datos están actualizados', subColor: 'text-green-400',
    },
    online: {
      bg: 'bg-gray-900', border: 'border-green-800', icon: Wifi, iconColor: 'text-green-400',
      text: 'Conexión restaurada', sub: 'Estás en línea', subColor: 'text-green-400',
    },
  }

  const cfg = configs[status]
  const Icon = cfg.icon

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] ${cfg.bg} border ${cfg.border} rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 transition-all duration-500 animate-in slide-in-from-top-4`}
      role="status"
      aria-live="polite"
    >
      <Icon className={`w-4 h-4 shrink-0 ${cfg.iconColor} ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <div>
        <p className="text-xs font-black text-white">{cfg.text}</p>
        <p className={`text-[10px] font-medium ${cfg.subColor}`}>{cfg.sub}</p>
      </div>
    </div>
  )
}

/**
 * Agrega un ítem a la cola offline para sincronizar cuando haya conexión.
 * Cada ítem recibe un idempotency_key único para deduplicación en el servidor.
 */
export interface OfflineQueueItem {
  idempotency_key?: string
  type: string
  data: Record<string, unknown>
  timestamp: number
  mediaType?: 'audio' | 'photo'
  mediaId?: string
  mediaIds?: { audio?: string; photo?: string }
  hasAudio?: boolean
  hasPhoto?: boolean
  syncing?: boolean
}
export function addToOfflineQueue(item: Omit<OfflineQueueItem, 'idempotency_key' | 'syncing'>) {
  try {
    const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
    queue.push({
      ...item,
      idempotency_key: generateIdempotencyKey(),
      syncing: false,
    })
    localStorage.setItem('rodeo_offline_queue', JSON.stringify(queue))
    window.dispatchEvent(new Event('rodeo_queue_updated'))
  } catch (e) {
    console.error('[Offline Queue] Failed to add item:', e)
  }
}
