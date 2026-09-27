/**
 * useMergedGanttData.ts — Fusión de múltiples planes para el Gantt
 * ─────────────────────────────────────────────────────────────────
 * Responsabilidades:
 *  1. Acotar el timeline (eje X) a las fechas reales de los planes seleccionados
 *  2. Filtrar solo los potreros afectados por esos planes (eje Y)
 *  3. Detectar solapamientos y asignar "tracks" verticales sin colisiones visuales
 *  4. Extraer metadata de rodeos (GDP, etc.) de los demand_snapshots
 *
 * Algoritmo de tracks:
 *  - Greedy interval scheduling: para cada potrero, recorre los bloques
 *    ordenados por fecha de entrada y los asigna al primer track disponible.
 *  - Complejidad: O(n·k) donde n = bloques por potrero, k = tracks máximos.
 *  - En la práctica k ≤ 2 para planes ganaderos típicos.
 */
import { useMemo } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SeasonPlanMeta {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  herd_ids?: string[] | null
  demand_snapshot?: {
    herds?: Array<{ id: string; gdp_kg_day?: number | null; ev?: number; heads?: number }>
  } | null
}

export interface GrazingBlock {
  id: string
  paddock_id: string
  entry_date: string
  exit_date: string
  season_plan_id?: string | null
  herd_id?: string | null
  herd_ids?: string[]
  status?: string
  [key: string]: unknown
}

/** Bloque enriquecido con metadatos del plan padre */
export interface MergedBlock extends GrazingBlock {
  /** Nombre del plan al que pertenece este bloque */
  _planName: string
  /** Color hex del plan (para distinción visual) */
  _planColor: string
  /** Índice del plan en selectedPlanIds (para z-index / estilos) */
  _planIndex: number
}

/** Fila de potrero con bloques organizados en tracks sin solapamiento visual */
export interface MergedPaddockRow {
  paddockId: string
  paddockName: string
  /**
   * tracks[0] = bloques sin solapamiento entre sí
   * tracks[1+] = bloques solapados con tracks anteriores, en filas extra
   */
  tracks: MergedBlock[][]
}

export interface HerdWithMeta {
  id: string
  name: string
  /** Aumento de peso diario en kg/día, null si no está en el snapshot */
  gdp_kg_day: number | null
  /** Equivalentes vacas */
  total_ev?: number
  /** Cantidad de cabezas */
  head_count?: number
  [key: string]: unknown
}

export interface MergedGanttData {
  /**
   * Timeline acotado a las fechas reales de los planes seleccionados.
   * null si no hay planes seleccionados.
   */
  timeline: { start: string; end: string } | null
  /** Potreros afectados, con bloques en tracks */
  paddockRows: MergedPaddockRow[]
  /** Rodeos asociados con metadata de GDP */
  herdMeta: HerdWithMeta[]
  /** Bloques planos (todos, sin track assignment) para compatibilidad */
  allBlocks: MergedBlock[]
}

// ── Función auxiliar: algoritmo greedy de tracks ──────────────────────────────

function assignToTracks(blocks: MergedBlock[]): MergedBlock[][] {
  const sorted = [...blocks].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const tracks: MergedBlock[][] = []

  for (const block of sorted) {
    let placed = false
    for (const track of tracks) {
      const last = track[track.length - 1]
      // No hay solapamiento si la nueva entrada es >= la salida del último en el track
      if (block.entry_date >= last.exit_date) {
        track.push(block)
        placed = true
        break
      }
    }
    if (!placed) {
      tracks.push([block])
    }
  }

  return tracks
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useMergedGanttData(
  allSeasonPlans: SeasonPlanMeta[],
  allBlocks: GrazingBlock[],
  selectedPlanIds: string[],
  allPaddocks: Array<{ id: string; name: string }>,
  allHerds: Array<{ id: string; name: string; [k: string]: unknown }>,
  planColorMap: Record<string, string>,
): MergedGanttData {
  return useMemo(() => {
    const EMPTY: MergedGanttData = { timeline: null, paddockRows: [], herdMeta: [], allBlocks: [] }

    if (selectedPlanIds.length === 0) return EMPTY

    // ── 1. Planes activos ──────────────────────────────────────────────────
    const activePlans = allSeasonPlans.filter(sp => selectedPlanIds.includes(sp.id))
    if (activePlans.length === 0) return EMPTY

    // ── 2. Timeline acotada ────────────────────────────────────────────────
    const starts = activePlans
      .map(sp => sp.start_date)
      .filter((d): d is string => Boolean(d))
      .sort()
    const ends = activePlans
      .map(sp => sp.end_date)
      .filter((d): d is string => Boolean(d))
      .sort()

    const timeline =
      starts.length > 0 && ends.length > 0
        ? { start: starts[0], end: ends[ends.length - 1] }
        : null

    // ── 3. Bloques enriquecidos ────────────────────────────────────────────
    const mergedBlocks: MergedBlock[] = allBlocks
      .filter(b => b.season_plan_id && selectedPlanIds.includes(b.season_plan_id))
      .map(b => {
        const plan = activePlans.find(sp => sp.id === b.season_plan_id)
        const planIndex = selectedPlanIds.indexOf(b.season_plan_id!)
        return {
          ...b,
          _planName:  plan?.name ?? 'Plan',
          _planColor: planColorMap[b.season_plan_id!] ?? '#22c55e',
          _planIndex: planIndex,
        }
      })

    // ── 4. Potreros afectados con tracks ───────────────────────────────────
    const affectedIds = [...new Set(mergedBlocks.map(b => b.paddock_id))]

    const paddockRows: MergedPaddockRow[] = affectedIds.map(paddockId => {
      const paddock = allPaddocks.find(p => p.id === paddockId)
      const blocks  = mergedBlocks.filter(b => b.paddock_id === paddockId)
      return {
        paddockId,
        paddockName: paddock?.name ?? paddockId,
        tracks: assignToTracks(blocks),
      }
    })

    // ── 5. Metadata de rodeos con GDP ──────────────────────────────────────
    const activeHerdIds = new Set(
      activePlans.flatMap(sp => sp.herd_ids ?? [])
    )

    const herdMeta: HerdWithMeta[] = allHerds
      .filter(h => activeHerdIds.has(h.id))
      .map(h => {
        // Buscar GDP en los demand_snapshots de los planes que incluyen este rodeo
        let gdp: number | null = null
        for (const sp of activePlans) {
          if (!sp.herd_ids?.includes(h.id)) continue
          const snap = sp.demand_snapshot?.herds?.find(hs => hs.id === h.id)
          if (snap?.gdp_kg_day != null) {
            gdp = snap.gdp_kg_day
            break
          }
        }
        return { ...h, gdp_kg_day: gdp } as HerdWithMeta
      })

    return { timeline, paddockRows, herdMeta, allBlocks: mergedBlocks }
  }, [allSeasonPlans, allBlocks, selectedPlanIds, allPaddocks, allHerds, planColorMap])
}
