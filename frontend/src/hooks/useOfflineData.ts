/**
 * hooks/useOfflineData.ts
 * Hook unificado para lectura de datos con soporte offline-first.
 *
 * Estrategia:
 *  1. Lee de IndexedDB INMEDIATAMENTE (respuesta instantánea, sin loading)
 *  2. Si hay red, llama la API y actualiza el store en background
 *  3. Cuando se completa el sync, refresca automáticamente
 *
 * Uso:
 *  const { data, isOffline, isStale, reload } = useOfflineData({
 *    store: 'herds',
 *    apiUrl: '/api/herds',
 *    transform: (json) => json.herds ?? [],
 *    user,
 *  })
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { dbGetAll, dbUpsertMany, dbGetOrg, dbUpsertOrg } from '@/lib/offline/db'
import { isOffline } from '@/lib/connectivity'

type StoreNames = 'paddocks' | 'herds' | 'farm_events' | 'field_notes' | 'tasks' | 'grazing_plans'

interface UseOfflineDataOptions<T> {
  store: StoreNames | 'organizations'
  apiUrl: string
  /** Transforma el JSON de la API en el array/objeto que querés */
  transform: (json: any) => T
  /** Usuario de Firebase — si es null, no carga */
  user: any | null
  /** Si true, no hace llamada a la API aunque haya red */
  localOnly?: boolean
}

interface UseOfflineDataResult<T> {
  data: T
  isLoading: boolean
  isOfflineData: boolean
  isStale: boolean
  reload: () => Promise<void>
}

export function useOfflineData<T = any[]>({
  store,
  apiUrl,
  transform,
  user,
  localOnly = false,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const [data, setData]               = useState<T>([] as unknown as T)
  const [isLoading, setIsLoading]     = useState(true)
  const [isOfflineData, setIsOffline] = useState(false)
  const [isStale, setIsStale]         = useState(false)
  const mountedRef                    = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    if (!mountedRef.current) return

    setIsLoading(true)

    // ── Paso 1: Leer de IndexedDB inmediatamente ──────────────────────────────
    try {
      let localData: any
      if (store === 'organizations') {
        localData = await dbGetOrg()
        if (localData) {
          const transformed = transform(localData)
          if (mountedRef.current) {
            setData(transformed)
            setIsLoading(false)
            setIsOffline(false)
          }
        }
      } else {
        const items = await dbGetAll(store as StoreNames)
        if (items.length > 0) {
          const transformed = transform({ [store]: items, items })
          if (mountedRef.current) {
            setData(transformed)
            setIsLoading(false)
            setIsOffline(false)
          }
        }
      }
    } catch {
      // IndexedDB no disponible — continuar con API
    }

    // ── Paso 2: Si hay red, actualizar desde API en background ────────────────
    if (localOnly) {
      setIsLoading(false)
      return
    }

    const offline = await isOffline()
    if (offline) {
      if (mountedRef.current) {
        setIsOffline(true)
        setIsLoading(false)
        setIsStale(true)
      }
      return
    }

    try {
      const res = await fetch(apiUrl, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`API ${res.status}`)

      const json = await res.json()
      const transformed = transform(json)

      // Actualizar IndexedDB con datos frescos
      if (store === 'organizations') {
        const org = json.organization ?? json.org ?? json
        if (org?.id) await dbUpsertOrg(org)
      } else {
        const items = json[store] ?? json.items ?? json.data ?? []
        if (Array.isArray(items)) {
          await dbUpsertMany(store as StoreNames, items)
        }
      }

      if (mountedRef.current) {
        setData(transformed)
        setIsOffline(false)
        setIsStale(false)
        setIsLoading(false)
      }
    } catch {
      // API falló — mantener datos de IndexedDB
      if (mountedRef.current) {
        setIsOffline(true)
        setIsStale(true)
        setIsLoading(false)
      }
    }
  }, [user, store, apiUrl, transform, localOnly])

  useEffect(() => {
    load()
  }, [load])

  // Recargar cuando termine sync
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('rodeo_sync_completed', handler)
    return () => window.removeEventListener('rodeo_sync_completed', handler)
  }, [load])

  return { data, isLoading, isOfflineData, isStale, reload: load }
}
