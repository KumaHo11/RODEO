'use client'

/**
 * MetricCard — Card individual para una métrica satelital.
 * Muestra: valor actual, tendencia vs período anterior, sparkline, badge de normativa.
 */

import { TrendingUp, TrendingDown, Minus, Satellite, CloudOff, Leaf, Droplets, Sun, CloudRain, Layers, ShieldCheck, Zap, BarChart2, Calendar, RefreshCw, Sprout, Circle } from 'lucide-react'


// ── Types ────────────────────────────────────────────────────────────────────

export type MetricType =
  | 'NDVI' | 'EVI' | 'SAVI' | 'FCOVER'
  | 'NDMI' | 'SOIL_MOISTURE' | 'DROUGHT_INDEX' | 'PRECIPITATION'
  | 'BSI' | 'DEFORESTATION_GUARD' | 'COMPACTION_PROXY'
  | 'SPECTRAL_HETEROGENEITY' | 'PHENOLOGY' | 'OCCUPATION_REST_RATIO'
  | 'BIOMASS' | 'SOC_ESTIMATED'

export type TrendDirection = 'improving' | 'stable' | 'declining'

export interface MetricSnapshot {
  metricType:  MetricType
  value:       number
  unit:        string
  captureDate: string
  source:      string
  confidence:  string
}

export interface MetricTrend {
  avgValue:       number
  pctChange:      number | null
  trendDirection: TrendDirection
  dataPoints:     number
}

export interface MetricCardProps {
  metricType:     MetricType
  snapshot?:      MetricSnapshot | null
  trend?:         MetricTrend | null
  baselineValue?: number | null   // vs 2020 baseline
  className?:     string
  onClick?:       () => void
}

// ── Meta config ──────────────────────────────────────────────────────────────

const METRIC_META: Record<MetricType, {
  label:     string
  icon:      React.ElementType
  decimals:  number
  // Higher = good (NDVI, NDMI, fCover) | lower = good (BSI, drought) | neutral
  polarity:  'higher_better' | 'lower_better' | 'neutral'
  normative: string[]
  description: string
}> = {
  NDVI:                  { label: 'NDVI',         icon: Leaf,        decimals: 3, polarity: 'higher_better', normative: ['EUDR','GRSB','Verra'], description: 'Vigor fotosintético' },
  EVI:                   { label: 'EVI',           icon: Leaf,        decimals: 3, polarity: 'higher_better', normative: ['GRSB','EOV'],         description: 'Vigor corregido suelo/atmósfera' },
  SAVI:                  { label: 'SAVI',          icon: Leaf,        decimals: 3, polarity: 'higher_better', normative: ['EOV Savory'],         description: 'Biomasa en zonas escasas' },
  FCOVER:                { label: 'fCover',        icon: Circle,      decimals: 3, polarity: 'higher_better', normative: ['EOV Savory'],         description: '% cobertura vegetal' },
  NDMI:                  { label: 'NDMI',          icon: Droplets,    decimals: 3, polarity: 'higher_better', normative: ['ISO 14046','EOV'],    description: 'Estrés hídrico vegetación' },
  SOIL_MOISTURE:         { label: 'Humedad SAR',   icon: Droplets,    decimals: 3, polarity: 'higher_better', normative: ['EU SR'],              description: 'Humedad suelo (SAR)' },
  DROUGHT_INDEX:         { label: 'Índice Sequía', icon: Sun,         decimals: 2, polarity: 'lower_better',  normative: ['GRSB'],              description: 'Nivel de estrés hídrico' },
  PRECIPITATION:         { label: 'Precipitación', icon: CloudRain,   decimals: 0, polarity: 'neutral',       normative: ['EOV Savory'],        description: 'Lluvia acumulada (mm)' },
  BSI:                   { label: 'BSI',           icon: Layers,      decimals: 3, polarity: 'lower_better',  normative: ['EUDR'],              description: 'Suelo desnudo (degradación)' },
  DEFORESTATION_GUARD:   { label: 'Guard. Defor.', icon: ShieldCheck, decimals: 2, polarity: 'lower_better',  normative: ['EUDR'],              description: 'Cambio cobertura post-2020' },
  COMPACTION_PROXY:      { label: 'Compactación',  icon: Zap,         decimals: 2, polarity: 'lower_better',  normative: ['GRSB'],              description: 'Riesgo de Compactación' },
  SPECTRAL_HETEROGENEITY:{ label: 'Biodiversidad', icon: BarChart2,   decimals: 3, polarity: 'higher_better', normative: ['EOV Savory'],        description: 'Proxy diversidad vegetal' },
  PHENOLOGY:             { label: 'Fenología',     icon: Calendar,    decimals: 2, polarity: 'higher_better', normative: ['EOV Savory'],        description: 'Duración temporada crecimiento' },
  OCCUPATION_REST_RATIO: { label: 'Ocup./Desc.',   icon: RefreshCw,   decimals: 1, polarity: 'neutral',       normative: ['EOV','GRSB'],        description: 'Ratio ocupación/descanso' },
  BIOMASS:               { label: 'Biomasa',       icon: Sprout,      decimals: 0, polarity: 'higher_better', normative: ['EOV Savory'],        description: 'Materia seca estimada (kg/ha)' },
  SOC_ESTIMATED:         { label: 'Carbono Suelo', icon: Layers,      decimals: 2, polarity: 'higher_better', normative: ['EOV'],               description: 'Carbono Orgánico Estimado' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MetricCard({ metricType, snapshot, trend, baselineValue, className = '', onClick }: MetricCardProps) {
  const meta = METRIC_META[metricType]
  if (!meta) return null

  const hasData    = snapshot != null
  const value      = snapshot?.value
  const unit       = snapshot?.unit || 'index'
  const pctChange  = trend?.pctChange ?? null
  const direction  = trend?.trendDirection ?? 'stable'
  const isEstimate = snapshot?.source === 'estimated'

  // Format value
  const formattedValue = value != null
    ? unit === 'index'
      ? value.toFixed(meta.decimals)
      : `${Math.round(value).toLocaleString('es-AR')} ${unit === 'kg/ha' ? 'kg/ha' : unit}`
    : '—'

  // Baseline delta
  const baselineDelta = baselineValue != null && value != null
    ? ((value - baselineValue) / Math.abs(baselineValue)) * 100
    : null

  // Color logic: depends on polarity + trend
  const isTrendGood =
    direction === 'stable' ? false :
    meta.polarity === 'higher_better' ? direction === 'improving' :
    meta.polarity === 'lower_better'  ? direction === 'declining' :
    false

  const trendColor = !hasData          ? 'text-gray-400' :
    direction === 'stable'             ? 'text-gray-500' :
    isTrendGood                        ? 'text-green-600' :
                                         'text-red-500'

  const TrendIcon = direction === 'stable' ? Minus
    : direction === 'improving'            ? TrendingUp
    :                                        TrendingDown

  const MetricIcon = meta.icon

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all
        hover:shadow-md hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
        ${hasData ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-70'}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MetricIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{meta.label}</span>
        </div>
        {/* Source badge */}
        {isEstimate ? (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
            <CloudOff className="w-2.5 h-2.5" /> Est.
          </span>
        ) : hasData ? (
          <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${snapshot?.source === 'sentinel-1-sar' ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
            <Satellite className="w-2.5 h-2.5" /> {snapshot?.source === 'sentinel-1-sar' ? 'S-1' : 'S-2'}
          </span>
        ) : null}
      </div>

      {/* Value */}
      <div className="flex items-end gap-1.5">
        <span className={`text-2xl font-black tabular-nums ${hasData ? 'text-gray-950' : 'text-gray-400'}`}>
          {formattedValue}
        </span>
        {/* Trend vs previous period */}
        {pctChange != null && hasData && (
          <span className={`flex items-center gap-0.5 text-sm font-semibold mb-0.5 ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Sparkline placeholder — real chart plugged in phase 1.6 full */}
      <div className="h-8 w-full rounded bg-gray-100 overflow-hidden relative">
        {hasData && (
          <div
            className={`absolute bottom-0 left-0 h-full rounded transition-all
              ${isTrendGood ? 'bg-green-100' : direction === 'stable' ? 'bg-gray-200' : 'bg-red-100'}`}
            style={{ width: `${Math.min(100, Math.max(10, (value || 0) * 100))}%` }}
          />
        )}
      </div>

      {/* Baseline delta vs 2020 */}
      {baselineDelta != null && (
        <div className={`text-xs font-medium ${baselineDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          vs 2020: {baselineDelta > 0 ? '+' : ''}{baselineDelta.toFixed(0)}%
        </div>
      )}

      {/* Normative badges */}
      <div className="flex flex-wrap gap-1 mt-auto pt-1 border-t border-gray-100">
        {meta.normative.slice(0, 3).map(n => (
          <span key={n} className="text-[9px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
            {n}
          </span>
        ))}
      </div>
    </button>
  )
}
