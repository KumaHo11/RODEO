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
  Lightbulb, Target, RotateCcw, PawPrint, MapPin
} from 'lucide-react'
import CowIcon from '@/components/CowIcon'
import { AppHeader } from '@/components/AppHeader'
import { MarketWidget } from '@/components/MarketWidget'

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
  const [farmEvents, setFarmEvents]       = useState<any[]>([])

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

    // Wait until profile is loaded
    if (profile === null) return

    // Guard: if owner hasn't completed onboarding, send back
    // A guest (team_role set) skips owner onboarding AND email verification requirement
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
        const [orgRes, paddocksRes, herdsRes, plansRes, tasksRes, farmEventsRes] = await Promise.all([
          apiFetch('/api/organizations'),
          apiFetch('/api/paddocks'),
          apiFetch('/api/herds'),
          apiFetch('/api/grazing-plans'),
          apiFetch(`/api/tasks?from_date=${new Date().toISOString().split('T')[0]}&limit=4`),
          apiFetch('/api/farm-events'),
        ])

        const orgData = orgRes.ok ? (await orgRes.json()).organization : null
        const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks : []
        const herdsData = herdsRes.ok ? (await herdsRes.json()).herds : []
        const plansData = plansRes.ok ? (await plansRes.json()).plans : []
        const tasksData = tasksRes.ok ? (await tasksRes.json()).tasks : []
        const eventsData = farmEventsRes.ok ? (await farmEventsRes.json()).events : []

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
        setFarmEvents(
          (eventsData || [])
            .filter((e: any) => e.status === 'pendiente')
            .sort((a: any, b: any) => a.event_date.localeCompare(b.event_date))
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

          // Save NDVI to estimated_adh — DO NOT overwrite user-declared dry_matter_kg_ha
          await apiFetch(`/api/paddocks/${p.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              current_ndvi: res.averageNdvi,
              estimated_adh: newMs,
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

  // Auto-trigger NDVI when paddocks load — always refresh on first load
  useEffect(() => {
    if (!dataLoaded || ndviLoading || paddocks.length === 0) return
    refreshAllNdvi()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded])

  // ── Derived values ────────────────────────────────────────────────────────
  const totalArea    = org?.total_area_ha || paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const totalEV      = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
  const totalDailyMS = herds.reduce((s, h) => s + (Number(h.head_count) || 0) * (Number(h.avg_weight_kg) || 0) * 0.03, 0)

  // totalMS = user-declared forage only (dry_matter_kg_ha)
  // If no user value, fall back to satellite estimate (estimated_adh)
  const totalMS = useMemo(() =>
    paddocks.reduce((s, p) => {
      const userMs  = Number(p.dry_matter_kg_ha) || 0
      const ndviMs  = Number((p as any).estimated_adh) || 0
      const ms = userMs > 0 ? userMs : ndviMs
      const ha = Number(p.area_ha) || 0
      return s + ms * ha
    }, 0)
  , [paddocks])

  // Track which paddocks have user-declared forraje
  const paddocksWithUserForraje = useMemo(() =>
    paddocks.filter(p => Number(p.dry_matter_kg_ha) > 0).length
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
    <div className="flex flex-col h-full gap-5 overflow-y-auto pb-8">
      {/* ══ HEADER ══ */}
      <AppHeader
        title="Panel principal"
        subtitle="Centro de mando unificado"
        actions={
          loading && <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
        }
      />

      {/* ══ FILA 1: Pilares del campo (2/3 + 1/3) ══ */}
      <div className="flex flex-col lg:flex-row gap-4 shrink-0">
        {/* IZQUIERDA: Agenda (2/3) */}
        <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 shrink-0">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-600" /> Agenda
            </h2>
            <Link href="/dashboard/agenda" className="text-xs font-bold text-gray-400 hover:text-green-600 hover:underline flex items-center gap-1 transition-colors">
              Gestionar eventos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-gray-100 rounded w-1/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : farmEvents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-4 text-gray-300">
                  <Calendar className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-gray-400">Sin eventos próximos</p>
                <Link href="/dashboard/agenda" className="mt-2 text-xs font-bold text-green-600 hover:underline">Programar primer evento</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {farmEvents.map(e => {
                  const d = new Date(e.event_date + 'T00:00:00')
                  const today = new Date(); today.setHours(0,0,0,0)
                  const isActive = d <= today
                  return (
                    <div key={e.id} className={`p-4 hover:bg-gray-50 transition-colors flex items-center gap-4 group ${isActive ? 'border-l-2 border-[#D4A373] bg-amber-50/20' : ''}`}>
                      {/* Date Bubble */}
                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border shrink-0 transition-all ${isActive ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 group-hover:bg-white group-hover:border-green-100'}`}>
                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none">{d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span>
                        <span className="text-xl font-bold text-gray-900 leading-none mt-1">{d.getDate()}</span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${e.event_type === 'servicio' ? 'bg-red-500' : e.event_type === 'paricion' ? 'bg-blue-500' : e.event_type === 'tratamiento_sanitario' ? 'bg-amber-800' : 'bg-green-500'}`} />
                          <h3 className="text-sm font-bold text-gray-950 truncate">{e.title}</h3>
                          {isActive && (
                            <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wider">Activo</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium truncate">
                          {e.herd_id ? (herds.find(h => h.id === e.herd_id)?.name || 'Rebaño') : 'Multi-rebaño'}
                          {e.description && <span className="mx-1.5 opacity-30">·</span>}
                          {e.description && <span className="opacity-70">{e.description}</span>}
                        </p>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                        <button onClick={() => router.push('/dashboard/agenda')} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* DERECHA: 4 cards — Clima · Precio · Disponibilidad · Rebaños */}
        <div className="flex-1 flex flex-col gap-4">

          {/* 1. Clima */}
          <div className="bg-[#f0f9ff] rounded-2xl border border-[#bae6fd] shadow-sm p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-6 -right-6 text-blue-200/40 w-24 h-24">
              <Sun className="w-full h-full" />
            </div>
            <div className="relative z-10">
              <h3 className="text-[10px] font-bold text-blue-800/60 tracking-widest uppercase flex items-center gap-1">
                <CloudRain className="w-3 h-3" /> Clima
              </h3>
              <div className="mt-1 flex items-center gap-3">
                {loading ? <div className="h-8 w-16 bg-blue-100/50 animate-pulse rounded-lg" /> : (
                  <>
                    <p className="text-3xl font-bold text-blue-900">{weather?.forecastDays[0]?.maxTemp || '—'}°</p>
                    {weather?.next15DaysRain !== undefined && (
                      <p className="text-xs font-bold text-blue-800 leading-tight">
                        {weather.next15DaysRain} mm lluvia<br/><span className="text-[10px] font-medium opacity-80">próximos 15 días</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            {!loading && weather?.forecastDays?.length && (
              <div className="flex gap-2 mt-3 relative z-10 justify-between">
                {weather.forecastDays.slice(0,4).map((d, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[9px] font-bold uppercase text-blue-800/80">{WEEK_DAYS[new Date(d.date + 'T00:00:00').getDay()]}</p>
                    <p className="text-xs my-0.5">{d.precipitationSum > 0 ? '🌧️' : '☀️'}</p>
                    <p className="text-[10px] font-bold text-blue-900">{d.precipitationSum}<span className="text-[8px] ml-0.5">mm</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Precio índice novillo (MarketWidget) */}
          <MarketWidget />

          {/* 3. Disponibilidad de Forraje — mejorada */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 shadow-sm p-4 relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 w-20 h-20 text-green-200/50">
              <Leaf className="w-full h-full" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-green-700/70 tracking-widest uppercase flex items-center gap-1">
                  <Leaf className="w-3 h-3" /> Disponibilidad de forraje
                </h3>
                <Link href="/dashboard/mi-campo" className="text-[9px] font-bold text-green-600 hover:underline">Ver mapa →</Link>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <p className="text-4xl font-black text-green-950 leading-none">
                  {totalArea > 0 ? Math.round(totalMS / totalArea).toLocaleString() : '—'}
                </p>
                <span className="text-xs font-bold text-green-600 pb-1">kg MS/ha</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`px-3 py-2 rounded-xl border bg-white/80 ${autonomyDays > 30 ? 'border-green-100' : autonomyDays > 15 ? 'border-amber-100' : 'border-red-100'}`}>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Autonomía</p>
                  <p className={`text-sm font-black mt-0.5 ${autonomyDays > 30 ? 'text-green-600' : autonomyDays > 15 ? 'text-amber-500' : 'text-red-600'}`}>
                    {autonomyDays > 0 ? `${autonomyDays}d` : '—'}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-xl border border-green-100 bg-white/80">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Potreros</p>
                  <p className="text-sm font-black mt-0.5 text-gray-900">{paddocksWithUserForraje}/{paddocks.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Rebaños — Carga animal */}
          <div className="bg-[#fffbeb] rounded-2xl border border-[#fde68a] shadow-sm flex flex-col p-4">
            <h3 className="text-[10px] font-bold text-amber-700/60 tracking-widest uppercase flex items-center gap-1 mb-1">
              <CowIcon className="w-3.5 h-3.5" /> Carga animal
            </h3>
            <p className="text-xs font-bold text-amber-900">{herds.length} rebaños · {herds.reduce((s, h) => s + (Number(h.head_count) || 0), 0)} animales</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-4xl font-black text-[#92400e] leading-none">{cargaAnimal.toFixed(2)}</p>
              <div className="pb-1 group relative">
                <p className="text-xs font-bold text-amber-800">EV/ha <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-amber-200/50 rounded-full text-[9px] cursor-help font-black">?</span></p>
                <div className="absolute opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-[10px] p-2 rounded-lg w-48 bottom-full mb-1 left-0 transition-opacity pointer-events-none z-10 shadow-xl">
                  Equivalente Vaca por hectárea. Un EV ≈ 400 kg, consume ~12 kg MS/día.
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cargaAnimal <= 0.8 ? 'bg-green-500' : cargaAnimal <= 1.2 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (cargaAnimal / 1.5) * 100)}%` }}
                />
              </div>
              <p className={`text-[10px] font-black shrink-0 ${cargaAnimal <= 0.8 ? 'text-green-700' : cargaAnimal <= 1.2 ? 'text-amber-700' : 'text-red-700'}`}>
                {cargaAnimal <= 0.8 ? 'Óptimo' : cargaAnimal <= 1.2 ? 'Normal' : 'Alto'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ══ FILA 2: Agenda (Mini-Gantt) & Tareas ══ */}
      <div className="flex flex-col md:flex-row gap-4 shrink-0 min-h-[px]">
        {/* Removed Agenda from here */}

        {/* Tareas */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center bg-violet-50/30">
            <h3 className="text-xs font-black text-violet-900 flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Próximas tareas</h3>
            <Link href="/dashboard/tareas" className="text-[10px] font-bold text-violet-700 hover:underline">Ir a tareas</Link>
          </div>
          <div className="p-2 flex-1">
            {upcomingTasks.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center font-bold">Sin tareas pendientes</p>
            ) : upcomingTasks.map(t => (
              <div key={t.id} className="p-3 flex items-start gap-3 hover:bg-gray-50 rounded-xl transition-all group">
                <input type="checkbox" className="mt-1 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" readOnly />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{t.title}</p>
                  {t.paddocks?.name && <p className="text-[10px] items-center gap-1 text-gray-500 truncate flex"><MapPin className="w-3 h-3"/> {t.paddocks.name}</p>}
                  {t.herds?.name && <p className="text-[10px] items-center gap-1 text-gray-500 truncate flex"><CowIcon className="w-3 h-3"/> {t.herds.name}</p>}
                  <span className={`inline-block mt-1 text-[8px] font-black px-1.5 py-0.5 rounded-full ${TASK_PRIORITY_COLORS[t.priority?.toLowerCase()] || TASK_PRIORITY_COLORS.baja}`}>{t.priority || 'Normal'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ FILA 3: Movimientos + NDVI ══ */}
      <div className="flex flex-col xl:flex-row gap-4 shrink-0">
        {/* Próximos movimientos (Mini-Gantt simplificado) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-[2] overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-sm font-black flex items-center gap-2 text-gray-900">
              <Navigation className="w-4 h-4 text-green-600" /> Próximos movimientos
            </h2>
            <Link href="/dashboard/grazing" className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1">
              Planificador <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* KPI Strip compacta */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {(() => {
              const resting = paddocks.filter(p => p.current_status !== 'GRAZING').length
              const rotPct = paddocks.length > 0 ? Math.round((resting / paddocks.length) * 100) : 0
              const deficit = dailyDemand > 0 && totalMSOffer < dailyDemand
              return (
                <>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative w-10 h-10 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-gray-100" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-green-500" strokeWidth="4" strokeDasharray={`${rotPct}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-black text-gray-700">{rotPct}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rotación</p>
                      <p className="text-xs font-black text-gray-900">{resting}/{paddocks.length} <span className="text-[9px] font-normal text-gray-500">en descanso</span></p>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex flex-col justify-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Balance forrajero</p>
                    <p className={`text-sm font-black mt-0.5 ${deficit ? 'text-red-600' : 'text-green-600'}`}>{deficit ? 'Déficit' : 'Superávit'}</p>
                    <p className="text-[9px] text-gray-500 font-medium">{Math.abs(totalMSOffer - dailyDemand).toLocaleString()} kg MS/día</p>
                  </div>
                  <div className="px-4 py-3 flex items-start gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                      <Lightbulb className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Recomendación</p>
                      <p className="text-[10px] text-gray-700 font-medium leading-relaxed mt-0.5">
                        {autonomyDays > 0 ? `Mover rebaño en ${Math.min(autonomyDays, 7)} días` : 'Sin datos de forraje'}
                      </p>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Timeline de movimientos */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : nextMoves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RotateCcw className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs font-bold text-gray-400">Sin movimientos planificados</p>
                <Link href="/dashboard/grazing" className="mt-1 text-[10px] font-bold text-green-600 hover:underline">Crear planificación</Link>
              </div>
            ) : (
              nextMoves.map((plan: any, i: number) => {
                const HERD_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d']
                const color = HERD_COLORS[i % HERD_COLORS.length]
                const today = new Date().toISOString().split('T')[0]
                const isActive = plan.status === 'ACTIVE' || plan.entry_date <= today
                const isToday = plan.entry_date === today
                const d = new Date(plan.entry_date + 'T00:00:00')
                const daysUntil = Math.round((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
                return (
                  <div key={plan.id} className={`px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${isActive ? 'bg-amber-50/30' : ''}`}
                    style={{ borderLeft: `3px solid ${isActive ? '#D4A373' : color}` }}>
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-lg font-black text-gray-900 leading-none">{d.getDate()}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{d.toLocaleDateString('es', { month: 'short' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{plan.paddocks?.name || '—'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{plan.herds?.name || 'Multi-rebaño'}</p>
                    </div>
                    {isActive && <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wider">Activo</span>}
                    {isToday && !isActive && <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">Hoy</span>}
                    {daysUntil > 0 && <span className="shrink-0 text-[9px] font-bold text-gray-400">{daysUntil}d</span>}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Crecimiento (NDVI) */}
        <div className="bg-[#ecfdf5] rounded-2xl border border-[#6ee7b7] shadow-sm flex flex-col overflow-hidden flex-1">
          <div className="px-5 py-3 border-b border-emerald-200/50 flex justify-between items-center">
            <h3 className="text-xs font-black text-emerald-900 flex items-center gap-1.5"><Satellite className="w-3.5 h-3.5" /> Crecimiento NDVI</h3>
            <button onClick={refreshAllNdvi} className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${ndviLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center relative">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60 mb-2">Velocidad promedio</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black text-emerald-700 leading-none">
                {avgGrowthRate !== null ? `${avgGrowthRate >= 0 ? '+' : ''}${avgGrowthRate.toFixed(1)}` : '—'}
              </p>
              {avgGrowthRate !== null && <TrendingUp className="w-6 h-6 text-emerald-600" />}
            </div>
            <p className="text-xs font-bold text-emerald-800/80 mt-1 pb-4">kg de materia seca · por hectárea · por día</p>
            
            <div className="mt-auto border-t border-emerald-200/50 pt-3">
              <p className="text-[9px] text-emerald-700/70 font-medium">Satélite Sentinel-2</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
