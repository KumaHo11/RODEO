'use client'

/**
 * usePlanViewFilters.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH para el estado de UI de las vistas de planificaciones
 * ganaderas (Gantt, Lista, Historial).
 *
 * RESPONSABILIDADES:
 *  1. Estado de filtros (búsqueda, status, rango de fechas)
 *  2. Selección de SeasonPlans (multi-selección para Gantt)
 *  3. Asignación determinista de colores por plan
 *  4. Filtrado derivado de planes según la vista activa
 *  5. Agrupación de planes para el acordeón
 *
 * PRINCIPIO: Este hook es READ-ONLY respecto a los datos de backend.
 * Las mutaciones (save, delete, move) permanecen en page.tsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useCallback } from 'react'
import {
  groupPlansBySeasonPlan,
  isPlanSuggested,
  getPlanSeasonId,
  type GrazingPlanRow,
  type HerdRow,
  type SeasonPlanRow,
  type AccordionGroup,
} from '@/lib/grazing/planFormatters'

// ─── Paleta de colores para SeasonPlans seleccionados ────────────────────────
// Colores curados: armónicos, de alto contraste entre sí, y distintos del verde RODEO.
export const SEASON_PLAN_PALETTE = [
  '#3b82f6', // Azul royal — plan 1
  '#f59e0b', // Ámbar dorado — plan 2
  '#8b5cf6', // Violeta — plan 3
  '#ef4444', // Coral — plan 4
  '#06b6d4', // Cyan — plan 5
  '#ec4899', // Rosa fucsia — plan 6
  '#14b8a6', // Teal — plan 7
  '#f97316', // Naranja — plan 8
] as const

// El verde esmeralda de RODEO se reserva para el estado "activo/pastando"
// y NO se usa en la paleta de planes para evitar ambigüedad semántica.

export const HERD_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#4338ca',
] as const

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ViewMode = 'gantt' | 'list' | 'history'
export type GanttTab = 'suggested' | 'manual'
export type HistoryTab = 'all' | 'suggested' | 'manual'
export type FilterStatus = 'all' | 'ACTIVE' | 'PLANNED' | 'COMPLETED'

export interface PlanViewFiltersState {
  // ── Filtros de búsqueda ──
  search: string
  filterStatus: FilterStatus
  dateRangeFrom: string | null  // ISO YYYY-MM-DD
  dateRangeTo: string | null

  // ── Selección de SeasonPlans ──
  /** IDs de los planes de temporada activos en el Gantt (multi-selección) */
  selectedSeasonPlanIds: string[]
  /** El plan cuyo viewport se usa para posicionar la ventana del Gantt */
  activeSeasonPlanId: string | null

  // ── Modo de vista ──
  viewMode: ViewMode
  activeGanttTab: GanttTab
  historyTab: HistoryTab
}

export interface PlanViewFiltersActions {
  setSearch: (v: string) => void
  setFilterStatus: (v: FilterStatus) => void
  setDateRange: (from: string | null, to: string | null) => void
  /** Activa/desactiva un SeasonPlan en el Gantt (multi-selección tipo checkbox) */
  toggleSeasonPlan: (id: string) => void
  /** Selecciona solo UN plan de temporada (deselecciona el resto) */
  selectSeasonPlanOnly: (id: string) => void
  setActiveSeasonPlanId: (id: string | null) => void
  /** Limpia la selección de planes para forzar el re-auto-select */
  resetSelection: () => void
  setViewMode: (v: ViewMode) => void
  setActiveGanttTab: (v: GanttTab) => void
  setHistoryTab: (v: HistoryTab) => void
  clearFilters: () => void
}

export interface PlanViewDerivedData {
  /** Planes filtrados según la vista activa y todos los criterios */
  filteredPlans: GrazingPlanRow[]
  /** Planes agrupados por SeasonPlan para el acordeón — SSOT */
  accordionGroups: AccordionGroup[]
  /** SeasonPlanId → color asignado (determinista por orden de selección) */
  seasonPlanColorMap: Record<string, string>
  /** HerdId → color asignado (estable por índice de rodeo) */
  herdColorMap: Record<string, string>
  /** Si el filtro activo ha dejado resultados vacíos */
  hasActiveFilters: boolean
}

export type UsePlanViewFiltersReturn =
  PlanViewFiltersState &
  PlanViewFiltersActions &
  PlanViewDerivedData

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePlanViewFilters(
  plans: GrazingPlanRow[],
  seasonPlans: SeasonPlanRow[],
  herds: HerdRow[],
): UsePlanViewFiltersReturn {

  // ── Estado de filtros ──────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [dateRangeFrom, setDateRangeFrom] = useState<string | null>(null)
  const [dateRangeTo, setDateRangeTo] = useState<string | null>(null)
  const [selectedSeasonPlanIds, setSelectedSeasonPlanIds] = useState<string[]>([])
  const [activeSeasonPlanId, setActiveSeasonPlanId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('gantt')
  const [activeGanttTab, setActiveGanttTab] = useState<GanttTab>('manual')
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all')

  // ── Acciones ───────────────────────────────────────────────────────────────

  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      setDateRangeFrom(from)
      setDateRangeTo(to)
    },
    []
  )

  const toggleSeasonPlan = useCallback((id: string) => {
    setSelectedSeasonPlanIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((s) => s !== id)
        // Si se deseleccionó el plan activo del Gantt, limpiar el viewport
        return next
      }
      return [...prev, id]
    })
    // Si no había un plan activo aún, activar el primero seleccionado
    setActiveSeasonPlanId((prev) => prev ?? id)
  }, [])

  const selectSeasonPlanOnly = useCallback((id: string) => {
    setSelectedSeasonPlanIds([id])
    setActiveSeasonPlanId(id)
  }, [])

  const clearFilters = useCallback(() => {
    setSearch('')
    setFilterStatus('all')
    setDateRangeFrom(null)
    setDateRangeTo(null)
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedSeasonPlanIds([])
    setActiveSeasonPlanId(null)
  }, [])

  // ── Mapas de Color (SSOT) ──────────────────────────────────────────────────

  /**
   * SeasonPlanId → color, asignado en orden de selección.
   * El mismo mapa que usa el header del Gantt, los chips y el acordeón.
   * Los planes NO seleccionados en el Gantt reciben un color neutro.
   */
  const seasonPlanColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}

    // Planes seleccionados → color de la paleta por índice de selección
    selectedSeasonPlanIds.forEach((id, i) => {
      map[id] = SEASON_PLAN_PALETTE[i % SEASON_PLAN_PALETTE.length]
    })

    // Planes NO seleccionados → color neutro gris
    seasonPlans.forEach((sp) => {
      if (!map[sp.id]) {
        map[sp.id] = '#9ca3af' // gray-400
      }
    })

    return map
  }, [selectedSeasonPlanIds, seasonPlans])

  /**
   * HerdId → color estable por índice en el array de rodeos.
   */
  const herdColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    herds.forEach((h, i) => {
      map[h.id] = HERD_COLORS[i % HERD_COLORS.length]
    })
    return map
  }, [herds])

  // ── Filtrado Derivado ──────────────────────────────────────────────────────

  const filteredPlans = useMemo<GrazingPlanRow[]>(() => {
    return plans.filter((plan) => {
      // ── Búsqueda por texto ──
      if (search) {
        const q = search.toLowerCase()
        const matchPaddock = (plan.paddocks?.name ?? '').toLowerCase().includes(q)
        const matchHerd = (plan.herds?.name ?? '').toLowerCase().includes(q)
        if (!matchPaddock && !matchHerd) return false
      }

      // ── Filtro de estado ──
      if (filterStatus !== 'all' && plan.status !== filterStatus) return false

      // ── Filtro de rango de fechas ──
      if (dateRangeFrom && plan.entry_date < dateRangeFrom) return false
      if (dateRangeTo && plan.entry_date > dateRangeTo) return false

      // ── Filtro por tab activo (solo en Gantt) ──
      if (viewMode === 'gantt') {
        const suggested = isPlanSuggested(plan)
        if (activeGanttTab === 'suggested' && !suggested) return false
        if (activeGanttTab === 'manual' && suggested) return false

        // ── BUG 2 FIX: Filtrar por SeasonPlans seleccionados ──
        // Solo aplicar el filtro cuando hay ≥1 plan seleccionado.
        // Si selectedSeasonPlanIds está vacío, mostramos todos (estado inicial).
        if (selectedSeasonPlanIds.length > 0) {
          const planSeasonId = getPlanSeasonId(plan)
          if (!planSeasonId || !selectedSeasonPlanIds.includes(planSeasonId)) return false
        }
      }

      // ── Filtro por historyTab ──
      if (viewMode === 'history') {
        if (historyTab === 'manual' && isPlanSuggested(plan)) return false
        if (historyTab === 'suggested' && !isPlanSuggested(plan)) return false
      }

      return true
    })
  }, [plans, search, filterStatus, dateRangeFrom, dateRangeTo, viewMode, activeGanttTab, historyTab, selectedSeasonPlanIds])

  // ── Agrupación para Acordeón ───────────────────────────────────────────────

  const accordionGroups = useMemo<AccordionGroup[]>(
    () => groupPlansBySeasonPlan(filteredPlans, seasonPlans),
    [filteredPlans, seasonPlans]
  )

  // ── Detección de Filtros Activos ───────────────────────────────────────────

  const hasActiveFilters = Boolean(
    search || filterStatus !== 'all' || dateRangeFrom || dateRangeTo
  )

  // ── Resultado ─────────────────────────────────────────────────────────────

  return {
    // State
    search,
    filterStatus,
    dateRangeFrom,
    dateRangeTo,
    selectedSeasonPlanIds,
    activeSeasonPlanId,
    viewMode,
    activeGanttTab,
    historyTab,

    // Actions
    setSearch,
    setFilterStatus,
    setDateRange,
    toggleSeasonPlan,
    selectSeasonPlanOnly,
    setActiveSeasonPlanId,
    resetSelection,
    setViewMode,
    setActiveGanttTab,
    setHistoryTab,
    clearFilters,

    // Derived
    filteredPlans,
    accordionGroups,
    seasonPlanColorMap,
    herdColorMap,
    hasActiveFilters,
  }
}
