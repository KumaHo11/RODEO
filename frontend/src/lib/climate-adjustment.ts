/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RODEO — Ajuste Clima · Motor de cálculo v2 (Balance Hídrico)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  v2: Reemplaza multiplicadores simples por Balance Hídrico real.
 *  BH = P_efectiva − ET(T, Rs, V, H)
 *  C_adj = Cap_base × NDVI_trend × [1 + f_crecimiento(BH, T, Rs)]
 */

import { queryOne, query } from '@/lib/db'
import {
  getAustralSeason,
  SEASONAL_BASE_GROWTH,
  SEASONAL_TEMP_ESTIMATE,
} from '@/lib/grazing/forageCurves'

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface ClimateAdjustmentInput {
  paddockId: string
  areaHa: number
  currentForageMsHa: number
  currentNdvi: number
  previousNdvi?: number
  daysSincePreviousNdvi?: number

  totalEv: number
  dailyRationKgPerEv?: number

  /** Lluvia acumulada 7 días (API) */
  rainfall7dMm: number
  /** Lluvia manual del productor — sobrescribe la API si está definida */
  rainfallManualMm?: number
  humidityPct: number
  forecastRainfall14dMm: number
  droughtIndex: DroughtIndex
  avgWindKmh?: number

  /** NUEVO v2: temperatura media diaria (°C) */
  temperaturaC?: number
  /** NUEVO v2: radiación solar (MJ/m²/día) — Open-Meteo shortwave_radiation */
  radiacionSolar?: number
  /** NUEVO v2: días entre medición NDVI actual y anterior */
  ndviTrendDays?: number

  currentMonth?: number
  /** Latitud del campo — para estimar Rs si falta la API */
  latitudCampo?: number
}

export type DroughtIndex = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'

export interface ClimateAdjustmentResult {
  adjustedRemainingDays: number
  baseRemainingDays: number
  grassGrowthRateKgHaDay: number
  projectedForageMsHaAtExit: number
  /** C_adj — coeficiente de ajuste final (0.20–1.80) */
  climateMultiplier: number
  /** NUEVO v2: desglose del cálculo BH */
  waterBalance: WaterBalanceBreakdown
  /** Desglose de multiplicadores (compatibilidad con UI existente) */
  multiplierBreakdown: MultiplierBreakdown
  alertLevel: AlertLevel
  alertMessage: string | null
  deltaFromPlan: number
  /** NUEVO v2 */
  soilConditionCritical: boolean
  ndviTrend: 'rising' | 'falling' | 'stable' | 'unknown'
  dataSourceFlags: DataSourceFlags
  calculationDetails: string
  calculatedAt: string
}

export interface WaterBalanceBreakdown {
  precipitacionEfectivaMm: number
  etCalculadaMm: number
  balanceHidricoMm: number
  runoffFactor: number
  etAjustadaMm: number
}

export interface MultiplierBreakdown {
  ndviMultiplier: number
  rainfallMultiplier: number
  humidityMultiplier: number
  droughtMultiplier: number
  windMultiplier: number
  seasonalMultiplier: number
}

export interface DataSourceFlags {
  rainfallSource: 'user' | 'api' | 'assumed_zero'
  rsSource: 'api' | 'estimated_latitude'
  tempSource: 'api' | 'seasonal_estimate'
}

export type AlertLevel = 'ok' | 'warning' | 'critical'

export interface ClimateAdjustmentAccessResult {
  allowed: boolean
  reason?: 'unauthorized' | 'plan_insufficient' | 'feature_flag_disabled'
  planType?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// getAustralSeason, SEASONAL_BASE_GROWTH, SEASONAL_TEMP_ESTIMATE importados
// desde lib/grazing/forageCurves.ts (fuente de verdad canónica).

// ─── Constantes agronómicas (privadas de este módulo) ───────────────────────
const MIN_REMNANT_MS_HA   = 900
const DEFAULT_DAILY_RATION = 12
const HARVEST_EFFICIENCY   = 0.60

// ─── Evapotranspiración (Hargreaves simplificado) ────────────────────────────

/**
 * Calcula la ET diaria (mm) usando radiación solar, temperatura, humedad y viento.
 * α ≈ 0.0023 calibrado para Pampa Húmeda.
 */
export function calculateET(
  tempC: number,
  rsMjM2: number,
  humidityPct: number,
  windKmh: number,
): number {
  // Coeficiente base Hargreaves simplificado para 1 solo dato de temperatura
  const α = 0.0023
  // Humedad reduce ET (aire húmedo → menos evaporación)
  const humFactor  = 1 - (humidityPct / 200)  // 0.625 a 1.0 para H entre 0-75%
  // Viento acelera ET (fórmula Penman simplificada)
  const windFactor = 1 + (windKmh / 100)       // +1% por cada 10 km/h
  const et = α * rsMjM2 * (tempC + 17.8) * humFactor * windFactor
  return Math.max(0, Math.round(et * 100) / 100)
}

// ─── Estimación de Rs por latitud y día del año ──────────────────────────────

function estimateRsByLatitude(lat: number, dayOfYear: number): number {
  // Radiación extraterrestre simplificada (MJ/m²/día)
  const declinacion = 0.409 * Math.sin((2 * Math.PI * dayOfYear / 365) - 1.39)
  const latRad = (lat * Math.PI) / 180
  const ws = Math.acos(-Math.tan(latRad) * Math.tan(declinacion))
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear / 365)
  const Ra = (24 * 60 / Math.PI) * 0.0820 * dr * (
    ws * Math.sin(latRad) * Math.sin(declinacion)
    + Math.cos(latRad) * Math.cos(declinacion) * Math.sin(ws)
  )
  // Asume fracción de nubosidad media ~0.50 → Rs ≈ 0.50 * Ra
  return Math.max(5, Math.round(Ra * 0.50 * 10) / 10)
}

// ─── Balance Hídrico ─────────────────────────────────────────────────────────

/**
 * Calcula el Balance Hídrico con factor de escorrentía por NDVI.
 * Suelo desnudo (NDVI < 0.15) → runoff 80% + ET × 1.5 (evaporación directa).
 */
export function calculateWaterBalance(
  precipMm: number,
  etMm: number,
  ndvi: number,
): WaterBalanceBreakdown {
  let runoffFactor: number
  if      (ndvi >= 0.40) runoffFactor = 0.10
  else if (ndvi >= 0.20) runoffFactor = 0.35
  else if (ndvi >= 0.15) runoffFactor = 0.60
  else                   runoffFactor = 0.80  // Suelo desnudo

  const pEfectiva = precipMm * (1 - runoffFactor)

  // Suelo desnudo → mayor evaporación directa
  const etAjustada = ndvi < 0.15 ? etMm * 1.5 : etMm

  const bh = pEfectiva - etAjustada

  return {
    precipitacionEfectivaMm: Math.round(pEfectiva * 100) / 100,
    etCalculadaMm:           Math.round(etMm * 100) / 100,
    balanceHidricoMm:        Math.round(bh * 100) / 100,
    runoffFactor,
    etAjustadaMm:            Math.round(etAjustada * 100) / 100,
  }
}

// ─── Función de crecimiento forrajero ────────────────────────────────────────

function growthFactor(bh: number, tempC: number, rsMjM2: number): number {
  let f = 0

  // Balance hídrico
  if      (bh >= 20)  f += 0.40
  else if (bh >= 5)   f += 0.20
  else if (bh >= -5)  f += 0.00
  else if (bh >= -15) f -= 0.20
  else                f -= 0.45

  // Temperatura óptima de crecimiento (Pampa: 15–22°C)
  if (tempC >= 15 && tempC <= 22) f += 0.15
  else if (tempC < 5 || tempC > 38) f -= 0.25
  else if (tempC < 8 || tempC > 32) f -= 0.12

  // Radiación solar alta + balance positivo = más fotosíntesis
  if (rsMjM2 >= 20 && bh >= 0) f += 0.10

  return Math.max(-0.70, Math.min(0.80, f))
}

// ─── Tendencia NDVI ──────────────────────────────────────────────────────────

function ndviTrendMultiplier(
  currentNdvi: number,
  previousNdvi?: number,
  trendDays?: number,
): { multiplier: number; trend: 'rising' | 'falling' | 'stable' | 'unknown' } {
  if (previousNdvi === undefined) {
    // Sin medición anterior: solo valor puntual
    let m = 0.95
    if      (currentNdvi >= 0.75) m = 1.40
    else if (currentNdvi >= 0.60) m = 1.15
    else if (currentNdvi >= 0.45) m = 0.95
    else if (currentNdvi >= 0.30) m = 0.70
    else                          m = 0.45
    return { multiplier: m, trend: 'unknown' }
  }

  const delta = currentNdvi - previousNdvi
  const days  = trendDays ?? 5

  // Base por valor puntual
  let m = 0.95
  if      (currentNdvi >= 0.75) m = 1.40
  else if (currentNdvi >= 0.60) m = 1.15
  else if (currentNdvi >= 0.45) m = 0.95
  else if (currentNdvi >= 0.30) m = 0.70
  else                          m = 0.45

  // Ajuste por tendencia (normalizado a 5 días)
  const deltaPerPeriod = delta * (5 / days)
  if      (deltaPerPeriod >  0.05) m += 0.15
  else if (deltaPerPeriod >  0.02) m += 0.07
  else if (deltaPerPeriod < -0.05) m -= 0.18
  else if (deltaPerPeriod < -0.02) m -= 0.09

  const trend: 'rising' | 'falling' | 'stable' = 
    Math.abs(deltaPerPeriod) < 0.015 ? 'stable' :
    deltaPerPeriod > 0 ? 'rising' : 'falling'

  return { multiplier: Math.max(0.30, Math.min(1.60, m)), trend }
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

export function calculateClimateAdjustment(
  input: ClimateAdjustmentInput,
  originalPlannedDays: number,
): ClimateAdjustmentResult {
  const month   = input.currentMonth ?? new Date().getMonth() + 1
  const season  = getAustralSeason(month)
  const baseGrowth    = SEASONAL_BASE_GROWTH[season]
  const dailyRation   = input.dailyRationKgPerEv ?? DEFAULT_DAILY_RATION

  // ── Determinar fuentes de datos ─────────────────────────────────────────
  const dataSourceFlags: DataSourceFlags = {
    rainfallSource: input.rainfallManualMm !== undefined ? 'user'
      : input.rainfall7dMm > 0 ? 'api' : 'assumed_zero',
    rsSource:   input.radiacionSolar !== undefined ? 'api' : 'estimated_latitude',
    tempSource: input.temperaturaC   !== undefined ? 'api' : 'seasonal_estimate',
  }

  const precipMm = input.rainfallManualMm !== undefined
    ? input.rainfallManualMm
    : (input.rainfall7dMm ?? 0)

  const tempC = input.temperaturaC ?? SEASONAL_TEMP_ESTIMATE[season]

  const dayOfYear = Math.round(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  const rsMjM2 = input.radiacionSolar !== undefined
    ? input.radiacionSolar
    : estimateRsByLatitude(input.latitudCampo ?? -34, dayOfYear) // default lat: Buenos Aires

  const humidity = input.humidityPct ?? 65
  const wind     = input.avgWindKmh  ?? 15

  // ── 1. Evapotranspiración y Balance Hídrico ─────────────────────────────
  const et = calculateET(tempC, rsMjM2, humidity, wind)
  const wb = calculateWaterBalance(precipMm, et, input.currentNdvi)

  // ── 2. NDVI trend multiplier ────────────────────────────────────────────
  const { multiplier: ndviMult, trend: ndviTrend } = ndviTrendMultiplier(
    input.currentNdvi,
    input.previousNdvi,
    input.ndviTrendDays ?? input.daysSincePreviousNdvi,
  )

  // ── 3. Limitador de suelo crítico (NDVI < 0.15) ─────────────────────────
  const soilConditionCritical = input.currentNdvi < 0.15

  // ── 4. Factor de crecimiento ────────────────────────────────────────────
  let fGrowth = growthFactor(wb.balanceHidricoMm, tempC, rsMjM2)
  if (soilConditionCritical) fGrowth = Math.min(0, fGrowth) // Sin crecimiento positivo

  // ── 5. C_adj ────────────────────────────────────────────────────────────
  let rawCAdj = ndviMult * (1 + fGrowth)
  if (soilConditionCritical) rawCAdj = Math.min(rawCAdj, 0.35) // Penalización severa

  const climateMultiplier = Math.max(0.20, Math.min(1.80, rawCAdj))

  // ── 6. Tasa de crecimiento del pasto (kg MS/ha/día) ─────────────────────
  const grassGrowthRate = baseGrowth * climateMultiplier

  // ── 7. Días restantes ───────────────────────────────────────────────────
  const availableMs       = Math.max(0, input.currentForageMsHa - MIN_REMNANT_MS_HA)
  const totalAvailableMs  = availableMs * input.areaHa * HARVEST_EFFICIENCY
  const dailyDemandKg     = input.totalEv * dailyRation

  const baseRemainingDays = dailyDemandKg > 0
    ? Math.max(0, Math.round(totalAvailableMs / dailyDemandKg))
    : 0

  const netDailyChangeMsHa = grassGrowthRate - (dailyRation * input.totalEv / input.areaHa)

  let adjustedRemainingDays: number
  let projectedForageMsHaAtExit: number

  if (netDailyChangeMsHa >= 0) {
    adjustedRemainingDays = Math.min(60, baseRemainingDays + Math.round(grassGrowthRate * 5))
    projectedForageMsHaAtExit = input.currentForageMsHa + netDailyChangeMsHa * adjustedRemainingDays
  } else {
    const daysUntilMin = availableMs > 0
      ? availableMs / Math.abs(netDailyChangeMsHa)
      : 0
    adjustedRemainingDays = Math.max(0, Math.round(daysUntilMin))
    projectedForageMsHaAtExit = Math.max(
      MIN_REMNANT_MS_HA,
      input.currentForageMsHa + netDailyChangeMsHa * adjustedRemainingDays
    )
  }

  // ── 8. Alerta ───────────────────────────────────────────────────────────
  const deltaFromPlan = adjustedRemainingDays - originalPlannedDays
  let alertLevel: AlertLevel
  let alertMessage: string | null = null

  if (adjustedRemainingDays <= 3) {
    alertLevel = 'critical'
    alertMessage = `El ajuste climático sugiere que quedan aproximadamente ${adjustedRemainingDays} día${adjustedRemainingDays !== 1 ? 's' : ''} de estadía disponible. Te recomendamos revisar si conviene anticipar el movimiento del rodeo en los próximos días.`
  } else if (soilConditionCritical) {
    alertLevel = 'critical'
    alertMessage = `El satélite detecta cobertura vegetal muy baja en este potrero (NDVI ${input.currentNdvi.toFixed(2)}). El rebrote puede ser más lento de lo habitual. Revisá la planificación si tenías previsto un descanso corto.`
  } else if (adjustedRemainingDays <= 7 || deltaFromPlan <= -5) {
    alertLevel = 'warning'
    const bhInfo = wb.balanceHidricoMm < 0
      ? `El balance hídrico muestra un déficit de ${Math.abs(wb.balanceHidricoMm).toFixed(0)} mm en los últimos días.`
      : ''
    alertMessage = `En base a las condiciones climáticas actuales, la estadía en este potrero podría ajustarse a ${adjustedRemainingDays} días (${Math.abs(deltaFromPlan)}d menos de lo planificado). ${bhInfo} Es un buen momento para revisar el plan.`.trim()
  } else if (deltaFromPlan >= 5 && wb.balanceHidricoMm > 10) {
    alertLevel = 'ok'
    alertMessage = `Las condiciones climáticas son favorables (balance hídrico ${wb.balanceHidricoMm.toFixed(0)} mm). La estadía planificada podría extenderse hasta ${deltaFromPlan} días adicionales si el pasto lo permite.`
  } else {
    alertLevel = 'ok'
  }

  // ── 9. Desglose compatibilidad UI ──────────────────────────────────────
  // Mantener multiplierBreakdown para el ClimateAdjustmentPanel existente
  const multiplierBreakdown: MultiplierBreakdown = {
    ndviMultiplier:      Math.round(ndviMult * 100) / 100,
    rainfallMultiplier:  wb.precipitacionEfectivaMm > 0 ? Math.round(Math.min(1.5, wb.precipitacionEfectivaMm / 15) * 100) / 100 : 0.55,
    humidityMultiplier:  humidity >= 75 ? 1.15 : humidity >= 55 ? 1.00 : humidity >= 35 ? 0.85 : 0.75,
    droughtMultiplier:   input.droughtIndex === 'SEVERE' ? 0.30 : input.droughtIndex === 'MODERATE' ? 0.58 : input.droughtIndex === 'MILD' ? 0.80 : 1.00,
    windMultiplier:      wind >= 40 ? 0.85 : wind >= 25 ? 0.92 : 1.00,
    seasonalMultiplier:  season === 'PRIMAVERA' ? 1.30 : season === 'VERANO' ? 1.05 : season === 'OTONO' ? 0.70 : 0.25,
  }

  // ── 10. Detalle de trazabilidad ─────────────────────────────────────────
  const calculationDetails = [
    `Estación: ${season} | Base: ${baseGrowth} kg MS/ha/día`,
    `Temp: ${tempC}°C (${dataSourceFlags.tempSource}) | Rs: ${rsMjM2} MJ/m² (${dataSourceFlags.rsSource})`,
    `Lluvia: ${precipMm} mm (${dataSourceFlags.rainfallSource}) | Humedad: ${humidity}% | Viento: ${wind} km/h`,
    `ET: ${wb.etCalculadaMm} mm | P_efectiva: ${wb.precipitacionEfectivaMm} mm (runoff ${(wb.runoffFactor*100).toFixed(0)}%) | BH: ${wb.balanceHidricoMm} mm`,
    `NDVI: ${input.currentNdvi} (tendencia: ${ndviTrend}) | NDVI mult: ×${ndviMult.toFixed(3)}`,
    `f_crecimiento: ${fGrowth.toFixed(3)} | C_adj: ×${climateMultiplier.toFixed(3)}${soilConditionCritical ? ' ⚠ SUELO CRÍTICO' : ''}`,
    `Base: ${baseRemainingDays}d → Ajustado: ${adjustedRemainingDays}d (Δ ${deltaFromPlan >= 0 ? '+' : ''}${deltaFromPlan}d)`,
  ].join('\n')

  return {
    adjustedRemainingDays,
    baseRemainingDays,
    grassGrowthRateKgHaDay: Math.round(grassGrowthRate * 10) / 10,
    projectedForageMsHaAtExit: Math.round(projectedForageMsHaAtExit),
    climateMultiplier: Math.round(climateMultiplier * 1000) / 1000,
    waterBalance: wb,
    multiplierBreakdown,
    alertLevel,
    alertMessage,
    deltaFromPlan,
    soilConditionCritical,
    ndviTrend,
    dataSourceFlags,
    calculationDetails,
    calculatedAt: new Date().toISOString(),
  }
}

// ─── Validación de acceso (plan + feature flag) ──────────────────────────────

export async function validateClimateAdjustmentAccess(
  firebaseUid: string
): Promise<ClimateAdjustmentAccessResult> {
  const profile = await queryOne<{ organization_id: string; plan_slug: string | null }>(`
    SELECT p.organization_id, sp.slug AS plan_slug
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
    WHERE p.firebase_uid = $1
  `, [firebaseUid])

  if (!profile) return { allowed: false, reason: 'unauthorized' }

  const SLUG_TO_TIER: Record<string, number> = {
    brote: 1, campo_libre: 1,
    planificador: 2, pro_ganadero: 2,
    'pro_ganadero+': 3, holistico: 3,
    latifundio: 4, enterprise: 4,
  }
  const slug = profile.plan_slug?.toLowerCase() ?? 'brote'
  if ((SLUG_TO_TIER[slug] ?? 1) < 2) {
    return { allowed: false, reason: 'plan_insufficient', planType: slug }
  }

  const flags = await query<{ flag_value: unknown }>(`
    SELECT flag_value FROM system_feature_flags WHERE flag_key = 'climate_adjustment' LIMIT 1
  `, []).catch(() => [] as any[])

  if (flags.length > 0 && (flags[0].flag_value === false || flags[0].flag_value === 'false')) {
    return { allowed: false, reason: 'feature_flag_disabled' }
  }

  return { allowed: true, planType: slug }
}
