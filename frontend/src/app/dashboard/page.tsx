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
  Lightbulb, Target, RotateCcw, PawPrint, MapPin, Download, ThermometerSnowflake, Flame
} from 'lucide-react'
import CowIcon from '@/components/CowIcon'
import { FeatureWidget } from '@/components/FeatureWidget'
import { AppHeader } from '@/components/AppHeader'
import { MarketWidget } from '@/components/MarketWidget'
import nextDynamic from 'next/dynamic'
const ForageVigorMonitor = nextDynamic(() => import('@/components/ForageVigorMonitor'), { ssr: false })
import { toast } from 'sonner'

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
import { usePlan } from '@/hooks/usePlan'

export default function DashboardOverview() {
  const { user, profile, isLoading: authLoading } = useAuth()
  const { hasFeature } = usePlan()
  const router = useRouter()
  const [loading, setLoading]             = useState(true)
  const [herds, setHerds]                 = useState<any[]>([])
  const [paddocks, setPaddocks]           = useState<any[]>([])
  const [org, setOrg]                     = useState<any>(null)
  const { current: weatherCurrent, forecast: weatherForecast, locationName, isLoading: weatherLoading } = useWeather()
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
        const rate = (curr - prev) / days
        if (rate >= 0) {
          rates[p.id] = rate
        }
      }
    })
    setGrowthRates(rates)
    const vals = Object.values(rates)
    setAvgGrowthRate(vals.length > 0 ? vals.reduce((s, r) => s + r, 0) / vals.length : null)
  }

  // ── Refresh NDVI from satellite for each paddock ────────────────────────────
  const refreshAllNdvi = useCallback(async () => {
    if (ndviLoading || paddocks.length === 0) return
    
    const todayStr = new Date().toISOString().split('T')[0]
    
    // Check if ALL eligible paddocks (with boundary) are already updated recently (last 5 days)
    const eligiblePaddocks = paddocks.filter(p => p.boundary)
    if (eligiblePaddocks.length > 0 && eligiblePaddocks.every(p => {
      if (!p.previous_ndvi_date) return false
      return (Date.now() - new Date(p.previous_ndvi_date).getTime()) / 86400000 < 5
    })) {
      toast.info(`El NDVI se actualiza cada 5 días. Los potreros ya están al día.`)
      return
    }

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
          if (p.previous_ndvi_date) {
            const daysSince = (Date.now() - new Date(p.previous_ndvi_date).getTime()) / 86400000
            if (daysSince < 5) {
              processed++
              setNdviStatus(`Procesando ${processed}/${toProcess.length} potreros...`)
              return
            }
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
            const rate = (newMs - prevForCalc) / days
            if (rate >= 0) {
              rates[p.id] = rate
            }
          } else {
            const rate = (newMs - 500) / 7
            if (rate >= 0) {
              rates[p.id] = rate
            }
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
  
  const canNdvi = hasFeature('ndvi_access')

  // Ajuste por Frío / THI
  const currentTemp = weatherCurrent?.tempC ?? 20
  const isColdStress = currentTemp < 10
  const isHeatStress = currentTemp > 30

  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto pb-24 md:pb-8">
      {/* ══ HEADER ══ */}
      <AppHeader
        title="Panel principal"
        subtitle="Centro de mando unificado"
        actions={
          <div className="flex items-center gap-3">
            {loading && <Loader2 className="w-5 h-5 text-green-600 animate-spin" />}
            <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Descargar historial
            </button>
          </div>
        }
      />

      {/* ══ FILA 1: Contextual Header (Clima + Mercado) ══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <FeatureWidget
          title="Clima actual"
          icon={<CloudRain className="w-4 h-4 text-blue-500" />}
          isFeatureEnabled={true}
          className="md:col-span-1 bg-[#f0f9ff] border-[#bae6fd]"
        >
          <div className="flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute -top-6 -right-6 text-blue-200/40 w-24 h-24 pointer-events-none">
              <Sun className="w-full h-full" />
            </div>
            
            <div className="flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-3">
                {loading || weatherLoading ? (
                  <div className="h-8 w-16 bg-blue-100/50 animate-pulse rounded-lg" />
                ) : (
                  <>
                    <p className="text-4xl font-black text-blue-900">{weatherCurrent?.tempC ?? '—'}°</p>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-blue-800 leading-tight">
                        {weatherCurrent?.conditionLabel ?? '—'}
                      </p>
                      <p 
                        className="text-[10px] font-bold text-blue-600/70 uppercase flex items-center gap-1 truncate"
                        title={locationName ?? 'Campo'}
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{locationName ?? 'Campo'}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 z-10">
              {isColdStress && (
                <div className="bg-blue-100/80 text-blue-800 p-2.5 rounded-xl flex items-center gap-3 border border-blue-200 shadow-sm">
                  <ThermometerSnowflake className="w-5 h-5 shrink-0" />
                  <p className="text-[10px] leading-tight font-medium">
                    <strong className="block text-xs font-bold mb-0.5">Alerta de frío</strong>
                    Menor crecimiento CC. Sugerencia: Aumentar oferta de forraje.
                  </p>
                </div>
              )}
              {isHeatStress && (
                <div className="bg-red-100/80 text-red-800 p-2.5 rounded-xl flex items-center gap-3 border border-red-200 shadow-sm">
                  <Flame className="w-5 h-5 shrink-0" />
                  <p className="text-[10px] leading-tight font-medium">
                    <strong className="block text-xs font-bold mb-0.5">Estrés térmico</strong>
                    Sugerencia: Priorizar potreros con sombra natural.
                  </p>
                </div>
              )}
              {!isColdStress && !isHeatStress && weatherForecast?.length > 0 && (
                <div className="flex gap-2 justify-between mt-2 pt-3 border-t border-blue-200/50">
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
          </div>
        </FeatureWidget>
        
        <div className="md:col-span-2">
          <MarketWidget />
        </div>
      </div>

      {/* ══ FILA 2: Operacional y Logística ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
        
        {/* Gestión Operativa */}
        <FeatureWidget
          title="Gestión operativa"
          icon={<CheckSquare className="w-4 h-4 text-violet-600" />}
          isFeatureEnabled={true}
          actionLabel="Ver agenda"
          href="/dashboard/agenda"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pr-2">
              {[...farmEvents.map(e => ({ ...e, _type: 'event' })), ...upcomingTasks.map(t => ({ ...t, _type: 'task' }))]
                .sort((a, b) => {
                  const dateA = a._type === 'event' ? a.event_date : a.due_date || '9999-12-31';
                  const dateB = b._type === 'event' ? b.event_date : b.due_date || '9999-12-31';
                  return dateA.localeCompare(dateB);
                })
                .slice(0, 6)
                .map((item) => {
                  if (item._type === 'event') {
                    const d = new Date(item.event_date + 'T00:00:00');
                    const isActive = d <= new Date();
                    return (
                      <div key={`evt-${item.id}`} className="py-2.5 flex items-center gap-3 group">
                        <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 ${isActive ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                          <span className="text-[9px] font-bold text-gray-500 uppercase">{d.toLocaleDateString('es-AR', { month: 'short' }).replace('.','')}</span>
                          <span className="text-base font-black text-gray-900 leading-none mt-0.5">{d.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-2 h-2 rounded-full ${item.event_type === 'servicio' ? 'bg-red-500' : item.event_type === 'paricion' ? 'bg-blue-500' : 'bg-green-500'}`} />
                            <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{item.description || 'Evento de campo'}</p>
                        </div>
                      </div>
                    )
                  } else {
                    return (
                      <div key={`task-${item.id}`} className="py-2.5 flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex flex-col items-center justify-center shrink-0 text-violet-600">
                          <CheckSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                            {item.paddocks?.name && <><MapPin className="w-3 h-3"/> {item.paddocks.name}</>}
                          </p>
                        </div>
                        <span className={`inline-block mt-1 text-[8px] font-black px-1.5 py-0.5 rounded-full ${TASK_PRIORITY_COLORS[item.priority?.toLowerCase()] || TASK_PRIORITY_COLORS.baja}`}>{item.priority || 'Normal'}</span>
                      </div>
                    )
                  }
                })}
                {farmEvents.length === 0 && upcomingTasks.length === 0 && (
                  <p className="text-xs text-gray-400 font-bold py-8 text-center flex flex-col items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-gray-200" />
                    Sin tareas ni eventos urgentes
                  </p>
                )}
            </div>
          </div>
        </FeatureWidget>

        {/* Logística de Movimientos */}
        <FeatureWidget
          title="Logística de movimientos"
          icon={<Navigation className="w-4 h-4 text-green-600" />}
          isFeatureEnabled={true}
          actionLabel="Planificador"
          href="/dashboard/grazing"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pr-2">
              {nextMoves.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold py-8 text-center flex flex-col items-center gap-2">
                  <RotateCcw className="w-6 h-6 text-gray-200" />
                  Sin movimientos planificados
                </p>
              ) : (
                nextMoves.slice(0, 5).map((plan: any, i: number) => {
                  const todayMid = new Date(); todayMid.setHours(0,0,0,0)
                  const exitDate = plan.exit_date
                  const daysUntilExit = exitDate
                    ? Math.round((new Date(exitDate + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000)
                    : null
                  const isExitToday     = daysUntilExit === 0
                  const isExitUrgent    = daysUntilExit !== null && daysUntilExit <= 1
                  const isActive        = plan.status === 'ACTIVE' || plan.entry_date <= new Date().toISOString().split('T')[0]

                  return (
                    <div key={plan.id} className={`py-2.5 flex items-center gap-3 ${isExitUrgent ? 'bg-red-50/30 rounded-xl px-2' : ''}`}>
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${isExitUrgent ? 'bg-red-50 border-red-100 text-red-500' : isActive ? 'bg-green-50 border-green-100 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{plan.paddocks?.name || 'Potrero'}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{plan.herds?.name || 'Rodeo'}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        {isExitToday && (
                          <span className="text-[9px] font-black px-2.5 py-1 rounded-md bg-red-500 text-white shadow-sm shadow-red-500/20 uppercase tracking-widest animate-pulse">
                            ¡Sale hoy!
                          </span>
                        )}
                        {!isExitToday && isExitUrgent && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 uppercase tracking-widest">
                            Mañana
                          </span>
                        )}
                        {!isExitUrgent && exitDate && (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            en {daysUntilExit}d
                          </span>
                        )}
                        {!exitDate && !isActive && (
                          <span className="text-[10px] font-bold text-gray-400">
                            próxima entrada
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </FeatureWidget>

      </div>

      {/* ══ FILA 3: NDVI y Carga Animal ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        
        {/* Pastoreo y vigor (NDVI) */}
        <FeatureWidget
          title="Pastoreo y vigor (NDVI)"
          icon={<Satellite className="w-4 h-4 text-emerald-600" />}
          isFeatureEnabled={canNdvi}
          requiredPlan="latifundio"
          actionLabel="Actualizar"
          onAction={refreshAllNdvi}
          className="lg:col-span-2"
        >
          <div className="rounded-xl relative">
             <ForageVigorMonitor className="min-h-[260px] h-full" />
          </div>
        </FeatureWidget>

        {/* Métrica de Carga Animal */}
        <FeatureWidget
          title="Carga animal (EV/ha)"
          icon={<Scale className="w-4 h-4 text-amber-600" />}
          isFeatureEnabled={true}
        >
          <div className="flex flex-col items-center justify-between h-full py-2">
            <div className="relative w-40 h-32 flex items-end justify-center mb-2">
              <svg className="absolute top-0 w-40 h-40 transform -rotate-180" viewBox="0 0 36 36">
                <path className="text-gray-100" strokeWidth="2.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeDasharray="50, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className={`stroke-current ${cargaAnimal <= 0.8 ? 'text-green-500' : cargaAnimal <= 1.2 ? 'text-amber-500' : 'text-red-500'} drop-shadow-md`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${Math.min(50, (cargaAnimal / 1.5) * 50)}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="text-center z-10 bg-white/80 rounded-full px-4 py-2 backdrop-blur-sm">
                <p className="text-4xl font-black text-gray-900 leading-none">{cargaAnimal.toFixed(2)}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-wider">Actual</p>
              </div>
            </div>

            <div className="w-full space-y-2 mt-auto">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Límite óptimo</p>
                  <p className="text-xs font-black text-gray-900">0.8 EV/ha</p>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold ${cargaAnimal <= 0.8 ? 'bg-green-100 text-green-700' : cargaAnimal <= 1.2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {cargaAnimal <= 0.8 ? 'Balanceado' : cargaAnimal <= 1.2 ? 'Atención' : 'Sobrepastoreo'}
                </div>
              </div>
              
              {cargaAnimal > 0.8 && (
                <p className="text-[10px] text-amber-700 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Carga por encima del nivel regenerativo ideal del campo.
                </p>
              )}
              {isColdStress && cargaAnimal > 0.5 && (
                <p className="text-[10px] text-blue-700 font-bold bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-start gap-1.5">
                  <ThermometerSnowflake className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Bajas temperaturas elevan el requerimiento basal. Ajustar carga o suplementar.
                </p>
              )}
            </div>
          </div>
        </FeatureWidget>

      </div>
    </div>
  )
}

