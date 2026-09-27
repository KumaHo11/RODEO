/**
 * SandboxPlanPanel.tsx — Panel de Planes Activos en la Mesa de Arena
 * ────────────────────────────────────────────────────────────────────
 * Tarea 5: Lista los planes ya generados/guardados del usuario.
 * Al seleccionar uno, carga sus parámetros de vuelta al SandboxStore
 * para edición y re-guardado.
 *
 * Se monta debajo de la columna de Rodeos (Col 1) en la Mesa de Arena.
 */
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import { HerdPlanTabs, type PlanTabItem } from '@/components/shared/HerdPlanTabs'
import { Loader2, RefreshCw, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface SeasonPlan {
  id: string
  name: string
  status: string
  source: string
  year?: number
  start_date?: string
  end_date?: string
  season_type?: string
  herd_ids?: string[]
  cell_paddock_ids?: string[]
  daily_allocation_kg?: number
  target_remnant_kg_ha?: number
  recovery_days?: {
    spring_summer?: number
    autumn_winter?: number
  }
}

// ── Constantes de colores ──────────────────────────────────────────────────────

const PLAN_COLORS = [
  '#008234', '#0ea5e9', '#f59e0b', '#8b5cf6',
  '#10b981', '#f97316', '#ec4899', '#6366f1',
]

// ── Componente ────────────────────────────────────────────────────────────────

interface SandboxPlanPanelProps {
  /** Si hay usuarios autenticados (para las API calls) */
  enabled: boolean
}

export default function SandboxPlanPanel({ enabled }: SandboxPlanPanelProps) {
  const [plans, setPlans] = useState<SeasonPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [activePlanId, setActivePlanId] = useState<string | null>(null)

  const setConfig   = useSandboxStore(s => s.setConfig)
  const setMode     = useSandboxStore(s => s.setMode)
  const herds       = useSandboxStore(s => s.herds)
  const paddockRows = useSandboxStore(s => s.paddockRows)
  const toggleHerdEnabled    = useSandboxStore(s => s.toggleHerdEnabled)
  const togglePaddockEnabled = useSandboxStore(s => s.togglePaddockEnabled)

  // ── Cargar planes al montar ────────────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/season-plans')
      if (!res.ok) return
      const data = await res.json()
      const list: SeasonPlan[] = data.plans ?? data ?? []
      // Ordenar por año desc, luego por nombre
      list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      setPlans(list)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => { loadPlans() }, [loadPlans])

  // ── Cargar parámetros de un plan en el store ────────────────────────────────
  const handleSelectPlan = useCallback((planItem: PlanTabItem) => {
    if (planItem.id === activePlanId) {
      setActivePlanId(null)
      return
    }

    const sp = plans.find(p => p.id === planItem.id)
    if (!sp) return

    setActivePlanId(sp.id)

    // 1. Cambiar el modo según el tipo de temporada
    const isOpen = sp.season_type !== 'cerrado'
    setMode(isOpen ? 'open' : 'closed')

    // 2. Actualizar la config con los parámetros del plan
    const configUpdates: Record<string, any> = {}
    if (sp.start_date)              configUpdates.fechaInicio  = sp.start_date
    if (sp.end_date)                configUpdates.fechaFin     = sp.end_date
    if (sp.daily_allocation_kg)     configUpdates.dailyAllocationKgEv  = sp.daily_allocation_kg
    if (sp.target_remnant_kg_ha)    configUpdates.targetRemnantKgHa    = sp.target_remnant_kg_ha
    if (sp.recovery_days?.spring_summer) configUpdates.descansosPrimavera = sp.recovery_days.spring_summer
    if (sp.recovery_days?.autumn_winter) configUpdates.descansosVerano    = sp.recovery_days.autumn_winter

    if (Object.keys(configUpdates).length > 0) setConfig(configUpdates)

    // 3. Activar los rodeos del plan
    if (sp.herd_ids?.length) {
      const herdIdsToEnable = new Set(sp.herd_ids)
      herds.forEach(h => {
        const shouldBeEnabled = herdIdsToEnable.has(h.id)
        if (h.enabled !== shouldBeEnabled) toggleHerdEnabled(h.id)
      })
    }

    // 4. Activar los potreros del plan
    if (sp.cell_paddock_ids?.length) {
      const paddockIdsToEnable = new Set(sp.cell_paddock_ids)
      paddockRows.forEach(p => {
        const shouldBeEnabled = paddockIdsToEnable.has(p.id)
        if (p.enabled !== shouldBeEnabled) togglePaddockEnabled(p.id)
      })
    }

    toast.success(`Plan "${sp.name}" cargado en la mesa de arena. Modificalo y guardá un nuevo plan.`)
  }, [activePlanId, plans, setMode, setConfig, herds, paddockRows, toggleHerdEnabled, togglePaddockEnabled])

  // ── Tabs items ─────────────────────────────────────────────────────────────
  const tabItems: PlanTabItem[] = plans.map((sp, idx) => ({
    id: sp.id,
    name: sp.name || `Plan ${sp.year || idx + 1}`,
    subtitle: [
      sp.season_type === 'cerrado' ? 'Cerrado' : 'Abierto',
      sp.year ? String(sp.year) : undefined,
      sp.herd_ids?.length ? `${sp.herd_ids.length} rodeo${sp.herd_ids.length !== 1 ? 's' : ''}` : undefined,
    ].filter(Boolean).join(' · '),
    color: PLAN_COLORS[idx % PLAN_COLORS.length],
    status: sp.status === 'COMPLETED' ? 'completed' : sp.source === 'suggested' ? 'suggested' : 'active',
  }))

  if (!enabled) return null

  return (
    <div className="border-t border-gray-100 mt-2">
      {/* Header del panel — usa div para evitar <button> anidado */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(v => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(v => !v) }}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors rounded-b-xl cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
            Planes guardados
          </span>
          {plans.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-[9px] font-black flex items-center justify-center">
              {plans.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
          {/* Este span actúa como botón para evitar <button> dentro de <button> */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); loadPlans() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); loadPlans() } }}
            className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors cursor-pointer"
            title="Recargar planes"
            aria-label="Recargar planes"
          >
            <RefreshCw className="w-3 h-3" />
          </span>
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronUp   className="w-3.5 h-3.5 text-gray-400" />
          }
        </div>
      </div>

      {/* Lista de planes */}
      {!collapsed && (
        <div className="px-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            </div>
          ) : tabItems.length === 0 ? (
            <p className="text-center text-[11px] text-gray-300 py-4 font-medium">
              No hay planes guardados aún. Generá tu primer plan.
            </p>
          ) : (
            <HerdPlanTabs
              plans={tabItems}
              activeId={activePlanId}
              onSelect={handleSelectPlan}
              onDelete={async (plan) => {
                const ok = window.confirm(`¿Seguro que deseas eliminar el plan "${plan.name}"?`)
                if (!ok) return
                try {
                  const res = await apiFetch(`/api/season-plans/${plan.id}`, { method: 'DELETE' })
                  if (res.ok) {
                    toast.success('Plan eliminado')
                    if (activePlanId === plan.id) setActivePlanId(null)
                    loadPlans()
                  } else {
                    toast.error('No se pudo eliminar el plan')
                  }
                } catch {
                  toast.error('Error de red al eliminar el plan')
                }
              }}
              showDelete={true}
              variant="list"
              emptyMessage="Sin planes guardados"
            />
          )}
        </div>
      )}
    </div>
  )
}
