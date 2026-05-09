'use client'
/**
 * ClimateAdjustmentPanel — Panel de ajuste climático por potrero.
 * Muestra crecimiento en kg MS/ha/d y variables climáticas reales.
 * Sin tabs, sin multiplicadores visibles, sin "sequía".
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { RefreshCw, Loader2, Lock, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'
import { useWeather } from '@/lib/context/WeatherContext'
import { useAuth } from '@/components/AuthProvider'
import type { CreateWeatherEventPayload } from '@/lib/types/weather'
import {
  LineChart, Line, ReferenceLine, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'

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

// ─── Mini growth chart (dentro del expand del potrero) ───────────────────────

function PaddockGrowthMini({ data }: { data: Snapshot[] }) {
  if (data.length < 2) return (
    <div className="h-28 flex items-center justify-center text-xs text-gray-300">
      Sin historial suficiente
    </div>
  )
  const chartData = data.map(d => ({
    date: new Date(d.calculated_at).toLocaleDateString('es', { day: '2-digit', month: 'short' }),
    kg: parseFloat(Number(d.grass_growth_rate).toFixed(1)),
    // Blue dot marker: only shows on days where climate_multiplier suggests rain boost
    lluvia: Number(d.climate_multiplier) > 1.05 ? parseFloat(Number(d.grass_growth_rate).toFixed(1)) : null,
  }))
  const avg = chartData.reduce((s, d) => s + d.kg, 0) / chartData.length

  function MiniTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const kg = payload.find((p: any) => p.dataKey === 'kg')
    const hasRainDot = payload.find((p: any) => p.dataKey === 'lluvia' && p.value != null)
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
        {kg && (
          <p className="font-black text-gray-900">
            {Number(kg.value).toFixed(1)} <span className="font-medium text-gray-400">kg MS/ha/d</span>
            <span className="ml-1 text-[10px] text-emerald-600 font-medium">Crecimiento</span>
          </p>
        )}
        {hasRainDot && (
          <p className="text-blue-500 font-medium mt-0.5 text-[10px]">Lluvia registrada</p>
        )}
      </div>
    )
  }

  return (
    <div className="h-28 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} dy={6} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
          <RechartsTooltip content={<MiniTooltip />} />
          <ReferenceLine y={avg} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth={1} />
          {/* Línea de crecimiento de pasto */}
          <Line type="monotone" dataKey="kg" name="Crecimiento de pasto" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
          {/* Puntos de lluvia — solo marcadores visuales en días favorables */}
          <Line type="monotone" dataKey="lluvia" name="Lluvia" stroke="#3b82f6" strokeWidth={0} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={false} />
        </LineChart>
      </ResponsiveContainer>
      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-px bg-emerald-500" style={{ height: 2 }} />
          <p className="text-[9px] text-gray-400 font-medium">Crecimiento de pasto</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <p className="text-[9px] text-gray-400 font-medium">Lluvia registrada</p>
        </div>
      </div>
    </div>
  )
}


// ─── Inline weather registration (lluvia / helada per-paddock) ───────────────

function PaddockWeatherForm({
  paddockId, paddockName, onSave,
}: {
  paddockId: string
  paddockName: string
  onSave?: (p: CreateWeatherEventPayload) => Promise<boolean>
}) {
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState<'rain' | 'frost'>('rain')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isValid = Number(value) > 0 && !!date

  const handleSubmit = async () => {
    if (!isValid || !onSave) return
    setSaving(true)
    const ok = await onSave({
      type: tab === 'rain' ? 'RAIN' : 'FROST',
      value: Number(value),
      date,
      paddockIds: [paddockId],
    })
    setSaving(false)
    if (ok) {
      setSaved(true)
      setValue('')
      setDate(today)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="pt-3 border-t border-gray-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
        Registrar evento climático
      </p>
      {/* Type toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit mb-3">
        {(['rain', 'frost'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setValue('') }}
            className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'rain' ? 'Lluvia' : 'Helada'}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
            {tab === 'rain' ? 'Milímetros (mm)' : 'Temperatura (°C)'}
          </label>
          <div className="relative">
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={tab === 'rain' ? '0.0' : '-2.0'}
              step="0.1"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder:text-gray-300 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-400">
              {tab === 'rain' ? 'mm' : '°C'}
            </span>
          </div>
        </div>
        <div className="w-36">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={today}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none transition-all"
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving || !onSave}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl transition-all shadow-sm disabled:opacity-40 shrink-0"
          style={{ backgroundColor: saved ? '#10b981' : '#166534', color: 'white' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {saving ? 'Guardando…' : saved ? 'Guardado' : 'Registrar'}
        </button>
      </div>
    </div>
  )
}

// ─── Paddock card ─────────────────────────────────────────────────────────────

function PaddockCard({
  result, paddockSnapshots, onRecalculate, current, onSaveWeatherEvent,
}: {
  result: PaddockResult
  paddockSnapshots: Snapshot[]
  onRecalculate: (id: string, mm?: number) => Promise<void>
  current: { windSpeedKmh: number; humidityPct: number } | null
  onSaveWeatherEvent?: (p: CreateWeatherEventPayload) => Promise<boolean>
}) {
  const [expanded, setExpanded] = useState(false)
  const { paddock, result: r, inputSummary, totalEv } = result

  // Growth delta vs previous snapshot
  const sortedSnaps = [...paddockSnapshots].sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
  const prevGrowth = sortedSnaps.length >= 2
    ? Number(sortedSnaps[sortedSnaps.length - 2].grass_growth_rate)
    : null
  const growthDiff = prevGrowth != null
    ? parseFloat((r.grassGrowthRateKgHaDay - prevGrowth).toFixed(1))
    : null

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-gray-900 truncate">{paddock.name}</span>
            <AlertBadge level={r.alertLevel} />
          </div>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
            {paddock.areaHa} ha · {totalEv.toFixed(1)} EV
          </p>
        </div>

        {/* Crecimiento actual */}
        <div className="text-right shrink-0">
          <p className="text-lg font-black text-gray-900 leading-none">
            {r.grassGrowthRateKgHaDay} <span className="text-xs font-bold text-gray-400">kg/ha/d</span>
          </p>
          {growthDiff !== null && (
            <p className={`text-[10px] font-black mt-0.5 ${growthDiff > 0 ? 'text-emerald-600' : growthDiff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {growthDiff > 0 ? '+' : ''}{growthDiff} vs. anterior
            </p>
          )}
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-300 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />}
      </button>

      {/* Alert message */}
      {r.alertMessage && (
        <div className="px-5 py-2 border-t border-gray-100 text-xs text-gray-500 leading-snug flex items-start gap-2">
          <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${r.alertLevel === 'critical' ? 'bg-red-400' : 'bg-amber-400'}`} />
          {r.alertMessage}
        </div>
      )}

      {/* ── Expanded ── */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">

          {/* Variables climáticas reales */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Variables climáticas esta semana
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Lluvia 7d',    value: `${inputSummary.rainfall7dMm.toFixed(0)} mm` },
                { label: 'Viento máx.',  value: current ? `${current.windSpeedKmh} km/h` : '—' },
                { label: 'Humedad',      value: current ? `${current.humidityPct}%` : `${inputSummary.humidity.toFixed(0)}%` },
                { label: 'Forraje MS',   value: `${Number(inputSummary.forageMsHa).toLocaleString('es-AR')} kg/ha` },
              ].map(v => (
                <div key={v.label}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{v.label}</p>
                  <p className="text-sm font-black text-gray-900">{v.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mini chart — evolución crecimiento */}
          {paddockSnapshots.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                Crecimiento histórico del potrero
              </p>
              <PaddockGrowthMini data={sortedSnaps} />
              <p className="text-[9px] text-gray-300 text-right mt-1">
                Los puntos azules indican días con lluvia
              </p>
            </div>
          )}

          {/* Inline weather registration */}
          <PaddockWeatherForm
            paddockId={paddock.id}
            paddockName={paddock.name}
            onSave={onSaveWeatherEvent}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClimateAdjustmentPanel({
  showGlobalSummary = false,
  onSaveWeatherEvent,
  orgName,
}: {
  showGlobalSummary?: boolean
  onSaveWeatherEvent?: (p: CreateWeatherEventPayload) => Promise<boolean>
  orgName?: string | null
}) {
  const { hasFeature } = usePlan()
  const hasAccess = hasFeature('climate_adjustment')
  const { current } = useWeather()

  const [paddocks, setPaddocks]   = useState<any[]>([])
  const [results, setResults]     = useState<Map<string, PaddockResult>>(new Map())
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const loadPaddocks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/paddocks')
      const data: any[] = res.ok ? ((await res.json()).paddocks ?? []) : []
      setPaddocks(data.filter((p: any) => p.is_active !== false))
    } catch {}
    setLoading(false)
  }, [])

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await apiFetch('/api/climate-adjustment')
      if (res.ok) setSnapshots((await res.json()).snapshots ?? [])
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

  // Group snapshots by paddock name
  const snapshotsByPaddock = useMemo(() => {
    const map: Record<string, Snapshot[]> = {}
    snapshots.forEach(s => {
      if (!map[s.paddock_name]) map[s.paddock_name] = []
      map[s.paddock_name].push(s)
    })
    return map
  }, [snapshots])

  if (!hasAccess) return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Lock className="w-5 h-5 text-green-600" />
      </div>
      <h3 className="text-sm font-black text-gray-900 mb-1">Ajuste Clima · Plan Planificador</h3>
      <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
        Calculá cuántos días de estadía le quedan a tu rodeo según el clima actual.
      </p>
      <a href="/dashboard/planes" className="mt-4 inline-block bg-green-600 hover:bg-green-700 text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all">
        Ver planes →
      </a>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-3">
      <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Cargando potreros…</p>
    </div>
  )

  const allResults    = Array.from(results.values())
  const criticals     = allResults.filter(r => r.result.alertLevel === 'critical').length
  const warnings      = allResults.filter(r => r.result.alertLevel === 'warning').length
  const avgGrowth     = allResults.length > 0
    ? parseFloat((allResults.reduce((s, r) => s + r.result.grassGrowthRateKgHaDay, 0) / allResults.length).toFixed(1))
    : null
  const totalHa       = paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const totalEv       = allResults.reduce((s, r) => s + r.totalEv, 0)

  return (
    <div className={showGlobalSummary ? 'p-5 space-y-4' : 'space-y-4'}>

      {/* ── Global summary ─────────────────────────────────────────────── */}
      {showGlobalSummary && allResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          {/* Field name title */}
          <div className="mb-4">
            {orgName && (
              <p className="text-xl font-black text-gray-900 leading-none mb-0.5">{orgName}</p>
            )}
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Resumen del campo
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { label: 'Superficie',        value: `${totalHa.toFixed(0)} ha`,                            sub: `${paddocks.length} potreros` },
              { label: 'Carga animal',      value: totalEv > 0 ? `${totalEv.toFixed(1)} EV` : '—',       sub: totalHa > 0 ? `${(totalEv/totalHa).toFixed(2)} EV/ha` : '—' },
              { label: 'Crecim. promedio',  value: avgGrowth != null ? `${avgGrowth} kg/ha/d` : '—',     sub: 'campo completo', highlight: 'text-emerald-600' },
              { label: 'Estado general',    value: criticals > 0 ? `${criticals} crítico${criticals > 1 ? 's' : ''}` : warnings > 0 ? `${warnings} advertencia${warnings > 1 ? 's' : ''}` : 'Normal',  sub: `${allResults.length} potreros analizados`, highlight: criticals > 0 ? 'text-red-600' : warnings > 0 ? 'text-amber-600' : 'text-emerald-600' },
            ].map(m => (
              <div key={m.label}>
                <p className={`text-lg font-black text-gray-900 leading-none ${(m as any).highlight ?? ''}`}>{m.value}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{m.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Refresh button ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Por potrero ({paddocks.length})
        </p>
        <button
          onClick={calculateAll}
          disabled={running}
          className="flex items-center gap-1.5 text-[10px] font-black text-green-700 hover:text-green-900 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Calculando…' : 'Actualizar'}
        </button>
      </div>

      {/* ── Paddock cards ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {paddocks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm font-black text-gray-500">Sin potreros disponibles</p>
          </div>
        )}
        {paddocks.map(paddock => {
          const r = results.get(paddock.id)
          const isLoadingPaddock = loadingIds.has(paddock.id)
          if (isLoadingPaddock || !r) return (
            <div key={paddock.id} className="border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-3 bg-white">
              <Loader2 className="w-4 h-4 text-green-600 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-black text-gray-700">{paddock.name}</p>
                <p className="text-xs text-gray-400">Calculando ajuste climático…</p>
              </div>
            </div>
          )
          const paddockSnaps = snapshotsByPaddock[paddock.name] ?? []
          return (
            <PaddockCard
              key={paddock.id}
              result={r}
              paddockSnapshots={paddockSnaps}
              onRecalculate={calculateForPaddock}
              current={current}
              onSaveWeatherEvent={onSaveWeatherEvent}
            />
          )
        })}
      </div>

      <p className="text-[10px] text-gray-400 text-center pt-1">
        NDVI · lluvia · humedad · temperatura · viento · estación · Actualizado {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
