'use client'
/**
 * ForageVigorMonitor — Gráfico unificado de clima + pasto + animal
 * Series: Crecimiento, NDVI, Ración Ajustada, ΔCC (condición corporal)
 */
import React, { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Lock, Info } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ── tipos ─────────────────────────────────────────────────────────────────────

interface SnapshotPoint {
  paddock_id: string
  calculated_at: string
  grass_growth_rate?: number
  ndvi?: number
  climate_multiplier?: number
  rainfall_7d_mm?: number
}

// ── mock data (demo) ──────────────────────────────────────────────────────────

const MOCK_SNAPSHOTS: SnapshotPoint[] = (() => {
  const dates = ['2026-04-10','2026-04-15','2026-04-20','2026-04-25','2026-04-30']
  const paddocks = [{ id:'1' },{ id:'2' },{ id:'3' }]
  const out: SnapshotPoint[] = []
  paddocks.forEach((p, pi) => {
    const g = 12 + pi * 2
    dates.forEach((d, di) => {
      out.push({
        paddock_id: p.id, calculated_at: d,
        grass_growth_rate: g + di * 1.5 + Math.random(),
        ndvi: 0.35 + pi * 0.07 + di * 0.01,
        climate_multiplier: 0.9 + Math.random() * 0.2,
        rainfall_7d_mm: 10 + di * 5,
      })
    })
  })
  return out
})()

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const SERIES = [
  { key: 'Crecimiento',    label: 'Crecimiento',    unit: 'kg MS/ha/d', color: '#10b981', axis: 'left'  },
  { key: 'NDVI',           label: 'NDVI',           unit: '',           color: '#3b82f6', axis: 'right' },
  { key: 'RacionAjustada', label: 'Ración Ajust.',  unit: 'kg/EV/d',   color: '#f59e0b', axis: 'left'  },
  { key: 'DeltaCC',        label: 'ΔCC',            unit: 'u/día',      color: '#8b5cf6', axis: 'right' },
  { key: 'Lluvia',         label: 'Lluvia 7d',      unit: 'mm/día',     color: '#bae6fd', axis: 'right' },
] as const

type SeriesKey = typeof SERIES[number]['key']

// ── custom tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-3 text-[11px] min-w-[160px]">
      <p className="font-black text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-600 font-medium">{p.name}</span>
          </span>
          <span className="font-black text-gray-900">{
            typeof p.value === 'number'
              ? p.dataKey === 'NDVI' ? p.value.toFixed(3)
              : p.dataKey === 'DeltaCC' ? (p.value > 0 ? '+' : '') + p.value.toFixed(3)
              : p.value.toFixed(1)
              : '—'
          }</span>
        </div>
      ))}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props { hasPlanAccess?: boolean; className?: string }

export default function ForageVigorMonitor({ hasPlanAccess = true, className = '' }: Props) {
  const { user } = useAuth()
  const [data, setData]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [noAccess, setNoAccess] = useState(false)
  const [trend, setTrend]     = useState<{ value: number; diff: number; direction: 'up'|'down'|'flat'; pct: number }>({ value: 0, diff: 0, direction: 'flat', pct: 0 })
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(['Crecimiento','NDVI','RacionAjustada']))

  const toggle = (k: SeriesKey) =>
    setVisible(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null); setNoAccess(false)
    try {
      let raw: SnapshotPoint[] = []
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/climate-adjustment', { headers: { Authorization: `Bearer ${token}` } })
        if (res.status === 403) {
          // Plan insuficiente — mostrar mensaje de acceso en lugar de "sin datos"
          setNoAccess(true)
          setData([])
          setLoading(false)
          return
        }
        if (res.ok) raw = (await res.json()).snapshots ?? []
        else setError(`Error al cargar datos (${res.status})`)
      } catch (fetchErr) { /* silencioso — sin conexión */ }

      if (raw.length === 0 && user?.email === 'javi.osorio.1@gmail.com') raw = MOCK_SNAPSHOTS
      if (raw.length === 0) { setData([]); setLoading(false); return }


      // Agrupar por día
      const map = new Map<string, any>()
      raw.forEach((s: any) => {
        const d = s.calculated_at.split('T')[0]
        const e = map.get(d) || { date: d, formattedDate: fmt(d), sG: 0, cG: 0, sN: 0, cN: 0, sM: 0, cM: 0, sR: 0, cR: 0 }
        if (s.grass_growth_rate != null) { e.sG += Number(s.grass_growth_rate); e.cG++ }
        if (s.ndvi != null)              { e.sN += Number(s.ndvi);               e.cN++ }
        if (s.climate_multiplier != null){ e.sM += Number(s.climate_multiplier); e.cM++ }
        if (s.rainfall_7d_mm != null)    { e.sR += Number(s.rainfall_7d_mm);     e.cR++ }
        map.set(d, e)
      })

      const BASE_RATION = 12 // kg MS/EV/d estándar

      const sorted = Array.from(map.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(e => {
          const mult = e.cM > 0 ? e.sM / e.cM : 1
          const racionAjustada = parseFloat((BASE_RATION * mult).toFixed(2))
          // ΔCC proxy: si el mult < 1 el animal pierde condición, si > 1 puede mejorar
          const deltaCC = parseFloat(((mult - 1) * 0.05).toFixed(4))
          return {
            date: e.date,
            formattedDate: e.formattedDate,
            'Crecimiento':    e.cG > 0 ? parseFloat((e.sG / e.cG).toFixed(1)) : undefined,
            'NDVI':           e.cN > 0 ? parseFloat((e.sN / e.cN).toFixed(3)) : undefined,
            'RacionAjustada': racionAjustada,
            'DeltaCC':        deltaCC,
            'Lluvia':         e.cR > 0 ? parseFloat((e.sR / e.cR / 7).toFixed(1)) : undefined,
            _mult: mult,
          }
        })

      setData(sorted)

      if (sorted.length >= 2) {
        const last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2]
        const diff = (last['Crecimiento'] ?? 0) - (prev['Crecimiento'] ?? 0)
        const pct  = (prev['Crecimiento'] ?? 0) > 0 ? Math.round((diff / prev['Crecimiento']!) * 100) : 0
        setTrend({ value: last['Crecimiento'] ?? 0, diff, direction: Math.abs(diff) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down', pct })
      } else if (sorted.length === 1) {
        setTrend({ value: sorted[0]['Crecimiento'] ?? 0, diff: 0, direction: 'flat', pct: 0 })
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  if (!hasPlanAccess) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-gray-50 p-6 flex items-center gap-4 ${className}`}>
        <div className="p-3 rounded-xl bg-gray-100 border border-gray-200"><Lock className="w-5 h-5 text-gray-400" /></div>
        <div>
          <p className="text-sm font-bold text-gray-900">Monitor Unificado</p>
          <p className="text-xs text-gray-500 mt-0.5">Disponible en plan Planificador o superior.</p>
        </div>
      </div>
    )
  }

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const trendColor = trend.direction === 'up' ? 'text-emerald-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'

  // Current values from last data point
  const last = data[data.length - 1]
  const currentMult  = last?._mult ?? 1
  const currentRacion = last?.['RacionAjustada'] ?? 12
  const rationDiff   = parseFloat((currentRacion - 12).toFixed(1))

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col ${className}`}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-5">
          {/* Crecimiento */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              Crecimiento <span title="Promedio diario kg MS/ha/d"><Info className="w-3 h-3 text-gray-300" /></span>
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-gray-900">{trend.value.toFixed(1)}</span>
              <span className="text-xs text-gray-400">kg MS/ha/d</span>
            </div>
            {data.length >= 2 && (
              <div className={`flex items-center gap-1 text-xs font-bold mt-0.5 ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                {trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(1)} ({trend.pct > 0 ? '+' : ''}{trend.pct}%)
              </div>
            )}
          </div>

          {/* Ración ajustada */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Ración ajustada</p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${rationDiff < 0 ? 'text-orange-600' : rationDiff > 0 ? 'text-blue-700' : 'text-gray-900'}`}>
                {currentRacion.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400">kg/EV/d</span>
            </div>
            <div className={`text-[10px] font-bold ${rationDiff < 0 ? 'text-orange-500' : rationDiff > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
              {rationDiff === 0 ? 'Sin ajuste' : `${rationDiff > 0 ? '+' : ''}${rationDiff} kg vs base`}
              {' '}· ×{currentMult.toFixed(2)} clim.
            </div>
          </div>

          {/* ΔCC */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">ΔCC estimado</p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${(last?.['DeltaCC'] ?? 0) < 0 ? 'text-red-500' : (last?.['DeltaCC'] ?? 0) > 0 ? 'text-emerald-600' : 'text-gray-700'}`}>
                {last ? ((last['DeltaCC'] ?? 0) > 0 ? '+' : '') + (last['DeltaCC'] ?? 0).toFixed(3) : '—'}
              </span>
              <span className="text-xs text-gray-400">u/día</span>
            </div>
            <p className="text-[10px] text-gray-400">
              {(last?.['DeltaCC'] ?? 0) < -0.01 ? '⬇ Pérdida de CC' : (last?.['DeltaCC'] ?? 0) > 0.01 ? '⬆ Ganancia de CC' : 'CC estable'}
            </p>
          </div>
        </div>

        <button onClick={load} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors" title="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Series toggles ── */}
      <div className="flex flex-wrap gap-1.5 px-5 pt-3">
        {SERIES.map(s => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black transition-all border ${
              visible.has(s.key)
                ? 'text-white border-transparent shadow-sm'
                : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
            }`}
            style={visible.has(s.key) ? { backgroundColor: s.color, borderColor: s.color } : {}}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: visible.has(s.key) ? '#fff' : s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Gráfico ── */}
      <div className="px-5 py-4 flex-1 min-h-[180px]">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-gray-400 text-sm font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500 text-sm font-medium bg-red-50 rounded-xl">{error}</div>
        ) : noAccess ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 bg-amber-50 rounded-xl border border-amber-100 border-dashed px-4 text-center">
            <Lock className="w-5 h-5 text-amber-400" />
            <p className="text-sm font-bold text-amber-700">Plan insuficiente</p>
            <p className="text-[10px] font-medium text-amber-500 uppercase tracking-widest">Disponible en Planificador o superior</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
            <p className="text-sm font-bold text-gray-500">Sin datos históricos</p>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Ejecutá el cálculo desde Clima</p>
          </div>
        ) : (

          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />

              {/* Left Y: kg values (Crecimiento + Ración) */}
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#10b981', fontWeight: 600 }} domain={['auto','auto']} />

              {/* Right Y: 0-1 values (NDVI + ΔCC) */}
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#3b82f6', fontWeight: 600 }} domain={['auto','auto']} />

              <RechartsTooltip content={<CustomTooltip />} />

              {/* Lluvia: bar, right axis, light */}
              {visible.has('Lluvia') && (
                <Bar yAxisId="right" dataKey="Lluvia" name="Lluvia 7d" fill="#bae6fd" opacity={0.5} radius={[3,3,0,0]} barSize={8} />
              )}

              {/* Crecimiento */}
              {visible.has('Crecimiento') && (
                <Line yAxisId="left" type="monotone" dataKey="Crecimiento" name="Crecimiento" stroke="#10b981" strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls />
              )}

              {/* Ración Ajustada */}
              {visible.has('RacionAjustada') && (
                <Line yAxisId="left" type="monotone" dataKey="RacionAjustada" name="Ración Ajust." stroke="#f59e0b" strokeWidth={2}
                  strokeDasharray="5 3" dot={{ r: 2, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 4 }} connectNulls />
              )}

              {/* NDVI */}
              {visible.has('NDVI') && (
                <Line yAxisId="right" type="monotone" dataKey="NDVI" name="NDVI" stroke="#3b82f6" strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls />
              )}

              {/* ΔCC */}
              {visible.has('DeltaCC') && (
                <Line yAxisId="right" type="monotone" dataKey="DeltaCC" name="ΔCC" stroke="#8b5cf6" strokeWidth={2}
                  strokeDasharray="3 3" dot={{ r: 2, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 4 }} connectNulls />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Leyenda explicativa ── */}
      {data.length > 0 && (
        <div className="px-5 pb-4 flex flex-wrap gap-3 text-[9px] text-gray-400 font-medium border-t border-gray-50 pt-3">
          <span><span className="font-black text-emerald-600">Crecimiento</span> — kg MS/ha/d promedio de potreros</span>
          <span><span className="font-black text-amber-500">Ración Ajust.</span> — base 12 kg/EV × mult. climático</span>
          <span><span className="font-black text-blue-500">NDVI</span> — vigor fotosintético 0→1</span>
          <span><span className="font-black text-violet-500">ΔCC</span> — variación CC estimada por día</span>
        </div>
      )}
    </div>
  )
}
