/**
 * forageCurves.ts — Curvas de crecimiento forrajero para Hemisferio Sur
 * ─────────────────────────────────────────────────────────────────────
 * Tasa de crecimiento (kg MS/ha/día) por mes, ajustada por precipitación.
 * Fuente: INTA Balcarce / Ovis 21 / García Stepien para zona pampeana.
 *
 * También exporta la lógica estacional canónica (getAustralSeason,
 * SEASONAL_BASE_GROWTH) que anteriormente estaba duplicada en:
 *  - lib/climate-adjustment.ts
 *  - app/dashboard/calculadora/calculatorEngine.ts
 *  - components/GanttClimateMonthRow.tsx
 */

// ─── Estaciones Hemisferio Sur ───────────────────────────────────────────────

/** Tipo de estación del hemisferio sur */
export type AustralSeason = 'VERANO' | 'OTONO' | 'INVIERNO' | 'PRIMAVERA'

/**
 * Retorna la estación del hemisferio sur para un mes dado (1=Enero, 12=Dic).
 * @param month  Número de mes 1-based (1=Enero … 12=Diciembre)
 */
export function getAustralSeason(month: number): AustralSeason {
  if (month >= 12 || month <= 2) return 'VERANO'
  if (month >= 3 && month <= 5)  return 'OTONO'
  if (month >= 6 && month <= 8)  return 'INVIERNO'
  return 'PRIMAVERA'
}

/**
 * Tasa base de crecimiento kg MS/ha/día por estación (Pampa Húmeda).
 * Fuente: INTA Balcarce / Ovis 21.
 */
export const SEASONAL_BASE_GROWTH: Record<AustralSeason, number> = {
  VERANO:    32,
  OTONO:     18,
  INVIERNO:   8,
  PRIMAVERA: 38,
}

/**
 * Temperatura media de referencia por estación para cálculos de ET.
 * Calibrado para Pampa Húmeda.
 */
export const SEASONAL_TEMP_ESTIMATE: Record<AustralSeason, number> = {
  VERANO: 26, OTONO: 15, INVIERNO: 8, PRIMAVERA: 18,
}


/** Tasa base de crecimiento en kg MS/ha/día por mes del año (0=Enero … 11=Dic) */
export const BASE_GROWTH_RATE_KG_HA_DAY: number[] = [
  22,  // Enero   — Verano
  20,  // Febrero — Verano
  14,  // Marzo   — Otoño temprano
  9,   // Abril   — Otoño
  5,   // Mayo    — Otoño tardío
  2,   // Junio   — Invierno
  2,   // Julio   — Invierno
  3,   // Agosto  — Invierno tardío
  12,  // Sep     — Primavera temprana
  28,  // Oct     — Primavera plena
  32,  // Nov     — Primavera tardía
  25,  // Dic     — Verano temprano
]

/** Eficiencia de cosecha según sistema de pastoreo */
export type HarvestEfficiency = 'extensivo' | 'intensivo' | 'holístico'

export const HARVEST_EFFICIENCY: Record<HarvestEfficiency, number> = {
  extensivo: 0.35,   // 35% — pastoreo continuo
  holístico: 0.50,   // 50% — rotativo con regla del remanente
  intensivo: 0.65,   // 65% — pastoreo de 1 día alta densidad
}

/**
 * Ajusta la tasa de crecimiento mensual por precipitación.
 *
 * @param baseRate  Tasa base en kg MS/ha/día
 * @param rainMm    Precipitación mensual en mm (0 si no hay dato)
 * @returns Tasa ajustada
 */
export function adjustedGrowthRate(baseRate: number, rainMm: number | null): number {
  if (rainMm === null) return baseRate  // Sin dato: usamos base
  if (rainMm >= 80)   return baseRate * 1.15   // Lluvia abundante: +15%
  if (rainMm >= 50)   return baseRate           // Normal
  if (rainMm >= 25)   return baseRate * 0.75   // Seco: -25%
  return baseRate * 0.50                         // Muy seco: -50%
}

/**
 * Oferta forrajera proyectada para un potrero durante N días.
 *
 * Combina:
 *  1. Biomasa existente (stock inicial)
 *  2. Crecimiento diario según estación y lluvia
 *  3. Eficiencia de cosecha (regla del remanente)
 */
export function paddockForageOffer(params: {
  initialMsKgHa: number       // Biomasa actual del potrero (kg MS/ha)
  areaHa: number              // Superficie del potrero
  startMonthIndex: number     // Mes de inicio (0=Enero)
  durationDays: number        // Días del período a proyectar
  rainByMonth?: Record<string, number>  // YYYY-MM → mm
  efficiency?: HarvestEfficiency // Retained for backwards compatibility if needed
  targetRemnantKgHa?: number  // Holisitc absolute remnant approach
  startYear?: number
}): {
  usableKgMs: number          // MS aprovechable durante el período
  growthKgMs: number          // MS generada por crecimiento
  stockKgMs: number           // MS del stock inicial
  totalKgMs: number           // Total disponible (stock + crecimiento)
} {
  const {
    initialMsKgHa, areaHa, startMonthIndex,
    durationDays, rainByMonth = {}, efficiency, targetRemnantKgHa, startYear,
  } = params

  const year = startYear ?? new Date().getFullYear()
  let growthKgMs = 0

  for (let d = 0; d < durationDays; d++) {
    const date = new Date(year, startMonthIndex, 1 + d)
    const m = date.getMonth()
    const key = `${date.getFullYear()}-${String(m + 1).padStart(2, '0')}`
    const rain = rainByMonth[key] ?? null
    const dailyRate = adjustedGrowthRate(BASE_GROWTH_RATE_KG_HA_DAY[m], rain)
    growthKgMs += dailyRate * areaHa
  }

  const stockKgMs = initialMsKgHa * areaHa
  const totalKgMs = stockKgMs + growthKgMs
  
  let usableKgMs = 0
  if (targetRemnantKgHa !== undefined) {
    usableKgMs = Math.max(0, totalKgMs - (targetRemnantKgHa * areaHa))
  } else if (efficiency) {
    usableKgMs = totalKgMs * HARVEST_EFFICIENCY[efficiency]
  } else {
    usableKgMs = totalKgMs * 0.5 // Default to 50% if neither is provided
  }

  return {
    usableKgMs: parseFloat(usableKgMs.toFixed(0)),
    growthKgMs: parseFloat(growthKgMs.toFixed(0)),
    stockKgMs:  parseFloat(stockKgMs.toFixed(0)),
    totalKgMs:  parseFloat(totalKgMs.toFixed(0)),
  }
}

/**
 * Central function to calculate Usable Forage (Stock Aprovechable)
 * Static photograph of current availability (Initial MS - Remnant) * Area
 */
export function calculateUsableForage(
  initialMsKgHa: number,
  targetRemnantKgHa: number,
  areaHa: number
): number {
  const availablePerHa = Math.max(0, initialMsKgHa - targetRemnantKgHa);
  return availablePerHa * areaHa;
}

/**
 * Central function to calculate Grazing Days (DAH/Days of stay)
 * Formula: Usable Forage (kg) / Daily Demand (kg/day)
 */
export function calculateGrazingDays(
  usableKgMs: number,
  dailyDemandKg: number
): number {
  if (dailyDemandKg <= 0 || usableKgMs <= 0) return 0;
  return Math.floor(usableKgMs / dailyDemandKg);
}

