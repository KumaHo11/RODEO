/**
 * lib/grazing/types.ts — Tipos del motor de simulación agronómica
 * FUENTE ÚNICA DE VERDAD. No duplicar en componentes.
 */

export type SeasonMode = 'open' | 'closed'

// ── Potrero ────────────────────────────────────────────────────────────────────

export interface PaddockSimRow {
  id: string
  name: string
  areaHa: number
  enabled: boolean
  rank: number          // 1–10 (selector dropdown)
  order: number         // posición en la ruta de rotación
  aforoKgMsHa: number   // para balance forrajero (opcional en open)
  // Temporada Abierta — balance de materia seca
  /** Tasa de crecimiento diaria sugerida o sobreescrita por el usuario (kg MS/ha/día). Default: 25 */
  tasaCrecimientoKgHaDia: number
  /** Factor de aprovechamiento del crecimiento neto. Default: 0.50 */
  factorAprovechamiento: number
  // Temporada Cerrada (ocultas en open)
  suplementoKgMs: number
  remanenteObjetivoKgMsHa: number
  // Geometría
  polygon: [number, number][] | null
  lat: number | null
  lng: number | null
}

export type SimRowStatus = 'ok' | 'warn' | 'danger'

export interface PaddockSimResult extends PaddockSimRow {
  /** Coeficiente forrajero: areaHa × rank */
  coeficiente: number
  /** DP para sub-temporada primavera */
  dpPrimavera: number
  /** DP para sub-temporada verano */
  dpVerano: number
  /** DP vigente según la fecha de inicio vs fechaCorte */
  dpSugerido: number
  /** Descanso real = T_ciclo − dpSugerido */
  descansoResultante: number
  /** Guardarraíl: en primavera DP > 5 → requiere boyero */
  needsBoyero: boolean
  status: SimRowStatus
  statusMsg: string
}

// ── Evento del cronograma multi-vuelta ───────────────────────────────────────

export interface PlanEvent {
  /** Número de vuelta (1, 2, 3…) */
  vuelta: number
  /** Sub-temporada vigente en este evento */
  subtemporada: 'primavera' | 'verano'
  paddockId: string
  paddockName: string
  areaHa: number
  /** Posición dentro de la vuelta (1-based) */
  posicion: number
  fechaEntrada: string  // YYYY-MM-DD
  fechaSalida: string   // YYYY-MM-DD
  diasPastoreo: number
  descansoAlRegresar: number
  /** Demanda total de MS para esta estancia (EV × ración × días) */
  demandaMSKg: number
  /** Balance de días del potrero: raciones disponibles / demanda EV (redondeo). Positivo = superávit */
  balanceDiasPotrero?: number
}

// ── Rodeo en la simulación ────────────────────────────────────────────────────

export interface HerdSimRow {
  id: string
  name: string
  headCount: number
  totalEV: number
  enabled: boolean
}

// ── Configuración global ──────────────────────────────────────────────────────

export interface SimulationConfig {
  mode: SeasonMode
  // Fechas de planificación
  fechaInicio: string     // ej. "2026-09-24"
  fechaCorte: string      // separación primavera/verano ej. "2026-12-15"
  fechaFin: string        // ej. "2028-03-17"
  // Descanso por sub-temporada (días)
  descansosPrimavera: number   // 50
  descansosVerano: number      // 100
  // Ración diaria kg MS / EV / día
  dailyAllocationKgEv: number
  // EV total (calculado desde rodeos habilitados)
  totalEV: number
  demandaDiariaKgMs: number
  // Temporada Cerrada
  targetRemnantKgHa: number
}

// ── Input / Output del motor ──────────────────────────────────────────────────

export interface SimulationInput {
  config: SimulationConfig
  paddocks: PaddockSimRow[]
}

export interface BalanceResult {
  /** Duración del ciclo completo en primavera: D + DP_base */
  cicloPrimavera: number
  /** Duración del ciclo completo en verano: D + DP_base */
  cicloVerano: number
  /** DP del lote base (menor coeficiente) en primavera */
  dpBasePrimavera: number
  dpBaseVerano: number
  ofertaKgMs: number
  demandaKgMs: number
  pct: number
  diasPeriodo: number

  // ── Carga animal ─────────────────────────────────────────────────────────
  /** Superficie activa (potreros habilitados) en hectáreas */
  totalAreaHa: number
  /** EV total de los rodeos habilitados */
  totalEV: number
  /** Carga animal: EV / ha de la superficie activa */
  cargaEvHa: number
  /** Rango óptimo: ≤ 1.5 EV/ha → óptimo; ≤ 2.5 → moderado; > 2.5 → sobrepastoreo */
  cargaStatus: 'optimo' | 'moderado' | 'sobrepastoreo'

  // ── Forraje ───────────────────────────────────────────────────────────────
  /** Días reales de cobertura forrajera al ritmo de demanda diaria */
  diasCoberturaForrajera: number
  /** Estado de balance forrajero */
  balanceStatus: 'superavit' | 'ajustado' | 'deficit'
}

export interface SimulationResult {
  rows: PaddockSimResult[]
  totalDays: number
  balance: BalanceResult
  warnings: string[]
  /** Cronograma multi-vuelta generado (temporada abierta solamente) */
  chronogram: PlanEvent[]
  /** Warning de heterogeneidad extrema: cuando el coeficiente mayor supera 3× el menor */
  heterogeneidadExtrema?: {
    potreroMax: string
    potreroMin: string
    ratio: number
    suggestion: string
  }
}
