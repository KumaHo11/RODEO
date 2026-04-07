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
  Lightbulb, Target, RotateCcw, PawPrint, Beef, MapPin
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
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Panel principal</h1>
        {loading && <Loader2 className="w-4 h-4 text-green-600 animate-spin" />}
      </div>

      {/* ══ FILA 1: Pilares del campo (2/3 + 1/3) ══ */}
      <div className="flex flex-col lg:flex-row gap-4 shrink-0">
        {/* IZQUIERDA: Potreros (2/3) */}
        <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-900 to-green-800 text-white shrink-0">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Layers className="w-4 h-4" /> Potreros
            </h2>
            <Link href="/dashboard/mi-campo" className="text-xs font-bold hover:underline flex items-center gap-1 text-green-100">
              Ver mapa <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* Dato Principal */}
            <div className="p-6 md:w-1/2 flex flex-col justify-center bg-green-50/30">
              {loading ? (
                <div className="space-y-2"><div className="h-10 w-24 bg-gray-200 animate-pulse rounded-lg"/><div className="h-4 w-32 bg-gray-200 animate-pulse rounded-lg"/></div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className="text-5xl font-black text-green-900 leading-none">
                      {totalArea > 0 ? Math.round(totalMS / totalArea).toLocaleString() : 0}
                    </p>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-400 leading-tight">kg por</span>
                      <span className="text-sm font-bold text-gray-400 leading-tight">hectárea</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-white rounded-xl border border-green-100 inline-block shadow-sm">
                    <p className={`text-xl font-black ${autonomyDays > 30 ? 'text-green-600' : autonomyDays > 15 ? 'text-amber-500' : 'text-red-600'}`}>
                      {autonomyDays > 0 ? `${autonomyDays} días` : '—'} <span className="text-xs font-bold text-gray-500">de autonomía</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Con la hacienda actual y el forraje disponible</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Lista mini */}
            <div className="border-t md:border-t-0 md:border-l border-gray-100 md:w-1/2 flex flex-col">
              <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                <p className="text-[10px] font-black tracking-widest uppercase text-gray-400">Distribución de forraje</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {paddocks.slice(0, 5).map(p => {
                  const ha = Number(p.area_ha) || 0
                  const ms = Number(p.dry_matter_kg_ha) || Number((p as any).estimated_adh) || 0
                  const pct = (ms / 3000) * 100 // Visual baseline
                  return (
                    <div key={p.id} className="p-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-end mb-1">
                          <p className="text-xs font-bold text-gray-700 truncate">{p.name}</p>
                          <p className="text-xs font-black text-green-700">{ms.toLocaleString()} <span className="text-[9px] font-bold text-gray-400">kg/ha</span></p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${ms > 1500 ? 'bg-green-500' : ms > 800 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* DERECHA: Rebaños y Clima (1/3) */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Rebaños */}
          <div className="bg-[#fffbeb] rounded-2xl border border-[#fde68a] shadow-sm flex flex-col p-4 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[10px] font-black tracking-widest uppercase text-amber-700/60 flex items-center gap-1">
                  <Beef className="w-3 h-3" /> Carga animal
                </h3>
                <p className="text-base font-black text-amber-900 mt-1">{herds.length} rebaños · {herds.reduce((s, h) => s + (Number(h.head_count) || 0), 0)} animales</p>
              </div>
            </div>
            
            <div className="mt-4 flex items-end gap-2">
              <p className="text-4xl font-black text-[#92400e] leading-none">{cargaAnimal.toFixed(2)}</p>
              <div className="pb-1 group relative">
                <p className="text-xs font-bold text-amber-800">EV por hectárea <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-amber-200/50 rounded-full text-[9px] cursor-help">?</span></p>
                {/* TOOLTIP */}
                <div className="absolute opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-[10px] p-2 rounded-lg w-48 bottom-full mb-1 left-0 transition-opacity pointer-events-none z-10 shadow-xl">
                  Un Equivalente Vaca (EV) es la unidad de referencia para medir cuánto consume un animal adulto de 400 kg por día (aprox. 12 kg de materia seca).
                </div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-1.5">
              <div className="flex gap-1">
                <div className={`w-2.5 h-2.5 rounded-full ${cargaAnimal <= 0.8 ? 'bg-green-500 scale-125' : 'bg-gray-200'}`} />
                <div className={`w-2.5 h-2.5 rounded-full ${cargaAnimal > 0.8 && cargaAnimal <= 1.2 ? 'bg-amber-500 scale-125' : 'bg-gray-200'}`} />
                <div className={`w-2.5 h-2.5 rounded-full ${cargaAnimal > 1.2 ? 'bg-red-500 scale-125' : 'bg-gray-200'}`} />
              </div>
              <p className="text-[10px] font-bold text-amber-900 ml-1">
                {cargaAnimal <= 0.8 ? 'Bajo' : cargaAnimal <= 1.2 ? 'Normal' : 'Alto'}
              </p>
            </div>
          </div>

          {/* Clima */}
          <div className="bg-[#f0f9ff] rounded-2xl border border-[#bae6fd] shadow-sm p-4 flex-1 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-6 -right-6 text-blue-200/40 w-24 h-24">
               <Sun className="w-full h-full" />
            </div>
            <div className="relative z-10">
              <h3 className="text-[10px] font-black tracking-widest uppercase text-blue-800/60 flex items-center gap-1">
                <CloudRain className="w-3 h-3" /> Clima
              </h3>
              <div className="mt-1 flex items-center gap-3">
                {loading ? <div className="h-8 w-16 bg-blue-100/50 animate-pulse rounded-lg" /> : (
                  <>
                    <p className="text-3xl font-black text-blue-900">{weather?.forecastDays[0]?.maxTemp || '—'}°</p>
                    {weather?.next15DaysRain !== undefined && (
                      <p className="text-sm font-bold text-blue-800 leading-tight">
                        {weather.next15DaysRain} mm lluvia<br/><span className="text-[10px] font-medium opacity-80">próximos 15 días</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {!loading && weather?.forecastDays?.length && (
              <div className="flex gap-2 mt-4 relative z-10 justify-between">
                {weather.forecastDays.slice(0,4).map((d, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[9px] font-black uppercase text-blue-800/80">{WEEK_DAYS[new Date(d.date + 'T00:00:00').getDay()]}</p>
                    <p className="text-xs my-0.5">{d.precipitationSum > 0 ? '🌧️' : '☀️'}</p>
                    <p className="text-[10px] font-bold text-blue-900">{d.precipitationSum} mm</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ FILA 2: Planificación estratégica ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shrink-0 flex flex-col w-full">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-black flex items-center gap-2 text-gray-900">
            <Lightbulb className="w-4 h-4 text-green-600" /> Planificación estratégica
          </h2>
          <Link href="/dashboard/insights" className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1">
            Ver análisis completo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Rotación */}
          {(() => {
            const resting = paddocks.filter(p => p.current_status !== 'GRAZING').length
            const rotPct = paddocks.length > 0 ? Math.round((resting / paddocks.length) * 100) : 0
            return (
              <div className="p-5 flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-green-500" strokeWidth="3" strokeDasharray={`${rotPct}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-black text-gray-700">{rotPct}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Rotación actual</p>
                  <p className="text-sm font-black text-gray-900 leading-tight">{resting}/{paddocks.length}<br/><span className="text-xs font-normal text-gray-500 line-clamp-1">potreros en descanso</span></p>
                </div>
              </div>
            )
          })()}

          {/* Balance forrajero */}
          {(() => {
            const totalMSOffer   = totalMS * 0.5
            const dailyDemand    = totalEV * 12
            const deficit = dailyDemand > 0 && totalMSOffer < dailyDemand
            return (
              <div className="p-5 flex flex-col justify-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 pb-1">Balance forrajero</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-black ${deficit ? 'text-red-600' : 'text-green-600'}`}>
                    {deficit ? 'Déficit' : 'Superávit'}
                  </p>
                </div>
                <p className="text-xs font-medium text-gray-900 mt-0.5">
                  {(totalMSOffer - dailyDemand).toLocaleString()} kg MS/día <span className="text-gray-500">{deficit ? 'faltantes' : 'de reserva'}</span>
                </p>
              </div>
            )
          })()}

          {/* Recomendación IA estática/placeholder */}
          <div className="p-5 flex items-start gap-3 bg-gray-50/50">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Recomendación IA</p>
              <p className="text-[11px] text-gray-700 font-medium leading-relaxed">
                Mover el rebaño principal en {autonomyDays > 0 ? Math.min(autonomyDays, 7) : 3} días. El nivel de forraje está {autonomyDays > 15 ? 'estable' : 'crítico'}.
              </p>
              <Link href="/dashboard/grazing" className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-[10px] font-bold bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                Planificar movimiento →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FILA 3: Próximas acciones ══ */}
      <div className="flex flex-col md:flex-row gap-4 shrink-0 min-h-[px]">
        
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
                  {t.herds?.name && <p className="text-[10px] items-center gap-1 text-gray-500 truncate flex"><Beef className="w-3 h-3"/> {t.herds.name}</p>}
                  <span className={`inline-block mt-1 text-[8px] font-black px-1.5 py-0.5 rounded-full ${TASK_PRIORITY_COLORS[t.priority?.toLowerCase()] || TASK_PRIORITY_COLORS.baja}`}>{t.priority || 'Normal'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Movimientos */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center bg-blue-50/30">
            <h3 className="text-xs font-black text-blue-900 flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" /> Movimientos planificados</h3>
            <Link href="/dashboard/grazing" className="text-[10px] font-bold text-blue-700 hover:underline">Planificador</Link>
          </div>
          <div className="p-2 flex-1">
            {nextMoves.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center font-bold">Sin movimientos programados</p>
            ) : nextMoves.slice(0,3).map(m => {
              const isActive = m.status === 'ACTIVE'
              return (
                <div key={m.id} className="p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-all">
                  <div className={`w-8 h-8 rounded-full flex flex-col items-center justify-center shrink-0 border ${isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{(m.herds as any)?.name} → {(m.paddocks as any)?.name}</p>
                    {isActive ? <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">En curso</span> : <span className="text-[10px] text-gray-500">Próximamente</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Crecimiento (NDVI) */}
        <div className="flex-1 bg-[#ecfdf5] rounded-2xl border border-[#6ee7b7] shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-emerald-200/50 flex justify-between items-center">
            <h3 className="text-xs font-black text-emerald-900 flex items-center gap-1.5"><Satellite className="w-3.5 h-3.5" /> Crecimiento del pasto</h3>
            <button onClick={refreshAllNdvi} className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${ndviLoading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-center relative">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60 mb-2">Velocidad de crecimiento</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black text-emerald-700 leading-none">
                {avgGrowthRate !== null ? `${avgGrowthRate >= 0 ? '+' : ''}${avgGrowthRate.toFixed(1)}` : '—'}
              </p>
              {avgGrowthRate !== null && <TrendingUp className="w-6 h-6 text-emerald-600" />}
            </div>
            <p className="text-xs font-bold text-emerald-800/80 mt-1 pb-4">kg de materia seca · por hectárea · por día</p>
            
            <div className="mt-auto border-t border-emerald-200/50 pt-3">
              <p className="text-[9px] text-emerald-700/70 font-medium">Promedio de campos medidos · Fuente: satélite Sentinel-2</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
