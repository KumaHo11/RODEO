/**
 * evProjection.ts — Motor de Equivalente Vaca dinámico
 * ─────────────────────────────────────────────────────
 * Calcula la demanda real mensual de un rodeo considerando:
 *  - Categoría animal (novillos, terneros, vacas, toros…)
 *  - Estado fenológico mes a mes (gestación, lactancia, seca)
 *  - Mes de parición configurado por el usuario
 *
 * Basado en estándares INTA / Ovis 21 para Hemisferio Sur.
 *
 * ─── Servicio Core Inyectable ────────────────────────
 * TODAS las funciones de cálculo EV de la plataforma se
 * centralizan aquí. El Dashboard, la Calculadora Rápida y
 * los Reportes de Historial DEBEN consumir estas funciones
 * para garantizar consistencia total de datos.
 */

/** Factores base de EV por categoría (respecto a vaca de 450 kg a mantenimiento) */
export const EV_BASE: Record<string, number> = {
  VACAS:       1.00,
  NOVILLOS:    1.00,
  NOVILLITOS:  0.75,
  VAQUILLONAS: 0.80,
  TERNEROS:    0.45,
  TERNERAS:    0.40,
  TOROS:       1.25,
  MEJ:         0.90,
  BUBALINOS:   1.10,
}

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORÍAS FISIOLÓGICAS / BIOLÓGICAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Categorías fisiológicas independientes de la nomenclatura comercial.
 * Estas categorías gobiernan el cálculo de EV dinámico y la planificación.
 * La categoría comercial (VACAS, TERNEROS…) se mantiene para valuación de mercado.
 *
 * EV base por estado fisiológico (INTA / Ovis 21):
 *  - Vaca con ternero al pie (lactancia activa):  1.35 EV
 *  - Vaca preñada (gestación avanzada):           1.10 EV
 *  - Vaca vacía / seca:                           0.80 EV
 *  - Ternero/a destete:                           0.45 EV (escala con peso)
 *  - Recría / novillo en crecimiento:             1.00 EV (escala con peso)
 */
export const PHYSIOLOGICAL_CATEGORIES = [
  'VACA_CON_TERNERO',
  'VACA_PRENADA',
  'VACA_VACIA',
  'TERNERO',
  'RECRIA_NOVILLO',
] as const

export type PhysiologicalCategory = typeof PHYSIOLOGICAL_CATEGORIES[number]

/** EV base por categoría fisiológica (sin escalar por peso — peso escala vía fórmula) */
export const PHYSIO_EV_BASE: Record<PhysiologicalCategory, number> = {
  VACA_CON_TERNERO: 1.35,
  VACA_PRENADA:     1.10,
  VACA_VACIA:       0.80,
  TERNERO:          0.45,
  RECRIA_NOVILLO:   1.00,
}

/** Etiquetas en español para la UI */
export const PHYSIO_LABEL: Record<PhysiologicalCategory, string> = {
  VACA_CON_TERNERO: 'Vaca con Ternero al Pie',
  VACA_PRENADA:     'Vaca Preñada',
  VACA_VACIA:       'Vaca Vacía / Seca',
  TERNERO:          'Ternero/a',
  RECRIA_NOVILLO:   'Recría / Novillo',
}

/**
 * Categorías de crecimiento activo (requieren GDP para proyección).
 * En estas categorías la GDP es obligatoria.
 * Para vacas, la GDP también puede usarse para proyectar variación de peso
 * corporal en gestación/post-parto.
 */
export const GROWTH_PHYSIO_CATEGORIES = new Set<PhysiologicalCategory>([
  'TERNERO',
  'RECRIA_NOVILLO',
])

/**
 * Peso de referencia base para escalar el EV (kg).
 * Vaca estándar de referencia INTA = 400 kg.
 */
const EV_REFERENCE_WEIGHT_KG = 400

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE PROYECCIÓN GDP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el peso proyectado de un animal en una fecha futura usando GDP lineal.
 *
 * Peso_Proyectado(t) = Peso_Actual + (GDP × Días_Transcurridos)
 *
 * @param baseWeightKg      Peso promedio actual en kg
 * @param gdpKgDay          Ganancia Diaria de Peso en kg/día (ej: 0.500)
 * @param daysSinceWeigh    Días transcurridos desde el último pesaje
 * @param maxWeightKg       Peso máximo permitido (default: 650 kg)
 */
export function calculateProjectedWeight(
  baseWeightKg: number,
  gdpKgDay: number,
  daysSinceWeigh: number,
  maxWeightKg = 650,
): number {
  const projected = baseWeightKg + gdpKgDay * daysSinceWeigh
  return Math.min(Math.round(projected * 10) / 10, maxWeightKg)
}

/**
 * Calcula el EV proyectado de un rodeo usando categoría fisiológica y peso proyectado.
 *
 * EV_Proyectado(t) = EV_Base_Fisiológico × (Peso_Proyectado / 400)^0.75 × Cabezas
 *
 * @param physioCategory    Categoría fisiológica del rodeo
 * @param projectedWeightKg Peso proyectado por cabeza en kg
 * @param headCount         Número de cabezas
 */
export function calculateProjectedEV(
  physioCategory: PhysiologicalCategory | string | null,
  projectedWeightKg: number,
  headCount: number,
): number {
  const evBase = physioCategory
    ? (PHYSIO_EV_BASE[physioCategory as PhysiologicalCategory] ?? 1.0)
    : 1.0
  return parseFloat(
    (evBase * Math.pow((projectedWeightKg || EV_REFERENCE_WEIGHT_KG) / EV_REFERENCE_WEIGHT_KG, 0.75) * headCount).toFixed(2)
  )
}

export interface GrowthDataPoint {
  month: number          // 0 = mes actual, 1 = próximo, etc.
  monthLabel: string     // ej: "Jun '25"
  projectedWeightKg: number
  evTotal: number
  dailyConsumptionKgMS: number   // kg de Materia Seca / día (EV × 11)
}

export interface GrowthProjectionInput {
  physioCategory: PhysiologicalCategory | string | null
  avgWeightKg: number
  gdpKgDay: number           // kg/día
  headCount: number
  lastWeighDate?: string | null  // YYYY-MM-DD — si null, usa hoy
}

/**
 * Genera la proyección de crecimiento mensual para los próximos N meses.
 *
 * Usa la GDP del rodeo para calcular el peso mes a mes y el EV resultante.
 * Fuente única de verdad para el gráfico de crecimiento y la UI de proyección.
 *
 * @param input   Datos del rodeo
 * @param months  Número de meses a proyectar (default: 12)
 */
export function generateGrowthProjection(
  input: GrowthProjectionInput,
  months = 12,
): GrowthDataPoint[] {
  const { physioCategory, avgWeightKg, gdpKgDay, headCount, lastWeighDate } = input
  const referenceDate = lastWeighDate ? new Date(lastWeighDate + 'T00:00:00') : new Date()
  const today = new Date()

  return Array.from({ length: months }, (_, i) => {
    const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const daysSince = Math.max(
      0,
      Math.round((targetDate.getTime() - referenceDate.getTime()) / 86_400_000),
    )

    const projectedWeightKg = calculateProjectedWeight(avgWeightKg, gdpKgDay, daysSince)
    const evTotal = calculateProjectedEV(physioCategory, projectedWeightKg, headCount)
    const dailyConsumptionKgMS = parseFloat((evTotal * 11).toFixed(1))

    const monthLabel = targetDate.toLocaleString('es', { month: 'short', year: '2-digit' })

    return { month: i, monthLabel, projectedWeightKg, evTotal, dailyConsumptionKgMS }
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIONES BASE EXISTENTES (sin modificación)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el EV base de un rodeo.
 * Fórmula canónica INTA: vaca 450 kg = 1 EV.
 * @param categoria  Clave de categoría (VACAS, TERNEROS, TOROS…)
 * @param weight     Peso promedio en kg
 * @param count      Número de cabezas
 */
export function calculateBaseEV(categoria: string | null, weight: number, count: number): number {
  const evBase = categoria ? (EV_BASE[categoria.toUpperCase()] ?? 1.0) : 1.0
  return evBase * Math.pow((weight || 450) / 450, 0.75) * count
}

// ── Tipos de eventos de hacienda (mínimo necesario para cálculos dinámicos) ──

interface FarmEventLike {
  herd_id?: string
  herd_ids?: string[]
  event_type: string
  event_date: string
  quantity?: number | string
}

/**
 * Calcula el headcount dinámico de un rodeo en una fecha dada,
 * aplicando o revirtiendo los eventos de hacienda en ese período.
 *
 * - Fecha pasada: revierte los movimientos desde la fecha hasta hoy
 * - Fecha futura: aplica los movimientos programados
 *
 * @param herdId       ID del rodeo
 * @param baseCount    Headcount actual del rodeo
 * @param dateStr      Fecha target en formato 'YYYY-MM-DD'
 * @param unifiedEvents Eventos de hacienda unificados
 */
export function calculateDynamicHeadcount(
  herdId: string,
  baseCount: number,
  dateStr: string,
  unifiedEvents: FarmEventLike[],
): number {
  const today = new Date().toISOString().split('T')[0]
  let count = baseCount

  const relEvents = unifiedEvents.filter(
    e => e.herd_id === herdId || (e.herd_ids && e.herd_ids.includes(herdId)),
  )

  if (dateStr < today) {
    // Pasado: revertir movimientos que ocurrieron entre dateStr y hoy
    const eventsBetween = relEvents.filter(
      e => e.event_date > dateStr && e.event_date <= today,
    )
    eventsBetween.forEach(e => {
      const q = Number(e.quantity || 0)
      if (['venta', 'mortandad', 'ajuste_salida'].includes(e.event_type)) count += q
      if (['compra', 'paricion', 'ajuste_entrada', 'servicio'].includes(e.event_type)) count -= q
    })
  } else if (dateStr > today) {
    // Futuro: aplicar movimientos programados desde hoy hasta dateStr
    const eventsBetween = relEvents.filter(
      e => e.event_date > today && e.event_date <= dateStr,
    )
    eventsBetween.forEach(e => {
      const q = Number(e.quantity || 0)
      if (['venta', 'mortandad', 'ajuste_salida'].includes(e.event_type)) count -= q
      if (['compra', 'paricion', 'ajuste_entrada', 'servicio'].includes(e.event_type)) count += q
    })
  }

  return Math.max(0, count)
}

interface HerdLike {
  id: string
  total_ev?: number | string | null
  head_count?: number | string | null
  animal_count?: number | string | null
}

/**
 * Calcula el EV dinámico de un rodeo en una fecha dada,
 * ajustando por estado fenológico (lactancia, preñez).
 *
 * @param herd             Datos del rodeo
 * @param dateISO          Fecha de evaluación en 'YYYY-MM-DD'
 * @param farmEvents       Eventos de hacienda para detectar pariciones
 * @param headCountOverride Headcount override (ej: calculado por calculateDynamicHeadcount)
 */
export function getDynamicHerdEV(
  herd: HerdLike,
  dateISO: string,
  farmEvents: FarmEventLike[],
  headCountOverride?: number,
): number {
  const currentEV = Number(herd?.total_ev) || 0
  if (currentEV === 0) return 0

  const currentHeadCount = Number(herd?.head_count ?? herd?.animal_count) || currentEV
  const headCount = headCountOverride !== undefined ? headCountOverride : currentHeadCount
  if (headCount === 0) return 0

  const evPerHead = currentHeadCount > 0
    ? currentEV / currentHeadCount
    : currentEV > 0 ? currentEV : 1

  const sorted = farmEvents
    .filter(e => (e.herd_id === herd.id || !e.herd_id) && e.event_date <= dateISO)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  let currentState = 'normal'
  let lastParicion: string | null = null

  for (const ev of sorted) {
    if (ev.event_type === 'paricion') {
      currentState = 'lactating'
      lastParicion = ev.event_date
    } else if (ev.event_type === 'destete') {
      currentState = 'normal'
      lastParicion = null
    }
  }

  // Lactancia con ternero al pie: ≥ 90 días post-parto
  if (currentState === 'lactating' && lastParicion) {
    const daysSinceParicion = Math.round(
      (new Date(dateISO + 'T00:00:00').getTime() - new Date(lastParicion + 'T00:00:00').getTime())
      / 86_400_000,
    )
    if (daysSinceParicion >= 90) currentState = 'lactating_with_calf'
  }

  if (currentState === 'lactating') return headCount * 1.5
  if (currentState === 'lactating_with_calf') return headCount * 1.8
  return evPerHead * headCount
}

/** Temporadas de parición disponibles en el selector */
export type ParitionSeason = 'otono' | 'primavera' | 'todo_el_año'

/** Retorna el mes de parición (0-based: 0=enero) según la temporada seleccionada */
function paritionMonth(season: ParitionSeason): number {
  if (season === 'otono')     return 3  // Abril
  if (season === 'primavera') return 8  // Septiembre
  return -1  // todo el año: sin pico
}

/**
 * Factor de demanda energética mensual para vacas cría según estado fenológico.
 *
 * Escala sobre 1.0 = vaca seca a mantenimiento.
 * Lactancia temprana (0-3 meses): +40% energía
 * Lactancia tardía (3-6 meses): +20%
 * Gestación tardía (último trimestre): +15%
 * Seca/gestación temprana: base 1.0
 */
function vacaFenologiaFactor(monthOffset: number, paritionSeason: ParitionSeason): number {
  if (paritionSeason === 'todo_el_año') return 1.10  // promedio constante

  const parMonth = paritionMonth(paritionSeason)
  const currentMonth = (new Date().getMonth() + monthOffset) % 12

  // Meses relativos al parto (positivos = post-parto, negativos = pre-parto)
  const dif = ((currentMonth - parMonth) + 12) % 12

  if (dif <= 2)  return 1.40  // Lactancia temprana (0-2 meses posparto)
  if (dif <= 5)  return 1.20  // Lactancia tardía (3-5 meses)
  if (dif <= 8)  return 1.05  // Gestación media
  if (dif <= 11) return 1.18  // Gestación tardía (último trimestre)
  return 1.00
}

/** Tasa de crecimiento mensual de peso vivo para categorías jóvenes (kg/mes) */
const GROWTH_RATE_KG_MONTH: Record<string, number> = {
  TERNEROS:    25,
  TERNERAS:    20,
  NOVILLITOS:  18,
  VAQUILLONAS: 15,
}

interface Herd {
  id: string
  name: string
  head_count: number | string
  avg_weight_kg: number | string | null
  categoria: string | null
  total_ev: number | string | null
}

export interface EVProjection {
  month: number        // 0 = mes actual, 1 = próximo, etc.
  monthLabel: string
  totalEV: number
  dailyDemandKg: number
  breakdown: { herdName: string; ev: number; headCount: number }[]
}

/**
 * Proyecta la demanda de EV para los próximos `months` meses.
 *
 * @param herds          Lista de rodeos actuales
 * @param dailyAlloc     kg MS por EV por día (configurado por el usuario)
 * @param paritionSeason Temporada de parición seleccionada por el usuario
 * @param months         Cantidad de meses a proyectar (default 6)
 */
export function projectEVDemand(
  herds: Herd[],
  dailyAlloc: number,
  paritionSeason: ParitionSeason,
  months = 6,
): EVProjection[] {
  const today = new Date()

  return Array.from({ length: months }, (_, i) => {
    const dt = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const monthLabel = dt.toLocaleString('es', { month: 'short', year: '2-digit' })

    const breakdown = herds.map(h => {
      const categoria = (h.categoria ?? 'VACAS').toUpperCase()
      const headCount = Number(h.head_count) || 0
      const baseWeight = Number(h.avg_weight_kg) || 450

      // Crecer el peso vivo para categorías jóvenes
      const growthKgMonth = GROWTH_RATE_KG_MONTH[categoria] ?? 0
      const projectedWeight = Math.min(baseWeight + growthKgMonth * i, 600)

      // Use db total_ev as baseline for month 0 to exactly match the user's known EV.
      let baseHerdEv = Number(h.total_ev)
      if (!baseHerdEv) {
        baseHerdEv = calculateBaseEV(categoria, baseWeight, headCount)
      }

      let ev = baseHerdEv

      // For future months, apply relative multipliers
      if (i > 0) {
        // Relative growth multiplier
        const growthMultiplier = Math.pow(projectedWeight / 450, 0.75) / Math.pow(baseWeight / 450, 0.75)
        ev *= growthMultiplier

        // Relative fenology multiplier for breeding cows
        if (['VACAS', 'VAQUILLONAS'].includes(categoria)) {
          const factor0 = vacaFenologiaFactor(0, paritionSeason)
          const factorI = vacaFenologiaFactor(i, paritionSeason)
          if (factor0 > 0) {
            ev *= (factorI / factor0)
          }
        }
      }

      return { herdName: h.name, ev: parseFloat(ev.toFixed(2)), headCount }
    })

    const totalEV = parseFloat(breakdown.reduce((s, b) => s + b.ev, 0).toFixed(2))
    const dailyDemandKg = parseFloat((totalEV * dailyAlloc).toFixed(1))

    return { month: i, monthLabel, totalEV, dailyDemandKg, breakdown }
  })
}
