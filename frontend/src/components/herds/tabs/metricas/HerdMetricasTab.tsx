'use client'

/**
 * HerdMetricasTab — Tab 4: Dashboard analítico del rodeo.
 *
 * Gráficos implementados:
 *  1. EV Histórico (LineChart)
 *  2. Distribución EV (DonutChart)
 *  3. Proyección de Consumo MS (AreaChart + selector horizonte)
 *  4. Historial de Rotaciones (tabla)
 */

import React, { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import {
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, Zap, Leaf, RotateCcw, Loader2, Camera, Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { calculateBaseEV } from '@/lib/grazing/evProjection'
import { useHerds } from '@/lib/context/HerdsContext'
import type { HerdData } from '@/components/HerdModal'
import type { CategoriaComercial } from '@/lib/categorias'
import { HerdWeatherPanel } from '@/components/herds/HerdWeatherPanel'

// ── Tipos internos ────────────────────────────────────────────────────────────

interface EVPoint  { date: string; ev: number;        label?: string }
interface CCPoint  { date: string; score: number;     label?: string }
interface Rotacion { id: string;  occurred_at: string; from_paddock?: string; to_paddock: string; head_count: number; dias?: number }

type Horizonte = '7d' | '30d' | '90d' | '365d'
const HORIZONTES: { key: Horizonte; label: string; dias: number }[] = [
  { key: '7d',   label: '7 días',  dias: 7   },
  { key: '30d',  label: '1 mes',   dias: 30  },
  { key: '90d',  label: '3 meses', dias: 90  },
  { key: '365d', label: '1 año',   dias: 365 },
]

const DONUT_COLORS = ['#16a34a', '#bbf7d0']
const MS_COLORS    = ['#0ea5e9', '#bae6fd']

interface Props { herd: HerdData; onRefresh: () => void }

// ── Helpers ──────────────────────────────────────────────────────────────────

/** EV de un herd dado (usa total_ev si existe, si no lo calcula) */
function herdEV(h: HerdData): number {
  return Number(h.total_ev) || calculateBaseEV(
    h.categoria as CategoriaComercial | null,
    Number(h.avg_weight_kg),
    h.head_count,
  )
}


// ── Component ─────────────────────────────────────────────────────────────────

export default function HerdMetricasTab({ herd }: Props) {
  const { herds } = useHerds()
  const herdId = herd.id!
  const catKey = herd.categoria as CategoriaComercial | null
  const ev     = herdEV(herd)
  const msDay  = Math.round(ev * 11)

  const [evHistory,   setEvHistory]   = useState<EVPoint[]>([])
  const [ccHistory,   setCcHistory]   = useState<CCPoint[]>([])
  const [rotaciones,  setRotaciones]  = useState<Rotacion[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [horizonte,   setHorizonte]   = useState<Horizonte>('30d')

  // Carga datos de historial de BCS / EV y rotaciones
  useEffect(() => {
    async function load() {
      setLoadingData(true)
      try {
        const [bcsRes, movRes] = await Promise.allSettled([
          apiFetch(`/api/historial-rodeo?rodeo_id=${herdId}&days=180`),
          apiFetch(`/api/farm-events?herd_id=${herdId}&event_type=movement&limit=20`),
        ])

        // EV history + CC history desde historial-rodeo
        if (bcsRes.status === 'fulfilled' && bcsRes.value.ok) {
          const data = await bcsRes.value.json()
          const rows = data.historial ?? data ?? []

          // CC history
          const ccPoints: CCPoint[] = rows
            .filter((r: any) => r.bcs_score != null && (r.recorded_at || r.created_at))
            .map((r: any) => ({
              date:  new Date(r.recorded_at || r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
              score: Number(r.bcs_score),
              label: r.bcs_label ?? undefined,
            }))
            .slice(-12)
          setCcHistory(ccPoints)

          // EV history
          const points: EVPoint[] = rows
            .filter((r: any) => r.recorded_at || r.created_at)
            .map((r: any) => ({
              date:  new Date(r.recorded_at || r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
              ev:    r.estimated_weight_kg
                       ? calculateBaseEV(catKey, Number(r.estimated_weight_kg), herd.head_count)
                       : ev,
              label: r.bcs_score ? `CC ${r.bcs_score}/5` : undefined,
            }))
          points.push({ date: 'Hoy', ev: Math.round(ev) })
          setEvHistory(points.slice(-12))
        } else {
          setEvHistory([
            { date: 'Ingreso', ev: Math.round(ev * 0.92) },
            { date: 'Hoy',     ev: Math.round(ev) },
          ])
        }

        // Rotaciones
        if (movRes.status === 'fulfilled' && movRes.value.ok) {
          const data = await movRes.value.json()
          setRotaciones((data.events ?? data ?? []).slice(0, 8))
        }
      } catch { /* silent */ }
      setLoadingData(false)
    }
    load()
  }, [herdId])

  // Proyección de consumo según horizonte seleccionado
  const consumoData = useMemo(() => {
    const hInfo = HORIZONTES.find(h => h.key === horizonte)!
    const totalKg = msDay * hInfo.dias
    return Array.from({ length: Math.min(hInfo.dias, 30) }, (_, i) => {
      const dia = Math.floor((i / 29) * hInfo.dias)
      return {
        dia:  dia === 0 ? '0' : dia === hInfo.dias ? hInfo.label : `${dia}d`,
        msAcum: Math.round(msDay * dia / 1000 * 10) / 10, // toneladas
      }
    })
  }, [msDay, horizonte])

  const hInfo = HORIZONTES.find(h => h.key === horizonte)!
  const totalTn = (msDay * hInfo.dias / 1000).toFixed(1)

  // ── Distribución EV y MS real (datos de todos los rodeos del contexto) ────────
  const distributionData = useMemo(() => {
    if (herds.length === 0) return null

    const totalEV  = herds.reduce((s, h) => s + herdEV(h), 0)
    const totalMS  = herds.reduce((s, h) => s + Math.round(herdEV(h) * 11), 0)
    const restEV   = totalEV - ev
    const restMS   = totalMS - msDay
    const pctEV    = totalEV > 0 ? Math.round((ev  / totalEV) * 100) : 0
    const pctMS    = totalMS > 0 ? Math.round((msDay / totalMS) * 100) : 0

    return {
      totalEV, totalMS, restEV, restMS,
      pctEV, pctMS,
      donutEV: [
        { name: 'Este rodeo', value: ev,     pct: pctEV },
        { name: 'Resto',      value: restEV,  pct: 100 - pctEV },
      ],
      donutMS: [
        { name: 'Este rodeo', value: msDay,  pct: pctMS },
        { name: 'Resto',      value: restMS,  pct: 100 - pctMS },
      ],
    }
  }, [herds, ev, msDay])

  const evInicial = evHistory[0]?.ev ?? Math.round(ev * 0.92)
  const evDelta   = ev - evInicial
  const evDeltaPct = evInicial > 0 ? Math.round((evDelta / evInicial) * 100) : 0

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-5xl">

      {loadingData && (
        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Cargando datos históricos…
        </div>
      )}

      {/* ── Row 1: EV Histórico + Distribución ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* EV histórico */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                EV Histórico
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-black text-gray-900 tabular-nums">{Math.round(ev).toLocaleString('es-AR')}</span>
                <span className={clsx(
                  'text-xs font-black px-2 py-0.5 rounded-full',
                  evDeltaPct >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                )}>
                  {evDeltaPct >= 0 ? '+' : ''}{evDeltaPct}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400">EV inicial</p>
              <p className="text-lg font-black text-gray-500 tabular-nums">{Math.round(evInicial).toLocaleString('es-AR')}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={evHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb' }}
                formatter={(v: any) => [Number(v).toLocaleString('es-AR'), 'EV']}
              />
              <ReferenceLine y={evInicial} stroke="#d1d5db" strokeDasharray="4 2" label={{ value: 'EV inicial', fontSize: 9, fill: '#9ca3af' }} />
              <Line type="monotone" dataKey="ev" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: '#16a34a' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut: Distribución EV + MS — datos reales */}
        <div className="lg:col-span-2 space-y-4">

          {/* EV Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Distribución EV
            </p>
            {distributionData ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={distributionData.donutEV}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {distributionData.donutEV.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 8 }}
                      formatter={(v: any) =>
                        `${Math.round(Number(v)).toLocaleString('es-AR')} EV` as any
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {distributionData.donutEV.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }} />
                      <span className="text-[10px] font-bold text-gray-600 flex-1">{d.name}</span>
                      <span className="text-[10px] font-black text-gray-700 tabular-nums">{d.pct}%</span>
                      <span className="text-[9px] text-gray-400 tabular-nums">
                        {Math.round(d.value).toLocaleString('es-AR')} EV
                      </span>
                    </div>
                  ))}
                  <p className="text-[9px] text-gray-300 font-medium pt-1 border-t border-gray-50">
                    Total campo: {distributionData.totalEV.toLocaleString('es-AR')} EV
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-6">Sin datos comparativos</p>
            )}
          </div>

          {/* MS Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-emerald-500" />
              Consumo MS
            </p>
            {distributionData ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={distributionData.donutMS}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {distributionData.donutMS.map((_, i) => (
                        <Cell key={i} fill={MS_COLORS[i % MS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 8 }}
                      formatter={(v: any) =>
                        `${Math.round(Number(v)).toLocaleString('es-AR')} kg MS/d` as any
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {distributionData.donutMS.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MS_COLORS[i] }} />
                      <span className="text-[10px] font-bold text-gray-600 flex-1">{d.name}</span>
                      <span className="text-[10px] font-black text-gray-700 tabular-nums">{d.pct}%</span>
                      <span className="text-[9px] text-gray-400 tabular-nums">
                        {Math.round(d.value).toLocaleString('es-AR')} kg/d
                      </span>
                    </div>
                  ))}
                  <p className="text-[9px] text-gray-300 font-medium pt-1 border-t border-gray-50">
                    Total campo: {distributionData.totalMS.toLocaleString('es-AR')} kg MS/día
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-6">Sin datos comparativos</p>
            )}
          </div>

        </div>
      </div>

      {/* ── Row 2: Proyección de Consumo MS ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-emerald-500" />
              Proyección de Consumo MS
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <span className="text-xl font-black text-gray-900 tabular-nums">{msDay.toLocaleString('es-AR')}</span>
                <span className="text-xs font-bold text-gray-400 ml-1">kg MS/día</span>
              </div>
              <div>
                <span className="text-xl font-black text-emerald-700 tabular-nums">{totalTn}</span>
                <span className="text-xs font-bold text-gray-400 ml-1">tn en {hInfo.label}</span>
              </div>
            </div>
          </div>
          {/* Selector horizonte */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            {HORIZONTES.map(h => (
              <button
                key={h.key}
                onClick={() => setHorizonte(h.key)}
                className={clsx(
                  'px-2.5 py-1 text-[10px] font-black rounded-lg transition-all',
                  horizonte === h.key
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={consumoData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} unit=" tn" />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb' }}
              formatter={(v: any) => [`${v} tn`, 'MS acumulado']}
            />
            <Area type="monotone" dataKey="msAcum" stroke="#10b981" strokeWidth={2} fill="url(#gradMs)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 3: Hist           <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Fecha', 'De potrero', 'A potrero', 'Cabezas', 'Días'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[9px] font-black text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rotaciones.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-300 italic animate-pulse">
                        Cargando rotaciones…
                      </td>
                    </tr>
                  )
                  : rotaciones.map((r, i) => (
                    <tr key={r.id ?? i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 font-bold text-gray-700">
                        {new Date(r.occurred_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{r.from_paddock ?? '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-800">{r.to_paddock ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 tabular-nums">{r.head_count}</td>
                      <td className="px-3 py-2.5 text-gray-500 tabular-nums">{r.dias != null ? `${r.dias}d` : '—'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Gráfico Evolución Condición Corporal (CC) ────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 flex-1">
            <Camera className="w-3.5 h-3.5 text-pink-500" />
            Evolución de Condición Corporal
          </p>
          {ccHistory.length > 0 && (
            <span className="text-[10px] font-bold text-pink-600 bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-full">
              Escala 1–5
            </span>
          )}
        </div>

        {ccHistory.length === 0 ? (
          /* Empty state CC */
          <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-pink-300" />
            </div>
            <p className="text-sm font-bold text-gray-500 mb-1">Sin historial de CC</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Analizá una foto de este rodeo desde la <strong className="text-gray-600">Bitácora</strong> para generar este gráfico automáticamente.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ccHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              {/* Líneas de referencia de estados */}
              <ReferenceLine y={2} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: 'Bajo', fontSize: 9, fill: '#fbbf24', position: 'insideLeft' }} />
              <ReferenceLine y={4} stroke="#16a34a" strokeDasharray="4 2" label={{ value: 'Óptimo', fontSize: 9, fill: '#16a34a', position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: any) => [`${Number(v).toFixed(1)}/5`, 'CC']}
              />
              <Line
                type="monotone" dataKey="score"
                stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Clima y Bienestar THI ────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
          Clima y bienestar del rodeo
        </p>
        <HerdWeatherPanel msDay={msDay} />
      </div>

    </div>
  )
}
