'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  TrendingUp, TrendingDown, Minus, Leaf, AlertTriangle,
  CheckCircle, Info, Sparkles, BarChart3, Target, Camera,
  Loader2, RefreshCw, Sun, Snowflake, Scale, CalendarDays,
  Zap
} from 'lucide-react'

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

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
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

  // 2. Weather stress
  if (weather?.forecast_mm_15d !== undefined && weather.forecast_mm_15d < 20) score -= 15

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
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
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

    const [paddocksRes, plansRes, herdsRes, eventsRes, notesRes] = await Promise.all([
      apiFetch('/api/paddocks'),
      apiFetch('/api/grazing-plans'),
      apiFetch('/api/herds'),
      apiFetch('/api/farm-events'),
      apiFetch('/api/field-notes'),
    ])

    setPaddocks(paddocksRes.ok ? (await paddocksRes.json()).paddocks ?? [] : [])
    setPlans(plansRes.ok ? (await plansRes.json()).plans ?? [] : [])
    setHerds(herdsRes.ok ? (await herdsRes.json()).herds ?? [] : [])
    setFarmEvents(eventsRes.ok ? (await eventsRes.json()).events ?? [] : [])
    setFieldNotes(notesRes.ok ? (await notesRes.json()).notes ?? [] : [])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { loadData() }, [user])

  // ── Derived metrics ────────────────────────────────────────────────────────
  const totalHectares = useMemo(() => paddocks.reduce((s, p) => s + (p.area_ha || 0), 0), [paddocks])
  const totalAnimals = useMemo(() => herds.reduce((s, h) => s + (h.animal_count || 0), 0), [herds])
  const totalEV = useMemo(() => herds.reduce((s, h) => {
    const avgWeight = h.avg_weight_kg || 450
    return s + (h.animal_count || 0) * (avgWeight / 450)
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
    const withMs = paddocks.filter(p => p.dry_matter_kg_ha > 0)
    if (withMs.length === 0) return null
    return Math.round(withMs.reduce((s, p) => s + p.dry_matter_kg_ha, 0) / withMs.length)
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
  const upcoming30 = farmEvents.filter(e => e.event_date >= today && daysBetween(today, e.event_date) <= 30)

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
      id: 'stocking',
      title: 'Carga animal',
      value: totalHectares > 0 ? `${stockingRate.toFixed(2)} EV/ha` : '—',
      subtitle: `${totalAnimals} animales · ${totalEV.toFixed(1)} EV totales en ${totalHectares.toFixed(0)} ha`,
      trend: stockingRate > 1.8 ? 'warning' : stockingRate > 0.3 ? 'ok' : 'neutral',
      icon: <Scale className="w-5 h-5" />,
      color: 'bg-blue-50',
      badge: stockingOptimal ? 'Óptimo' : stockingRate > 1.5 ? 'Alta' : stockingRate > 0 ? 'Baja' : undefined,
      badgeColor: stockingOptimal ? 'bg-green-100 text-green-700' : stockingRate > 1.5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
      detail: 'La carga animal óptima en pastoreo rotativo intensivo es 0.8–1.5 EV/ha. Cargas superiores sin rotación adecuada generan erosión y pérdida de biodiversidad forrajera.',
      recommendation: stockingRate > 1.8
        ? '🔴 Carga excesiva. Considerá reducir el rodeo o aumentar la superficie grazable.'
        : stockingOptimal ? '✓ Carga dentro del rango óptimo holístico. Mantené el seguimiento.'
        : 'Registrá el peso promedio de tus animales para un cálculo más preciso de EV.',
    },
    {
      id: 'biomass',
      title: 'Materia seca · MS/ha',
      value: bestMs ? `${bestMs.toLocaleString()} kg MS/ha` : 'Sin datos',
      subtitle: lastBiomassNote
        ? `IA Gemini · ${new Date(lastBiomassNote.created_at).toLocaleDateString('es')}`
        : avgPaddockMs ? `Promedio ${paddocks.filter(p => p.dry_matter_kg_ha > 0).length} potreros`
        : 'Usá análisis de fotos IA en "Mi Campo" para registrar',
      trend: bestMs ? (bestMs > 1500 ? 'up' : bestMs > 800 ? 'neutral' : 'down') : 'neutral',
      icon: <Leaf className="w-5 h-5" />,
      color: 'bg-green-50',
      badge: lastBiomassNote ? '📷 IA' : avgPaddockMs ? 'NDVI' : undefined,
      badgeColor: 'bg-violet-100 text-violet-700',
      detail: 'El umbral mínimo de remanente post-pastoreo para no erosionar el suelo es 800–1000 kg MS/ha. Entrar antes puede comprometer la recuperación del pasto y la cobertura del suelo.',
      recommendation: bestMs && bestMs < 1000
        ? '⚠️ Biomasa baja. Extendé el descanso de este potrero y evaluá suplementación.'
        : bestMs ? '✓ Nivel de biomasa adecuado para planificar el próximo ingreso.'
        : '📷 Fotografiá tus pasturas con la Bitácora o desde "Mi Campo" para análisis IA automático.',
    },
    {
      id: 'rest_season',
      title: `Descanso · ${season.name}`,
      value: `${season.restDaysMin}–${season.restDaysMax} días`,
      subtitle: `Período óptimo de descanso en ${season.name.toLowerCase()} para zona templada`,
      trend: restingPaddocks.length >= 2 ? 'ok' : 'warning',
      icon: season.name === 'Invierno' ? <Snowflake className="w-5 h-5" /> : <Sun className="w-5 h-5" />,
      color: season.name === 'Invierno' ? 'bg-sky-50' : season.name === 'Verano' ? 'bg-amber-50' : 'bg-green-50',
      badge: `${season.icon} ${season.name}`,
      badgeColor: 'bg-emerald-100 text-emerald-700',
      detail: `En ${season.name.toLowerCase()}, el pasto ${season.name === 'Invierno' ? 'crece muy lento' : season.name === 'Verano' ? 'crece rápido pero puede estresarse por calor' : 'crece activamente'}. El factor de crecimiento estimado es ×${season.growthFactor}. Respetar los días de descanso mínimos es crítico para no erosionar el potrero.`,
      recommendation: restingPaddocks.length < 2
        ? `⚠️ Con pocos potreros en descanso, es difícil cumplir los ${season.restDaysMin} días mínimos de ${season.name.toLowerCase()}. Considerá aumentar subdivisiones.`
        : `✓ ${restingPaddocks.length} potreros en descanso. Verificá que ninguno tenga menos de ${season.restDaysMin} días desde el último pastoreo.`,
    },
    {
      id: 'rotation',
      title: 'Calidad de rotación',
      value: paddocks.length > 0 ? `${Math.round(rotationRatio * 100)}% en descanso` : '—',
      subtitle: `${restingPaddocks.length} de ${paddocks.length} potreros · ${daysSinceLastMove ?? '—'} días desde último movimiento`,
      trend: rotationRatio > 0.65 ? 'ok' : rotationRatio > 0.4 ? 'neutral' : 'warning',
      icon: <RefreshCw className="w-5 h-5" />,
      color: 'bg-purple-50',
      detail: 'En pastoreo holístico bien manejado, entre el 65–80% de los potreros deberían estar en descanso simultáneamente. Esto garantiza que el pasto complete su ciclo reproductivo antes del siguiente pastoreo.',
      recommendation: rotationRatio > 0.65
        ? '✓ Excelente distribución de descanso. El ciclo de rotación está bien equilibrado.'
        : rotationRatio > 0.4
        ? 'Hay oportunidad de mejorar. Intentá mover el rebaño más frecuentemente para aumentar el porcentaje en descanso.'
        : '🔴 Baja proporción en descanso. El sistema puede estar subpastoreando o sobreconcentrando la presión de pastoreo.',
    },
    {
      id: 'daily_capacity',
      title: 'Autonomía forrajera',
      value: forecastedDaysAvailable ? `${forecastedDaysAvailable} días` : '—',
      subtitle: dailyDemandKg > 0
        ? `Demanda diaria: ${Math.round(dailyDemandKg).toLocaleString()} kg MS/día · ${totalEV.toFixed(0)} EV`
        : 'Configurá tus rebaños para calcular la demanda',
      trend: forecastedDaysAvailable
        ? (forecastedDaysAvailable > 30 ? 'ok' : forecastedDaysAvailable > 14 ? 'neutral' : 'warning')
        : 'neutral',
      icon: <Target className="w-5 h-5" />,
      color: 'bg-orange-50',
      badge: forecastedDaysAvailable && forecastedDaysAvailable < 15 ? '⚠️ Crítico' : undefined,
      badgeColor: 'bg-red-100 text-red-700',
      detail: `Con ${totalEV.toFixed(1)} EV y una exigencia de ~11 kg MS/EV/día, tu rodeo consume ${Math.round(dailyDemandKg).toLocaleString()} kg MS por día. El balance usa el 60% de la MS disponible como factor de cosecha eficiente (recomendado en pastoreo holístico).`,
      recommendation: forecastedDaysAvailable && forecastedDaysAvailable < 15
        ? '🔴 Autonomía crítica. Evaluá suplementación inmediata o movimiento urgente del rebaño.'
        : forecastedDaysAvailable
        ? '✓ Autonomía razonable. Monitoreá semanalmente y ajustá el ritmo de rotación.'
        : 'Registrá MS en tus potreros con análisis de fotos IA para calcular la autonomía forrajera.',
    },
    {
      id: 'animal_condition',
      title: 'Condición corporal',
      value: avgConditionScore
        ? `${avgConditionScore}/5 CC`
        : 'Sin análisis IA',
      subtitle: lastConditionNote
        ? `Análisis Gemini · ${new Date(lastConditionNote.created_at).toLocaleDateString('es')} · ${totalAnimals} animales`
        : 'Fotografiá animales en la Bitácora para análisis IA de condición corporal',
      trend: avgConditionScore
        ? (avgConditionScore >= 3.5 ? 'ok' : avgConditionScore >= 2.5 ? 'neutral' : 'down')
        : 'neutral',
      icon: <Camera className="w-5 h-5" />,
      color: 'bg-violet-50',
      badge: avgConditionScore ? '📷 IA Gemini' : undefined,
      badgeColor: 'bg-violet-100 text-violet-700',
      detail: 'La condición corporal (CC) en escala 1–5 es el indicador más importante de la nutrición animal. CC < 2.5 indica subnutrición severa. CC 3–3.5 es el rango objetivo al servicio. El análisis de imagen IA puede estimarla a partir de fotografías del costillar.',
      recommendation: avgConditionScore && avgConditionScore < 2.5
        ? '🔴 Condición corporal baja. Evaluá suplementación proteica o energética urgente.'
        : avgConditionScore && avgConditionScore >= 3
        ? '✓ Condición corporal buena. Seguí monitoreando especialmente en períodos de servicio y preparto.'
        : '📷 Fotografiá tus animales desde la Bitácora para obtener estimación de CC por IA Gemini.',
    },
    {
      id: 'paddock_capacity',
      title: 'Mejor potrero disponible',
      value: paddockCapacities[0] ? `${paddockCapacities[0].evDays} días` : '—',
      subtitle: paddockCapacities[0]
        ? `${paddockCapacities[0].name} · ${paddockCapacities[0].dry_matter_kg_ha?.toLocaleString()} kg MS/ha · ${paddockCapacities[0].area_ha?.toFixed(1)} ha`
        : 'Con datos de MS en tus potreros verás cuál listo para pastoreo',
      trend: paddockCapacities[0]?.evDays > 7 ? 'ok' : paddockCapacities[0] ? 'neutral' : 'neutral',
      icon: <Zap className="w-5 h-5" />,
      color: 'bg-lime-50',
      badge: paddockCapacities[0] ? '🔝 Más días' : undefined,
      badgeColor: 'bg-lime-100 text-lime-700',
      detail: `Los días de autonomía por potrero se calculan como (MS disponible × área × 60%) / demanda diaria. Esto indica cuántos días el rebaño puede pastorear ese potrero a ${Math.round(dailyDemandKg)} kg MS/día de consumo.`,
      recommendation: paddockCapacities[0]
        ? `El potrero "${paddockCapacities[0].name}" tiene la mayor oferta disponible (${Math.round(paddockCapacities[0].totalMs).toLocaleString()} kg MS totales aprovechables).`
        : 'Registrá análisis de materia seca en tus potreros para ver cuáles tienen mayor capacidad.',
    },
    {
      id: 'events',
      title: 'Próximos eventos',
      value: upcoming30.length > 0 ? `${upcoming30.length} evento${upcoming30.length > 1 ? 's' : ''}` : 'Sin eventos',
      subtitle: upcoming30.length > 0
        ? `Próximo: ${upcoming30[0] ? new Date(upcoming30[0].event_date).toLocaleDateString('es') + ' · ' + upcoming30[0].title : '—'}`
        : 'Agendá servicio, vacunación y otras fechas críticas',
      trend: upcoming30.length > 0 ? 'neutral' : 'neutral',
      icon: <CalendarDays className="w-5 h-5" />,
      color: 'bg-yellow-50',
      detail: 'Los eventos de servicio (toros al rodeo), parición, vacunación y destete impactan directamente en la demanda forrajera y la planificación del pastoreo. Anticiparlos permite ajustar la carga animal.',
      recommendation: upcoming30.length > 0
        ? 'Verificá que el balance forrajero contemple los cambios de carga animal asociados a estos eventos.'
        : 'Sin eventos próximos. Usá la Agenda para planificar servicio, vacunaciones y parición.',
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Análisis · {month}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-black text-gray-700">
              {season.icon} {season.name}
            </span>
            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Descanso recomendado: {season.restDaysMin}–{season.restDaysMax} días
            </span>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
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

      {/* AI Recommendation */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-200" />
            <h3 className="text-sm font-black uppercase tracking-widest text-green-100">Recomendación del día</h3>
          </div>
          <button
            onClick={generateAiInsight}
            disabled={loadingAi}
            className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loadingAi ? 'Analizando...' : 'Generar con IA'}
          </button>
        </div>
        {aiRecommendation ? (
          <p className="text-sm leading-relaxed text-green-50">{aiRecommendation}</p>
        ) : (
          <div>
            <p className="text-sm leading-relaxed text-green-100 mb-2">
              {score.value >= 75
                ? `${season.icon} Tu campo está en buenas condiciones para ${season.name.toLowerCase()}. Con ${restingPaddocks.length} potreros en descanso y ${totalAnimals} animales, el período de descanso de ${season.restDaysMin}–${season.restDaysMax} días es clave en esta época.`
                : score.value >= 50
                ? `Hay oportunidades de mejora. Priorizá aumentar los períodos de descanso (mínimo ${season.restDaysMin} días en ${season.name.toLowerCase()}) y registrá análisis de biomasa con IA.`
                : `Tu sistema necesita atención urgente. Reducir la carga animal o aumentar subdivisiones puede mejorar rápidamente la condición del forraje.`}
            </p>
            <p className="text-[10px] text-green-300 italic">Presioná "Generar con IA" para análisis personalizado basado en Gemini.</p>
          </div>
        )}
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

    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────────
function InsightCardComponent({ card }: { card: InsightCard }) {
  const [expanded, setExpanded] = useState(false)

  const trendIcon = {
    up: <TrendingUp className="w-4 h-4 text-green-500" />,
    down: <TrendingDown className="w-4 h-4 text-red-500" />,
    neutral: <Minus className="w-4 h-4 text-gray-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    ok: <CheckCircle className="w-4 h-4 text-green-500" />,
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center text-gray-700`}>
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
        </div>
      )}
    </div>
  )
}
