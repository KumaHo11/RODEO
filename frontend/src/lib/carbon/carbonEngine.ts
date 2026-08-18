/**
 * RODEO Carbon Accounting Engine — Fase 6
 * 
 * Metodología: IPCC 2006 Tier 1 para emisiones ganaderas
 * + Proxy satelital SOC para remociones
 * 
 * Referencia: IPCC Guidelines for National GHG Inventories Vol. 4
 * (Agriculture, Forestry and Other Land Use), Capítulo 10 y 11
 */

// ── Factores de emisión IPCC Tier 1 para bovinos en pampa/subtropicales ──

/** CH4 fermentación entérica: 64 kg CH4/cabeza/año para bovinos carne tropicales/subtropicales */
const CH4_ENTERIC_KG_PER_HEAD_PER_YEAR = 64

/** CH4 manejo de estiércol: 1 kg CH4/cabeza/año (pastoreo extensivo) */
const CH4_MANURE_KG_PER_HEAD_PER_YEAR = 1

/** N2O estiércol en pastoreo: 0.01 kg N2O-N/kg N excretado → factor IPCC EF3PRP */
const N2O_EMISSION_FACTOR = 0.01  // kg N2O-N / kg N

/** Nitrógeno excretado por bovino en pastoreo: 40 kg N/cabeza/año */
const N_EXCRETION_KG_PER_HEAD_PER_YEAR = 40

/** GWP100 IPCC AR6: CH4 = 27.9 tCO2e/tCH4, N2O = 273 tCO2e/tN2O */
const GWP_CH4 = 27.9
const GWP_N2O = 273

/** Factor conversión N2O-N a N2O */
const N2O_N_TO_N2O = 44 / 28

// ── Factores SOC ──
/**
 * Tasa de secuestro de SOC en pastizales bajo manejo regenerativo
 * Rango publicado: 0.1 a 0.5 tC/ha/año en pampa húmeda con buenas prácticas
 * Valor conservador (para Tier 1 sin muestras): 0.2 tC/ha/año
 * Convertir: × 44/12 → tCO2/ha/año
 */
const SOC_SEQUESTRATION_RATE_TC_HA_YEAR = 0.2  // Conservador, verificable
const TC_TO_TCO2 = 44 / 12

export interface CarbonInputs {
  headCount: number           // cabezas promedio en el potrero
  daysInPeriod: number        // días del período (mes = 30)
  paddockHa: number           // hectáreas del potrero
  socProxy: number            // SOC_ESTIMATED [0-1]
  ndvi: number                // NDVI promedio del período [0-1]
}

export interface CarbonEstimate {
  // Emisiones
  ch4EntericKg: number
  ch4ManureKg: number
  n2oManureKg: number
  grossEmissionsTco2e: number
  
  // Remociones
  biomassAboveT: number       // Biomasa aérea estimada (t/ha)
  socSequestrationTco2e: number
  
  // Balance
  netBalanceTco2e: number     // negativo = sumidero neto
  
  // Meta
  methodology: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  notes: string
}

export function calculateCarbonBalance(inputs: CarbonInputs): CarbonEstimate {
  const fractionOfYear = inputs.daysInPeriod / 365.0

  // CH4 Emisiones
  const ch4EntericKg = inputs.headCount * fractionOfYear * CH4_ENTERIC_KG_PER_HEAD_PER_YEAR
  const ch4ManureKg = inputs.headCount * fractionOfYear * CH4_MANURE_KG_PER_HEAD_PER_YEAR

  // N2O Emisiones
  const nExcretedKg = inputs.headCount * fractionOfYear * N_EXCRETION_KG_PER_HEAD_PER_YEAR
  const n2oManureKg = nExcretedKg * N2O_EMISSION_FACTOR * N2O_N_TO_N2O

  // Convertir a CO2e
  const ch4Co2e = ((ch4EntericKg + ch4ManureKg) / 1000) * GWP_CH4
  const n2oCo2e = (n2oManureKg / 1000) * GWP_N2O
  const grossEmissionsTco2e = ch4Co2e + n2oCo2e

  // Remociones
  const biomassAboveT = estimateBiomass(inputs.ndvi)
  const monthsInPeriod = inputs.daysInPeriod / 30.0
  const socSequestrationTco2e = adjustSOCSequestration(inputs.socProxy, inputs.paddockHa, monthsInPeriod)

  // Balance (Emisiones brutas - Secuestro). Nota: el secuestro lo tratamos como valor positivo. 
  // Emisiones son positivas, secuestro es negativo para el clima.
  // El balance neto es negativo si es sumidero.
  const netBalanceTco2e = grossEmissionsTco2e - socSequestrationTco2e

  return {
    ch4EntericKg,
    ch4ManureKg,
    n2oManureKg,
    grossEmissionsTco2e,
    biomassAboveT,
    socSequestrationTco2e,
    netBalanceTco2e,
    methodology: 'IPCC_TIER1_SOC_PROXY',
    confidence: 'MEDIUM',
    notes: 'Estimación basada en Tier 1 con proxy satelital SOC.'
  }
}

/**
 * Estima biomasa aérea (t MS/ha) a partir de NDVI
 * Basado en: Siegmund-Schultze et al. 2019 para pastizales subtropicales
 * Rango: NDVI 0.2 → ~0.5 t/ha, NDVI 0.8 → ~5 t/ha
 */
export function estimateBiomass(ndvi: number): number {
  if (ndvi <= 0.2) return 0.5
  if (ndvi >= 0.8) return 5.0
  
  // Interpolación lineal entre 0.2 y 0.8
  // m = (5 - 0.5) / (0.8 - 0.2) = 4.5 / 0.6 = 7.5
  // y = 7.5 * (ndvi - 0.2) + 0.5
  return 7.5 * (ndvi - 0.2) + 0.5
}

/**
 * Ajusta la tasa de secuestro de SOC según el proxy satelital
 * Si SOC_ESTIMATED > 0.6 (suelo rico) → aplica factor de saturación (menor tasa adicional)
 * Si SOC_ESTIMATED < 0.3 (suelo degradado) → mayor potencial de secuestro
 */
export function adjustSOCSequestration(socProxy: number, paddockHa: number, months: number): number {
  const baseSequestrationPerYear = SOC_SEQUESTRATION_RATE_TC_HA_YEAR * TC_TO_TCO2 // tCO2e/ha/year
  
  let multiplier = 1.0
  if (socProxy > 0.6) {
    multiplier = 0.5 // Saturación
  } else if (socProxy < 0.3) {
    multiplier = 1.2 // Degradado, mayor capacidad
  }

  const sequestrationPerYear = baseSequestrationPerYear * multiplier * paddockHa
  return (sequestrationPerYear / 12) * months
}
