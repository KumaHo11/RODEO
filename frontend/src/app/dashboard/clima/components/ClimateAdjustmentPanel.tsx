'use client'
/**
 * ClimateAdjustmentPanel — Panel de ajuste climático por potrero.
 * Muestra crecimiento en kg MS/ha/d y variables climáticas reales.
 * Sin tabs, sin multiplicadores visibles, sin "sequía".
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { RefreshCw, Loader2, Lock, ChevronDown, ChevronUp, Check, TrendingUp, TrendingDown, LayoutGrid, List } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'
import { useWeather } from '@/lib/context/WeatherContext'
import { useClimateAnalytics } from '@/lib/context/ClimateAnalyticsContext'
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
  climate_multiplier: number; ndvi: number
}

// AlertBadge removed since this view must focus purely on climate and its impact.

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
  paddockId, paddockName, onSave, onRecalculate
}: {
  paddockId: string
  paddockName: string
  onSave?: (p: CreateWeatherEventPayload) => Promise<boolean>
  onRecalculate?: (id: string, mm?: number) => Promise<void>
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
      if (onRecalculate) {
        await onRecalculate(paddockId, tab === 'rain' ? Number(value) : undefined)
      }
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
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="w-full sm:flex-1">
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
        <div className="w-full sm:w-36">
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
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl transition-all shadow-sm disabled:opacity-40 shrink-0"
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
  result, paddockSnapshots, current, onSaveWeatherEvent, onRecalculate, viewMode = 'list'
}: {
  result: PaddockResult
  paddockSnapshots: Snapshot[]
  current: { windSpeedKmh: number; humidityPct: number } | null
  onSaveWeatherEvent?: (p: CreateWeatherEventPayload) => Promise<boolean>
  onRecalculate?: (id: string, mm?: number) => Promise<void>
  viewMode?: 'list' | 'grid'
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'evolucion' | 'historico'>('evolucion')
  const { paddock, result: r, inputSummary } = result

  // Growth & NDVI delta vs previous snapshot
  const rawSortedSnaps = [...paddockSnapshots].sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
  const sortedSnaps = Array.from(
    rawSortedSnaps.reduce((map, snap) => {
      const d = new Date(snap.calculated_at).toLocaleDateString('en-CA') // YYYY-MM-DD
      map.set(d, snap)
      return map
    }, new Map<string, Snapshot>()).values()
  )
  const prevSnap = sortedSnaps.length >= 2 ? sortedSnaps[sortedSnaps.length - 2] : null
  
  const growthDiff = prevSnap != null
    ? parseFloat((r.grassGrowthRateKgHaDay - Number(prevSnap.grass_growth_rate)).toFixed(1))
    : null
    
  const ndviDiff = prevSnap != null && prevSnap.ndvi != null
    ? parseFloat((inputSummary.ndvi - Number(prevSnap.ndvi)).toFixed(3))
    : null

  if (viewMode === 'grid') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-black text-gray-950 leading-tight truncate">{paddock.name}</h3>
            <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{paddock.areaHa} ha</span>
          </div>
          
          <div className="space-y-3 mb-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Crecimiento MS</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-gray-950 leading-none">{r.grassGrowthRateKgHaDay.toFixed(1)}</span>
                <span className="text-xs font-bold text-gray-400">kg/d</span>
              </div>
              {growthDiff !== null && (
                <div className={`text-[10px] font-black mt-1 flex items-center gap-1 ${growthDiff >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {growthDiff > 0 ? '+' : ''}{growthDiff} kg
                  {growthDiff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-50">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">NDVI Actual</p>
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-gray-900">{inputSummary.ndvi.toFixed(2)}</span>
                <div className={`text-[10px] font-black flex items-center gap-1 ${ndviDiff && ndviDiff >= 0 ? 'text-emerald-600' : ndviDiff && ndviDiff < 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                  {ndviDiff !== null ? (ndviDiff > 0 ? `+${ndviDiff}` : ndviDiff) : '—'}
                  {ndviDiff !== null && (ndviDiff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <PaddockWeatherForm
          paddockId={paddock.id}
          paddockName={paddock.name}
          onSave={onSaveWeatherEvent}
          onRecalculate={onRecalculate}
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-black text-gray-950 leading-tight truncate">{paddock.name}</h3>
          </div>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1.5">
            {paddock.areaHa} ha
            <span className="text-gray-300">•</span>
            NDVI {inputSummary.ndvi.toFixed(2)}
          </p>
        </div>

        {/* Variaciones Climáticas Metrics */}
        <div className="flex items-center gap-6 shrink-0 mr-4">
          {/* Variación NDVI */}
          <div className="text-right">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Evolución NDVI</p>
            <div className={`flex items-center justify-end gap-1 ${ndviDiff && ndviDiff >= 0 ? 'text-emerald-600' : ndviDiff && ndviDiff < 0 ? 'text-orange-600' : 'text-gray-500'}`}>
              <span className="text-sm font-black">
                {ndviDiff !== null ? (ndviDiff > 0 ? `+${ndviDiff}` : ndviDiff) : '—'}
              </span>
              {ndviDiff !== null && (ndviDiff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
            </div>
          </div>
          
          {/* Variable Crecimiento en kg */}
          <div className="text-right min-w-[70px]">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Crecimiento MS</p>
            <div className="flex items-center justify-end gap-1">
              <span className="text-sm font-black text-gray-900">
                {r.grassGrowthRateKgHaDay.toFixed(1)} <span className="text-[10px] font-bold text-gray-400">kg/d</span>
              </span>
            </div>
            {growthDiff !== null && (
              <div className={`text-[9px] font-black mt-0.5 flex items-center justify-end gap-0.5 ${growthDiff >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {growthDiff > 0 ? '+' : ''}{growthDiff}
                {growthDiff >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              </div>
            )}
          </div>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-300 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0 mt-1" />}
      </button>

      {/* ── Expanded ── */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            <button
              onClick={() => setActiveTab('evolucion')}
              className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'evolucion' ? 'text-emerald-700 border-emerald-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              Evolución
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'historico' ? 'text-emerald-700 border-emerald-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              Histórico
            </button>
          </div>
          
          <div className="px-5 py-4 space-y-4">
            {activeTab === 'evolucion' ? (
              <>

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
            onRecalculate={onRecalculate}
          />
        </>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {sortedSnaps.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">No hay mediciones históricas registradas.</p>
                ) : (
                  sortedSnaps.slice().reverse().map((snap, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-xs font-black text-gray-900">{new Date(snap.calculated_at).toLocaleDateString('es-AR')}</p>
                        <p className="text-[10px] text-gray-400">Multiplicador clima: {Number(snap.climate_multiplier).toFixed(2)}x</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">NDVI</p>
                          <p className="text-xs font-bold text-emerald-700">{Number(snap.ndvi).toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Crecim.</p>
                          <p className="text-xs font-bold text-gray-900">{Number(snap.grass_growth_rate).toFixed(1)} kg</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
  const { snapshots, refreshSnapshots } = useClimateAnalytics()

  const [paddocks, setPaddocks]   = useState<any[]>([])
  const [results, setResults]     = useState<Map<string, PaddockResult>>(new Map())
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode]   = useState<'list' | 'grid'>('list')

  const loadPaddocks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/paddocks')
      const data: any[] = res.ok ? ((await res.json()).paddocks ?? []) : []
      setPaddocks(data.filter((p: any) => p.is_active !== false))
    } catch {}
    setLoading(false)
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
    await refreshSnapshots()
  }, [paddocks, calculateForPaddock, refreshSnapshots])

  useEffect(() => {
    if (hasAccess) { loadPaddocks() }
  }, [hasAccess, loadPaddocks])

  useEffect(() => {
    if (hasAccess && paddocks.length > 0) calculateAll()
  }, [paddocks]) // eslint-disable-line

  // Group snapshots by paddock name
  const snapshotsByPaddock = useMemo(() => {
    const map: Record<string, any[]> = {}
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
  const totalGrowthMs = allResults.reduce((s, r) => s + (r.result.grassGrowthRateKgHaDay * Number(r.paddock.areaHa)), 0)

  return (
    <div className={showGlobalSummary ? 'p-5 space-y-4' : 'space-y-4'}>

      {/* ── Global summary ─────────────────────────────────────────────── */}
      {showGlobalSummary && allResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="mb-4">
            {orgName && (
              <p className="text-xl font-black text-gray-900 leading-none mb-0.5 truncate" title={orgName}>
                {orgName}
              </p>
            )}
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Resumen del campo
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { label: 'Superficie',        value: `${totalHa.toFixed(0)} ha`,                            sub: `${paddocks.length} potreros` },
              { label: 'Crecim. promedio',  value: avgGrowth != null ? `${avgGrowth} kg/ha/d` : '—',     sub: 'campo completo', highlight: 'text-emerald-600' },
              { label: 'Crecimiento total', value: `${Math.round(totalGrowthMs).toLocaleString('es-AR')} kg/d`, sub: 'sumatoria en campo', highlight: 'text-emerald-600' },
              { label: 'Mediciones',        value: `${allResults.length} potreros`,  sub: `con datos analizados` },
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

      {/* ── View toggles & Refresh button ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:block">
          Por potrero ({paddocks.length})
        </p>
        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}><List className="w-3.5 h-3.5" /></button>
          </div>
          <button
            onClick={calculateAll}
            disabled={running}
            className="flex items-center gap-1.5 text-[10px] font-black text-green-700 hover:text-green-900 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Calculando…' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* ── Paddock cards ─────────────────────────────────────────────── */}
      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
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
                current={current}
                onSaveWeatherEvent={onSaveWeatherEvent}
                onRecalculate={calculateForPaddock}
                viewMode={viewMode}
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
