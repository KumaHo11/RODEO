'use client'

/**
 * GrowthProjectionChart — Gráfico de proyección de crecimiento GDP (12 meses)
 * ─────────────────────────────────────────────────────────────────────────────
 * Visualiza la curva de peso proyectado y el EV resultante mes a mes usando
 * la Ganancia Diaria de Peso (GDP) como motor de cálculo.
 *
 * Consume el Servicio Core: generateGrowthProjection() de evProjection.ts
 * NO duplica lógica matemática — fuente única de verdad.
 */

import React, { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  generateGrowthProjection,
  PHYSIO_LABEL,
  type GrowthProjectionInput,
  type PhysiologicalCategory,
} from '@/lib/grazing/evProjection'
import { TrendingUp, Scale, Zap } from 'lucide-react'

interface GrowthProjectionChartProps {
  physioCategory: string | null
  avgWeightKg: number | null
  gdpKgDay: number | null
  headCount: number
  lastWeighDate?: string | null
  months?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-black text-gray-700 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">
            {p.name.includes('Peso')
              ? `${p.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg`
              : p.name.includes('Consumo')
              ? `${p.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })} kg MS/día`
              : p.value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function GrowthProjectionChart({
  physioCategory,
  avgWeightKg,
  gdpKgDay,
  headCount,
  lastWeighDate,
  months = 12,
}: GrowthProjectionChartProps) {
  const hasData = !!avgWeightKg && !!gdpKgDay && headCount > 0

  const data = useMemo(() => {
    if (!hasData) return []
    const input: GrowthProjectionInput = {
      physioCategory: physioCategory as PhysiologicalCategory | null,
      avgWeightKg: avgWeightKg!,
      gdpKgDay: gdpKgDay!,
      headCount,
      lastWeighDate,
    }
    return generateGrowthProjection(input, months)
  }, [physioCategory, avgWeightKg, gdpKgDay, headCount, lastWeighDate, months, hasData])

  const physioLabel = physioCategory
    ? (PHYSIO_LABEL[physioCategory as PhysiologicalCategory] ?? physioCategory)
    : null

  const firstPoint = data[0]
  const lastPoint  = data[data.length - 1]
  const weightGain = lastPoint && firstPoint
    ? Math.round(lastPoint.projectedWeightKg - firstPoint.projectedWeightKg)
    : 0
  const evGain = lastPoint && firstPoint
    ? parseFloat((lastPoint.evTotal - firstPoint.evTotal).toFixed(1))
    : 0

  if (!hasData) {
    return (
      <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
        <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-gray-400">Curva de crecimiento</p>
        <p className="text-xs text-gray-300 mt-1">
          Completá el peso promedio y la GDP para ver la proyección
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-100 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-[11px] font-black text-emerald-800 tracking-widest uppercase">
              Proyección de Crecimiento
            </p>
          </div>
          {physioLabel && (
            <p className="text-[10px] text-emerald-600 mt-0.5">{physioLabel}</p>
          )}
        </div>
        {/* KPI pills */}
        <div className="flex gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-white/80 rounded-lg px-2 py-1 border border-emerald-100">
            <Scale className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-700">
              +{weightGain} kg
            </span>
          </div>
          <div className="flex items-center gap-1 bg-white/80 rounded-lg px-2 py-1 border border-teal-100">
            <Zap className="w-3 h-3 text-teal-500" />
            <span className="text-[10px] font-bold text-teal-700">
              +{evGain} EV
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 9, fill: '#9ca3af', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            {/* Left Y: Peso */}
            <YAxis
              yAxisId="weight"
              orientation="left"
              tick={{ fontSize: 9, fill: '#6ee7b7', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 20', 'dataMax + 20']}
              tickFormatter={(v) => `${Math.round(v)}`}
            />
            {/* Right Y: EV */}
            <YAxis
              yAxisId="ev"
              orientation="right"
              tick={{ fontSize: 9, fill: '#7c3aed', fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(v) => `${v.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 9, fontWeight: 700, paddingTop: 8 }}
              iconType="circle"
              iconSize={6}
            />
            {/* Reference line: today */}
            <ReferenceLine
              yAxisId="weight"
              x={data[0]?.monthLabel}
              stroke="#10b981"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="projectedWeightKg"
              name="Peso prom. (kg)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#10b981' }}
            />
            <Line
              yAxisId="ev"
              type="monotone"
              dataKey="evTotal"
              name="EV total"
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4, fill: '#7c3aed' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* GDP info footer */}
      <div className="flex items-center justify-between text-[10px] text-emerald-600/70 border-t border-emerald-100 pt-2">
        <span>GDP: <strong className="text-emerald-700">{gdpKgDay} kg/día</strong></span>
        <span>{headCount} cabezas · {months} meses de proyección</span>
        {lastWeighDate && (
          <span>Ref: {new Date(lastWeighDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
        )}
      </div>
    </div>
  )
}
