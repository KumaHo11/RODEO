'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react'

type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced'

export default function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>('online')
  const [pendingCount, setPendingCount] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Read pending count
    const readPending = async () => {
      try {
        const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
        const { countPendingItems } = await import('@/lib/audioOfflineStore')
        const mediaCount = await countPendingItems()
        setPendingCount(Math.max(queue.length, mediaCount))
      } catch {
        setPendingCount(0)
      }
    }

    readPending()

    const handleOffline = () => {
      setStatus('offline')
      setVisible(true)
    }

    const handleOnline = async () => {
      const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
      const { getPendingAudio, deletePendingAudio, getPendingPhoto, deletePendingPhoto, getAllPendingAudios, getAllPendingPhotos } = await import('@/lib/audioOfflineStore')
      const { apiFetch } = await import('@/lib/apiFetch')
      
      const orphanedAudios = await getAllPendingAudios()
      const orphanedPhotos = await getAllPendingPhotos()

      if (queue.length > 0 || orphanedAudios.length > 0 || orphanedPhotos.length > 0) {
        setStatus('syncing')
        setVisible(true)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SYNC_OFFLINE_QUEUE' })
        }
        
        let hasErrors = false
        const newQueue = []

        // Process Queue Items
        for (const item of queue) {
          try {
            const data = { ...item.data }

            // Handle Media Attachments
            if (item.mediaType === 'audio' && item.mediaId) {
              const pa = await getPendingAudio(item.mediaId)
              if (pa) {
                const fd = new FormData()
                fd.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
                fd.append('folder', 'bitacora-audio')
                const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
                if (uploadRes.ok) data.audio_url = (await uploadRes.json()).url

                let transcript = pa.transcript || ''
                if (!transcript) {
                  try {
                    const tf = new FormData()
                    tf.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
                    const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf })
                    if (tr.ok) { const d = await tr.json(); transcript = d.transcript || '' }
                  } catch { /* ignore */ }
                }
                if (!data.content && transcript && transcript !== '[Sin voz detectable]') data.content = transcript
                data.audio_duration_secs = pa.durationSecs
                await deletePendingAudio(pa.id)
              }
            } else if (item.mediaType === 'photo' && item.mediaId) {
              const pp = await getPendingPhoto(item.mediaId)
              if (pp) {
                const fd = new FormData()
                fd.append('file', new File([pp.blob], `photo-${pp.id}.jpg`, { type: 'image/jpeg' }))
                fd.append('folder', 'bitacora-photos')
                const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
                if (uploadRes.ok) data.photo_url = (await uploadRes.json()).url
                await deletePendingPhoto(pp.id)
              }
            }

            // Execute Endpoint Logic
            if (item.type === 'field_note') {
              const res = await apiFetch('/api/field-notes', { method: 'POST', body: JSON.stringify(data) })
              if (!res.ok) throw new Error('field_note sync failed')
            } else if (item.type === 'bcs_update') {
              const { herd_id, bcs_score, bcs_label, ...metadata } = data
              await apiFetch(`/api/herds/${herd_id}`, { method: 'PATCH', body: JSON.stringify({ bcs_score, bcs_label }) })
              await apiFetch('/api/movements', {
                method: 'POST',
                body: JSON.stringify({
                  entity_type: 'herd', entity_id: herd_id, entity_name: metadata.herd_name,
                  event_type: 'bcs', bcs_score, quantity: metadata.quantity, weight_kg: metadata.weight_kg,
                  categoria: metadata.categoria, breed: metadata.breed, admission_date: metadata.admission_date,
                  notes: `Condición Corporal registrada offline: ${bcs_score}/5 — ${bcs_label}`, photo_url: data.photo_url,
                  metadata: { bcs_label, head_count: metadata.quantity, ev: metadata.total_ev, photo_url: data.photo_url }
                })
              })
              await apiFetch('/api/farm-events', {
                method: 'POST',
                body: JSON.stringify({
                  title: `Condición Corporal registrada: ${bcs_score}/5 — ${bcs_label}`,
                  event_type: 'medicion', event_date: new Date().toISOString(),
                  herd_id: herd_id, herd_ids: [herd_id], description: `BCS: ${bcs_score}/5`,
                  photo_url: data.photo_url, status: 'completado'
                })
              })
            } else if (item.type === 'farm_event') {
               const res = await apiFetch('/api/farm-events', { method: 'POST', body: JSON.stringify(data) })
               if (!res.ok) throw new Error('farm_event sync failed')
            }
          } catch (e) {
            console.error('Failed to sync item:', item, e)
            newQueue.push(item)
            hasErrors = true
          }
        }
        
        // Clean up orphaned audios/photos from old implementations
        for (const pa of orphanedAudios) {
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
        for (const pp of orphanedPhotos) {
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

        localStorage.setItem('rodeo_offline_queue', JSON.stringify(newQueue))
        readPending()
        
        if (newQueue.length === 0) setStatus('synced')
        else setStatus('offline') // some failed

        setTimeout(() => {
          setVisible(false)
          if (newQueue.length === 0) setStatus('online')
        }, 3000)
      } else {
        setStatus('online')
        setVisible(true)
        setTimeout(() => setVisible(false), 2000)
      }
    }

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
      sub: pendingCount > 0 ? `${pendingCount} nota${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar` : 'Podés seguir usando RODEO sin internet',
      subColor: 'text-gray-400',
    },
    syncing: {
      bg: 'bg-gray-900', border: 'border-gray-700', icon: RefreshCw, iconColor: 'text-amber-400',
      text: 'Sincronizando...', sub: `Subiendo ${pendingCount} registro${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}`, subColor: 'text-amber-400',
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
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] ${cfg.bg} border ${cfg.border} rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 transition-all duration-500 animate-in slide-in-from-top-4`} role="status" aria-live="polite">
      <Icon className={`w-4 h-4 shrink-0 ${cfg.iconColor} ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <div>
        <p className="text-xs font-black text-white">{cfg.text}</p>
        <p className={`text-[10px] font-medium ${cfg.subColor}`}>{cfg.sub}</p>
      </div>
    </div>
  )
}

export function addToOfflineQueue(item: {
  type: string
  data: Record<string, unknown>
  timestamp: number
  mediaType?: 'audio' | 'photo'
  mediaId?: string
}) {
  try {
    const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
    queue.push(item)
    localStorage.setItem('rodeo_offline_queue', JSON.stringify(queue))
    window.dispatchEvent(new Event('rodeo_queue_updated'))
  } catch (e) {
    console.error('Failed to add to offline queue:', e)
  }
}
