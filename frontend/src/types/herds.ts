// ─────────────────────────────────────────────────────────────────────────────
// types/herds.ts
// Interfaces del módulo Rodeos — Patrón Master-Detail
// ─────────────────────────────────────────────────────────────────────────────

import type { BitacoraEntry } from './bitacora'
import type { CategoriaComercial } from '@/lib/categorias'

// ── Tabs válidos del panel derecho ───────────────────────────────────────────

export const HERD_TABS = ['datos', 'actividades', 'animales', 'metricas', 'bitacora'] as const
export type HerdTab = typeof HERD_TABS[number]

export const HERD_TAB_LABELS: Record<HerdTab, string> = {
  datos:        'Datos',
  actividades:  'Actividades',
  animales:     'Animales',
  metricas:     'Métricas',
  bitacora:     'Bitácora',
}

// ── Entidad principal Rodeo ───────────────────────────────────────────────────

/**
 * Entidad canónica del rodeo usada en el patrón Master-Detail.
 * Extiende/reemplaza gradualmente HerdData de HerdModal.tsx.
 */
export interface Herd {
  id: string
  org_id?: string
  name: string
  species: string
  categoria: CategoriaComercial | null
  physiological_category: string | null
  breed: string | null
  head_count: number
  avg_weight_kg: number | null
  total_ev: number | null
  bcs_score: number | null
  admission_date: string | null   // ISO date
  exit_date: string | null        // null = activo
  paddock_id?: string | null      // potrero actual
  paddock_name?: string | null
  grupo_manejo_id?: string | null
  grupo_manejo_nombre?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  // v8-v9 campos extendidos (compatibilidad con HerdData)
  age_years?: number | null
  age_months?: number | null
  last_weigh_date?: string | null
  daily_gain_kg?: number | null
  lactancia_range?: string | null
  estadio_gestacion?: string | null
  custom_racion_kg?: number | null
  ms_dia_kg?: number | null
  parent_herd_id?: string | null
  herd_notes?: any[]
}

// ── CSV / Animales ────────────────────────────────────────────────────────────

/** Fila del CSV formato INTA con datos por animal individual */
export interface AnimalCSVRow {
  caravana: string              // ID único del animal (ej: AR-0012345)
  rp?: string                   // Registro provincial
  sexo?: 'M' | 'H'
  categoria?: CategoriaComercial
  fecha_nacimiento?: string     // ISO date
  peso_kg?: number
  raza?: string
  rodeo_origen?: string
  observaciones?: string
  /** Número de fila en el CSV original (1-indexed, sin contar header) */
  _rowIndex: number
}

/** Estado completo del proceso de carga de un CSV */
export interface CSVConciliacion {
  status: 'idle' | 'parsing' | 'mismatch' | 'confirmed' | 'uploading' | 'done' | 'error'

  /** Cantidad de filas de datos en el CSV (sin header) */
  csvRowCount: number

  /** Cabezas declaradas actualmente en el sistema */
  declaredHeadCount: number

  /** Diferencia: csvRowCount - declaredHeadCount (puede ser negativo) */
  diff: number

  /** Acción elegida por el usuario para resolver la diferencia */
  resolution?: CSVResolutionAction

  /** Justificación libre escrita por el usuario (mín. 10 caracteres) */
  justification: string

  /** Filas parseadas del CSV (preview) */
  rows: AnimalCSVRow[]

  /** Errores de validación: { rowIndex: errorMsg[] } */
  validationErrors: Record<number, string[]>

  /** Nombre del archivo original */
  fileName: string

  /** Mensaje de error si status === 'error' */
  errorMessage?: string
}

export type CSVResolutionAction =
  | 'actualizar_stock'    // El CSV es correcto → ajustar cabezas a csvRowCount
  | 'stock_parcial'       // El CSV es parcial → mantener head_count actual
  | 'solo_actualizar'     // Solo actualizar datos individuales, no head_count

export const CSV_RESOLUTION_LABELS: Record<CSVResolutionAction, string> = {
  actualizar_stock: 'Actualizar stock: el CSV es correcto, ajustar cabezas',
  stock_parcial:    'CSV parcial: faltan cargar animales (mantener stock actual)',
  solo_actualizar:  'Solo actualizar datos individuales (no cambiar stock)',
}

// ── Métricas del rodeo ────────────────────────────────────────────────────────

export interface HerdMetrics {
  herd_id: string
  generated_at: string

  ev_history: EVDataPoint[]
  ev_current: number
  ev_initial: number

  ev_distribution: {
    pct_of_paddock: number
    pct_of_farm: number
    paddock_total_ev: number
    farm_total_ev: number
    paddock_name: string | null
  }

  consumo_proyeccion: ConsumoProyeccion
  clima_alimento: ClimaAlimentoDataPoint[]
  rotaciones: RotacionEvent[]
  economia_proyeccion: EconomiaProyeccion
}

export interface EVDataPoint {
  date: string            // ISO date
  ev: number
  head_count: number
  avg_weight_kg: number
  event_type?: string     // qué movimiento generó este punto
  event_label?: string    // label legible
}

export interface ConsumoProyeccion {
  /** kg MS/día actual (EV × 11) */
  consumo_dia_kg: number
  proyecciones: ConsumoHorizonte[]
}

export interface ConsumoHorizonte {
  horizonte: '7d' | '30d' | '90d' | '180d' | '365d' | '2y' | '3y'
  label: string
  dias: number
  consumo_total_kg: number
  consumo_total_tn: number
}

export interface ClimaAlimentoDataPoint {
  date: string
  temp_avg_c: number | null
  precip_mm: number | null
  disponibilidad_ms_kg_ha: number | null
  gdp_kg_animal: number | null
  event_note?: string   // ej: "Helada registrada"
}

export interface RotacionEvent {
  id: string
  occurred_at: string
  from_paddock_id: string | null
  from_paddock_name: string | null
  to_paddock_id: string
  to_paddock_name: string
  head_count: number
  ev_at_rotation: number
  days_in_previous: number | null
}

export interface EconomiaProyeccion {
  precio_novillo_history: PrecioNovillo[]
  proyecciones: EconomiaHorizonte[]
  gdp_promedio: number
}

export interface PrecioNovillo {
  date: string
  precio_kg: number
  fuente: 'ROSGAN' | 'manual' | 'estimado'
}

export interface EconomiaHorizonte {
  horizonte_dias: number
  label: string
  kg_ganados_estimados: number
  precio_referencia: number
  ganancia_estimada_usd: number
  ganancia_estimada_ars: number
}

// ── Bitácora unificada del rodeo ──────────────────────────────────────────────

/**
 * Tipo de entrada en el timeline unificado del rodeo.
 * Mezcla registros manuales (web/WhatsApp) con eventos automáticos del sistema.
 */
export type HerdTimelineEntryType =
  | 'manual_note'
  | 'movement'
  | 'stock_event'
  | 'pesada'
  | 'bcs'
  | 'sanidad'
  | 'csv_upload'

/**
 * Extiende BitacoraEntry para incluir eventos automáticos del sistema.
 * El campo `system_event` solo está presente para entries de tipo automático.
 */
export interface HerdTimelineEntry extends Omit<BitacoraEntry, 'rodeo_id'> {
  herd_id: string
  entry_type: HerdTimelineEntryType
  system_event?: HerdSystemEvent
}

export interface HerdSystemEvent {
  event_type: string
  quantity?: number
  weight_kg?: number
  bcs_score?: number
  from_paddock?: string
  to_paddock?: string
  price_per_kg?: number
  notes?: string
}

// ── Utilidades de UI ──────────────────────────────────────────────────────────

/** Estado del sidebar de la sección Rodeos (persistido en localStorage) */
export interface HerdsSidebarState {
  collapsed: boolean
}

export const HERDS_SIDEBAR_KEY = 'rodeo_herds_sidebar_collapsed'
