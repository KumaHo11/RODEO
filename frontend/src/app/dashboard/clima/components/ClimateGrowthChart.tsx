'use client'
/**
 * ClimateGrowthChart — Gráfico de área con gradiente.
 * 10 días histórico (sólido) + hasta 14 días de proyección (semi-transparente).
 * Lluvia como barras sutiles en eje secundario.
 * Guarda la proyección calculada en backend para reportes históricos.
 */
import { useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Text,
} from 'recharts'
import { useWeather, type WeatherDay } from '@/lib/context/WeatherContext'
import { apiFetch } from '@/lib/apiFetch'

// ── Temporada climática (NOAA ONI — actualizar mensualmente) ──────────────────
const CURRENT_SEASON = 'Neutro' // 'El Niño' | 'La Niña' | 'Neutro'

// ── Factores de proyección ────────────────────────────────────────────────────
function rainFactor(mm: number)   { return mm > 10 ? 1.2 : mm > 2 ? 1.0 : 0.85 }
function tempFactor(maxC: number) { return maxC < 5 ? 0.6 : maxC < 10 ? 0.8 : maxC <= 26 ? 1.0 : 0.85 }
function humidFactor(pct: number) { return pct > 70 ? 1.1 : pct >= 40 ? 1.0 : 0.85 }
function windFactor(kmh: number)  { return kmh > 80 ? 0.8 : kmh > 60 ? 0.9 : 1.0 }

function projectGrowth(base: number, d: WeatherDay) {
  return parseFloat(Math.max(0,
    base * rainFactor(d.precipitationMm) * tempFactor(d.maxTempC) * humidFactor(d.humidityPct) * windFactor(d.windSpeedKmh)
  ).toFixed(1))
}

function overallCondition(avg: number, base: number): { label: string; color: string } {
  const r = avg / Math.max(base, 1)
  if (r >= 1.05) return { label: 'Condiciones favorables', color: 'text-emerald-600' }
  if (r >= 0.90) return { label: 'Condiciones normales', color: 'text-gray-500' }
  if (r >= 0.75) return { label: 'Déficit hídrico moderado', color: 'text-amber-600' }
  return { label: 'Crecimiento limitado por clima', color: 'text-red-500' }
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const hist = payload.find((p: any) => p.dataKey === 'growth')
  const proj = payload.find((p: any) => p.dataKey === 'projection')
  const rain = payload.find((p: any) => p.dataKey === 'rain')
  const val  = hist ?? proj
  const isProjected = !hist?.value && proj?.value

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-3.5 py-3 shadow-xl text-xs min-w-[140px]">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      {val?.value != null && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-black text-gray-900">{Number(val.value).toFixed(1)}</span>
          <span className="text-gray-400 font-medium">kg MS/ha/d</span>
          {isProjected && <span className="text-[9px] text-gray-400">(proy.)</span>}
        </div>
      )}
      {rain?.value > 0 && (
        <p className="text-blue-500 font-semibold mt-1">{rain.value} mm lluvia</p>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  baseGrowthRate: number
  historicalGrowth?: { date: string; growthRate: number }[]
}

export function ClimateGrowthChart({ baseGrowthRate, historicalGrowth = [] }: Props) {
  const { history, forecast, isLoading } = useWeather()
  const savedProjection = useRef(false)

  const { chartData, avgHistorical, projAvg, totalRain, forecastDays } = useMemo(() => {
    if (!history.length && !forecast.length) return { chartData: [], avgHistorical: 0, projAvg: 0, totalRain: 0, forecastDays: 0 }

    const histMap = new Map(historicalGrowth.map(h => [h.date, h.growthRate]))
    const futureDays = forecast.filter(d => !d.isPast)

    // Historical
    const histPoints = history.map(d => ({
      date: new Date(d.date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' }),
      isoDate: d.date,
      growth: histMap.get(d.date) ?? parseFloat((baseGrowthRate * rainFactor(d.precipitationMm) * tempFactor(d.maxTempC) * humidFactor(d.humidityPct) * windFactor(d.windSpeedKmh)).toFixed(1)),
      rain: d.precipitationMm,
      projection: null as number | null,
    }))

    // Today (bridge between historical and projected)
    const today = futureDays[0]
    const todayPoint = today ? {
      date: 'Hoy',
      isoDate: today.date,
      growth: baseGrowthRate,
      rain: today.precipitationMm,
      projection: baseGrowthRate, // bridge point — both lines meet here
    } : null

    // Projected
    const projPoints = futureDays.slice(1).map(d => ({
      date: new Date(d.date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' }),
      isoDate: d.date,
      growth: null as number | null,
      rain: d.precipitationMm,
      projection: projectGrowth(baseGrowthRate, d),
    }))

    const all = [...histPoints, ...(todayPoint ? [todayPoint] : []), ...projPoints]

    const hGrowths = histPoints.map(p => p.growth).filter(Boolean) as number[]
    const avgH = hGrowths.length ? hGrowths.reduce((a, b) => a + b, 0) / hGrowths.length : baseGrowthRate
    const pGrowths = projPoints.map(p => p.projection).filter(Boolean) as number[]
    const avgP = pGrowths.length ? pGrowths.reduce((a, b) => a + b, 0) / pGrowths.length : baseGrowthRate
    const rain = all.reduce((s, d) => s + (d.rain ?? 0), 0)

    return {
      chartData: all,
      avgHistorical: parseFloat(avgH.toFixed(1)),
      projAvg: parseFloat(avgP.toFixed(1)),
      totalRain: parseFloat(rain.toFixed(1)),
      forecastDays: futureDays.length - 1,
    }
  }, [history, forecast, baseGrowthRate, historicalGrowth])

  // Save projection to backend once
  useEffect(() => {
    if (savedProjection.current || !chartData.length) return
    const series = chartData.filter(d => d.projection != null && d.growth == null).map(d => ({
      date: d.isoDate, kg_estimated: d.projection, rain_mm: d.rain,
    }))
    if (!series.length) return
    savedProjection.current = true
    apiFetch('/api/climate-projections', {
      method: 'POST',
      body: JSON.stringify({ series, meta: { baseGrowthRate, seasonLabel: CURRENT_SEASON } }),
    }).catch(() => {})
  }, [chartData, baseGrowthRate])

  const condition = overallCondition(avgHistorical, baseGrowthRate)
  const diff = parseFloat((projAvg - avgHistorical).toFixed(1))
  const diffSign = diff > 0 ? '+' : ''

  if (isLoading) return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm h-full flex items-center justify-center">
      <p className="text-xs text-gray-400 font-medium">Cargando datos climáticos…</p>
    </div>
  )
  if (!chartData.length) return null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 h-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
            Crecimiento de pasto · {history.length}d + {forecastDays}d proyectado
          </p>
          <p className={`text-xs font-semibold ${condition.color}`}>{condition.label}</p>
        </div>
        <span className="text-[10px] text-gray-400 font-medium">
          Temporada <span className="font-black text-gray-600">{CURRENT_SEASON}</span>
        </span>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <div>
          <p className="text-lg font-black text-gray-900 leading-none">{avgHistorical} <span className="text-xs font-semibold text-gray-400">kg/ha/d</span></p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Prom. histórico</p>
        </div>
        <div>
          <p className={`text-lg font-black leading-none ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-900'}`}>
            {diffSign}{diff} <span className="text-xs font-semibold text-gray-400">kg/ha/d</span>
          </p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Proyección vs. hoy</p>
        </div>
        <div>
          <p className="text-base font-black text-gray-900 leading-none">{totalRain} <span className="text-xs font-semibold text-gray-400">mm</span></p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Lluvia acumulada</p>
        </div>
        <div>
          <p className="text-base font-black text-gray-900 leading-none">{baseGrowthRate} <span className="text-xs font-semibold text-gray-400">kg/ha/d</span></p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Base del campo</p>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="h-48 w-full -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
            <defs>
              {/* Gradiente histórico — sólido a base */}
              <linearGradient id="gradHistorico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              {/* Gradiente proyectado — más suave */}
              <linearGradient id="gradProyeccion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f8fafc" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={(props: any) => {
                const { x, y, payload } = props
                const isToday = payload.value === 'Hoy'
                return (
                  <Text
                    x={x}
                    y={y + 6}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={isToday ? 900 : 600}
                    fill={isToday ? '#10b981' : '#94a3b8'}
                  >
                    {payload.value}
                  </Text>
                )
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
              width={36}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#bfdbfe', fontWeight: 600 }}
              width={24}
              tickFormatter={v => v > 0 ? `${v}` : ''}
            />
            <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

            {/* Línea vertical Hoy — sutil, verde */}
            <ReferenceLine
              yAxisId="left"
              x="Hoy"
              stroke="#10b981"
              strokeWidth={1}
              strokeOpacity={0.4}
              strokeDasharray="4 3"
              label={{ value: 'HOY', position: 'insideTopRight', fontSize: 8, fontWeight: 900, fill: '#10b981', opacity: 0.7 }}
            />

            {/* Promedio como referencia */}
            <ReferenceLine
              yAxisId="left"
              y={avgHistorical}
              stroke="#e2e8f0"
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: `${avgHistorical}`, fill: '#cbd5e1', fontSize: 9, position: 'right' }}
            />

            {/* Barras lluvia — fondo sutil */}
            <Bar
              yAxisId="right"
              dataKey="rain"
              fill="#bfdbfe"
              opacity={0.5}
              radius={[2, 2, 0, 0]}
              maxBarSize={6}
            />

            {/* Área histórica — línea limpia sin relleno */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="growth"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="none"
              dot={false}
              activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
              connectNulls={false}
            />

            {/* Área proyectada — punteada sin relleno */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="projection"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeOpacity={0.5}
              fill="none"
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Leyenda ── */}
      <div className="flex items-center gap-5 -mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-blue-500 rounded" />
          <p className="text-[9px] text-gray-400 font-medium">Histórico</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '2px dashed #10b981' }} />
          <p className="text-[9px] text-gray-400 font-medium">Proyección</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 bg-blue-200 rounded-sm" />
          <p className="text-[9px] text-gray-400 font-medium">Lluvia</p>
        </div>
      </div>
    </div>
  )
}
