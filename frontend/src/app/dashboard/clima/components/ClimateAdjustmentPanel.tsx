'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import {
  RefreshCw, Loader2, Lock, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaddockResult {
  paddock: { id: string; name: string; areaHa: number; status: string }
  totalEv: number
  inputSummary: {
    ndvi: number; rainfall7dMm: number; humidity: number
    drought: string; forageMsHa: number
  }
  result: {
    adjustedRemainingDays: number; baseRemainingDays: number
    grassGrowthRateKgHaDay: number; climateMultiplier: number
    alertLevel: 'ok' | 'warning' | 'critical'
    alertMessage: string | null; deltaFromPlan: number
    multiplierBreakdown: {
      ndviMultiplier: number; rainfallMultiplier: number
      humidityMultiplier: number; droughtMultiplier: number
      windMultiplier: number; seasonalMultiplier: number
    }
  }
}

interface Snapshot {
  paddock_name: string; adjusted_remaining_days: number
  base_remaining_days: number; grass_growth_rate: number
  alert_level: string; calculated_at: string
  climate_multiplier: number
}

// ─── Alert badge ──────────────────────────────────────────────────────────────

function AlertBadge({ level }: { level: string }) {
  if (level === 'ok') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Normal
    </span>
  )
  if (level === 'warning') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Advertencia
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Crítico
    </span>
  )
}

// ─── Sparkline — stock-market style ──────────────────────────────────────────

function DaysSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-10 flex items-center justify-center text-[10px] text-gray-300">sin historial</div>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 100 / (data.length - 1)
  const pts = data.map((v, i) => `${i * w},${100 - ((v - min) / range) * 100}`)
  const last = data[data.length - 1]
  const first = data[0]
  const rising = last >= first
  const stroke = rising ? '#16a34a' : '#dc2626'
  return (
    <div className="h-10 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={`${(data.length - 1) * w}`}
          cy={`${100 - ((last - min) / range) * 100}`}
          r="5"
          fill={stroke}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

// ─── Paddock row (Ajuste tab) ─────────────────────────────────────────────────

function PaddockRow({ result, onRecalculate }: {
  result: PaddockResult
  onRecalculate: (id: string, mm?: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [manualMm, setManualMm] = useState('')
  const [recalculating, setRecalculating] = useState(false)
  const { result: r, paddock, inputSummary, totalEv } = result
  const delta = r.deltaFromPlan
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaColor = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      r.alertLevel === 'critical' ? 'border-red-200 bg-red-50/20' :
      r.alertLevel === 'warning'  ? 'border-amber-200 bg-amber-50/10' :
      'border-gray-100 bg-white'
    }`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-gray-900 truncate">{paddock.name}</span>
            <AlertBadge level={r.alertLevel} />
          </div>
          <p className="text-xs text-gray-400 font-medium mt-0.5">{paddock.areaHa} ha · {totalEv.toFixed(1)} EV</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-black leading-none ${
            r.adjustedRemainingDays <= 3 ? 'text-red-600' :
            r.adjustedRemainingDays <= 7 ? 'text-amber-600' : 'text-gray-900'
          }`}>{r.adjustedRemainingDays}d</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">estadía</p>
        </div>
        <div className={`flex items-center gap-0.5 shrink-0 ${deltaColor}`}>
          <DeltaIcon className="w-4 h-4" />
          <span className="text-sm font-black">{delta >= 0 ? '+' : ''}{delta}d</span>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm font-black text-emerald-600">{r.grassGrowthRateKgHaDay}</p>
          <p className="text-[10px] text-gray-400 font-bold">kg/ha/d</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-300 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />}
      </button>

      {r.alertMessage && (
        <div className={`px-5 py-2.5 border-t text-xs font-medium leading-snug ${
          r.alertLevel === 'critical' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'
        }`}>{r.alertMessage}</div>
      )}

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Inputs */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Variables de entrada</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'NDVI',      value: inputSummary.ndvi.toFixed(3) },
                { label: 'Lluvia 7d', value: `${inputSummary.rainfall7dMm.toFixed(0)} mm` },
                { label: 'Humedad',   value: `${inputSummary.humidity.toFixed(0)}%` },
                { label: 'Sequía',    value: inputSummary.drought },
                { label: 'Forraje',   value: `${Number(inputSummary.forageMsHa).toLocaleString('es-AR')} kg` },
                { label: 'Mult.',     value: `×${r.climateMultiplier.toFixed(3)}` },
              ].map(m => (
                <div key={m.label} className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs font-black text-gray-800">{m.value}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Multiplicadores */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Desglose multiplicadores</p>
            <div className="space-y-1.5">
              {Object.entries({
                'NDVI': r.multiplierBreakdown.ndviMultiplier,
                'Lluvia': r.multiplierBreakdown.rainfallMultiplier,
                'Humedad': r.multiplierBreakdown.humidityMultiplier,
                'Sequía': r.multiplierBreakdown.droughtMultiplier,
                'Viento': r.multiplierBreakdown.windMultiplier,
                'Estación': r.multiplierBreakdown.seasonalMultiplier,
              }).map(([label, val]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 w-16 shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${val >= 1 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, (val / 1.6) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-black w-8 text-right ${val >= 1 ? 'text-emerald-600' : val < 0.6 ? 'text-red-600' : 'text-amber-600'}`}>
                    ×{val.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pluviómetro */}
          <div className="flex items-end gap-3 pt-1">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                Lluvia manual (mm)
              </label>
              <input
                type="number" min="0" max="500"
                value={manualMm} onChange={e => setManualMm(e.target.value)}
                placeholder="Ej: 32"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder:text-gray-300"
              />
            </div>
            <button
              onClick={async () => { setRecalculating(true); await onRecalculate(paddock.id, manualMm ? Number(manualMm) : undefined); setRecalculating(false) }}
              disabled={recalculating}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black rounded-xl transition-all shadow-sm"
            >
              {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Recalcular
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pronóstico tab ───────────────────────────────────────────────────────────

function PronosticoTab({ snapshots }: { snapshots: Snapshot[] }) {
  // Group by paddock
  const byPaddock: Record<string, Snapshot[]> = {}
  snapshots.forEach(s => {
    if (!byPaddock[s.paddock_name]) byPaddock[s.paddock_name] = []
    byPaddock[s.paddock_name].push(s)
  })

  if (Object.keys(byPaddock).length === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-black text-gray-400">Sin historial disponible</p>
      <p className="text-xs text-gray-400 mt-1">Los datos se acumulan a medida que calculás ajustes.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {Object.entries(byPaddock).map(([name, rows]) => {
        const sorted = [...rows].sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
        const days = sorted.map(r => r.adjusted_remaining_days)
        const last = days[days.length - 1]
        const first = days[0]
        const delta = last - first
        const growth = sorted[sorted.length - 1]?.grass_growth_rate ?? 0
        const alert = sorted[sorted.length - 1]?.alert_level ?? 'ok'
        return (
          <div key={name} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-900">{name}</span>
                  <AlertBadge level={alert} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{sorted.length} registros</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black leading-none ${last <= 3 ? 'text-red-600' : last <= 7 ? 'text-amber-600' : 'text-gray-900'}`}>{last}d</p>
                <p className={`text-[10px] font-black ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}d vs inicio
                </p>
              </div>
            </div>
            <DaysSparkline data={days} />
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
              <span className="text-[10px] font-bold text-gray-400">Crecimiento actual</span>
              <span className="text-[11px] font-black text-emerald-600">{growth.toFixed(1)} kg/ha/d</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClimateAdjustmentPanel({ showGlobalSummary = false }: { showGlobalSummary?: boolean }) {
  const { hasFeature } = usePlan()
  const hasAccess = hasFeature('climate_adjustment')

  const [tab, setTab] = useState<'ajuste' | 'pronostico'>('ajuste')
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [results, setResults] = useState<Map<string, PaddockResult>>(new Map())
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const loadPaddocks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/paddocks')
      const data: any[] = res.ok ? ((await res.json()).paddocks ?? []) : []
      // Show ALL paddocks
      setPaddocks(data.filter((p: any) => p.is_active !== false))
    } catch {}
    setLoading(false)
  }, [])

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await apiFetch('/api/climate-adjustment')
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data.snapshots ?? [])
      }
    } catch {}
  }, [])

  const calculateForPaddock = useCallback(async (paddockId: string, manualMm?: number) => {
    setLoadingIds(prev => new Set([...prev, paddockId]))
    try {
      const res = await apiFetch('/api/climate-adjustment', {
        method: 'POST',
        body: JSON.stringify({ paddockId, plannedDays: 21, rainfallManualMm: manualMm }),
      })
      if (res.ok) {
        const data: PaddockResult = await res.json()
        setResults(prev => new Map([...prev, [paddockId, data]]))
      }
    } catch {}
    setLoadingIds(prev => { const s = new Set(prev); s.delete(paddockId); return s })
  }, [])

  const calculateAll = useCallback(async () => {
    setRunning(true)
    await Promise.all(paddocks.map(p => calculateForPaddock(p.id)))
    setRunning(false)
    await loadSnapshots()
  }, [paddocks, calculateForPaddock, loadSnapshots])

  useEffect(() => {
    if (hasAccess) { loadPaddocks(); loadSnapshots() }
  }, [hasAccess, loadPaddocks, loadSnapshots])

  useEffect(() => {
    if (hasAccess && paddocks.length > 0) calculateAll()
  }, [paddocks]) // eslint-disable-line

  if (!hasAccess) return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Lock className="w-5 h-5 text-green-600" />
      </div>
      <h3 className="text-sm font-black text-gray-900 mb-1">Ajuste Clima · Plan Planificador</h3>
      <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
        Calculá cuántos días de estadía le quedan a tu rodeo según el clima actual. Disponible en el plan Planificador o superior.
      </p>
      <a href="/dashboard/planes" className="mt-4 inline-block bg-green-600 hover:bg-green-700 text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all">
        Ver planes →
      </a>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-3">
      <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Cargando potreros...</p>
    </div>
  )

  const allResults = Array.from(results.values())
  const criticals = allResults.filter(r => r.result.alertLevel === 'critical').length
  const warnings  = allResults.filter(r => r.result.alertLevel === 'warning').length
  const avgGrowth = allResults.length > 0
    ? allResults.reduce((s, r) => s + r.result.grassGrowthRateKgHaDay, 0) / allResults.length
    : null
  const totalHa   = paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const totalEv   = allResults.reduce((s, r) => s + r.totalEv, 0)
  const avgMultiplier = allResults.length > 0
    ? allResults.reduce((s, r) => s + r.result.climateMultiplier, 0) / allResults.length
    : null
  const avgDays = allResults.length > 0
    ? Math.round(allResults.reduce((s, r) => s + r.result.adjustedRemainingDays, 0) / allResults.length)
    : null

  const wrapClass = showGlobalSummary ? 'p-5 space-y-4' : 'space-y-4'

  return (
    <div className={wrapClass}>

      {/* ── Global field summary (only when shown as main tab) ─────── */}
      {showGlobalSummary && allResults.length > 0 && (
        <div className="bg-gradient-to-br from-green-950 to-green-900 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-300 mb-4">Resumen global del campo</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Superficie total',  value: `${totalHa.toFixed(0)} ha`,                              sub: `${paddocks.length} potreros` },
                { label: 'Carga animal',       value: totalEv > 0 ? `${totalEv.toFixed(1)} EV` : '—',          sub: totalHa > 0 ? `${(totalEv/totalHa).toFixed(2)} EV/ha` : '—' },
                { label: 'Días prom. estadía', value: avgDays !== null ? `${avgDays}d` : '—',                   sub: criticals > 0 ? `${criticals} crítico${criticals > 1 ? 's' : ''}` : warnings > 0 ? `${warnings} advertencia${warnings > 1 ? 's' : ''}` : 'Sin alertas' },
                { label: 'Mult. climático',   value: avgMultiplier !== null ? `×${avgMultiplier.toFixed(2)}` : '—', sub: avgGrowth !== null ? `${avgGrowth.toFixed(1)} kg/ha/d` : '—' },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-xl font-black leading-none text-white">{m.value}</p>
                  <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mt-1">{m.label}</p>
                  <p className="text-[10px] text-green-400 mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Alert bar */}
            {(criticals > 0 || warnings > 0) && (
              <div className={`mt-4 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 ${
                criticals > 0 ? 'bg-red-500/20 text-red-200 border border-red-500/30' : 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${criticals > 0 ? 'bg-red-400' : 'bg-amber-400'}`} />
                {criticals > 0
                  ? `${criticals} potrero${criticals > 1 ? 's' : ''} con días críticos — revisá el ajuste por potrero.`
                  : `${warnings} potrero${warnings > 1 ? 's' : ''} con advertencia de estadía.`}
              </div>
            )}
          </div>
        </div>
      )}
      {/* KPI strip */}
      {allResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Analizados',  value: `${allResults.length}`,                       color: 'text-gray-900' },
            { label: 'Críticos',    value: `${criticals}`,                                color: criticals > 0 ? 'text-red-600' : 'text-gray-400' },
            { label: 'Advertencias',value: `${warnings}`,                                 color: warnings > 0 ? 'text-amber-600' : 'text-gray-400' },
            { label: 'Crecim. prom',value: avgGrowth ? `${avgGrowth.toFixed(1)} kg/ha/d` : '—', color: 'text-emerald-600' },
          ].map(m => (
            <div key={m.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
              <p className={`text-base font-black leading-none ${m.color}`}>{m.value}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'ajuste',     label: 'Ajuste por clima' },
          { key: 'pronostico', label: 'Pronóstico' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={calculateAll}
          disabled={running}
          className="ml-2 flex items-center gap-1 text-[10px] font-black text-green-700 hover:text-green-900 disabled:opacity-50 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
          {running ? '' : 'Actualizar'}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'ajuste' && (
        <div className="space-y-2">
          {paddocks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm font-black text-gray-500">Sin potreros disponibles</p>
            </div>
          )}
          {paddocks.map(paddock => {
            const r = results.get(paddock.id)
            const isLoading = loadingIds.has(paddock.id)
            if (isLoading || !r) return (
              <div key={paddock.id} className="border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-3 bg-white">
                <Loader2 className="w-4 h-4 text-green-600 animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-black text-gray-700">{paddock.name}</p>
                  <p className="text-xs text-gray-400">Calculando ajuste climático...</p>
                </div>
              </div>
            )
            return (
              <PaddockRow key={paddock.id} result={r} onRecalculate={calculateForPaddock} />
            )
          })}
        </div>
      )}

      {tab === 'pronostico' && <PronosticoTab snapshots={snapshots} />}

      <p className="text-[10px] text-gray-400 text-center pt-1">
        NDVI × lluvia × humedad × sequía × estación · Actualizado {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
