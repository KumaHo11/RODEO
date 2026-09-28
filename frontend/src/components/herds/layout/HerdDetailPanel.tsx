'use client'

/**
 * HerdDetailPanel — Panel derecho del Master-Detail.
 *
 * Orquesta:
 *   1. Fetch del rodeo por ID
 *   2. HerdDetailHeader (KPIs + tabs, siempre visible)
 *   3. Render del tab activo (lazy)
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/apiFetch'
import { HerdDetailHeader } from '../header/HerdDetailHeader'
import type { HerdData } from '@/components/HerdModal'
import type { HerdTab } from '@/types/herds'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useHerds } from '@/lib/context/HerdsContext'

// ── Lazy tab imports (code-split por tab) ─────────────────────────────────────
// Se importan de forma dinámica para no cargar todos los charts en el bundle inicial.
import dynamic from 'next/dynamic'

const HerdDatosTab       = dynamic(() => import('../tabs/datos/HerdDatosTab'),        { ssr: false, loading: () => <TabSkeleton /> })
const HerdActividadesTab = dynamic(() => import('../tabs/actividades/HerdActividadesTab'), { ssr: false, loading: () => <TabSkeleton /> })
const HerdAnimalesTab    = dynamic(() => import('../tabs/animales/HerdAnimalesTab'),   { ssr: false, loading: () => <TabSkeleton /> })
const HerdMetricasTab    = dynamic(() => import('../tabs/metricas/HerdMetricasTab'),   { ssr: false, loading: () => <TabSkeleton /> })
const HerdBitacoraTab    = dynamic(() => import('../tabs/bitacora/HerdBitacoraTab'),   { ssr: false, loading: () => <TabSkeleton /> })

const TAB_COMPONENTS: Record<HerdTab, React.ComponentType<{ herd: HerdData; onRefresh: () => void }>> = {
  datos:        HerdDatosTab,
  actividades:  HerdActividadesTab,
  animales:     HerdAnimalesTab,
  metricas:     HerdMetricasTab,
  bitacora:     HerdBitacoraTab,
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface HerdDetailPanelProps {
  herdId: string
  activeTab: HerdTab
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HerdDetailPanel({ herdId, activeTab }: HerdDetailPanelProps) {
  const router = useRouter()
  const [herd, setHerd] = useState<HerdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Caso especial: rodeo vacío placeholder
  const isEmpty = herdId === '_empty'

  const fetchHerd = useCallback(async () => {
    if (isEmpty) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/herds/${herdId}`)
      if (res.status === 404) {
        // El rodeo no existe → redirigir al index que seleccionará el primero
        router.replace('/dashboard/herds')
        return
      }
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      // La API puede devolver { herd: {...} } o el objeto directamente
      setHerd(data.herd ?? data)
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar el rodeo')
    } finally {
      setLoading(false)
    }
  }, [herdId, isEmpty, router])

  useEffect(() => {
    fetchHerd()
  }, [fetchHerd])

  if (isEmpty && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-base font-black text-gray-600 mb-1">Sin rodeos todavía</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Creá tu primer rodeo usando el botón &ldquo;+ Nuevo rodeo&rdquo;.
        </p>
      </div>
    )
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <HeaderSkeleton />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !herd) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-sm font-bold text-gray-700">{error ?? 'No se encontró el rodeo'}</p>
          <button
            onClick={fetchHerd}
            className="text-xs font-bold text-green-600 hover:text-green-700 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Render activo ────────────────────────────────────────────────────────────
  const ActiveTab = TAB_COMPONENTS[activeTab]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header KPI + tabs — siempre visible */}
      <HerdDetailHeader herd={herd} activeTab={activeTab} />

      {/* Contenido del tab — scrollable con padding propio */}
      <div className="flex-1 overflow-y-auto">
        {/*
         * max-w-screen-xl + mx-auto: en pantallas grandes el contenido se
         * centra y no se estira infinitamente.
         * px-6 py-6: padding interno generoso y consistente en todos los tabs.
         */}
        <div className="max-w-screen-xl mx-auto">
          <ActiveTab herd={herd} onRefresh={fetchHerd} />
        </div>
      </div>
    </div>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="shrink-0 bg-white border-b border-gray-100 px-6 pt-4 pb-0 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <div className="h-7 w-48 bg-gray-200 rounded-lg" />
        <div className="flex gap-2 ml-auto">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-20 bg-gray-100 rounded-t-lg" />
        ))}
      </div>
    </div>
  )
}


function TabSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-5 w-32 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-gray-100 rounded-2xl" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
      </div>
      <div className="h-48 bg-gray-100 rounded-2xl" />
    </div>
  )
}

// ── Slug resolver ─────────────────────────────────────────────────────────────

/** Convierte nombre → slug: "Recría Hembras" → "recria-hembras" */
export function toHerdSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ── Panel resolutor de slugs ──────────────────────────────────────────────────

/**
 * HerdDetailPanelResolved — acepta herd_id como:
 *   - UUID real:    'f360b542-4678-...'
 *   - Slug nombre:  'vacas', 'recria-hembras'
 *
 * Resuelve el slug contra la lista de rodeos del HerdsContext.
 * Actualiza el herd seleccionado en el contexto cuando se resuelve.
 */
export function HerdDetailPanelResolved({
  herdSlugOrId,
  activeTab,
}: {
  herdSlugOrId: string
  activeTab: HerdTab
}) {
  const { herds, loading: herdsLoading, selectHerd } = useHerds()
  const router = useRouter()

  // Resolver slug → herd ID
  const resolvedId = React.useMemo(() => {
    if (!herds.length) return null
    // 1. Buscar por ID exacto (UUID)
    const byId = herds.find(h => h.id === herdSlugOrId)
    if (byId) return byId.id
    // 2. Buscar por slug de nombre
    const bySlug = herds.find(h => toHerdSlug(h.name) === herdSlugOrId)
    if (bySlug) return bySlug.id
    return null
  }, [herds, herdSlugOrId])

  // Actualizar contexto cuando se resuelve
  useEffect(() => {
    if (resolvedId) selectHerd(resolvedId)
  }, [resolvedId, selectHerd])

  // ⚠️ Bug fix: useEffect — never call router.replace() directly in render body.
  // Doing so triggers "Cannot update a component while rendering a different component".
  useEffect(() => {
    if (!herdsLoading && !resolvedId && herds.length > 0) {
      router.replace('/dashboard/herds')
    }
  }, [herdsLoading, resolvedId, herds.length, router])

  // Aún cargando herds
  if (herdsLoading && !resolvedId) {
    return (
      <div className="flex-1 flex flex-col">
        <HeaderSkeleton />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      </div>
    )
  }

  // Slug no resuelto → spinner mientras el useEffect redirige
  if (!herdsLoading && !resolvedId && herds.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  // Sin rodeos en la org
  if (!herdsLoading && herds.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-base font-black text-gray-600 mb-1">Sin rodeos todavía</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Creá tu primer rodeo usando el botón &ldquo;+ Nuevo rodeo&rdquo;.
        </p>
      </div>
    )
  }

  if (!resolvedId) return null

  return <HerdDetailPanel herdId={resolvedId} activeTab={activeTab} />
}
