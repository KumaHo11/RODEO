'use client'

/**
 * components/OfflineManager.tsx
 * Componente global de gestión offline-first.
 *
 * Reemplaza el antiguo OfflineIndicator con una arquitectura correcta:
 *  - Inicializa IndexedDB al montar
 *  - Llama prefetchAll() en background cuando hay conexión
 *  - Inicializa el motor de sync (initSync)
 *  - Muestra toast/banner de estado al usuario
 *  - Exporta addToOfflineQueue para compatibilidad con código legado
 */

import { useEffect, useRef, useCallback, createContext, useContext, useState } from 'react'
import { useAuth } from './AuthProvider'
import { initSync, triggerSync } from '@/lib/offline/sync'
import { prefetchAll } from '@/lib/offline/prefetch'
import { processQueue, getPendingCount } from '@/lib/offline/outbox'
import { toast } from 'sonner'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'

/**
 * Limpia el rodeo_offline_queue del localStorage legacy.
 * Elimina ítems con syncing:true que quedan atascados después de un reinicio.
 * Esto evita que el OfflineIndicator viejo interfiera con el nuevo OfflineManager.
 */
function cleanLegacyLocalStorageQueue() {
  try {
    const raw = localStorage.getItem('rodeo_offline_queue')
    if (!raw) return
    const queue = JSON.parse(raw)
    if (!Array.isArray(queue)) {
      localStorage.removeItem('rodeo_offline_queue')
      return
    }
    // Quitar solo los marcados como syncing:true (quedaron atascados)
    const cleaned = queue.filter((item: any) => !item.syncing)
    if (cleaned.length !== queue.length) {
      localStorage.setItem('rodeo_offline_queue', JSON.stringify(cleaned))
    }
  } catch {
    // Si está corrupto, limpiar
    try { localStorage.removeItem('rodeo_offline_queue') } catch { /* ignore */ }
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface OfflineContextValue {
  isOffline: boolean
  pendingCount: number
  isSyncing: boolean
  syncNow: () => void
}

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  pendingCount: 0,
  isSyncing: false,
  syncNow: () => {},
})

export function useOfflineStatus() {
  return useContext(OfflineContext)
}

// ── Legacy compatibility: addToOfflineQueue ───────────────────────────────────
// Mantiene compatibilidad con código anterior que llama addToOfflineQueue()
// internamente rutea al nuevo sistema de outbox

import { enqueue } from '@/lib/offline/outbox'

const LEGACY_URL_MAP: Record<string, string> = {
  farm_event:   '/api/farm-events',
  task:         '/api/tasks',
  field_note:   '/api/field-notes',
  paddock_update: '/api/paddocks',
  herd_event:   '/api/movements',
}

export function addToOfflineQueue(item: {
  type: string
  data: any
  timestamp?: number
  mediaType?: string
  mediaId?: string
  [key: string]: any
}): void {
  const url = LEGACY_URL_MAP[item.type] ?? `/api/${item.type}s`
  enqueue({
    type: item.type,
    url,
    method: 'POST',
    body: item.data,
    idempotency_key: `${item.type}-${item.timestamp ?? Date.now()}-${Math.random().toString(36).slice(2)}`,
  }).catch(err => console.warn('[OfflineManager] enqueue error:', err))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfflineManager({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth()
  const [isOffline, setIsOffline]   = useState(false)
  const [isSyncing, setIsSyncing]   = useState(false)
  const [pendingCount, setPending]  = useState(0)
  const initDoneRef                 = useRef(false)
  const toastIdRef                  = useRef<string | number | null>(null)
  const syncTimeoutRef              = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Función para obtener el token del usuario actual
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null
    try {
      return await user.getIdToken()
    } catch {
      return null
    }
  }, [user])

  // Refrescar conteo de pendientes
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount()
    setPending(count)
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || initDoneRef.current) return
    initDoneRef.current = true

    // Limpiar ítems syncing:true atascados del sistema legacy (localStorage)
    cleanLegacyLocalStorageQueue()

    // Inicializar motor de sync
    initSync(getToken)

    // Estado inicial de red
    setIsOffline(!navigator.onLine)

    // Prefetch inicial si hay red
    if (navigator.onLine) {
      setTimeout(async () => {
        const token = await getToken()
        if (token) prefetchAll(token)
      }, 3000) // esperar 3s para no interferir con el render inicial
    }

    // Contar pendientes iniciales
    refreshPendingCount()
  }, [user, getToken, refreshPendingCount])

  // ── Listeners ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      if (toastIdRef.current) toast.dismiss(toastIdRef.current)
      toast.success('Conexión restaurada', {
        description: 'Sincronizando datos pendientes...',
        duration: 3000,
        icon: <Wifi className="w-4 h-4 text-green-500" />,
      })
    }

    const handleOffline = () => {
      setIsOffline(true)
      toastIdRef.current = toast.warning('Sin conexión', {
        description: 'Trabajando en modo offline. Los cambios se guardan localmente.',
        duration: Infinity,
        icon: <WifiOff className="w-4 h-4 text-amber-500" />,
      })
    }

    const handleSyncStart = () => {
      // Solo mostrar spinner si hay items pendientes en el outbox
      // El pre-fetch silencioso no debe mostrar el spinner
      getPendingCount().then(count => {
        if (count > 0) {
          setIsSyncing(true)
          // Safety timeout: si en 15s no termina, limpiar el spinner igual
          if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
          syncTimeoutRef.current = setTimeout(() => {
            setIsSyncing(false)
            refreshPendingCount()
          }, 15_000)
        }
      })
    }

    const handleSyncDone = (ev: Event) => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      setIsSyncing(false)
      refreshPendingCount()
      const detail = (ev as CustomEvent).detail ?? {}
      if (detail.processed > 0) {
        toast.success(`${detail.processed} registro${detail.processed > 1 ? 's' : ''} sincronizado${detail.processed > 1 ? 's' : ''}`, {
          duration: 3000,
          icon: <RefreshCw className="w-4 h-4 text-green-500" />,
        })
      }
    }

    const handleQueueUpdated = () => {
      refreshPendingCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('rodeo_sync_start', handleSyncStart)
    window.addEventListener('rodeo_sync_completed', handleSyncDone)
    window.addEventListener('rodeo_queue_updated', handleQueueUpdated)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('rodeo_sync_start', handleSyncStart)
      window.removeEventListener('rodeo_sync_completed', handleSyncDone)
      window.removeEventListener('rodeo_queue_updated', handleQueueUpdated)
    }
  }, [refreshPendingCount])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [])

  // Auto-clear isSyncing when pendingCount drops to 0
  useEffect(() => {
    if (pendingCount === 0 && isSyncing) {
      setIsSyncing(false)
    }
  }, [pendingCount, isSyncing])

  const syncNow = useCallback(() => {
    if (!navigator.onLine) {
      toast.error('Sin conexión', { description: 'Conectate a internet para sincronizar.' })
      return
    }
    setIsSyncing(true)
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      setIsSyncing(false)
      refreshPendingCount()
    }, 15_000)
    triggerSync(getToken).finally(() => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      setIsSyncing(false)
      refreshPendingCount()
    })
  }, [getToken, refreshPendingCount])

  return (
    <OfflineContext.Provider value={{ isOffline, pendingCount, isSyncing, syncNow }}>
      {children}

      {/* Badge de pendientes persistente cuando hay items en outbox */}
      {pendingCount > 0 && !isSyncing && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none sm:pointer-events-auto">
          <div className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold backdrop-blur-sm">
            <WifiOff className="w-3.5 h-3.5" />
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''} sin sincronizar
          </div>
        </div>
      )}

      {/* Spinner de sync — solo cuando hay pendientes que se están enviando */}
      {isSyncing && pendingCount > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none">
          <div className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Sincronizando...
          </div>
        </div>
      )}
    </OfflineContext.Provider>
  )
}

export default OfflineManager
