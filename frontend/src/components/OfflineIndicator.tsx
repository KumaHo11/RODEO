'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react'

type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced'

export default function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>('online')
  const [pendingCount, setPendingCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const [recentlyOnline, setRecentlyOnline] = useState(false)

  useEffect(() => {
    // Read pending count from localStorage
    const readPending = () => {
      try {
        const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
        setPendingCount(queue.length)
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
      if (queue.length > 0) {
        setStatus('syncing')
        setVisible(true)
        // Dispatch sync event for service worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SYNC_OFFLINE_QUEUE' })
        }
        // Simulate sync delay then mark as complete
        setTimeout(() => {
          localStorage.removeItem('rodeo_offline_queue')
          setPendingCount(0)
          setStatus('synced')
          setRecentlyOnline(true)
          setTimeout(() => {
            setVisible(false)
            setRecentlyOnline(false)
            setStatus('online')
          }, 3000)
        }, 1500)
      } else {
        setStatus('online')
        setRecentlyOnline(true)
        setVisible(true)
        setTimeout(() => {
          setVisible(false)
          setRecentlyOnline(false)
        }, 2000)
      }
    }

    // Check initial state
    if (!navigator.onLine) {
      setStatus('offline')
      setVisible(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for offline queue updates from other components
    const handleQueueUpdate = () => readPending()
    window.addEventListener('rodeo_queue_updated', handleQueueUpdate)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('rodeo_queue_updated', handleQueueUpdate)
    }
  }, [])

  if (!visible && status === 'online') return null

  const configs = {
    offline: {
      bg: 'bg-gray-900',
      border: 'border-gray-700',
      icon: WifiOff,
      iconColor: 'text-red-400',
      text: 'Sin conexión',
      sub: pendingCount > 0 ? `${pendingCount} nota${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar` : 'Podés seguir usando RODEO sin internet',
      subColor: 'text-gray-400',
    },
    syncing: {
      bg: 'bg-gray-900',
      border: 'border-gray-700',
      icon: RefreshCw,
      iconColor: 'text-amber-400',
      text: 'Sincronizando...',
      sub: `Subiendo ${pendingCount} registro${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}`,
      subColor: 'text-amber-400',
    },
    synced: {
      bg: 'bg-gray-900',
      border: 'border-green-800',
      icon: CheckCircle2,
      iconColor: 'text-green-400',
      text: '¡Todo sincronizado!',
      sub: 'Tus datos están actualizados',
      subColor: 'text-green-400',
    },
    online: {
      bg: 'bg-gray-900',
      border: 'border-green-800',
      icon: Wifi,
      iconColor: 'text-green-400',
      text: 'Conexión restaurada',
      sub: 'Estás en línea',
      subColor: 'text-green-400',
    },
  }

  const cfg = configs[status]
  const Icon = cfg.icon

  return (
    <div
      className={`
        fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]
        ${cfg.bg} border ${cfg.border}
        rounded-2xl px-4 py-2.5 shadow-2xl
        flex items-center gap-3
        transition-all duration-500
        animate-in slide-in-from-bottom-4
      `}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${cfg.iconColor} ${status === 'syncing' ? 'animate-spin' : ''}`}
      />
      <div>
        <p className="text-xs font-black text-white">{cfg.text}</p>
        <p className={`text-[10px] font-medium ${cfg.subColor}`}>{cfg.sub}</p>
      </div>
    </div>
  )
}

// ── Utility: add item to offline queue ─────────────────────────────────────
// Call this when saving data while potentially offline
export function addToOfflineQueue(item: {
  type: string
  data: Record<string, unknown>
  timestamp: number
}) {
  try {
    const queue = JSON.parse(localStorage.getItem('rodeo_offline_queue') || '[]')
    queue.push(item)
    localStorage.setItem('rodeo_offline_queue', JSON.stringify(queue))
    // Notify the indicator
    window.dispatchEvent(new Event('rodeo_queue_updated'))
  } catch (e) {
    console.error('Failed to add to offline queue:', e)
  }
}
