/**
 * calculatorEngine.ts — Motor de cálculo para la Calculadora de proyecciones
 * ────────────────────────────────────────────────────────────────────────────
 * Función pura (sin I/O) que compone las fórmulas existentes de Rodeo:
 *   - climate-adjustment.ts  → ET, balance hídrico, multiplicador climático
 *   - forageCurves.ts        → tasa de crecimiento base por mes
 *   - evProjection.ts        → factor EV por categoría
 *
 * Todas las entradas son configurables por el usuario (con defaults reales).
 */

import {
  BASE_GROWTH_RATE_KG_HA_DAY,
  adjustedGrowthRate,
  getAustralSeason,
} from '@/lib/grazing/forageCurves'
import { EV_BASE } from '@/lib/grazing/evProjection'

// ─── Tipos inline (duplicados de climate-adjustment para evitar bundling de db.ts) ─

export type DroughtIndex = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'

/** Calcula ET diaria (mm) — Hargreaves simplificado calibrado para Pampa Húmeda */
function calcET(tempC: number, rsMjM2: number, humPct: number, windKmh: number): number {
  const α = 0.0023
  const humFactor  = 1 - (humPct / 200)
  const windFactor = 1 + (windKmh / 100)
  return Math.max(0, Math.round(α * rsMjM2 * (tempC + 17.8) * humFactor * windFactor * 100) / 100)
}

/** Balance hídrico con runoff por NDVI */
function calcWaterBalance(precipMm: number, etMm: number, ndvi: number) {
  const runoffFactor = ndvi >= 0.40 ? 0.10 : ndvi >= 0.20 ? 0.35 : ndvi >= 0.15 ? 0.60 : 0.80
  const pEfectiva   = precipMm * (1 - runoffFactor)
  const etAjustada  = ndvi < 0.15 ? etMm * 1.5 : etMm
  return {
    precipitacionEfectivaMm: Math.round(pEfectiva * 100) / 100,
    balanceHidricoMm:        Math.round((pEfectiva - etAjustada) * 100) / 100,
  }
}


// ─── Constantes agronómicas ──────────────────────────────────────────────────

const MIN_REMNANT_MS_HA   = 900   // kg MS/ha — remanente mínimo biológico
const HARVEST_EFFICIENCY  = 0.60  // 60% de eficiencia de cosecha en pastoreo rotativo

/**
 * Tasa base de crecimiento por estación para el motor de la Calculadora.
 * Nota: Los valores son deliberadamente más conservadores que SEASONAL_BASE_GROWTH
 * de forageCurves.ts (que es la tasa de crecimiento observada de Pampa Húmeda).
 * Aquí se usa la tasa de producción neta aprovechable (descontando pérdidas biológicas).
 */
const CALCULATOR_SEASONAL_BASE: Record<string, number> = {
  VERANO:    28,  // 32 bruto * 0.87 eficiencia
  OTONO:     14,  // 18 bruto * 0.78 eficiencia
  INVIERNO:   5,  //  8 bruto * 0.62 eficiencia
  PRIMAVERA: 35,  // 38 bruto * 0.92 eficiencia
}

// getAustralSeason importado desde lib/grazing/forageCurves.ts

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type CategoriaAnimal =
  | 'VACAS' | 'NOVILLOS' | 'NOVILLITOS' | 'VAQUILLONAS'
  | 'TERNEROS' | 'TERNERAS' | 'TOROS' | 'BUBALINOS'

export interface CalculatorInput {
  // ── Campo
  totalAreaHa: number          // Superficie total del campo (ha)

  // ── Rodeo
  headCount: number            // Cabezas totales
  avgWeightKg: number          // Peso vivo promedio (kg)
  categoria: CategoriaAnimal   // Categoría base del rodeo

  // ── Forraje
  msKgHa: number              // MS disponible/ha (kg MS/ha)
  remnantMsKgHa: number       // Remanente objetivo (kg MS/ha)
  dailyRationKgEv: number     // Ración diaria (kg MS/EV)

  // ── Clima real
  temperaturaC: number         // Temperatura media diaria (°C)
  humidityPct: number          // Humedad relativa (%)
  rainfall7dMm: number         // Lluvia acumulada 7 días (mm)
  forecastRainfall14dMm: number // Lluvia esperada 14 días (mm)
  radiacionSolar: number       // Radiación solar (MJ/m²/día)
  windKmh: number              // Velocidad del viento (km/h)
  ndvi: number                 // NDVI actual (0–1)
  droughtIndex: DroughtIndex   // Índice de sequía

  // ── Contexto
  currentMonth: number         // Mes actual (1–12)
}

export interface CalculatorResult {
  // Métricas productivas
  totalEv: number              // Equivalentes vaca totales
  cargaDiariaEvHa: number      // Carga (EV/ha)
  consumoDiarioKg: number      // Consumo total MS/día (kg)
  consumoHaKg: number         // Consumo por ha/día (kg MS/ha)
  diaAnimalKg: number          // Ración diaria (kg MS/animal/día equivalente)

  // Forraje
  stockTotalKg: number         // MS total en campo (kg)
  stockAprovechableKg: number  // MS aprovechable (kg)
  autonomiaDias: number        // Días de autonomía forrajera

  // Crecimiento
  tasaCrecimientoKgHaDia: number  // Tasa de crecimiento ajustada (kg MS/ha/día)
  crecimientoDiarioTotal: number  // Crecimiento total del campo/día (kg MS)

  // Balance
  balanceNetoKgHaDia: number   // Balance neto (kg MS/ha/día) — positivo = acumula
  balanceNetoTotal: number     // Balance neto total del campo/día (kg MS)

  // Clima
  et: number                   // Evapotranspiración estimada (mm/día)
  balanceHidricoMm: number     // Balance hídrico (mm/período 7 días)
  precipEfectivaMm: number     // Precipitación efectiva (mm)
  climateMultiplier: number    // Coeficiente climático aplicado (C_adj)
  season: string               // Estación del año

  // Alertas
  alertLevel: 'ok' | 'warning' | 'critical'
  alertMessage: string | null
}

// ─── Motor principal ─────────────────────────────────────────────────────────

export function runCalculator(input: CalculatorInput): CalculatorResult {
  const {
    totalAreaHa, headCount, avgWeightKg, categoria,
    msKgHa, remnantMsKgHa, dailyRationKgEv,
    temperaturaC, humidityPct, rainfall7dMm, radiacionSolar, windKmh,
    ndvi, droughtIndex, currentMonth,
  } = input

  // ── 1. Equivalentes vaca ──────────────────────────────────────────────────
  const evBase = EV_BASE[categoria] ?? 1.0
  const weightFactor = Math.pow((avgWeightKg || 450) / 450, 0.75)
  const totalEv = evBase * weightFactor * headCount

  // ── 2. Carga y consumo ───────────────────────────────────────────────────
  const cargaDiariaEvHa   = totalAreaHa > 0 ? totalEv / totalAreaHa : 0
  const consumoDiarioKg   = totalEv * dailyRationKgEv
  const consumoHaKg       = totalAreaHa > 0 ? consumoDiarioKg / totalAreaHa : 0
  // Día animal: consumo real por cabeza (teniendo en cuenta EV)
  const diaAnimalKg       = headCount > 0 ? consumoDiarioKg / headCount : 0

  // ── 3. Stock forrajero ───────────────────────────────────────────────────
  const stockTotalKg       = msKgHa * totalAreaHa
  const disponiblePorHa    = Math.max(0, msKgHa - remnantMsKgHa)
  const stockAprovechableKg = disponiblePorHa * totalAreaHa * HARVEST_EFFICIENCY

  // ── 4. Clima: ET y Balance Hídrico ───────────────────────────────────────
  const et = calcET(temperaturaC, radiacionSolar, humidityPct, windKmh)
  const wb = calcWaterBalance(rainfall7dMm, et * 7, ndvi) // 7 días de ET vs lluvia 7d
  const balanceHidricoMm   = wb.balanceHidricoMm
  const precipEfectivaMm   = wb.precipitacionEfectivaMm

  // ── 5. Tasa de crecimiento ajustada ─────────────────────────────────────
  const season     = getAustralSeason(currentMonth)
  const baseGrowth = CALCULATOR_SEASONAL_BASE[season]

  // Factor NDVI (cobertura vegetal)
  let ndviMult = 0.70
  if      (ndvi >= 0.70) ndviMult = 1.30
  else if (ndvi >= 0.55) ndviMult = 1.10
  else if (ndvi >= 0.40) ndviMult = 0.95
  else if (ndvi >= 0.25) ndviMult = 0.75
  else if (ndvi >= 0.15) ndviMult = 0.50

  // Factor balance hídrico
  let bhFactor = 1.0
  if      (balanceHidricoMm >= 30) bhFactor = 1.35
  else if (balanceHidricoMm >= 10) bhFactor = 1.15
  else if (balanceHidricoMm >= -5) bhFactor = 1.00
  else if (balanceHidricoMm >= -20) bhFactor = 0.75
  else                              bhFactor = 0.45

  // Factor temperatura (Pampa: 15–22°C óptimo)
  let tempFactor = 1.0
  if      (temperaturaC >= 15 && temperaturaC <= 22) tempFactor = 1.10
  else if (temperaturaC < 5  || temperaturaC > 38)  tempFactor = 0.60
  else if (temperaturaC < 8  || temperaturaC > 32)  tempFactor = 0.80

  // Factor sequía
  const droughtFactor: Record<DroughtIndex, number> = {
    NONE:     1.00,
    MILD:     0.78,
    MODERATE: 0.52,
    SEVERE:   0.28,
  }

  const climateMultiplier = Math.max(0.20, Math.min(1.80,
    ndviMult * bhFactor * tempFactor * droughtFactor[droughtIndex]
  ))

  // Ajuste por lluvia mensual: usando forageCurves.adjustedGrowthRate
  // Proyectamos la lluvia 7d a 30d (aprox) para el factor de lluvia mensual
  const rainEstMonthly = rainfall7dMm * (30 / 7)
  const baseMonth = BASE_GROWTH_RATE_KG_HA_DAY[currentMonth - 1] ?? baseGrowth
  const growthByRain = adjustedGrowthRate(baseMonth, rainEstMonthly)
  // Promediamos ambos enfoques para robustez
  const tasaCrecimientoKgHaDia = Math.round(
    ((baseGrowth * climateMultiplier + growthByRain) / 2) * 10
  ) / 10

  const crecimientoDiarioTotal = tasaCrecimientoKgHaDia * totalAreaHa

  // ── 6. Balance neto ───────────────────────────────────────────────────────
  const balanceNetoKgHaDia = tasaCrecimientoKgHaDia - consumoHaKg
  const balanceNetoTotal   = balanceNetoKgHaDia * totalAreaHa

  // ── 7. Autonomía forrajera ────────────────────────────────────────────────
  let autonomiaDias = 0
  if (balanceNetoKgHaDia >= 0) {
    // Stock crece: autonomía teóricamente larga → capamos en 120 días
    autonomiaDias = consumoDiarioKg > 0
      ? Math.min(120, Math.round(stockAprovechableKg / consumoDiarioKg))
      : 120
  } else {
    // Stock se consume más rápido que el crecimiento
    const consumoNetoTotal = Math.abs(balanceNetoTotal) // kg/día que realmente se pierde
    autonomiaDias = consumoNetoTotal > 0
      ? Math.max(0, Math.round(stockAprovechableKg / consumoNetoTotal))
      : 0
  }

  // ── 8. Alertas ────────────────────────────────────────────────────────────
  let alertLevel: 'ok' | 'warning' | 'critical' = 'ok'
  let alertMessage: string | null = null

  if (autonomiaDias <= 5) {
    alertLevel = 'critical'
    alertMessage = `Autonomía crítica: ${autonomiaDias} días. Se recomienda mover el rodeo de inmediato.`
  } else if (autonomiaDias <= 15 || balanceNetoKgHaDia < -5) {
    alertLevel = 'warning'
    alertMessage = `Autonomía limitada (${autonomiaDias} días). El consumo supera el crecimiento en ${Math.abs(balanceNetoKgHaDia).toFixed(1)} kg MS/ha/día.`
  } else if (ndvi < 0.15) {
    alertLevel = 'critical'
    alertMessage = `NDVI crítico (${ndvi.toFixed(2)}). Cobertura vegetal insuficiente — sin rebrote estimado.`
  } else if (balanceNetoKgHaDia > 0 && autonomiaDias > 30) {
    alertLevel = 'ok'
    alertMessage = `Balance positivo. El pasto crece a ${tasaCrecimientoKgHaDia} kg MS/ha/día.`
  }

  return {
    totalEv:                 parseFloat(totalEv.toFixed(1)),
    cargaDiariaEvHa:         parseFloat(cargaDiariaEvHa.toFixed(2)),
    consumoDiarioKg:         parseFloat(consumoDiarioKg.toFixed(0)),
    consumoHaKg:             parseFloat(consumoHaKg.toFixed(1)),
    diaAnimalKg:             parseFloat(diaAnimalKg.toFixed(1)),
    stockTotalKg:            parseFloat(stockTotalKg.toFixed(0)),
    stockAprovechableKg:     parseFloat(stockAprovechableKg.toFixed(0)),
    autonomiaDias,
    tasaCrecimientoKgHaDia,
    crecimientoDiarioTotal:  parseFloat(crecimientoDiarioTotal.toFixed(0)),
    balanceNetoKgHaDia:      parseFloat(balanceNetoKgHaDia.toFixed(1)),
    balanceNetoTotal:        parseFloat(balanceNetoTotal.toFixed(0)),
    et:                      parseFloat(et.toFixed(1)),
    balanceHidricoMm:        parseFloat(balanceHidricoMm.toFixed(1)),
    precipEfectivaMm:        parseFloat(precipEfectivaMm.toFixed(1)),
    climateMultiplier:       parseFloat(climateMultiplier.toFixed(3)),
    season,
    alertLevel,
    alertMessage,
  }
}

// ─── Escenarios predefinidos ─────────────────────────────────────────────────

export function getScenarioOverrides(
  scenario: 'sequia' | 'optimo',
  base: CalculatorInput
): Partial<CalculatorInput> {
  if (scenario === 'sequia') {
    return {
      rainfall7dMm:           0,
      forecastRainfall14dMm:  0,
      humidityPct:            25,
      temperaturaC:           38,
      radiacionSolar:         28,
      windKmh:                35,
      ndvi:                   0.18,
      droughtIndex:           'SEVERE',
      msKgHa:                 Math.round(base.msKgHa * 0.55),
    }
  }
  // Escenario óptimo
  return {
    rainfall7dMm:           55,
    forecastRainfall14dMm:  80,
    humidityPct:            70,
    temperaturaC:           18,
    radiacionSolar:         22,
    windKmh:                10,
    ndvi:                   0.72,
    droughtIndex:           'NONE',
    msKgHa:                 Math.round(base.msKgHa * 1.40),
  }
}
