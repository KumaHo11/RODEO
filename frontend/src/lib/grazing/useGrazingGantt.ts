/**
 * lib/grazing/useGrazingGantt.ts — Hook de transformación para el Gantt Multi-Rodeo
 * ──────────────────────────────────────────────────────────────────────────────────
 * Transforma el array plano de grazing_plans[] + season_plans[] + herds[]
 * en filas y bloques listos para renderizar en el InteractiveGantt.
 *
 * Responsabilidades:
 *  1. Agrupar planes por paddock_id → filas Y del Gantt
 *  2. Resolver season_plan_id → color + label del plan
 *  3. Resolver herd_ids → etiquetas de rodeo + color
 *  4. Aplicar filtros por temporada/rodeo/plan
 *  5. Ordenar filas por cell_paddock_ids cuando aplica
 *  6. Generar datos para la leyenda y filtros de capas
 */

import { useMemo } from 'react'
import { HERD_COLORS } from './constants'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface GanttBlock {
  /** ID único del bloque (grazing_plan.id) */
  id: string
  /** ID del plan lógico padre */
  seasonPlanId: string | null
  /** IDs de rodeos asignados al bloque */
  herdIds: string[]
  /** Color del plan (por rodeo principal o por season_plan) */
  planColor: string
  /** Etiqueta legible: "Vacas + Recría" o "Toros" */
  herdLabel: string
  /** Nombre del plan padre: "Plan Vacas Abierta 2026" */
  planName: string
  /** Fechas ISO */
  entryDate: string
  exitDate: string
  /** Número de vuelta/pasada */
  passNumber: number
  /** Días de pastoreo */
  grazingDays: number
  /** Días de descanso previstos */
  recoveryDays: number
  /** Estado del bloque */
  status: string
  /** Plan type: 'manual' | 'suggested' */
  planType: string
  /** Raw plan data for click handlers */
  raw: any
}

export interface GanttRow {
  paddockId: string
  paddockName: string
  areaHa: number
  blocks: GanttBlock[]
}

export interface PlanLegendEntry {
  seasonPlanId: string
  name: string
  color: string
  herdLabel: string
  herdIds: string[]
  paddockCount: number
  blockCount: number
  isVisible: boolean
}

export interface GanttFilters {
  /** IDs de season_plans visibles (vacío = todos) */
  visibleSeasonPlanIds: string[]
  /** IDs de rodeos visibles (vacío = todos) */
  visibleHerdIds: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function resolveHerdLabel(herdIds: string[], herdsMap: Map<string, any>): string {
  if (herdIds.length === 0) return 'Sin rodeo'
  const names = herdIds
    .map(id => herdsMap.get(id)?.name ?? herdsMap.get(id)?.categoria)
    .filter(Boolean)
  if (names.length === 0) return 'Rodeo'
  if (names.length <= 2) return names.join(' + ')
  return `${names[0]} + ${names.length - 1} más`
}

function resolveSeasonPlanId(plan: any): string | null {
  return plan.season_plan_id || plan.ai_analysis?.season_plan_id || null
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useGrazingGantt(params: {
  plans: any[]
  seasonPlans: any[]
  paddocks: any[]
  herds: any[]
  filters: GanttFilters
}): {
  rows: GanttRow[]
  legend: PlanLegendEntry[]
  /** Mapa season_plan_id → color para InteractiveGantt */
  planColorMap: Record<string, string>
  /** Mapa season_plan_id → nombre para tooltips */
  planNameMap: Record<string, string>
  /** Mapa herd_id → color */
  herdColorMap: Record<string, string>
} {
  const { plans, seasonPlans, paddocks, herds, filters } = params

  // Mapa de herds para lookup rápido
  const herdsMap = useMemo(
    () => new Map(herds.map((h: any) => [h.id, h])),
    [herds],
  )

  // Mapa de paddocks para lookup rápido
  const paddocksMap = useMemo(
    () => new Map(paddocks.map((p: any) => [p.id, p])),
    [paddocks],
  )

  // Mapa herd_id → color estable
  const herdColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    herds.forEach((h: any, i: number) => {
      map[h.id] = HERD_COLORS[i % HERD_COLORS.length]
    })
    return map
  }, [herds])

  // Mapa season_plan_id → color (basado en herd principal)
  const planColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    seasonPlans.forEach((sp: any) => {
      const spHerdIds: string[] = sp.herd_ids ?? []
      const primaryHerdId = spHerdIds[0]
      if (primaryHerdId && herdColorMap[primaryHerdId]) {
        map[sp.id] = herdColorMap[primaryHerdId]
      } else {
        // Fallback: asignar color por índice
        const idx = Object.keys(map).length
        map[sp.id] = HERD_COLORS[idx % HERD_COLORS.length]
      }
    })
    return map
  }, [seasonPlans, herdColorMap])

  // Mapa season_plan_id → nombre
  const planNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    seasonPlans.forEach((sp: any) => {
      map[sp.id] = sp.name || `Plan ${sp.season_type || ''} ${sp.year || ''}`
    })
    return map
  }, [seasonPlans])

  // Transformar plans → GanttBlock[]
  const allBlocks = useMemo(() => {
    return plans.map((plan: any): GanttBlock => {
      const spId = resolveSeasonPlanId(plan)
      const herdIds: string[] = Array.isArray(plan.herd_ids)
        ? plan.herd_ids
        : plan.herd_id
          ? [plan.herd_id]
          : []
      const herdLabel = resolveHerdLabel(herdIds, herdsMap)
      const exitDate = plan.exit_date || plan.entry_date
      const grazingDays = daysBetween(plan.entry_date, exitDate)

      // Color: si tiene season_plan_id → color del plan; sino → color del herd principal
      let planColor = '#94a3b8' // fallback gris
      if (spId && planColorMap[spId]) {
        planColor = planColorMap[spId]
      } else if (herdIds[0] && herdColorMap[herdIds[0]]) {
        planColor = herdColorMap[herdIds[0]]
      }

      return {
        id: plan.id,
        seasonPlanId: spId,
        herdIds,
        planColor,
        herdLabel,
        planName: spId ? (planNameMap[spId] || '') : '',
        entryDate: plan.entry_date,
        exitDate,
        passNumber: plan.pass_number || 1,
        grazingDays,
        recoveryDays: plan.planned_recovery_days || 0,
        status: plan.status || 'PLANNED',
        planType: plan.plan_type || 'manual',
        raw: plan,
      }
    })
  }, [plans, herdsMap, planColorMap, herdColorMap, planNameMap])

  // Aplicar filtros
  const filteredBlocks = useMemo(() => {
    let blocks = allBlocks

    if (filters.visibleSeasonPlanIds.length > 0) {
      blocks = blocks.filter(
        b => b.seasonPlanId && filters.visibleSeasonPlanIds.includes(b.seasonPlanId),
      )
    }

    if (filters.visibleHerdIds.length > 0) {
      blocks = blocks.filter(b =>
        b.herdIds.some(id => filters.visibleHerdIds.includes(id)),
      )
    }

    return blocks
  }, [allBlocks, filters])

  // Agrupar por paddock → filas
  const rows = useMemo(() => {
    // Determinar el orden de potreros basado en los season_plans activos
    let orderedPaddockIds: string[] = []

    // Si hay filtro de season_plan, usar su cell_paddock_ids para ordenar
    if (filters.visibleSeasonPlanIds.length > 0) {
      for (const spId of filters.visibleSeasonPlanIds) {
        const sp = seasonPlans.find((s: any) => s.id === spId)
        const cellIds: string[] = sp?.cell_paddock_ids ?? sp?.metrics?.suggested_sequence ?? []
        for (const id of cellIds) {
          if (!orderedPaddockIds.includes(id)) orderedPaddockIds.push(id)
        }
      }
    }

    // Si no hay orden de plans, usar todos los potreros que tienen bloques
    const blocksByPaddock = new Map<string, GanttBlock[]>()
    for (const block of filteredBlocks) {
      const key = block.raw.paddock_id
      if (!blocksByPaddock.has(key)) blocksByPaddock.set(key, [])
      blocksByPaddock.get(key)!.push(block)
    }

    // Incluir todos los potreros (incluso sin bloques) para mostrar filas vacías
    const allPaddockIds = paddocks.map((p: any) => p.id as string)

    // Combinar: primero los de cell_paddock_ids, luego los que tienen bloques, luego el resto
    const paddockIdsWithBlocks = Array.from(blocksByPaddock.keys())
    const finalOrder = [
      ...orderedPaddockIds,
      ...paddockIdsWithBlocks.filter(id => !orderedPaddockIds.includes(id)),
      ...allPaddockIds.filter(
        id => !orderedPaddockIds.includes(id) && !paddockIdsWithBlocks.includes(id),
      ),
    ]

    // Deduplicar
    const seen = new Set<string>()
    const uniqueOrder = finalOrder.filter(id => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    return uniqueOrder.map((paddockId): GanttRow => {
      const p = paddocksMap.get(paddockId)
      return {
        paddockId,
        paddockName: p?.name || paddockId,
        areaHa: Number(p?.area_ha) || 0,
        blocks: (blocksByPaddock.get(paddockId) || []).sort(
          (a, b) => a.entryDate.localeCompare(b.entryDate),
        ),
      }
    })
  }, [filteredBlocks, paddocks, paddocksMap, seasonPlans, filters.visibleSeasonPlanIds])

  // Generar leyenda
  const legend = useMemo((): PlanLegendEntry[] => {
    const entries: PlanLegendEntry[] = []

    for (const sp of seasonPlans) {
      const spHerdIds: string[] = sp.herd_ids ?? []
      const spBlocks = allBlocks.filter(b => b.seasonPlanId === sp.id)
      const uniquePaddocks = new Set(spBlocks.map(b => b.raw.paddock_id))

      entries.push({
        seasonPlanId: sp.id,
        name: sp.name || `Plan ${sp.year || ''}`,
        color: planColorMap[sp.id] || '#94a3b8',
        herdLabel: resolveHerdLabel(spHerdIds, herdsMap),
        herdIds: spHerdIds,
        paddockCount: uniquePaddocks.size,
        blockCount: spBlocks.length,
        isVisible:
          filters.visibleSeasonPlanIds.length === 0 ||
          filters.visibleSeasonPlanIds.includes(sp.id),
      })
    }

    // Agregar bloques huérfanos (sin season_plan_id)
    const orphanBlocks = allBlocks.filter(b => !b.seasonPlanId)
    if (orphanBlocks.length > 0) {
      const orphanPaddocks = new Set(orphanBlocks.map(b => b.raw.paddock_id))
      entries.push({
        seasonPlanId: '__orphan__',
        name: 'Bloques manuales',
        color: '#64748b',
        herdLabel: 'Varios',
        herdIds: [],
        paddockCount: orphanPaddocks.size,
        blockCount: orphanBlocks.length,
        isVisible: true,
      })
    }

    return entries
  }, [seasonPlans, allBlocks, planColorMap, herdsMap, filters.visibleSeasonPlanIds])

  return {
    rows,
    legend,
    planColorMap,
    planNameMap,
    herdColorMap,
  }
}
