'use client'

/**
 * HerdsContext — Contexto global para la sección Rodeos.
 *
 * Provee:
 *  - Lista de rodeos (con lotes / ungrouped)
 *  - ID del rodeo seleccionado actualmente (persiste en localStorage)
 *  - Función para seleccionar un rodeo
 *  - Función para refrescar la lista
 *
 * El ID seleccionado se guarda en localStorage ('selected_herd_id') para que
 * persista entre navegaciones y recargas sin que aparezca en la URL.
 */

import React, {
  createContext, useContext,
  useState, useEffect, useCallback,
  type ReactNode,
} from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { dbGetAll, dbUpsertMany, metaGet, metaSet } from '@/lib/offline/db'
import { useAuth } from '@/components/AuthProvider'
import type { HerdData } from '@/components/HerdModal'
import type { LoteData } from '@/components/LoteCard'

const STORAGE_KEY = 'selected_herd_id'

// ── Context type ──────────────────────────────────────────────────────────────

interface HerdsContextValue {
  herds:          HerdData[]
  lotes:          LoteData[]
  ungrouped:      HerdData[]
  loading:        boolean
  selectedHerdId: string | null
  selectHerd:     (id: string) => void
  refreshHerds:   () => Promise<void>
}

const HerdsCtx = createContext<HerdsContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function HerdsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [herds,          setHerds]          = useState<HerdData[]>([])
  const [lotes,          setLotes]          = useState<LoteData[]>([])
  const [ungrouped,      setUngrouped]      = useState<HerdData[]>([])
  const [loading,        setLoading]        = useState(true)
  const [selectedHerdId, setSelectedHerdId] = useState<string | null>(null)

  // Restaurar la selección de localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setSelectedHerdId(saved)
    } catch { /* ignore */ }
  }, [])

  const selectHerd = useCallback((id: string) => {
    setSelectedHerdId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
  }, [])

  const refreshHerds = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Paso 1: IDB inmediata
      const [localHerds, cachedStructure] = await Promise.all([
        dbGetAll('herds'),
        metaGet('herds_structure'),
      ])
      if (localHerds.length > 0) {
        const hData = localHerds as HerdData[]
        setHerds(hData)
        if (cachedStructure) {
          setLotes(cachedStructure.lotes || [])
          setUngrouped(cachedStructure.ungrouped || hData)
        } else {
          setUngrouped(hData)
        }
        // Auto-seleccionar primero si no hay selección
        setSelectedHerdId(prev => {
          if (prev) return prev
          const first = hData[0]?.id ?? null
          if (first) try { localStorage.setItem(STORAGE_KEY, first) } catch { /**/ }
          return first
        })
        setLoading(false)
      }

      // Paso 2: API en background
      const res = await apiFetch('/api/herds')
      if (res.ok) {
        const data            = await res.json()
        const herdsData: HerdData[]    = data.herds    || []
        const lotesData: LoteData[]    = data.lotes    || []
        const ungroupedData: HerdData[] = data.ungrouped || herdsData
        setHerds(herdsData)
        setLotes(lotesData)
        setUngrouped(ungroupedData)
        // Auto-seleccionar si todavía no hay selección
        setSelectedHerdId(prev => {
          if (prev && herdsData.find(h => h.id === prev)) return prev
          const first = herdsData[0]?.id ?? null
          if (first) try { localStorage.setItem(STORAGE_KEY, first) } catch { /**/ }
          return first
        })
        await Promise.all([
          dbUpsertMany('herds', herdsData),
          metaSet('herds_structure', { lotes: lotesData, ungrouped: ungroupedData }),
        ])
      }
    } catch {
      // IDB ya cargado — fallar silenciosamente
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refreshHerds() }, [refreshHerds])

  // Escuchar eventos externos
  useEffect(() => {
    const on = () => refreshHerds()
    window.addEventListener('rodeo_sync_completed', on)
    window.addEventListener('herd_saved', on)
    return () => {
      window.removeEventListener('rodeo_sync_completed', on)
      window.removeEventListener('herd_saved', on)
    }
  }, [refreshHerds])

  return (
    <HerdsCtx.Provider value={{
      herds, lotes, ungrouped, loading,
      selectedHerdId, selectHerd, refreshHerds,
    }}>
      {children}
    </HerdsCtx.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHerds(): HerdsContextValue {
  const ctx = useContext(HerdsCtx)
  if (!ctx) throw new Error('useHerds must be used inside HerdsProvider')
  return ctx
}
