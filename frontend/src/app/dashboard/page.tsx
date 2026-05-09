'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWeather, CONDITION_EMOJI } from '@/lib/context/WeatherContext'
import {
  TrendingUp, CloudRain, AlertTriangle, Calendar, ArrowRight,
  Layers, Navigation, Droplets, ChevronRight, CheckSquare, Leaf,
  Scale, RefreshCw, Loader2, Satellite, TrendingDown, Sun, Wind,
  Lightbulb, Target, RotateCcw, PawPrint, MapPin
} from 'lucide-react'
import CowIcon from '@/components/CowIcon'
import { AppHeader } from '@/components/AppHeader'
import { MarketWidget } from '@/components/MarketWidget'
import ForageVigorMonitor from '@/components/ForageVigorMonitor'

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
  const { current: weatherCurrent, forecast: weatherForecast, isLoading: weatherLoading } = useWeather()
  const [nextMoves, setNextMoves]         = useState<any[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([])
  const [farmEvents, setFarmEvents]       = useState<any[]>([])
  const [climateSnapshots, setClimateSnapshots] = useState<any[]>([])
  const [activePaddockIds, setActivePaddockIds] = useState<string[]>([])

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
        const [orgRes, paddocksRes, herdsRes, plansRes, tasksRes, farmEventsRes, climateRes] = await Promise.all([
          apiFetch('/api/organizations'),
          apiFetch('/api/paddocks'),
          apiFetch('/api/herds'),
          apiFetch('/api/grazing-plans'),
          apiFetch(`/api/tasks?from_date=${new Date().toISOString().split('T')[0]}&limit=4`),
          apiFetch('/api/farm-events'),
          apiFetch('/api/climate-adjustment').catch(() => ({ ok: false } as Response)),
        ])

        const orgData = orgRes.ok ? (await orgRes.json()).organization : null
        const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks : []
        const herdsData = herdsRes.ok ? (await herdsRes.json()).herds : []
        const plansData = plansRes.ok ? (await plansRes.json()).plans : []
        const tasksData = tasksRes.ok ? (await tasksRes.json()).tasks : []
        const eventsData = farmEventsRes.ok ? (await farmEventsRes.json()).events : []
        const climateData = climateRes.ok ? (await climateRes.json()).snapshots : []

        setOrg(orgData)
        setClimateSnapshots(climateData || [])

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
        const today = new Date().toISOString().split('T')[0]
        const allActivePlans = (plansData || []).filter((p: any) => {
          const isActiveStatus = p.status === 'ACTIVE' || p.status === 'active'
          const coversToday = p.entry_date <= today && (!p.exit_date || p.exit_date >= today)
          return isActiveStatus || coversToday
        })
        const futurePlans    = (plansData || []).filter((p: any) => p.status === 'PLANNED' && p.entry_date > today)

        // Sort actives by exit date (soonest first — most urgent), then future by entry date
        allActivePlans.sort((a: any, b: any) => {
          if (a.exit_date && b.exit_date) return a.exit_date.localeCompare(b.exit_date)
          if (a.exit_date) return -1
          if (b.exit_date) return 1
          return a.entry_date.localeCompare(b.entry_date)
        })
        futurePlans.sort((a: any, b: any) => a.entry_date.localeCompare(b.entry_date))

        setActivePaddockIds(allActivePlans.map((p: any) => p.paddock_id).filter(Boolean))
        setNextMoves([...allActivePlans, ...futurePlans].slice(0, 6))
        setFarmEvents(
          (eventsData || [])
            .filter((e: any) => e.status === 'pendiente')
            .sort((a: any, b: any) => a.event_date.localeCompare(b.event_date))
            .slice(0, 5)
        )

        // Weather is now provided by WeatherContext (WeatherProvider in layout)
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

          const resp = await apiFetch('/api/ndvi', {
            method: 'POST',
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
                          {e.herd_id ? (herds.find(h => h.id === e.herd_id)?.name || 'Rodeo') : 'Multi-rodeo'}
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

        {/* DERECHA: 4 cards — Clima · Precio · Disponibilidad · Rodeos */}
        <div className="flex-1 flex flex-col gap-4">

          {/* 1. Clima — uses shared WeatherContext (same data as /clima page) */}
          <div className="bg-[#f0f9ff] rounded-2xl border border-[#bae6fd] shadow-sm p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-6 -right-6 text-blue-200/40 w-24 h-24">
              <Sun className="w-full h-full" />
            </div>
            <div className="relative z-10">
              <h3 className="text-[10px] font-bold text-blue-800/60 tracking-widest uppercase flex items-center gap-1">
                <CloudRain className="w-3 h-3" /> Clima
              </h3>
              <div className="mt-1 flex items-center gap-3">
                {loading || weatherLoading ? <div className="h-8 w-16 bg-blue-100/50 animate-pulse rounded-lg" /> : (
                  <>
                    <p className="text-3xl font-bold text-blue-900">{weatherCurrent?.tempC ?? '—'}°</p>
                    <p className="text-xs font-bold text-blue-800 leading-tight">
                      {weatherCurrent?.conditionLabel ?? '—'}
                    </p>
                  </>
                )}
              </div>
            </div>
            {!loading && !weatherLoading && weatherForecast?.length > 0 && (
              <div className="flex gap-2 mt-3 relative z-10 justify-between">
                {weatherForecast.slice(0, 4).map((d, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[9px] font-bold uppercase text-blue-800/80">
                      {WEEK_DAYS[new Date(d.date + 'T00:00:00').getDay()]}
                    </p>
                    <p className="text-xs my-0.5">{CONDITION_EMOJI[d.condition] ?? (d.precipitationMm > 0 ? '🌧️' : '☀️')}</p>
                    <p className="text-[10px] font-bold text-blue-900">
                      {d.precipitationMm > 0 ? d.precipitationMm : d.maxTempC}<span className="text-[8px] ml-0.5">{d.precipitationMm > 0 ? 'mm' : '°'}</span>
                    </p>
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

          {/* 4. Rodeos — Carga animal */}
          <div className="bg-[#fffbeb] rounded-2xl border border-[#fde68a] shadow-sm flex flex-col p-4">
            <h3 className="text-[10px] font-bold text-amber-700/60 tracking-widest uppercase flex items-center gap-1 mb-1">
              <Layers className="w-3.5 h-3.5" /> Carga animal
            </h3>
            <p className="text-xs font-bold text-amber-900">{herds.length} rodeos · {herds.reduce((s, h) => s + (Number(h.head_count) || 0), 0)} animales</p>
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
                  {t.herds?.name && <p className="text-[10px] items-center gap-1 text-gray-500 truncate flex"><Layers className="w-3 h-3"/> {t.herds.name}</p>}
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

          {/* KPI Strip — derived 100% from real grazing plans */}
          {(() => {
            const today = new Date(); today.setHours(0,0,0,0)
            const todayStr = new Date().toISOString().split('T')[0]

            // Active plans (currently grazing)
            const activePlans = nextMoves.filter((p: any) => {
              if (p.status === 'ACTIVE') return true
              if (p.entry_date <= todayStr && (!p.exit_date || p.exit_date >= todayStr)) return true
              return false
            })

            // Plans with imminent exit (next 7 days)
            const urgentExits = nextMoves.filter((p: any) => {
              if (!p.exit_date) return false
              const d = Math.round((new Date(p.exit_date + 'T00:00:00').getTime() - today.getTime()) / 86400000)
              return d >= 0 && d <= 7
            })

            // Next planned entry
            const nextEntry = nextMoves.find((p: any) => {
              const d = Math.round((new Date(p.entry_date + 'T00:00:00').getTime() - today.getTime()) / 86400000)
              return d > 0
            })
            const daysToNextEntry = nextEntry
              ? Math.round((new Date(nextEntry.entry_date + 'T00:00:00').getTime() - today.getTime()) / 86400000)
              : null

            const restingCount = paddocks.length - activePaddockIds.length
            const rotPct = paddocks.length > 0 ? Math.round((restingCount / paddocks.length) * 100) : 0

            return (
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                {/* Rotación */}
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
                    <p className="text-xs font-black text-gray-900">{restingCount}/{paddocks.length} <span className="text-[9px] font-normal text-gray-500">en descanso</span></p>
                  </div>
                </div>

                {/* Pastoreando ahora */}
                <div className="px-4 py-3 flex flex-col justify-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">En pastoreo</p>
                  {activePlans.length > 0 ? (
                    <>
                      <p className="text-sm font-black mt-0.5 text-green-600">{activePlans.length} potrero{activePlans.length !== 1 ? 's' : ''}</p>
                      <p className="text-[9px] text-gray-500 font-medium">
                        {urgentExits.length > 0
                          ? `${urgentExits.length} salida${urgentExits.length !== 1 ? 's' : ''} próxima${urgentExits.length !== 1 ? 's' : ''}`
                          : 'Sin salidas urgentes'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black mt-0.5 text-gray-400">—</p>
                      <p className="text-[9px] text-gray-400 font-medium">Sin planes activos</p>
                    </>
                  )}
                </div>

                {/* Próximo movimiento */}
                <div className="px-4 py-3 flex items-start gap-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${activePlans.length === 0 ? 'bg-amber-100 text-amber-600' : urgentExits.length > 0 ? 'bg-indigo-100 text-indigo-600' : daysToNextEntry !== null ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${activePlans.length === 0 ? 'text-amber-600' : urgentExits.length > 0 ? 'text-indigo-700' : 'text-blue-700'}`}>
                      {activePlans.length === 0 ? 'Días sin pastoreo' : urgentExits.length > 0 ? 'Mover pronto' : 'Próx. entrada'}
                    </p>
                    <p className="text-[10px] text-gray-700 font-medium leading-relaxed mt-0.5">
                      {activePlans.length === 0
                        ? '⚠️ No hay animales en el campo'
                        : urgentExits.length > 0
                          ? `${urgentExits[0].paddocks?.name || 'Potrero'} en ${Math.round((new Date(urgentExits[0].exit_date + 'T00:00:00').getTime() - today.getTime()) / 86400000)}d`
                          : daysToNextEntry !== null
                            ? `${nextEntry?.paddocks?.name || 'Potrero'} en ${daysToNextEntry}d`
                            : nextMoves.length === 0 ? 'Sin planificación' : 'Sin mov. próximos'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

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
                const todayMid = new Date(); todayMid.setHours(0,0,0,0)
                const today = new Date().toISOString().split('T')[0]
                const isActive = plan.status === 'ACTIVE' || plan.entry_date <= today

                // Exit-date countdown (days until animals must LEAVE)
                const exitDate = plan.exit_date
                const daysUntilExit = exitDate
                  ? Math.round((new Date(exitDate + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000)
                  : null
                const isExitToday     = daysUntilExit === 0
                const isExitTomorrow  = daysUntilExit === 1
                const isExitOverdue   = daysUntilExit !== null && daysUntilExit < 0
                const isExitUrgent    = daysUntilExit !== null && daysUntilExit <= 1

                // Entry-date countdown (days until animals ENTER)
                const entryD = new Date(plan.entry_date + 'T00:00:00')
                const daysUntilEntry = Math.round((entryD.getTime() - todayMid.getTime()) / 86400000)

                // Animals grazing
                const planHerds = herds.filter((h: any) => plan.herd_ids?.includes(h.id))
                const totalHeads = planHerds.reduce((s: number, h: any) =>
                  s + (Number(h.head_count) || Number(h.animal_count) || 0), 0)
                const herdLabel = planHerds.length > 0
                  ? planHerds.map((h: any) => h.name).join(', ')
                  : (plan.herds?.name || 'Multi-rodeo')

                return (
                  <div
                    key={plan.id}
                    className={`px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      isExitUrgent ? 'bg-amber-50/40' : isActive ? 'bg-green-50/20' : ''
                    }`}
                    style={{ borderLeft: `3px solid ${isExitOverdue ? '#ef4444' : isExitUrgent ? '#f59e0b' : isActive ? '#D4A373' : color}` }}
                  >
                    {/* Date block */}
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-lg font-black text-gray-900 leading-none">{entryD.getDate()}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{entryD.toLocaleDateString('es', { month: 'short' })}</p>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{plan.paddocks?.name || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-500 truncate">{herdLabel}</span>
                        {totalHeads > 0 && (
                          <>
                            <span className="text-gray-200 text-[10px]">·</span>
                            <span className="text-[10px] font-bold text-gray-600 flex items-center gap-0.5">
                              {totalHeads} cab.
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: countdown badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Exit badge */}
                      {exitDate && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isExitOverdue  ? 'bg-red-100 text-red-700' :
                          isExitToday    ? 'bg-red-100 text-red-700' :
                          isExitTomorrow ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {isExitOverdue
                            ? `Venció hace ${Math.abs(daysUntilExit!)}d`
                            : isExitToday
                              ? '¡Sale HOY!'
                              : isExitTomorrow
                                ? '¡Sale mañana!'
                                : `Sale en ${daysUntilExit}d`}
                        </span>
                      )}

                      {/* Entry countdown when not yet active */}
                      {!isActive && daysUntilEntry > 0 && (
                        <span className="text-[9px] font-bold text-gray-400">
                          entra en {daysUntilEntry}d
                        </span>
                      )}
                      {isActive && !exitDate && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wider">
                          Activo
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Vigor Forrajero y Ajuste Climático */}
        <div className="flex-[2] bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Satellite className="w-4 h-4 text-green-600" /> Monitoreo de Vigor y Clima (CDP)
            </h3>
            <div className="flex items-center gap-4">
               <button onClick={refreshAllNdvi} className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${ndviLoading ? 'animate-spin' : ''}`} /> Actualizar NDVI
              </button>
              <Link href="/dashboard/grazing" className="text-[10px] font-bold text-green-600 hover:underline">Ver Planificador →</Link>
            </div>
          </div>
          <div className="p-4 flex-1">
            <ForageVigorMonitor />
          </div>
        </div>
      </div>

    </div>
  )
}
