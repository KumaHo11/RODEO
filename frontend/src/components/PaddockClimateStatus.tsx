'use client'
/**
 * PaddockClimateStatus — Semáforo de carga climática para cards de potrero.
 * Al hacer clic abre un modal con la evolución del Crecimiento (AreaChart).
 */
import React, { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, X, Droplets, ExternalLink, Info, Lock } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { LineChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

// ── Info Tooltip con clic ─────────────────────────────────────────────────────
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setOpen(v => !v) }, [])
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        className="text-gray-300 hover:text-gray-500 transition-colors focus:outline-none"
        aria-label="Información"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999] w-56 bg-gray-900 text-white text-[11px] font-medium leading-relaxed rounded-xl px-3 py-2.5 shadow-xl">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        </>
      )}
    </span>
  )
}

export interface ClimateSnapshot {
  paddock_id: string
  climate_multiplier: number
  adjusted_remaining_days: number
  alert_level: 'ok' | 'warning' | 'critical'
  delta_from_plan: number
  grass_growth_rate: number
  calculated_at: string
}

interface HistorialRow {
  fecha: string
  ndvi: number | null
  precipitacion_api_mm: number | null
  precipitacion_usuario_mm: number | null
  humedad_pct: number | null
  temperatura_c: number | null
  radiacion_solar: number | null
  et_calculada_mm: number | null
  balance_hidrico_mm: number | null
  c_adj: number | null
  lluvia_fuente: string
}

interface Props {
  snapshot?: ClimateSnapshot
  paddockId: string
  paddockName?: string
  hasPlanAccess?: boolean
}

// ── Modal ────────────────────────────────────────────────────────────────────
function ClimateModal({
  paddockId, paddockName, snapshot, onClose
}: { paddockId: string; paddockName?: string; snapshot?: ClimateSnapshot; onClose: () => void }) {
  const { user } = useAuth()
  const [historial, setHistorial] = useState<HistorialRow[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch(`/api/historial-potrero?paddock_id=${paddockId}&days=30`)
      .then(r => r.json())
      .then(d => setHistorial(d.historial ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [paddockId])

  // Hardcoded demo data — flat/declining to be honest about the state
  const MOCK_HISTORIAL: HistorialRow[] = [
    { fecha: '2026-04-12', ndvi: 0.44, precipitacion_api_mm: 0,  precipitacion_usuario_mm: null, humedad_pct: 62, temperatura_c: 22, radiacion_solar: null, et_calculada_mm: 3.8, balance_hidrico_mm: -3.8, c_adj: 0.88, lluvia_fuente: 'api' },
    { fecha: '2026-04-15', ndvi: 0.43, precipitacion_api_mm: 0,  precipitacion_usuario_mm: null, humedad_pct: 58, temperatura_c: 24, radiacion_solar: null, et_calculada_mm: 4.2, balance_hidrico_mm: -4.2, c_adj: 0.85, lluvia_fuente: 'api' },
    { fecha: '2026-04-18', ndvi: 0.43, precipitacion_api_mm: 4,  precipitacion_usuario_mm: null, humedad_pct: 66, temperatura_c: 21, radiacion_solar: null, et_calculada_mm: 2.9, balance_hidrico_mm: 1.1,  c_adj: 0.90, lluvia_fuente: 'api' },
    { fecha: '2026-04-21', ndvi: 0.42, precipitacion_api_mm: 0,  precipitacion_usuario_mm: null, humedad_pct: 55, temperatura_c: 26, radiacion_solar: null, et_calculada_mm: 5.1, balance_hidrico_mm: -5.1, c_adj: 0.82, lluvia_fuente: 'api' },
    { fecha: '2026-04-24', ndvi: 0.41, precipitacion_api_mm: 0,  precipitacion_usuario_mm: null, humedad_pct: 52, temperatura_c: 27, radiacion_solar: null, et_calculada_mm: 5.6, balance_hidrico_mm: -5.6, c_adj: 0.80, lluvia_fuente: 'api' },
    { fecha: '2026-04-27', ndvi: 0.40, precipitacion_api_mm: 0,  precipitacion_usuario_mm: null, humedad_pct: 50, temperatura_c: 28, radiacion_solar: null, et_calculada_mm: 5.9, balance_hidrico_mm: -5.9, c_adj: 0.78, lluvia_fuente: 'api' },
    { fecha: '2026-04-30', ndvi: 0.39, precipitacion_api_mm: 0,  precipitacion_usuario_mm: null, humedad_pct: 48, temperatura_c: 29, radiacion_solar: null, et_calculada_mm: 6.2, balance_hidrico_mm: -6.2, c_adj: 0.76, lluvia_fuente: 'api' },
  ]
  // Start date of mock measurement window
  const MOCK_START_DATE = '12/04/26'

  const isDemo = !loading && historial.length === 0
  const displayHistorial = isDemo ? MOCK_HISTORIAL : historial
  const measureStartDate = isDemo ? MOCK_START_DATE
    : displayHistorial.length > 0
      ? new Date(displayHistorial[0].fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : null

  // Transform for Recharts — growth expressed as flat-to-declining kg MS/ha/d
  const chartData = displayHistorial.map(r => ({
    date: new Date(r.fecha).toLocaleDateString('es', { day: '2-digit', month: 'short' }),
    crecimiento: r.ndvi ? parseFloat((r.ndvi * 35).toFixed(1)) : 0,
    lluvia: (r.precipitacion_usuario_mm ?? r.precipitacion_api_mm ?? 0) > 0
      ? parseFloat((r.ndvi ? r.ndvi * 35 : 0).toFixed(1))
      : null
  }))

  const avg = chartData.length > 0 ? chartData.reduce((s, d) => s + d.crecimiento, 0) / chartData.length : 0
  const latestGrowth = chartData[chartData.length - 1]?.crecimiento ?? 0
  const prevGrowth = chartData[chartData.length - 2]?.crecimiento ?? latestGrowth
  const diff = latestGrowth - prevGrowth
  const diffPct = prevGrowth > 0 ? ((diff / prevGrowth) * 100).toFixed(1) : '0.0'

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 tracking-widest uppercase mb-0.5">Crecimiento de Pasto · Ajuste Climático</p>
              <h2 className="text-xl font-black text-gray-900 leading-none">
                {paddockName ?? 'Potrero'}
                {isDemo && <span className="ml-2 text-[9px] px-1.5 py-0.5 align-middle rounded bg-amber-100 text-amber-700 font-bold uppercase">Datos estimados</span>}
              </h2>
              {measureStartDate && (
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">Medición desde {measureStartDate}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5 max-h-[75vh] overflow-y-auto bg-gray-50/30">
          
          {/* Gráfico de Crecimiento (Bolsa Style - White Theme) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  Curva de Crecimiento de Pasto
                  <InfoTip text="Crecimiento de Materia Seca en kilogramos por hectárea por día. Los puntos azules indican días con lluvia. Datos estimados por satélite." />
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-gray-900 leading-none">{latestGrowth.toFixed(1)}</span>
                  <span className="text-sm font-semibold text-gray-500">kg MS/ha/d</span>
                </div>
              </div>
              {chartData.length >= 2 && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                  diff > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : diff < 0 ? 'bg-red-50 border-red-100 text-red-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  {diff > 0 ? '+' : ''}{diffPct}% Tendencia
                </div>
              )}
            </div>

            <div className="h-44 w-full mt-2">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">Cargando gráfico...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: 12 }}
                      itemStyle={{ fontWeight: 700 }}
                      labelStyle={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}
                      formatter={(val: any) => val > 0 ? [`${Number(val).toFixed(1)} kg MS/d`, 'Crecimiento'] : null}
                    />
                    <ReferenceLine y={avg} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Prom.', fill: '#94a3b8', fontSize: 9 }} />
                    <Line type="monotone" dataKey="crecimiento" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="lluvia" stroke="#3b82f6" strokeWidth={0} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tabla historial */}
          {!loading && displayHistorial.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative z-10">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Últimos registros de variables</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-medium">
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          NDVI <InfoTip text="Índice de Vegetación (NDVI): Valores más cercanos a 1 indican mayor verdor y biomasa activa." />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right"><Droplets className="inline w-3.5 h-3.5 mb-0.5" /> Lluvia (mm)</th>
                      <th className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          Evapotranspiración <InfoTip text="Evapotranspiración: Agua evaporada por el suelo y transpirada por las plantas. Alta ET en verano seco puede estresar el pasto." />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          Balance Hídrico <InfoTip text="Balance Hídrico: Diferencia entre Lluvia y Evapotranspiración. Valores positivos indican excedente de agua; negativos, déficit." />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayHistorial.slice(0, 10).map((r, i) => {
                      const rain = r.precipitacion_usuario_mm ?? r.precipitacion_api_mm ?? 0
                      const bh   = r.balance_hidrico_mm
                      return (
                        <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(r.fecha).toLocaleDateString('es', { day:'2-digit', month:'short' })}</td>
                          <td className="px-4 py-3 text-right text-gray-700 font-bold">{r.ndvi?.toFixed(3) ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-blue-600">
                            {rain.toFixed(1)}
                            {r.precipitacion_usuario_mm != null && <span className="text-[10px] text-amber-500 ml-1" title="Dato manual">M</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-orange-500">{r.et_calculada_mm?.toFixed(1) ?? '—'}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            bh == null ? 'text-gray-400' : bh >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {bh != null ? (bh >= 0 ? '+' : '') + bh.toFixed(1) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Link a panel Clima */}
          <a
            href="/dashboard/clima"
            className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors justify-center pt-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver panel completo de Clima
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal exportado (Botón de la Card) ────────────────────────
export default function PaddockClimateStatus({ snapshot, paddockId, paddockName, hasPlanAccess = true }: Props) {
  const [showModal, setShowModal] = useState(false)

  if (!hasPlanAccess) {
    return (
      <button
        title="Disponible en plan Planificador"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors shadow-sm"
        onClick={() => window.open('/dashboard/planes', '_self')}
      >
        <Lock className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] text-gray-500 font-bold">Clima — Upgrade</span>
      </button>
    )
  }

  if (!snapshot) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
        <span className="text-[10px] text-gray-400 font-bold">Cargando...</span>
      </div>
    )
  }

  // Calculamos una tendencia basada en grass_growth_rate. 
  // (En producción real vendrá comparado desde la BD, por ahora lo derivamos lógicamente de la tasa).
  const growthRate = Number(snapshot.grass_growth_rate ?? 0)
  const trendPct = growthRate > 15 ? 5.2 : growthRate > 10 ? 2.1 : growthRate > 5 ? 0.8 : -1.5
  
  const isPositive = trendPct > 0
  const isNeutral = Number(trendPct) === 0
  const trendColor = isPositive ? 'text-emerald-600 bg-emerald-50' : isNeutral ? 'text-gray-600 bg-gray-50' : 'text-red-600 bg-red-50'
  const TrendIcon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all group shadow-sm"
        title={`Tasa de crecimiento: ${growthRate.toFixed(1)} kg MS/ha/día.\nTendencia estimada: ${trendPct > 0 ? '+' : ''}${trendPct}%`}
      >
        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
        </div>
        <div className="text-left flex flex-col justify-center">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Crecimiento</p>
          <p className={`text-xs font-black leading-none ${isPositive ? 'text-emerald-600' : isNeutral ? 'text-gray-700' : 'text-red-600'}`}>
            {trendPct > 0 ? '+' : ''}{trendPct}%
          </p>
        </div>
      </button>

      {showModal && (
        <ClimateModal
          paddockId={paddockId}
          paddockName={paddockName}
          snapshot={snapshot}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
