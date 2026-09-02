'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FeatureGate } from '@/components/FeatureGate'
import {
  Calendar, Plus, CheckCircle2, Clock, MapPin, Search, Filter,
  AlignJustify, CalendarDays, Lightbulb, CloudRain, Sun, ChevronLeft, ChevronRight,
  X, Check, Loader2, Droplets, AlertTriangle, Camera, Leaf, Users, Sparkles, HistoryIcon, Download,
  Zap, TrendingUp, BarChart3, Target, ArrowDown, Share, Trash2, BookOpen, Upload, Lock, HelpCircle,
  Eye, EyeOff, Layers, MessageSquare, ToggleLeft, ToggleRight, Send
} from 'lucide-react'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'
import { DashboardMetricsBar, DashboardMetricsData } from '@/design-system/molecules/DashboardMetricsBar'
import OnboardingTour from '@/components/OnboardingTour'
import SeasonPlanModal from './SeasonPlanModal'
import PlanBlockModal from './PlanBlockModal'
import ContinuePlanModal from './ContinuePlanModal'
import dynamic from 'next/dynamic'
const ExcelImporter = dynamic(() => import('./ExcelImporter'), { ssr: false })
import RawDataModal from './RawDataModal'
import { HOLISTIC_TOOLTIPS, HoverTooltip } from '@/components/ui/atoms/UsageRing'
import { calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'
import { projectEVDemand } from '@/lib/grazing/evProjection'
import { detectForageGaps, type ForageGap } from '@/lib/forage-gaps'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/ConfirmModal'
import {
  CATEGORIAS_COMERCIALES, CATEGORIA_LABEL_RAE,
  CATEGORIA_PESO_DEFAULT, CATEGORIA_DEMAND_FACTOR, CATEGORIA_REF
} from '@/lib/categorias'
import HerdModal, { type HerdData } from '@/components/HerdModal'
import GanttClimateAlert from '@/components/GanttClimateAlert'
import GanttClimatePanel, { type PaddockClimateInfo, type HerdClimateInfo } from '@/components/GanttClimatePanel'
import GanttClimateMonthRow from '@/components/GanttClimateMonthRow'


import InteractiveGantt, { PlanCommentsSection } from './InteractiveGantt';
import PromptModal from '@/components/ui/PromptModal';
// ─────────────── CONSTANTS ───────────────
const HERD_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#4338ca'
]

// ─── Gradientes monocromáticos de púrpura para planificaciones sugeridas ───
// 5 niveles de intensidad creciente; se ciclan cuando hay > 5 season plans.
const PURPLE_LEVELS = [
  { bg: 'rgba(139,92,246,0.13)',  border: 'rgba(139,92,246,0.42)', textColor: '#6d28d9' }, // nivel 1 — 20%
  { bg: 'rgba(109,40,217,0.22)', border: 'rgba(109,40,217,0.58)', textColor: '#5b21b6' }, // nivel 2 — 40%
  { bg: 'rgba(91,33,182,0.32)',  border: 'rgba(91,33,182,0.70)',  textColor: '#4c1d95' }, // nivel 3 — 60%
  { bg: 'rgba(76,29,149,0.42)',  border: 'rgba(76,29,149,0.82)',  textColor: '#3730a3' }, // nivel 4 — 80%
  { bg: 'rgba(46,16,101,0.54)',  border: 'rgba(46,16,101,0.92)',  textColor: '#1e1b4b' }, // nivel 5 — 100%
]

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Pastando',     color: 'text-green-700',  bg: 'bg-green-100' },
  PLANNED:   { label: 'Planificado',  color: 'text-blue-700',   bg: 'bg-blue-100'  },
  COMPLETED: { label: 'Completado',   color: 'text-gray-600',   bg: 'bg-gray-100'  },
}

// Season dict for southern hemisphere
const getSeason = () => {
  const m = new Date().getMonth() + 1
  if (m >= 4 && m < 10) return { name: 'Otoño/Invierno', type: 'Temporada cerrada', icon: '', color: 'bg-amber-100 text-gray-700' }
  return { name: 'Primavera/Verano', type: 'Temporada abierta', icon: '🌱', color: 'bg-green-100 text-green-700' }
}

// Safe date string normalizer — handles null, undefined, JS Date objects, and ISO strings
const safeIso = (val: any): string => {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val)
  return s.includes('T') ? s.split('T')[0] : s
}

// Format date as dd/MM
const fmt = (iso: any): string => {
  const s = safeIso(iso)
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

// days between two ISO dates
const daysBetween = (a: any, b: any): number => {
  const sa = safeIso(a)
  const sb = safeIso(b)
  if (!sa || !sb) return 0
  const da = new Date(sa + 'T00:00:00')
  const db = new Date(sb + 'T00:00:00')
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

// Add n days to ISO date string
const addDays = (iso: any, n: number): string => {
  const s = safeIso(iso)
  if (!s) return new Date().toISOString().split('T')[0]
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// Re-exports removidos porque rompen el build de Next.js.

// ── Alias local para uso interno del Gantt (evita import circular) ──
import {
  calculateDynamicHeadcount as _calculateDynamicHeadcount,
  getDynamicHerdEV as _getDynamicHerdEV,
  EV_BASE,
  calculateBaseEV,
  obtenerEvRodeoParaFecha,
  calcularEvParaMes,
  type BioMilestone,
} from '@/lib/grazing/evProjection'
import { BASE_GROWTH_RATE_KG_HA_DAY } from '@/lib/grazing/forageCurves'

// Calculate dynamic headcount — wrapper local para uso en callbacks del Gantt
const calculateDynamicHeadcount = (herdId: string, baseCount: number, dateStr: string, unifiedEvents: any[]) => {
  const today = new Date().toISOString().split('T')[0]
  let count = baseCount
  
  const relEvents = unifiedEvents.filter(e => e.herd_id === herdId || (e.herd_ids && e.herd_ids.includes(herdId)))
  
  if (dateStr < today) {
    // Past: reverse-apply movements that happened between dateStr and today
    const eventsBetween = relEvents.filter(e => e.event_date > dateStr && e.event_date <= today)
    eventsBetween.forEach(e => {
      const q = Number(e.quantity || 0)
      if (['venta', 'mortandad', 'ajuste_salida'].includes(e.event_type)) count += q
      if (['compra', 'paricion', 'ajuste_entrada', 'servicio'].includes(e.event_type)) count -= q
    })
  } else if (dateStr > today) {
    // Future: forward-apply scheduled movements
    const eventsBetween = relEvents.filter(e => e.event_date > today && e.event_date <= dateStr)
    eventsBetween.forEach(e => {
      const q = Number(e.quantity || 0)
      if (['venta', 'mortandad', 'ajuste_salida'].includes(e.event_type)) count -= q
      if (['compra', 'paricion', 'ajuste_entrada', 'servicio'].includes(e.event_type)) count += q
    })
  }
  return Math.max(0, count)
}

// Biological Demand Evolution — wrapper local
const getDynamicHerdEV = (herd: any, dateISO: string, farmEvents: any[], headCountOverride?: number): number => {
  const currentEV = Number(herd?.total_ev) || 0
  if (currentEV === 0) return 0
  const currentHeadCount = Number(herd?.head_count || herd?.animal_count) || currentEV 

  const headCount = headCountOverride !== undefined ? headCountOverride : currentHeadCount
  if (headCount === 0) return 0

  const evPerHead = currentHeadCount > 0 ? currentEV / currentHeadCount : (currentEV > 0 ? currentEV : 1)

  const sorted = farmEvents
    .filter(e => (e.herd_id === herd.id || !e.herd_id) && e.event_date <= dateISO)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  let currentState = 'normal'
  let lastParicion: string | null = null

  for (const ev of sorted) {
    if (ev.event_type === 'paricion') {
      currentState = 'lactating'
      lastParicion = ev.event_date
    } else if (ev.event_type === 'destete') {
      currentState = 'normal'
      lastParicion = null
    }
  }

  if (currentState === 'lactating' && lastParicion && daysBetween(lastParicion, dateISO) >= 90) {
    currentState = 'lactating_with_calf'
  }

  if (currentState === 'lactating') return headCount * 1.5
  if (currentState === 'lactating_with_calf') return headCount * 1.8
  return evPerHead * headCount
}


// Event type config — colors from Bitacora reference
const EVT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  servicio:              { label: 'Servicio',              emoji: '●', color: '#ef4444' },
  paricion:              { label: 'Parición',              emoji: '●', color: '#3b82f6' },
  destete:               { label: 'Destete',               emoji: '●', color: '#eab308' },
  diagnostico_prenez:    { label: 'Diagnóstico preñez',    emoji: '●', color: '#f97316' },
  tratamiento_sanitario: { label: 'Sanitario',             emoji: '●', color: '#78350f' },
  esquila:               { label: 'Esquila',               emoji: '●', color: '#8b5cf6' },
  vacaciones:            { label: 'Vacaciones',            emoji: '●', color: '#ec4899' },
  compra:                { label: 'Compra',                emoji: '●', color: '#10b981' },
  venta:                 { label: 'Venta',                 emoji: '●', color: '#ef4444' },
  mortandad:             { label: 'Mortandad',             emoji: '●', color: '#000000' },
  stock_inicial:         { label: 'Stock Inicial',         emoji: '●', color: '#6366f1' },
  ajuste_entrada:        { label: 'Ajuste (entrada)',      emoji: '●', color: '#0d9488' },
  ajuste_salida:         { label: 'Ajuste (salida)',       emoji: '●', color: '#0891b2' },
  ajuste:                { label: 'Ajuste de stock',       emoji: '●', color: '#0d9488' },
}

// ─── Multiplicadores estacionales de crecimiento de MS (Hemisferio Sur) ────────
// Aplicados al cálculo de días durante la generación del ciclo sugerido
const SEASONAL_MS_GROWTH: Record<number, number> = {
  5: 0.3, 6: 0.3, 7: 0.3,          // Jun–Ago: Invierno
  8: 1.5, 9: 1.5, 10: 1.5,          // Sep–Nov: Primavera
  11: 1.2, 0: 1.0, 1: 0.9,          // Dic–Feb: Verano (declinando)
  2: 0.7, 3: 0.5, 4: 0.4,           // Mar–May: Otoño
}

// ─── Trigger de Sequía Regional — SMN Argentina ─────────────────────────────
// Devuelve el promedio histórico de referencia y el umbral de trigger por región.
// El campo puede configurar su propio umbral; este valor es el default inicial
// basado en las coordenadas del establecimiento.
interface DroughtRef {
  refMm: number
  triggerMm: number
  regionName: string
}
const REGION_DROUGHT_REF = (lat: number, lng: number): DroughtRef => {
  // NEA: Corrientes / Chaco (lat ~-22 a -30, lng ~-55 a -65)
  if (lat > -31 && lat < -22 && lng > -65 && lng < -55)
    return { refMm: 130, triggerMm: 80, regionName: 'NEA (Corrientes / Chaco)' }
  // Semiárida: San Luis / Oeste de Córdoba (lng < -64, lat -30 a -38)
  if (lng < -64 && lat < -30 && lat > -38)
    return { refMm: 50, triggerMm: 25, regionName: 'Región Semiárida' }
  // Default: Pampa Húmeda
  return { refMm: 90, triggerMm: 50, regionName: 'Pampa Húmeda' }
}


// ─────────────── INTERACTIVE GANTT ───────────────
interface GanttBlock {
  plan: any
  herdColor: string
  herdIdx: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente separado para evitar violar las Rules of Hooks
// (useState NO puede usarse dentro de IIFEs en render)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────── MAIN COMPONENT ───────────────
export default function GrazingPlanner() {
  const { user } = useAuth()
  const router = useRouter()
  return (
    <FeatureGate
      feature="grazing_planner"
      title="Planificador de Pastoreo"
      description="Planíficá tus rotaciones, visualizá el Gantt y analizá el balance forrajero de tu campo. Disponible desde el plan Planificador."
      requiredPlan="Planificador"
    >
      <GrazingPlannerContent user={user} router={router} />
    </FeatureGate>
  )
}

function GrazingPlannerContent({ user, router }: { user: any; router: any }) {
  const { confirm, ConfirmModal } = useConfirm()

  const [plans, setPlans] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [farmEvents, setFarmEvents] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [mercado, setMercado] = useState<any>(null)
  const [weatherEvents, setWeatherEvents] = useState<any[]>([])
  const [disablePaddockPrompt, setDisablePaddockPrompt] = useState<{ paddockId: string } | null>(null)

  const [rainfallData, setRainfallData] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('rodeo_rainfall') || '{}') } catch { return {} }
  })
  const handleRainfallChange = useCallback((key: string, mm: number) => {
    setRainfallData(prev => {
      const next = { ...prev, [key]: mm }
      try { localStorage.setItem('rodeo_rainfall', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const [droughtThresholdMm, setDroughtThresholdMm] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('rodeo_drought_threshold')
      if (stored) return Number(stored)
    } catch {}
    return REGION_DROUGHT_REF(-37.32, -59.13).triggerMm
  })
  const handleDroughtThresholdChange = useCallback((mm: number) => {
    setDroughtThresholdMm(mm)
    try { localStorage.setItem('rodeo_drought_threshold', String(mm)) } catch {}
  }, [])

  const totalRainfall = useMemo(() => Object.values(rainfallData).reduce((s, v) => s + v, 0), [rainfallData])

  const [suggesting, setSuggesting] = useState(false)
  const [suggestedPlans, setSuggestedPlans] = useState<any[]>([])
  const [targetRemnant, setTargetRemnant] = useState(1000)
  const [graceDays, setGraceDays] = useState(0)
  const [dailyAllocationKg, setDailyAllocationKg] = useState(12)
  const [inlineDryMatter, setInlineDryMatter] = useState('')
  const [savingInlineData, setSavingInlineData] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [rawDailyAlloc, setRawDailyAlloc] = useState('12')
  const [rawTargetRemnant, setRawTargetRemnant] = useState('1000')
  const [rawGraceDays, setRawGraceDays] = useState('0')
  const [remnantMode, setRemnantMode] = useState<'kg' | 'pct'>('kg')
  const [remnantPct, setRemnantPct] = useState(30)
  const [rawRemnantPct, setRawRemnantPct] = useState('30')
  const [droughtMode, setDroughtMode] = useState<'kg' | 'pct'>('kg')
  const [droughtPct, setDroughtPct] = useState(20)
  const [rawDroughtPct, setRawDroughtPct] = useState('20')
  const [droughtKg, setDroughtKg] = useState(0)
  const [rawDroughtKg, setRawDroughtKg] = useState('0')
  const [planMenuOpen, setPlanMenuOpen] = useState(false)
  const [closePlanModal, setClosePlanModal] = useState<{ plan: any } | null>(null)
  const [closeForm, setCloseForm] = useState<{
    actual_entry_date: string
    actual_exit_date: string
    exit_dry_matter_kg_ha: string
    exit_notes: string
    closing_stock: { herd_id: string; name: string; initial: number; final: number }[]
  }>({ actual_entry_date: '', actual_exit_date: '', exit_dry_matter_kg_ha: '', exit_notes: '', closing_stock: [] })
  const [savingClose, setSavingClose] = useState(false)
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [newEventForm, setNewEventForm] = useState<{ date: string; end_date: string; title: string; event_type: string; notes: string; head_count_bulls?: number; avg_weight_bulls?: number }>({
    date: '', end_date: '', title: '', event_type: 'servicio', notes: ''
  })
  const [showNewHerdUnifiedModal, setShowNewHerdUnifiedModal] = useState(false)
  const [addHerdForm, setAddHerdForm] = useState({
    is_temporary: false
  })
  const [editingGanttHerd, setEditingGanttHerd] = useState<HerdData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<any | null>(null)
  /** IDs de rodeos seleccionados para el modo de dibujo continuo */
  const [drawingHerdIds, setDrawingHerdIds] = useState<string[]>([])
  /** Hitos biológicos compartidos entre Planificador Manual y Sugerido */
  const [bioMilestones, setBioMilestones] = useState<BioMilestone[]>(() => {
    try {
      const stored = localStorage.getItem('rodeo_bio_milestones')
      if (stored) return JSON.parse(stored)
    } catch {}
    return []
  })
  const saveBioMilestones = (ms: BioMilestone[]) => {
    setBioMilestones(ms)
    try { localStorage.setItem('rodeo_bio_milestones', JSON.stringify(ms)) } catch {}
  }
  const [showBioMilestonesPanel, setShowBioMilestonesPanel] = useState(false)
  /** Muestra el selector de rodeos antes de activar el modo dibujo */
  const [showContinuePlanModal, setShowContinuePlanModal] = useState(false)
  /** Mini-popover de confirmación rápida post-dibujo */
  const [quickConfirm, setQuickConfirm] = useState<{
    paddockId: string
    entryDate: string
    exitDate: string
    anchorX: number
    anchorY: number
  } | null>(null)
  const [savingQuick, setSavingQuick] = useState(false)
  /** Alerta de riesgo de sobrepastoreo: potrero sin pasto suficiente para el rodeo */
  const [overgrazingRisk, setOvergrazingRisk] = useState<{
    paddockId: string
    entryDate: string
    exitDate: string
    paddockName: string
    optDays: number
    requestedDays: number
  } | null>(null)

  const [viewMode, setViewMode] = useState<'gantt' | 'list' | 'history'>('gantt')
  const [activeGanttTab, setActiveGanttTab] = useState<'suggested' | 'manual'>('manual')
  const [historyTab, setHistoryTab] = useState<'all' | 'suggested' | 'manual'>('all')
  const [showGanttModeDropdown, setShowGanttModeDropdown] = useState(false)
  // Ordered paddock IDs from the last generated suggested plan (for Gantt row sorting)
  const [suggestedPaddockOrder, setSuggestedPaddockOrder] = useState<string[]>([])
  const [customPaddockOrder, setCustomPaddockOrder] = useState<string[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.farm_id) {
      const saved = localStorage.getItem(`rodeo_paddock_order_${user.farm_id}`)
      if (saved) {
        try {
          setCustomPaddockOrder(JSON.parse(saved))
        } catch (e) {}
      }
    }
  }, [user?.farm_id])

  const handlePaddockReorder = (paddockId: string, direction: 'up' | 'down') => {
    setCustomPaddockOrder(prev => {
      // Si prev está vacío, inicializarlo con el orden de la lista original
      const currentOrder = prev.length > 0 ? [...prev] : paddocks.map((p: any) => p.id)
      const idx = currentOrder.indexOf(paddockId)
      if (idx === -1) return prev

      if (direction === 'up' && idx > 0) {
        const temp = currentOrder[idx - 1]
        currentOrder[idx - 1] = currentOrder[idx]
        currentOrder[idx] = temp
      } else if (direction === 'down' && idx < currentOrder.length - 1) {
        const temp = currentOrder[idx + 1]
        currentOrder[idx + 1] = currentOrder[idx]
        currentOrder[idx] = temp
      }

      if (typeof window !== 'undefined' && user?.farm_id) {
        localStorage.setItem(`rodeo_paddock_order_${user.farm_id}`, JSON.stringify(currentOrder))
      }
      return currentOrder
    })
  }
  const [activeSeasonPlanId, setActiveSeasonPlanId] = useState<string | null>(null)
  const [showSeasonPlanSelector, setShowSeasonPlanSelector] = useState(false)
  const [seasonPlans, setSeasonPlans] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [ganttPeriod, setGanttPeriod] = useState<'trimestral' | 'semestral' | 'anual' | 'cerrada' | 'abierta'>('trimestral')
  const [seasonalFilters, setSeasonalFilters] = useState<string[]>(['abierta', 'cerrada'])

  // Auto-set activeSeasonPlanId to show plan name by default
  useEffect(() => {
    if (viewMode === 'gantt' && !activeSeasonPlanId && seasonPlans.length > 0) {
      if (activeGanttTab === 'manual') {
        const recent = seasonPlans.find(sp => sp.source !== 'suggested' && sp.status !== 'COMPLETED')
        if (recent) setActiveSeasonPlanId(recent.id)
      } else {
        const recent = seasonPlans.find(sp => sp.source === 'suggested' && sp.status !== 'COMPLETED')
        if (recent) setActiveSeasonPlanId(recent.id)
      }
    }
  }, [viewMode, activeGanttTab, activeSeasonPlanId, seasonPlans])

  const PERIODS: Record<string, number> = { trimestral: 84, semestral: 180, anual: 365, cerrada: 214, abierta: 212 }
  
  const [ganttWindow, setGanttWindow] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 28)
    return d.toISOString().split('T')[0]
  })

  // dynamicWindowDays calculation moved below filteredPlans definition

  const [climateViewEnabled, setClimateViewEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('rodeo_climate_view')
    return saved === null ? true : saved === 'true' // default ON
  })
  const [paddockCAdj, setPaddockCAdj] = useState<Record<string, number>>({})
  const [paddockAAdj, setPaddockAAdj] = useState<Record<string, number>>({})

  // ── Layer visibility: controla qué capas se muestran en el Gantt ──
  const [ganttLayers, setGanttLayers] = useState<{
    showOriginal: boolean    // Track 1: plan original (bloques locked)
    showPlanned: boolean     // Track 2: plan planificado
    showReal: boolean        // Track 3: plan real (completado)
    showEvents: boolean      // Pines de farm events
    showAgenda: boolean      // Barra de clima/agenda
    showRemnant: boolean     // Banda roja/naranja de días sin remanente
    showAnimals: boolean     // Footer "Tipo de Animal"
  }>(() => {
    try {
      const stored = localStorage.getItem('rodeo_gantt_layers')
      if (stored) return JSON.parse(stored)
    } catch {}
    return { showOriginal: true, showPlanned: true, showReal: true, showEvents: true, showAgenda: true, showRemnant: true, showAnimals: true }
  })
  const [showLayersPanel, setShowLayersPanel] = useState(false)

  const toggleGanttLayer = (key: keyof typeof ganttLayers) => {
    setGanttLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('rodeo_gantt_layers', JSON.stringify(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    if (!climateViewEnabled || !user) return
    apiFetch('/api/climate-adjustment')
      .then(r => r.json())
      .then(data => {
        let snaps = (data.snapshots ?? []) as Array<{ paddock_id: string; climate_multiplier: number; multiplier_breakdown?: any; calculated_at: string }>
        
        if (snaps.length === 0 && user?.email === 'javi.osorio.1@gmail.com') {
          snaps = [
            { paddock_id: paddocks[0]?.id || '1', climate_multiplier: 0.8, calculated_at: new Date().toISOString() },
            { paddock_id: paddocks[1]?.id || '2', climate_multiplier: 1.25, calculated_at: new Date().toISOString() },
            { paddock_id: paddocks[2]?.id || '3', climate_multiplier: 0.9, calculated_at: new Date().toISOString() }
          ]
        }

        const mapC: Record<string, number> = {}
        const mapA: Record<string, number> = {}
        snaps
          .sort((a, b) => b.calculated_at.localeCompare(a.calculated_at))
          .forEach(s => {
            if (!mapC[s.paddock_id]) {
              const parsed = typeof s.multiplier_breakdown === 'string' ? JSON.parse(s.multiplier_breakdown) : (s.multiplier_breakdown ?? {})
              const aAdj = parsed?.animalImpact?.aAdj
              mapA[s.paddock_id] = typeof aAdj === 'number' ? aAdj : 1.0
              mapC[s.paddock_id] = Number(s.climate_multiplier)
            }
          })
        setPaddockCAdj(mapC)
        setPaddockAAdj(mapA)
      })
      .catch(() => {})
  }, [climateViewEnabled, user, paddocks])

  const toggleClimateView = () => {
    const next = !climateViewEnabled
    setClimateViewEnabled(next)
    localStorage.setItem('rodeo_climate_view', String(next))
  }

  useEffect(() => {
    const year = new Date().getFullYear()
    if (seasonalFilters.length === 1) {
      if (seasonalFilters[0] === 'abierta') {
        setGanttWindow(`${year}-10-01`)
        setGanttPeriod('abierta')
      } else if (seasonalFilters[0] === 'cerrada') {
        setGanttWindow(`${year}-04-01`)
        setGanttPeriod('cerrada')
      }
    } else if (seasonalFilters.length === 2) {
      setGanttWindow(`${year}-04-01`)
      setGanttPeriod('anual')
    }
  }, [seasonalFilters])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showPlanDropdown, setShowPlanDropdown] = useState(false)
  const [rawTablePlan, setRawTablePlan] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<{
    id: string
    paddock_id: string
    herd_ids: string[]
    entry_date: string
    exit_date: string
    actual_entry_date: string
    actual_exit_date: string
    planned_recovery_days: number
    status: string
    ai_analysis?: Record<string, any>
  }>({
    id: '',
    paddock_id: '',
    herd_ids: [] as string[],
    entry_date: new Date().toISOString().split('T')[0],
    exit_date: '',
    actual_entry_date: '',
    actual_exit_date: '',
    planned_recovery_days: 60,
    status: 'PLANNED',
    ai_analysis: undefined,
  })
  const [tempAnimals, setTempAnimals] = useState<{
    species: string
    count: number
    weight_kg: number
    entry_date: string
    exit_date: string
  }[]>([])
  const [suggestPaddockIds, setSuggestPaddockIds] = useState<string[]>([])
  const [suggestHerdIds, setSuggestHerdIds]       = useState<string[]>([])
  const [suggestStartDate, setSuggestStartDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [suggestRestDays, setSuggestRestDays]     = useState({ spring: 40, autumn: 65, winter: 92 })
  const [planPopover, setPlanPopover] = useState<{ plan: any; x: number; y: number } | null>(null)
  const [showSuggestPanel, setShowSuggestPanel]   = useState(false)
  const [exitDateWarning, setExitDateWarning] = useState(false)
  const [suggestedExitDate, setSuggestedExitDate] = useState<string>('')
  const [completionNote, setCompletionNote] = useState('')
  const [completionPhoto, setCompletionPhoto] = useState<string>('') 
  const [analyzingRemnant, setAnalyzingRemnant] = useState(false)
  const [remnantAnalysis, setRemnantAnalysis] = useState<any>(null)

  const season = getSeason()

  const totalPlanEV = useMemo(() => {
    const herdsEV = formData.herd_ids.reduce((sum, hid) => {
      const h = herds.find(h => h.id === hid)
      return sum + Number(h?.total_ev || 0)
    }, 0)
    const planDays = formData.entry_date && formData.exit_date
      ? Math.max(1, Math.ceil((new Date(formData.exit_date).getTime() - new Date(formData.entry_date).getTime()) / 86400000))
      : 1
    const tempEV = tempAnimals.reduce((sum, a) => {
      const evRaw = (a.count * a.weight_kg) / 450
      if (a.entry_date && a.exit_date && formData.entry_date && formData.exit_date) {
        const overlapStart = a.entry_date > formData.entry_date ? a.entry_date : formData.entry_date
        const overlapEnd   = a.exit_date  < formData.exit_date  ? a.exit_date  : formData.exit_date
        const overlapDays  = Math.max(0, Math.ceil((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000))
        return sum + evRaw * (overlapDays / planDays)
      }
      return sum + evRaw
    }, 0)
    return herdsEV + tempEV
  }, [formData.herd_ids, formData.entry_date, formData.exit_date, herds, tempAnimals])

  const [modalStep, setModalStep] = useState(1)

  const suggestion = useMemo(() => {
    const paddock = paddocks.find(p => String(p.id) === String(formData.paddock_id))
    const ms       = paddock ? Number(paddock.dry_matter_kg_ha) || 0 : 0
    const areaHa   = paddock ? Number(paddock.area_ha) || 0 : 0

    const effectiveRemnant = remnantMode === 'pct'
      ? ms * (remnantPct / 100)
      : targetRemnant

    const effectiveDrought = droughtMode === 'pct'
      ? ms * (droughtPct / 100)
      : droughtKg

    const dailyDemand = totalPlanEV * dailyAllocationKg
    const usableMsTotal = calculateUsableForage(ms, effectiveRemnant + effectiveDrought, areaHa)
    
    const exactDays = dailyDemand > 0 ? usableMsTotal / dailyDemand : 0
    const days = Math.floor(exactDays)
    
    const paddockMaxEV = days > 0 ? Math.floor(usableMsTotal / (days * dailyAllocationKg)) : 0
    
    let recovery = 60
    if (weather?.currentSeason === 'SUMMER') recovery = 40
    if (weather?.currentSeason === 'SPRING') recovery = 45
    if (weather?.currentSeason === 'AUTUMN') recovery = 65
    if (weather?.currentSeason === 'WINTER') recovery = 95
    return { days, exactDays, recovery, availableMs: Math.round(ms), paddockMaxEV, usableMsTotal: Math.round(usableMsTotal) }
  }, [formData.paddock_id, totalPlanEV, paddocks, weather, targetRemnant, graceDays, dailyAllocationKg, remnantMode, remnantPct, droughtMode, droughtPct, droughtKg])

  const droughtReserve = useMemo(() => {
    const totalSupply = paddocks.reduce((sum, p) => {
      const ms = Number(p.dry_matter_kg_ha) || 0
      return sum + (ms * Number(p.area_ha || 0))
    }, 0)
    const uEvents = [
      ...farmEvents,
      ...movements.filter(m => m.occurred_at && m.entity_type === 'herd').map(m => ({
        ...m,
        event_date: m.occurred_at.split('T')[0],
        end_date: m.occurred_at.split('T')[0],
        isMovement: true,
        herd_id: m.entity_id,
      }))
    ]
    const dailyDemand = herds.reduce((sum, h) => {
      const hc = calculateDynamicHeadcount(h.id, Number(h.head_count) || 0, suggestStartDate, uEvents)
      return sum + (getDynamicHerdEV(h, suggestStartDate, farmEvents, hc) * 12)
    }, 0)
    const days = dailyDemand > 0 ? Math.floor(totalSupply / dailyDemand) : 0
    return { days, isCritical: days < 10 && days > 0 }
  }, [paddocks, herds, suggestStartDate, farmEvents, movements])

  const isForageLimiting = suggestion.paddockMaxEV > 0 && totalPlanEV > suggestion.paddockMaxEV

  const selectedPaddock = paddocks.find(p => p.id === formData.paddock_id)
  const isStaleData = useMemo(() => {
    if (!selectedPaddock) return false
    if (!selectedPaddock.last_monitoring_date && !selectedPaddock.dry_matter_kg_ha) return true
    if (selectedPaddock.last_monitoring_date) {
      const ageDays = daysBetween(selectedPaddock.last_monitoring_date, new Date().toISOString().split('T')[0])
      return ageDays > 7
    }
    return false
  }, [selectedPaddock])

  const handleSaveInlineData = async () => {
    if (!inlineDryMatter) return
    setSavingInlineData(true)
    try {
      await apiFetch(`/api/paddocks/${formData.paddock_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dry_matter_kg_ha: Number(inlineDryMatter) })
      })
      setPaddocks(prev => prev.map(p => p.id === formData.paddock_id ? { ...p, dry_matter_kg_ha: Number(inlineDryMatter), last_monitoring_date: new Date().toISOString() } : p))
      setInlineDryMatter('')
    } catch(err) {
      console.error(err)
    } finally {
      setSavingInlineData(false)
    }
  }



  const handleGeneratePlanCycle = async (seasonPlan: any) => {
    const getRecoveryDays = (exitDate: Date, overrideDays?: number): number => {
      if (overrideDays && overrideDays > 0) return overrideDays
      const month = exitDate.getMonth()
      const customRecovery = seasonPlan?.recovery_days || {}
      if (month >= 8 || month <= 1) return customRecovery.spring_summer || 40
      if (month >= 2 && month <= 4) return customRecovery.autumn || 65
      return customRecovery.winter || 92
    }

    const allActivePaddocks = paddocks.filter(p => p.is_active !== false)
    const activePaddocks = allActivePaddocks.length > 0 ? allActivePaddocks : paddocks

    // ── Filtrar solo los rodeos seleccionados para ESTE plan ──
    // Si seasonPlan.herd_ids está definido (planes nuevos), usar solo esos.
    // Si no (planes legacy), caer al comportamiento anterior: todos con EV > 0.
    const planHerdIds: string[] | null = Array.isArray(seasonPlan.herd_ids) && seasonPlan.herd_ids.length > 0
      ? seasonPlan.herd_ids
      : null
    const allHerdsWithEV = herds.filter(h => Number(h.total_ev) > 0).length > 0
      ? herds.filter(h => Number(h.total_ev) > 0)
      : herds
    const activeHerds = planHerdIds
      ? herds.filter(h => planHerdIds.includes(h.id))
      : allHerdsWithEV

    const startDate = seasonPlan.start_date || new Date().toISOString().split('T')[0]

    if (activeHerds.length === 0 || activePaddocks.length === 0 || !startDate) {
      toast.error('Faltá configurar potreros y rodeos. Verificá que existan en "Potreros" y "Rodeos".')
      return
    }


    const paddocksWithMs = activePaddocks.filter(p => Number(p.dry_matter_kg_ha) > 0)
    if (paddocksWithMs.length === 0) {
      const proceed = await confirm({
        title: 'Sin datos de biomasa',
        description: 'Ningún potrero tiene datos de biomasa (kg MS/ha) cargados. Se usará una estimación mínima de 1200 kg MS/ha. Para mayor precisión, completá los datos de forraje en cada potrero.',
        confirmLabel: 'Continuar de todas formas',
        cancelLabel: 'Cancelar',
        variant: 'warning',
      })
      if (!proceed) return
    } else if (paddocksWithMs.length < activePaddocks.length) {
      const sinDatos = activePaddocks.filter(p => !Number(p.dry_matter_kg_ha))
      console.info(`[Plan] ${sinDatos.length} potreros sin datos de MS (${sinDatos.map((p: any) => p.name).join(', ')}) → usando 1200 kg/ha estimado.`)
    }

    setSaving(true)
    setSuggesting(true)
    try {
      const dailyDemandMultiplier = Number(seasonPlan.daily_allocation_kg) || dailyAllocationKg
      const remnant = Number(seasonPlan.target_remnant_kg_ha) > 0
        ? Number(seasonPlan.target_remnant_kg_ha)
        : targetRemnant

      const precomputedDays: Record<string, number> = {}
      if (seasonPlan.supply_snapshot?.by_paddock) {
        for (const pd of seasonPlan.supply_snapshot.by_paddock) {
          if (pd.id && pd.avail_days > 0) precomputedDays[pd.id] = pd.avail_days
        }
      }

      let currentEntry = new Date(startDate + 'T12:00:00')
      let targetEndDate = new Date(currentEntry)
      if (seasonPlan.end_date) {
        targetEndDate = new Date(seasonPlan.end_date + 'T12:00:00')
      } else {
        targetEndDate.setFullYear(targetEndDate.getFullYear() + 1)
      }

      const newPlans: any[] = []
      const cycleId = crypto.randomUUID()

      const availabilityMap = new Map<string, number>()
      activePaddocks.forEach(p => {
        // Only carry over existing plans that fall within the new season's timeframe
        const activePlansList = plans.filter(pl =>
          pl.paddock_id === p.id &&
          pl.status !== 'COMPLETED' &&
          pl.exit_date &&
          // Only consider plans within the same season window
          new Date(pl.exit_date).getTime() >= currentEntry.getTime() &&
          new Date(pl.exit_date).getTime() < targetEndDate.getTime()
        )
        if (activePlansList.length > 0) {
          const maxExitTs = Math.max(...activePlansList.map(pl => new Date(pl.exit_date).getTime()))
          const maxExitDate = new Date(maxExitTs)
          const recDays = getRecoveryDays(maxExitDate)
          maxExitDate.setDate(maxExitDate.getDate() + recDays)
          availabilityMap.set(p.id, maxExitDate.getTime())
        } else {
          // Available from the start of the new season
          availabilityMap.set(p.id, currentEntry.getTime())
        }
      })

      console.log('[Plan] availabilityMap initialized. Paddocks ready from start:', activePaddocks.filter(p => (availabilityMap.get(p.id) ?? 0) <= currentEntry.getTime()).length, '/', activePaddocks.length)

      let iteration = 0
      const suggestedSeq = seasonPlan.metrics?.suggested_sequence || []

      // Persistent index for cycling through the suggested sequence
      let seqIdx = 0
      let firstBlockPlaced = false

      while (currentEntry < targetEndDate && iteration < 600) {
        iteration++

        let chosenPaddock: any = null

        if (suggestedSeq.length > 0) {
          // ── Modo Sugerido: ciclar infinitamente por la secuencia ──
          const nextPaddockId = suggestedSeq[seqIdx % suggestedSeq.length]
          chosenPaddock = activePaddocks.find(p => p.id === nextPaddockId)

          if (!chosenPaddock) {
            seqIdx++
            continue // potrero descartado/inactivo, pasar al siguiente
          }

          const availTs = availabilityMap.get(chosenPaddock.id) ?? currentEntry.getTime()

          if (!firstBlockPlaced) {
            // HARD CONSTRAINT: El primer potrero de la secuencia DEBE usarse exactamente en la startDate.
            // Ignoramos `availTs` para forzar que inicie donde el usuario eligió y el día que eligió.
          } else {
            if (availTs >= targetEndDate.getTime()) {
              seqIdx++
              continue // potrero agotado o no disponible, saltar al siguiente en la secuencia
            }
            if (availTs > currentEntry.getTime()) {
              currentEntry = new Date(availTs) // esperar a que se libere el potrero
            }
          }
          seqIdx++
        } else {
          // ── Modo Greedy: elegir el potrero más disponible ──
          const readyPaddocks = activePaddocks
            .filter(p => (availabilityMap.get(p.id) ?? 0) <= currentEntry.getTime())
            .sort((a, b) => {
              const numA = parseInt(String(a.name), 10)
              const numB = parseInt(String(b.name), 10)
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB
              if (!isNaN(numA)) return -1
              if (!isNaN(numB)) return 1
              return String(a.name).localeCompare(String(b.name))
            })

          if (readyPaddocks.length > 0) {
            chosenPaddock = readyPaddocks[0]
          } else {
            // Ningún potrero listo aún — saltar al próximo disponible
            const nextTs = Math.min(...activePaddocks.map(p => availabilityMap.get(p.id) ?? Infinity))
            if (!isFinite(nextTs) || nextTs >= targetEndDate.getTime()) break
            currentEntry = new Date(nextTs)
            continue
          }
        }

        let stayDays: number
        
        // --- Cálculo dinámico de carga animal (EV) para la fecha actual del bloque ---
        const currentEntryIso = currentEntry.toISOString().split('T')[0]
        
        // Preparar unifiedEvents para el ciclo (combina farmEvents y movements)
        const localUnifiedEvents = [
          ...farmEvents,
          ...movements.filter(m => m.occurred_at && m.entity_type === 'herd').map(m => ({
            ...m,
            event_date: m.occurred_at.split('T')[0],
            end_date: m.occurred_at.split('T')[0],
            isMovement: true,
            herd_id: m.entity_id,
          }))
        ]

        const currentActiveHerds = activeHerds.filter(h => {
          if (h.is_temporary) {
            if (h.admission_date && currentEntryIso < h.admission_date) return false
            if (h.exit_date && currentEntryIso > h.exit_date) return false
            return true
          }
          // Para rodeos normales, si el headcount es 0 en esta fecha, no están activos.
          const hc = calculateDynamicHeadcount(h.id, Number(h.head_count) || 0, currentEntryIso, localUnifiedEvents)
          return hc > 0
        })

        const currentHerdIds = currentActiveHerds.map(h => h.id)
        const currentTotalEV = currentActiveHerds.reduce((sum, h) => {
          const hc = calculateDynamicHeadcount(h.id, Number(h.head_count) || 0, currentEntryIso, localUnifiedEvents)
          return sum + getDynamicHerdEV(h, currentEntryIso, farmEvents, hc)
        }, 0)
        
        // SIEMPRE recalcular en tiempo real usando el EV dinámico actual y el remanente objetivo.
        // Los precomputedDays del snapshot pueden estar desactualizados (EV diferente, sin remanente,
        // o MS del potrero anterior), lo que causa que el planificador muestre días incorrectos.
        // Solo usamos precomputedDays como último recurso cuando el potrero no tiene datos de MS.
        const msDynamic = Number(chosenPaddock.dry_matter_kg_ha) > 0 ? Number(chosenPaddock.dry_matter_kg_ha) : 0
        const areaDynamic = Number(chosenPaddock.area_ha) || 10
        const evForCalc = currentTotalEV > 0 ? currentTotalEV : 1
        if (msDynamic > 0) {
          // Calcular en tiempo real con MS actual, EV dinámico y remanente objetivo correcto
          const usableMs = calculateUsableForage(msDynamic, remnant, areaDynamic)
          const dailyDemand = evForCalc * dailyDemandMultiplier
          const rawDays = calculateGrazingDays(usableMs, dailyDemand)
          if (rawDays <= 0) {
            availabilityMap.set(chosenPaddock.id, Infinity)
            continue
          }
          stayDays = rawDays
        } else if (precomputedDays[chosenPaddock.id] > 0) {
          // Sin datos de MS en el potrero: usar el snapshot como respaldo
          stayDays = precomputedDays[chosenPaddock.id]
        } else {
          // Sin ningún dato: no se puede pastorear (saltarlo)
          availabilityMap.set(chosenPaddock.id, Infinity)
          continue
        }

        // Ya no forzamos stayDays = 1, si llegó hasta acá es válido.
        stayDays = Math.floor(stayDays)

        const exitDate = new Date(currentEntry)
        exitDate.setDate(exitDate.getDate() + stayDays)

        const recDays = getRecoveryDays(exitDate)

        newPlans.push({
          paddock_id: chosenPaddock.id,
          herd_id:    currentActiveHerds[0]?.id || null,
          herd_ids:   currentHerdIds,
          entry_date: currentEntry.toISOString().split('T')[0],
          exit_date:  exitDate.toISOString().split('T')[0],
          planned_recovery_days: recDays,
          status: 'PLANNED',
          plan_type:     seasonPlan.source === 'suggested' ? 'suggested' : 'manual',
          source_origin: 'algorithm',
          ai_analysis: {
            plan_source: seasonPlan.source === 'suggested' ? 'suggested' : 'season_plan',
            season_plan_id: seasonPlan.id,
            cycle_id: cycleId,
          },
        })

        const recoveryEnd = new Date(exitDate)
        recoveryEnd.setDate(recoveryEnd.getDate() + recDays)
        availabilityMap.set(chosenPaddock.id, recoveryEnd.getTime())

        // Advance to the earliest time any OTHER paddock becomes available,
        // OR to the day after exit if any paddock is already free
        const otherTs = activePaddocks
          .filter(p => p.id !== chosenPaddock!.id)
          .map(p => availabilityMap.get(p.id) ?? currentEntry.getTime())
        const minOtherTs = otherTs.length > 0 ? Math.min(...otherTs) : recoveryEnd.getTime()
        currentEntry = new Date(Math.max(exitDate.getTime() + 86400000, minOtherTs))
        firstBlockPlaced = true
      }

      if (newPlans.length === 0) {
        toast.error(
          `DEBUG: No se generaron planes. iter=${iteration}, curr=${currentEntry.toISOString().split('T')[0]}, target=${targetEndDate.toISOString().split('T')[0]}, seqLen=${suggestedSeq.length}, activePad=${activePaddocks.length}`,
          { duration: 10000 }
        )
        setSaving(false)
        return
      }

      await Promise.all(
        newPlans.map(p => apiFetch('/api/grazing-plans', { method: 'POST', body: JSON.stringify(p) }))
      )

      // If suggested mode, persist the sequence so the Gantt reorders paddock rows
      if (suggestedSeq.length > 0) {
        setSuggestedPaddockOrder(suggestedSeq)
      }

      toast.success(`Gantt generado: ${newPlans.length} bloques de pastoreo creados para ${activePaddocks.length} potreros`)
      loadData()
    } catch(err) {
      console.error(err)
      toast.error('Se guardó el plan, pero hubo un error al renderizar el Gantt. Intentá refrescar la página.')
    } finally {
      setSaving(false)
      setSuggesting(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!formData.id) return
    const ok = await confirm({
      title: '¿Eliminar esta planificación?',
      description: 'Esta acción es irreversible. El bloque de pastoreo será eliminado del Gantt.',
      confirmLabel: 'Sí, eliminar',
      variant: 'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/grazing-plans/${formData.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPlans(prev => prev.filter(p => p.id !== formData.id))
        setIsModalOpen(false)
        toast.success('Planificación eliminada')
      } else {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
        toast.error(`No se pudo eliminar: ${errData.error}`)
      }
    } catch(err: any) {
      console.error(err)
      toast.error(`No se pudo eliminar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDeletePlanned = async () => {
    const plannedCount = plans.filter(p => p.status === 'PLANNED').length
    if (plannedCount === 0) {
      toast.info('No hay planificaciones en estado "Planificado" para eliminar.')
      return
    }
    const ok = await confirm({
      title: `¿Eliminar ${plannedCount} planificaci${plannedCount === 1 ? 'ón' : 'ones'}?`,
      description: `Se borrarán ${plannedCount} planificaci${plannedCount === 1 ? 'ón sugerida' : 'ones sugeridas'} del Gantt. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar todo',
      variant: 'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/grazing-plans/bulk-delete?status=PLANNED', { method: 'DELETE' })
      if (res.ok) {
        const { deleted } = await res.json()
        setPlans(prev => prev.filter(p => p.status !== 'PLANNED'))
        toast.success(`Se eliminaron ${deleted} planificaciones sugeridas`)
      } else {
        toast.error('Error al eliminar las planificaciones. Intentá nuevamente.')
      }
    } catch(err) {
      console.error(err)
      toast.error('Error de conexión al intentar eliminar.')
    } finally {
      setSaving(false)
    }
  }

  const eventsInRange = useMemo(() => {
    if (!formData.entry_date || !formData.exit_date) return []
    return farmEvents.filter(e =>
      e.event_date >= formData.entry_date &&
      e.event_date <= formData.exit_date
    )
  }, [farmEvents, formData.entry_date, formData.exit_date])

  const CACHE_KEY = 'rodeo_grazing_data_cache'

  const loadData = useCallback(async () => {
    if (!user) return
    
    let isCached = false
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY)
      if (cachedStr) {
        const cached = JSON.parse(cachedStr)
        if (cached.paddocks) setPaddocks(cached.paddocks)
        if (cached.herds) setHerds(cached.herds)
        if (cached.plans) setPlans(cached.plans)
        if (cached.farmEvents) setFarmEvents(cached.farmEvents)
        if (cached.movements) setMovements(cached.movements)
        if (cached.seasonPlans) setSeasonPlans(cached.seasonPlans)
        if (cached.weatherEvents) setWeatherEvents(cached.weatherEvents)
        isCached = true
        setLoading(false)
      }
    } catch (err) {}

    if (!isCached) setLoading(true)

    try {
      const [paddocksRes, herdsRes, plansRes, eventsRes, movementsRes, mercadoRes, orgRes, spRes, wEvRes, wDataRes] = await Promise.all([
        apiFetch('/api/paddocks').catch(() => null),
        apiFetch('/api/herds').catch(() => null),
        apiFetch('/api/grazing-plans').catch(() => null),
        apiFetch('/api/farm-events').catch(() => null),
        apiFetch('/api/movements?entity_type=herd').catch(() => null),
        fetch('/api/mercado').catch(() => null),
        apiFetch('/api/organizations').catch(() => null),
        apiFetch('/api/season-plans').catch(() => null),
        apiFetch('/api/weather?limit=200').catch(() => null),
        getPaddockWeather(-37.32, -59.13).catch(() => null),
      ])

      let pData = paddocks; let hData = herds; let plData = plans;
      let feData = farmEvents; let mData = movements; let spData = seasonPlans; let wEventsData = weatherEvents;

      if (paddocksRes?.ok) { const j = await paddocksRes.json(); pData = j.paddocks ?? []; setPaddocks(pData); }
      if (herdsRes?.ok) { const j = await herdsRes.json(); hData = j.herds ?? []; setHerds(hData); }
      if (plansRes?.ok) { const j = await plansRes.json(); plData = j.plans ?? []; setPlans(plData); }
      if (eventsRes?.ok) { const j = await eventsRes.json(); feData = j.events ?? []; setFarmEvents(feData); }
      if (movementsRes?.ok) { const j = await movementsRes.json(); mData = j.movements ?? []; setMovements(mData); }
      if (spRes?.ok) { const j = await spRes.json(); spData = j.plans ?? j ?? []; setSeasonPlans(spData); }
      if (wEvRes?.ok) { 
        const j = await wEvRes.json(); 
        wEventsData = j.events ?? []; 
        setWeatherEvents(wEventsData);
        const fromDb: Record<string, number> = {}
        ;(wEventsData).forEach((ev: any) => {
          if (ev.type === 'RAIN') {
            const key = (ev.date as string).slice(0, 7)
            fromDb[key] = (fromDb[key] || 0) + Number(ev.value)
          }
        })
        setRainfallData(prev => ({ ...prev, ...fromDb }))
      }

      if (mercadoRes?.ok) setMercado(await mercadoRes.json())
      if (orgRes?.ok) {
        const j = await orgRes.json()
        if (j.organization) {
          const org = j.organization
          const newDaily = Number(org.default_daily_allocation_kg ?? 12)
          const newRemnant = Number(org.default_target_remnant_kg_ha ?? 600)
          setDailyAllocationKg(newDaily)
          setRawDailyAlloc(String(newDaily))
          setTargetRemnant(newRemnant)
          setRawTargetRemnant(String(newRemnant))
        }
      }

      // Solo actualizar cache con los últimos datos en memoria
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          paddocks: pData, herds: hData, plans: plData, farmEvents: feData,
          movements: mData, seasonPlans: spData, weatherEvents: wEventsData
        }))
      } catch (err) {}

      // ── Persistir planes en IndexedDB para acceso offline ─────────────
      if (plData.length > 0) {
        import('@/lib/offline/db').then(({ dbUpsertMany }) => {
          dbUpsertMany('grazing_plans', plData).catch(() => {})
        })
      }

      if (wDataRes) {
        setWeather(wDataRes)
      }
    } catch (err) {
      console.error('Grazing loadData error:', err)
    } finally {
      if (!isCached) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
    const handleReload = () => loadData()
    window.addEventListener('rodeo-data-reload', handleReload)
    window.addEventListener('rodeo-gantt-reload', handleReload)
    return () => {
      window.removeEventListener('rodeo-data-reload', handleReload)
      window.removeEventListener('rodeo-gantt-reload', handleReload)
    }
  }, [loadData])
  const handleOpenModal = (plan: any = null) => {
    setInlineDryMatter('')
    if (plan) {
      const isSuggestedPlan = plan.ai_analysis?.plan_source === 'suggested'

      // For SUGGESTED plans: restore all herds and paddocks from the full cycle metadata.
      // Each block in the cycle knows its own herd (herd_ids = [thisHerd]) but the
      // ai_analysis.cycle_all_herd_ids and cycle_all_paddock_ids hold the full selection.
      let resolvedHerdIds: string[]
      const resolvedPaddockId: string = plan.paddock_id

      if (isSuggestedPlan && Array.isArray(plan.ai_analysis?.cycle_all_herd_ids) && plan.ai_analysis.cycle_all_herd_ids.length > 0) {
        // Show ALL herds of the cycle — this plan's herd is the one actively grazing in this block
        resolvedHerdIds = plan.ai_analysis.cycle_all_herd_ids
      } else {
        // Manual plan or legacy suggested: prefer herd_ids array, fallback to [herd_id]
        resolvedHerdIds = Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0
          ? plan.herd_ids
          : plan.herd_id ? [plan.herd_id] : []
      }

      // For suggested cycle: the active herd in this block is the original single herd_id
      // (stored before expansion). We keep it so the modal can highlight it.
      const originalActiveHerdId = isSuggestedPlan && Array.isArray(plan.herd_ids) && plan.herd_ids.length === 1
        ? plan.herd_ids[0]
        : isSuggestedPlan && plan.herd_id
          ? plan.herd_id
          : null

      setFormData({
        ...plan,
        paddock_id: resolvedPaddockId,
        herd_ids:   resolvedHerdIds,
        entry_date: safeIso(plan.is_locked && plan.adjusted_entry_date ? plan.adjusted_entry_date : plan.entry_date),
        exit_date: safeIso(plan.is_locked && plan.adjusted_exit_date ? plan.adjusted_exit_date : plan.exit_date),
        _original_entry_date: safeIso(plan.entry_date),
        _original_exit_date: safeIso(plan.exit_date),
        actual_entry_date: safeIso(plan.actual_entry_date),
        actual_exit_date: safeIso(plan.actual_exit_date),
        // Store original active herd id for UI highlighting in suggested plans
        ...(originalActiveHerdId ? { _original_herd_id: originalActiveHerdId } : {}),
      })

      // Restore temporary animals if saved
      const savedTemp = Array.isArray(plan.temporary_animals) ? plan.temporary_animals : []
      setTempAnimals(savedTemp)
      setCompletionPhoto('')
      setRemnantAnalysis(null)
      setExitDateWarning(false)
      setModalStep(1)
    } else {
      setFormData({
        id: '',
        paddock_id: '',
        herd_ids: herds.map((h: any) => h.id), // Auto-select all active herds
        entry_date: new Date().toISOString().split('T')[0],
        exit_date: '',
        actual_entry_date: '',
        actual_exit_date: '',
        planned_recovery_days: 60,
        status: 'PLANNED'
      })
      setTempAnimals([])
      setCompletionPhoto('')
      setRemnantAnalysis(null)
      setExitDateWarning(false)
      setModalStep(1)
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    // ── Validar Exclusividad Extendida — solo dentro del mismo track (plan_type) ──
    // Los planes del track Sugerido NO bloquean el track Manual, y viceversa.
    if (formData.paddock_id && formData.entry_date) {
      const newEntry = formData.entry_date
      const newExit  = formData.exit_date || formData.entry_date
      const conflict = plans.find(p =>
        p.id !== formData.id &&
        p.paddock_id === formData.paddock_id &&
        p.status !== 'COMPLETED' &&
        // Solo comparar contra planes del mismo track activo
        (p.plan_type || 'manual') === activeGanttTab
      )
      if (conflict) {
        const conflictExit     = conflict.exit_date || conflict.entry_date
        const recoveryDays     = conflict.planned_recovery_days || 60
        const paddockAvailable = addDays(conflictExit, recoveryDays)
        // Block if: new entry is before the end of the rest period, AND new exit is after conflict start
        if (newEntry < paddockAvailable && newExit >= conflict.entry_date) {
          toast.warning(
            `Potrero bloqueado hasta el ${paddockAvailable} (salida ${conflictExit} + ${recoveryDays} días de descanso regenerativo). No se puede solapar la recuperación del pasto.`,
            { duration: 8000 }
          )
          return
        }
      }
    }

    setSaving(true)
    try {
      const isLocked = !!(formData as any).is_locked
      
      const payload: any = {
        paddock_id: formData.paddock_id,
        herd_id: formData.herd_ids[0] || null,
        herd_ids: formData.herd_ids,
        
        // Si está fijado como Original, editamos las fechas ajustadas, no las originales.
        ...(isLocked ? {
          adjusted_entry_date: formData.entry_date,
          adjusted_exit_date: formData.exit_date || null,
        } : {
          entry_date: formData.entry_date,
          exit_date: formData.exit_date || null,
          adjusted_entry_date: null,
          adjusted_exit_date: null,
        }),
        
        actual_entry_date: formData.actual_entry_date || null,
        actual_exit_date: formData.actual_exit_date || null,
        planned_recovery_days: formData.planned_recovery_days,
        status: formData.actual_exit_date ? 'COMPLETED'
          : formData.actual_entry_date ? 'ACTIVE'
          : formData.status,
        temporary_animals: tempAnimals,
        exit_notes: completionNote || undefined,
        exit_dry_matter_kg_ha: remnantAnalysis?.dry_matter_kg_ha || undefined,
        // Preserve plan_source from existing plan; if new, default to 'manual'
        ai_analysis: {
          ...(formData.ai_analysis || {}),
          plan_source: formData.ai_analysis?.plan_source || 'manual',
          daily_allocation_kg: dailyAllocationKg,
          target_remnant_kg_ha: targetRemnant,
          // Registrar historial de ediciones con fecha + datos cambiados
          history: [
            ...((formData.ai_analysis?.history as any[]) || []),
            {
              changed_at: new Date().toISOString().split('T')[0],
              entry_date: isLocked ? (formData.entry_date || null) : (formData.entry_date || null),
              exit_date:  isLocked ? (formData.exit_date  || null) : (formData.exit_date  || null),
              notes: (formData as any).notes || '',
            },
          ],
        },
      }

      // ── Cascade recalculation for suggested cycles with extra animals ──────
      // When tempAnimals are added to a plan in a suggested cycle, we need to:
      // 1. Recalculate the new exit_date for this plan (increased EV → fewer days)
      // 2. Shift all subsequent plans in the same cycle forward/backward by the delta
      // 3. For plans that overlap with the extra-animal period, also recalculate their days
      const cycleId = formData.ai_analysis?.cycle_id as string | undefined
      const isSuggestedWithExtras = cycleId && tempAnimals.length > 0 && formData.paddock_id && formData.entry_date && formData.exit_date

      const cascadeUpdates: Array<{ id: string; entry_date: string; exit_date: string }> = []

      if (isSuggestedWithExtras) {
        // ── Step 1: Compute NEW exit_date for this plan with extra animal EV included ──
        const paddock = paddocks.find(p => p.id === formData.paddock_id)
        if (paddock) {
          const area          = Number(paddock.area_ha) || 0
          const ms            = Number(paddock.dry_matter_kg_ha) || 1800
          const remnant       = targetRemnant  // ← Usa el mismo remanente configurado en el UI
          const usableMs      = calculateUsableForage(ms, remnant, area)

          // Base EV (from selected herds, NOT the cycle expansion — use the original grazing herd)
          const originalHerdIds = Array.isArray(formData.ai_analysis?.cycle_all_herd_ids)
            ? [(formData as any)._original_herd_id || formData.herd_ids[0]].filter(Boolean)
            : formData.herd_ids
          const baseHerds = herds.filter(h => originalHerdIds.includes(h.id))
          const baseEV    = baseHerds.reduce((s, h) => s + Number(h.total_ev || 0), 0)

          // Extra EV — weighted for overlap with plan period
          const planEntry  = new Date(formData.entry_date + 'T00:00:00')
          const planExit   = new Date(formData.exit_date  + 'T00:00:00')
          const planDaysTotal = Math.max(1, Math.round((planExit.getTime() - planEntry.getTime()) / 86400000))
          const extraEV    = tempAnimals.reduce((sum, a) => {
            const evRaw = (a.count * a.weight_kg) / 450
            if (a.entry_date && a.exit_date) {
              const aEntry = new Date(a.entry_date + 'T00:00:00')
              const aExit  = new Date(a.exit_date  + 'T00:00:00')
              const overlapStart = aEntry > planEntry ? aEntry : planEntry
              const overlapEnd   = aExit  < planExit  ? aExit  : planExit
              const overlapDays  = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000))
              return sum + evRaw * (overlapDays / planDaysTotal)
            }
            return sum + evRaw
          }, 0)

          const totalEVWithExtras = baseEV + extraEV
          const dailyDemandNew    = totalEVWithExtras * dailyAllocationKg  // ← Usa la asignación configurada
          const newDays           = dailyDemandNew > 0 ? Math.max(1, calculateGrazingDays(usableMs, dailyDemandNew)) : planDaysTotal

          // New exit date
          const newExitDate = new Date(planEntry)
          newExitDate.setDate(newExitDate.getDate() + newDays)
          const newExitStr  = newExitDate.toISOString().split('T')[0]

          // Delta between original and new exit (positive = shorter stay, negative = longer)
          const originalExitMs = planExit.getTime()
          const newExitMs      = newExitDate.getTime()
          const deltaDays      = Math.round((newExitMs - originalExitMs) / 86400000) // negative = fewer days

          if (newExitStr !== formData.exit_date && Math.abs(deltaDays) > 0) {
            // Override exit_date in payload with recalculated date
            if (isLocked) {
              payload.adjusted_exit_date = newExitStr
            } else {
              payload.exit_date = newExitStr
            }

            // ── Step 2: Find all sibling plans in the same cycle ──
            // Sibling = same cycle_id in ai_analysis, entry_date AFTER current plan's entry
            const siblings = plans
              .filter(p =>
                p.id !== formData.id &&
                p.ai_analysis?.cycle_id === cycleId &&
                p.entry_date > formData.entry_date
              )
              .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

            // ── Step 3: Cascade-shift siblings ──
            // We also check if each sibling overlaps with extra animal period and recalculate its days
            const extraAnimalEndDate = tempAnimals.reduce((latest, a) => {
              return a.exit_date && a.exit_date > latest ? a.exit_date : latest
            }, formData.exit_date)

            for (const sib of siblings) {
              const sibEntry     = new Date(sib.entry_date + 'T00:00:00')
              const sibExit      = sib.exit_date ? new Date(sib.exit_date + 'T00:00:00') : null
              const sibOrigDays  = sibExit ? Math.round((sibExit.getTime() - sibEntry.getTime()) / 86400000) : 7

        // Shift entry by delta
              const newSibEntry = new Date(sibEntry)
              newSibEntry.setDate(newSibEntry.getDate() + deltaDays)

              // Check if extra animals overlap with this sibling's period
              const sibOverlapsExtras = sib.entry_date <= extraAnimalEndDate && sib.exit_date >= formData.entry_date
              let newSibDays = sibOrigDays

              if (sibOverlapsExtras) {
                // Recalculate days for this sibling too if same paddock is affected
                const sibPaddock = paddocks.find(p => p.id === sib.paddock_id)
                if (sibPaddock) {
                  const sibArea      = Number(sibPaddock.area_ha) || 0
                  const sibMs        = Number(sibPaddock.dry_matter_kg_ha) || 1800
                  const sibUsableMs  = Math.max(0, (sibMs - remnant) * sibArea)
                  // Extra animals EV on this sibling's period
                  const sibExtraEV   = tempAnimals.reduce((sum, a) => {
                    const evRaw = (a.count * a.weight_kg) / 450
                    if (a.entry_date && a.exit_date) {
                      const aEntry = new Date(a.entry_date + 'T00:00:00')
                      const aExit  = new Date(a.exit_date  + 'T00:00:00')
                      const sOverlapStart = aEntry > newSibEntry ? aEntry : newSibEntry
                      const sOverlapEnd   = new Date(newSibEntry)
                      sOverlapEnd.setDate(sOverlapEnd.getDate() + sibOrigDays)
                      const sOverlap = Math.max(0, Math.round((Math.min(aExit.getTime(), sOverlapEnd.getTime()) - Math.max(aEntry.getTime(), newSibEntry.getTime())) / 86400000))
                      return sum + evRaw * (sOverlap / Math.max(1, sibOrigDays))
                    }
                    return sum
                  }, 0)
                  const sibBaseHerds = herds.filter(h => (sib.ai_analysis?.cycle_all_herd_ids || sib.herd_ids || []).includes(h.id))
                  const sibOriginalHerdId = sib.herd_ids?.[0] || sib.herd_id
                  const sibGrazingHerd = herds.find(h => h.id === sibOriginalHerdId)
                  const sibBaseEV = sibGrazingHerd ? Number(sibGrazingHerd.total_ev || 0) : 0
                  const sibTotalEV = sibBaseEV + sibExtraEV
                  const sibDailyDemand = sibTotalEV * dailyAllocationKg  // ← Usa la asignación configurada
                  newSibDays = sibDailyDemand > 0 ? Math.max(1, Math.floor(sibUsableMs / sibDailyDemand)) : sibOrigDays
                }
              }

              const newSibExit = new Date(newSibEntry)
              newSibExit.setDate(newSibExit.getDate() + newSibDays)

              cascadeUpdates.push({
                id:         sib.id,
                entry_date: newSibEntry.toISOString().split('T')[0],
                exit_date:  newSibExit.toISOString().split('T')[0],
              })
            }
          }
        }
      }

      // ── Save main plan (offline-first via Outbox) ────────────────────────
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
      const { enqueue } = await import('@/lib/offline/outbox')

      if (formData.id) {
        // ── Optimistic local update ───────────────────────────────────────
        const optimisticPlan = { ...formData, ...payload, id: formData.id, updated_at: Date.now() }
        setPlans(prev => prev.map(p => p.id === formData.id ? { ...p, ...payload } : p))
        import('@/lib/offline/db').then(({ dbUpsert }) => {
          dbUpsert('grazing_plans', optimisticPlan).catch(() => {})
        })

        await enqueue({
          type: 'grazing_plan_update',
          url: `/api/grazing-plans/${formData.id}`,
          method: 'PATCH',
          body: payload,
        })
      } else {
        const tempId = `pending-${Date.now()}`
        const optimisticPlan = { ...payload, id: tempId, status: payload.status || 'PLANNED', updated_at: Date.now() }
        setPlans(prev => [optimisticPlan, ...prev])
        import('@/lib/offline/db').then(({ dbUpsert }) => {
          dbUpsert('grazing_plans', optimisticPlan).catch(() => {})
        })

        await enqueue({
          type: 'grazing_plan_create',
          url: '/api/grazing-plans',
          method: 'POST',
          body: payload,
          localData: { store: 'grazing_plans', data: optimisticPlan },
        })
      }

      // ── Apply cascade updates to sibling plans ──
      if (cascadeUpdates.length > 0) {
        await Promise.all(
          cascadeUpdates.map(u =>
            enqueue({
              type: 'grazing_plan_update',
              url: `/api/grazing-plans/${u.id}`,
              method: 'PATCH',
              body: { entry_date: u.entry_date, exit_date: u.exit_date },
            })
          )
        )
        setPlans(prev => prev.map(p => {
          const cu = cascadeUpdates.find(u => u.id === p.id)
          return cu ? { ...p, entry_date: cu.entry_date, exit_date: cu.exit_date } : p
        }))
      }

      // Update paddock status
      if (payload.status === 'ACTIVE') {
        enqueue({ type: 'paddock_status', url: `/api/paddocks/${formData.paddock_id}`, method: 'PATCH', body: { current_status: 'GRAZING' } })
      } else if (payload.status === 'COMPLETED') {
        enqueue({ type: 'paddock_status', url: `/api/paddocks/${formData.paddock_id}`, method: 'PATCH', body: { current_status: 'RESTING' } })
      }

      // Notify user about cascade if it happened
      if (cascadeUpdates.length > 0) {
        console.info(`[Cascade] Queued ${cascadeUpdates.length} sibling plan updates in cycle ${cycleId}`)
      }

      if (isOffline) {
        toast.info('Sin conexión — los cambios se guardarán al reconectar.', { duration: 4000 })
      }
    } catch (err) {
      console.error('handleSave error:', err)
      toast.error('Error al guardar. Intentá de nuevo.')
    } finally {
      setIsModalOpen(false)
      setSaving(false)
      if (navigator.onLine) loadData()
    }
  }


  // Move a block by drag → update dates optimistically (offline-first)
  const handleBlockMove = useCallback(async (planId: string, newEntry: string, newExit: string, planContext?: any) => {
    const isLocked = planContext?.is_locked;

    const updateBody = isLocked
      ? { adjusted_entry_date: newEntry, adjusted_exit_date: newExit }
      : { entry_date: newEntry, exit_date: newExit };

    // Optimistic UI update
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        return isLocked
          ? { ...p, adjusted_entry_date: newEntry, adjusted_exit_date: newExit }
          : { ...p, entry_date: newEntry, exit_date: newExit }
      }
      return p
    }))

    // Persist via outbox (works offline)
    const { enqueue } = await import('@/lib/offline/outbox')
    await enqueue({
      type: 'grazing_plan_move',
      url: `/api/grazing-plans/${planId}`,
      method: 'PATCH',
      body: updateBody,
    })
  }, [])

  const filteredPlans = useMemo(() =>
    plans.filter(p => {
      const matchSearch = (p.paddocks?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (p.herds?.name || '').toLowerCase().includes(search.toLowerCase())
      // In History mode, default to showing COMPLETED, unless user overrides
      const isHistoryMode = viewMode === 'history'
      const matchStatus = filterStatus === 'all' ? (isHistoryMode ? p.status === 'COMPLETED' : true) : p.status === filterStatus
      // ── Track filter: filter by active tab in Gantt view ──────────────
      let matchTab = true
      if (viewMode === 'gantt') {
        if (activeGanttTab === 'suggested') {
          // Suggested tab: only show suggested plans
          matchTab = (p.plan_type === 'suggested' || p.ai_analysis?.plan_source === 'suggested')
        } else {
          // Manual tab: show all non-suggested plans
          matchTab = (p.plan_type !== 'suggested' && p.ai_analysis?.plan_source !== 'suggested')
        }
      } else if (viewMode === 'history') {
        if (historyTab === 'suggested') {
          matchTab = (p.plan_type === 'suggested' || p.ai_analysis?.plan_source === 'suggested')
        } else if (historyTab === 'manual') {
          matchTab = (p.plan_type !== 'suggested' && p.ai_analysis?.plan_source !== 'suggested')
        }
      }

      // Mostrar todos los planes del track activo, sin filtrar por temporada.
      // El activeSeasonPlanId solo se usa para posicionar la ventana del Gantt,
      // no para ocultar planes — los planes deben verse siempre que correspondan al tab.
      return matchSearch && matchStatus && matchTab
    }),
    [plans, search, filterStatus, viewMode, activeGanttTab, historyTab]
  )

  let dynamicWindowDays = (PERIODS[ganttPeriod] ?? 365) + (ganttPeriod === 'anual' ? 215 : 0)

  const activeSeasonPlan = seasonPlans.find(sp => sp.id === activeSeasonPlanId)
  if (viewMode === 'gantt' && activeSeasonPlan?.start_date && activeSeasonPlan?.end_date) {
    const s = new Date(activeSeasonPlan.start_date + 'T00:00:00').getTime()
    const e = new Date(activeSeasonPlan.end_date + 'T00:00:00').getTime()
    const diff = Math.ceil((e - s) / 86400000)
    if (diff > 0) {
      if (ganttPeriod === 'cerrada' || ganttPeriod === 'abierta') {
        dynamicWindowDays = diff // Exact season duration, no extension
      } else {
        dynamicWindowDays = Math.max(dynamicWindowDays, diff + (ganttPeriod === 'anual' ? 215 : 0))
      }
    }
  }
  
  if (viewMode === 'gantt' && typeof filteredPlans !== 'undefined' && filteredPlans.length > 0) {
    if (ganttPeriod !== 'cerrada' && ganttPeriod !== 'abierta') {
      const startObj = new Date(ganttWindow + 'T00:00:00')
      let maxDate = startObj.getTime() + dynamicWindowDays * 24 * 60 * 60 * 1000

      filteredPlans.forEach((p: any) => {
        const exitStr = p.exit_date || p.actual_exit_date || p.entry_date
        if (exitStr) {
          const exitObj = new Date(exitStr + 'T00:00:00')
          if (exitObj.getTime() > maxDate) {
            maxDate = exitObj.getTime()
          }
        }
      })

      const diffDays = Math.ceil((maxDate - startObj.getTime()) / (24 * 60 * 60 * 1000))
      if (diffDays > dynamicWindowDays) {
        dynamicWindowDays = Math.min(diffDays + (ganttPeriod === 'anual' ? 215 : 0), 2190) // Max 6 years to allow 2027+ comfortably
      }
    }
  }

  const WINDOW_DAYS = dynamicWindowDays


  const handleExportExcel = async () => {
    try {
      const res = await apiFetch('/api/grazing-plans/export')
      if (!res.ok) { toast.error('Error al exportar el historial. Intentá de nuevo.'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `planificacion-pastoreo-${new Date().toISOString().slice(0,10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Error al exportar el historial.')
    }
  }

  const handleExportSeasonPlan = (sp: any) => {
    const spPlans = plans.filter(p => p.ai_analysis?.season_plan_id === sp.id || p.season_plan_id === sp.id)
    if (spPlans.length === 0) {
      toast.error('No hay registros para este plan.')
      return
    }

    const headers = [
      'Potrero', 'Rodeos', 'Estado',
      'Entrada plan', 'Entrada real', 'Salida plan', 'Salida real',
      'Días plan', 'Días reales', 'Stock inicio', 'Stock fin',
      'Remanente (kg MS/ha)', 'Desvío (días)',
    ]
    const fmtCsv = (d: string | null | undefined) =>
      d ? new Date(d + 'T12:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

    const rows = spPlans.map(plan => {
      const pHerds = herds.filter(h => (plan.herd_ids?.length ? plan.herd_ids : plan.herd_id ? [plan.herd_id] : []).includes(h.id))
      const herdNames = pHerds.map(h => h.name).join(' / ')
      const st = STATUS_MAP[plan.status]?.label || plan.status
      const plannedDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : (plan.planned_recovery_days || '')
      const effectiveEntry = plan.actual_entry_date || (plan.status === 'COMPLETED' ? plan.entry_date : null)
      const actualDays = (effectiveEntry && plan.actual_exit_date) ? daysBetween(effectiveEntry, plan.actual_exit_date) : ''
      let stockInicio = pHerds.reduce((s, h) => s + (Number(h.animal_count || h.head_count) || 0), 0)
      let stockFin: string | number = ''
      if (plan.ai_analysis?.closing_stock && Array.isArray(plan.ai_analysis.closing_stock)) {
        stockInicio = plan.ai_analysis.closing_stock.reduce((s: number, r: any) => s + (Number(r.initial) || 0), 0)
        if (plan.status === 'COMPLETED') {
          stockFin = plan.ai_analysis.closing_stock.reduce((s: number, r: any) => s + (Number(r.final) || 0), 0)
        }
      } else if (plan.status === 'COMPLETED' && stockInicio > 0) {
        stockFin = stockInicio
      }
      const desvio = actualDays !== '' && Number(plannedDays) > 0 ? Number(actualDays) - Number(plannedDays) : ''
      return [
        plan.paddocks?.name || '',
        herdNames,
        st,
        fmtCsv(plan.entry_date),
        fmtCsv(plan.actual_entry_date),
        fmtCsv(plan.exit_date),
        fmtCsv(plan.actual_exit_date),
        plannedDays,
        actualDays,
        stockInicio || '',
        stockFin,
        plan.exit_dry_matter_kg_ha || '',
        desvio !== '' ? (Number(desvio) > 0 ? `+${desvio}` : desvio) : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })

    const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `plan-${sp.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Plan ${sp.name} exportado`)
  }

  // Export histórico de pastoreo como CSV (client-side)
  const handleExportHistory = () => {
    const headers = [
      'Potrero', 'Rodeos', 'Estado',
      'Entrada plan', 'Entrada real', 'Salida plan', 'Salida real',
      'Días plan', 'Días reales', 'Stock inicio', 'Stock fin',
      'Remanente (kg MS/ha)', 'Desvío (días)',
    ]
    const fmtCsv = (d: string | null | undefined) =>
      d ? new Date(d + 'T12:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

    const rows = filteredPlans.map(plan => {
      const pHerds = herds.filter(h => (plan.herd_ids?.length ? plan.herd_ids : plan.herd_id ? [plan.herd_id] : []).includes(h.id))
      const herdNames = pHerds.map(h => h.name).join(' / ')
      const st = STATUS_MAP[plan.status]?.label || plan.status
      const plannedDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : (plan.planned_recovery_days || '')
      const effectiveEntry = plan.actual_entry_date || (plan.status === 'COMPLETED' ? plan.entry_date : null)
      const actualDays = (effectiveEntry && plan.actual_exit_date) ? daysBetween(effectiveEntry, plan.actual_exit_date) : ''
      let stockInicio = pHerds.reduce((s, h) => s + (Number(h.animal_count || h.head_count) || 0), 0)
      let stockFin: string | number = ''
      if (plan.ai_analysis?.closing_stock && Array.isArray(plan.ai_analysis.closing_stock)) {
        stockInicio = plan.ai_analysis.closing_stock.reduce((s: number, r: any) => s + (Number(r.initial) || 0), 0)
        if (plan.status === 'COMPLETED') {
          stockFin = plan.ai_analysis.closing_stock.reduce((s: number, r: any) => s + (Number(r.final) || 0), 0)
        }
      } else if (plan.status === 'COMPLETED' && stockInicio > 0) {
        stockFin = stockInicio
      }
      const desvio = actualDays !== '' && Number(plannedDays) > 0 ? Number(actualDays) - Number(plannedDays) : ''
      return [
        plan.paddocks?.name || '',
        herdNames,
        st,
        fmtCsv(plan.entry_date),
        fmtCsv(plan.actual_entry_date),
        fmtCsv(plan.exit_date),
        fmtCsv(plan.actual_exit_date),
        plannedDays,
        actualDays,
        stockInicio || '',
        stockFin,
        plan.exit_dry_matter_kg_ha || '',
        desvio !== '' ? (Number(desvio) > 0 ? `+${desvio}` : desvio) : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
    })

    const csv = [headers.map(h => `"${h}"`).join(';'), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `historial-pastoreo-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`${filteredPlans.length} registros exportados`)
  }

  const handleDrawEnd = useCallback((paddockId: string, entryDate: string, exitDate: string) => {
    // NO se desactiva el drawing mode — modo continuo "lápiz en mano"
    // Chequeo de solapamiento físico — solo contra planes del mismo track (plan_type)
    const hasOverlap = plans.some(p =>
      p.paddock_id === paddockId &&
      (p.plan_type || 'manual') === activeGanttTab &&
      p.entry_date < exitDate &&
      (p.exit_date || addDays(p.entry_date, 14)) > entryDate
    )
    if (hasOverlap) {
      toast.error('Ya existe una planificación en ese rango de fechas para este potrero.')
      return
    }

    // Calcular riesgo de sobrepastoreo para este potrero con los rodeos seleccionados
    const paddock = paddocks.find((p: any) => p.id === paddockId)
    const msHa = Number(paddock?.dry_matter_kg_ha) || 0
    const areaHa = Number(paddock?.area_ha) || 0
    // ── EV CORRECTO: usar total_ev de BD, no la proyección fisiológica ──────────
    // obtenerEvRodeoParaFecha() recalcula el EV con PHYSIO_EV_BASE que diverge del
    // total_ev real (ej: Novillito=0.58 → 182 EV en lugar de 337 EV reales).
    // total_ev ya contiene el EV calibrado y validado por el usuario.
    const drawingEV = drawingHerdIds.reduce((sum: number, hId: string) => {
      const h = herds.find((hh: any) => hh.id === hId)
      if (!h) return sum
      return sum + (Number(h.total_ev) || 0)
    }, 0)
    const usableMs = msHa > 0 ? calculateUsableForage(msHa, targetRemnant, areaHa) : -1
    const dailyDemand = drawingEV * dailyAllocationKg
    const optDays = (msHa > 0 && dailyDemand > 0) ? calculateGrazingDays(usableMs, dailyDemand) : -1
    const requestedDays = daysBetween(entryDate, exitDate)

    // Si el potrero tiene datos de MS pero optDays === 0 (sin pasto suficiente): mostrar aviso de riesgo
    if (msHa > 0 && optDays === 0) {
      setOvergrazingRisk({
        paddockId,
        entryDate,
        exitDate,
        paddockName: paddock?.name || 'Potrero',
        optDays: 0,
        requestedDays,
      })
      return
    }

    // Cerrar cualquier quickConfirm anterior y abrir uno nuevo
    setQuickConfirm(null)
    setTimeout(() => {
      // Estimar posición del popover en el centro de la pantalla (fallback seguro)
      setQuickConfirm({
        paddockId,
        entryDate,
        exitDate,
        anchorX: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
        anchorY: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
      })
    }, 0)
  }, [plans, activeGanttTab, paddocks, herds, drawingHerdIds, targetRemnant, dailyAllocationKg])


  // Guardar plan directamente desde el QuickConfirm (sin modal)
  const handleQuickSave = useCallback(async () => {
    if (!quickConfirm) return
    setSavingQuick(true)
    try {
      const payload = {
        paddock_id: quickConfirm.paddockId,
        herd_id: drawingHerdIds[0] || null,
        herd_ids: drawingHerdIds,
        entry_date: quickConfirm.entryDate,
        exit_date: quickConfirm.exitDate,
        actual_entry_date: null,
        actual_exit_date: null,
        planned_recovery_days: 60,
        status: 'PLANNED',
        ai_analysis: { plan_source: 'manual', season_plan_id: activeSeasonPlanId || null },
        season_plan_id: activeSeasonPlanId || null,
      }
      const res = await apiFetch('/api/grazing-plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('Planificación guardada')
      setQuickConfirm(null)
      loadData()
    } catch {
      toast.error('Error al guardar. Intentá de nuevo.')
    } finally {
      setSavingQuick(false)
    }
  }, [quickConfirm, drawingHerdIds, activeSeasonPlanId, loadData])

  // Esc key handler — desactiva modo dibujo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawingMode) {
        setDrawingMode(false)
        setQuickConfirm(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawingMode])

  // KPIs
  const activePlans    = plans.filter(p => p.status === 'ACTIVE').length
  const plannedPlans   = plans.filter(p => p.status === 'PLANNED').length
  const restingPaddocks = paddocks.filter(p => p.current_status === 'RESTING').length

  // Color map for herds (stable)
  const herdColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    herds.forEach((h, i) => { map[h.id] = HERD_COLORS[i % HERD_COLORS.length] })
    return map
  }, [herds])

  // ── Mapas de color e identidad para planificaciones sugeridas (gradiente púrpura) ──
  const seasonPlanColorMap = useMemo(() => {
    const map: Record<string, number> = {}
    // Ordenar por start_date para asignación estable de índices
    const sorted = [...seasonPlans].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
    sorted.forEach((sp, i) => { map[sp.id] = i })
    return map
  }, [seasonPlans])

  const seasonPlanNames = useMemo(() => {
    const map: Record<string, string> = {}
    seasonPlans.forEach(sp => { map[sp.id] = sp.name || 'Plan sugerido' })
    return map
  }, [seasonPlans])

  // ── Season Plan Modal state ────────────────────────────────────────────────
  const [showSeasonPlan, setShowSeasonPlan] = useState(false)
  const [seasonPlanToEdit, setSeasonPlanToEdit] = useState<any>(null)
  const [showExcelImporter, setShowExcelImporter] = useState(false)

  // ── Paddock toggle (enable/disable) desde el Gantt ──
  const handlePaddockToggle = useCallback(async (paddockId: string, isActive: boolean) => {
    if (!isActive) {
      // Show prompt before disabling
      setDisablePaddockPrompt({ paddockId });
      return;
    }

    // Si se está habilitando, procedemos directo
    // Optimistic update
    setPaddocks((prev: any[]) => prev.map(p => p.id === paddockId ? { ...p, is_active: isActive } : p))
    try {
      await apiFetch(`/api/paddocks/${paddockId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive })
      })
    } catch {
      // Revert on failure
      setPaddocks((prev: any[]) => prev.map(p => p.id === paddockId ? { ...p, is_active: !isActive } : p))
      toast.error('No se pudo actualizar el estado del potrero')
    }
  }, [])

  const executeDisablePaddock = async (paddockId: string, comment: string) => {
    // Optimistic update
    setPaddocks((prev: any[]) => prev.map(p => p.id === paddockId ? { ...p, is_active: false } : p))
    try {
      await apiFetch(`/api/paddocks/${paddockId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false })
      })

      if (comment.trim()) {
        const paddock = paddocks.find((p: any) => p.id === paddockId);
        await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: paddockId,
            title: `Potrero inhabilitado: ${paddock?.name || ''}`,
            content: comment.trim(),
            note_type: 'TEXT',
            tags: ['potrero_inhabilitado'],
          })
        });
      }
    } catch {
      // Revert on failure
      setPaddocks((prev: any[]) => prev.map(p => p.id === paddockId ? { ...p, is_active: true } : p))
      toast.error('No se pudo actualizar el estado del potrero')
    } finally {
      setDisablePaddockPrompt(null);
    }
  }

  // ── Comentarios en bloques de planificación ──
  const handleAddComment = useCallback(async (planId: string, text: string, authorEmail: string) => {
    const plan = plans.find((p: any) => p.id === planId)
    if (!plan) return
    const newComment = {
      id: crypto.randomUUID(),
      text: text.trim(),
      author_email: authorEmail,
      created_at: new Date().toISOString()
    }
    const existingComments = Array.isArray(plan.ai_analysis?.comments) ? plan.ai_analysis.comments : []
    const updatedAnalysis = { ...(plan.ai_analysis || {}), comments: [...existingComments, newComment] }
    // Optimistic update
    setPlans((prev: any[]) => prev.map(p => p.id === planId ? { ...p, ai_analysis: updatedAnalysis } : p))
    try {
      // 1. Guardar en el bloque de planificación
      await apiFetch(`/api/grazing-plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ai_analysis: updatedAnalysis })
      })
      // 2. Guardar también en el historial de Registros del potrero (field-notes)
      if (plan.paddock_id) {
        const paddock = paddocks.find((p: any) => p.id === plan.paddock_id)
        const noteTitle = `Comentario Gantt — ${plan.entry_date ? new Date(plan.entry_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Plan'}`
        await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: plan.paddock_id,
            title: noteTitle,
            content: text.trim(),
            note_type: 'TEXT',
            tags: ['comentario_gantt'],
          })
        })
      }
    } catch {
      // Revert on failure
      setPlans((prev: any[]) => prev.map(p => p.id === planId ? { ...p, ai_analysis: plan.ai_analysis } : p))
      toast.error('No se pudo guardar el comentario')
    }
  }, [plans, paddocks])


  // ── History Tab Actions ───────────────────────────────────────────────────
  const handleDeleteSeasonPlan = async (id: string, name: string) => {
    const ok = await confirm({
      title: `¿Eliminar el plan "${name}"?`,
      description: 'Se borrarán todos los movimientos del Gantt asociados a esta planificación. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await apiFetch(`/api/season-plans/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Error al eliminar el plan de temporada.')
        return
      }
      toast.success('Plan de temporada eliminado')
      loadData()
    } catch (e) {
      toast.error('Error de red al intentar eliminar.')
    }
  }

  const handleViewInGantt = (plan: any) => {
    let focusDate = plan.start_date
    if (!focusDate) {
      focusDate = plan.year ? `${plan.year}-01-01` : new Date().toISOString().split('T')[0]
    }
    setGanttWindow(focusDate)
    setActiveSeasonPlanId(plan.id)
    // If the plan is from suggested mode, switch track accordingly
    if (plan.source === 'suggested') {
      setActiveGanttTab('suggested')
    }
    setViewMode('gantt')
  }

  // Gantt window navigation
  const shiftGantt = (weeks: number) => {
    const d = new Date(ganttWindow + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    setGanttWindow(d.toISOString().split('T')[0])
  }

  const ganttEnd = addDays(ganttWindow, WINDOW_DAYS)
  const ganttStartLabel = fmt(ganttWindow)
  const ganttEndLabel = fmt(ganttEnd)

  // ── Metrics Row Data ──
  const dashboardMetricsData = useMemo<DashboardMetricsData>(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    
    // Total forage mass
    const totalMs = paddocks.reduce((sum, p) => {
      const msHa = Number(p.dry_matter_kg_ha) || (Number(p.estimated_adh) || 0) * 66 || 0
      return sum + msHa * (Number(p.area_ha) || 0)
    }, 0)
    
    // Total instantaneous EV
    const totalEV = herds.reduce((sum, h) => sum + getDynamicHerdEV(h, todayStr, farmEvents), 0)
    
    // Average Quality (1-10) — weighted by paddock area for biological accuracy
    let qWeightedSum = 0, qAreaSum = 0
    paddocks.forEach(p => {
      const q    = Number(p.technical_data?.relative_quality || p.technical_data?.quality_score)
      const area = Number(p.area_ha) || 0
      if (!isNaN(q) && q > 0 && area > 0) {
        qWeightedSum += q * area
        qAreaSum     += area
      }
    })
    const avgQuality = qAreaSum > 0 ? qWeightedSum / qAreaSum : null
    
    // Target Recovery
    let targetRecoveryDays = 60
    if (weather?.currentSeason === 'SUMMER') targetRecoveryDays = 40
    if (weather?.currentSeason === 'SPRING') targetRecoveryDays = 45
    if (weather?.currentSeason === 'AUTUMN') targetRecoveryDays = 65
    if (weather?.currentSeason === 'WINTER') targetRecoveryDays = 92
    
    return { totalMs, totalEV, avgQuality, targetRecoveryDays }
  }, [paddocks, herds, farmEvents, weather])

  return (
    <>
      <ConfirmModal />
      <div className="space-y-5 pb-10 overscroll-x-none">
        <OnboardingTour
          tourId="tour-planificador-v1"
          steps={[
            {
              target: '.tour-planificador-modo',
              title: 'Modos de Planificación',
              content: 'Intercala entre el modo Manual libre o el modo Sugerido, donde la IA propone un recorrido óptimo.'
            },
            {
              target: '.tour-planificador-vista',
              title: 'Vistas del Planificador',
              content: 'Alterná entre el gráfico de Gantt interactivo, la vista de Lista detallada, o el Historial completo.'
            },
            {
              target: '.tour-planificador-nuevo',
              title: 'Nueva Planificación',
              content: 'Iniciá una nueva planificación para asignar rodeos a los potreros o usar el trazado inteligente.'
            }
          ]}
        />

      {/* ─── Header simplificado ─── */}
      <div className="space-y-2">

        {/* Row 1: Modo Dropdown */}
        <div className="relative inline-block shrink-0">
            <button
              onClick={() => setShowGanttModeDropdown(v => !v)}
              className="tour-planificador-modo group flex items-center justify-between gap-4 px-4 py-2 bg-white border border-gray-200 shadow-sm hover:shadow hover:border-gray-300 rounded-2xl transition-all duration-200"
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" />
                  Modo de planificación
                </span>
                <h1 className="text-sm font-black tracking-tight text-gray-950 leading-none">
                  {activeGanttTab === 'suggested' ? 'Planificación Sugerida' : 'Planificación Manual'}
                </h1>
              </div>
              <div className="w-6 h-6 rounded-full bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100 transition-colors">
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                  className={`transition-transform duration-200 text-gray-700 ${showGanttModeDropdown ? 'rotate-180' : ''}`}
                ><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </button>

            {showGanttModeDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowGanttModeDropdown(false)} />
                <div className="absolute left-0 right-0 sm:right-auto top-full mt-2 z-50 min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                  {/* Manual */}
                  <button
                    onClick={() => {
                      setActiveGanttTab('manual')
                      setActiveSeasonPlanId(null)
                      setDrawingMode(false)
                      setDrawingHerdIds([])
                      setShowSeasonPlan(false)
                      setSeasonPlanToEdit(null)
                      setShowGanttModeDropdown(false)
                    }}
                    className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 ${activeGanttTab === 'manual' ? 'bg-gray-50' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-800">Planificación Manual</p>
                      <p className="text-xs text-gray-500 mt-0.5">Planificación libre y seguimiento operativo</p>
                    </div>
                    {activeGanttTab === 'manual' && (
                      <svg className="ml-auto mt-1 shrink-0 text-gray-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                  <div className="h-px bg-gray-100" />
                  {/* Suggested */}
                  <button
                    onClick={() => {
                      setActiveGanttTab('suggested')
                      setDrawingMode(false)
                      setDrawingHerdIds([])
                      setShowSeasonPlan(false)
                      setSeasonPlanToEdit(null)
                      setShowGanttModeDropdown(false)
                    }}
                    className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 ${activeGanttTab === 'suggested' ? 'bg-gray-50' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-800">Planificación Sugerida</p>
                      <p className="text-xs text-gray-500 mt-0.5">Recorrido óptimo geográfico e inteligente</p>
                    </div>
                    {activeGanttTab === 'suggested' && (
                      <svg className="ml-auto mt-1 shrink-0 text-purple-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                </div>
              </>
            )}
        </div>

        {/* Row 2: Nombre del plan activo */}
        {activeSeasonPlanId && viewMode === 'gantt' && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Nombre del plan:</span>
            <span className="text-[11px] font-bold text-gray-800 bg-gray-100/80 px-2 py-0.5 rounded-md truncate max-w-[240px]">
              {seasonPlans.find(sp => sp.id === activeSeasonPlanId)?.name || 'Plan Forrajero'}
            </span>
          </div>
        )}

        {/* Row 3: Controls bar — all on one line */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* LEFT side: Season filters + trash + eye + csv (only in gantt mode) */}
          {viewMode === 'gantt' && (
            <div className={`flex items-center gap-1.5 shrink-0 ${drawingMode ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
                <button
                  onClick={() => setSeasonalFilters(['abierta', 'cerrada'])}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    seasonalFilters.length === 2
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Anual
                </button>
                <div className="w-[1px] bg-gray-200 mx-0.5" />
                <button
                  onClick={() => setSeasonalFilters(['abierta'])}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    seasonalFilters.length === 1 && seasonalFilters.includes('abierta')
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Temporada abierta
                </button>
                <button
                  onClick={() => setSeasonalFilters(['cerrada'])}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    seasonalFilters.length === 1 && seasonalFilters.includes('cerrada')
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Temporada cerrada
                </button>
              </div>

              {/* Borrar planificadas */}
              {(() => {
                const tabPlansToDelete = plans.filter(p =>
                  p.status === 'PLANNED' &&
                  (activeGanttTab === 'suggested'
                    ? (p.plan_type === 'suggested' || p.ai_analysis?.plan_source === 'suggested')
                    : (p.plan_type !== 'suggested' && p.ai_analysis?.plan_source !== 'suggested')
                  )
                )
                if (tabPlansToDelete.length === 0) return null
                return (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={saving}
                    title={`Eliminar ${tabPlansToDelete.length} planificaciones ${activeGanttTab === 'suggested' ? 'sugeridas' : 'manuales'}`}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              })()}

              {/* Toggles de Capas Visuales */}
              <div className="relative">
                <button
                  ref={(el) => { if (el) (el as any).__layersBtnRef = el }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    (window as any).__layersBtnRect = rect
                    setShowLayersPanel(p => !p)
                  }}
                  title="Visibilidad de capas"
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs font-bold transition-all ${
                    showLayersPanel ? 'bg-green-50 text-green-700 border-green-200' : 'text-gray-400 hover:text-green-600 hover:bg-green-50 border-transparent hover:border-green-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {showLayersPanel && typeof document !== 'undefined' && createPortal(
                  <>
                    <div className="fixed inset-0 z-[9000]" onClick={() => setShowLayersPanel(false)} />
                    <div
                      className="fixed w-60 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-[9001] animate-in fade-in zoom-in-95 duration-150"
                      style={{
                        top: ((window as any).__layersBtnRect?.bottom ?? 0) + 8,
                        right: Math.max(8, window.innerWidth - ((window as any).__layersBtnRect?.right ?? 0)),
                      }}
                    >
                      <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Capas Visibles</span>
                        </div>
                      </div>
                      <div className="py-2">
                        {[
                          { key: 'showOriginal', label: 'Plan Original',            striped: true,  color: '#22c55e', extraKey: null },
                          { key: 'showPlanned',  label: 'Plan Modificable/Sugerido', striped: true,  color: '#38bdf8', extraKey: null },
                          { key: 'showReal',     label: 'Plan Real',                striped: false, color: '#22c55e', extraKey: null },
                          { key: 'showEvents',   label: 'Eventos',                  striped: false, color: '#8b5cf6', extraKey: 'showAgenda' as keyof typeof ganttLayers },
                          { key: 'showRemnant',  label: 'Alerta Sin Remanente',     striped: false, color: '#ef4444', extraKey: null },
                          { key: 'showAnimals',  label: 'Panel de Animales',        striped: false, color: '#eab308', extraKey: null },
                        ].map(layer => {
                          const active = ganttLayers[layer.key as keyof typeof ganttLayers] ||
                            (layer.extraKey ? ganttLayers[layer.extraKey] : false)
                          const dotStyle = active
                            ? layer.striped
                              ? { background: `repeating-linear-gradient(45deg, ${layer.color}, ${layer.color} 2px, transparent 2px, transparent 5px)`, border: `1.5px solid ${layer.color}` }
                              : { backgroundColor: layer.color }
                            : { backgroundColor: '#d1d5db' }
                          return (
                            <button
                              key={layer.key}
                              onClick={() => {
                                toggleGanttLayer(layer.key as keyof typeof ganttLayers)
                                if (layer.extraKey) toggleGanttLayer(layer.extraKey)
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${active ? '' : 'opacity-50'}`}
                            >
                              <span
                                className="w-3 h-3 rounded-sm shrink-0 transition-all"
                                style={dotStyle}
                              />
                              <span className={`flex-1 text-[12px] font-bold transition-colors ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                                {layer.label}
                              </span>
                              <div className={`w-7 h-3.5 rounded-full transition-colors relative shrink-0 ${active ? 'bg-green-500' : 'bg-gray-200'}`}>
                                <div className={`absolute top-0.5 bottom-0.5 w-2.5 bg-white rounded-full transition-all shadow-sm ${active ? 'left-[14px]' : 'left-0.5'}`} />
                              </div>
                            </button>
                          )
                        })}
                        <div className="mx-4 my-1 border-t border-gray-100" />
                        <button
                          onClick={toggleClimateView}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${climateViewEnabled ? '' : 'opacity-50'}`}
                        >
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={climateViewEnabled ? { backgroundColor: '#10b981' } : { backgroundColor: '#d1d5db' }}
                          />
                          <span className={`flex-1 text-[12px] font-bold ${climateViewEnabled ? 'text-gray-800' : 'text-gray-400'}`}>
                            Ajuste Climático
                          </span>
                          <div className={`w-7 h-3.5 rounded-full relative shrink-0 ${climateViewEnabled ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                            <div className={`absolute top-0.5 bottom-0.5 w-2.5 bg-white rounded-full transition-all shadow-sm ${climateViewEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                          </div>
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>

              {/* Exportar CSV */}
              <button
                onClick={handleExportHistory}
                title="Exportar planificaciones como CSV"
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg border border-transparent hover:border-green-100 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* RIGHT side: View toggle + Planificar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle: Gantt / Lista / Historial */}
            <div className="tour-planificador-vista bg-white border border-gray-200 rounded-xl p-1 flex items-center shadow-sm gap-0.5 shrink-0">
              {[
                { id: 'gantt',   Icon: CalendarDays, label: 'Gantt'     },
                { id: 'list',    Icon: AlignJustify,  label: 'Lista'     },
                { id: 'history', Icon: HistoryIcon,   label: 'Historial' },
              ].map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === id ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* + Planificar button */}
            <div className="relative shrink-0">
              <button
                onClick={async () => {
                  if (activeGanttTab === 'suggested') {
                    const existingSuggested = plans.filter(p =>
                      p.plan_type === 'suggested' || p.ai_analysis?.plan_source === 'suggested'
                    )
                    if (existingSuggested.length > 0) {
                      const sameSheet = await confirm({
                        title: '¿Agregar a la planificación actual?',
                        description: `Ya tenés ${existingSuggested.length} bloques de planificación sugerida en el Gantt. ¿Querés agregar la nueva planificación en la misma hoja (conviven visualmente) o limpiar y empezar de cero?`,
                        confirmLabel: 'Misma hoja',
                        cancelLabel: 'Nueva hoja',
                        variant: 'primary',
                      })
                      if (sameSheet === null) {
                        return
                      }
                      if (sameSheet === false) {
                        setSaving(true)
                        try {
                          await apiFetch('/api/grazing-plans/bulk-delete?status=PLANNED&plan_type=suggested', { method: 'DELETE' })
                          setPlans(prev => prev.filter(p => !(p.status === 'PLANNED' && (p.plan_type === 'suggested' || p.ai_analysis?.plan_source === 'suggested'))))
                          setActiveSeasonPlanId(null)
                        } catch { /* continua aunque falle */ }
                        setSaving(false)
                      } else {
                        const recentSuggested = seasonPlans.find(sp => sp.source === 'suggested' && sp.status !== 'COMPLETED')
                        if (recentSuggested) {
                          setSeasonPlanToEdit(recentSuggested)
                        }
                      }
                    }
                    setShowSeasonPlan(true)
                  } else {
                    const recentManualPlans = seasonPlans.filter(sp => sp.source !== 'suggested' && sp.status !== 'COMPLETED')
                    
                    if (recentManualPlans.length > 0) {
                      const planIdToContinue = activeSeasonPlanId || recentManualPlans[0].id
                      const planName = seasonPlans.find(p => p.id === planIdToContinue)?.name || 'Plan Forrajero'
                      const continueCurrent = await confirm({
                        title: '¿Continuar plan o empezar uno nuevo?',
                        description: `Tenés un plan en curso: ${planName}. ¿Querés continuar agregando trazados a este plan o preferís empezar uno desde cero?`,
                        confirmLabel: 'Continuar actual',
                        cancelLabel: 'Nueva hoja',
                        variant: 'success',
                      })
                      if (continueCurrent === null) {
                        return
                      }
                      if (continueCurrent) {
                        setActiveSeasonPlanId(planIdToContinue)
                        setViewMode('gantt')
                        setShowContinuePlanModal(true)
                      } else {
                        // Nueva hoja: abrir SeasonPlanModal para crear un plan nuevo
                        setActiveSeasonPlanId(null)
                        setSeasonPlanToEdit(null)
                        setViewMode('gantt')
                        setShowSeasonPlan(true)
                      }
                    } else {
                      setShowSeasonPlan(true)
                    }
                  }
                }}
                disabled={loading}
                className={`tour-planificador-nuevo flex items-center gap-2 px-4 py-2 text-white font-bold text-sm rounded-xl shadow-sm transition-all disabled:opacity-50 ${
                  activeGanttTab === 'suggested'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : (drawingMode ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700')
                }`}
              >
                <Plus className="w-4 h-4" /> Planificar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Aviso contextual si faltan datos (no bloquea, solo informa) */}
      {!loading && (paddocks.length === 0 || herds.length === 0) && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 font-medium flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {paddocks.length === 0 && herds.length === 0
              ? <>Todavía no tenés <Link href="/dashboard/mi-campo" className="underline decoration-amber-300 hover:text-amber-900 transition-colors">potreros</Link> ni <Link href="/dashboard/herds" className="underline decoration-amber-300 hover:text-amber-900 transition-colors">rodeos</Link> cargados. Completá la información en las secciones correspondientes para empezar.</>
              : paddocks.length === 0
              ? <>Sin <Link href="/dashboard/mi-campo" className="underline decoration-amber-300 hover:text-amber-900 transition-colors">potreros</Link> configurados. Agregálos para calcular la oferta forrajera.</>
              : <>Sin <Link href="/dashboard/herds" className="underline decoration-amber-300 hover:text-amber-900 transition-colors">rodeos</Link> configurados. Agregálos para calcular la demanda.</>
            }
          </span>
        </div>
      )}

      {/* DRAWING MODE BANNER — barra sticky superior con rodeos seleccionados */}
      {drawingMode && activeGanttTab === 'manual' && (
        <div className="sticky top-0 z-[100] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-md text-gray-900 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-2 border-green-500 animate-in fade-in slide-in-from-top-2 duration-200 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center animate-pulse shrink-0">
              <span className="text-xs font-black text-green-700">✏</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900">
                Modo Pastoreo Activo
                {drawingHerdIds.length > 0 && (
                  <span className="ml-1.5 text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md text-[11px] font-bold">
                    {herds.filter((h: any) => drawingHerdIds.includes(h.id)).map((h: any) => h.name).join(', ')}
                  </span>
                )}
              </p>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5 hidden sm:block">Arrastrá en el calendario para crear pastoreos. <strong className="text-gray-700">Debés "Terminar Pastoreo" para poder editar otras planificaciones.</strong></p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowContinuePlanModal(true)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 border border-gray-200"
            >
              Cambiar rodeos
            </button>
            <button
              onClick={() => { setDrawingMode(false); setQuickConfirm(null) }}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[11px] font-black transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              Terminar ✓
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      ) : plans.length === 0 && viewMode === 'gantt' && !drawingMode ? (
        <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 360 }}>
          {/* Gantt borroso de fondo */}
          <div className="pointer-events-none select-none" style={{ filter: 'blur(3px)', opacity: 0.4 }}>
            <InteractiveGantt
              plans={[]}
              paddocks={paddocks}
              herds={herds}
              farmEvents={[]}
              movements={[]}
              windowStart={ganttWindow}
              windowDays={WINDOW_DAYS}
              onBlockClick={() => {}}
              onBlockMove={() => {}}
              rainfallData={rainfallData}
              onRainfallChange={() => {}}
              weatherEvents={weatherEvents}
              droughtThresholdMm={droughtThresholdMm}
              onDroughtThresholdChange={() => {}}
              targetRemnant={targetRemnant}
              dailyAllocationKg={dailyAllocationKg}
              climateViewEnabled={false}
              paddockCAdj={paddockCAdj}
              isDrawingMode={false}
              ganttLayers={ganttLayers}
            />
          </div>
          {/* Overlay centrado */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/60 backdrop-blur-sm">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-gray-100">
              <Calendar className="w-7 h-7 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-gray-950">Sin planificaciones aún</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeGanttTab === 'suggested'
                  ? 'Generá un plan sugerido con recorrido inteligente de potreros.'
                  : 'Seleccioná tus rodeos y empezá a trazar el primer pastoreo.'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowSeasonPlan(true)
              }}
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-3 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 ${
                activeGanttTab === 'suggested'
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              <Plus className="w-4 h-4" />
              {activeGanttTab === 'suggested' ? 'Generar Plan Sugerido' : 'Comenzar a planificar'}
            </button>
          </div>
        </div>
      ) : viewMode === 'gantt' ? (
        <div className="space-y-3">

          {/* ─── ALERTAS DE MOVIMIENTO INMINENTE ─────────────────────────── */}
          {(() => {
            const today = new Date(); today.setHours(0,0,0,0)
            const urgentPlans = plans.filter(p => {
              if (p.status === 'COMPLETED') return false
              if (!p.exit_date) return false
              const exit = new Date(p.exit_date + 'T00:00:00')
              const diff = Math.ceil((exit.getTime() - today.getTime()) / 86400000)
              return diff <= 1
            })
            if (urgentPlans.length === 0) return null
            return (
              <div className="mx-4 mb-3 space-y-1.5">
                {urgentPlans.map(p => {
                  const paddock = paddocks.find((pd: any) => pd.id === p.paddock_id)
                  const exit = new Date(p.exit_date + 'T00:00:00')
                  const diff = Math.ceil((exit.getTime() - today.getTime()) / 86400000)
                  const isOverdue = diff < 0
                  const isToday   = diff === 0
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all hover:shadow-sm ${
                        isOverdue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                      onClick={() => {
                        setCloseForm({
                          actual_entry_date: p.actual_entry_date || p.entry_date || new Date().toISOString().split('T')[0],
                          actual_exit_date: new Date().toISOString().split('T')[0],
                          exit_dry_matter_kg_ha: '',
                          exit_notes: '',
                          closing_stock: herds
                            .filter((h: any) => (p.herd_ids || []).includes(h.id))
                            .map((h: any) => ({
                              herd_id: h.id,
                              name: h.name,
                              initial: Number(h.animal_count || h.head_count) || 0,
                              final: Number(h.animal_count || h.head_count) || 0,
                            })),
                        })
                        setClosePlanModal({ plan: p })
                      }}
                    >
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
                      <span>
                        {isOverdue
                          ? `¡Potrero ${paddock?.name || '?'} — los animales debieron salir hace ${Math.abs(diff)} día(s)!`
                          : isToday
                            ? `Potrero ${paddock?.name || '?'} — los animales salen HOY`
                            : `Potrero ${paddock?.name || '?'} — mañana hay que mover los animales`
                        }
                      </span>
                      <span className="ml-auto shrink-0 underline">Finalizar →</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <InteractiveGantt
            plans={filteredPlans}
            paddocks={paddocks}
            herds={herds}
            activeSeasonPlan={seasonPlans.find(sp => sp.id === activeSeasonPlanId) || null}
            farmEvents={farmEvents}
            movements={movements}
            windowStart={ganttWindow}
            windowDays={WINDOW_DAYS}

            onDeleteEvent={setEventToDelete}
            onBlockClick={(plan, evt) => {
              if (evt) {
                const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect()
                setPlanPopover({ plan, x: rect.left + rect.width / 2, y: rect.bottom + 8 })
              } else {
                setPlanPopover({ plan, x: window.innerWidth / 2, y: window.innerHeight / 2 })
              }
            }}
            onBlockMove={handleBlockMove}
            rainfallData={rainfallData}
            onRainfallChange={handleRainfallChange}
            weatherEvents={weatherEvents}
            onPaddockClick={(paddockId) => {
              router.push(`/dashboard/mi-campo?editPaddock=${paddockId}&returnTo=/dashboard/grazing`)
            }}
            droughtThresholdMm={droughtThresholdMm}
            onDroughtThresholdChange={handleDroughtThresholdChange}
            targetRemnant={targetRemnant}
            dailyAllocationKg={dailyAllocationKg}
            climateViewEnabled={climateViewEnabled}
            paddockCAdj={paddockCAdj}
            paddockAAdj={paddockAAdj}
            isDrawingMode={drawingMode}
            onDrawEnd={(paddockId, startDate, endDate) => {
              handleDrawEnd(
                paddockId,
                new Date(startDate).toISOString().split('T')[0],
                new Date(endDate).toISOString().split('T')[0]
              )
            }}
            onHerdUpdate={(herdId, updates) => {
              setHerds((prev: any[]) => prev.map(h => h.id === herdId ? { ...h, ...updates } : h))
            }}
            onEditEvent={(evt) => {
              setNewEventForm({
                date: evt.event_date || '',
                end_date: evt.end_date || '',
                title: evt.title || '',
                event_type: evt.event_type || 'servicio',
                notes: evt.description || '',
              })
              setEditingEventId(evt.id || null)
              setShowNewEventModal(true)
            }}
            onAddHerd={(tipo) => {
              setAddHerdForm(f => ({ ...f, is_temporary: tipo === 'temporal' }))
              setShowNewHerdUnifiedModal(true)
            }}
            onHerdClick={(herd) => setEditingGanttHerd(herd as HerdData)}
            paddockOrder={activeGanttTab === 'suggested' ? suggestedPaddockOrder : customPaddockOrder}
            onPaddockReorder={activeGanttTab === 'manual' ? handlePaddockReorder : undefined}
            seasonPlanColorMap={seasonPlanColorMap}
            seasonPlanNames={seasonPlanNames}
            ganttLayers={ganttLayers}
            onPaddockToggle={handlePaddockToggle}
            drawingHerdEV={(() => {
              // ── EV CORRECTO: usa total_ev de BD, no la proyección fisiológica ──
              // obtenerEvRodeoParaFecha() recalcula el EV con PHYSIO_EV_BASE que diverge
              // del total_ev real del usuario (ej: Novillito factor=0.58 → 182 EV en
              // lugar de 337 EV reales). total_ev ya incluye peso y categoría correctos.
              return herds
                .filter((h: any) => drawingHerdIds.includes(h.id))
                .reduce((s: number, h: any) => s + (Number(h.total_ev) || 0), 0)
            })()}
            drawingHerdsLabel={herds
              .filter((h: any) => drawingHerdIds.includes(h.id))
              .map((h: any) => h.name)
              .join(', ')
            }
            bioMilestones={bioMilestones}
          />


        </div>


      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          {(() => {
            // Derive season info from filteredPlans
            const allDates = filteredPlans.flatMap(p => [p.entry_date, p.exit_date].filter(Boolean))
            const seasonStart = allDates.length > 0 ? allDates.reduce((a, b) => a < b ? a : b) : null
            const seasonEnd   = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : null
            const seasonType  = seasonalFilters.length === 2 ? 'Anual'
              : seasonalFilters.includes('abierta') ? 'Temporada abierta'
              : 'Temporada cerrada'
            const seasonColor = seasonalFilters.length === 1 && seasonalFilters.includes('abierta')
              ? 'text-green-700 bg-green-50 border-green-200'
              : seasonalFilters.length === 1 && seasonalFilters.includes('cerrada')
              ? 'text-blue-700 bg-blue-50 border-blue-200'
              : 'text-gray-600 bg-gray-100 border-gray-200'
            const fmtShort = (d: string | null) => d
              ? new Date(d + 'T12:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : null
            return (
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/50 flex-wrap">
                {/* Left: count + season */}
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-black text-gray-700">{filteredPlans.length} planificaciones</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${seasonColor}`}>
                      {seasonType}
                    </span>
                    {seasonStart && seasonEnd && (
                      <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                        {fmtShort(seasonStart)} → {fmtShort(seasonEnd)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Right: export buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 hover:border-green-300 hover:text-green-700 transition-all shadow-sm"
                  >
                    <Download className="w-3 h-3" /> Exportar CSV
                  </button>
                </div>
              </div>
            )
          })()}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Potrero / Rodeo', 'Ha', 'Estado', 'Entrada', 'Salida', 'Días', 'Descanso', 'EV'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.map(plan => {
                  const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
                  const pHerds = herds.filter(h => plan.herd_ids?.includes(h.id))
                  const herdNames = pHerds.length > 0 ? pHerds.map(h => h.name).join(', ') : 'Rodeo desconocido'
                  const totalEv = pHerds.reduce((s, h) => s + Number(h.total_ev || 0), 0)
                  const color = herdColorMap[plan.herd_ids?.[0]] || '#9ca3af'
                  const days = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : null
                  const todayStr = new Date().toISOString().split('T')[0]
                  const isRowActive = plan.status === 'ACTIVE' || (plan.entry_date <= todayStr && plan.status !== 'COMPLETED')
                  return (
                    <tr
                      key={plan.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      style={isRowActive ? { borderLeft: '3px solid #D4A373' } : undefined}
                      onClick={() => handleOpenModal(plan)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{plan.paddocks?.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 max-w-[150px] truncate">{herdNames}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-gray-600 tabular-nums whitespace-nowrap">
                        {Number(plan.paddocks?.area_ha || 0).toFixed(1)} <span className="text-gray-400 font-normal text-[10px]">ha</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-700 font-medium tabular-nums">{fmt(plan.entry_date)}</td>
                      <td className="px-5 py-4 text-xs text-gray-700 font-medium tabular-nums">{plan.exit_date ? fmt(plan.exit_date) : '—'}</td>
                      <td className="px-5 py-4 text-sm font-black text-gray-900">{days ?? '—'}<span className="text-[10px] font-normal text-gray-400 ml-1">d</span></td>
                      <td className="px-5 py-4 text-sm font-bold text-green-700">{plan.planned_recovery_days}<span className="text-[10px] font-normal text-gray-400 ml-1">d</span></td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-600">{Number(totalEv).toFixed(1)}</td>
                    </tr>
                  )
                })}
                {filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">
                      No hay planificaciones que coincidan con la búsqueda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="space-y-4">

          {/* Temporadas históricas (season_plans) */}
          {seasonPlans.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/40">
                <div>
                  <h3 className="text-sm font-black text-gray-950">Planes de temporada</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Planes históricos · {seasonPlans.length} temporada{seasonPlans.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {/* TODO: Excel import — temporalmente deshabilitado
                <button
                  onClick={() => setShowExcelImporter(true)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 hover:text-green-700 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Importar otro
                </button>
                */}
              </div>
              <div className="divide-y divide-gray-100">
                {[...seasonPlans]
                  .sort((a, b) => b.year - a.year)
                  .map(sp => (
                  <div key={sp.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${sp.source === 'suggested' ? 'bg-purple-500' : 'bg-green-500'}`} />
                          <p className="text-sm font-bold text-gray-900">{sp.name}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {sp.year} · {sp.season_type === 'cerrado' ? 'Plan cerrado' : 'Plan abierto'}
                          {sp.total_ha ? ` · ${Number(sp.total_ha).toFixed(0)} ha` : ''}
                          {sp.source === 'excel_import' ? ' · Excel' : ''}
                          <span className="mx-1">·</span>
                          {sp.source === 'suggested' ? 'Sugerida' : 'Manual'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        {sp.demand_snapshot?.total_ev && (
                          <p className="text-xs font-bold text-gray-700">
                            {Number(sp.demand_snapshot.total_ev).toFixed(1)} EV
                          </p>
                        )}
                        {sp.start_date && (
                          <p className="text-[9px] text-gray-400 font-medium">
                            {sp.start_date} → {sp.end_date || '—'}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {sp.start_date || !sp.metrics?.raw_table ? (
                          <button
                            onClick={() => handleViewInGantt(sp)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded shadow-sm hover:bg-gray-200 hover:text-gray-900 transition-colors"
                          >
                            Ver en Gantt
                          </button>
                        ) : (
                          <button
                            onClick={() => setRawTablePlan(sp)}
                            className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 text-[10px] font-bold rounded shadow-sm hover:bg-green-100 transition-colors"
                          >
                            Ver Planilla
                          </button>
                        )}
                        <button
                          onClick={() => handleExportSeasonPlan(sp)}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-[10px] font-bold rounded shadow-sm hover:border-green-300 hover:text-green-700 transition-colors flex items-center gap-1.5"
                          title="Descargar CSV del plan"
                        >
                          <Download className="w-3 h-3" /> CSV
                        </button>
                        <button
                          onClick={() => handleDeleteSeasonPlan(sp.id, sp.name)}
                          className="px-2 py-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 outline-none text-[10px] font-bold rounded transition-colors"
                          title="Eliminar registro y limpiar movimientos asociados"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Movimientos históricos de pastoreo */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-sm font-black text-gray-950">Registro histórico de pastoreo</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Consulta trazabilidad real vs. planificada</p>
              </div>
              <div className="text-[10px] font-bold text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                {filteredPlans.length} registros
              </div>
              {/* Exportar botones */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 p-1 rounded-xl mr-2">
                  <button
                    onClick={() => setHistoryTab('all')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${historyTab === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setHistoryTab('suggested')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${historyTab === 'suggested' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-purple-600'}`}
                  >
                    Sugeridas
                  </button>
                  <button
                    onClick={() => setHistoryTab('manual')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${historyTab === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Manuales
                  </button>
                </div>
                <button
                  onClick={handleExportHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 hover:border-green-300 hover:text-green-700 transition-all shadow-sm"
                >
                  <Download className="w-3 h-3" /> Exportar CSV
                </button>
              </div>
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Potrero / Rodeo', 'Estado', 'Entrada plan', 'Entrada real', 'Salida plan', 'Salida real', 'Días plan', 'Días reales', 'Raciones Totales', 'Rac. Disp.', '% Uso', 'Stock inicio', 'Stock fin', 'Remanente', 'Desvío vs plan', 'Comentarios'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.map(plan => {
                  const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
                  const pHerds = herds.filter(h => plan.herd_ids?.includes(h.id))
                  const herdNames = pHerds.length > 0 ? pHerds.map(h => h.name).join(', ') : 'Rodeo desconocido'
                  const color = herdColorMap[plan.herd_ids?.[0]] || '#9ca3af'

                  // Días plan: usar exit_date si existe, sino planned_recovery_days
                  const plannedDays = plan.exit_date
                    ? daysBetween(plan.entry_date, plan.exit_date)
                    : (plan.planned_recovery_days || 0)

                  // Días reales: si no hay actual_entry_date, usar entry_date como proxy
                  const effectiveEntry = plan.actual_entry_date || (plan.status === 'COMPLETED' ? plan.entry_date : null)
                  const actualDays = (effectiveEntry && plan.actual_exit_date)
                    ? daysBetween(effectiveEntry, plan.actual_exit_date)
                    : null

                  const daysDev = actualDays !== null && plannedDays > 0 ? (actualDays - plannedDays) : 0
                  const hasDeviation = daysDev !== 0

                  // Stock: suma de cabezas de los rodeos asignados
                  let stockInicio = pHerds.reduce((s, h) => s + (Number(h.animal_count || h.head_count) || 0), 0)
                  let stockFinVal: number | null = null

                  const isCompletedPlan = plan.status === 'COMPLETED'
                  if (plan.ai_analysis?.closing_stock && Array.isArray(plan.ai_analysis.closing_stock)) {
                    stockInicio = plan.ai_analysis.closing_stock.reduce((s: number, r: any) => s + (Number(r.initial) || 0), 0)
                    if (isCompletedPlan) {
                      stockFinVal = plan.ai_analysis.closing_stock.reduce((s: number, r: any) => s + (Number(r.final) || 0), 0)
                    }
                  } else if (isCompletedPlan) {
                    stockFinVal = stockInicio
                  }

                  const dailyAllocationKg = Number(plan.daily_allocation_kg) || 12
                  const targetDays = actualDays !== null ? actualDays : plannedDays
                  const racionesTotales = (() => {
                    if (targetDays <= 0) return 0
                    const startDateStr = effectiveEntry || plan.entry_date
                    if (!startDateStr) return 0
                    const dStart = new Date(startDateStr + 'T12:00:00')
                    const evData = projectEVDemand(pHerds, dailyAllocationKg, 'otono', 12, dStart)
                    const current = new Date(dStart)
                    let totalRaciones = 0
                    for (let i = 0; i < targetDays; i++) {
                      const mDiff = (current.getFullYear() - dStart.getFullYear()) * 12 + (current.getMonth() - dStart.getMonth())
                      const evRecord = evData[mDiff]
                      const dailyRacion = evRecord ? evRecord.dailyDemandKg : (pHerds.reduce((s, h) => s + Number(h.total_ev), 0) * dailyAllocationKg)
                      totalRaciones += dailyRacion
                      current.setDate(current.getDate() + 1)
                    }
                    return totalRaciones
                  })()

                  const usableForage = (() => {
                    const pad = paddocks.find(p => p.id === plan.paddock_id)
                    if (!pad) return 0
                    const targetRemnant = Number(plan.target_remnant_kg_ha) || 400
                    const area = Number(pad.area_ha) || 0
                    const msStart = plan.ai_analysis?.supply_snapshot?.by_paddock?.[pad.id]?.dry_matter_kg_ha 
                      || plan.entry_dry_matter_kg_ha 
                      || Number(pad.dry_matter_kg_ha) || 0
                    
                    return Math.max(0, (msStart - targetRemnant) * area)
                  })()

                  const usoPct = usableForage > 0 ? (racionesTotales / usableForage) * 100 : 0

                  return (
                    <tr
                      key={plan.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (isCompletedPlan) {
                          // Abrir mini-modal de corrección de fecha real
                          setCloseForm({
                            actual_entry_date: plan.actual_entry_date || plan.entry_date || new Date().toISOString().split('T')[0],
                            actual_exit_date: plan.actual_exit_date || plan.exit_date || new Date().toISOString().split('T')[0],
                            exit_dry_matter_kg_ha: plan.exit_dry_matter_kg_ha?.toString() || '',
                            exit_notes: plan.exit_notes || '',
                            closing_stock: herds
                              .filter((h: any) => (plan.herd_ids?.length ? plan.herd_ids : plan.herd_id ? [plan.herd_id] : []).includes(h.id))
                              .map((h: any) => ({
                                herd_id: h.id,
                                name: h.name,
                                initial: Number(h.animal_count || h.head_count) || 0,
                                final: plan.ai_analysis?.closing_stock?.find((s: any) => s.herd_id === h.id)?.final
                                  ?? Number(h.animal_count || h.head_count) ?? 0,
                              })),
                          })
                          setClosePlanModal({ plan })
                        } else {
                          handleOpenModal(plan)
                        }
                      }}
                    >
                      {/* Potrero / Rodeo */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${plan.plan_type === 'suggested' || plan.ai_analysis?.plan_source === 'suggested' ? 'bg-purple-500' : 'bg-green-500'}`} />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{plan.paddocks?.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 max-w-[150px] truncate">{herdNames}</p>
                          </div>
                        </div>
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </td>
                      {/* Entrada plan */}
                      <td className="px-4 py-3.5 text-xs font-medium tabular-nums text-gray-500">
                        {plan.entry_date ? fmt(plan.entry_date) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Entrada real */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {effectiveEntry ? (
                          <span className={`font-bold ${
                            plan.entry_date && effectiveEntry !== plan.entry_date ? 'text-amber-700' : 'text-gray-900'
                          }`}>{fmt(effectiveEntry)}</span>
                        ) : (
                          <span className="text-gray-300 text-[10px]">No reg.</span>
                        )}
                      </td>
                      {/* Salida plan */}
                      <td className="px-4 py-3.5 text-xs font-medium tabular-nums text-gray-500">
                        {plan.exit_date ? fmt(plan.exit_date) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Salida real */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {plan.actual_exit_date ? (
                          <span className={`font-bold ${
                            plan.exit_date && plan.actual_exit_date !== plan.exit_date ? 'text-amber-700' : 'text-gray-900'
                          }`}>{fmt(plan.actual_exit_date)}</span>
                        ) : (
                          <span className="text-gray-300 text-[10px]">No reg.</span>
                        )}
                      </td>
                      {/* Días plan */}
                      <td className="px-4 py-3.5 text-xs tabular-nums text-gray-500">
                        {plannedDays > 0 ? <><span className="font-bold">{plannedDays}</span> <span className="text-gray-400">d</span></> : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Días reales */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {actualDays !== null
                          ? <><span className="font-black text-gray-900">{actualDays}</span> <span className="text-[10px] text-gray-400">d</span></>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Raciones Totales */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {racionesTotales > 0
                          ? <span className="font-bold text-gray-700">{Math.round(racionesTotales).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">kg</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Rac. Disp. */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {usableForage > 0
                          ? <span className="font-bold text-gray-700">{Math.round(usableForage).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">kg</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* % Uso */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {usoPct > 0
                          ? <span className={`font-black ${usoPct > 100 ? 'text-red-600' : 'text-blue-600'}`}>{Math.round(usoPct)}%</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Stock inicio */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {stockInicio > 0
                          ? <span className="font-bold text-gray-700">{stockInicio} <span className="text-[10px] text-gray-400 font-normal">cab.</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Stock fin */}
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        {stockFinVal !== null
                          ? <span className={`font-bold ${stockFinVal !== stockInicio ? 'text-amber-700' : 'text-gray-700'}`}>{stockFinVal} <span className="text-[10px] text-gray-400 font-normal">cab.</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Remanente */}
                      <td className="px-4 py-3.5">
                        {plan.exit_dry_matter_kg_ha ? (
                          <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                            {plan.exit_dry_matter_kg_ha} <span className="text-[9px] text-green-600 font-medium">kg MS/ha</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                      {/* Desvío */}
                      <td className="px-4 py-3.5">
                        {hasDeviation ? (
                          <span className={`text-xs font-bold ${
                            daysDev > 2 ? 'text-amber-700' : daysDev < -1 ? 'text-green-700' : 'text-gray-600'
                          }`}>
                            {daysDev > 0 ? '+' : ''}{daysDev} d
                          </span>
                        ) : actualDays !== null ? (
                          <span className="text-xs font-bold text-green-600">= plan</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      {/* Comentarios */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        {plan.exit_notes ? (
                          <span className="text-xs text-gray-600 italic leading-tight line-clamp-2">{plan.exit_notes}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">
                      No hay registros históricos que coincidan con la búsqueda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* ─── MINI POPOVER: Info del bloque planificado ────────────────────── */}
      {planPopover && (() => {
        const plan = plans.find((p: any) => p.id === planPopover.plan.id) || planPopover.plan
        const paddock = paddocks.find((p: any) => p.id === plan.paddock_id) || plan.paddocks
        // Season plan padre (solo para planificaciones sugeridas con season_plan_id)
        const parentSeasonPlan = plan.ai_analysis?.season_plan_id
          ? seasonPlans.find((sp: any) => sp.id === plan.ai_analysis.season_plan_id)
          : null
        const isSuggestedPlanPopover = plan.ai_analysis?.plan_source === 'suggested' || plan.plan_type === 'suggested'
        const cycleHerdIds = plan.ai_analysis?.cycle_all_herd_ids
        // Para planes sugeridos: mostrar ÚNICAMENTE los rodeos de este bloque específico,
        // no todos los rodeos del ciclo (cycle_all_herd_ids).
        const displayHerdIds = isSuggestedPlanPopover
          ? (Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0
              ? plan.herd_ids
              : plan.herd_id ? [plan.herd_id] : [])
          : (cycleHerdIds?.length > 0 ? cycleHerdIds : (plan.herd_ids || [plan.herd_id]))
        const planHerds = herds.filter((h: any) => displayHerdIds.includes(h.id))
        const planDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : null
        const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
        return (
          <>
            <div className="fixed inset-0 z-[9990]" onClick={() => setPlanPopover(null)} />
            <div
              className="fixed z-[9991] bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 overflow-y-auto"
              style={{
                left: Math.min(planPopover.x - 160, window.innerWidth - 328),
                top: Math.min(planPopover.y, window.innerHeight - 520),
                maxHeight: `${window.innerHeight - Math.min(planPopover.y, window.innerHeight - 520) - 16}px`,
              }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Nombre del plan de temporada padre (solo sugeridas) */}
                  {parentSeasonPlan && isSuggestedPlanPopover && (
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-0.5 truncate">
                      {parentSeasonPlan.name}
                    </p>
                  )}
                  <p className="text-xl font-black text-gray-950 leading-tight">{paddock?.name || '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{Number(paddock?.area_ha || 0).toFixed(1)} ha</p>
                    {plan.is_locked && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Original
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1 ${st.bg} ${st.color}`}>{st.label}</span>
              </div>

              {/* TRACK 1: Plan Original — solo si is_locked */}
              {plan.is_locked && (
                <div className="px-5 py-3 border-b border-gray-50 bg-green-50/30">
                  <p className="text-[9px] font-black text-green-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Plan Original
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Entrada</p><p className="text-xs font-bold text-gray-900">{fmt(plan.entry_date)}</p></div>
                    <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Salida</p><p className="text-xs font-bold text-gray-900">{fmt(plan.exit_date)}</p></div>
                    <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Estadía</p><p className="text-xs font-bold text-gray-900">{planDays ? `${planDays}d` : '—'}</p></div>
                  </div>
                  {planHerds.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {planHerds.map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-gray-700">{h.name}</span>
                          <span className="text-[10px] font-bold text-gray-600">{h.animal_count || h.head_count || 0} cab.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TRACK 2: Plan Planificado / Modificado */}
              {(() => {
                const hasAdjusted = plan.is_locked && plan.adjusted_entry_date
                if (plan.status === 'COMPLETED' && !hasAdjusted) return null
                const adjEntry = hasAdjusted ? plan.adjusted_entry_date : plan.entry_date
                const adjExit  = hasAdjusted ? plan.adjusted_exit_date  : plan.exit_date
                const adjDays  = adjEntry && adjExit ? daysBetween(adjEntry, adjExit) : planDays
                return (
                  <div className={`px-5 py-3 border-b border-gray-50 ${isSuggestedPlanPopover && parentSeasonPlan ? 'bg-purple-50/20' : 'bg-sky-50/20'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: isSuggestedPlanPopover && parentSeasonPlan ? '#7c3aed' : '#0369a1' }}>
                      {hasAdjusted ? 'Plan Modificable' : plan.is_locked ? 'Plan Modificable' : (isSuggestedPlanPopover && parentSeasonPlan ? parentSeasonPlan.name : 'Plan Planificado')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Entrada</p><p className="text-xs font-bold text-gray-900">{fmt(adjEntry)}</p></div>
                      <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Salida</p><p className="text-xs font-bold text-gray-900">{adjExit ? fmt(adjExit) : '—'}</p></div>
                      <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Estadía</p><p className="text-xs font-bold text-gray-900">{adjDays ? `${adjDays}d` : '—'}</p></div>
                    </div>
                    {!plan.is_locked && planHerds.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {planHerds.map((h: any) => (
                          <div key={h.id} className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-gray-700">{h.name}</span>
                            <span className="text-[10px] font-bold text-gray-600">{h.animal_count || h.head_count || 0} cab.</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(plan.ai_analysis?.history) && plan.ai_analysis.history.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-sky-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Historial</p>
                        {plan.ai_analysis.history.slice(-3).map((h: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[9px] text-gray-500">
                            <span>{fmt(h.changed_at || h.date)}</span>
                            <span>{fmt(h.entry_date)} → {fmt(h.exit_date)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Stock log de rodeos: ajustes manuales desde las tablas */}
                    {(() => {
                      const planEntry = plan.adjusted_entry_date || plan.entry_date
                      const planExit  = plan.adjusted_exit_date  || plan.exit_date
                      const allLogs = planHerds.flatMap((h: any) => {
                        const logs: any[] = Array.isArray(h.technical_data?.stock_log) ? h.technical_data.stock_log : []
                        return logs
                          .filter(l => {
                            if (!planEntry || !planExit) return true
                            return (!l.date || (l.date >= planEntry && l.date <= planExit))
                          })
                          .map(l => ({ ...l, herdName: h.name }))
                      })
                      if (allLogs.length === 0) return null
                      return (
                        <div className="mt-2 pt-2 border-t border-sky-100">
                          <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mb-1.5">Ajustes de stock</p>
                          <div className="space-y-1">
                            {allLogs.slice(-5).map((l: any, i: number) => (
                              <div key={i} className="flex items-start justify-between gap-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${l.delta > 0 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
                                  {l.delta > 0 ? `+${l.delta}` : l.delta}
                                </span>
                                <span className="text-[9px] text-gray-500 flex-1 leading-tight">{l.note || (l.delta > 0 ? `Se agregaron ${Math.abs(l.delta)} animales` : `Se retiraron ${Math.abs(l.delta)} animales`)}</span>
                                <span className="text-[9px] font-bold text-gray-400 shrink-0">{l.total} cab.</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* TRACK 3: Plan Real — solo si completado */}
              {plan.status === 'COMPLETED' && (
                <div className="px-5 py-3 border-b border-gray-50 bg-green-50/40">
                  <p className="text-[9px] font-black text-green-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Plan Real
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Entrada real</p><p className="text-xs font-bold text-green-800">{fmt(plan.actual_entry_date || plan.entry_date)}</p></div>
                    <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Salida real</p><p className="text-xs font-bold text-green-800">{fmt(plan.actual_exit_date || plan.exit_date)}</p></div>
                    <div><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Estadía</p><p className="text-xs font-bold text-green-800">{daysBetween(plan.actual_entry_date || plan.entry_date, plan.actual_exit_date || plan.exit_date)}d</p></div>
                  </div>
                  {planHerds.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Stock cierre</p>
                      {planHerds.map((h: any) => {
                        const cs = plan.ai_analysis?.closing_stock?.find((s: any) => s.herd_id === h.id)
                        return (
                          <div key={h.id} className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-gray-700">{h.name}</span>
                            <span className="text-[10px] font-bold text-green-800">{cs?.final ?? (h.animal_count || h.head_count || 0)} cab.</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {plan.exit_dry_matter_kg_ha != null && (
                    <div className="mt-2 pt-2 border-t border-green-100 flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">MS remanente</span>
                      <span className="text-[10px] font-bold text-green-800">{Number(plan.exit_dry_matter_kg_ha).toLocaleString('es')} kg/ha</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {(() => {
                const today = new Date()
                today.setHours(0,0,0,0)
                const exitDate  = plan.exit_date  ? new Date(plan.exit_date  + 'T00:00:00') : null
                const daysUntilExit = exitDate ? Math.ceil((exitDate.getTime() - today.getTime()) / 86400000) : null
                const isCompleted = plan.status === 'COMPLETED'
                const isSuggested = plan.ai_analysis?.plan_source === 'suggested'
                const isOverdue  = exitDate && exitDate <= today && !isCompleted
                const isUrgent   = daysUntilExit !== null && daysUntilExit <= 1 && !isCompleted
                return (
                  <div className="px-5 pb-4 pt-3 space-y-2">
                    {isUrgent && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                        isOverdue ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {isOverdue ? '¡Los animales deberían haberse movido!' : 'Mañana hay que mover los animales'}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {!isCompleted ? (
                        <>
                          <button
                            onClick={() => {
                              setPlanPopover(null)
                              setCloseForm({
                                actual_entry_date: plan.actual_entry_date || plan.entry_date || new Date().toISOString().split('T')[0],
                                actual_exit_date: new Date().toISOString().split('T')[0],
                                exit_dry_matter_kg_ha: '',
                                exit_notes: '',
                                closing_stock: herds
                                  .filter((h: any) => (plan.herd_ids?.length ? plan.herd_ids : plan.herd_id ? [plan.herd_id] : []).includes(h.id))
                                  .map((h: any) => ({ herd_id: h.id, name: h.name, initial: Number(h.animal_count || h.head_count) || 0, final: Number(h.animal_count || h.head_count) || 0 })),
                              })
                              setClosePlanModal({ plan })
                            }}
                            className="flex-1 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> Finalizar pastoreo
                          </button>
                          {!isSuggested && (
                           <button onClick={() => {
                            setPlanPopover(null)
                            if (plan.is_locked) {
                              // Plan Original — readonly modal (abrir en modo lectura)
                              handleOpenModal(plan)
                            } else {
                              handleOpenModal(plan)
                            }
                          }} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all border border-gray-200 text-xs font-bold">
                            Editar
                          </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setPlanPopover(null)
                            setCloseForm({
                              actual_entry_date: plan.actual_entry_date || plan.entry_date || new Date().toISOString().split('T')[0],
                              actual_exit_date: plan.actual_exit_date || plan.exit_date || new Date().toISOString().split('T')[0],
                              exit_dry_matter_kg_ha: plan.exit_dry_matter_kg_ha?.toString() || '',
                              exit_notes: plan.exit_notes || '',
                              closing_stock: herds
                                .filter((h: any) => (plan.herd_ids?.length ? plan.herd_ids : plan.herd_id ? [plan.herd_id] : []).includes(h.id))
                                .map((h: any) => ({ herd_id: h.id, name: h.name, initial: Number(h.animal_count || h.head_count) || 0, final: plan.ai_analysis?.closing_stock?.find((s: any) => s.herd_id === h.id)?.final ?? Number(h.animal_count || h.head_count) ?? 0 })),
                            })
                            setClosePlanModal({ plan })
                          }}
                          className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                        >
                          Ver / corregir cierre
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: '¿Eliminar esta planificación?', description: 'El bloque de pastoreo será eliminado del Gantt.', confirmLabel: 'Eliminar', variant: 'danger' })
                          if (!ok) return
                          try {
                            const res = await apiFetch(`/api/grazing-plans/${plan.id}`, { method: 'DELETE' })
                            if (res.ok) { setPlans((prev: any[]) => prev.filter(p => p.id !== plan.id)); setPlanPopover(null); toast.success('Planificación eliminada') }
                            else { const err = await res.json().catch(() => ({ error: 'Error' })); toast.error(err.error || 'No se pudo eliminar') }
                          } catch(e: any) { toast.error(e.message) }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {!isCompleted && !plan.is_locked && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await apiFetch(`/api/grazing-plans/${plan.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_locked: true }),
                            })
                            if (res.ok) {
                              setPlans((prev: any[]) => prev.map(p => p.id === plan.id ? { ...p, is_locked: true } : p))
                              setPlanPopover(null)
                              toast.success('Plan bloqueado como original')
                            }
                          } catch (err) {
                            console.error(err)
                          }
                        }}
                        className="w-full py-1.5 mt-2 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-bold border border-gray-200 hover:bg-gray-100 transition-all flex items-center justify-center"
                      >
                        🔒 Fijar como planificación original
                      </button>
                    )}

                    {/* ── Sección de Comentarios ── */}
                    <PlanCommentsSection
                      plan={plan}
                      userEmail={user?.email || 'usuario'}
                      onAddComment={handleAddComment}
                    />

                  </div>
                )
              })()}
            </div>
          </>
        )
      })()}

      {/* ─── MODAL: Finalizar Pastoreo ──────────────────────────────────────── */}
      {closePlanModal && typeof document !== 'undefined' && createPortal(
        (() => {
          const plan = closePlanModal.plan
          const paddock = paddocks.find((p: any) => p.id === plan.paddock_id)
          const planHerds = herds.filter((h: any) => (plan.herd_ids || [plan.herd_id]).includes(h.id))
          const planDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : null
          const isAlreadyCompleted = plan.status === 'COMPLETED'
          return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
  
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-2 shrink-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isAlreadyCompleted ? 'bg-amber-500' : 'bg-green-500'}`} />
                      <h3 className="text-base font-black text-gray-950">
                        {isAlreadyCompleted ? 'Corregir datos de cierre' : 'Finalizar pastoreo'}
                      </h3>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                      {paddock?.name || '—'} · {Number(paddock?.area_ha || 0).toFixed(1)} ha
                    </p>
                  </div>
                  <button onClick={() => setClosePlanModal(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
  
                {/* Plan summary — scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  {/* Summary Box */}
                  <div className="px-5 py-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Entrada plan</p>
                        <p className="text-sm font-bold text-gray-700">{plan.entry_date ? new Date(plan.entry_date + 'T12:00').toLocaleDateString('es', { day:'2-digit', month:'2-digit' }) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Salida plan</p>
                        <p className="text-sm font-bold text-gray-700">{plan.exit_date ? new Date(plan.exit_date + 'T12:00').toLocaleDateString('es', { day:'2-digit', month:'2-digit' }) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Estadía plan</p>
                        <p className="text-sm font-bold text-gray-700">{planDays ? `${planDays}d` : '—'}</p>
                      </div>
                    </div>
                    {planHerds.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {planHerds.map((h: any) => (
                          <span key={h.id} className="text-[10px] font-bold px-2 py-0.5 bg-white rounded-lg border border-gray-200 text-gray-600">
                            {h.name} · {h.animal_count || h.head_count || '?'} cab.
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
  
                  {/* Recordatorio de salida */}
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <Camera className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">Registro en campo</p>
                      <p className="text-xs text-amber-800 mt-1">
                        No olvides registrar el remanente de pasto y tomar fotos (del pasto, condición corporal y animal) para nutrir el modelo IA.
                      </p>
                    </div>
                  </div>
  
                  {/* Form */}
                  <div className="grid grid-cols-2 gap-4 border border-gray-100 rounded-xl p-4 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    {/* Fecha real de entrada */}
                    <div className="space-y-1.5">
                      <p className="text-sm font-black text-gray-950">Entrada real *</p>
                      <input
                        type="date"
                        value={closeForm.actual_entry_date}
                        onChange={e => setCloseForm(prev => ({ ...prev, actual_entry_date: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      />
                    </div>
  
                    {/* Fecha real de salida */}
                    <div className="space-y-1.5">
                      <p className="text-sm font-black text-gray-950">Salida real *</p>
                      <input
                        type="date"
                        value={closeForm.actual_exit_date}
                        onChange={e => setCloseForm(prev => ({ ...prev, actual_exit_date: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      />
                    </div>
                  </div>
  
                  {/* Remanente MS */}
                  <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div>
                      <p className="text-sm font-black text-gray-950">Remanente de pasto (kg MS/ha)</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Pasto que quedó en pie al terminar el pastoreo. Dato clave para validar el remanente objetivo.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={50}
                        min={0}
                        value={closeForm.exit_dry_matter_kg_ha}
                        onChange={e => setCloseForm(prev => ({ ...prev, exit_dry_matter_kg_ha: e.target.value }))}
                        placeholder="Ej: 800"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-gray-300"
                      />
                    </div>
                  </div>
  
                  {/* Stock de cierre */}
                  {closeForm.closing_stock.length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black text-gray-950">Stock de cierre</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Ajustá las cabezas de cierre si hubo bajas, nacimientos o compras.</p>
                        </div>
                        <span className="text-[9px] text-gray-400 font-medium">Inicio → Fin</span>
                      </div>
                      <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                        {closeForm.closing_stock.map((row, idx) => {
                          const diff = row.final - row.initial
                          return (
                            <div key={row.herd_id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                              {/* Nombre rodeo */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">{row.name}</p>
                                <p className="text-[10px] text-gray-400">{row.initial} cab. al inicio</p>
                              </div>
                              {/* Flecha */}
                              <span className="text-gray-300 text-xs">→</span>
                              {/* Input final */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.final}
                                  onChange={e => setCloseForm(prev => ({
                                    ...prev,
                                    closing_stock: prev.closing_stock.map((r, i) =>
                                      i === idx ? { ...r, final: Number(e.target.value) } : r
                                    ),
                                  }))}
                                  className="w-20 text-sm font-bold text-center bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                                />
                                <span className="text-[10px] text-gray-400">cab.</span>
                                {diff !== 0 && (
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                    diff > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                                  }`}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
  
                  {/* Observaciones */}
                  <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div>
                      <p className="text-sm font-black text-gray-950">Observaciones</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Opcional. Registra cualquier eventualidad en el pastoreo.</p>
                    </div>
                    <textarea
                      value={closeForm.exit_notes}
                      onChange={e => setCloseForm(prev => ({ ...prev, exit_notes: e.target.value }))}
                      placeholder="Registra cualquier eventualidad..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-gray-300 min-h-[80px]"
                    />
                  </div>
                </div> {/* end scrollable body */}
  
                {/* Footer */}
                <div className="p-5 border-t border-gray-100 flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setClosePlanModal(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!closeForm.actual_exit_date || !closeForm.actual_entry_date || savingClose}
                    onClick={async () => {
                      if (!closeForm.actual_exit_date || !closeForm.actual_entry_date) return
                      setSavingClose(true)
                      try {
                        const body: any = {
                          status: 'COMPLETED',
                          actual_entry_date: closeForm.actual_entry_date,
                          actual_exit_date: closeForm.actual_exit_date,
                        }
                        if (closeForm.exit_notes) {
                          body.exit_notes = closeForm.exit_notes
                        }
                        if (closeForm.exit_dry_matter_kg_ha) {
                          body.exit_dry_matter_kg_ha = Number(closeForm.exit_dry_matter_kg_ha)
                        }
                        if (closeForm.closing_stock.length > 0) {
                          body.ai_analysis = {
                            ...(plan.ai_analysis || {}),
                            closing_stock: closeForm.closing_stock.map(r => ({
                              herd_id: r.herd_id,
                              name: r.name,
                              initial: r.initial,
                              final: r.final,
                            })),
                          }
                        }
                        const res = await apiFetch(`/api/grazing-plans/${plan.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify(body),
                        })
                        if (res.ok) {
                          const updated = await res.json()
                          setPlans((prev: any[]) => prev.map(p => p.id === plan.id ? { ...p, ...body } : p))
                          setClosePlanModal(null)
                        } else {
                          const err = await res.json().catch(() => ({ error: 'Error' }))
                          toast.error(err.error || 'No se pudo guardar')
                        }
                      } catch(e: any) { toast.error(e.message) }
                      setSavingClose(false)
                    }}
                    className="flex-2 px-8 py-3 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {savingClose ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isAlreadyCompleted ? 'Actualizar' : 'Confirmar salida'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()
      , document.body)}

      {/* ─── MODAL: Confirmación de borrado masivo ──────────────────────────── */}
      {showDeleteConfirm && (() => {
        const plannedCount = plans.filter(p => p.status === 'PLANNED').length
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header rojo — acción crítica */}
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-black text-gray-950 mb-1">¿Borrar toda la planificación?</h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  Estás a punto de eliminar{' '}
                  <span className="font-black text-red-600">{plannedCount} planificación{plannedCount !== 1 ? 'es' : ''}</span>{' '}
                  proyectadas del Gantt. Esta acción <strong>no se puede deshacer</strong>.
                </p>
              </div>
              <div className="px-6 pb-6 flex flex-col gap-2">
                <button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const res = await apiFetch('/api/grazing-plans/bulk-delete?status=PLANNED', { method: 'DELETE' })
                      if (res.ok) {
                        const { deleted } = await res.json()
                        setPlans(prev => prev.filter(p => p.status !== 'PLANNED'))
                      } else {
                        toast.error('Error al eliminar las planificaciones. Intentá nuevamente.')
                      }
                    } catch(err) {
                      console.error(err)
                      toast.error('Error de conexión.')
                    } finally {
                      setSaving(false)
                      setShowDeleteConfirm(false)
                    }
                  }}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Sí, borrar {plannedCount} planificación{plannedCount !== 1 ? 'es' : ''}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all"
                >
                  Descartar — mantener la planificación
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── MODAL: Confirmación de borrado de Evento ───────────────────────── */}
      {eventToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-black text-gray-950 mb-1">¿Eliminar este evento?</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Estás a punto de eliminar el evento <span className="font-black text-red-600">"{eventToDelete.title}"</span> del {fmt(eventToDelete.event_date)}. Esta acción <strong>no se puede deshacer</strong>.
              </p>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2">
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  try {
                    const url = eventToDelete.isMovement
                      ? `/api/movements/${eventToDelete.id}`
                      : `/api/farm-events/${eventToDelete.id}`
                    const res = await apiFetch(url, { method: 'DELETE' })
                    if (res.ok) {
                      toast.success('Evento eliminado correctamente')
                      // Update local state immediately (optimistic)
                      if (eventToDelete.isMovement) {
                        setMovements(prev => prev.filter(m => m.id !== eventToDelete.id))
                      } else {
                        setFarmEvents(prev => prev.filter(e => e.id !== eventToDelete.id))
                      }
                      setEventToDelete(null)
                      // Full reload to ensure consistency
                      window.dispatchEvent(new Event('rodeo-data-reload'))
                    } else {
                      const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
                      toast.error(errData.error || 'Error al eliminar el evento. Intentá nuevamente.')
                    }
                  } catch(err) {
                    console.error(err)
                    toast.error('Error de conexión.')
                  } finally {
                    setSaving(false)
                  }
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sí, eliminar evento
              </button>
              <button
                onClick={() => setEventToDelete(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CONTINUE PLAN MODAL ─────────────────────────────────────────── */}
      {showContinuePlanModal && typeof document !== 'undefined' && (() => {
        const planToPass = activeSeasonPlanId ? seasonPlans.find(sp => sp.id === activeSeasonPlanId) : null
        if (!planToPass) return null
        return (
          <ContinuePlanModal
            plan={planToPass}
            herds={herds}
            initialHerdIds={drawingHerdIds}
            initialDailyAllocationKg={dailyAllocationKg}
            initialTargetRemnant={targetRemnant}
            onClose={() => setShowContinuePlanModal(false)}
            onContinue={(hIds, dAlloc, tRem) => {
              setDrawingHerdIds(hIds)
              setDailyAllocationKg(dAlloc)
              setTargetRemnant(tRem)
              setShowContinuePlanModal(false)
              setDrawingMode(true)
            }}
          />
        )
      })()}

      {/* ─── ALERTA: Riesgo de Sobrepastoreo ─────────────────────────────── */}
      {overgrazingRisk && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header — zona de peligro */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-xl font-black text-gray-950 mb-1">Sin pasto suficiente</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                El potrero <span className="font-black text-gray-800">{overgrazingRisk.paddockName}</span> no tiene
                biomasa disponible para este rodeo con el remanente objetivo actual.
              </p>
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-left">
                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Riesgo de sobrepastoreo</p>
                <p className="text-xs text-red-600 font-medium leading-relaxed">
                  Pastorear este potrero en las condiciones actuales puede dañarlo permanentemente.
                  Si aceptás el riesgo, igual podés crear el bloque.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2">
              <button
                onClick={() => {
                  // Confirmar a pesar del riesgo: abrir quickConfirm normalmente
                  const { paddockId, entryDate, exitDate } = overgrazingRisk
                  setOvergrazingRisk(null)
                  setTimeout(() => {
                    setQuickConfirm({
                      paddockId,
                      entryDate,
                      exitDate,
                      anchorX: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
                      anchorY: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
                    })
                  }, 0)
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                ⚠️ Entiendo el riesgo — continuar igual
              </button>
              <button
                onClick={() => setOvergrazingRisk(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar — no crear el bloque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK CONFIRM POPOVER ───────────────────────────────────────── */}
      {quickConfirm && (
        <div className="fixed inset-0 z-[9997] pointer-events-none">
          {/* Backdrop para cerrar al clickear fuera */}
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={() => setQuickConfirm(null)}
          />
          <div
            className="absolute pointer-events-auto"
            style={{
              left: Math.max(8, Math.min(quickConfirm.anchorX - 140, (typeof window !== 'undefined' ? window.innerWidth : 900) - 300)),
              top: Math.max(8, Math.min(quickConfirm.anchorY - 80, (typeof window !== 'undefined' ? window.innerHeight : 700) - 200)),
              width: 288,
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-90 duration-150">
              <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-[10px] font-black">✓</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Nuevo pastoreo</p>
                </div>
                <p className="text-sm font-black text-gray-950 mt-1.5">
                  {herds.filter((h: any) => drawingHerdIds.includes(h.id)).map((h: any) => h.name).join(' + ') || 'Rodeos seleccionados'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                  {(() => {
                    const e = new Date(quickConfirm.entryDate + 'T00:00:00')
                    const x = new Date(quickConfirm.exitDate + 'T00:00:00')
                    const days = Math.round((x.getTime() - e.getTime()) / 86400000)
                    const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                    return `${fmt(e)} → ${fmt(x)} · ${days} día${days !== 1 ? 's' : ''}`
                  })()}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {paddocks.find((p: any) => p.id === quickConfirm.paddockId)?.name || 'Potrero'}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setQuickConfirm(null)
                    setDrawingMode(false)
                    setFormData({
                      id: '',
                      paddock_id: quickConfirm.paddockId,
                      herd_ids: drawingHerdIds,
                      entry_date: quickConfirm.entryDate,
                      exit_date: quickConfirm.exitDate,
                      actual_entry_date: '',
                      actual_exit_date: '',
                      planned_recovery_days: 60,
                      status: 'PLANNED',
                    })
                    setIsModalOpen(true)
                  }}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Ampliar para editar
                </button>
                <button
                  onClick={handleQuickSave}
                  disabled={savingQuick}
                  className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-[11px] font-black transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-1"
                >
                  {savingQuick ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✓</span>}
                  {savingQuick ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Vista unificada ─────────────────────────── */}
      {isModalOpen && formData.id && (
        <PlanBlockModal
          plan={plans.find(p => p.id === formData.id) || formData}
          paddocks={paddocks}
          herds={herds}
          onClose={() => setIsModalOpen(false)}
          onSaved={(updatedPlan) => {
            loadData()
            setIsModalOpen(false)
          }}
        />
      )}
      {/* ── Modal: Crear Evento desde el Gantt ────────────────────────── */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-xl font-black text-gray-950">{editingEventId ? 'Editar evento' : 'Nuevo evento en agenda'}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Vinculado al Planificador</p>
              </div>
              <button onClick={() => setShowNewEventModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Fecha</label>
                <input
                  type="date"
                  value={newEventForm.date}
                  onChange={e => setNewEventForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Fecha hasta <span className="font-normal text-gray-400 normal-case">(opcional)</span></label>
                <input
                  type="date"
                  value={newEventForm.end_date}
                  min={newEventForm.date}
                  onChange={e => setNewEventForm(p => ({ ...p, end_date: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Título</label>
                <input
                  type="text"
                  value={newEventForm.title}
                  onChange={e => setNewEventForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ej: Cierre potrero Norte, Vacunación..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Tipo</label>
                <select
                  value={newEventForm.event_type}
                  onChange={e => setNewEventForm(p => ({ ...p, event_type: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                >
                  {Object.entries(EVT_CONFIG).filter(([key]) => !['mortandad', 'compra', 'venta', 'stock_inicial', 'ajuste_entrada', 'ajuste_salida', 'ajuste'].includes(key)).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              {/* Servicio: campos de toros */}
              {newEventForm.event_type === 'servicio' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-700 uppercase tracking-widest">N° Toros</label>
                    <input
                      type="number" min={0}
                      value={newEventForm.head_count_bulls ?? ''}
                      onChange={e => setNewEventForm(p => ({ ...p, head_count_bulls: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Ej: 62"
                      className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-700 uppercase tracking-widest">Peso toros (kg)</label>
                    <input
                      type="number" min={0}
                      value={newEventForm.avg_weight_bulls ?? ''}
                      onChange={e => setNewEventForm(p => ({ ...p, avg_weight_bulls: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Ej: 600"
                      className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 outline-none transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <p className="col-span-2 text-[9px] text-orange-500 font-medium">Estos datos se usan para calcular el EV de los toros en el Panel de Animales.</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Observaciones</label>
                <textarea
                  value={newEventForm.notes}
                  onChange={e => setNewEventForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowNewEventModal(false); setEditingEventId(null) }} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all">
                Cancelar
              </button>
              <button
                disabled={!newEventForm.title || !newEventForm.date || savingEvent}
                onClick={async () => {
                  if (!newEventForm.title || !newEventForm.date) return
                  setSavingEvent(true)
                  try {
                    const url = editingEventId ? `/api/farm-events/${editingEventId}` : '/api/farm-events'
                    const method = editingEventId ? 'PATCH' : 'POST'
                    const res = await apiFetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: newEventForm.title,
                        event_date: newEventForm.date,
                        end_date: newEventForm.end_date || newEventForm.date,
                        event_type: newEventForm.event_type,
                        description: newEventForm.notes,
                        ...(newEventForm.event_type === 'servicio' && newEventForm.avg_weight_bulls && {
                          metadata: {
                            head_count_bulls: newEventForm.head_count_bulls,
                            avg_weight_bulls: newEventForm.avg_weight_bulls,
                          }
                        }),
                      }),
                    })
                    if (res.ok) {
                      toast.success(editingEventId ? 'Evento actualizado' : 'Evento creado en la agenda')
                      setShowNewEventModal(false)
                      setEditingEventId(null)
                      setNewEventForm({ date: '', end_date: '', title: '', event_type: 'servicio', notes: '' })
                      // Refresh farm events
                      const evRes = await apiFetch('/api/farm-events')
                      if (evRes.ok) { const data = await evRes.json(); setFarmEvents(Array.isArray(data) ? data : data.events || []) }
                    } else {
                      const err = await res.json().catch(() => ({ error: 'Error' }))
                      toast.error(err.error || 'No se pudo guardar el evento')
                    }
                  } catch(e: any) { toast.error(e.message) }
                  setSavingEvent(false)
                }}
                className="flex-2 px-8 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {savingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingEventId ? 'Actualizar evento' : 'Guardar evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Crear/Editar rodeo desde Gantt (HerdModal unificado) ─────────── */}
      {(editingGanttHerd || showNewHerdUnifiedModal) && (
        <HerdModal
          herd={editingGanttHerd}
          allHerds={herds as HerdData[]}
          isTemporary={addHerdForm.is_temporary}
          onClose={() => {
            setEditingGanttHerd(null)
            setShowNewHerdUnifiedModal(false)
          }}
          onSaved={async () => {
            setEditingGanttHerd(null)
            setShowNewHerdUnifiedModal(false)
            const hRes = await apiFetch('/api/herds')
            if (hRes.ok) {
              const hData = await hRes.json()
              setHerds(Array.isArray(hData) ? hData : hData.herds || [])
            }
          }}
        />
      )}


      {/* ── Season Plan Modal (Sugerido y Manual) ───────── */}
      {showSeasonPlan && (
        <SeasonPlanModal
          key={activeGanttTab === 'suggested' ? 'suggested' : 'manual'}
          paddocks={paddocks}
          herds={herds}
          existingPlan={seasonPlanToEdit}
          isSuggestedMode={activeGanttTab === 'suggested'}
          bioMilestones={bioMilestones}
          onClose={() => {
            setShowSeasonPlan(false)
            setSeasonPlanToEdit(null)
            setDrawingMode(false)
            setDrawingHerdIds([])
          }}
          onSaved={(seasonPlan) => {
            setShowSeasonPlan(false)
            setSeasonPlanToEdit(null)
            setSeasonPlans(prev => {
              // Evitar duplicados si el plan ya existe
              const exists = prev.some(sp => sp.id === seasonPlan.id)
              return exists ? prev.map(sp => sp.id === seasonPlan.id ? seasonPlan : sp) : [seasonPlan, ...prev]
            })
            // NO filtrar por activeSeasonPlanId — todos los planes conviven en el mismo Gantt
            setActiveSeasonPlanId(seasonPlan.id || null)
            setGanttWindow(seasonPlan.start_date || new Date().toISOString().split('T')[0])
            setActiveGanttTab(activeGanttTab)
            setViewMode('gantt')
            
            if (activeGanttTab === 'suggested') {
              // Generar los bloques del ciclo para este plan sugerido
              handleGeneratePlanCycle(seasonPlan)
            } else {
              // En modo manual, activamos el trazado con los rodeos seleccionados
              const hIds = (seasonPlan as any).herd_ids || []
              if (hIds.length > 0) {
                setDrawingHerdIds(hIds)
                setDrawingMode(true)
                setQuickConfirm(null)
              }
            }
          }}
        />
      )}
      {/* ── Excel Importer Modal — temporalmente deshabilitado (TODO: reimplementar flujo completo)
      {showExcelImporter && (
        <ExcelImporter
          paddocks={paddocks}
          herds={herds}
          onClose={() => setShowExcelImporter(false)}
          onImported={(_count) => {
            setShowExcelImporter(false)
            setViewMode('gantt')
            loadData()
          }}
        />
      )}
      */}

      {/* ── Raw Data Modal ─────────────────────────── */}
      {rawTablePlan && (
        <RawDataModal
          plan={rawTablePlan}
          onClose={() => setRawTablePlan(null)}
        />
      )}

      {/* ── Global Loading Overlay (Para generación de planes) ── */}
      {suggesting && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center animate-in fade-in duration-200">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Procesando Planificación...</h2>
          <p className="text-sm font-medium text-gray-500 mt-2 text-center max-w-sm">
            Generando secuencias de pastoreo y calculando períodos de descanso regenerativo. Por favor, esperá.
          </p>
        </div>
      )}
    </div>

      <PromptModal
        isOpen={!!disablePaddockPrompt}
        title="Inhabilitar Potrero"
        message="Podés agregar un comentario o motivo por la inhabilitación del potrero. Esto quedará guardado en el historial (Bitácora)."
        placeholder="Opcional: Ej. Alambrado roto, anegado, etc."
        confirmLabel="Inhabilitar"
        cancelLabel="Cancelar"
        onConfirm={(comment) => {
          if (disablePaddockPrompt) {
            executeDisablePaddock(disablePaddockPrompt.paddockId, comment)
          }
        }}
        onCancel={() => setDisablePaddockPrompt(null)}
      />

    </>
  )
}

