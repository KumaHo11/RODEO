/**
 * evProjection.ts — Motor de Equivalente Vaca dinámico
 * ─────────────────────────────────────────────────────
 * Calcula la demanda real mensual de un rodeo considerando:
 *  - Categoría animal (novillos, terneros, vacas, toros…)
 *  - Estado fenológico mes a mes (gestación, lactancia, seca)
 *  - Mes de parición configurado por el usuario
 *
 * Basado en estándares INTA / Ovis 21 para Hemisferio Sur.
 * Integra las tablas oficiales Cocimano (1975) via evMatrix.ts.
 *
 * ─── Servicio Core Inyectable ────────────────────────
 * TODAS las funciones de cálculo EV de la plataforma se
 * centralizan aquí. El Dashboard, la Calculadora Rápida y
 * los Reportes de Historial DEBEN consumir estas funciones
 * para garantizar consistencia total de datos.
 */

// Re-exportar la función central de cálculo Cocimano para consumo externo
export { calcularEV, calcularEVRodeo, RATION_SUGERIDA_POR_CATEGORIA, LACTANCIA_RANGES, ESTADIOS_GESTACION } from './evMatrix'
export type { CalcEVParams, CalcEVResult, CalcEVRodeoResult, LactanciaRange, EstadioGestacion } from './evMatrix'

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

/**
 * Peso de referencia por categoría fisiológica (kg).
 * Usado para precargar el campo Peso en los formularios de alta de rodeos.
 * Fuente: tablas Cocimano / INTA — peso típico de cada categoría en Argentina.
 *
 * SINGLE SOURCE OF TRUTH para precarga de peso en:
 *  - HerdFormFields (componente unificado)
 *  - Step3Herds (onboarding)
 *  - HerdModal Tab 1 (sección Rodeos)
 *  - Planificador (temporarios)
 */
export const PHYSIO_PESO_DEFAULT: Record<string, number> = {
  VACA_CON_TERNERO:  420,  // Ref. calculadora: 350-500 kg
  VACA_PRENADA:      420,  // Ref. calculadora: 350-500 kg
  VACA_VACIA:        400,  // Ref. calculadora: 350-500 kg
  VACA_SECA:         400,  // Alias VACA_VACIA
  TERNERO:           190,  // Ref. calculadora: 160-220 kg
  NOVILLITO:         290,  // Ref. calculadora: 240-340 kg
  RECRIA_NOVILLO:    440,  // Ref. calculadora: 400-480 kg
  RECRIA_VAQUILLONA: 295,  // Ref. calculadora: 260-330 kg
  TORO_DESCANSO:     700,  // Ref. calculadora: 600-800 kg
  TORO_SERVICIO:     700,  // Ref. calculadora: 600-800 kg
}

/**
 * Deriva la categoría comercial (para guardar en BD) desde la categoría fisiológica.
 * La categoría comercial se mantiene por compatibilidad con el resto del sistema
 * (filtros, colores, razas por categoría, etc.) pero ya no es el campo primario del formulario.
 */
export function physioToComercial(physio: string): string {
  if (['VACA_CON_TERNERO', 'VACA_PRENADA', 'VACA_VACIA', 'VACA_SECA'].includes(physio)) return 'VACAS'
  if (physio === 'TERNERO') return 'TERNEROS'
  if (physio === 'NOVILLITO') return 'NOVILLITOS'
  if (physio === 'RECRIA_NOVILLO') return 'NOVILLOS'
  if (physio === 'RECRIA_VAQUILLONA') return 'VAQUILLONAS'
  if (['TORO_DESCANSO', 'TORO_SERVICIO'].includes(physio)) return 'TOROS'
  return 'VACAS'
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
  'VACA_SECA',
  'TERNERO',
  'NOVILLITO',
  'RECRIA_NOVILLO',
  'RECRIA_VAQUILLONA',
  'TORO_DESCANSO',
  'TORO_SERVICIO',
] as const

export type PhysiologicalCategory = typeof PHYSIOLOGICAL_CATEGORIES[number]

/**
 * EV base por categoría fisiológica.
 * Estos valores son el punto de partida aproximado para rodeos legacy
 * que no tienen datos de peso/ADPV. La función calcularEV() de evMatrix.ts
 * provee valores exactos Cocimano cuando se conoce el peso real.
 */
export const PHYSIO_EV_BASE: Record<PhysiologicalCategory, number> = {
  VACA_CON_TERNERO:  1.18,  // Ref. 400 kg, 3-4 meses lactancia
  VACA_PRENADA:      0.91,  // Ref. 400 kg, 8vo mes gestación
  VACA_VACIA:        0.73,  // Ref. 400 kg, mantenimiento
  VACA_SECA:         0.73,  // Alias VACA_VACIA
  TERNERO:           0.54,  // Ref. 150 kg, ADPV 0 g/día
  NOVILLITO:         0.58,  // Ref. 200 kg (< 300 kg), ADPV activo
  RECRIA_NOVILLO:    0.69,  // Ref. 300 kg (300-450 kg), ADPV activo
  RECRIA_VAQUILLONA: 0.54,  // Ref. 200 kg, ADPV 0 g/día
  TORO_DESCANSO:     0.98,  // Ref. 600 kg, ADPV 0 g/día
  TORO_SERVICIO:     1.32,  // Ref. 600 kg, ADPV 500 g/día
}

/** Etiquetas en español para la UI */
export const PHYSIO_LABEL: Record<PhysiologicalCategory, string> = {
  VACA_CON_TERNERO:  'Vaca con ternero al pie',
  VACA_PRENADA:      'Vaca preñada',
  VACA_VACIA:        'Vaca vacía',
  VACA_SECA:         'Vaca seca',
  TERNERO:           'Ternero/a',
  NOVILLITO:         'Novillito',
  RECRIA_NOVILLO:    'Novillo',
  RECRIA_VAQUILLONA: 'Vaquillona',
  TORO_DESCANSO:     'Toro en descanso',
  TORO_SERVICIO:     'Toro en servicio',
}

/**
 * Categorías de crecimiento activo (requieren GDP/ADPV para el cálculo exacto).
 * En estas categorías el ADPV es obligatorio para la tabla Cocimano.
 */
export const GROWTH_PHYSIO_CATEGORIES = new Set<PhysiologicalCategory>([
  'TERNERO',
  'NOVILLITO',
  'RECRIA_NOVILLO',
  'RECRIA_VAQUILLONA',
  'TORO_DESCANSO',
  'TORO_SERVICIO',
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

    const monthLabel = targetDate.toLocaleString('es', { month: 'short', year: '2-digit' })

    return { month: i, monthLabel, projectedWeightKg, evTotal }
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

// ══════════════════════════════════════════════════════════════════════════════
// SERVICIO CORE INYECTABLE — obtenerEvRodeoParaFecha
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Hito biológico del calendario ganadero.
 * Usado por el Planificador Manual, el Planificador Sugerido y la Calculadora Rápida.
 */
export interface BioMilestone {
  type: 'weaning_head' | 'weaning_body' | 'weaning_tail' | 'service' | 'parition'
  date: string             // YYYY-MM-DD — fecha exacta del hito
  herdId: string           // Rodeo al que aplica
  pct?: number             // % del rodeo afectado (destete escalonado, 0-100)
  estimatedWeightKg?: number // Peso estimado al momento del hito (terneros)
  durationDays?: number    // Duración (para temporada de servicio)
}

/**
 * Interfaz extendida del rodeo para el motor de EV dinámico.
 * Compatible con los campos de HerdModal (physiological_category, daily_gain_kg, last_weigh_date).
 */
export interface HerdForEVCalc {
  id: string
  total_ev?: number | string | null
  head_count?: number | string | null
  animal_count?: number | string | null
  avg_weight_kg?: number | string | null
  categoria?: string | null
  physiological_category?: string | null
  daily_gain_kg?: number | string | null
  last_weigh_date?: string | null
}

/**
 * ─── FUNCIÓN CENTRAL INYECTABLE ───────────────────────────────────────────────
 * Calcula el EV total de un rodeo en una fecha objetivo específica.
 *
 * Considera (en orden de prioridad):
 *  1. GDP acumulada desde el último pesaje → peso proyectado
 *  2. Categoría fisiológica del rodeo (physiological_category)
 *  3. Hitos biológicos configurados por el usuario (destete, servicio, parición)
 *  4. Fallback a calculateBaseEV() para rodeos legacy sin physiological_category
 *
 * Esta función es la ÚNICA fuente de verdad para cálculos de EV en fecha.
 * Consumida por: Planificador Manual, Planificador Sugerido, Dashboard, Calculadora.
 *
 * @param herd          Datos del rodeo
 * @param targetDateISO Fecha objetivo en formato 'YYYY-MM-DD'
 * @param milestones    Hitos biológicos configurados por el usuario (opcional)
 */
export function obtenerEvRodeoParaFecha(
  herd: HerdForEVCalc,
  targetDateISO: string,
  milestones?: BioMilestone[],
): number {
  const headCount = Number(herd.head_count ?? herd.animal_count) || 0
  if (headCount === 0) return 0

  const baseWeightKg = Number(herd.avg_weight_kg) || EV_REFERENCE_WEIGHT_KG
  const gdpKgDay     = Number(herd.daily_gain_kg) || 0
  const physioRaw    = herd.physiological_category as PhysiologicalCategory | null | undefined

  // ── 1. Calcular peso proyectado en la fecha objetivo ────────────────────────
  const refDateStr = herd.last_weigh_date || new Date().toISOString().split('T')[0]
  const refDate  = new Date(refDateStr  + 'T00:00:00')
  const tgtDate  = new Date(targetDateISO + 'T00:00:00')
  const daysDiff = Math.round((tgtDate.getTime() - refDate.getTime()) / 86_400_000)

  const projectedWeight = gdpKgDay > 0 && daysDiff > 0
    ? calculateProjectedWeight(baseWeightKg, gdpKgDay, daysDiff)
    : baseWeightKg

  // ── 2. Determinar categoría fisiológica activa en la fecha objetivo ─────────
  // Por defecto, la categoría fisiológica configurada en el rodeo
  let activePhysio: PhysiologicalCategory | null = physioRaw || null
  let activeHeadCount = headCount

  // ── 3. Aplicar hitos biológicos del usuario ─────────────────────────────────
  if (milestones && milestones.length > 0) {
    const herdMilestones = milestones
      .filter(m => m.herdId === herd.id && m.date <= targetDateISO)
      .sort((a, b) => a.date.localeCompare(b.date))

    for (const m of herdMilestones) {
      if (m.type === 'service') {
        // Servicio → proyectar parición 9 meses después
        const paritionDate = new Date(m.date + 'T00:00:00')
        paritionDate.setMonth(paritionDate.getMonth() + 9)
        const paritionISO = paritionDate.toISOString().split('T')[0]
        if (targetDateISO >= paritionISO) {
          // Post-parición: vaca con ternero al pie
          activePhysio = 'VACA_CON_TERNERO'
        } else if (targetDateISO >= m.date) {
          // Pre-parición: vaca preñada (gestación)
          activePhysio = 'VACA_PRENADA'
        }
      }

      if (m.type === 'weaning_head' || m.type === 'weaning_body' || m.type === 'weaning_tail') {
        // Post-destete: madres pasan a VACA_VACIA
        // Solo aplica si la categoría actual es de vacas con cría
        if (
          activePhysio === 'VACA_CON_TERNERO' ||
          activePhysio === 'VACA_PRENADA' ||
          activePhysio === null ||
          (herd.categoria && ['VACAS', 'VAQUILLONAS'].includes(String(herd.categoria).toUpperCase()))
        ) {
          activePhysio = 'VACA_VACIA'
        }
      }

      if (m.type === 'parition') {
        // Parición explícita configurada como hito
        activePhysio = 'VACA_CON_TERNERO'
      }
    }
  }

  // ── 4. Calcular EV final ─────────────────────────────────────────────────────
  if (activePhysio) {
    // Ruta fisiológica: EV_Base_Fisiológico × (Peso_Proyectado / 400)^0.75 × Cabezas
    return calculateProjectedEV(activePhysio, projectedWeight, activeHeadCount)
  }

  // Fallback legacy: EV canónico INTA por categoría comercial
  return calculateBaseEV(herd.categoria ?? null, projectedWeight, activeHeadCount)
}

// ──────────────────────────────────────────────────────────────────────────────

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

// ══════════════════════════════════════════════════════════════════════════════
// calcularEvParaMes — EV correcto para la tabla del Planificador
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el EV total de un rodeo para un mes específico del Planificador.
 *
 * Diferencia clave con `obtenerEvRodeoParaFecha`:
 *  - Usa `total_ev` de DB como base (EV real calibrado por el usuario).
 *  - NO recalcula desde PHYSIO_EV_BASE — eso causaba el gap de 7-8 días.
 *  - Para meses futuros aplica SOLO multiplicadores RELATIVOS de crecimiento
 *    de peso y fenología vacuna, manteniendo el total_ev como ancla.
 *
 * Consistent con `projectEVDemand` y el motor del Planificador Sugerido.
 *
 * @param herd             Datos del rodeo (requiere total_ev, head_count, avg_weight_kg, categoria)
 * @param monthStartDate   Fecha de inicio del mes en formato 'YYYY-MM-DD'
 * @param headCountOverride Cabezas dinámicas para el mes (post-movimientos de hacienda)
 * @param paritionSeason   Temporada de parición de la org (para vacas cría)
 */
export function calcularEvParaMes(
  herd: {
    id: string
    total_ev?: number | string | null
    head_count?: number | string | null
    avg_weight_kg?: number | string | null
    categoria?: string | null
  },
  monthStartDate: string,
  headCountOverride: number,
  paritionSeason: ParitionSeason = 'primavera',
): number {
  if (headCountOverride === 0) return 0

  const categoria = ((herd.categoria as string) ?? 'VACAS').toUpperCase()
  const baseWeight = Number(herd.avg_weight_kg) || 450
  const baseHeadCount = Number(herd.head_count) || headCountOverride

  // ── Base EV: usar total_ev de DB (EV real del rodeo calibrado) ─────────────
  let baseHerdEv = Number(herd.total_ev)
  if (!baseHerdEv || isNaN(baseHerdEv)) {
    // Fallback para rodeos sin total_ev: fórmula INTA por categoría comercial
    baseHerdEv = calculateBaseEV(categoria, baseWeight, baseHeadCount)
  }

  // EV por cabeza calibrado (ancla para escalar con cabezas dinámicas futuras)
  const evPerHead = baseHeadCount > 0 ? baseHerdEv / baseHeadCount : 0
  if (evPerHead === 0) return 0

  // ── Offset de meses desde HOY hasta monthStartDate ────────────────────────
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()       // 0-based
  const parts = monthStartDate.split('-')
  const tYear = parseInt(parts[0], 10)
  const tMonth = parseInt(parts[1], 10) - 1  // 0-based
  const monthOffset = (tYear - todayYear) * 12 + (tMonth - todayMonth)

  // ── Mes actual o pasado: EV del DB escalado con cabezas dinámicas ─────────
  if (monthOffset <= 0) {
    return parseFloat((evPerHead * headCountOverride).toFixed(2))
  }

  // ── Meses futuros: multiplicador relativo de crecimiento de peso ──────────
  const growthKgMonth = GROWTH_RATE_KG_MONTH[categoria] ?? 0
  const projectedWeight = Math.min(baseWeight + growthKgMonth * monthOffset, 600)

  // Multiplicador de peso relativo al mes 0 (preserva la escala de total_ev)
  const baseRef = Math.pow((baseWeight || 450) / 450, 0.75)
  const projRef = Math.pow(projectedWeight / 450, 0.75)
  const growthMultiplier = baseRef > 0 ? projRef / baseRef : 1

  let ev = evPerHead * headCountOverride * growthMultiplier

  // ── Multiplicador fenológico relativo para vacas cría ─────────────────────
  // Se aplica RELATIVO al mes 0 para no romper el total_ev como ancla.
  if (['VACAS', 'VAQUILLONAS'].includes(categoria)) {
    const factor0 = vacaFenologiaFactor(0, paritionSeason)
    const factorI = vacaFenologiaFactor(monthOffset, paritionSeason)
    if (factor0 > 0) ev *= (factorI / factor0)
  }

  return parseFloat(ev.toFixed(2))
}
