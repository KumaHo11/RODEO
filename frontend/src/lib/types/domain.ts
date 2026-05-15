/**
 * lib/types/domain.ts — Interfaces tipadas para entidades del dominio RODEO
 * ───────────────────────────────────────────────────────────────────────────
 * Fuente de verdad única para los tipos del negocio ganadero.
 * Reemplaza el uso de `any[]` que prevalecía en herds, paddocks, plans y events.
 *
 * Reglas de diseño:
 *  - Usar `string | null` en lugar de `string?` donde el backend puede devolver null
 *  - Todos los campos monetarios/numéricos que vienen de Postgres son `number | string`
 *    porque Postgres puede enviar strings en algunos drivers
 *  - Las interfaces mínimas (*Like) son para los motores de cálculo en lib/grazing/
 */

// ── Entidades de Stock ───────────────────────────────────────────────────────

export type CategoriaKey =
  | 'VACAS' | 'NOVILLOS' | 'NOVILLITOS' | 'VAQUILLONAS'
  | 'TERNEROS' | 'TERNERAS' | 'TOROS' | 'MEJ' | 'BUBALINOS'

/** Rodeo / herd completo tal como lo devuelve la API */
export interface Herd {
  id: string
  name: string
  species: string
  categoria: CategoriaKey | string | null
  head_count: number
  avg_weight_kg: number | string | null
  total_ev: number | string | null
  breed: string | null
  bcs_score: number | string | null
  admission_date: string | null
  exit_date: string | null
  org_id?: string
}

/** Mínimo requerido por los motores de cálculo EV */
export interface HerdLike {
  id: string
  total_ev?: number | string | null
  head_count?: number | string | null
  animal_count?: number | string | null
}

// ── Potreros ─────────────────────────────────────────────────────────────────

/** Potrero / paddock completo */
export interface Paddock {
  id: string
  name: string
  area_ha: number | string
  dry_matter_kg_ha: number | string | null
  /** Porcentaje de suelo desnudo (0-100) */
  bare_soil_pct: number | string | null
  lat: number | null
  lng: number | null
  polygon?: [number, number][] | null
  org_id?: string
  /** Índice NDVI más reciente */
  ndvi?: number | null
}

/** Mínimo para cálculos de forraje */
export interface PaddockLike {
  id: string
  area_ha: number | string
  dry_matter_kg_ha: number | string | null
}

// ── Planes de Pastoreo ───────────────────────────────────────────────────────

export type PlanType = 'manual' | 'suggested' | 'original'
export type PlanStatus = 'planned' | 'active' | 'completed'

/** Bloque de plan de pastoreo en el Gantt */
export interface GrazingPlan {
  id: string
  paddock_id: string
  herd_id: string | null
  entry_date: string
  exit_date: string
  plan_type: PlanType
  status: PlanStatus
  notes: string | null
  org_id?: string
  /** Headcount específico del plan (puede diferir del rodeo base) */
  headcount_override?: number | null
  /** Flag interno de frontend: marcado si fue recalculado pero no persistido */
  _recalculated?: boolean
  _recalcTimestamp?: string
}

/** Vista del plan enriquecida con datos del potrero para el Gantt */
export interface GrazingPlanView extends GrazingPlan {
  paddockName: string
  herdName?: string
  areaHa: number
  msHa: number
}

// ── Eventos de Hacienda ──────────────────────────────────────────────────────

export type FarmEventType =
  | 'pesada' | 'paricion' | 'destete' | 'mortandad'
  | 'compra' | 'venta' | 'caravana' | 'sanidad'
  | 'traslado' | 'stock_inicial' | 'nota'
  | 'ajuste_entrada' | 'ajuste_salida' | 'servicio'
  | 'GRAZING' | 'FIELD_EVENT'

/** Evento de hacienda completo */
export interface FarmEvent {
  id: string
  herd_id?: string | null
  herd_ids?: string[]
  paddock_id?: string | null
  event_type: FarmEventType | string
  event_date: string
  occurred_at?: string
  quantity?: number | string | null
  weight_kg?: number | string | null
  notes?: string | null
  metadata?: Record<string, unknown>
  org_id?: string
}

/** Mínimo para cálculos de headcount dinámico */
export interface FarmEventLike {
  herd_id?: string
  herd_ids?: string[]
  event_type: string
  event_date: string
  quantity?: number | string
}

// ── Movimientos de Stock ─────────────────────────────────────────────────────

/** Movimiento de stock (registro de historial) */
export interface StockMovement {
  id?: string
  herd_id?: string
  entity_id?: string
  entity_type?: string
  entity_name?: string
  event_type: string
  quantity: number | null
  weight_kg: number | null
  bcs_score: number | null
  categoria: string | null
  breed: string | null
  admission_date: string | null
  occurred_at: string
  notes: string | null
}

// ── Clima ─────────────────────────────────────────────────────────────────────

/** Datos meteorológicos actuales */
export interface WeatherData {
  tempC: number
  humidityPct: number
  windSpeedKmh: number
  rainMm?: number
  radiacionSolar?: number
  description?: string
  icon?: string
  updatedAt?: string
}

// ── Planes de Temporada ──────────────────────────────────────────────────────

/** Configuración de un plan de temporada holístico */
export interface SeasonPlan {
  id: string
  name: string
  start_date: string
  end_date: string
  daily_allocation_kg: number
  target_remnant_kg_ha: number
  plan_type: PlanType
  org_id?: string
}

// ── Respuestas de API ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number
  page?: number
  limit?: number
}
