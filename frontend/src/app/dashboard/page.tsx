'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'
import {
  TrendingUp, CloudRain, AlertTriangle, Calendar, ArrowRight,
  Layers, Navigation, Droplets, ChevronRight, CheckSquare, Leaf,
  Scale, RefreshCw, Loader2, Satellite, TrendingDown, Sun, Wind,
  Lightbulb, Target, RotateCcw, PawPrint, Beef
} from 'lucide-react'

const WEATHER_ICONS: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌦️', 61: '🌧️', 80: '🌩️', 95: '⛈️' }
const getWeatherIcon = (code: number) => {
  for (const k of Object.keys(WEATHER_ICONS).sort((a, b) => +b - +a)) {
    if (code >= +k) return WEATHER_ICONS[+k]
  }
  return '🌡️'
}

const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const TASK_PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baja: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function DashboardOverview() {
  const { user, profile, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading]             = useState(true)
  const [herds, setHerds]                 = useState<any[]>([])
  const [paddocks, setPaddocks]           = useState<any[]>([])
  const [org, setOrg]                     = useState<any>(null)
  const [weather, setWeather]             = useState<WeatherData | null>(null)
  const [nextMoves, setNextMoves]         = useState<any[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([])

  // NDVI Growth widget state
  const [ndviLoading, setNdviLoading]     = useState(false)
  const [ndviStatus, setNdviStatus]       = useState<string>('')
  const [growthRates, setGrowthRates]     = useState<Record<string, number>>({})
  const [avgGrowthRate, setAvgGrowthRate] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated]     = useState<string | null>(null)
  const [dataLoaded, setDataLoaded]       = useState(false)

  useEffect(() => {
    // Wait until Firebase auth + profile fetch are both complete
    if (authLoading) return

    // No user → middleware handles redirect to /login
    if (!user) return

    // Unverified email → sign out and redirect
    if (!user.emailVerified) {
      router.replace('/login')
      return
    }

    // Wait until profile is loaded
    if (profile === null) return

    // Guard: if owner hasn't completed onboarding, send back
    // A guest (team_role set) skips owner onboarding
    const isGuest = !!(profile?.team_role)
    const onboardingDone = (profile?.onboarding_step ?? 0) >= 4
    if (!isGuest && !onboardingDone) {
      router.replace('/onboarding')
      return
    }

    // Only load data once
    if (dataLoaded) return

    async function load() {
      if (!user) return
      setLoading(true)

      try {
        const [orgRes, paddocksRes, herdsRes, plansRes, tasksRes] = await Promise.all([
          apiFetch('/api/organizations'),
          apiFetch('/api/paddocks'),
          apiFetch('/api/herds'),
          apiFetch('/api/grazing-plans'),
          apiFetch(`/api/tasks?from_date=${new Date().toISOString().split('T')[0]}&limit=4`),
        ])

        const orgData = orgRes.ok ? (await orgRes.json()).organization : null
        const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks : []
        const herdsData = herdsRes.ok ? (await herdsRes.json()).herds : []
        const plansData = plansRes.ok ? (await plansRes.json()).plans : []
        const tasksData = tasksRes.ok ? (await tasksRes.json()).tasks : []

        setOrg(orgData)

        const sorted = (paddocksData || []).sort((a: any, b: any) =>
          (Number(b.dry_matter_kg_ha) || 0) - (Number(a.dry_matter_kg_ha) || 0)
        )
        setPaddocks(sorted)
        buildGrowthRates(sorted)
        setHerds(herdsData || [])
        setUpcomingTasks(
          (tasksData || [])
            .filter((t: any) => t.status !== 'COMPLETADA' && t.status !== 'completada')
            .slice(0, 4)
        )
        setNextMoves(
          (plansData || [])
            .filter((p: any) => p.status === 'PLANNED' || p.status === 'ACTIVE')
            .sort((a: any, b: any) => a.entry_date.localeCompare(b.entry_date))
            .slice(0, 5)
        )

        // Weather from org location
        let lat = -34.6, lon = -58.4
        if (orgData?.location?.coordinates) {
          lon = orgData.location.coordinates[0]; lat = orgData.location.coordinates[1]
        }
        const wData = await getPaddockWeather(lat, lon)
        setWeather(wData)
      } catch (err) {
        console.error('Dashboard load error:', err)
      }

      setLoading(false)
      setDataLoaded(true)
    }
    load()
  }, [authLoading, user, profile, dataLoaded, router])

  function buildGrowthRates(pList: any[]) {
    const rates: Record<string, number> = {}
    pList.forEach((p: any) => {
      const curr = Number(p.dry_matter_kg_ha) || 0
      const prev = Number(p.previous_dry_matter_kg_ha) || 0
      const prevDate = p.previous_ndvi_date
      if (curr > 0 && prev > 0 && prevDate) {
        const days = Math.max(1, Math.round((Date.now() - new Date(prevDate).getTime()) / 86400000))
        rates[p.id] = (curr - prev) / days
      }
    })
    setGrowthRates(rates)
    const vals = Object.values(rates)
    setAvgGrowthRate(vals.length > 0 ? vals.reduce((s, r) => s + r, 0) / vals.length : null)
  }

  // ── Refresh NDVI from satellite for each paddock ────────────────────────────
  const refreshAllNdvi = useCallback(async () => {
    if (ndviLoading || paddocks.length === 0) return
    setNdviLoading(true)
    setNdviStatus('Consultando satélite...')

    const toProcess = paddocks.slice(0, 6)
    let processed = 0
    const rates: Record<string, number> = { ...growthRates }

    await Promise.all(
      toProcess.map(async (p: any) => {
        try {
          if (!p.boundary) {
            processed++
            setNdviStatus(`Procesando ${processed}/${toProcess.length} potreros...`)
            return
          }

          const resp = await fetch('/api/ndvi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geojson: p.boundary, paddock_id: p.id }),
          })
          if (!resp.ok) { processed++; return }

          const res = await resp.json()
          const newMs = res.estimatedAvailableDryMatterHa
          const currMs = Number(p.dry_matter_kg_ha) || 0

          if (currMs > 0) {
            const prevForCalc = Number(p.previous_dry_matter_kg_ha) || currMs
            const prevDateForCalc = p.previous_ndvi_date || new Date(Date.now() - 7 * 86400000).toISOString()
            const days = Math.max(1, Math.round((Date.now() - new Date(prevDateForCalc).getTime()) / 86400000))
            rates[p.id] = (newMs - prevForCalc) / days
          } else {
            rates[p.id] = (newMs - 500) / 7
          }

          // Save to DB via API route
          await apiFetch(`/api/paddocks/${p.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              current_ndvi: res.averageNdvi,
              dry_matter_kg_ha: newMs,
              previous_dry_matter_kg_ha: currMs > 0 ? currMs : newMs,
              previous_ndvi_date: new Date().toISOString().split('T')[0],
            }),
          })

          processed++
          setNdviStatus(`Procesando ${processed}/${toProcess.length} potreros...`)
        } catch {
          processed++
        }
      })
    )

    // Refresh paddock data from API
    const paddocksRes = await apiFetch('/api/paddocks')
    if (paddocksRes.ok) {
      const { paddocks: pData } = await paddocksRes.json()
      const sorted = (pData || []).sort((a: any, b: any) =>
        (Number(b.dry_matter_kg_ha) || 0) - (Number(a.dry_matter_kg_ha) || 0)
      )
      setPaddocks(sorted)
    }

    setGrowthRates(rates)
    const vals = Object.values(rates)
    setAvgGrowthRate(vals.length > 0 ? vals.reduce((s, r) => s + r, 0) / vals.length : null)
    setLastUpdated(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    setNdviStatus('')
    setNdviLoading(false)
  }, [paddocks, ndviLoading, growthRates])

  // Auto-trigger NDVI when paddocks load with no dry_matter_kg_ha
  useEffect(() => {
    if (!dataLoaded || ndviLoading || paddocks.length === 0) return
    const needsNdvi = paddocks.every(p => !p.dry_matter_kg_ha)
    if (needsNdvi) refreshAllNdvi()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded])

  // ── Derived values ────────────────────────────────────────────────────────
  const totalArea    = org?.total_area_ha || paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const totalEV      = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
  const totalDailyMS = herds.reduce((s, h) => s + (Number(h.head_count) || 0) * (Number(h.avg_weight_kg) || 0) * 0.03, 0)

  const totalMS = useMemo(() =>
    paddocks.reduce((s, p) => {
      const ms = Number(p.dry_matter_kg_ha) || 0
      const ha = Number(p.area_ha) || 0
      return s + ms * ha
    }, 0)
  , [paddocks])

  const autonomyDays  = useMemo(() => {
    if (totalEV <= 0 || totalMS <= 0) return 0
    return Math.round(totalMS / (totalEV * 12))
  }, [totalMS, totalEV])

  const autonomyColor = autonomyDays > 30 ? 'text-green-600' : autonomyDays > 15 ? 'text-amber-500' : 'text-red-600'
  const autonomyBg    = autonomyDays > 30 ? 'bg-green-50 border-green-100' : autonomyDays > 15 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
  const autonomyLabel = autonomyDays > 30 ? 'Disponible' : autonomyDays > 15 ? 'Atención' : 'Alerta'

  const cargaAnimal = totalArea > 0 ? totalEV / totalArea : 0
  const caColor     = cargaAnimal <= 0.8 ? 'text-green-600' : cargaAnimal <= 1.2 ? 'text-amber-500' : 'text-red-600'
  const caLabel     = cargaAnimal <= 0.8 ? 'Normal' : cargaAnimal <= 1.2 ? 'Carga Alta' : 'Sobrepastoreo'
  const caBg        = cargaAnimal <= 0.8 ? 'bg-green-50 border-green-100' : cargaAnimal <= 1.2 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'

  const totalMSOffer   = totalMS * 0.5
  const dailyDemand    = totalEV * 12
  const balanceDeficit = dailyDemand > 0 && totalMSOffer < dailyDemand

  const droughtColors: Record<string, string> = {
    LOW: 'text-green-600 bg-green-50', MODERATE: 'text-amber-600 bg-amber-50', HIGH: 'text-red-600 bg-red-50',
  }
  const droughtLabels: Record<string, string> = { LOW: 'Normal', MODERATE: 'Sequía', HIGH: 'Riesgo' }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ══ ALERTA GLOBAL BALANCE MS ══ */}
      {!loading && balanceDeficit && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-700">Alerta: déficit de forraje</p>
            <p className="text-xs text-red-600 mt-0.5">
              Oferta ajustada ({Math.round(totalMSOffer).toLocaleString()} kg MS) no cubre la demanda ({dailyDemand.toFixed(0)} kg MS/día).
            </p>
          </div>
        </div>
      )}

      {/* ══ FILA 1: 4 widgets iguales ══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-h-0">

        {/* Widget 1 — Forraje disponible + lista de potreros */}
        <div className={`rounded-2xl border shadow-sm flex flex-col overflow-hidden h-full ${autonomyBg}`}>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
            <div>
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Forraje Disponible
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                {loading
                  ? <div className="h-9 w-24 bg-white/60 animate-pulse rounded-lg" />
                  : <>
                      <p className={`text-3xl font-black leading-none ${autonomyColor}`}>
                        {totalMS >= 1000 ? `${(totalMS / 1000).toFixed(1)}k` : Math.round(totalMS).toLocaleString()}
                      </p>
                      <span className="text-xs font-bold text-gray-500">kg MS</span>
                      <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full bg-white/70 border ${autonomyColor}`}>
                        {autonomyDays}d · {autonomyLabel}
                      </span>
                    </>
                }
              </div>
            </div>
            <Link href="/dashboard/mi-campo" className="text-[9px] font-black text-green-600 hover:underline flex items-center gap-0.5 shrink-0">
              Mi Campo <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Paddock list */}
          <div className="border-t border-white/40 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-9 bg-white/40 animate-pulse rounded-xl" />)}
              </div>
            ) : paddocks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-400 font-bold">Sin potreros</p>
                <Link href="/dashboard/mi-campo" className="text-[10px] text-green-600 font-bold hover:underline mt-1 inline-block">Agregar →</Link>
              </div>
            ) : (() => {
              const maxMS = Math.max(...paddocks.map(p => Number(p.dry_matter_kg_ha) || 0), 1)
              const dd = totalEV * 12
              return (
                <div className="divide-y divide-white/30">
                  {paddocks.map((p, idx) => {
                    const ms   = Number(p.dry_matter_kg_ha) || 0
                    const ha   = Number(p.area_ha) || 0
                    const ndvi = Number(p.current_ndvi) || 0
                    const totalPaddockMS = ms * ha
                    const paddockDays = dd > 0 && totalPaddockMS > 0 ? Math.round(totalPaddockMS / dd) : null
                    const pct = maxMS > 0 ? (ms / maxMS) * 100 : 0
                    const barColor = ms >= 1500 ? '#16a34a' : ms >= 800 ? '#d97706' : '#dc2626'
                    const msColor  = ms >= 1500 ? 'text-green-700' : ms >= 800 ? 'text-amber-700' : ms > 0 ? 'text-red-600' : 'text-gray-400'
                    const gr = growthRates[p.id]
                    return (
                      <Link
                        key={p.id}
                        href="/dashboard/mi-campo"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/30 transition-all"
                      >
                        <span className="w-4 h-4 rounded-full bg-white/70 flex items-center justify-center text-[8px] font-black text-gray-500 shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-[11px] font-black text-gray-900 truncate">{p.name}</p>
                            {ndvi > 0 && <span className="text-[7px] font-bold text-gray-400 bg-white/60 px-1 py-0.5 rounded-full shrink-0">NDVI {ndvi.toFixed(2)}</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {ms > 0
                              ? <span className={`text-[9px] font-black ${msColor}`}>{ms.toLocaleString()} kg/ha</span>
                              : <span className="text-[9px] text-gray-400 font-bold">Sin análisis</span>
                            }
                            <span className="text-[8px] text-gray-400">{ha.toFixed(1)} ha</span>
                            {gr !== undefined && (
                              <span className={`text-[8px] font-bold ${gr >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {gr >= 0 ? '↑' : '↓'}{Math.abs(gr).toFixed(1)}/d
                              </span>
                            )}
                          </div>
                          {ms > 0 && (
                            <div className="w-full bg-white/40 rounded-full h-0.5 mt-1 overflow-hidden">
                              <div className="h-0.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                            </div>
                          )}
                        </div>
                        {paddockDays !== null && (
                          <div className="shrink-0 text-center">
                            <p className={`text-sm font-black leading-none ${msColor}`}>{paddockDays}</p>
                            <p className="text-[7px] text-gray-400 font-bold">días</p>
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })()}
          </div>
          {!loading && totalEV > 0 && (
            <div className="px-4 py-2 border-t border-white/30 shrink-0">
              <p className="text-[9px] text-gray-500">
                Demanda: <span className="font-black text-gray-700">{dailyDemand.toFixed(0)} kg MS/día</span> · {totalEV.toFixed(1)} EV
              </p>
            </div>
          )}
        </div>

        {/* Widget 2 — Clima */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 h-full">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5">
              <Sun className="w-3 h-3" /> Clima
            </p>
            {weather && (
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${droughtColors[weather.droughtRisk]}`}>
                {droughtLabels[weather.droughtRisk]}
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex-1 space-y-2">
              <div className="h-16 bg-gray-100 animate-pulse rounded-xl" />
              <div className="h-12 bg-gray-100 animate-pulse rounded-xl" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
                  <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest">Últ. 30d</p>
                  <p className="text-2xl font-black text-gray-900 leading-none mt-0.5">{weather?.past30DaysRain ?? '—'}<span className="text-[9px] font-bold text-gray-400"> mm</span></p>
                </div>
                <div className="bg-indigo-50 rounded-xl px-3 py-2.5 border border-indigo-100">
                  <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Próx. 15d</p>
                  <p className="text-2xl font-black text-gray-900 leading-none mt-0.5">{weather?.next15DaysRain ?? '—'}<span className="text-[9px] font-bold text-gray-400"> mm</span></p>
                </div>
              </div>
              {weather?.agriAdvice && (
                <div className="bg-green-50 rounded-xl px-3 py-2 border border-green-100 flex items-start gap-1.5">
                  <Leaf className="w-3 h-3 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-green-800 font-medium leading-snug line-clamp-2">{weather.agriAdvice}</p>
                </div>
              )}
              {(weather?.forecastDays || []).length > 0 && (
                <div className="grid grid-cols-4 gap-1 mt-auto">
                  {(weather?.forecastDays || []).slice(0, 4).map((day, i) => {
                    const d = new Date(day.date + 'T00:00:00')
                    return (
                      <div key={i} className="bg-gray-50 rounded-lg p-1.5 text-center border border-gray-100">
                        <p className="text-[7px] font-black text-gray-400 uppercase">{WEEK_DAYS[d.getDay()]}</p>
                        <p className="text-base leading-none my-0.5">{getWeatherIcon(day.weatherCode)}</p>
                        <p className="text-[9px] font-black text-gray-800">{day.maxTemp}°</p>
                        {day.precipitationSum > 0 && <p className="text-[7px] font-bold text-blue-500">{day.precipitationSum}mm</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Widget 3 — Insights holístico */}
        {(() => {
          const monthN = new Date().getMonth() + 1
          const season = monthN >= 12 || monthN <= 2 ? { name: 'Verano', rest: '45-65d', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' }
            : monthN >= 3 && monthN <= 5 ? { name: 'Otoño', rest: '60-80d', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' }
            : monthN >= 6 && monthN <= 8 ? { name: 'Invierno', rest: '80-110d', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-100' }
            : { name: 'Primavera', rest: '35-50d', color: 'text-green-600', bg: 'bg-green-50 border-green-100' }
          const restingPaddocks = paddocks.filter(p => p.current_status !== 'GRAZING').length
          const rotationPct = paddocks.length > 0 ? Math.round((restingPaddocks / paddocks.length) * 100) : 0
          const scoreColor = rotationPct >= 65 ? 'text-green-600' : rotationPct >= 40 ? 'text-amber-500' : 'text-red-500'
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between shrink-0">
                <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3 text-green-600" /> Insights
                </p>
                <Link href="/dashboard/insights" className="text-[9px] font-black text-green-600 hover:underline flex items-center gap-0.5">
                  Ver más <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="flex-1 space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}
                </div>
              ) : (
                <>
                  <div className={`px-3 py-2.5 rounded-xl border ${season.bg}`}>
                    <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Temporada actual</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-sm font-black ${season.color}`}>{season.name}</p>
                      <p className="text-[8px] font-bold text-gray-500">Descanso: {season.rest}</p>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Rotación</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-lg font-black leading-none ${scoreColor}`}>{rotationPct}%</p>
                      <p className="text-[8px] font-bold text-gray-400">{restingPaddocks}/{paddocks.length} en descanso</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5 overflow-hidden">
                      <div className={`h-1 rounded-full ${rotationPct >= 65 ? 'bg-green-500' : rotationPct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${rotationPct}%` }} />
                    </div>
                  </div>
                  <div className={`px-3 py-2.5 rounded-xl border ${autonomyBg}`}>
                    <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Autonomía forrajera</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-lg font-black leading-none ${autonomyColor}`}>{autonomyDays > 0 ? `${autonomyDays} días` : '—'}</p>
                      <p className="text-[8px] font-bold text-gray-400">{autonomyDays > 0 ? autonomyLabel : 'Sin datos'}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Widget 4 — Carga Animal */}
        <div className={`rounded-2xl border shadow-sm p-4 flex flex-col gap-3 h-full ${caBg}`}>
          <div className="flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5">
              <Beef className="w-3 h-3" /> Carga Animal
            </p>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full bg-white/70 border ${caColor}`}>{caLabel}</span>
          </div>

          {loading ? (
            <div className="flex-1 space-y-2">
              <div className="h-14 bg-white/60 animate-pulse rounded-xl" />
              <div className="h-10 bg-white/60 animate-pulse rounded-xl" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-[8px] font-black text-amber-500 tracking-widest uppercase">Consumo diario</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-3xl font-black text-gray-950 leading-none">
                    {totalDailyMS >= 1000 ? `${(totalDailyMS / 1000).toFixed(1)}k` : Math.round(totalDailyMS).toLocaleString()}
                  </p>
                  <span className="text-xs font-bold text-gray-500">kg MS/día</span>
                </div>
              </div>
              <div className={`px-3 py-2 rounded-xl bg-white/70 border ${caBg.split(' ')[1]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">EV/ha</p>
                    <p className={`text-xl font-black leading-none ${caColor}`}>{cargaAnimal.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Total EV</p>
                    <p className="text-xl font-black text-gray-700 leading-none">{totalEV.toFixed(1)}</p>
                  </div>
                </div>
              </div>
              {/* Field name + total area */}
              <div className="px-3 py-2 rounded-xl border border-gray-100 bg-white/60">
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Establecimiento</p>
                <p className="text-sm font-black text-gray-800 mt-0.5 truncate">{org?.name || '—'}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[9px] font-bold text-gray-500">
                    {Number(totalArea) > 0 ? `${Number(totalArea).toFixed(1)} ha totales` : `${paddocks.length} potrero${paddocks.length !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-[9px] font-bold text-gray-400">{paddocks.length} potreros</p>
                </div>
              </div>
              <div className={`px-3 py-2 rounded-xl border ${balanceDeficit ? 'bg-red-50 border-red-200' : 'bg-white/60 border-white/40'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Oferta ajustada</p>
                    <p className={`text-sm font-black ${balanceDeficit ? 'text-red-600' : 'text-gray-800'}`}>
                      {Math.round(totalMSOffer).toLocaleString()} <span className="text-[9px] font-bold text-gray-400">kg MS</span>
                    </p>
                  </div>
                  <p className={`text-xs font-black ${balanceDeficit ? 'text-red-600' : 'text-green-600'}`}>
                    {balanceDeficit ? '⚠ Déficit' : '✓ OK'}
                  </p>
                </div>
              </div>
              <Link href="/dashboard/herds" className="text-[9px] font-black text-green-600 hover:underline flex items-center gap-1 mt-auto">
                Ver rebaños <ArrowRight className="w-3 h-3" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ══ FILA 2: 4 widgets iguales ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-h-0">

        {/* ── Widget Crecimiento del Pasto (NDVI) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-black text-gray-950 flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-emerald-600" /> Crecimiento Pasto
              </h3>
              <p className="text-[8px] text-gray-400 font-bold mt-0.5">NDVI · kg MS/ha/día</p>
            </div>
            <button
              onClick={refreshAllNdvi}
              disabled={ndviLoading || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shrink-0"
            >
              {ndviLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {ndviLoading ? 'Actualizando' : 'Actualizar'}
            </button>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-3">
            {ndviLoading && ndviStatus && (
              <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
                <Loader2 className="w-3 h-3 text-emerald-600 animate-spin shrink-0" />
                <p className="text-[9px] text-emerald-700 font-bold">{ndviStatus}</p>
              </div>
            )}
            {!ndviLoading && loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-9 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : avgGrowthRate !== null ? (
              <>
                <div className={`rounded-xl px-3 py-2.5 border ${avgGrowthRate >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Promedio del campo</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    {avgGrowthRate >= 0
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    }
                    <p className={`text-xl font-black leading-none ${avgGrowthRate >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {avgGrowthRate >= 0 ? '+' : ''}{avgGrowthRate.toFixed(1)}
                    </p>
                    <span className="text-[8px] font-bold text-gray-400">kg MS/ha/día</span>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1">
                  {Object.entries(growthRates).slice(0, 4).map(([pid, rate]) => {
                    const p = paddocks.find(pp => pp.id === pid)
                    if (!p) return null
                    return (
                      <div key={pid} className="flex items-center justify-between text-xs">
                        <p className="font-bold text-gray-600 truncate flex-1 text-[10px]">{p.name}</p>
                        <p className={`shrink-0 font-black text-[9px] ml-2 ${rate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {rate >= 0 ? '+' : ''}{rate.toFixed(1)} kg/d
                        </p>
                      </div>
                    )
                  })}
                </div>
                {lastUpdated && (
                  <p className="text-[8px] text-gray-300 font-bold mt-auto">Actualizado: {lastUpdated}</p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-4 text-center gap-2">
                <Satellite className="w-8 h-8 text-gray-200" />
                <p className="text-[10px] font-bold text-gray-400">Sin datos de crecimiento</p>
                <p className="text-[9px] text-gray-300">Presioná &quot;Actualizar&quot; para<br/>consultar el satélite Sentinel-2.<br/>Requiere 2+ lecturas NDVI.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Próximas Tareas ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-black text-gray-950 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-violet-600" /> Próximas Tareas
            </h3>
            <Link href="/dashboard/tareas" className="text-[9px] font-black text-green-600 hover:underline flex items-center gap-0.5">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-3 flex-1 flex flex-col gap-2">
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-11 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : upcomingTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                <CheckSquare className="w-7 h-7 text-gray-200" />
                <p className="text-[10px] text-gray-400 font-bold">Sin tareas pendientes</p>
                <Link href="/dashboard/tareas" className="text-[9px] text-green-600 font-bold hover:underline">Crear tarea</Link>
              </div>
            ) : (
              upcomingTasks.map((task) => {
                const d = new Date(task.due_date + 'T00:00:00')
                const diffDays = Math.round((d.getTime() - new Date().getTime()) / 86400000)
                const dateLabel = diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Mañana' : `${d.getDate()}/${d.getMonth() + 1}`
                const isUrgent = diffDays <= 1
                const pColorCls = TASK_PRIORITY_COLORS[task.priority?.toLowerCase()] || TASK_PRIORITY_COLORS.baja
                return (
                  <Link
                    key={task.id}
                    href="/dashboard/tareas"
                    className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all"
                  >
                    <div className={`px-1.5 py-1 rounded-lg text-[7px] font-black border shrink-0 ${pColorCls}`}>{dateLabel}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-900 truncate">{task.title}</p>
                      <p className="text-[8px] text-gray-400 capitalize">{task.priority?.toLowerCase() || 'normal'}</p>
                    </div>
                    {isUrgent && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── Próximos Movimientos ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-black text-gray-950 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-600" /> Próx. Movimientos
            </h3>
            <Link href="/dashboard/grazing" className="text-[9px] font-black text-green-600 hover:underline flex items-center gap-0.5">
              Planificador <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-3 flex-1 flex flex-col gap-2">
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-11 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : nextMoves.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                <Navigation className="w-7 h-7 text-gray-200" />
                <p className="text-[10px] font-bold text-gray-400">Sin movimientos</p>
                <Link href="/dashboard/grazing" className="text-[9px] text-green-600 font-bold hover:underline">Crear planificación →</Link>
              </div>
            ) : (
              nextMoves.map((move) => {
                const isActive = move.status === 'ACTIVE'
                const entryDate = new Date(move.entry_date + 'T00:00:00')
                const diffDays = Math.round((entryDate.getTime() - new Date().getTime()) / 86400000)
                const dateLabel = isActive ? '● En curso'
                  : diffDays === 0 ? 'Hoy'
                  : diffDays === 1 ? 'Mañana'
                  : diffDays < 0 ? `Hace ${Math.abs(diffDays)}d`
                  : `En ${diffDays}d`
                const isUrgent = !isActive && diffDays <= 1 && diffDays >= 0
                return (
                  <Link
                    key={move.id}
                    href="/dashboard/grazing"
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 hover:shadow-sm transition-all ${
                      isActive ? 'bg-green-50 border-green-200' :
                      isUrgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'bg-green-500 animate-pulse' :
                      isUrgent ? 'bg-red-500' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-900 truncate">
                        {(move.herds as any)?.name || 'Rebaño'} → {(move.paddocks as any)?.name || 'Potrero'}
                      </p>
                      <p className="text-[8px] text-gray-500">{dateLabel}</p>
                    </div>
                    {isActive && <span className="text-[7px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">ACTIVO</span>}
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── Rebaños ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-black text-gray-950 flex items-center gap-1.5">
                <PawPrint className="w-3.5 h-3.5 text-green-600" /> Rebaños
              </h3>
              <p className="text-[8px] text-gray-400 font-bold mt-0.5">{totalEV.toFixed(1)} EV · {herds.reduce((s, h) => s + (Number(h.head_count) || 0), 0)} animales</p>
            </div>
            <Link href="/dashboard/herds" className="text-[9px] font-black text-green-600 hover:underline flex items-center gap-0.5">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-3 flex-1 flex flex-col gap-2.5">
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-11 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : herds.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                <PawPrint className="w-7 h-7 text-gray-200" />
                <p className="text-[10px] text-gray-400 font-bold">Sin rebaños registrados</p>
              </div>
            ) : (() => {
              const evTotal = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
              return herds.slice(0, 5).map((h) => {
                const dailyMs = Math.round((Number(h.head_count) || 0) * (Number(h.avg_weight_kg) || 0) * 0.03)
                const pct = evTotal > 0 ? (h.total_ev / evTotal) * 100 : 0
                return (
                  <div key={h.id} className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-gray-900 truncate flex-1">{h.name}</p>
                      <p className="text-[9px] font-black text-amber-600 shrink-0 ml-2">{dailyMs > 0 ? `${dailyMs} kg/d` : '—'}</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                      <div className="bg-amber-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[8px] text-gray-400">{h.head_count} animales · {Number(h.total_ev).toFixed(1)} EV</p>
                  </div>
                )
              })
            })()}
          </div>
        </div>

      </div>

    </div>
  )
}
