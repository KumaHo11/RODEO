/**
 * sandboxStore.ts — Store Zustand de la Mesa de Arena
 * ────────────────────────────────────────────────────
 * Estado: herds (rodeos) + paddocks (potreros) + config + result
 * Acciones: init, toggleHerdEnabled, togglePaddockEnabled,
 *           updatePaddockRow, reorderPaddocks, setConfig, confirmPlan
 *
 * v30: confirmPlan ahora crea un season_plan con herd_ids + cell_paddock_ids
 *      antes de generar los bloques individuales, vinculándolos via season_plan_id.
 */

import { create } from 'zustand'
import { simulate } from './simulationEngine'
import {
  detectPaddockCollisions,
  formatCollisionWarning,
  type CollisionEntry,
  type ExistingBlock,
} from './collisionDetector'
import type {
  SeasonMode,
  PaddockSimRow,
  HerdSimRow,
  SimulationConfig,
  SimulationResult,
} from './types'

// ── Tipos del store ───────────────────────────────────────────────────────────

export interface GeneratedBlock {
  paddock_id: string
  herd_id: string | null
  herd_ids: string[]
  entry_date: string
  exit_date: string
  planned_recovery_days: number
  status: string
  plan_type: string
  source_origin: string
  season_plan_id?: string
  pass_number?: number
}

interface PaddockRawInit {
  id: string
  name: string
  area_ha: number | string
  dry_matter_kg_ha?: number | string | null
  lat?: number | null
  lng?: number | null
  polygon?: [number, number][] | null
  polygon_coordinates?: [number, number][] | null
  /** May be a flat [lat,lng][] array (legacy) OR a GeoJSON Polygon/Feature object */
  boundary?: [number, number][] | { type: string; coordinates?: any; geometry?: any; features?: any } | null
  /** GeoJSON geometry, Feature, or FeatureCollection */
  geojson?: { type?: string; coordinates?: any; geometry?: any; features?: any } | null
  technical_data?: Record<string, any> | null
}

interface HerdRawInit {
  id: string
  name?: string
  total_ev?: number | string | null
  head_count?: number | string | null
  avg_weight_kg?: number | string | null
}

export interface SandboxState {
  mode: SeasonMode
  herds: HerdSimRow[]
  paddockRows: PaddockSimRow[]
  config: SimulationConfig
  result: SimulationResult | null
  hoveredPaddockId: string | null
  selectedPaddockId: string | null
  isDirty: boolean
  isSaving: boolean
  generatedBlocks: GeneratedBlock[]
  /** ID del season_plan recién creado */
  lastSeasonPlanId: string | null
  /**
   * Tracks which original paddock IDs have been subdivided.
   * Key = original paddock ID, Value = array of synthetic sub-row IDs.
   * Allows the UI to show a "Restore" button.
   */
  subdivisionSources: Record<string, string[]>

  init: (params: {
    paddocks: PaddockRawInit[]
    herds: HerdRawInit[]
    mode: SeasonMode
  }) => void

  setMode: (mode: SeasonMode) => void
  setConfig: (updates: Partial<SimulationConfig>) => void
  toggleHerdEnabled: (id: string) => void
  togglePaddockEnabled: (id: string) => void
  updatePaddockRow: (id: string, updates: Partial<PaddockSimRow>) => void
  reorderPaddocks: (fromIdx: number, toIdx: number) => void
  setHoveredPaddock: (id: string | null) => void
  setSelectedPaddock: (id: string | null) => void
  recalculate: () => void
  /**
   * Split a paddock into `parts` equally-sized sub-rows (draft state only).
   * The original row is replaced by N rows each with areaHa / parts.
   * Nothing is sent to the DB until the user clicks "Generar Plan".
   */
  subdivideRow: (paddockId: string, parts?: number) => void
  /** Restore a subdivided paddock back to its original single row. */
  restoreSubdividedRow: (originalId: string) => void
  confirmPlan: (params: {
    apiFn: (url: string, opts: RequestInit) => Promise<Response>
    herdIds: string[]
    planName?: string
    /** Planes existentes para detección de colisiones */
    existingPlans?: ExistingBlock[]
    onCollisionWarning?: (message: string) => Promise<boolean>
    onSuccess?: (blocks: GeneratedBlock[], seasonPlanId: string) => void
    onError?: (err: string) => void
  }) => Promise<void>
  reset: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the outer ring from any GeoJSON shape and converts
 * GeoJSON [lng, lat] coordinate order → Leaflet [lat, lng].
 */
function extractGeoJsonRing(geojson: any): [number, number][] | null {
  if (!geojson) return null
  let coords: number[][] | null = null

  if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates?.[0])) {
    coords = geojson.coordinates[0]
  } else if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates?.[0]?.[0])) {
    coords = geojson.coordinates[0][0]
  } else if (geojson.type === 'Feature') {
    return extractGeoJsonRing(geojson.geometry)
  } else if (geojson.type === 'FeatureCollection') {
    return extractGeoJsonRing(geojson.features?.[0])
  }

  if (!coords || coords.length < 3) return null
  // GeoJSON is [lng, lat] — Leaflet needs [lat, lng]
  return coords.map(([lng, lat]: number[]) => [lat, lng] as [number, number])
}

function extractPolygon(p: PaddockRawInit): [number, number][] | null {
  // 1. Plain [lat,lng][] arrays (legacy / offline cache format)
  if (Array.isArray(p.polygon) && p.polygon.length >= 3) return p.polygon
  if (Array.isArray(p.polygon_coordinates) && p.polygon_coordinates.length >= 3) return p.polygon_coordinates

  // 2. p.boundary: may be a plain [lat,lng][] OR a GeoJSON Polygon/Feature object
  if (p.boundary) {
    const b = p.boundary as any
    if (Array.isArray(b) && b.length >= 3 && Array.isArray(b[0])) {
      // Legacy: already [lat, lng][] pairs
      return b as [number, number][]
    }
    // GeoJSON shape: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
    const ring = extractGeoJsonRing(b)
    if (ring) return ring
  }

  // 3. p.geojson — GeoJSON geometry or Feature
  if (p.geojson) {
    const ring = extractGeoJsonRing(p.geojson as any)
    if (ring) return ring
  }

  return null
}

function centroid(ring: [number, number][]): { lat: number; lng: number } {
  return {
    lat: ring.reduce((s, c) => s + c[0], 0) / ring.length,
    lng: ring.reduce((s, c) => s + c[1], 0) / ring.length,
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function buildDefaultConfig(mode: SeasonMode): SimulationConfig {
  const today = new Date().toISOString().split('T')[0]
  const year = new Date().getFullYear()
  return {
    mode,
    fechaInicio: today,
    fechaCorte: `${year}-12-15`,
    fechaFin: addDays(today, 365),
    descansosPrimavera: 50,
    descansosVerano: 100,
    dailyAllocationKgEv: 20,
    targetRemnantKgHa: 600,
    totalEV: 0,
    demandaDiariaKgMs: 0,
  }
}

function computeEV(herds: HerdSimRow[], dailyKgEv: number): { totalEV: number; demandaDiariaKgMs: number } {
  const totalEV = herds.filter(h => h.enabled).reduce((s, h) => s + h.totalEV, 0)
  return { totalEV, demandaDiariaKgMs: totalEV * dailyKgEv }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSandboxStore = create<SandboxState>((set, get) => ({
  mode: 'open',
  herds: [],
  paddockRows: [],
  config: buildDefaultConfig('open'),
  result: null,
  hoveredPaddockId: null,
  selectedPaddockId: null,
  isDirty: false,
  isSaving: false,
  generatedBlocks: [],
  lastSeasonPlanId: null,
  subdivisionSources: {},

  // ── init ──────────────────────────────────────────────────────────────────
  init: ({ paddocks, herds, mode }) => {
    const config = buildDefaultConfig(mode)

    const herdRows: HerdSimRow[] = herds.map(h => {
      const headCount = Number(h.head_count) || 0
      const weight = Number(h.avg_weight_kg) || 450
      const fallbackEV = Math.pow(weight / 450, 0.75) * headCount
      return {
        id: h.id,
        name: h.name ?? h.id,
        headCount,
        totalEV: Number(h.total_ev) || fallbackEV,
        enabled: false,
      }
    })

    const { totalEV, demandaDiariaKgMs } = computeEV(herdRows, config.dailyAllocationKgEv)
    const fullConfig: SimulationConfig = { ...config, totalEV, demandaDiariaKgMs }

    const paddockRows: PaddockSimRow[] = paddocks.map((p, idx) => {
      const polygon = extractPolygon(p)
      let lat = p.lat ?? null
      let lng = p.lng ?? null
      if ((!lat || !lng) && polygon?.length) {
        const c = centroid(polygon)
        lat = c.lat
        lng = c.lng
      }
      return {
        id: p.id,
        name: p.name,
        areaHa: Number(p.area_ha) || 0,
        enabled: false,
        aforoKgMsHa: Number(p.dry_matter_kg_ha) || 0,
        rank: 5,
        order: idx,
        tasaCrecimientoKgHaDia: Number(p.technical_data?.tc_override) || 25,
        factorAprovechamiento: Number(p.technical_data?.factor_aprovechamiento) || 0.5,
        suplementoKgMs: 0,
        remanenteObjetivoKgMsHa: fullConfig.targetRemnantKgHa,
        polygon,
        lat,
        lng,
      }
    })

    set({ mode, herds: herdRows, config: fullConfig, paddockRows, isDirty: false, generatedBlocks: [], lastSeasonPlanId: null })
    set({ result: simulate({ config: fullConfig, paddocks: paddockRows }) })
  },

  // ── setMode ───────────────────────────────────────────────────────────────
  setMode: (mode) => {
    set(s => ({ mode, config: { ...s.config, mode } }))
    get().recalculate()
  },

  // ── setConfig ─────────────────────────────────────────────────────────────
  setConfig: (updates) => {
    set(s => {
      const c = { ...s.config, ...updates }
      // Recalcular EV cuando cambia la ración O cuando cambia el modo
      // (al cambiar a 'closed' el motor necesita demandaDiariaKgMs actual)
      if ('dailyAllocationKgEv' in updates || 'mode' in updates) {
        const { totalEV, demandaDiariaKgMs } = computeEV(s.herds, c.dailyAllocationKgEv)
        c.totalEV = totalEV
        c.demandaDiariaKgMs = demandaDiariaKgMs
      }
      const newMode = c.mode ?? s.mode
      return { config: c, mode: newMode, isDirty: true }
    })
    get().recalculate()
  },

  // ── toggleHerdEnabled ─────────────────────────────────────────────────────
  toggleHerdEnabled: (id) => {
    set(s => {
      const herds = s.herds.map(h => h.id === id ? { ...h, enabled: !h.enabled } : h)
      const { totalEV, demandaDiariaKgMs } = computeEV(herds, s.config.dailyAllocationKgEv)
      return {
        herds,
        config: { ...s.config, totalEV, demandaDiariaKgMs },
        isDirty: true,
      }
    })
    get().recalculate()
  },

  // ── togglePaddockEnabled ──────────────────────────────────────────────────
  togglePaddockEnabled: (id) => {
    set(s => ({
      paddockRows: s.paddockRows.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p),
      isDirty: true,
    }))
    get().recalculate()
  },

  // ── updatePaddockRow ──────────────────────────────────────────────────────
  updatePaddockRow: (id, updates) => {
    set(s => ({
      paddockRows: s.paddockRows.map(p => p.id === id ? { ...p, ...updates } : p),
      isDirty: true,
    }))
    get().recalculate()
  },

  // ── reorderPaddocks ───────────────────────────────────────────────────────
  reorderPaddocks: (fromIdx, toIdx) => {
    set(s => {
      const rows = [...s.paddockRows]
      const [moved] = rows.splice(fromIdx, 1)
      rows.splice(toIdx, 0, moved)
      return { paddockRows: rows.map((r, i) => ({ ...r, order: i })), isDirty: true }
    })
    get().recalculate()
  },

  // ── hover / selection ─────────────────────────────────────────────────────
  setHoveredPaddock: (id) => set({ hoveredPaddockId: id }),
  setSelectedPaddock: (id) => set({ selectedPaddockId: id }),

  // ── recalculate ───────────────────────────────────────────────────────────
  recalculate: () => {
    const { config, paddockRows } = get()
    set({ result: simulate({ config, paddocks: paddockRows }) })
  },

  // ── subdivideRow ──────────────────────────────────────────────────────────
  subdivideRow: (paddockId, parts = 3) => {
    set(s => {
      const srcIdx = s.paddockRows.findIndex(p => p.id === paddockId)
      if (srcIdx === -1) return s

      const src = s.paddockRows[srcIdx]
      const subArea = src.areaHa / parts

      // Build N synthetic sub-rows
      const subIds: string[] = []
      const subRows: PaddockSimRow[] = Array.from({ length: parts }, (_, i) => {
        const subId = `${src.id}__sub${i + 1}`
        subIds.push(subId)
        return {
          ...src,
          id:     subId,
          name:   `${src.name} — Parcela ${i + 1}`,
          areaHa: subArea,
          order:  src.order + i * 0.001, // keep relative order
          enabled: true,
        }
      })

      // Replace the original row with the sub-rows
      const newRows = [
        ...s.paddockRows.slice(0, srcIdx),
        ...subRows,
        ...s.paddockRows.slice(srcIdx + 1),
      ].map((r, i) => ({ ...r, order: i }))

      return {
        paddockRows: newRows,
        isDirty: true,
        subdivisionSources: { ...s.subdivisionSources, [src.id]: subIds },
      }
    })
    get().recalculate()
  },

  // ── restoreSubdividedRow ──────────────────────────────────────────────────
  restoreSubdividedRow: (originalId) => {
    set(s => {
      const subIds = s.subdivisionSources[originalId]
      if (!subIds || subIds.length === 0) return s

      // Remove the sub-rows
      const withoutSubs = s.paddockRows.filter(p => !subIds.includes(p.id))

      // Restore the original row (re-fetch from the first sub-row for geometry/props)
      const firstSub = s.paddockRows.find(p => p.id === subIds[0])
      if (!firstSub) return s

      // Reconstruct original area = subArea * parts
      const parts = subIds.length
      const originalArea = firstSub.areaHa * parts
      const originalName = firstSub.name.replace(/ — Parcela \d+$/, '')

      const restored: PaddockSimRow = {
        ...firstSub,
        id:     originalId,
        name:   originalName,
        areaHa: originalArea,
      }

      const newRows = [...withoutSubs, restored]
        .sort((a, b) => a.order - b.order)
        .map((r, i) => ({ ...r, order: i }))

      const newSources = { ...s.subdivisionSources }
      delete newSources[originalId]

      return {
        paddockRows: newRows,
        isDirty: true,
        subdivisionSources: newSources,
      }
    })
    get().recalculate()
  },

  // ── confirmPlan ───────────────────────────────────────────────────────────
  confirmPlan: async ({ apiFn, herdIds, planName, existingPlans, onCollisionWarning, onSuccess, onError }) => {
    const { result, config, paddockRows, herds, mode } = get()

    const enabledPaddocks = paddockRows.filter(p => p.enabled).sort((a, b) => a.order - b.order)
    const enabledHerds = herds.filter(h => h.enabled)

    if (enabledPaddocks.length === 0) {
      onError?.('Seleccioná al menos 1 potrero para generar el plan.')
      return
    }
    if (enabledHerds.length === 0) {
      onError?.('Seleccioná al menos 1 rodeo para generar el plan.')
      return
    }

    // Generar bloques según el modo
    let blocks: GeneratedBlock[] = []

    if (mode === 'open') {
      const events = result?.chronogram ?? []
      if (events.length === 0) {
        onError?.('Sin eventos calculados. Verificá las fechas y parámetros.')
        return
      }
      blocks = events.map((ev, idx) => ({
        paddock_id: ev.paddockId,
        herd_id: herdIds[0] ?? null,
        herd_ids: herdIds,
        entry_date: ev.fechaEntrada,
        exit_date: ev.fechaSalida,
        planned_recovery_days: ev.descansoAlRegresar,
        status: 'PLANNED',
        plan_type: 'suggested',
        source_origin: 'algorithm',
        pass_number: ev.vuelta,
      }))
    } else {
      // Temporada Cerrada: una sola pasada secuencial
      const validRows = result?.rows.filter(r => r.enabled && r.dpSugerido > 0) ?? []
      if (validRows.length === 0) {
        onError?.('No hay potreros habilitados con días válidos.')
        return
      }
      let currentDate = config.fechaInicio
      blocks = validRows.map(row => {
        const entry = currentDate
        const exit = addDays(entry, row.dpSugerido)
        currentDate = addDays(exit, 1)
        return {
          paddock_id: row.id,
          herd_id: herdIds[0] ?? null,
          herd_ids: herdIds,
          entry_date: entry,
          exit_date: exit,
          planned_recovery_days: row.descansoResultante || 60,
          status: 'PLANNED',
          plan_type: 'suggested',
          source_origin: 'algorithm',
          pass_number: 1,
        }
      })
    }

    // Detección de colisiones (warning, no bloqueo)
    if (existingPlans && existingPlans.length > 0 && onCollisionWarning) {
      const newEntries: CollisionEntry[] = blocks.map(b => ({
        paddockId: b.paddock_id,
        entryDate: b.entry_date,
        exitDate: b.exit_date,
      }))

      const paddockNames: Record<string, string> = {}
      paddockRows.forEach(p => { paddockNames[p.id] = p.name })

      const collisions = detectPaddockCollisions(newEntries, existingPlans, paddockNames)

      if (collisions.length > 0) {
        const herdNames: Record<string, string> = {}
        herds.forEach(h => { herdNames[h.id] = h.name })
        const message = formatCollisionWarning(collisions, herdNames)
        const proceed = await onCollisionWarning(message)
        if (!proceed) return
      }
    }

    set({ isSaving: true })

    try {
      // 1. Crear el season_plan padre con herd_ids + cell_paddock_ids
      const year = new Date(config.fechaInicio).getFullYear()
      const seasonPlanPayload = {
        name: planName || `Plan ${enabledHerds.map(h => h.name).join(' + ')} ${year}`,
        season_type: mode === 'open' ? 'abierto' : 'cerrado',
        year,
        start_date: config.fechaInicio,
        end_date: config.fechaFin,
        daily_allocation_kg: config.dailyAllocationKgEv,
        target_remnant_kg_ha: config.targetRemnantKgHa,
        source: 'suggested',
        status: 'active',
        herd_ids: herdIds,
        cell_paddock_ids: enabledPaddocks.map(p => p.id),
        recovery_days: {
          spring_summer: config.descansosPrimavera,
          autumn_winter: config.descansosVerano,
        },
        demand_snapshot: {
          totalEV: config.totalEV,
          demandaDiariaKgMs: config.demandaDiariaKgMs,
          herds: enabledHerds.map(h => ({ id: h.id, name: h.name, ev: h.totalEV, heads: h.headCount })),
        },
        supply_snapshot: {
          total_ha: enabledPaddocks.reduce((s, p) => s + p.areaHa, 0),
          paddock_count: enabledPaddocks.length,
          by_paddock: enabledPaddocks.map(p => ({
            id: p.id, name: p.name, area_ha: p.areaHa,
            aforo_kg_ms_ha: p.aforoKgMsHa,
          })),
        },
        metrics: {
          suggested_sequence: enabledPaddocks.map(p => p.id),
          balance_pct: result?.balance.pct ?? 0,
          total_blocks: blocks.length,
        },
      }

      const spRes = await apiFn('/api/season-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seasonPlanPayload),
      })

      if (!spRes.ok) {
        const err = await spRes.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(err.error || 'Error al crear el plan de temporada')
      }

      const spData = await spRes.json()
      const seasonPlanId = spData.id

      // 2. Crear los bloques individuales, vinculados al season_plan
      const blocksWithSpId = blocks.map(b => ({
        ...b,
        season_plan_id: seasonPlanId,
      }))

      const responses = await Promise.all(
        blocksWithSpId.map(b =>
          apiFn('/api/grazing-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(b),
          }),
        ),
      )

      const failed = responses.filter(r => !r.ok)
      if (failed.length > 0) {
        throw new Error(`${failed.length} bloque(s) fallaron al guardar.`)
      }

      set({ generatedBlocks: blocksWithSpId, isDirty: false, lastSeasonPlanId: seasonPlanId })
      onSuccess?.(blocksWithSpId, seasonPlanId)
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      set({ isSaving: false })
    }
  },

  // ── reset ─────────────────────────────────────────────────────────────────
  reset: () => set({
    herds: [],
    paddockRows: [],
    config: buildDefaultConfig('open'),
    result: null,
    hoveredPaddockId: null,
    selectedPaddockId: null,
    isDirty: false,
    isSaving: false,
    generatedBlocks: [],
    lastSeasonPlanId: null,
    subdivisionSources: {},
  }),
}))

// ── Selectores ────────────────────────────────────────────────────────────────

export const selectIsDeficit = (s: SandboxState) =>
  (s.result?.balance.pct ?? 100) < 80

/**
 * Estado derivado booleano: true cuando el usuario ha seleccionado
 * al menos 1 rodeo Y al menos 1 potrero.
 * Al devolver un primitivo, Zustand no genera re-renders innecesarios.
 */
export const selectHasValidPlanData = (s: SandboxState): boolean =>
  s.herds.some((h: HerdSimRow) => h.enabled) && s.paddockRows.some((p: PaddockSimRow) => p.enabled)
