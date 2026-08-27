/**
 * RODEO Metrics — Spectral Index Calculator
 * All formulas operate on Sentinel-2 L2A reflectance values (raw DN / 10000 for actual reflectance).
 * Inputs are raw mean values from TiTiler band statistics.
 */

export type MetricType =
  | 'NDVI' | 'EVI' | 'SAVI' | 'FCOVER'
  | 'NDMI' | 'BSI'
  | 'SPECTRAL_HETEROGENEITY'
  | 'SOIL_MOISTURE' | 'SOC_ESTIMATED' | 'COMPACTION_PROXY'

export interface BandValues {
  B2?: number   // Blue  (10m)
  B4?: number   // Red   (10m)
  B8?: number   // NIR   (10m)
  B11?: number  // SWIR  (20m)
  B8_stddev?: number  // for SPECTRAL_HETEROGENEITY
}

export interface IndexResult {
  metricType: MetricType
  value: number
  unit: 'index'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'ESTIMATED'
}

// Clamp helper
const clamp = (v: number, min = -1, max = 1) => Math.max(min, Math.min(max, v))

export function computeNDVI(bands: BandValues): IndexResult | null {
  if (bands.B8 == null || bands.B4 == null) return null
  if (bands.B8 === 0 && bands.B4 === 0) return null
  const value = clamp((bands.B8 - bands.B4) / (bands.B8 + bands.B4))
  return { metricType: 'NDVI', value: Number(value.toFixed(4)), unit: 'index', confidence: 'HIGH' }
}

export function computeEVI(bands: BandValues): IndexResult | null {
  // EVI = 2.5 x (NIR - Red) / (NIR + 6xRed - 7.5xBlue + 1)
  if (bands.B8 == null || bands.B4 == null || bands.B2 == null) return null
  const denom = bands.B8 + 6 * bands.B4 - 7.5 * bands.B2 + 1
  if (Math.abs(denom) < 1e-10) return null
  const value = clamp(2.5 * (bands.B8 - bands.B4) / denom)
  return { metricType: 'EVI', value: Number(value.toFixed(4)), unit: 'index', confidence: 'HIGH' }
}

export function computeSAVI(bands: BandValues): IndexResult | null {
  // SAVI = ((NIR - Red) / (NIR + Red + L)) x (1 + L), L = 0.5
  if (bands.B8 == null || bands.B4 == null) return null
  const L = 0.5
  const denom = bands.B8 + bands.B4 + L
  if (Math.abs(denom) < 1e-10) return null
  const value = clamp(((bands.B8 - bands.B4) / denom) * (1 + L))
  return { metricType: 'SAVI', value: Number(value.toFixed(4)), unit: 'index', confidence: 'HIGH' }
}

export function computeFCOVER(bands: BandValues): IndexResult | null {
  // fCover = linear rescaling of NDVI from [0.1, 0.8] to [0, 1]
  const ndvi = computeNDVI(bands)
  if (!ndvi) return null
  const value = Math.max(0, Math.min(1, (ndvi.value - 0.1) / (0.8 - 0.1)))
  return { metricType: 'FCOVER', value: Number(value.toFixed(4)), unit: 'index', confidence: 'HIGH' }
}

export function computeNDMI(bands: BandValues): IndexResult | null {
  // NDMI = (NIR - SWIR) / (NIR + SWIR)
  if (bands.B8 == null || bands.B11 == null) return null
  if (bands.B8 === 0 && bands.B11 === 0) return null
  const value = clamp((bands.B8 - bands.B11) / (bands.B8 + bands.B11))
  return { metricType: 'NDMI', value: Number(value.toFixed(4)), unit: 'index', confidence: 'HIGH' }
}

export function computeBSI(bands: BandValues): IndexResult | null {
  // BSI = ((SWIR + Red) - (NIR + Blue)) / ((SWIR + Red) + (NIR + Blue))
  if (bands.B11 == null || bands.B4 == null || bands.B8 == null || bands.B2 == null) return null
  const num = (bands.B11 + bands.B4) - (bands.B8 + bands.B2)
  const denom = (bands.B11 + bands.B4) + (bands.B8 + bands.B2)
  if (Math.abs(denom) < 1e-10) return null
  const value = clamp(num / denom)
  return { metricType: 'BSI', value: Number(value.toFixed(4)), unit: 'index', confidence: 'HIGH' }
}

export function computeSpectralHeterogeneity(bands: BandValues, ndviMean: number): IndexResult | null {
  // Coefficient of Variation of NDVI within the paddock polygon = stddev / mean
  if (bands.B8_stddev == null || !ndviMean || Math.abs(ndviMean) < 1e-10) return null
  // We approximate using B8 stddev as proxy for NDVI variability
  const cv = Math.abs(bands.B8_stddev / ndviMean)
  const value = Math.min(cv, 2) // cap at 2 to avoid outliers
  return { metricType: 'SPECTRAL_HETEROGENEITY', value: Number(value.toFixed(4)), unit: 'index', confidence: 'MEDIUM' }
}

// Compute all available indices from a set of band values
export function computeAllIndices(bands: BandValues): IndexResult[] {
  const results: (IndexResult | null)[] = [
    computeNDVI(bands),
    computeEVI(bands),
    computeSAVI(bands),
    computeFCOVER(bands),
    computeNDMI(bands),
    computeBSI(bands),
  ]
  if (bands.B8_stddev != null) {
    const ndvi = computeNDVI(bands)
    if (ndvi) results.push(computeSpectralHeterogeneity(bands, ndvi.value))
  }
  return results.filter((r): r is IndexResult => r !== null)
}

/**
 * SAR Soil Moisture Proxy — basado en backscatter VV de Sentinel-1
 * Referencia: Ulaby et al. (1996), Wagner et al. (1999)
 * VV backscatter en dB: típico -15 dB (seco) a -5 dB (húmedo)
 * Normalizado a [0, 1]: SM = (VV_dB - VV_min) / (VV_max - VV_min)
 */
export function computeSoilMoisture(vv_linear: number, vv_min = 0.02, vv_max = 0.32): number {
  const vv_db = 10 * Math.log10(vv_linear);
  const min_db = 10 * Math.log10(vv_min);
  const max_db = 10 * Math.log10(vv_max);
  return clamp((vv_db - min_db) / (max_db - min_db), 0, 1);
}

export function computeVHVVRatio(vv_linear: number, vh_linear: number): number {
  return vh_linear / vv_linear;
}

export function computeRFDI(vv_linear: number, vh_linear: number): number {
  if (vv_linear + vh_linear === 0) return 0;
  return (vv_linear - vh_linear) / (vv_linear + vh_linear);
}

/**
 * SOC Estimation Proxy — modelo empírico basado en índices VNIR de Sentinel-2
 * Referencia: Gholizadeh et al. 2018, adaptado para pastizales pampeanos
 * 
 * SOC_proxy = 0.35 * NDVI + 0.25 * (1 - BSI) + 0.20 * SAVI + 0.15 * fCover + 0.05 * NDMI
 * 
 * Rango típico en pastizales pampeanos: 0.1 (degradado) a 0.8 (alta biomasa/cobertura)
 * Normalizado: valores altos = mayor reserva de carbono orgánico potencial
 * 
 * IMPORTANTE: Este es un PROXY satelital, no una medición directa de SOC en g/kg.
 * Para certificación real se necesitan muestras de suelo. Este valor es un estimado
 * relativo útil para tracking de tendencias.
 */
export function estimateSOC({
  ndvi, bsi, savi, fcover, ndmi
}: { ndvi: number; bsi: number; savi: number; fcover: number; ndmi: number }): number {
  return 0.35 * ndvi + 0.25 * (1 - bsi) + 0.20 * savi + 0.15 * fcover + 0.05 * ndmi;
}

/**
 * Compaction Proxy Score — indicador indirecto de compactación superficial
 * 
 * Lógica:
 * - BSI alto (>0.1) = suelo desnudo → más expuesto a compactación
 * - NDVI bajo (<0.3) = sin cobertura protectora
 * - fCover bajo (<0.2) = sin protección de raíces
 * - NDMI muy bajo (<-0.2) = suelo seco superficial (indica compactación si fue húmedo antes)
 * 
 * Score 0-1: 0 = sin riesgo, 1 = riesgo alto de compactación
 */
export function computeCompactionProxy({ bsi, ndvi, fcover, ndmi }: {
  bsi: number; ndvi: number; fcover: number; ndmi: number
}): number {
  let score = 0;
  if (bsi > 0.1) score += 0.25;
  if (ndvi < 0.3) score += 0.25;
  if (fcover < 0.2) score += 0.25;
  if (ndmi < -0.2) score += 0.25;
  return score;
}
