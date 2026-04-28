'use client'

/**
 * ClimateAdjustmentChart
 *
 * Visualiza el historial de "Crecimiento del Pasto vs Lluvia/Humedad"
 * estilo bolsa de valores: curva de crecimiento por potrero en el tiempo
 * con overlay de precipitaciones.
 *
 * Incluye:
 *  - Selector de potrero
 *  - Filtro temporal (7d / 30d / 90d / anual)
 *  - Indicador de tasa de crecimiento actual con delta vs período anterior
 *  - Área sombreada para índice de sequía
 *  - Feature gate para PLANIFICADOR+
 */

import { useEffect, useState, useMemo } from 'react'
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { apiFetch } from '@/lib/apiFetch'
import { usePlan } from '@/hooks/usePlan'
import {
  TrendingUp, TrendingDown, Minus, CloudRain, Loader2,
  RefreshCw, AlertTriangle, Leaf, Droplets, Wind,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  paddock_id: string
  paddock_name: string
  area_ha: number
  ndvi: number
  rainfall_7d_mm: number
  humidity_pct: number
  drought_index: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'
  forage_ms_ha: number
  grass_growth_rate: number
  climate_multiplier: number
  base_remaining_days: number
  adjusted_remaining_days: number
  alert_level: 'ok' | 'warning' | 'critical'
  delta_from_plan: number
  calculated_at: string
}

interface ChartPoint {
  date: string
  dateLabel: string
  growthRate: number
  rainfall: number
  humidity: number
  ndvi: number
  forageMsHa: number
  adjustedDays: number
  multiplier: number
  drought: number // 0=NONE 1=MILD 2=MODERATE 3=SEVERE
}

type TimeRange = '7d' | '30d' | '90d' | '1y'

const DROUGHT_SCORE: Record<string, number> = { NONE: 0, MILD: 1, MODERATE: 2, SEVERE: 3 }
const DROUGHT_COLORS: Record<string, string> = {
  NONE: 'text-green-600', MILD: 'text-yellow-600', MODERATE: 'text-orange-600', SEVERE: 'text-red-600',
}
const DROUGHT_LABELS: Record<string, string> = {
  NONE: 'Sin sequía', MILD: 'Sequía leve', MODERATE: 'Sequía moderada', SEVERE: 'Sequía severa',
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ChartPoint
  if (!d) return null
  return (
    <div className="bg-gray-950 border border-white/10 rounded-xl p-3 shadow-2xl text-xs min-w-[200px]">
      <p className="text-gray-400 font-bold mb-2">{d.dateLabel}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-emerald-400">Crecimiento</span>
          <span className="font-black text-white">{d.growthRate.toFixed(1)} kg MS/ha/día</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-blue-400">Lluvia 7d</span>
          <span className="font-black text-white">{d.rainfall.toFixed(0)} mm</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sky-400">Humedad</span>
          <span className="font-black text-white">{d.humidity.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-violet-400">NDVI</span>
          <span className="font-black text-white">{d.ndvi.toFixed(3)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-amber-400">Días ajustados</span>
          <span className="font-black text-white">{d.adjustedDays}d</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Mult. climático</span>
          <span className="font-black text-white">×{d.multiplier.toFixed(3)}</span>
        </div>
        {d.drought > 0 && (
          <div className="mt-1 pt-1 border-t border-white/10 text-orange-400 font-bold">
            {['', '⚠️ Sequía leve', '🔴 Sequía moderada', '🚨 Sequía severa'][d.drought]}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClimateAdjustmentChart() {
  const { hasFeature, currentPlan } = usePlan()
  const hasAccess = hasFeature('grazing_planner') // PLANIFICADOR+

  const [snapshots, setSnapshots]     = useState<Snapshot[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedPaddock, setSelectedPaddock] = useState<string>('all')
  const [timeRange, setTimeRange]     = useState<TimeRange>('30d')
  const [refreshing, setRefreshing]   = useState(false)

  const paddockList = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of snapshots) map.set(s.paddock_id, s.paddock_name)
    return [{ id: 'all', name: 'Todos los potreros' }, ...Array.from(map.entries()).map(([id, name]) => ({ id, name }))]
  }, [snapshots])

  async function loadData() {
    setRefreshing(true)
    try {
      const res = await apiFetch('/api/climate-adjustment')
      if (res.ok) {
        const { snapshots: data } = await res.json()
        setSnapshots(data || [])
      }
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { if (hasAccess) loadData() }, [hasAccess])

  // Filter by time range and paddock
  const cutoff = useMemo(() => {
    const ms = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[timeRange] * 86400000
    return new Date(Date.now() - ms).toISOString()
  }, [timeRange])

  const filtered = useMemo(() =>
    snapshots.filter(s =>
      s.calculated_at >= cutoff &&
      (selectedPaddock === 'all' || s.paddock_id === selectedPaddock)
    ).sort((a, b) => a.calculated_at.localeCompare(b.calculated_at)),
    [snapshots, cutoff, selectedPaddock]
  )

  // Aggregate by date (average all paddocks per day if "all")
  const chartData: ChartPoint[] = useMemo(() => {
    const byDate = new Map<string, Snapshot[]>()
    for (const s of filtered) {
      const d = s.calculated_at.slice(0, 10)
      if (!byDate.has(d)) byDate.set(d, [])
      byDate.get(d)!.push(s)
    }
    return Array.from(byDate.entries()).map(([date, rows]) => {
      const avg = (key: keyof Snapshot) =>
        rows.reduce((sum, r) => sum + Number(r[key] || 0), 0) / rows.length
      const maxDrought = Math.max(...rows.map(r => DROUGHT_SCORE[r.drought_index] ?? 0))
      const label = new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      return {
        date,
        dateLabel: label,
        growthRate:    Math.round(avg('grass_growth_rate') * 10) / 10,
        rainfall:      Math.round(avg('rainfall_7d_mm') * 10) / 10,
        humidity:      Math.round(avg('humidity_pct') * 10) / 10,
        ndvi:          Math.round(avg('ndvi') * 1000) / 1000,
        forageMsHa:    Math.round(avg('forage_ms_ha')),
        adjustedDays:  Math.round(avg('adjusted_remaining_days')),
        multiplier:    Math.round(avg('climate_multiplier') * 1000) / 1000,
        drought:       maxDrought,
      }
    })
  }, [filtered])

  // KPIs
  const latestPoint = chartData[chartData.length - 1]
  const prevPoint   = chartData[chartData.length - 2]
  const growthDelta = latestPoint && prevPoint
    ? latestPoint.growthRate - prevPoint.growthRate : null
  const avgGrowth = chartData.length
    ? chartData.reduce((s, p) => s + p.growthRate, 0) / chartData.length : 0
  const peakGrowth = chartData.length ? Math.max(...chartData.map(p => p.growthRate)) : 0
  const currentDrought = filtered[filtered.length - 1]?.drought_index ?? 'NONE'

  // ── Upgrade gate ────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-white/10 p-8 text-center">
        <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-white font-black text-lg mb-2">Ajuste Clima · IA Predictiva</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-sm mx-auto">
          Calculá la tasa de crecimiento del pasto cruzando NDVI con lluvia y humedad.
          Disponible desde el plan <strong className="text-emerald-400">Planificador</strong>.
        </p>
        <a href="/dashboard/planes" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black px-6 py-3 rounded-xl transition-all">
          Actualizar plan →
        </a>
      </div>
    )
  }

  if (loading) return (
    <div className="bg-gray-950 rounded-2xl border border-white/10 p-8 flex items-center justify-center gap-3">
      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
      <p className="text-gray-400 text-sm">Cargando historial climático...</p>
    </div>
  )

  if (chartData.length === 0) return (
    <div className="bg-gray-950 rounded-2xl border border-white/10 p-8 text-center">
      <p className="text-gray-500 text-sm mb-1 font-bold">Sin datos de Ajuste Clima aún</p>
      <p className="text-gray-600 text-xs">Los datos se acumulan cada vez que se ejecuta el cálculo.</p>
    </div>
  )

  return (
    <div className="bg-gray-950 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-black text-base flex items-center gap-2">
            <Leaf className="w-4 h-4 text-emerald-400" />
            Crecimiento del Pasto vs Clima
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">Histórico · kg MS/ha/día ajustado por clima</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Paddock selector */}
          <select
            value={selectedPaddock}
            onChange={e => setSelectedPaddock(e.target.value)}
            className="bg-white/5 border border-white/10 text-gray-300 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500/50"
          >
            {paddockList.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Time range */}
          <div className="flex bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            {(['7d', '30d', '90d', '1y'] as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-black transition-all ${
                  timeRange === r
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {r === '1y' ? '1 año' : r}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10 border-b border-white/10">
        {[
          {
            label: 'Crecimiento actual',
            value: latestPoint ? `${latestPoint.growthRate.toFixed(1)} kg/ha/d` : '—',
            delta: growthDelta,
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            color: 'text-emerald-400',
          },
          {
            label: 'Promedio período',
            value: `${avgGrowth.toFixed(1)} kg/ha/d`,
            icon: <Minus className="w-3.5 h-3.5" />,
            color: 'text-blue-400',
          },
          {
            label: 'Pico registrado',
            value: `${peakGrowth.toFixed(1)} kg/ha/d`,
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            color: 'text-violet-400',
          },
          {
            label: 'Índice sequía',
            value: DROUGHT_LABELS[currentDrought],
            icon: <Droplets className="w-3.5 h-3.5" />,
            color: DROUGHT_COLORS[currentDrought].replace('text-', 'text-').replace('600', '400'),
          },
        ].map((kpi, i) => (
          <div key={i} className="px-5 py-3 flex flex-col gap-1">
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${kpi.color}`}>
              {kpi.icon}
              {kpi.label}
            </div>
            <p className="text-white font-black text-base leading-none">{kpi.value}</p>
            {kpi.delta !== null && kpi.delta !== undefined && (
              <span className={`text-[10px] font-bold ${kpi.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta).toFixed(1)} vs anterior
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="p-6">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.30} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />

            <XAxis
              dataKey="dateLabel"
              tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />

            {/* Left axis: growth rate */}
            <YAxis
              yAxisId="growth"
              orientation="left"
              tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}`}
              label={{ value: 'kg MS/ha/d', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 9, fontWeight: 700 }}
            />

            {/* Right axis: rainfall */}
            <YAxis
              yAxisId="rain"
              orientation="right"
              tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}mm`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 12 }}
              formatter={v => <span style={{ color: '#9ca3af' }}>{v}</span>}
            />

            {/* Drought reference zones */}
            {chartData.filter(p => p.drought >= 2).map((p, i) => (
              <ReferenceLine
                key={`drought-${i}`}
                x={p.dateLabel}
                yAxisId="growth"
                stroke="rgba(239,68,68,0.15)"
                strokeWidth={8}
              />
            ))}

            {/* Optimal growth reference line ~25 kg/ha/d */}
            <ReferenceLine
              yAxisId="growth"
              y={25}
              stroke="rgba(52,211,153,0.3)"
              strokeDasharray="6 3"
              label={{ value: 'Óptimo', fill: '#34d399', fontSize: 9, fontWeight: 700 }}
            />

            {/* Rainfall bars */}
            <Bar
              yAxisId="rain"
              dataKey="rainfall"
              name="Lluvia 7d (mm)"
              fill="rgba(96,165,250,0.25)"
              stroke="rgba(96,165,250,0.5)"
              strokeWidth={1}
              radius={[2, 2, 0, 0]}
            />

            {/* Growth area */}
            <Area
              yAxisId="growth"
              type="monotone"
              dataKey="growthRate"
              name="Crecimiento (kg MS/ha/d)"
              stroke="#34d399"
              strokeWidth={2.5}
              fill="url(#growthGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#34d399', stroke: '#000', strokeWidth: 2 }}
            />

            {/* NDVI line (secondary, right scale normalized) */}
            <Line
              yAxisId="growth"
              type="monotone"
              dataKey="ndvi"
              name="NDVI (0–1)"
              stroke="#a78bfa"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer legend */}
      <div className="px-6 pb-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
          <span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" />
          Crecimiento ajustado por clima
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
          <span className="w-4 h-3 bg-blue-400/30 border border-blue-400/50 inline-block rounded-sm" />
          Lluvia 7 días
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
          <span className="w-4 h-0.5 bg-violet-400 inline-block rounded border-dashed" style={{ borderTop: '1.5px dashed #a78bfa', height: 0 }} />
          NDVI
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500/60">
          <span className="w-4 h-3 bg-red-500/15 border border-red-500/30 inline-block rounded-sm" />
          Zona de sequía
        </div>
        <span className="ml-auto text-[9px] text-gray-600 font-medium">
          Motor: NDVI × lluvia × humedad × sequía × estación
        </span>
      </div>
    </div>
  )
}

export default ClimateAdjustmentChart
