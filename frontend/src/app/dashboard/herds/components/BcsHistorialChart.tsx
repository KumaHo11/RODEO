'use client'

/**
 * BcsHistorialChart
 * Gráfico de tendencia de Condición Corporal (BCS) para un rodeo.
 * Consume GET /api/historial-rodeo?rodeo_id=<id>&days=90
 * Usa recharts (LineChart) con una referencia visual de la zona óptima (2.5–3.5).
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Dot,
} from 'recharts'
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BcsRecord {
  id: string
  bcs_score: number | null
  bcs_label: string | null
  estimated_weight_kg: number | null
  alert_level: string | null
  confidence: number | null
  source: string
  recorded_at: string
}

interface BcsHistorialChartProps {
  rodeoId: string
  rodeoName?: string
  /** Current bcs_score from the herd — shown as reference if no history yet */
  currentBcs?: number | null
  days?: 30 | 60 | 90 | 180 | 365
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BCS_LABELS: Record<number, string> = {
  1: 'Muy flaco', 2: 'Flaco', 3: 'Moderado', 4: 'Bueno', 5: 'Obeso',
}

function bcsColor(score: number | null): string {
  if (score == null) return '#9ca3af'
  if (score < 2)   return '#ef4444'   // rojo — muy flaco
  if (score < 2.5) return '#f97316'   // naranja — flaco
  if (score < 3.5) return '#22c55e'   // verde — óptimo
  if (score < 4.5) return '#facc15'   // amarillo — exceso
  return '#f43f5e'                    // rosa — obeso
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

function TrendIcon({ pct }: { pct: number | null }) {
  if (pct == null) return null
  if (pct >  0.1) return <TrendingUp   className="w-3.5 h-3.5 text-green-600" />
  if (pct < -0.1) return <TrendingDown className="w-3.5 h-3.5 text-red-500"   />
  return <Minus className="w-3.5 h-3.5 text-gray-400" />
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xl p-3 text-left min-w-[160px]">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
        {fmtDate(d.recorded_at)}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-black tabular-nums"
          style={{ color: bcsColor(d.bcs_score) }}
        >
          {d.bcs_score?.toFixed(1) ?? '—'}
        </span>
        <span className="text-xs text-gray-400 font-bold">/ 5</span>
      </div>
      {d.bcs_label && (
        <p className="text-[10px] font-bold text-gray-500 mt-0.5">{d.bcs_label}</p>
      )}
      {d.estimated_weight_kg && (
        <p className="text-[10px] text-gray-400 mt-1">
          Peso est: <span className="font-bold text-gray-600">{d.estimated_weight_kg} kg</span>
        </p>
      )}
      {d.alert_level && d.alert_level !== 'NINGUNA' && (
        <p className={`text-[9px] font-black uppercase tracking-widest mt-1.5 px-1.5 py-0.5 rounded-full inline-block ${
          d.alert_level === 'URGENTE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        }`}>
          ⚠️ {d.alert_level}
        </p>
      )}
      <p className="text-[8px] text-gray-300 mt-1.5 uppercase tracking-widest">{d.source}</p>
    </div>
  )
}

// ─── Custom Dot ──────────────────────────────────────────────────────────────

function AlertDot(props: any) {
  const { cx, cy, payload } = props
  const isAlert = payload?.alert_level && payload.alert_level !== 'NINGUNA'
  const color = bcsColor(payload?.bcs_score)
  if (isAlert) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="8" fill="#ef4444" fontWeight="900">!</text>
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={2} />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BcsHistorialChart({
  rodeoId,
  rodeoName,
  currentBcs,
  days = 90,
}: BcsHistorialChartProps) {
  const [data,     setData]     = useState<BcsRecord[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [period,   setPeriod]   = useState<30 | 60 | 90 | 180 | 365>(days)

  const load = useCallback(async (d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/historial-rodeo?rodeo_id=${rodeoId}&days=${d}`)
      if (!res.ok) throw new Error('Error al cargar historial')
      const json = await res.json()
      // Sort ascending for chart
      const sorted = (json.historial ?? []).sort(
        (a: BcsRecord, b: BcsRecord) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
      setData(sorted)
    } catch (e: any) {
      setError(e?.message ?? 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [rodeoId])

  useEffect(() => { load(period) }, [load, period])

  // ── Derived metrics ────────────────────────────────────────────────────────
  const latest  = data[data.length - 1]?.bcs_score ?? currentBcs ?? null
  const prev    = data.length >= 2 ? data[data.length - 2]?.bcs_score : null
  const trend   = latest != null && prev != null ? latest - prev : null
  const trendPct = trend != null && prev != null && prev > 0 ? trend / prev : null

  const hasAlerts = data.some(d => d.alert_level && d.alert_level !== 'NINGUNA')

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loading && data.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-5 flex flex-col items-center text-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <p className="text-sm font-black text-amber-700">Sin historial de CC</p>
        <p className="text-[10px] text-amber-500 leading-relaxed max-w-xs">
          Analizá una foto de este rodeo desde la <strong>Bitácora</strong>:
          seleccioná el rodeo en la tarjeta y presioná <strong>✦ Evaluar CC (IA)</strong>.
          Los resultados se graficarán aquí automáticamente.
        </p>
        {currentBcs != null && (
          <div className="mt-1 flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">CC actual</span>
            <span className="text-xl font-black" style={{ color: bcsColor(currentBcs) }}>
              {currentBcs.toFixed(1)}
            </span>
            <span className="text-[10px] text-amber-400 font-bold">/ 5</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-black text-gray-700">
            Tendencia CC{rodeoName ? ` · ${rodeoName}` : ''}
          </p>
          {hasAlerts && (
            <span className="flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" /> Alertas activas
            </span>
          )}
        </div>

        {/* Period selector */}
        <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5">
          {([30, 60, 90, 180, 365] as const).map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${
                period === d
                  ? 'bg-white shadow-sm text-amber-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {d === 365 ? '1a' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs row */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-5 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">CC actual</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums" style={{ color: bcsColor(latest) }}>
              {latest?.toFixed(1) ?? '—'}
            </span>
            <span className="text-[10px] text-gray-400 font-bold">/ 5</span>
          </div>
        </div>

        {trendPct != null && (
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Tendencia</span>
            <div className="flex items-center gap-1">
              <TrendIcon pct={trendPct} />
              <span className={`text-sm font-black ${
                trend! > 0 ? 'text-green-600' : trend! < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                {trend! > 0 ? '+' : ''}{trend?.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {data.length > 0 && (
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Registros</span>
            <span className="text-sm font-black text-gray-600">{data.length}</span>
          </div>
        )}

        {latest != null && (
          <div className="flex flex-col ml-auto">
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Estado</span>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
              latest < 2    ? 'bg-red-100 text-red-700'
              : latest < 2.5  ? 'bg-orange-100 text-orange-700'
              : latest < 3.5  ? 'bg-green-100 text-green-700'
              : latest < 4.5  ? 'bg-yellow-100 text-yellow-700'
              : 'bg-rose-100 text-rose-700'
            }`}>
              {BCS_LABELS[Math.round(latest)] ?? '—'}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pb-3">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-xs text-red-400 font-bold">{error}</p>
          </div>
        ) : data.length < 2 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-1">
            <p className="text-xs text-gray-400 font-bold">Se necesitan al menos 2 registros para graficar</p>
            <p className="text-[10px] text-gray-300">Analizá otra foto del rodeo para ver la tendencia</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />

              {/* Zona óptima BCS 2.5–3.5 */}
              <ReferenceArea
                y1={2.5} y2={3.5}
                fill="#22c55e" fillOpacity={0.06}
                strokeOpacity={0}
              />
              <ReferenceLine y={2.5} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={3.5} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />

              <XAxis
                dataKey="recorded_at"
                tickFormatter={fmtDate}
                tick={{ fontSize: 9, fontWeight: 700, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]}
                tick={{ fontSize: 9, fontWeight: 700, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="bcs_score"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={<AlertDot />}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer legend */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-green-200" />
          <span className="text-[8px] font-bold text-gray-400">Zona óptima 2.5–3.5</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 border-2 border-white shadow" />
          <span className="text-[8px] font-bold text-gray-400">Alerta activa</span>
        </div>
      </div>
    </div>
  )
}
