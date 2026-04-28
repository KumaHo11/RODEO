/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RODEO — Ajuste Clima · Motor de cálculo principal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Calcula los días de estadía restantes para un rodeo en un potrero,
 *  ajustados dinámicamente en función del clima (lluvia, humedad, sequía)
 *  cruzado con el NDVI satelital.
 *
 *  Requisitos de negocio:
 *    - Exclusivo para planes PLANIFICADOR · HOLÍSTICO · LATIFUNDIO
 *    - Administrable mediante feature flag "climate_adjustment" en Super Admin
 *    - Las alertas se integran con el sistema de notificaciones existente
 *
 *  Referencia agronómica (Pampas / zona templada húmeda):
 *    • Base de crecimiento: 25–40 kg MS/ha/día en condiciones óptimas (primavera)
 *    • NDVI 0.7–0.8 → pasto en buen estado → crecimiento base
 *    • Lluvia ≥ 25 mm / semana → aceleración del rebrote
 *    • Déficit hídrico > 30 días → reducción severa
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { queryOne, query } from '@/lib/db'

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface ClimateAdjustmentInput {
  /** ID del potrero (UUID) */
  paddockId: string
  /** Área del potrero en hectáreas */
  areaHa: number
  /** Forraje declarado por el usuario en kg MS/ha (0 si no tiene) */
  currentForageMsHa: number
  /** NDVI actual obtenido del satélite (0–1, típicamente 0.2–0.85) */
  currentNdvi: number
  /** NDVI del período anterior (para calcular tendencia) */
  previousNdvi?: number
  /** Días transcurridos desde la medición anterior de NDVI */
  daysSincePreviousNdvi?: number

  // ── Carga animal ──────────────────────────────────────────────────────────
  /** Total de Equivalentes Vaca (EV) del rodeo en este potrero */
  totalEv: number
  /** Ración diaria en kg MS por EV/día (default: 12 kg) */
  dailyRationKgPerEv?: number

  // ── Clima regional (API Open-Meteo / fuente externa) ─────────────────────
  /** Lluvia acumulada en los últimos 7 días (mm) */
  rainfall7dMm: number
  /** Lluvia declarada por el productor (pluviómetro manual, mm) */
  rainfallManualMm?: number
  /** Humedad relativa promedio (%) */
  humidityPct: number
  /** Precipitaciones proyectadas para los próximos 14 días (mm) */
  forecastRainfall14dMm: number
  /** Índice de sequía: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE' */
  droughtIndex: DroughtIndex
  /** Velocidad del viento promedio (km/h) — afecta evapotranspiración */
  avgWindKmh?: number

  // ── Contexto estacional ───────────────────────────────────────────────────
  /** Mes del año (1-12) para determinar estación austral */
  currentMonth?: number
}

export type DroughtIndex = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'

export interface ClimateAdjustmentResult {
  /** Días de estadía restantes ajustados por clima */
  adjustedRemainingDays: number
  /** Días de estadía base (sin ajuste climático) */
  baseRemainingDays: number
  /** Tasa de crecimiento actual del pasto (kg MS/ha/día) */
  grassGrowthRateKgHaDay: number
  /** Pasto disponible proyectado al final del período (kg MS/ha) */
  projectedForageMsHaAtExit: number
  /** Multiplicador climático compuesto (0.2–1.8) */
  climateMultiplier: number
  /** Desglose de multiplicadores individuales */
  multiplierBreakdown: MultiplierBreakdown
  /** Estado de alerta: 'ok' | 'warning' | 'critical' */
  alertLevel: AlertLevel
  /** Mensaje de alerta para el usuario (en español) */
  alertMessage: string | null
  /** Cambio en días respecto a la planificación original */
  deltaFromPlan: number
  /** Detalles del cálculo para trazabilidad */
  calculationDetails: string
  /** Timestamp del cálculo */
  calculatedAt: string
}

export interface MultiplierBreakdown {
  ndviMultiplier: number
  rainfallMultiplier: number
  humidityMultiplier: number
  droughtMultiplier: number
  windMultiplier: number
  seasonalMultiplier: number
}

export type AlertLevel = 'ok' | 'warning' | 'critical'

// ─── Resultado de validación ─────────────────────────────────────────────────

export interface ClimateAdjustmentAccessResult {
  allowed: boolean
  reason?: 'unauthorized' | 'plan_insufficient' | 'feature_flag_disabled'
  planType?: string
}

// ─── Constantes agronómicas ──────────────────────────────────────────────────

/** kg MS/ha/día base en condiciones óptimas por estación (hemisferio sur) */
const SEASONAL_BASE_GROWTH: Record<string, number> = {
  VERANO:    32,  // dic-feb: calor y agua = crecimiento alto
  OTONO:     18,  // mar-may: temperatura bajando
  INVIERNO:   8,  // jun-ago: mínimo crecimiento
  PRIMAVERA: 38,  // sep-nov: peak de crecimiento
}

/** Remanente mínimo post-pastoreo (kg MS/ha) — para no degradar el suelo */
const MIN_REMNANT_MS_HA = 900

/** Ración diaria base (kg MS/EV/día) */
const DEFAULT_DAILY_RATION = 12

/** Porcentaje de aprovechamiento efectivo (60% = pastoreo racional) */
const HARVEST_EFFICIENCY = 0.60

// ─── Helper: Determinar estación austral ────────────────────────────────────

function getAustralSeason(month: number): keyof typeof SEASONAL_BASE_GROWTH {
  if (month >= 12 || month <= 2) return 'VERANO'
  if (month >= 3 && month <= 5)  return 'OTONO'
  if (month >= 6 && month <= 8)  return 'INVIERNO'
  return 'PRIMAVERA'
}

// ─── Multiplicadores individuales ────────────────────────────────────────────

/** NDVI → multiplicador de disponibilidad forrajera (0.4–1.5) */
function ndviMultiplier(ndvi: number, previousNdvi?: number): number {
  // Valor base por NDVI actual
  let m: number
  if      (ndvi >= 0.75) m = 1.4
  else if (ndvi >= 0.60) m = 1.15
  else if (ndvi >= 0.45) m = 0.95
  else if (ndvi >= 0.30) m = 0.70
  else                   m = 0.45

  // Ajuste por tendencia (si NDVI está subiendo o bajando)
  if (previousNdvi !== undefined) {
    const trend = ndvi - previousNdvi
    if (trend > 0.05)       m += 0.10  // NDVI en fuerte recuperación
    else if (trend > 0.02)  m += 0.05  // NDVI en leve recuperación
    else if (trend < -0.05) m -= 0.12  // NDVI en caída fuerte (estrés hídrico/pastoreo excesivo)
    else if (trend < -0.02) m -= 0.06  // NDVI en leve caída
  }

  return Math.max(0.30, Math.min(1.60, m))
}

/** Lluvia (7 días + pronóstico 14 días) → multiplicador (0.5–1.5) */
function rainfallMultiplier(rainfall7d: number, forecast14d: number, manualMm?: number): number {
  // Usar pluviómetro manual si está disponible (más confiable)
  const effectiveRain7d = manualMm !== undefined ? manualMm : rainfall7d
  const weeklyEquivalent = effectiveRain7d + (forecast14d / 2) // Promediar lluvia futura

  if      (weeklyEquivalent >= 60) return 1.50   // Lluvia muy abundante
  else if (weeklyEquivalent >= 35) return 1.25   // Lluvia normal-buena
  else if (weeklyEquivalent >= 15) return 1.00   // Lluvia mínima adecuada
  else if (weeklyEquivalent >= 5)  return 0.80   // Lluvia insuficiente
  else                             return 0.55   // Sin lluvia (sequía activa)
}

/** Humedad relativa → multiplicador (0.75–1.20) */
function humidityMultiplier(humidityPct: number): number {
  if      (humidityPct >= 75) return 1.15
  else if (humidityPct >= 55) return 1.00
  else if (humidityPct >= 35) return 0.85
  else                        return 0.75
}

/** Índice de sequía → multiplicador (0.30–1.00) */
function droughtMultiplier(index: DroughtIndex): number {
  switch (index) {
    case 'NONE':     return 1.00
    case 'MILD':     return 0.80
    case 'MODERATE': return 0.58
    case 'SEVERE':   return 0.30
  }
}

/** Viento → penalización por evapotranspiración (0.85–1.00) */
function windMultiplier(avgWindKmh?: number): number {
  if (avgWindKmh === undefined) return 1.00
  if (avgWindKmh >= 40) return 0.85   // Viento fuerte → pierde mucha humedad
  if (avgWindKmh >= 25) return 0.92
  return 1.00
}

/** Factor estacional (0.25–1.30) */
function seasonalMultiplier(month: number): number {
  const season = getAustralSeason(month)
  const factors: Record<string, number> = {
    PRIMAVERA: 1.30,
    VERANO:    1.05,
    OTONO:     0.70,
    INVIERNO:  0.25,
  }
  return factors[season] ?? 1.00
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

/**
 * calculateClimateAdjustment
 *
 * Calcula los días de estadía restantes ajustados por clima para un potrero.
 * Integra: NDVI × lluvia × humedad × sequía × viento × estación.
 *
 * @param input - Datos del potrero, rodeo y clima
 * @param originalPlannedDays - Días planificados originalmente (base para deltaFromPlan)
 * @returns ClimateAdjustmentResult con días ajustados y breakdown de multiplicadores
 */
export function calculateClimateAdjustment(
  input: ClimateAdjustmentInput,
  originalPlannedDays: number
): ClimateAdjustmentResult {
  const month = input.currentMonth ?? new Date().getMonth() + 1
  const season = getAustralSeason(month)
  const baseGrowth = SEASONAL_BASE_GROWTH[season]
  const dailyRation = input.dailyRationKgPerEv ?? DEFAULT_DAILY_RATION

  // ── 1. Calcular multiplicador compuesto ──────────────────────────────────
  const mNdvi     = ndviMultiplier(input.currentNdvi, input.previousNdvi)
  const mRain     = rainfallMultiplier(input.rainfall7dMm, input.forecastRainfall14dMm, input.rainfallManualMm)
  const mHumidity = humidityMultiplier(input.humidityPct)
  const mDrought  = droughtMultiplier(input.droughtIndex)
  const mWind     = windMultiplier(input.avgWindKmh)
  const mSeason   = seasonalMultiplier(month)

  // Peso relativo de cada multiplicador (suma = 1)
  // NDVI y lluvia pesan más (información real del campo)
  const compositeMultiplier =
    (mNdvi     * 0.30) +
    (mRain     * 0.25) +
    (mDrought  * 0.20) +
    (mHumidity * 0.10) +
    (mWind     * 0.05) +
    (mSeason   * 0.10)

  const climateMultiplier = Math.max(0.20, Math.min(1.80, compositeMultiplier))

  // ── 2. Tasa de crecimiento ajustada (kg MS/ha/día) ───────────────────────
  const grassGrowthRate = baseGrowth * climateMultiplier

  // ── 3. Calcular días restantes ───────────────────────────────────────────
  const availableMs  = Math.max(0, input.currentForageMsHa - MIN_REMNANT_MS_HA)
  const totalAvailableMs = availableMs * input.areaHa * HARVEST_EFFICIENCY
  const dailyDemandKg = input.totalEv * dailyRation

  // Días base (sólo con forraje actual, sin crecimiento)
  const baseRemainingDays = dailyDemandKg > 0
    ? Math.max(0, Math.round(totalAvailableMs / dailyDemandKg))
    : 0

  // Días ajustados: consideramos el crecimiento del pasto durante el período
  // Resolvemos la ecuación iterativa:
  //   forrage(t) = currentMs + growthRate * t - dailyDemand/ha * t
  //   forrage(t) >= MIN_REMNANT
  const netDailyChangeMsHa = grassGrowthRate - (dailyRation * input.totalEv / input.areaHa)

  let adjustedRemainingDays: number
  let projectedForageMsHaAtExit: number

  if (netDailyChangeMsHa >= 0) {
    // Pasto crece más de lo que se consume → estadía ilimitada en teoría
    // Limitamos a un máximo razonable de 60 días
    adjustedRemainingDays = Math.min(60, baseRemainingDays + Math.round(grassGrowthRate * 5))
    projectedForageMsHaAtExit = input.currentForageMsHa + netDailyChangeMsHa * adjustedRemainingDays
  } else {
    // Consumo supera al crecimiento → calcular cuántos días hasta llegar al remanente mínimo
    // Ms(t) = currentMs + netDailyChangeMsHa * t  ≥  MIN_REMNANT_MS_HA
    // t ≤ (currentMs - MIN_REMNANT_MS_HA) / abs(netDailyChangeMsHa)
    const daysUntilMinRemnant = availableMs > 0
      ? (availableMs) / Math.abs(netDailyChangeMsHa)
      : 0
    adjustedRemainingDays = Math.max(0, Math.round(daysUntilMinRemnant))
    projectedForageMsHaAtExit = Math.max(MIN_REMNANT_MS_HA,
      input.currentForageMsHa + netDailyChangeMsHa * adjustedRemainingDays)
  }

  // ── 4. Determinar nivel de alerta ────────────────────────────────────────
  const deltaFromPlan = adjustedRemainingDays - originalPlannedDays
  let alertLevel: AlertLevel
  let alertMessage: string | null = null

  if (adjustedRemainingDays <= 3) {
    alertLevel = 'critical'
    alertMessage = `⛔ Sobrepastoreo inminente: quedan solo ${adjustedRemainingDays} día${adjustedRemainingDays !== 1 ? 's' : ''} de estadía. Mover el rodeo inmediatamente.`
  } else if (adjustedRemainingDays <= 7 || deltaFromPlan <= -5) {
    alertLevel = 'warning'
    if (input.droughtIndex !== 'NONE') {
      alertMessage = `⚠️ Sequía (${input.droughtIndex.toLowerCase()}) reduciendo el rebrote. Estadía ajustada a ${adjustedRemainingDays} días (${Math.abs(deltaFromPlan)} menos que lo planificado). Evaluá movimiento anticipado.`
    } else {
      alertMessage = `⚠️ Condiciones climáticas adversas reducen la estadía a ${adjustedRemainingDays} días. Se recomienda movimiento en ${Math.max(1, adjustedRemainingDays - 2)} días.`
    }
  } else if (deltaFromPlan >= 5 && input.rainfall7dMm >= 30) {
    alertLevel = 'ok'
    alertMessage = `🌱 Buenas lluvias (${input.rainfall7dMm} mm). La estadía puede extenderse ${deltaFromPlan} días más. Ajustá la planificación.`
  } else {
    alertLevel = 'ok'
  }

  // ── 5. Texto de trazabilidad ─────────────────────────────────────────────
  const calculationDetails = [
    `Estación: ${season} | Base crecimiento: ${baseGrowth} kg MS/ha/día`,
    `Multiplicadores → NDVI:×${mNdvi.toFixed(2)} | Lluvia:×${mRain.toFixed(2)} | Humedad:×${mHumidity.toFixed(2)} | Sequía:×${mDrought.toFixed(2)} | Viento:×${mWind.toFixed(2)} | Estación:×${mSeason.toFixed(2)}`,
    `Compuesto: ×${climateMultiplier.toFixed(3)} → Crecimiento ajustado: ${grassGrowthRate.toFixed(1)} kg MS/ha/día`,
    `EV: ${input.totalEv} | Ración: ${dailyRation} kg | Demanda: ${(dailyDemandKg).toFixed(0)} kg/día`,
    `MS disponible: ${availableMs.toFixed(0)} kg/ha × ${input.areaHa} ha × ${HARVEST_EFFICIENCY * 100}% = ${totalAvailableMs.toFixed(0)} kg`,
    `Base: ${baseRemainingDays}d → Ajustado: ${adjustedRemainingDays}d (Δ ${deltaFromPlan >= 0 ? '+' : ''}${deltaFromPlan}d)`,
  ].join('\n')

  return {
    adjustedRemainingDays,
    baseRemainingDays,
    grassGrowthRateKgHaDay: Math.round(grassGrowthRate * 10) / 10,
    projectedForageMsHaAtExit: Math.round(projectedForageMsHaAtExit),
    climateMultiplier: Math.round(climateMultiplier * 1000) / 1000,
    multiplierBreakdown: {
      ndviMultiplier: Math.round(mNdvi * 100) / 100,
      rainfallMultiplier: Math.round(mRain * 100) / 100,
      humidityMultiplier: Math.round(mHumidity * 100) / 100,
      droughtMultiplier: Math.round(mDrought * 100) / 100,
      windMultiplier: Math.round(mWind * 100) / 100,
      seasonalMultiplier: Math.round(mSeason * 100) / 100,
    },
    alertLevel,
    alertMessage,
    deltaFromPlan,
    calculationDetails,
    calculatedAt: new Date().toISOString(),
  }
}

// ─── Validación de acceso (plan + feature flag) ──────────────────────────────

/**
 * validateClimateAdjustmentAccess
 *
 * Verifica que el usuario tenga:
 *  1. Plan suficiente (PLANIFICADOR, HOLÍSTICO o LATIFUNDIO)
 *  2. Feature flag "climate_adjustment" habilitado en Super Admin
 *
 * Esta función se llama desde las rutas API antes de ejecutar el cálculo pesado.
 */
export async function validateClimateAdjustmentAccess(
  firebaseUid: string
): Promise<ClimateAdjustmentAccessResult> {
  // 1. Obtener plan del usuario
  const profile = await queryOne<{
    organization_id: string
    plan_slug: string | null
  }>(`
    SELECT p.organization_id, sp.slug AS plan_slug
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
    WHERE p.firebase_uid = $1
  `, [firebaseUid])

  if (!profile) {
    return { allowed: false, reason: 'unauthorized' }
  }

  const SLUG_TO_TIER: Record<string, number> = {
    'brote':          1,
    'campo_libre':    1,
    'planificador':   2,
    'pro_ganadero':   2,
    'pro_ganadero+':  3,
    'holistico':      3,
    'latifundio':     4,
    'enterprise':     4,
  }

  const slug = profile.plan_slug?.toLowerCase() ?? 'brote'
  const tier = SLUG_TO_TIER[slug] ?? 1

  // Planes requeridos: PLANIFICADOR (2) o superior
  if (tier < 2) {
    return {
      allowed: false,
      reason: 'plan_insufficient',
      planType: slug,
    }
  }

  // 2. Verificar feature flag global (Super Admin puede apagar la funcionalidad)
  if (profile.organization_id) {
    const flags = await query<{ flag_key: string; flag_value: unknown; flag_type: string }>(`
      SELECT flag_key, flag_value, flag_type
      FROM system_feature_flags
      WHERE flag_key = 'climate_adjustment'
      LIMIT 1
    `, []).catch(() => [] as any[])

    // Si existe un flag global que apaga la funcionalidad
    if (flags.length > 0) {
      const f = flags[0] as any
      if (f.flag_type === 'boolean' && (f.flag_value === false || f.flag_value === 'false')) {
        return { allowed: false, reason: 'feature_flag_disabled' }
      }
    }
  }

  return { allowed: true, planType: slug }
}
