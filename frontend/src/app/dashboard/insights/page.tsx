'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FeatureGate } from '@/components/FeatureGate'
import {
  TrendingUp, TrendingDown, Minus, Leaf, AlertTriangle,
  CheckCircle, Info, Sparkles, BarChart3, Target, Camera,
  Loader2, RefreshCw, Sun, Snowflake, Scale, CalendarDays,
  Zap, CloudRain, ArrowRight, X, DollarSign
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ────────────────────────────────────────────────────────────────────
interface InsightCard {
  id: string
  title: string
  value: string
  subtitle: string
  trend?: 'up' | 'down' | 'neutral' | 'warning' | 'ok'
  icon: React.ReactNode
  color: string
  detail?: string
  recommendation?: string
  badge?: string
  badgeColor?: string
}

type Score = { value: number; label: string; color: string }

function fmt(n: number, digits = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// ── Component ──────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────
// Safe ISO date normalizer
function safeIso(val: any): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val)
  return s.includes('T') ? s.split('T')[0] : s
}

function daysBetween(a: any, b: any): number {
  const sa = safeIso(a)
  const sb = safeIso(b)
  if (!sa || !sb) return 0
  const da = new Date(sa + 'T00:00:00')
  const db = new Date(sb + 'T00:00:00')
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

// Detect southern hemisphere season based on month
function getCurrentSeason(): { name: string; icon: string; restDaysMin: number; restDaysMax: number; growthFactor: number } {
  const month = new Date().getMonth() + 1 // 1-12
  if (month >= 12 || month <= 2) return { name: 'Verano', icon: '☀️', restDaysMin: 45, restDaysMax: 65, growthFactor: 1.4 }
  if (month >= 3 && month <= 5)  return { name: 'Otoño',   icon: '🍂', restDaysMin: 60, restDaysMax: 80, growthFactor: 0.9 }
  if (month >= 6 && month <= 8)  return { name: 'Invierno',icon: '❄️', restDaysMin: 80, restDaysMax: 110,growthFactor: 0.4 }
  return                                  { name: 'Primavera',icon: '🌱', restDaysMin: 35, restDaysMax: 50, growthFactor: 1.6 }
}

function holismoScore(paddocks: any[], plans: any[], herds: any[], weather: any): Score {
  let score = 100
  const season = getCurrentSeason()
  const today = new Date().toISOString().split('T')[0]

  // 1. Rest period adequacy
  const paddocksWithRecentGrazing = plans.filter(p => {
    const exit = p.exit_date || ''
    return exit && daysBetween(exit, today) < season.restDaysMin
  }).length
  const restPenalty = Math.min(30, (paddocksWithRecentGrazing / Math.max(1, paddocks.length)) * 40)
  score -= restPenalty

  // 2. Weather stress (null-safe)
  const forecastMm = weather?.forecast_mm_15d ?? weather?.precipitation_sum?.[0] ?? null
  if (forecastMm !== null && forecastMm < 20) score -= 15

  // 3. Active plan coverage
  const paddocksWithPlan = new Set(plans.map(p => p.paddock_id)).size
  const coverage = paddocks.length > 0 ? paddocksWithPlan / paddocks.length : 1
  if (coverage < 0.6) score -= 10

  // 4. Paddocks with biomass data
  const withBiomass = paddocks.filter(p => p.dry_matter_kg_ha && p.dry_matter_kg_ha > 0).length
  if (withBiomass < paddocks.length * 0.5) score -= 10

  score = Math.max(10, Math.round(score))
  const color = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'
  const label = score >= 75 ? 'Óptimo' : score >= 50 ? 'Regular' : 'Atención'
  return { value: score, label, color }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { user, profile } = useAuth()

  return (
    <FeatureGate
      feature="ai_insights"
      title="Módulo Insights IA"
      description="Analizá tu campo con inteligencia artificial. Obtené recomendaciones predictivas de carga, forraje y clima basadas en tus datos reales."
      requiredPlan="Holístico"
    >
      <InsightsContent user={user} profile={profile} />
    </FeatureGate>
  )
}

function InsightsContent({ user, profile }: { user: any; profile: any }) {

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showFinancialModal, setShowFinancialModal] = useState(false)
  const [showClimateModal, setShowClimateModal] = useState(false)
  const [financialResult, setFinancialResult] = useState<any>(null)
  const [climateResult, setClimateResult] = useState<any>(null)
  const [rainInput, setRainInput] = useState(25)
  const [simulating, setSimulating] = useState(false)
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [farmEvents, setFarmEvents] = useState<any[]>([])
  const [fieldNotes, setFieldNotes] = useState<any[]>([])
  const [weather, setWeather] = useState<any>(null)
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)


  const today = new Date().toISOString().split('T')[0]
  const month = new Date().toLocaleString('es', { month: 'long', year: 'numeric' })
  const season = getCurrentSeason()

  async function loadData() {
    if (!user) return
    setRefreshing(true)
    try {
      const [paddocksRes, plansRes, herdsRes, eventsRes, notesRes] = await Promise.all([
        apiFetch('/api/paddocks').catch(() => null),
        apiFetch('/api/grazing-plans').catch(() => null),
        apiFetch('/api/herds').catch(() => null),
        apiFetch('/api/farm-events').catch(() => null),
        apiFetch('/api/field-notes').catch(() => null),
      ])

      setPaddocks(paddocksRes?.ok ? (await paddocksRes.json()).paddocks ?? [] : [])
      setPlans(plansRes?.ok ? (await plansRes.json()).plans ?? [] : [])
      setHerds(herdsRes?.ok ? (await herdsRes.json()).herds ?? [] : [])
      setFarmEvents(eventsRes?.ok ? (await eventsRes.json()).events ?? [] : [])
      setFieldNotes(notesRes?.ok ? (await notesRes.json()).notes ?? [] : [])

    } catch (err) {
      console.error('Insights loadData error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const runFinancialSimulation = async () => {
    setSimulating(true)
    try {
      const res = await apiFetch('/api/predictive', { 
        method: 'POST', 
        body: JSON.stringify({ 
          type: 'financial', 
          org_id: profile?.organization_id,
          threshold_days: 15
        }) 
      })
      
      if (!res.ok) throw new Error('API Error')
      
      const data = await res.json()
      setFinancialResult(data)
      setShowFinancialModal(true)
    } catch (e) {
      console.error('Financial simulation failed:', e)
    } finally {
      setSimulating(false)
    }
  }

  const runClimateSimulation = async () => {
    setSimulating(true)
    try {
      const res = await apiFetch('/api/predictive', { 
        method: 'POST', 
        body: JSON.stringify({ 
          type: 'climate', 
          paddock_id: paddocks[0]?.id || 'default', // Using first paddock for simulation
          rainfall_mm: rainInput,
          days_forecast: 21
        }) 
      })

      if (!res.ok) throw new Error('API Error')

      const data = await res.json()
      setClimateResult(data)
    } catch (e) {
      console.error('Climate simulation failed:', e)
    } finally {
      setSimulating(false)
    }
  }

  useEffect(() => { loadData() }, [user])

  // ── Derived metrics ────────────────────────────────────────────────────────
  const totalHectares = useMemo(() => paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0), [paddocks])
  const totalAnimals = useMemo(() => herds.reduce((s, h) => s + (Number(h.animal_count) || 0), 0), [herds])

  const totalEV = useMemo(() => herds.reduce((s, h) => {
    const avgWeight = Number(h.avg_weight_kg) || 450
    return s + (Number(h.animal_count) || 0) * (avgWeight / 450)
  }, 0), [herds])

  const stockingRate = totalHectares > 0 ? totalEV / totalHectares : 0
  const stockingOptimal = stockingRate >= 0.5 && stockingRate <= 1.5

  // Active plans today
  const activePlans = useMemo(() =>
    plans.filter(p => p.entry_date <= today && (!p.exit_date || p.exit_date >= today)),
    [plans, today])

  const activePaddockIds = new Set(activePlans.map(p => p.paddock_id))
  const restingPaddocks = paddocks.filter(p => !activePaddockIds.has(p.id))

  // Last biomass from field notes or paddock data
  const lastBiomassNote = useMemo(() => {
    return fieldNotes.find(n => n.tags?.includes('BIOMASA') || n.analysis_result) || null
  }, [fieldNotes])
  const lastBiomassMs = lastBiomassNote?.analysis_result?.dry_matter_kg_ha
    || lastBiomassNote?.ai_analysis?.dry_matter_kg_ha
    || null

  // Average MS from paddocks that have data
  const avgPaddockMs = useMemo(() => {
    const withMs = paddocks.filter(p => Number(p.dry_matter_kg_ha) > 0)
    if (withMs.length === 0) return null
    const sum = withMs.reduce((s, p) => s + Number(p.dry_matter_kg_ha), 0)
    return Math.round(sum / withMs.length)
  }, [paddocks])

  const bestMs = lastBiomassMs || avgPaddockMs

  // Daily demand
  const dailyDemandKg = totalEV * 11 // 11 kg MS/EV/día standard Arg
  const forecastedDaysAvailable = bestMs && totalHectares && dailyDemandKg > 0
    ? Math.round((bestMs * totalHectares * 0.6) / dailyDemandKg) : null

  // Rotation quality: ratio of paddocks resting vs total
  const rotationRatio = paddocks.length > 0 ? restingPaddocks.length / paddocks.length : 0

  // Days since last move
  const lastPlanExit = plans.find(p => p.exit_date && p.exit_date <= today)?.exit_date
  const daysSinceLastMove = lastPlanExit ? daysBetween(lastPlanExit, today) : null

  // Upcoming events (next 30d)
  const upcoming30 = farmEvents.filter(e => {
    const ed = safeIso(e.event_date)
    if (!ed) return false
    return ed >= today && daysBetween(today, ed) <= 30
  })

  // ── AI animal body condition from photo notes ─────────────────────────────
  const animalConditionNotes = useMemo(() =>
    fieldNotes.filter(n => n.analysis_result?.animal_body_condition || n.analysis_result?.condition_score),
    [fieldNotes])
  const lastConditionNote = animalConditionNotes[0] || null
  const avgConditionScore: number | null = lastConditionNote?.analysis_result?.condition_score
    || lastConditionNote?.analysis_result?.animal_body_condition || null

  // Daily grazing capacity: how many EV-days a paddock can sustain at 60% harvest
  const paddockCapacities = useMemo(() =>
    paddocks.map(p => {
      const ms = p.dry_matter_kg_ha || 0
      const ha = p.area_ha || 0
      const totalMs = ms * ha * 0.6
      const evDays = dailyDemandKg > 0 ? Math.round(totalMs / dailyDemandKg) : 0
      return { ...p, evDays, totalMs }
    }).filter(p => p.evDays > 0).sort((a, b) => b.evDays - a.evDays),
    [paddocks, dailyDemandKg])

  // Holistic score
  const score = useMemo(() => holismoScore(paddocks, plans, herds, weather), [paddocks, plans, herds, weather])

  // ── AI Recommendation ─────────────────────────────────────────────────────
  const generateAiInsight = async () => {
    setLoadingAi(true)
    try {
      const context = {
        paddocks: paddocks.length, totalHa: totalHectares, herds: herds.length,
        totalAnimals, totalEV: totalEV.toFixed(1), stockingRate: stockingRate.toFixed(2),
        activePlans: activePlans.length, restingPaddocks: restingPaddocks.length,
        lastBiomassMs: bestMs, daysSinceLastMove, upcomingEvents: upcoming30.length,
        score: score.value, season: season.name, avgConditionScore,
        rotationRatio: (rotationRatio * 100).toFixed(0),
      }
      const res = await fetch('/api/insights-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })
      if (res.ok) { const data = await res.json(); setAiRecommendation(data.recommendation) }
    } catch { /* silently fail */ }
    setLoadingAi(false)
  }

  // ── Insight cards ──────────────────────────────────────────────────────────
  const cards: InsightCard[] = [
    {
      id: 'daily_capacity',
      title: 'Autonomía forrajera',
      value: forecastedDaysAvailable ? `${forecastedDaysAvailable} días` : '—',
      subtitle: dailyDemandKg > 0
        ? `Demanda diaria: ${Math.round(dailyDemandKg).toLocaleString()} kg MS/día · ${totalEV.toFixed(0)} EV`
        : 'Configurá tus rodeos para calcular la demanda',
      trend: forecastedDaysAvailable
        ? (forecastedDaysAvailable > 30 ? 'ok' : forecastedDaysAvailable > 14 ? 'neutral' : 'warning')
        : 'neutral',
      icon: <Target className="w-5 h-5" />,
      color: 'bg-emerald-50 border-emerald-100',
      badge: forecastedDaysAvailable && forecastedDaysAvailable < 15 ? 'Crítico' : undefined,
      badgeColor: 'bg-red-100 text-red-700',
      detail: `Con ${totalEV.toFixed(1)} EV y ~11 kg MS/EV/día, tu rodeo consume ${Math.round(dailyDemandKg).toLocaleString()} kg MS por día.`,
      recommendation: forecastedDaysAvailable && forecastedDaysAvailable < 15
        ? 'Autonomía crítica. Evaluá suplementación inmediata.'
        : forecastedDaysAvailable
        ? 'Autonomía razonable. Monitorea semanalmente.'
        : 'Registrá MS en potreros para calcular la autonomía forrajera.',
    },
    {
      id: 'stocking',
      title: 'Carga animal',
      value: totalHectares > 0 ? `${stockingRate.toFixed(2)} EV/ha` : '—',
      subtitle: `${totalAnimals} animales · ${totalEV.toFixed(1)} EV totales en ${totalHectares.toFixed(0)} ha`,
      trend: stockingRate > 1.8 ? 'warning' : stockingRate > 0.3 ? 'ok' : 'neutral',
      icon: <Scale className="w-5 h-5" />,
      color: 'bg-gray-50',
      badge: stockingOptimal ? 'Óptimo' : stockingRate > 1.5 ? 'Alta' : stockingRate > 0 ? 'Baja' : undefined,
      badgeColor: stockingOptimal ? 'bg-green-100 text-green-700' : stockingRate > 1.5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
      detail: 'La carga animal óptima en pastoreo rotativo intensivo es 0.8–1.5 EV/ha.',
      recommendation: stockingRate > 1.8
        ? 'Carga excesiva. Considerá reducir el rodeo o aumentar la superficie grazable.'
        : stockingOptimal ? 'Carga dentro del rango óptimo holístico.'
        : 'Registrá el peso promedio de tus animales para un cálculo más preciso de EV.',
    },
    {
      id: 'biomass',
      title: 'Materia seca · MS/ha',
      value: bestMs ? `${Number(bestMs).toLocaleString()} kg MS/ha` : 'Sin datos',
      subtitle: lastBiomassNote
        ? `IA Gemini · ${new Date(lastBiomassNote.created_at).toLocaleDateString('es')}`
        : avgPaddockMs ? `Promedio ${paddocks.filter(p => Number(p.dry_matter_kg_ha) > 0).length} potreros`
        : 'Analizá fotos IA en Bitácora para registrar',
      trend: bestMs ? (bestMs > 1500 ? 'up' : bestMs > 800 ? 'neutral' : 'down') : 'neutral',
      icon: <Leaf className="w-5 h-5" />,
      color: 'bg-gray-50',
      badge: lastBiomassNote ? 'IA' : avgPaddockMs ? 'NDVI' : undefined,
      badgeColor: 'bg-violet-100 text-violet-700',
      detail: 'El umbral mínimo de remanente post-pastoreo para no erosionar el suelo es 800–1000 kg MS/ha.',
      recommendation: bestMs && bestMs < 1000
        ? 'Biomasa baja. Extendé el descanso de este potrero y evaluá suplementación.'
        : bestMs ? 'Nivel de biomasa adecuado.'
        : 'Fotografiá tus pasturas desde Bitácora para análisis IA automático.',
    },
    {
      id: 'paddock_capacity',
      title: 'Mejor potrero disponible',
      value: paddockCapacities[0] ? `${paddockCapacities[0].evDays} días` : '—',
      subtitle: paddockCapacities[0]
        ? `${paddockCapacities[0].name} · ${Number(paddockCapacities[0].dry_matter_kg_ha)?.toLocaleString()} kg MS/ha · ${Number(paddockCapacities[0].area_ha)?.toFixed(1)} ha`
        : 'Con datos de MS verás cuál está listo',
      trend: paddockCapacities[0]?.evDays > 7 ? 'ok' : 'neutral',
      icon: <Zap className="w-5 h-5" />,
      color: 'bg-gray-50',
      detail: 'Días de autonomía = (MS × ha × 60%) / demanda diaria.',
      recommendation: paddockCapacities[0]
        ? `"${paddockCapacities[0].name}" tiene la mayor oferta disponible.`
        : 'Registrá análisis de materia seca.',
    },
    {
      id: 'rest_season',
      title: `Descanso · ${season.name}`,
      value: `${season.restDaysMin}–${season.restDaysMax} días`,
      subtitle: `Período óptimo de descanso en ${season.name.toLowerCase()} para zona templada`,
      trend: restingPaddocks.length >= 2 ? 'ok' : 'warning',
      icon: season.name === 'Invierno' ? <Snowflake className="w-5 h-5" /> : <Sun className="w-5 h-5" />,
      color: 'bg-gray-50',
      badge: season.name,
      badgeColor: 'bg-gray-100 text-gray-600',
      detail: `En ${season.name.toLowerCase()}, el factor de crecimiento estimado es ×${season.growthFactor}.`,
      recommendation: restingPaddocks.length < 2
        ? `Con pocos potreros en descanso es difícil cumplir los ${season.restDaysMin} días mínimos.`
        : `${restingPaddocks.length} potreros en descanso. Verificá que ninguno tenga menos de ${season.restDaysMin} días.`,
    },
    {
      id: 'rotation',
      title: 'Calidad de rotación',
      value: paddocks.length > 0 ? `${Math.round(rotationRatio * 100)}% en descanso` : '—',
      subtitle: `${restingPaddocks.length} de ${paddocks.length} potreros · ${daysSinceLastMove ?? '—'} días desde último movimiento`,
      trend: rotationRatio > 0.65 ? 'ok' : rotationRatio > 0.4 ? 'neutral' : 'warning',
      icon: <RefreshCw className="w-5 h-5" />,
      color: 'bg-gray-50',
      detail: 'En pastoreo holístico bien manejado, entre el 65–80% deberían estar en descanso.',
      recommendation: rotationRatio > 0.65
        ? 'Excelente distribución de descanso.'
        : rotationRatio > 0.4
        ? 'Hay oportunidad de mejorar. Mové el rodeo más frecuentemente.'
        : 'Baja proporción en descanso. El sistema puede estar sobreconcentrando la presión.',
    },
    {
      id: 'animal_condition',
      title: 'Condición corporal',
      value: avgConditionScore ? `${avgConditionScore}/5 CC` : 'Sin análisis IA',
      subtitle: lastConditionNote
        ? `Análisis Gemini · ${new Date(lastConditionNote.created_at).toLocaleDateString('es')} · ${totalAnimals} animales`
        : 'Fotografiá animales en Bitácora para análisis IA',
      trend: avgConditionScore
        ? (avgConditionScore >= 3.5 ? 'ok' : avgConditionScore >= 2.5 ? 'neutral' : 'down')
        : 'neutral',
      icon: <Camera className="w-5 h-5" />,
      color: 'bg-gray-50',
      badge: avgConditionScore ? 'IA Gemini' : undefined,
      badgeColor: 'bg-violet-100 text-violet-700',
      detail: 'La condición corporal (CC) en escala 1–5: CC < 2.5 indica subnutrición severa. CC 3–3.5 es el objetivo al servicio.',
      recommendation: avgConditionScore && avgConditionScore < 2.5
        ? 'Condición corporal baja. Evaluá suplementación protéica urgente.'
        : avgConditionScore && avgConditionScore >= 3
        ? 'Condición corporal buena.'
        : 'Fotografiá tus animales desde Bitácora para estimación de CC.',
    },
    {
      id: 'events',
      title: 'Eventos de campo',
      value: upcoming30.length > 0 ? `${upcoming30.length} pendiente${upcoming30.length > 1 ? 's' : ''}` : 'Sin eventos',
      subtitle: upcoming30.length > 0
        ? (() => {
            const ev0 = upcoming30[0]
            const ed = ev0 ? safeIso(ev0.event_date) : ''
            const edLabel = ed ? new Date(ed + 'T00:00:00').toLocaleDateString('es') : '—'
            return `Próximo: ${ev0 ? edLabel + ' · ' + ev0.title : '—'}`
          })()
        : (() => {
            const lastEv = farmEvents.filter(e => safeIso(e.event_date) < today).sort((a,b) => safeIso(b.event_date).localeCompare(safeIso(a.event_date)))[0]
            if (lastEv) {
              return `Último registro: ${lastEv.title} (${new Date(safeIso(lastEv.event_date) + 'T00:00:00').toLocaleDateString('es')})`
            }
            return 'Agendá servicio, vacunación y otras fechas críticas'
          })(),
      trend: 'neutral',
      icon: <CalendarDays className="w-5 h-5" />,
      color: 'bg-gray-50',
      detail: 'Los eventos de servicio, parición y vacunación impactan la demanda forrajera.',
      recommendation: upcoming30.length > 0
        ? 'Verificá que el balance forrajero contemple los cambios de carga.'
        : 'Sin eventos próximos. Usá la Agenda para planificar.',
    },
  ]

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px] flex-col gap-3">
      <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      <p className="text-sm text-gray-400">Analizando tu campo...</p>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Forage Autonomy Highlight - Reordered above Holistic Score */}
      {cards.find(c => c.id === 'daily_capacity') && (
        <div className="bg-emerald-900 rounded-2xl p-6 text-white overflow-hidden relative shadow-xl">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Target className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Autonomía Forrajera Actual</p>
              <h2 className="text-5xl font-black">{forecastedDaysAvailable ?? '—'} <span className="text-2xl opacity-60">días</span></h2>
              <p className="text-emerald-100/70 text-sm mt-2 font-medium max-w-md">
                {forecastedDaysAvailable && forecastedDaysAvailable < 15
                  ? '⚠️ Alerta: Stock de pasto crítico. Considerá mover animales o suplementar.'
                  : 'Tu rodeo tiene suficiente pasto para el corto plazo bajo manejo rotativo.'}
              </p>
              <div className="flex gap-3 mt-4">
                {forecastedDaysAvailable && forecastedDaysAvailable < 15 && (
                  <button 
                    onClick={runFinancialSimulation}
                    disabled={simulating}
                    className="bg-white text-emerald-900 px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50 shadow-lg"
                  >
                    {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                    Simular Escenario Financiero
                  </button>
                )}
                <button 
                  onClick={() => setShowClimateModal(true)}
                  className="bg-emerald-800/40 border border-emerald-700/50 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-emerald-800/60 transition-all"
                >
                  <CloudRain className="w-4 h-4" />
                  Proyectar Lluvia
                </button>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-emerald-800/50 rounded-xl p-3 border border-emerald-700/50">
                <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">Demanda diaria</p>
                <p className="text-xl font-black">{Math.round(dailyDemandKg).toLocaleString()} <span className="text-xs opacity-50">kg MS</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Dashboard de Control</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Motor Predictivo · {season.name} · Descanso óptimo: {season.restDaysMin}–{season.restDaysMax} días
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Holistic Score */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Score holístico</h3>
            <p className="text-xs text-gray-400 mt-0.5">Índice compuesto del manejo ganadero · {season.icon} {season.name}</p>
          </div>
          <div className="text-right">
            <span className={`text-4xl font-black ${score.color}`}>{score.value}</span>
            <span className="text-lg text-gray-300 font-black">/100</span>
            <p className={`text-xs font-black uppercase tracking-widest mt-0.5 ${score.color}`}>{score.label}</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              score.value >= 75 ? 'bg-green-500' : score.value >= 50 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${score.value}%` }}
          />
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Potreros', value: paddocks.length, color: 'text-gray-800' },
            { label: 'En descanso', value: restingPaddocks.length, color: 'text-green-700' },
            { label: 'Animales', value: totalAnimals, color: 'text-gray-800' },
            { label: 'EV totales', value: totalEV.toFixed(1), color: 'text-blue-700' },
          ].map(s => (
            <div key={s.label} className="text-center bg-gray-50 rounded-xl py-2">
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendation — minimal white card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-black text-gray-900 mb-1">Recomendación del día</h3>
            {aiRecommendation ? (
              <p className="text-sm text-gray-600 leading-relaxed">{aiRecommendation}</p>
            ) : (
              <p className="text-sm text-gray-500 leading-relaxed">
                {score.value >= 75
                  ? `Tu campo está en buenas condiciones para ${season.name.toLowerCase()}. Con ${restingPaddocks.length} potreros en descanso, respetá el período de ${season.restDaysMin}–${season.restDaysMax} días.`
                  : score.value >= 50
                  ? `Hay oportunidades de mejora. Priorizá aumentar los períodos de descanso (mínimo ${season.restDaysMin} días en ${season.name.toLowerCase()}).`
                  : `Tu sistema necesita atención urgente. Reducir la carga o aumentar subdivisiones puede mejorar rápidamente.`}
              </p>
            )}
          </div>
          <button
            onClick={generateAiInsight}
            disabled={loadingAi}
            className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl transition-colors"
          >
            {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loadingAi ? 'Analizando...' : 'Generar con IA'}
          </button>
        </div>
      </div>

      {/* Insight cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <InsightCardComponent key={card.id} card={card} />
        ))}
      </div>

      {/* Paddock capacity table */}
      {paddockCapacities.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Capacidad por potrero</h3>
            <span className="text-[9px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">
              Basado en MS disponible
            </span>
          </div>
          <div className="space-y-2">
            {paddockCapacities.slice(0, 5).map((p, i) => {
              const pct = Math.min(100, (p.evDays / (paddockCapacities[0]?.evDays || 1)) * 100)
              const barColor = p.current_status === 'GRAZING'
                ? 'bg-orange-400' : p.evDays > 7 ? 'bg-green-500' : 'bg-yellow-400'
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-bold text-gray-700 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.current_status === 'GRAZING' && (
                          <span className="text-[8px] font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">En pastoreo</span>
                        )}
                        <span className="text-xs font-black text-gray-800">{p.evDays} días</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[8px] text-gray-400 mt-0.5">
                      {p.dry_matter_kg_ha?.toLocaleString()} kg MS/ha · {p.area_ha?.toFixed(1)} ha · {Math.round(p.totalMs).toLocaleString()} kg aprovechables
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Research section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Marco conceptual</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              title: 'Manejo holístico (Savory)',
              desc: 'El pastoreo planificado imita a los herbívoros salvajes. Alta presión de pastoreo por corto tiempo + descanso prolongado regenera el suelo, restaura el ciclo hídrico y aumenta la captura de carbono.',
              tag: 'Regenerativo', tagColor: 'text-green-700 bg-green-50',
            },
            {
              title: 'Carga animal & EV',
              desc: 'El Equivalente Vaca (EV) permite comparar distintas categorías. Un animal de 450 kg a mantenimiento = 1 EV. Vacas en lactancia = 1.5 EV. Terneros = 0.35 EV. La carga en EV/ha es el dato clave del sistema.',
              tag: 'Ganadería', tagColor: 'text-blue-700 bg-blue-50',
            },
            {
              title: 'IA para biomasa & condición',
              desc: 'El análisis de imagen con Gemini Vision permite estimar kg MS/ha en campo con solo una foto del pastizal, y evaluar la condición corporal (CC) de los animales a partir de fotos del costillar.',
              tag: 'Datos & IA', tagColor: 'text-purple-700 bg-purple-50',
            },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-xl">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
              <h4 className="text-sm font-black text-gray-800 mt-2 mb-1.5">{item.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showFinancialModal && financialResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100"
            >
              <div className="bg-emerald-900 p-6 text-white relative">
                <button onClick={() => setShowFinancialModal(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-emerald-500/20 p-2 rounded-lg">
                    <Scale className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight">Simulación Financiera</h3>
                </div>
                <p className="text-emerald-100/70 text-sm font-medium">Escenario: Venta Estratégica vs Suplementación</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-700 uppercase mb-1">Capital Liberado</p>
                    <p className="text-2xl font-black text-emerald-900">${financialResult.capital_released_by_sale.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">Venta {financialResult.sell_pct * 100}% {financialResult.sell_category}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-700 uppercase mb-1">Ahorro Mensual</p>
                    <p className="text-2xl font-black text-blue-900">${financialResult.supplement_cost_monthly.toLocaleString()}</p>
                    <p className="text-[10px] text-blue-600 font-bold mt-1">Gasto evitado en maíz</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Leaf className="w-12 h-12 text-green-600" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Impacto en Autonomía</p>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400">Actual</p>
                      <p className="text-xl font-black text-gray-500">{financialResult.autonomy_days} días</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                    <div className="text-center">
                      <p className="text-xs font-bold text-emerald-600">Proyectado</p>
                      <p className="text-xl font-black text-emerald-700">{financialResult.autonomy_days + financialResult.days_gained_by_sale} días</p>
                    </div>
                    <div className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full">
                      +{financialResult.days_gained_by_sale} DÍAS
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border-l-4 border-emerald-500">
                  <div className="flex gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-bold text-emerald-900 leading-relaxed">
                      {financialResult.recommendation}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => window.location.href = '/dashboard/grazing'}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-200"
                  >
                    Planificar Movimiento
                  </button>
                  <button 
                    onClick={() => setShowFinancialModal(false)}
                    className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showClimateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="bg-blue-900 p-6 text-white relative">
                <button onClick={() => setShowClimateModal(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <CloudRain className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-black">Proyección Climática</h3>
                </div>
                <p className="text-blue-100/70 text-sm">Calculá el rebrote basado en lluvia esperada</p>
              </div>

              <div className="p-8 space-y-6">
                {!climateResult ? (
                  <>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-gray-700 uppercase tracking-widest">¿Cuántos mm esperás?</label>
                      <input 
                        type="range" 
                        min="5" max="150" step="5"
                        value={rainInput}
                        onChange={(e) => setRainInput(parseInt(e.target.value))}
                        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-4xl font-black text-blue-900">
                        <span>{rainInput}</span>
                        <span className="text-xl opacity-30 self-end mb-1">mm</span>
                      </div>
                    </div>

                    <button 
                      onClick={runClimateSimulation}
                      disabled={simulating}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                      {simulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Proyectar Rebrote
                    </button>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex justify-around items-center py-4">
                      <div className="text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Crecimiento Extra</p>
                        <p className="text-3xl font-black text-blue-600">+{climateResult.projected_rebrote_kg_ha} <span className="text-xs">kg/ha</span></p>
                      </div>
                      <div className="w-px h-12 bg-gray-100" />
                      <div className="text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Autonomía Ganada</p>
                        <p className="text-3xl font-black text-emerald-600">+{climateResult.new_autonomy_days} <span className="text-xs">días</span></p>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 text-sm font-bold text-blue-900 flex gap-3">
                      <Info className="w-5 h-5 shrink-0" />
                      {climateResult.message}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setClimateResult(null)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black py-4 rounded-2xl transition-all"
                      >
                        Volver a simular
                      </button>
                      <button 
                        onClick={() => setShowClimateModal(false)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all"
                      >
                        Aceptar
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────────
function InsightCardComponent({ card }: { card: InsightCard }) {
  const [expanded, setExpanded] = useState(false)

  const trendIcon = {
    up:      <TrendingUp className="w-4 h-4 text-green-500" />,
    down:    <TrendingDown className="w-4 h-4 text-red-500" />,
    neutral: <Minus className="w-4 h-4 text-gray-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    ok:      <CheckCircle className="w-4 h-4 text-green-500" />,
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
          {card.icon}
        </div>
        <div className="flex items-center gap-1.5">
          {card.badge && (
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${card.badgeColor}`}>
              {card.badge}
            </span>
          )}
          {card.trend && trendIcon[card.trend]}
        </div>
      </div>
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{card.title}</p>
      <p className="text-xl font-black text-gray-900 leading-tight">{card.value}</p>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.subtitle}</p>

      {expanded && card.detail && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <p className="text-xs text-gray-500 leading-relaxed">{card.detail}</p>
          {card.recommendation && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-700 leading-relaxed">{card.recommendation}</p>
            </div>
          )}
          {card.id === 'paddock_capacity' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // We'll use the ID from the card's custom data or similar
                // For now, let's assume the ID is passed via a custom property if we had one
                // Since InsightCard doesn't have it, let's just use a placeholder or better: 
                // fix the mapping to include it if possible.
                window.location.href = `/dashboard/grazing`;
              }}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Planificar movimiento
              <Zap className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
