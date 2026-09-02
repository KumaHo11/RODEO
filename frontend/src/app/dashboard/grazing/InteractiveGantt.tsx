'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FeatureGate } from '@/components/FeatureGate'
import {
  Calendar, Lock, AlertTriangle, EyeOff, Droplets, Droplet, Sprout, ToggleLeft, ToggleRight, Loader2, Sparkles, AlertCircle, ChevronUp, ChevronDown,
  Plus, CheckCircle2, Clock, MapPin, Search, Filter,
  AlignJustify, CalendarDays, Lightbulb, CloudRain, Sun, ChevronLeft, ChevronRight,
  X, Check, Camera, Leaf, Users, HistoryIcon, Download,
  Zap, TrendingUp, BarChart3, Target, ArrowDown, Share, Trash2, BookOpen, Upload, HelpCircle,
  Eye, Layers, MessageSquare, Send
} from 'lucide-react'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'
import { DashboardMetricsBar, DashboardMetricsData } from '@/design-system/molecules/DashboardMetricsBar'
import SeasonPlanModal from './SeasonPlanModal'
import dynamic from 'next/dynamic'
const ExcelImporter = dynamic(() => import('./ExcelImporter'), { ssr: false })
import RawDataModal from './RawDataModal'
import { HOLISTIC_TOOLTIPS, HoverTooltip } from '@/components/ui/atoms/UsageRing'
import { calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'
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
  calcularPesoParaMes,
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
export function PlanCommentsSection({
  plan,
  userEmail,
  onAddComment,
}: {
  plan: any
  userEmail: string
  onAddComment: (planId: string, text: string, author: string) => Promise<void>
}) {
  const comments: any[] = Array.isArray(plan.ai_analysis?.comments) ? plan.ai_analysis.comments : []
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  return (
    <div className="mt-1">
      <button
        onClick={() => setShowComments(s => !s)}
        className="w-full flex items-center justify-between gap-2 py-1.5 px-3 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
      >
        <span className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Comentarios
          {comments.length > 0 && (
            <span className="bg-purple-100 text-purple-700 rounded-full px-1.5 text-[9px] font-black">{comments.length}</span>
          )}
        </span>
        <span className="text-gray-400">{showComments ? '▲' : '▼'}</span>
      </button>
      {showComments && (
        <div className="mt-2 space-y-2">
          {comments.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center py-2">Sin comentarios aún.</p>
          )}
          {comments.map((c: any) => (
            <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
              <p className="text-[10px] text-gray-800 leading-relaxed">{c.text}</p>
              <p className="text-[8px] text-gray-400 mt-1 font-medium">
                {c.author_email?.split('@')[0]} · {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && commentText.trim()) {
                  await onAddComment(plan.id, commentText, userEmail)
                  setCommentText('')
                }
              }}
              placeholder="Escribir comentario..."
              className="flex-1 text-[10px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-400 bg-white"
            />
            <button
              onClick={async () => {
                if (!commentText.trim()) return
                await onAddComment(plan.id, commentText, userEmail)
                setCommentText('')
              }}
              disabled={!commentText.trim()}
              className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-all"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InteractiveGantt({

  plans, paddocks, herds, farmEvents, movements = [], windowStart, windowDays, onBlockClick, onBlockMove,
  rainfallData, onRainfallChange, weatherEvents = [], onPaddockClick,
  droughtThresholdMm, onDroughtThresholdChange,
  targetRemnant, dailyAllocationKg, activeSeasonPlan,
  climateViewEnabled = false, paddockCAdj = {}, paddockAAdj = {},
  isDrawingMode = false, onDrawEnd, onHerdUpdate, onEditEvent, onDeleteEvent, onAddHerd, onHerdClick,
  paddockOrder = [], onPaddockReorder,
  seasonPlanColorMap = {},
  seasonPlanNames = {},
  ganttLayers = { showOriginal: true, showPlanned: true, showReal: true, showEvents: true, showAgenda: true, showRemnant: true, showAnimals: true },
  onPaddockToggle,
  drawingHerdEV = 0,
  drawingHerdsLabel = '',
  bioMilestones = [],
}: {
  plans: any[]
  paddocks: any[]
  herds: any[]
  farmEvents: any[]
  activeSeasonPlan?: any | null
  movements?: any[]
  windowStart: string
  windowDays: number
  onBlockClick: (plan: any, evt?: React.MouseEvent) => void
  onBlockMove: (planId: string, newEntry: string, newExit: string, plan?: any) => void
  onLockSuggestedPlan?: (plan: any) => void
  rainfallData: Record<string, number>
  onRainfallChange: (monthKey: string, mm: number) => void
  weatherEvents?: any[]
  onPaddockClick?: (paddockId: string) => void
  droughtThresholdMm: number
  onDroughtThresholdChange: (mm: number) => void
  targetRemnant: number
  dailyAllocationKg: number
  /** C_adj activado: bloques se recalculan con el coeficiente por potrero */
  climateViewEnabled?: boolean
  paddockCAdj?: Record<string, number>
  /** A_adj per paddock — animal demand multiplier due to climate conditions */
  paddockAAdj?: Record<string, number>
  isDrawingMode?: boolean
  onDrawEnd?: (paddockId: string, startDate: string, endDate: string) => void
  onHerdUpdate?: (herdId: string, updates: Record<string, any>) => void
  onEditEvent?: (evt: any) => void
  onDeleteEvent?: (evt: any) => void
  onAddHerd?: (tipo?: 'permanente' | 'temporal') => void
  onHerdClick?: (herd: any) => void
  /** Optional ordered paddock IDs — when provided, rows are rendered in this sequence */
  paddockOrder?: string[]
  onPaddockReorder?: (paddockId: string, direction: 'up' | 'down') => void
  /** Mapa season_plan_id → índice de nivel de púrpura (solo planificaciones sugeridas) */
  seasonPlanColorMap?: Record<string, number>
  /** Mapa season_plan_id → nombre del plan */
  seasonPlanNames?: Record<string, string>
  /** Control de capas visibles en el Gantt */
  ganttLayers?: {
    showOriginal: boolean
    showPlanned: boolean
    showReal: boolean
    showEvents: boolean
    showAgenda: boolean
    showRemnant: boolean
    showAnimals: boolean
  }
  /** Callback para habilitar/deshabilitar potrero desde el Gantt */
  onPaddockToggle?: (paddockId: string, isActive: boolean) => void
  /** EV total de los rodeos seleccionados en modo dibujo (para alerta holística) */
  drawingHerdEV?: number
  /** Label legible de rodeos en modo dibujo (para tooltip) */
  drawingHerdsLabel?: string
  /** Hitos biológicos compartidos (destete, servicio, parición) para EV dinámico */
  bioMilestones?: BioMilestone[]
}) {
  // Sort paddocks by suggested order when paddockOrder is provided
  const orderedPaddocks = paddockOrder.length > 0
    ? [
        ...paddockOrder
          .map(id => paddocks.find((p: any) => p.id === id))
          .filter(Boolean),
        // Append any paddocks NOT in the sequence at the end
        ...paddocks.filter((p: any) => !paddockOrder.includes(p.id)),
      ]
    : paddocks
  const ROW_H = 110
  const LABEL_W = 220
  const HEADER_H = 48
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ planId: string; startX: number; origEntry: string; origExit: string; plan?: any } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)
  const [editingRainKey, setEditingRainKey] = useState<string | null>(null)
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [selectedGap, setSelectedGap] = useState<ForageGap | null>(null)
  const [showAnnualHerdModal, setShowAnnualHerdModal] = useState(false)
  const [showHerdDecisionModal, setShowHerdDecisionModal] = useState(false)
  // ── Visibilidad de filas de animales ──
  const [hiddenHerdIds, setHiddenHerdIds] = useState<Set<string>>(new Set())
  const [herdSectionCollapsed, setHerdSectionCollapsed] = useState(false)
  const toggleHerdVisibility = (herdId: string) => {
    setHiddenHerdIds(prev => {
      const next = new Set(prev)
      next.has(herdId) ? next.delete(herdId) : next.add(herdId)
      return next
    })
  }
  
  // Drawing state — extended with holistic alert
  const [drawingState, setDrawingState] = useState<{
    paddockId: string;
    startDay: number;
    currentDay: number;
    mousePos: { x: number; y: number };
    isOverOptimal: boolean;
    optimalDays: number;
  } | null>(null)

  // Resize state
  const resizing = useRef<{
    planId: string;
    edge: 'left' | 'right';
    startX: number;
    origEntry: string;
    origExit: string;
    plan?: any;
  } | null>(null)

  // Drag tooltip — shows dates while dragging existing blocks
  const [dragTooltip, setDragTooltip] = useState<{
    entry: string; exit: string; x: number; y: number
  } | null>(null)

  // Compute forage gaps for the current window
  const forageGaps = useMemo(() => {
    const totalEv = herds.reduce((s: number, h: any) => s + Number(h.total_ev || 0), 0)
    if (totalEv === 0) return []
    return detectForageGaps(plans, totalEv, windowDays, windowStart)
  }, [plans, herds, windowDays, windowStart])

  const herdColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    herds.forEach((h, i) => { map[h.id] = HERD_COLORS[i % HERD_COLORS.length] })
    return map
  }, [herds])

  // ── Rendimiento: moduleMsHaAvg calculado UNA vez, no N veces en el render ──
  // Previene el doble/triple filter por cada fila de potrero en el Gantt.
  const moduleMsHaAvg = useMemo(() => {
    const active = paddocks.filter((p: any) => Number(p.dry_matter_kg_ha) > 0)
    if (active.length === 0) return 0
    return active.reduce((s: number, p: any) => s + Number(p.dry_matter_kg_ha), 0) / active.length
  }, [paddocks])

  // ─── Eventos unificados (Agenda + Movements operacionales) ──────────────────
  // Los movements se incluyen para los cálculos de EV dinámico (headcount),
  // pero NO se renderizan como marcadores visuales en el Gantt.
  const unifiedEvents = useMemo(() => {
    const vEvents = (movements || []).map(m => {
      const qty = m.quantity || 0
      let title: string
      if (m.event_type === 'ajuste_entrada') {
        title = `Se agregaron ${qty} animales`
      } else if (m.event_type === 'ajuste_salida') {
        title = `Se retiraron ${qty} animales`
      } else if (m.event_type === 'ajuste') {
        title = `Ajuste de stock: ${qty > 0 ? '+' : ''}${qty} animales`
      } else if (m.event_type === 'bcs') {
        title = `Condición Corporal (BCS)`
      } else if (m.event_type === 'compra') {
        title = `Compra: ${qty} animales`
      } else if (m.event_type === 'venta') {
        title = `Venta: ${qty} animales`
      } else if (m.event_type === 'mortandad') {
        title = `Mortandad: ${qty} bajas`
      } else if (m.event_type === 'paricion' || m.event_type === 'nacimiento') {
        title = `Nacimientos: ${qty} animales`
      } else if (m.event_type === 'destete') {
        title = `Destete: ${qty} animales`
      } else {
        const typeLabel = m.event_type.charAt(0).toUpperCase() + m.event_type.slice(1).toLowerCase()
        title = `${typeLabel}: ${qty} cabezas`
      }
      return {
        id: m.id,
        title,
        event_type: m.event_type,
        event_date: m.occurred_at.split('T')[0],
        end_date: m.occurred_at.split('T')[0],
        isMovement: true,
        herd_id: m.entity_id,
        description: m.notes,
      }
    })
    return [...farmEvents, ...vEvents]
  }, [farmEvents, movements])

  // Eventos que se renderizan como líneas/puntos en el Gantt timeline.
  // Solo Agenda (farm_events con source != 'rodeo') — excluye movements operacionales
  // y registros/notas/audios creados desde la sección Rodeos.
  const ganttDisplayEvents = useMemo(() =>
    unifiedEvents.filter(e => !e.isMovement && e.source !== 'rodeo' && e.event_type !== 'MOVEMENT')
  , [unifiedEvents])


  // Use the global calculateDynamicHeadcount
  const getDynamicHeadcount = useCallback((herdId: string, baseCount: number, dateStr: string) => {
    return calculateDynamicHeadcount(herdId, baseCount, dateStr, unifiedEvents)
  }, [unifiedEvents])


  // Adaptive time markers: calendar-aligned (1st/15th/etc.)
  const timeMarkers = useMemo(() => {
    const marks: { label: string; day: number }[] = []
    const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    
    const startDt = new Date(windowStart + 'T00:00:00')
    const endDt = new Date(startDt)
    endDt.setDate(startDt.getDate() + windowDays)

    const targetDays = windowDays <= 90 ? [1, 8, 15, 22] : windowDays <= 180 ? [1, 15] : [1]

    const currentMonth = new Date(startDt.getFullYear(), startDt.getMonth(), 1)
    
    while (currentMonth < endDt) {
      for (const targetDay of targetDays) {
        const markDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), targetDay)
        
        if (markDate >= startDt && markDate < endDt) {
          const diffTime = markDate.getTime() - startDt.getTime()
          const dayOffset = Math.round(diffTime / 86400000)
          
          let label = ''
          if (windowDays > 180) {
            label = `${MONTH_SHORT[markDate.getMonth()]} ${markDate.getFullYear()}`
          } else {
            label = `${MONTH_SHORT[markDate.getMonth()]} ${String(markDate.getDate()).padStart(2,'0')}/${String(markDate.getMonth()+1).padStart(2,'0')}`
          }
          
          if (!marks.some(m => m.day === dayOffset)) {
            marks.push({ label, day: dayOffset })
          }
        }
      }
      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }
    
    // Always include a marker for the very first day if not already covered
    if (!marks.find(m => m.day === 0)) {
       const label = windowDays > 180 
          ? `${MONTH_SHORT[startDt.getMonth()]} ${startDt.getFullYear()}`
          : `${MONTH_SHORT[startDt.getMonth()]} ${String(startDt.getDate()).padStart(2,'0')}/${String(startDt.getMonth()+1).padStart(2,'0')}`
       marks.unshift({ label, day: 0 })
    }

    return marks
  }, [windowStart, windowDays])

  // Daily markers for vertical grid lines (every day, highlighting weekends and "today")
  const dayMarkers = useMemo(() => {
    const marks: { day: number; isWeekend: boolean; isToday: boolean }[] = []
    const startDt = new Date(windowStart + 'T00:00:00')
    const todayStr = new Date().toISOString().split('T')[0]
    
    for (let d = 0; d < windowDays; d++) {
      const currentDt = new Date(startDt)
      currentDt.setDate(startDt.getDate() + d)
      const dayOfWeek = currentDt.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const currentStr = currentDt.toISOString().split('T')[0]
      const isToday = currentStr === todayStr
      marks.push({ day: d, isWeekend, isToday })
    }
    return marks
  }, [windowStart, windowDays])

  // Monthly breakdown for footer
  const MONTHS_FOOTER = useMemo(() => {
    const months: { key: string; leftPct: number; widthPct: number; startDate: string; endDate: string; month: number }[] = []
    for (let d = 0; d < windowDays; d++) {
      const dt = new Date(windowStart + 'T00:00:00')
      dt.setDate(dt.getDate() + d)
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`
      if (!months.find(m => m.key === key)) {
        const daysInMonth = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate()
        const endDay = Math.min(d + (daysInMonth - dt.getDate()), windowDays - 1)
        const endDt = new Date(windowStart + 'T00:00:00')
        endDt.setDate(endDt.getDate() + endDay)
        months.push({
          key,
          month: dt.getMonth(),
          leftPct: (d / windowDays) * 100,
          widthPct: ((endDay - d + 1) / windowDays) * 100,
          startDate: dt.toISOString().split('T')[0],
          endDate: endDt.toISOString().split('T')[0],
        })
        d = endDay
      }
    }
    return months
  }, [windowStart, windowDays])

  // Active herds in the current window based on lifecycle (admission/exit dates)
  const activeHerdsInWindow = useMemo(() => {
    if (!MONTHS_FOOTER || MONTHS_FOOTER.length === 0) return []
    const wStart = MONTHS_FOOTER[0]?.startDate
    const wEnd = MONTHS_FOOTER[MONTHS_FOOTER.length - 1]?.endDate

    // Herds que están activos en la ventana temporal
    const herdsInWindow = herds.filter(h => {
      const entry = h.admission_date || h.created_at?.split('T')[0] || '2000-01-01'
      const exit = h.exit_date || '2100-01-01'
      return entry <= wEnd && exit >= wStart
    })

    // Si hay planes sugeridos, filtrar el footer para mostrar solo los herds planificados
    const suggestedHerdIds = new Set<string>()
    plans.forEach(p => {
      if (p.plan_type === 'suggested' || p.ai_analysis?.plan_source === 'suggested') {
        ;(p.herd_ids || []).forEach((id: string) => suggestedHerdIds.add(id))
      }
    })

    if (suggestedHerdIds.size > 0) {
      // Solo mostrar herds que pertenecen a algún plan sugerido visible
      return herdsInWindow.filter(h => suggestedHerdIds.has(h.id))
    }

    return herdsInWindow
  }, [herds, plans, MONTHS_FOOTER])


  // Map grid lines to exactly match time markers
  const weekMarkers = useMemo(() => {
    return timeMarkers.map(m => ({ day: m.day }))
  }, [timeMarkers])

  const pxPerDay = useCallback((containerW: number) => {
    // Use the full scrollable content width (not the visible clientWidth)
    // so drag/resize matches block positioning which is % of scrollWidth
    return (containerW - LABEL_W) / windowDays
  }, [windowDays, LABEL_W])

  // Helper: get the real pixels-per-day from scrollWidth of the inner content
  const getActualPpd = useCallback(() => {
    if (!containerRef.current) return 1
    // The inner div has minWidth = windowDays * 6 + LABEL_W
    const innerW = containerRef.current.scrollWidth
    return (innerW - LABEL_W) / windowDays
  }, [windowDays])

  const handleMouseDown = (e: React.MouseEvent, plan: any) => {
    if (isDrawingMode) return  // drawing mode takes priority — ignore plan-block drags
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const startEntry = plan.is_locked && plan.adjusted_entry_date ? plan.adjusted_entry_date : plan.entry_date
    const startExit = plan.is_locked && plan.adjusted_exit_date ? plan.adjusted_exit_date : (plan.exit_date || addDays(plan.entry_date, plan.planned_recovery_days || 14))

    dragging.current = {
      planId: plan.id,
      startX: e.clientX,
      origEntry: startEntry,
      origExit: startExit,
      plan: plan
    }
  }

  const handleRowMouseDown = (e: React.MouseEvent, paddockId: string) => {
    if (!isDrawingMode || !containerRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    // Use scrollWidth for ppd to match block positioning (blocks use % of full inner width)
    const ppd = getActualPpd()
    const xRel = e.clientX - rect.left - LABEL_W + containerRef.current.scrollLeft
    let dayIdx = Math.max(0, Math.min(windowDays - 1, Math.floor(xRel / ppd)))

    // --- Snapping logic: Snap to 'Siguiente' line if close ---
    let maxDate = ''
    const activePlanBlocks = plans.filter(p => p.status !== 'DELETED')
    for (const p of activePlanBlocks) {
      const exit = p.exit_date || p.estimated_exit_date || addDays(p.entry_date, p.planned_recovery_days || 14)
      if (!maxDate || exit > maxDate) maxDate = exit
    }
    if (maxDate) {
      const nextAvailableDate = addDays(maxDate, 1)
      const nextDiff = daysBetween(windowStart, nextAvailableDate)
      // Snap if within 7 days (about 1 week tolerance)
      if (nextDiff >= 0 && Math.abs(dayIdx - nextDiff) <= 7) {
        dayIdx = nextDiff
      }
    }
    // ---------------------------------------------------------

    // Compute optimal days for this paddock using holistic engine
    const paddock = paddocks.find((p: any) => p.id === paddockId)
    const msHa = Number(paddock?.dry_matter_kg_ha) || 0
    const areaHa = Number(paddock?.area_ha) || 0
    const usable = calculateUsableForage(msHa, targetRemnant, areaHa)
    const demand = drawingHerdEV * dailyAllocationKg
    const optDays = demand > 0 ? calculateGrazingDays(usable, demand) : 0
    
    const newState = {
      paddockId,
      startDay: dayIdx,
      currentDay: dayIdx,
      mousePos: { x: e.clientX, y: e.clientY },
      isOverOptimal: false,
      optimalDays: optDays,
    }
    // Set ref SYNCHRONOUSLY so the first mousemove event already sees a valid state
    drawingStateRef.current = newState
    setDrawingState(newState)
  }

  // Keep a ref so the global mouseup handler always sees the latest drawingState
  const drawingStateRef = useRef<typeof drawingState>(null)
  useEffect(() => { drawingStateRef.current = drawingState }, [drawingState])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Resize handle drag
      if (resizing.current && containerRef.current) {
        const ppd = getActualPpd()
        const dxDays = Math.round((e.clientX - resizing.current.startX) / ppd)
        if (dxDays === 0) return
        const { edge, origEntry, origExit, planId, plan } = resizing.current
        let newEntry = origEntry
        let newExit = origExit
        if (edge === 'right') {
          newExit = addDays(origExit, dxDays)
          if (newExit <= newEntry) newExit = addDays(newEntry, 1)
        } else {
          newEntry = addDays(origEntry, dxDays)
          if (newEntry >= newExit) newEntry = addDays(newExit, -1)
        }
        setDragTooltip({ entry: newEntry, exit: newExit, x: e.clientX, y: e.clientY })
        onBlockMove(planId, newEntry, newExit, plan)
        return
      }
      // Block drag
      if (dragging.current && containerRef.current) {
        const ppd = getActualPpd()
        const dxDays = Math.round((e.clientX - dragging.current.startX) / ppd)
        if (dxDays === 0) return
        const origDuration = daysBetween(dragging.current.origEntry, dragging.current.origExit)
        const newEntry = addDays(dragging.current.origEntry, dxDays)
        const newExit = addDays(newEntry, origDuration)
        setDragTooltip({ entry: newEntry, exit: newExit, x: e.clientX, y: e.clientY })
        onBlockMove(dragging.current.planId, newEntry, newExit, dragging.current.plan)
      } else if (drawingStateRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const xRel = e.clientX - rect.left - LABEL_W + containerRef.current.scrollLeft
        const ppd = getActualPpd()
        const dayIdx = Math.max(0, Math.min(windowDays, Math.floor(xRel / ppd)))
        const days = Math.abs(dayIdx - drawingStateRef.current.startDay) + 1
        const isOver = drawingStateRef.current.optimalDays > 0 && days > drawingStateRef.current.optimalDays
        setDrawingState(prev => prev ? {
          ...prev,
          currentDay: dayIdx,
          mousePos: { x: e.clientX, y: e.clientY },
          isOverOptimal: isOver,
        } : null)
      }
    }
    const handleMouseUp = () => {
      if (resizing.current) {
        resizing.current = null
        setDragTooltip(null)
        return
      }
      if (dragging.current) {
        dragging.current = null
        setDragTooltip(null)
      }
      const ds = drawingStateRef.current
      if (ds && onDrawEnd) {
        const d1 = Math.min(ds.startDay, ds.currentDay)
        const d2 = Math.max(ds.startDay, ds.currentDay)
        const startDate = addDays(windowStart, d1)
        const endDate   = addDays(windowStart, d2 + 1)
        // Only fire if the user dragged at least 1 day
        if (d2 >= d1) {
          onDrawEnd(ds.paddockId, startDate, endDate)
        }
      }
      setDrawingState(null)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onBlockMove, pxPerDay, onDrawEnd, windowStart, windowDays])

  // Auto-scroll to Today
  useEffect(() => {
    if (containerRef.current) {
      const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
      if (todayDiff >= 0 && todayDiff <= windowDays) {
        const ppd = getActualPpd()
        const scrollX = (todayDiff * ppd) - (containerRef.current.clientWidth / 2) + LABEL_W
        containerRef.current.scrollTo({ left: Math.max(0, scrollX), behavior: 'smooth' })
      }
    }
  }, [windowStart, windowDays, getActualPpd])

  // Pre-compute popup to avoid IIFE-in-JSX parsing issues
  const eventPopup = selectedEvent && popupPos ? (() => {
    const px = popupPos.x
    const py = popupPos.y
    return (
      <>
        <div
          className="fixed inset-0 z-[998]"
          onClick={() => { setSelectedEvent(null); setPopupPos(null) }}
        />
        <div
          className="fixed z-[999] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-64"
          style={{
            left: Math.min(px - 128, (typeof window !== 'undefined' ? window.innerWidth : 800) - 272),
            top: py > 200 ? py - 180 : py + 20,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: `${selectedEvent.cfg.color}18` }}>
                {selectedEvent.cfg.emoji}
              </div>
              <div>
                <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: selectedEvent.cfg.color }}>
                  {selectedEvent.cfg.label}
                </p>
                <p className="text-sm font-black text-gray-900 leading-tight">{selectedEvent.title}</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedEvent(null); setPopupPos(null) }}
              className="w-5 h-5 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 text-xs shrink-0 mt-0.5"
            >✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Fecha</p>
              <p className="text-xs font-bold text-gray-800">{fmt(selectedEvent.event_date)}</p>
            </div>
            {selectedEvent.end_date && (
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Hasta</p>
                <p className="text-xs font-bold text-gray-800">{fmt(selectedEvent.end_date)}</p>
              </div>
            )}
          </div>
          {selectedEvent.description && (
            <p className="mt-2 text-[10px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
              {selectedEvent.description}
            </p>
          )}
          {/* Edit / Delete buttons */}
          <div className="mt-3 flex items-center gap-2">
            {!selectedEvent.isMovement && (
              <button
                className="flex-1 py-1.5 bg-sky-50 text-sky-700 rounded-xl text-[10px] font-bold border border-sky-200 hover:bg-sky-100 transition-all"
                onClick={() => {
                  setSelectedEvent(null); setPopupPos(null)
                  onEditEvent?.({ ...selectedEvent })
                }}
              >
                Editar
              </button>
            )}
            <button
              className="flex-1 py-1.5 bg-red-50 text-red-700 rounded-xl text-[10px] font-bold border border-red-200 hover:bg-red-100 transition-all"
              onClick={() => {
                onDeleteEvent?.(selectedEvent);
                setSelectedEvent(null);
                setPopupPos(null);
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      </>
    )
  })() : null

  return (
    <>
    <div
      ref={containerRef}
      data-gantt-scroll=""
      className="select-none overflow-x-auto overscroll-x-none overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-sm"
      style={{ cursor: isDrawingMode ? 'crosshair' : 'default', maxHeight: 'calc(100vh - 220px)' }}
      onClick={() => { setSelectedEvent(null); setPopupPos(null) }}
    >
      <div className="w-full relative" style={{ minWidth: Math.max(1000, windowDays * 6 + LABEL_W) }}>
        {/* LÍNEA GUÍA DE CONTINUIDAD REMOVIDA PARA USAR SOLO LA DE POTREROS */}

        {/* Header row */}
        <div className="flex flex-col border-b border-gray-200 bg-gray-50 sticky top-0 z-30">
          {/* Gap health bar — 4px strip above time markers */}
          {ganttLayers.showRemnant && forageGaps.length > 0 && (
            <div className="flex" style={{ height: 4 }}>
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 bg-gray-50 border-r border-gray-200 sticky left-0 z-20" />
              <div className="flex-1 relative bg-gray-100">
                {forageGaps.map((gap, i) => {
                  const startPct = (Math.max(0, daysBetween(windowStart, gap.start_date)) / windowDays) * 100
                  const endDay   = Math.min(windowDays, daysBetween(windowStart, gap.end_date) + 1)
                  const widthPct = Math.max(0, (endDay / windowDays) * 100 - startPct)
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 cursor-pointer"
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: gap.severity === 'critical' ? '#ef4444' : gap.severity === 'medium' ? '#f59e0b' : '#fbbf24',
                      }}
                      title={`Déficit ${gap.deficit_days}d — ${gap.severity}`}
                      onClick={e => { e.stopPropagation(); setSelectedGap(gap) }}
                    />
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex" style={{ height: HEADER_H }}>
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-4 flex items-center text-[10px] font-black text-gray-400 tracking-widest uppercase border-r border-gray-200 shrink-0 sticky left-0 z-40 bg-gray-50">
            Potrero
          </div>
          <div className="flex-1 relative overflow-hidden">
            {timeMarkers.map(m => (
              <div
                key={m.day}
                className="absolute top-0 bottom-0 border-l border-dashed border-gray-200 pointer-events-none"
                style={{ left: `${(m.day / windowDays) * 100}%` }}
              >
                <span className="text-[9px] font-bold text-gray-400 ml-1 absolute top-2">{m.label}</span>
              </div>
            ))}
            {/* Today line — subtle dashed soft-green line only */}
            {(() => {
              const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
              if (todayDiff >= 0 && todayDiff <= windowDays) {
                return (
                  <div
                    className="absolute top-0 bottom-0 z-30 pointer-events-none"
                    style={{ left: `${(todayDiff / windowDays) * 100}%` }}
                  >
                    <div className="h-full w-px" style={{ borderLeft: '1.5px dashed rgba(134,239,172,0.7)' }} />
                  </div>
                )
              }
              return null
            })()}

            {/* Month labels — clickable to create event */}
            {ganttLayers.showAgenda && MONTHS_FOOTER.map(m => (
              <button
                key={m.key}
                className="absolute top-0 bottom-0 flex items-end pb-1 px-1 hover:bg-sky-50/50 transition-colors group border-r border-gray-100/50"
                style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                title={`Crear evento en ${m.key}`}
                onClick={() => onEditEvent?.({ id: null, event_date: m.startDate, title: '', event_type: 'other', description: '' })}
              >
                <span className="text-[7px] font-bold text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">+ evento</span>
              </button>
            ))}

          </div>
          </div>{/* close flex row inside header */}
        </div>{/* close header col */}




        {/* ── Gap SVG defs (striated pattern) ── */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <pattern id="gap-critical" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#ef4444" strokeWidth="1.2" strokeOpacity="0.28" />
            </pattern>
            <pattern id="gap-medium" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.25" />
            </pattern>
            <pattern id="gap-low" patternUnits="userSpaceOnUse" width="8" height="8">
              <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.18" />
            </pattern>
          </defs>
        </svg>

        {/* Paddock rows — sorted by suggestedPaddockOrder when in suggested mode */}
        {(() => {
          let maxDate = ''
          for (const p of plans) {
            if (p.status === 'DELETED') continue
            const exit = p.exit_date || addDays(p.entry_date, p.planned_recovery_days || 14)
            if (exit > maxDate) maxDate = exit
          }
          const nextAvailableDate = maxDate ? addDays(maxDate, 1) : null
          const nextDiff = nextAvailableDate ? daysBetween(windowStart, nextAvailableDate) : -1
          const showNextLine = isDrawingMode && nextDiff >= 0 && nextDiff <= windowDays

          const activePaddocks = orderedPaddocks.filter(p => p.is_active !== false && Number(p.dry_matter_kg_ha) > 0)
          const inactivePaddocks = orderedPaddocks.filter(p => !(p.is_active !== false && Number(p.dry_matter_kg_ha) > 0))

          return (
            <>
            {activePaddocks.map((paddock, rowIdx) => {
              const paddockPlans = plans.filter(p => p.paddock_id === paddock.id && p.status !== 'DELETED')
              // Dot: green if enabled (is_active) AND has MS declared, gray if disabled or no MS
              const hasMS = true
              const isEnabled = true
              // Data from Datos de Campo slider (quality_score = 1-10)
              const qualityScore = paddock.technical_data?.quality_score as number | undefined
              const msHa = Number(paddock.dry_matter_kg_ha) || 0
              const areaHa = Number(paddock.area_ha) || 0

              // Quality color
              const qColor = qualityScore
                ? qualityScore >= 7 ? 'text-green-700' : qualityScore >= 4 ? 'text-amber-600' : 'text-red-600'
                : 'text-gray-300'

              // ── Métricas Holísticas ──────────────────────────
              // DAH Estimado: (MS - remanente) × ha / (EV_total × kg/día)
              const totalEV = herds.reduce((s: number, h: any) => s + Number(h.total_ev || 0), 0)
              const usableMs = calculateUsableForage(msHa, targetRemnant, areaHa)
              const dailyDemand = totalEV * dailyAllocationKg
              const estimatedDah = calculateGrazingDays(usableMs, dailyDemand) || null
              // Yield Coefficient: MS potrero / promedio MS módulo
              // moduleMsHaAvg se calcula una sola vez via useMemo — no inline aquí
              const yieldCoef = moduleMsHaAvg > 0 && msHa > 0 ? (msHa / moduleMsHaAvg) : null

              return (
                <div
                  key={paddock.id}
                  className={`flex border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}
                  style={{ height: ROW_H }}
                >
                  {/* Label — datos del potrero */}
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className={`px-3 py-2 flex items-center gap-2 border-r border-gray-100 shrink-0 sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.05)] ${!isEnabled ? 'bg-gray-100 h-full' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}>
                {/* Paddock toggle — habilitar/deshabilitar directo en el Gantt */}
                <button
                  onClick={() => onPaddockToggle?.(paddock.id, !isEnabled)}
                  title={isEnabled ? 'Inhabilitar potrero' : 'Habilitar potrero'}
                  className={`shrink-0 transition-colors rounded ${
                    isEnabled ? 'text-green-500 hover:text-red-400 self-start mt-2' : 'text-gray-300 hover:text-green-500'
                  }`}
                >
                  {paddock.is_active !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5 py-1 group/paddock">
                  {/* Row 1: Nombre + badge calidad */}
                  <div className="flex items-center justify-between gap-1">
                    {onPaddockReorder && (
                      <div className="flex flex-col gap-[2px] shrink-0 mr-1.5 opacity-0 group-hover/paddock:opacity-100 transition-opacity">
                        <button type="button" onClick={() => onPaddockReorder(paddock.id, 'up')} className="text-gray-300 hover:text-green-600 hover:bg-green-50 rounded" title="Mover arriba">
                          <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                        <button type="button" onClick={() => onPaddockReorder(paddock.id, 'down')} className="text-gray-300 hover:text-green-600 hover:bg-green-50 rounded" title="Mover abajo">
                          <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onPaddockClick?.(paddock.id)}
                      className="text-sm font-black text-gray-950 tracking-tight truncate hover:text-green-700 transition-colors text-left leading-tight"
                      title={`Ir al potrero ${paddock.name}`}
                    >
                      {paddock.name}
                    </button>
                    {isEnabled && qualityScore != null && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <HoverTooltip text={HOLISTIC_TOOLTIPS.quality}>
                          <span className={`text-[10px] font-black min-w-[36px] text-center px-1.5 py-0.5 rounded-lg border bg-white shadow-sm cursor-help ${qColor}`}>
                            {qualityScore}/10
                          </span>
                        </HoverTooltip>
                      </div>
                    )}
                    {!hasMS && (
                      <div className="flex items-center gap-0.5 shrink-0" title="Sin materia seca declarada no es posible planificar pastoreos en este potrero.">
                        <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md cursor-help">
                          <AlertTriangle className="w-2 h-2" />Sin MS
                        </span>
                      </div>
                    )}
                    {isEnabled && hasMS && estimatedDah === 0 && (
                      <div className="flex items-center gap-0.5 shrink-0" title="El forraje actual está por debajo del remanente objetivo. Riesgo de sobrepastoreo.">
                        <span className="flex items-center gap-0.5 text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md cursor-help">
                          <AlertTriangle className="w-2 h-2" />0 Días
                        </span>
                      </div>
                    )}
                  </div>
                  {isEnabled && (
                    <>
                      {/* Row 2: ha + MS/ha */}
                      <div className="flex items-center gap-1.5">
                        <HoverTooltip text="Superficie del potrero (hectáreas)">
                          <span className="text-[11px] font-bold text-gray-700 cursor-help">{areaHa.toFixed(1)}<span className="font-normal text-gray-400 ml-0.5">ha</span></span>
                        </HoverTooltip>
                        {msHa > 0 && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                            <HoverTooltip text="Biomasa disponible (kg MS/ha)">
                              <span className="text-[11px] font-bold text-gray-700 cursor-help">{msHa.toLocaleString('es')}<span className="font-normal text-gray-400 ml-0.5">kg/ha</span></span>
                            </HoverTooltip>
                          </>
                        )}
                      </div>
                      {/* Row 3: DAH + Coeficiente (Holistic Metrics) */}
                      {(() => {
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {/* Yield Coefficient badge */}
                            {yieldCoef !== null && (
                                <HoverTooltip text={HOLISTIC_TOOLTIPS.yieldCoef}>
                                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border cursor-help ${
                                    yieldCoef >= 1.05 ? 'text-green-700 bg-green-50 border-green-100'
                                    : yieldCoef >= 0.95 ? 'text-gray-600 bg-gray-50 border-gray-200'
                                    : 'text-amber-700 bg-amber-50 border-amber-100'
                                  }`}>
                                    ×{yieldCoef.toFixed(2)}
                                  </span>
                                </HoverTooltip>
                            )}
                            {/* Min / Max / Occupation Days */}
                            {(() => {
                               const stdDivisor = Math.max(1, paddocks.filter((p: any) => p.is_active !== false).length - 1)
                               const pYield = yieldCoef || 1
                               const stdMin = Math.round(pYield * (50 / stdDivisor))
                               const stdMax = Math.round(pYield * (100 / stdDivisor))
                               const stdAvg = Math.round((stdMin + stdMax) / 2)

                               const activeSupply = activeSeasonPlan?.supply_snapshot?.by_paddock?.find((d: any) => d.id === paddock.id);
                               const isClosed = activeSeasonPlan?.season_type === 'cerrado';

                               let displayMin = stdMin
                               let displayMax = stdMax
                               let displayAvg = stdAvg
                               let isFixed = false

                               if (activeSupply) {
                                 if (isClosed) {
                                   displayMin = activeSupply.min_days || 0
                                   isFixed = true
                                 } else {
                                   displayMin = activeSupply.min_days || 0
                                   displayMax = activeSupply.max_days || 0
                                   displayAvg = Math.round((displayMin + displayMax) / 2)
                                 }
                               }

                               return (
                                 <HoverTooltip text={isFixed ? "Días permitidos en base a la oferta forrajera" : "Rango sugerido de pastoreo (Mínimo, Promedio y Máximo)"}>
                                   <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full cursor-help">
                                     {isFixed 
                                       ? `Días de pastoreo: ${displayMin}d` 
                                       : `Mín: ${displayMin}d • Prom: ${displayAvg}d • Máx: ${displayMax}d`
                                     }
                                   </span>
                                 </HoverTooltip>
                               )
                            })()}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              </div>

              {/* Timeline area */}

              <div 
                className={`flex-1 relative overflow-hidden ${!isEnabled ? 'cursor-not-allowed' : ''}`}
                onMouseDown={(e) => isEnabled ? handleRowMouseDown(e, paddock.id) : undefined}
              >
                {/* Drawing Highlight Overlay — red when no forage or exceeding optimal days */}
                {drawingState && drawingState.paddockId === paddock.id && (() => {
                  const noForage = msHa > 0 && drawingState.optimalDays === 0
                  const isRed = noForage || drawingState.isOverOptimal
                  const days = Math.abs(drawingState.currentDay - drawingState.startDay) + 1
                  return (
                    <>
                      <div
                        className={`absolute inset-y-0 z-20 border-2 rounded-lg pointer-events-none transition-colors ${
                          isRed
                            ? 'bg-red-500/25 border-red-500/60'
                            : 'bg-green-500/30 border-green-500/50'
                        }`}
                        style={{
                          left: `${(Math.min(drawingState.startDay, drawingState.currentDay) / windowDays) * 100}%`,
                          width: `${days / windowDays * 100}%`,
                        }}
                      />
                      {noForage && (
                        <div
                          className="absolute z-30 pointer-events-none"
                          style={{
                            left: `${(Math.min(drawingState.startDay, drawingState.currentDay) / windowDays) * 100}%`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                          }}
                        >
                          <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg whitespace-nowrap">
                            ⚠️ Sin pasto — Riesgo de sobrepastoreo
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
                {/* ── ALERTA DE POTRERO AGOTADO EN EL TIMELINE ── */}
                {hasMS && estimatedDah === 0 && isEnabled && (
                  <div className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center opacity-80"
                       style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.05), rgba(239, 68, 68, 0.05) 10px, transparent 10px, transparent 20px)' }}>
                     <span className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide shadow-sm">
                        Sin pastoreo — Peligro de sobrepastoreo
                     </span>
                  </div>
                )}
                {/* Grid lines and Weekends */}
                {dayMarkers.map(m => (
                  <div
                    key={m.day}
                    className={`absolute top-0 bottom-0 border-l border-dashed border-gray-100/70 pointer-events-none ${m.isWeekend ? 'bg-gray-100/40' : ''}`}
                    style={{ left: `${(m.day / windowDays) * 100}%`, width: `${(1 / windowDays) * 100}%` }}
                  />
                ))}

                {/* Next Available Day line */}
                {showNextLine && (
                  <div
                    className="absolute top-0 bottom-0 z-[12] pointer-events-none flex flex-col items-center"
                    style={{ left: `${(nextDiff / windowDays) * 100}%` }}
                  >
                    {rowIdx === 0 && (
                      <div className="absolute top-1 px-1.5 py-0.5 bg-blue-50/80 text-blue-600 border border-blue-200/60 text-[8px] font-bold rounded shadow-sm whitespace-nowrap z-20 backdrop-blur-[2px]">
                        Siguiente: {nextAvailableDate!.split('-').reverse().join('/')}
                      </div>
                    )}
                    <div className="h-full w-px" style={{ borderLeft: '1.5px dashed rgba(59, 130, 246, 0.35)' }} />
                  </div>
                )}

                {/* Today line — soft green dashed line */}
                {(() => {
                  const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
                  if (todayDiff >= 0 && todayDiff <= windowDays) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 z-10 pointer-events-none"
                        style={{ left: `${(todayDiff / windowDays) * 100}%` }}
                      >
                        <div className="h-full w-px" style={{ borderLeft: '1.5px dashed rgba(34,197,94,0.8)' }} />
                      </div>
                    )
                  }
                  return null
                })()}



                {/* Agenda Event outlines — line in every row, dot only on first */}
                {ganttLayers.showEvents && ganttDisplayEvents
                  .filter(evt => {
                    const d = daysBetween(windowStart, evt.event_date)
                    const de = evt.end_date ? daysBetween(windowStart, evt.end_date) : d
                    return (d >= 0 && d <= windowDays) || (de >= 0 && de <= windowDays) || (d < 0 && de > windowDays)
                  })
                  .map(evt => {
                    const cfg = EVT_CONFIG[evt.event_type] || { label: evt.event_type, emoji: '📌', color: '#374151' }
                    const d = daysBetween(windowStart, evt.event_date)
                    const de = evt.end_date ? daysBetween(windowStart, evt.end_date) : d
                    const leftPct = Math.max(0, (d / windowDays) * 100)
                    const rightPct = Math.min(100, (de / windowDays) * 100)
                    const widthPct = rightPct - leftPct
                    const isMultiDay = evt.end_date && evt.end_date !== evt.event_date
                    const isFirst = rowIdx === 0
                    const isLast = rowIdx === paddocks.length - 1
                    return (
                      <div
                        key={`evt-outline-${evt.id}-${rowIdx}`}
                        className="pointer-events-none z-[5]"
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: `${leftPct}%`,
                          width: isMultiDay ? `${Math.max(widthPct, 0.3)}%` : 'auto',
                          borderLeft: `2px solid ${cfg.color}`,
                          borderRight: isMultiDay ? `2px solid ${cfg.color}` : 'none',
                          borderTop: isFirst && isMultiDay ? `2px solid ${cfg.color}` : 'none',
                          borderBottom: isLast && isMultiDay ? `2px solid ${cfg.color}` : 'none',
                          backgroundColor: isMultiDay ? `${cfg.color}0D` : 'transparent',
                          opacity: 0.5,
                        }}
                      >
                        {/* Clickable dot — only on first paddock row */}
                        {isFirst && (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setPopupPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height })
                              setSelectedEvent({ ...evt, cfg })
                            }}
                            className={`absolute top-2 pointer-events-auto ${isMultiDay ? 'left-1/2 -translate-x-1/2' : '-translate-x-[4px]'} w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all hover:scale-125 focus:outline-none z-[25]`}
                            style={{ backgroundColor: cfg.color }}
                            title={`${cfg.emoji} ${evt.title}`}
                          />
                        )}
                      </div>
                    )
                  })}

                {/* Plan blocks with Stacking Logic */}
                {(() => {
                  const sorted = [...paddockPlans].sort((a,b) => a.entry_date.localeCompare(b.entry_date))
                  const today = new Date().toISOString().split('T')[0]

                  return sorted.map((plan, idx) => {
                    const entryDiff = daysBetween(windowStart, plan.entry_date)
                    const exitDate = plan.exit_date || addDays(plan.entry_date, 14)
                    const duration = Math.max(1, daysBetween(plan.entry_date, exitDate))
                    const leftPct = Math.max(0, (entryDiff / windowDays) * 100)
                    // Mínimo = 1 día exacto en % (no 0.5% fijo que infla bloques en ventanas grandes)
                    const oneDayPct = (1 / windowDays) * 100
                    const widthPct = Math.max(oneDayPct, (duration / windowDays) * 100)
                    if (entryDiff > windowDays || (entryDiff + duration) < 0) return null

                    const hasRealEntry = !!plan.actual_entry_date
                    const hasRealExit  = !!plan.actual_exit_date
                    const isCompleted  = plan.status === 'COMPLETED'
                    // En pastoreo: la entrada ya pasó, la salida aún no, sin entrada real registrada
                    const isActiveNow  = !hasRealEntry && !isCompleted && plan.entry_date <= today && (plan.exit_date || addDays(plan.entry_date, 14)) >= today
                    // Vencido: pasó la fecha de entrada Y la fecha de salida, sin completar
                    const isOverdue    = !hasRealEntry && !isCompleted && !isActiveNow && plan.entry_date < today
                    const isMultiHerd  = plan.herd_ids && plan.herd_ids.length > 1
                    const primaryHerd  = herds.find(h => plan.herd_ids?.includes(h.id))
                    const herdLabel    = isMultiHerd ? `${plan.herd_ids.length} rodeos` : (primaryHerd?.name || 'Rodeo')

                    // ── Color scheme pasteles ──
                    // Planificado (futuro): cyan pastel
                    // En curso (entry <= today, sin salida): verde pastel
                    // Completado en tiempo: verde pastel
                    // Completado pasado del tiempo: naranja pastel
                    // Vencido sin completar: rojo pastel
                    const isSuggested  = plan.ai_analysis?.plan_source === 'suggested' && !plan.is_locked
                    const entryDate    = plan.entry_date
                    const isPast       = entryDate < today
                    const planDuration = daysBetween(plan.entry_date, exitDate)

                    // Ghost/exceed vars (kept for ghost bar)
                    const ghostMsHa        = Number(paddock?.dry_matter_kg_ha) || 0
                    const ghostAreaHa      = Number(paddock?.area_ha) || 0
                    const ghostHerdsEV     = herds.filter((h: any) => plan.herd_ids?.includes(h.id)).reduce((s: number, h: any) => s + Number(h.total_ev || 0), 0)
                    
                    const ghostUsableMs    = calculateUsableForage(ghostMsHa, targetRemnant, ghostAreaHa)
                    const ghostDailyDemand = ghostHerdsEV * dailyAllocationKg
                    const ghostDays        = calculateGrazingDays(ghostUsableMs, ghostDailyDemand)
                    const ghostWidthPct    = ghostDays > 0 ? Math.max(0.3, (ghostDays / windowDays) * 100) : 0
                    const exceedingRemanente = ghostDays > 0 && duration > ghostDays && !isCompleted

                    // ── Ajuste Climático: delta de días por A_adj (Impacto Animal) ──
                    const aAdj = (climateViewEnabled && paddockAAdj?.[paddock.id])
                      ? paddockAAdj[paddock.id]
                      : 1.0
                    const baseDuration = duration
                    const adjustedDuration = climateViewEnabled && aAdj !== 1.0
                      ? Math.max(1, Math.round(baseDuration / aAdj))
                      : baseDuration
                    const deltaClimate = adjustedDuration - baseDuration
                    const adjustedWidthPct = climateViewEnabled && deltaClimate !== 0
                      ? Math.max(0.3, (adjustedDuration / windowDays) * 100)
                      : widthPct

                    // ── Triple Track Positions ──
                    const TRACK1_TOP = 4
                    const TRACK2_TOP = 30
                    const TRACK3_TOP = 56
                    const BAR_H    = 22
                    
                    // ── Visual Snapping (Empalme Perfecto) ──
                    const connectsLeft = sorted.some(p => {
                      const pExit = p.exit_date || addDays(p.entry_date, p.planned_recovery_days || 14)
                      return pExit === plan.entry_date
                    })
                    const connectsRight = sorted.some(p => p.entry_date === exitDate)

                    // ── Season detection (Hemisferio Sur) ──
                    const entryMonth = new Date(plan.entry_date + 'T00:00:00').getMonth() + 1
                    const isCerrada = entryMonth >= 3 && entryMonth <= 8

                    // ── TRACK COLOR SYSTEM ──────────────────────────────────────────────
                    // Track 1 (top):    Plan ORIGINAL — verde pálido + candado (solo lectura)
                    // Track 2 (middle): Plan MODIFICADO/PLANIFICADO — azul celeste tramado (editable)
                    // Track 3 (bottom): Plan REAL — verde sólido (solo lectura, fechas/stock reales)

                    // Track 1 — Gris pálido (original locked, solo lectura)
                    const T1_BG     = 'rgba(209,213,219,0.30)'
                    const T1_BORDER = 'rgba(156,163,175,0.70)'
                    const T1_PAT    = 'rgba(107,114,128,0.20)'

                    // Track 2 — Azul celeste (planificado/modificado editable)
                    const T2_BG     = 'rgba(186,230,253,0.18)'
                    const T2_BORDER = 'rgba(14,165,233,0.55)'
                    const T2_PAT    = 'rgba(14,165,233,0.35)'

                    // Rojo para vencidos (pasó la fecha de salida, sin completar)
                    const T2_OVD_BG  = 'rgba(252,165,165,0.22)'
                    const T2_OVD_PAT = 'rgba(239,68,68,0.40)'
                    const T2_OVD_BOR = 'rgba(239,68,68,0.55)'

                    // Verde pastel (en pastoreo activo) — mismo verde del plan original anterior
                    const T2_ACT_BG  = 'rgba(134,239,172,0.28)'
                    const T2_ACT_PAT = 'rgba(34,197,94,0.30)'
                    const T2_ACT_BOR = 'rgba(22,163,74,0.80)'

                    const renderBlocks = []

                    // Helper para renderizar un bloque base
                    const createBlock = (
                      key: string, top: number, startPct: number, widthPctArg: number,
                      bg: string, border: string, pattern: string | null, isGrabbable: boolean,
                      opacity: number = 1, zIndex: number = 20, extraTitle: string = '', showLock: boolean = false,
                      innerLabel: string = '', innerLabelColor: string = '#4c1d95'
                    ) => {
                      const isManualResizable = !isDrawingMode && isGrabbable && !isCompleted && !hasRealEntry && !isSuggested
                      return (
                      <div
                        key={key}
                        style={{
                          position: 'absolute',
                          left: `${Math.min(startPct, 99)}%`,
                          // Ancho exacto en %; minWidth 0 — el mínimo ya lo garantiza oneDayPct en la lógica JS
                          width: `${Math.min(widthPctArg, 100 - Math.min(startPct, 99))}%`,
                          top: top,
                          height: BAR_H,
                          minWidth: 0,
                          borderTopLeftRadius: connectsLeft ? 0 : 4,
                          borderBottomLeftRadius: connectsLeft ? 0 : 4,
                          borderTopRightRadius: connectsRight ? 0 : 4,
                          borderBottomRightRadius: connectsRight ? 0 : 4,
                          border: `1.5px solid ${border}`,
                          backgroundColor: bg,
                          cursor: isGrabbable ? 'grab' : 'pointer',
                          zIndex: zIndex,
                          opacity: opacity,
                          overflow: 'visible',
                          backgroundImage: pattern ? `repeating-linear-gradient(45deg, transparent, transparent 4px, ${pattern} 4px, ${pattern} 8px)` : 'none',
                          backgroundSize: '8px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          paddingLeft: 4,
                          gap: 3,
                        }}
                        className="transition-all hover:brightness-90 relative group/block"
                        onMouseDown={e => !isDrawingMode && isGrabbable && !isCompleted && !hasRealEntry && handleMouseDown(e, plan)}
                        onClick={(e) => { 
                          e.stopPropagation()
                          if (!isDrawingMode) onBlockClick(plan, e) 
                        }}
                        title={`${extraTitle} — ${herdLabel} · ${isCompleted ? ' ✔ Completado' : ''}`}
                      >
                        {showLock && <Lock className="w-3 h-3 text-gray-800 opacity-70 shrink-0" />}
                        {innerLabel && (
                          <span
                            className="text-[8px] font-black truncate leading-none select-none"
                            style={{ color: innerLabelColor, maxWidth: '90%' }}
                          >
                            {innerLabel}
                          </span>
                        )}
                        {/* Resize handles — only for manual draggable blocks */}
                        {isManualResizable && (
                          <>
                            {/* Left edge handle */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center justify-center z-30"
                              style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.5), transparent)' }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                const entry = plan.is_locked && plan.adjusted_entry_date ? plan.adjusted_entry_date : plan.entry_date
                                const exit = plan.is_locked && plan.adjusted_exit_date ? plan.adjusted_exit_date : (plan.exit_date || addDays(plan.entry_date, 14))
                                resizing.current = { planId: plan.id, edge: 'left', startX: e.clientX, origEntry: entry, origExit: exit, plan }
                              }}
                              title="Arrastrar para cambiar fecha de entrada"
                            >
                              <div className="w-0.5 h-3/5 rounded-full bg-white/80" />
                              <div className="w-0.5 h-3/5 rounded-full bg-white/80 ml-px" />
                            </div>
                            {/* Right edge handle */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center justify-center z-30"
                              style={{ background: 'linear-gradient(to left, rgba(255,255,255,0.5), transparent)' }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                const entry = plan.is_locked && plan.adjusted_entry_date ? plan.adjusted_entry_date : plan.entry_date
                                const exit = plan.is_locked && plan.adjusted_exit_date ? plan.adjusted_exit_date : (plan.exit_date || addDays(plan.entry_date, 14))
                                resizing.current = { planId: plan.id, edge: 'right', startX: e.clientX, origEntry: entry, origExit: exit, plan }
                              }}
                              title="Arrastrar para cambiar fecha de salida"
                            >
                              <div className="w-0.5 h-3/5 rounded-full bg-white/80" />
                              <div className="w-0.5 h-3/5 rounded-full bg-white/80 ml-px" />
                            </div>
                          </>
                        )}
                      </div>
                      )
                    }

                    if (plan.is_locked && ganttLayers.showOriginal) {
                      renderBlocks.push(createBlock(`t1-${plan.id}`, 4, leftPct, widthPct, T1_BG, T1_BORDER, T1_PAT, false, 1, 5, '🔒 PLAN ORIGINAL — Solo lectura', true))
                    }

                    if (ganttLayers.showPlanned) {
                    if (isSuggested) {
                      // ── Color dinámico por season_plan_id (gradiente púrpura) ──
                      const spId = plan.ai_analysis?.season_plan_id as string | undefined
                      const spIdx = spId !== undefined ? (seasonPlanColorMap[spId] ?? 0) : 0
                      const pl = PURPLE_LEVELS[spIdx % PURPLE_LEVELS.length]
                      // ── Etiqueta interna: conteo de animales de esta planificación ──
                      const blockHerdIds: string[] = Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0
                        ? plan.herd_ids
                        : plan.herd_id ? [plan.herd_id] : []
                      const blockHerds = herds.filter((h: any) => blockHerdIds.includes(h.id))
                      const blockHeadCount = blockHerds.reduce((s: number, h: any) => s + (Number(h.head_count) || 0), 0)
                      const primaryBlockHerd = blockHerds[0]
                      const blockLabel = blockHeadCount > 0
                        ? `${blockHeadCount} ${primaryBlockHerd?.categoria || primaryBlockHerd?.name || 'cab.'}`
                        : (spId ? (seasonPlanNames[spId] || '') : '')
                      const planSourceName = spId ? (seasonPlanNames[spId] || 'Planificación sugerida') : 'Planificación sugerida'
                      // Rayas diagonales con el color de intensidad — sin etiqueta de texto
                      renderBlocks.push(createBlock(
                        `t2-${plan.id}`, TRACK2_TOP, leftPct, widthPct,
                        pl.bg, pl.border, pl.border, false, 1, 10,
                        `⚡ SUGERIDA — ${planSourceName}`,
                        false, '', ''
                      ))
                    } else {
                       const t2Entry = (plan.is_locked && plan.adjusted_entry_date) ? plan.adjusted_entry_date : plan.entry_date
                       const t2Exit  = (plan.is_locked && plan.adjusted_exit_date)  ? plan.adjusted_exit_date  : plan.exit_date
                       const t2EntryDiff = daysBetween(windowStart, t2Entry)
                       const t2Duration  = t2Exit ? daysBetween(t2Entry, t2Exit) : 14
                       const t2Left  = Math.max(0, (t2EntryDiff / windowDays) * 100)
                       const t2Width = Math.max(0.5, (t2Duration / windowDays) * 100)
                       const t2Bg  = isOverdue ? T2_OVD_BG  : isActiveNow ? T2_ACT_BG  : T2_BG
                       const t2Bor = isOverdue ? T2_OVD_BOR : isActiveNow ? T2_ACT_BOR : T2_BORDER
                       const t2Pat = isOverdue ? T2_OVD_PAT : isActiveNow ? T2_ACT_PAT : T2_PAT
                       const t2Title = isOverdue
                         ? '⚠️ PLAN VENCIDO — Fecha superada sin completar'
                         : isActiveNow
                         ? '🟢 EN PASTOREO — Plan en curso'
                         : (plan.is_locked ? '✏️ PLAN MODIFICABLE' : '✏️ PLAN MODIFICABLE')

                       renderBlocks.push(
                         createBlock(
                           `t2-${plan.id}`, 30, t2Left, t2Width, t2Bg, t2Bor, t2Pat,
                           !isCompleted,
                           1, 10,
                           t2Title
                         )
                       )
                       // Indicador de pulso para plan en pastoreo activo
                       if (isActiveNow) {
                         renderBlocks.push(
                           <div
                             key={`t2-pulse-${plan.id}`}
                             style={{
                               position: 'absolute',
                               left: `calc(${Math.min(t2Left, 99)}% + 4px)`,
                               top: 30 + 4,
                               zIndex: 15,
                               display: 'flex',
                               alignItems: 'center',
                               gap: 3,
                               pointerEvents: 'none',
                             }}
                           >
                             <span style={{
                               display: 'inline-block',
                               width: 6,
                               height: 6,
                               borderRadius: '50%',
                               backgroundColor: '#059669',
                               animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
                               boxShadow: '0 0 0 0 rgba(5,150,105,0.7)',
                             }} />
                           </div>
                         )
                       }
                     }
                    } // end ganttLayers.showPlanned

                    // ── TRACK 3: Plan Real (solo cuando completado o tiene entrada real) ──
                    const effectiveRealEntry = plan.actual_entry_date || (isCompleted ? plan.entry_date : null)
                    if (effectiveRealEntry && isCompleted && ganttLayers.showReal) {
                      const realExit      = plan.actual_exit_date || exitDate
                      const realEntryDiff = daysBetween(windowStart, effectiveRealEntry)
                      const realDuration  = daysBetween(effectiveRealEntry, realExit)
                      const realLeft      = Math.max(0, (realEntryDiff / windowDays) * 100)
                      const realWidth     = Math.max(oneDayPct, (realDuration / windowDays) * 100)

                      const plannedDuration = daysBetween(plan.entry_date, exitDate)
                      const devDays  = realDuration - plannedDuration
                      const devLabel = devDays === 0 ? '= plan' : (devDays > 0 ? `+${devDays}d` : `${devDays}d`)
                      const GREEN    = '#16a34a'
                      const devColor = devDays === 0 ? '#14532d' : devDays > 0 ? '#991b1b' : '#1e40af'
                      // Stock de cierre para el tooltip
                      const closingMs = plan.exit_dry_matter_kg_ha ? `${plan.exit_dry_matter_kg_ha}kg/ha` : null

                      renderBlocks.push(
                        <div
                          key={`real-${plan.id}`}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(realLeft, 99)}%`,
                            width: `${Math.min(realWidth, 100 - Math.min(realLeft, 99))}%`,
                            top: TRACK3_TOP,
                            height: BAR_H,
                            minWidth: 0,
                            borderRadius: 3,
                            backgroundColor: GREEN,
                            zIndex: 15,
                            cursor: 'pointer',
                            boxShadow: `0 1px 4px ${GREEN}55`,
                            overflow: 'visible',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: 4,
                          }}
                          onClick={(e) => { e.stopPropagation(); onBlockClick(plan, e) }}
                          title={`REAL: ${herdLabel} · ${fmt(effectiveRealEntry)}→${fmt(realExit)}${closingMs ? ` · MS remanente: ${closingMs}` : ''} · Desvío: ${devLabel}`}
                        >
                          <span
                            className="text-[7px] font-black px-1 py-0.5 rounded shrink-0 whitespace-nowrap"
                            style={{ backgroundColor: devColor, color: 'white', marginRight: -2 }}
                          >
                            {devLabel}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <React.Fragment key={plan.id}>
                        {renderBlocks}
                        {/* ── Ajuste Climático: ícono pequeño al costado del bloque ── */}
                        {climateViewEnabled && isActiveNow && aAdj !== 1.0 && (
                          <div
                            style={{
                              position: 'absolute',
                              // Posicionar al costado derecho del bloque planificado
                              left: `calc(${leftPct}% + ${widthPct}% + 3px)`,
                              top: TRACK2_TOP + 2,
                              zIndex: 15,
                              pointerEvents: 'auto',
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <GanttClimateAlert
                              compact
                              paddockName={paddock.name}
                              originalDays={baseDuration}
                              adjustedDays={adjustedDuration}
                              alertLevel={Math.abs(deltaClimate) >= 3 ? 'critical' : 'warning'}
                              stressType={'auto'}
                              alertMessage={`Multiplicador de demanda: ×${aAdj.toFixed(2)}`}
                              dailyDemand={ghostDailyDemand}
                              aAdj={aAdj}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })
                })()}
                {/* ── No more per-row event diamonds; they are now shown once in the Agenda header row above ── */}
              </div>
            </div>
          )
        })}

        {/* ── Potreros Inhabilitados / Sin MS ── */}
        {inactivePaddocks.length > 0 && (
          <div className="bg-gray-50 border-t border-gray-100 p-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300"></span>
              Potreros Inhabilitados o Sin Disponibilidad ({inactivePaddocks.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {inactivePaddocks.map(paddock => (
                <div key={paddock.id} className="flex items-center gap-2 bg-white border border-gray-200 pl-2 pr-3 py-1.5 rounded-xl shadow-sm opacity-70 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onPaddockToggle?.(paddock.id, true)}
                    title="Habilitar potrero"
                    className="shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                  >
                    <ToggleLeft className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold text-gray-600 truncate max-w-[140px]">{paddock.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )
        })()}

        {/* ── Totales del Sistema (fina, sobre la fila de clima) ── */}
        {(() => {
          const sysHa = paddocks.reduce((s: number, p: any) => s + (Number(p.area_ha) || 0), 0)
          const sysMs = paddocks.reduce((s: number, p: any) => s + (Number(p.dry_matter_kg_ha) || 0) * (Number(p.area_ha) || 0), 0)
          return (
            <div className="flex border-t border-gray-100 bg-gray-50/60" style={{ minHeight: 22 }}>
              <div
                style={{ width: LABEL_W, minWidth: LABEL_W }}
                className="px-3 flex items-center gap-2 border-r border-gray-100 shrink-0 sticky left-0 z-20 bg-gray-50"
              >
                <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Total campo</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[8px] font-black text-gray-600">{sysHa.toFixed(0)}<span className="font-normal text-gray-400 ml-0.5">ha</span></span>
                  <span className="w-px h-2.5 bg-gray-200" />
                  <span className="text-[8px] font-black text-gray-600">{Math.round(sysMs).toLocaleString('es')}<span className="font-normal text-gray-400 ml-0.5">kg MS</span></span>
                </div>
              </div>
              <div className="flex flex-1">
                {MONTHS_FOOTER.map(m => (
                  <div key={m.key} className="border-r border-gray-100 shrink-0" style={{ width: `${m.widthPct}%`, minWidth: 60 }} />
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── Footer: fila unificada Resumen + Clima por mes ── */}
        {(() => {
          // Build plansPerMonth: which plans fall (entry or exit) in each month
          const plansPerMonth: Record<string, import('@/components/GanttClimateMonthRow').PlanInMonth[]> = {}
          MONTHS_FOOTER.forEach(m => { plansPerMonth[m.key] = [] })
          plans.forEach(plan => {
            const entryKey = (plan.entry_date || '').substring(0, 7)
            const exitKey  = (plan.exit_date  || '').substring(0, 7)
            const mult     = paddockCAdj?.[plan.paddock_id] ?? 1.0
            const paddock  = paddocks.find(p => p.id === plan.paddock_id)
            const durationDays = plan.entry_date && plan.exit_date
              ? Math.max(1, Math.round((new Date(plan.exit_date).getTime() - new Date(plan.entry_date).getTime()) / 86400000))
              : 21
            const entry: import('@/components/GanttClimateMonthRow').PlanInMonth = {
              id: plan.id,
              paddockName: paddock?.name || plan.paddock_id,
              paddockId: plan.paddock_id,
              baseDays: durationDays,
              cAdj: paddockCAdj?.[plan.paddock_id] ?? 1.0,
              aAdj: paddockAAdj?.[plan.paddock_id] ?? 1.0,
              areaHa: Number(paddock?.area_ha) || 0,
              isPlanModified: !plan.is_locked,
            }
            if (plansPerMonth[entryKey]) plansPerMonth[entryKey].push(entry)
            else if (plansPerMonth[exitKey]) plansPerMonth[exitKey].push(entry)
          })

          // Build herdsPerMonth from activeHerdsInWindow
          const herdsPerMonth: Record<string, import('@/components/GanttClimateMonthRow').HerdInMonth[]> = {}
          MONTHS_FOOTER.forEach(m => {
            herdsPerMonth[m.key] = activeHerdsInWindow.map(h => ({
              id: h.id,
              name: h.name,
              headCount: Number(h.head_count) || 0,
              totalEv: Number(h.total_ev ?? (h as any).totalEv ?? 0),
            }))
          })

          return (
            <GanttClimateMonthRow
              months={MONTHS_FOOTER}
              plansPerMonth={plansPerMonth}
              herdsPerMonth={herdsPerMonth}
              growthPerMonth={{}}
              rainfallPerMonth={rainfallData}
              seasonalMult={SEASONAL_MS_GROWTH}
              labelW={LABEL_W}
              climateEnabled={climateViewEnabled}
              onApplyMonthAdjustment={(monthKey, adjustments) => {
                console.log('[clima] Aplicar ajuste mes', monthKey, adjustments)
                // TODO: wire to handleBlockMove / plan PATCH per adjustment
              }}
            />
          )
        })()}

              {/* Row — Tipo de Animal (planilla de control por rodeo) — sticky al fondo */}

              {ganttLayers.showAnimals && (() => {
                if (activeHerdsInWindow.length === 0) return null

                // Column header row
                return (
                  <div className="sticky bottom-0 z-30 bg-white border-t-2 border-gray-300 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    {/* The inner div matches the exact width of the Gantt content so the columns scroll in sync */}
                    <div style={{ minWidth: Math.max(1000, windowDays * 6 + LABEL_W) }}>

                    {/* Section title + column headers */}
                    <div className="flex bg-gray-100" style={{ minHeight: 26 }}>
                      {/* Sticky label */}
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2.5 flex items-center justify-between border-r border-gray-300 shrink-0 sticky left-0 z-20 bg-gray-100 shadow-[4px_0_12px_rgba(0,0,0,0.05)]">
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-left">Tipo de Animal</span>
                        <div className="flex items-center gap-1">
                          {/* Eye icon — colapsa/expande toda la sección */}
                          <button
                            onClick={() => setHerdSectionCollapsed(s => !s)}
                            title={herdSectionCollapsed ? 'Mostrar animales' : 'Ocultar animales'}
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            {herdSectionCollapsed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => setShowAnnualHerdModal(true)}
                            className="flex items-center gap-1 text-[8px] font-bold text-gray-400 hover:text-green-600 transition-colors bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200"
                            title="Ver detalle ampliado"
                          >
                            <Users className="w-3 h-3" /> Ampliar
                          </button>
                        </div>
                      </div>
                      {/* Month header columns — fixed width matching Gantt */}
                      <div className="flex flex-1">
                        {MONTHS_FOOTER.map(m => {
                          // ── Alerta preventiva de demanda vs crecimiento forrajero ──
                          // ── Alerta de consumo acelerado por clima (A_adj > 1.0) ──
                          // Solo se muestra en el MES ACTUAL — no aplicar el clima de hoy
                          // a meses futuros (sería incorrecto mostrar alerta de frío en verano).
                          const currentMonthKey = new Date().toISOString().substring(0, 7)
                          const isCurrentMonth = m.key === currentMonthKey
                          const avgAAdj = climateViewEnabled && Object.keys(paddockAAdj).length > 0
                            ? Object.values(paddockAAdj).reduce((s, v) => s + v, 0) / Object.values(paddockAAdj).length
                            : 1.0
                          // Solo mostrar en el mes actual, y solo si el ajuste animal supera el umbral (>5%)
                          const hasClimateAlert = climateViewEnabled && isCurrentMonth && avgAAdj > 1.05
                          const racionUsuario = dailyAllocationKg
                          const racionAjustada = Math.round(racionUsuario * avgAAdj)
                          return (
                          <div
                            key={m.key}
                            className={`border-r border-gray-300 flex flex-col items-center justify-center px-0.5 overflow-visible shrink-0 gap-0.5 ${hasClimateAlert ? 'bg-orange-50' : ''}`}
                            style={{ width: `${m.widthPct}%`, minWidth: 60 }}
                          >
                            {hasClimateAlert && (
                              <div className="relative w-full flex justify-center">
                                <span 
                                  className="text-[7px] font-black px-1 rounded cursor-help text-orange-700 bg-orange-100"
                                  title={`Consumo acelerado por clima:\nEl frío o estrés ambiental eleva el requerimiento de los animales (o el desperdicio por pisoteo). El rodeo consume hoy una ración efectiva de ${racionAjustada} kg en lugar de los ${racionUsuario} kg planificados, agotando el stock antes de tiempo.`}
                                >
                                  ⚠ Alta demanda
                                </span>
                              </div>
                            )}
                            <div className="flex w-full">
                              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-[2] text-left pl-1 truncate">Núm.</span>
                              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left truncate">Peso</span>
                              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left truncate">%EV</span>
                              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left truncate">Total EV</span>
                            </div>
                          </div>
                          )
                        })}

                      </div>
                    </div>

                    {/* Chip row para animales ocultos */}
                    {hiddenHerdIds.size > 0 && (
                      <div className="flex items-center px-4 py-1 bg-amber-50 border-t border-amber-100 gap-2">
                        <span className="text-[8px] font-bold text-amber-700 uppercase">Ocultos:</span>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(hiddenHerdIds).map(id => {
                            const h = activeHerdsInWindow.find(x => x.id === id)
                            return h && (
                              <button key={id} onClick={() => toggleHerdVisibility(id)} className="text-[8px] px-1.5 py-0.5 bg-white border border-amber-200 rounded text-amber-700 hover:bg-amber-100 transition-colors">
                                {h.name} ×
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* One row per herd — respeta visibilidad */}
                    {!herdSectionCollapsed && activeHerdsInWindow.map((herd, hi) => {
                      if (hiddenHerdIds.has(herd.id)) return null
                      return (
                      <div key={herd.id} className={`flex border-t border-gray-200 ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} style={{ minHeight: 28 }}>
                        {/* Herd name — sticky left */}
                        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className={`pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0 gap-1 justify-between sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.05)] ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-1 min-w-0">
                            <button
                              className="text-[8px] font-black text-gray-700 truncate hover:text-green-700 hover:underline transition-colors text-left"
                              onClick={() => onHerdClick?.(herd)}
                            >
                              {hi + 1}. {herd.name}
                            </button>
                            {herd.exit_date && (
                              <span className="text-[7px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded-md tracking-wider shrink-0">TEMP</span>
                            )}
                            {herd.category && !herd.exit_date && (
                              <span className="text-[7px] text-gray-400 font-medium shrink-0">({herd.category})</span>
                            )}
                          </div>

                        </div>
                        {/* Monthly data — fixed width columns */}
                        <div className="flex flex-1">
                          {MONTHS_FOOTER.map(m => {
                            const monthPlansForHerd = plans.filter(p =>
                              (p.herd_ids || []).includes(herd.id) &&
                              (p.exit_date || p.entry_date) >= m.startDate &&
                              p.entry_date <= m.endDate
                            )
                            const herdEntry = herd.admission_date || '2000-01-01'
                            const herdExit = herd.exit_date || '2100-01-01'
                            const herdActiveThisMonth = herdEntry <= m.endDate && herdExit >= m.startDate
                            const currentHeadCount = Number(herd.head_count) || 0
                            const headCount = herdActiveThisMonth ? getDynamicHeadcount(herd.id, currentHeadCount, m.startDate) : 0
                            const pesoBase = Number(herd.avg_weight_kg) || 0
                            const referenceDate = new Date().toISOString().split('T')[0]
                            const peso = herdActiveThisMonth ? Math.round(calcularPesoParaMes(herd, m.startDate, referenceDate)) : pesoBase
                            const gainedWeight = peso - pesoBase
                            const catKey = herd.categoria as string
                            // ── EV correcto para la tabla: total_ev de DB + crecimiento relativo ──
                            // calcularEvParaMes usa total_ev como ancla (no PHYSIO_EV_BASE)
                            // y aplica multiplicadores relativos de peso y fenología para meses futuros.
                            const ev = herdActiveThisMonth && headCount > 0
                              ? calcularEvParaMes(herd, m.startDate, headCount, 'primavera', referenceDate)
                              : 0
                            const evPerHead = headCount > 0 && ev > 0
                              ? ev / headCount
                              : (EV_BASE[catKey] ?? 1.0)
                            const active = monthPlansForHerd.length > 0 && herdActiveThisMonth
                            return (
                              <div
                                key={m.key}
                                className={`border-r border-gray-200 flex items-center justify-around px-1 overflow-hidden shrink-0 ${active ? 'bg-sky-50/40' : ''}`}
                                style={{ width: `${m.widthPct}%`, minWidth: 60 }}
                              >
                                {/* Núm. — editable, key fuerza remount cuando headCount cambia */}
                                {herdActiveThisMonth ? (
                                  <input
                                    key={`${herd.id}-${m.key}-${headCount}`}
                                    type="number"
                                    defaultValue={headCount || ''}
                                    min={0}
                                    className="text-[8px] font-black text-gray-700 flex-[2] text-left pl-1 w-0 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-sky-400 focus:outline-none rounded-none transition-colors"
                                    title="Editar cabezas"
                                    onBlur={async (e) => {
                                      const newVal = parseInt(e.target.value, 10)
                                      if (isNaN(newVal) || newVal === headCount) return
                                      const diff = newVal - headCount
                                      const isAdd = diff > 0
                                      try {
                                        const currentHerd = herds.find((h: any) => h.id === herd.id)
                                        const existingLog: any[] = Array.isArray(currentHerd?.technical_data?.stock_log)
                                          ? currentHerd.technical_data.stock_log
                                          : []
                                        const newTechData = {
                                          ...(currentHerd?.technical_data || {}),
                                          stock_log: [
                                            ...existingLog,
                                            {
                                              date: new Date().toISOString().split('T')[0],
                                              month: m.key,
                                              delta: diff,
                                              total: newVal,
                                              note: isAdd
                                                ? `Se agregaron ${Math.abs(diff)} animales el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                                                : `Se retiraron ${Math.abs(diff)} animales el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
                                            },
                                          ],
                                        }
                                        const res = await apiFetch(`/api/herds/${herd.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ head_count: newVal, technical_data: newTechData }),
                                        })
                                        if (res.ok) {
                                          toast.success(
                                            isAdd
                                              ? `Se agregaron ${Math.abs(diff)} animales a ${herd.name}`
                                              : `Se retiraron ${Math.abs(diff)} animales de ${herd.name}`
                                          )
                                          if (typeof window !== 'undefined') window.dispatchEvent(new Event('rodeo-data-reload'))
                                        } else {
                                          toast.error('No se pudo guardar')
                                          e.target.value = String(headCount)
                                        }
                                      } catch { toast.error('Error de conexión'); e.target.value = String(headCount) }
                                    }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                  />
                                ) : (
                                  <span className="text-[8px] font-black text-gray-300 flex-[2] text-left pl-1 w-0 truncate">—</span>
                                )}
                                {/* Peso */}
                                <span className="text-[8px] font-bold text-gray-500 flex-1 text-left w-0 truncate relative group cursor-default">
                                  {herdActiveThisMonth ? (
                                    <>
                                      {peso > 0 ? peso : `~${450}`}
                                      {gainedWeight > 0 && (
                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                          Crecimiento proyectado: +{gainedWeight} kg
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                        </div>
                                      )}
                                    </>
                                  ) : '—'}
                                </span>
                                {/* % EV */}
                                <span className="text-[8px] font-bold text-gray-500 flex-1 text-left w-0 truncate">
                                  {herdActiveThisMonth && headCount > 0 && ev > 0 ? (ev / headCount).toFixed(2) : '—'}
                                </span>
                                {/* Total EV */}
                                <span className="text-[8px] font-black text-green-700 flex-1 text-left w-0 truncate">
                                  {herdActiveThisMonth && ev > 0 ? ev.toFixed(0) : '—'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      )
                    })}



                    {/* Total row */}
                    <div className="flex border-t border-gray-300 bg-gray-100" style={{ minHeight: 24 }}>
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-2.5 flex items-center border-r border-gray-300 shrink-0 sticky left-0 z-20 bg-gray-100">
                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Total</span>
                      </div>
                      <div className="flex flex-1">
                        {MONTHS_FOOTER.map(m => {
                          let totalCabMes = 0
                          let totalEvMes = 0
                          activeHerdsInWindow.forEach(h => {
                            const herdEntry = h.admission_date || '2000-01-01'
                            const herdExit = h.exit_date || '2100-01-01'
                            if (herdEntry <= m.endDate && herdExit >= m.startDate) {
                              const hc = getDynamicHeadcount(h.id, Number(h.head_count) || 0, m.startDate)
                              const referenceDate = new Date().toISOString().split('T')[0]
                              // ── Total row: mismo motor correcto que las filas individuales ──
                              const evHerd = hc > 0
                                ? calcularEvParaMes(h, m.startDate, hc, 'primavera', referenceDate)
                                : 0

                              totalCabMes += hc
                              totalEvMes += evHerd
                            }
                          })
                          return (
                            <div
                              key={m.key}
                              className="border-r border-gray-300 flex items-center justify-around px-0.5 overflow-hidden shrink-0"
                              style={{ width: `${m.widthPct}%`, minWidth: 60 }}
                            >
                              {totalCabMes > 0 ? (
                                <>
                                  <span className="text-[8px] font-black text-gray-800 flex-[2] text-left pl-1 truncate">{totalCabMes}</span>
                                  <span className="text-[8px] font-bold text-gray-400 flex-1 text-left truncate">—</span>
                                  <span className="text-[8px] font-bold text-gray-400 flex-1 text-left truncate">—</span>
                                  <span className="text-[8px] font-black text-green-700 flex-1 text-left truncate">{totalEvMes.toFixed(0)}</span>
                                </>
                              ) : (
                                <span className="text-[8px] text-gray-200 w-full text-center truncate">—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>


                    {/* Split button: + Rodeo | + Temporario */}
                    <div className="flex border-t border-dashed border-green-200 bg-white" style={{ minHeight: 30 }}>
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2 flex items-center border-r border-green-200 shrink-0 gap-1.5 sticky left-0 z-20 bg-white shadow-[4px_0_12px_rgba(0,0,0,0.05)]">
                        <button
                          onClick={() => onAddHerd?.('permanente')}
                          className="text-[8px] font-bold text-green-700 flex items-center gap-0.5 hover:text-green-900 transition-colors"
                        >
                          <span className="text-xs leading-none">+</span> Rodeo
                        </button>
                        <span className="text-gray-300 text-[10px]">|</span>
                        <button
                          onClick={() => onAddHerd?.('temporal')}
                          className="text-[8px] font-bold text-sky-600 flex items-center gap-0.5 hover:text-sky-800 transition-colors"
                        >
                          <span className="text-xs leading-none">+</span> Temporario
                        </button>
                      </div>
                      <div className="flex-1" />
                    </div>

                    </div>{/* end minWidth wrapper */}
                  </div>
                )
               })()}


      </div>
    </div>
    {/* ── Legend bar: fuera del scroll container para que sea siempre visible */}
    <div className="flex items-center gap-3 px-4 py-2.5 border border-t-0 border-gray-200 bg-white rounded-b-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex-wrap">
      <div className="flex items-center gap-3 mr-2">
        {/* Track 1 — Plan Original */}
        <div className="flex items-center gap-1.5">
          <div className="relative w-8 h-4 border-[1.5px] rounded-sm overflow-hidden" style={{ borderColor: 'rgba(156,163,175,0.70)', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(107,114,128,0.20) 3px, rgba(107,114,128,0.20) 6px)', backgroundColor: 'rgba(209,213,219,0.30)' }}>
            <Lock className="absolute inset-0 m-auto w-2.5 h-2.5 text-gray-700 opacity-60" />
          </div>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Plan original</span>
        </div>
        {/* Track 2 — Plan Modificado */}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-4 border-[1.5px] border-sky-500 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(14,165,233,0.35) 3px, rgba(14,165,233,0.35) 6px)', backgroundColor: 'rgba(186,230,253,0.18)' }} />
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Plan planificado/modificable</span>
        </div>
        {/* Track 3 — Plan Real */}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-4 rounded-sm bg-green-600" />
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Plan real</span>
        </div>
      </div>
      {ganttLayers.showAgenda && (
        <>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Agenda:</span>
          {Object.entries(EVT_CONFIG).filter(([key]) => !['mortandad', 'compra', 'venta', 'stock_inicial', 'ajuste_entrada', 'ajuste_salida', 'ajuste'].includes(key)).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-[9px] font-bold text-gray-500">{cfg.label}</span>
            </div>
          ))}
        </>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        <div className="w-px h-3" style={{ borderLeft: '1.5px dashed rgba(34,197,94,0.8)' }} />
        <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Hoy</span>
      </div>
    </div>
    {eventPopup}

    {/* ── Drawing Tooltip — pegado al cursor durante el trazado ── */}
    {drawingState && (() => {
      const d1 = Math.min(drawingState.startDay, drawingState.currentDay)
      const d2 = Math.max(drawingState.startDay, drawingState.currentDay)
      const days = d2 - d1 + 1
      const startDateStr = addDays(windowStart, d1)
      const startDateFmt = new Date(startDateStr + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      const isAlert = drawingState.isOverOptimal
      const tipX = Math.min(drawingState.mousePos.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 800) - 190)
      const tipY = drawingState.mousePos.y - 56
      return (
        <div
          className="fixed z-[2000] pointer-events-none select-none"
          style={{ left: tipX, top: tipY }}
        >
          <div className={`rounded-xl shadow-2xl border px-3 py-2 text-[11px] font-bold leading-tight ${
            isAlert
              ? 'bg-red-900/90 text-white border-red-500/60'
              : 'bg-gray-900/90 text-white border-white/10'
          }`}>
            <div className="font-black">{startDateFmt}</div>
            <div className={`mt-0.5 flex items-center gap-1 ${ isAlert ? 'text-red-300' : 'text-green-300' }`}>
              <span className="text-base leading-none">{isAlert ? '⚠' : '✓'}</span>
              <span>{days} día{days !== 1 ? 's' : ''}</span>
              {isAlert && drawingState.optimalDays > 0 && (
                <span className="text-red-400 text-[9px]">/ óptimo {drawingState.optimalDays}d</span>
              )}
            </div>
            {drawingHerdsLabel && (
              <div className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[160px]">{drawingHerdsLabel}</div>
            )}
          </div>
        </div>
      )
    })()}

    {/* ── Drag / Resize Tooltip — fechas al mover o estirar un bloque ── */}
    {dragTooltip && (
      <div
        className="fixed z-[2000] pointer-events-none select-none"
        style={{
          left: Math.min(dragTooltip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 800) - 180),
          top: dragTooltip.y - 48,
        }}
      >
        <div className="bg-gray-900/90 text-white border border-white/10 rounded-xl shadow-2xl px-3 py-2 text-[11px] font-bold">
          <span>{new Date(dragTooltip.entry + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
          <span className="mx-1.5 text-gray-400">→</span>
          <span>{new Date(dragTooltip.exit + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
          <span className="ml-1.5 text-gray-400">{daysBetween(dragTooltip.entry, dragTooltip.exit)}d</span>
        </div>
      </div>
    )}

    {/* ── Gap Detail Panel ── */}
    {selectedGap && (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[1000]"
          onClick={() => setSelectedGap(null)}
        />
        {/* Panel */}
        <div className="fixed right-0 top-0 h-full w-80 z-[1001] bg-white border-l border-gray-100 shadow-2xl flex flex-col animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className={`px-6 pt-8 pb-6 border-b ${selectedGap.severity === 'critical' ? 'border-red-100 bg-red-50/60' : selectedGap.severity === 'medium' ? 'border-amber-100 bg-amber-50/60' : 'border-yellow-100 bg-yellow-50/40'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${selectedGap.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${selectedGap.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                  Déficit de Planificación
                </p>
              </div>
              <button
                onClick={() => setSelectedGap(null)}
                className="w-6 h-6 rounded-lg bg-white/80 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white transition-all text-xs border border-gray-100"
              >✕</button>
            </div>
            <h3 className="text-2xl font-black text-gray-950 leading-tight">
              {selectedGap.deficit_days} día{selectedGap.deficit_days !== 1 ? 's' : ''} sin forraje
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(selectedGap.start_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })}
              {' → '}
              {new Date(selectedGap.end_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
            {/* Severity badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              selectedGap.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
              selectedGap.severity === 'medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedGap.severity === 'critical' ? '#ef4444' : selectedGap.severity === 'medium' ? '#f59e0b' : '#fbbf24' }} />
              Severidad {selectedGap.severity === 'critical' ? 'Crítica' : selectedGap.severity === 'medium' ? 'Moderada' : 'Baja'}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">EV afectados</p>
                <p className="text-xl font-black text-gray-950">{selectedGap.affected_ev.toLocaleString('es')}</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Días de déficit</p>
                <p className="text-xl font-black text-gray-950">{selectedGap.deficit_days}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Déficit estimado de forraje</p>
              <p className="text-xl font-black text-gray-950">{selectedGap.deficit_kg_ms.toLocaleString('es')}</p>
              <p className="text-[10px] text-gray-400 font-medium">kg MS ({(selectedGap.deficit_kg_ms / 1000).toFixed(1)} t)</p>
            </div>

            {/* Alert box */}
            <div className={`rounded-xl p-4 border ${selectedGap.severity === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${selectedGap.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                Atención requerida
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">
                El rodeo no tiene potrero asignado para este período.
                Revisá tu estrategia de carga o suplementación para estas fechas.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-3 border-t border-gray-100">
            <button
              onClick={() => setSelectedGap(null)}
              className="w-full py-3 text-sm font-black text-gray-900 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </>
    )}

    {showHerdDecisionModal && (
      <div className="fixed inset-0 z-[9999] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
          <button onClick={() => setShowHerdDecisionModal(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
          <h3 className="text-lg font-black text-gray-900 mb-2">Añadir Animales</h3>
          <p className="text-xs text-gray-500 mb-6 font-medium">¿Qué tipo de stock necesitás registrar?</p>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowHerdDecisionModal(false)
                window.location.href = '/dashboard/herds'
              }}
              className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-green-100 flex items-center justify-center shrink-0 transition-colors">
                <Users className="w-4 h-4 text-gray-500 group-hover:text-green-700 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Rodeo Permanente</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Se mantendrá en tu stock general y estará disponible para todas las planificaciones futuras.</p>
              </div>
            </button>
            
            <button
              onClick={() => {
                setShowHerdDecisionModal(false)
                alert("Flujo de animales temporales en construcción.")
              }}
              className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-amber-100 flex items-center justify-center shrink-0 transition-colors">
                <Clock className="w-4 h-4 text-gray-500 group-hover:text-amber-700 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Animales Temporales</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Animales de paso o engorde rápido que solo afectarán a un pastoreo específico.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ANNUAL VIEW HERD MODAL */}
    {showAnnualHerdModal && typeof document !== 'undefined' && createPortal(
      <>
        <div className="fixed inset-0 z-[9999] bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowAnnualHerdModal(false)} />
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white rounded-3xl shadow-2xl max-w-[95vw] w-full max-h-[90vh] flex flex-col pointer-events-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Detalle de carga animal</h2>
                <p className="text-xs text-gray-500 font-medium mt-1">Composición mensual — hacé clic en las cabezas para editar</p>
              </div>
              <button onClick={() => setShowAnnualHerdModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="overflow-x-auto overscroll-x-none overflow-y-auto p-0 m-6 rounded-2xl border border-gray-200">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
                  <tr>
                    <th rowSpan={2} className="py-3 px-4 text-[10px] font-black tracking-widest text-gray-500 uppercase border-r border-gray-200 bg-white sticky left-0 z-30 shadow-[1px_0_0_0_#e5e7eb]">Rodeo</th>
                    {MONTHS_FOOTER.map(m => {
                      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                      const label = `${monthNames[m.month]} ${m.key.split('-')[0]}`
                      return (
                        <th colSpan={4} key={m.key} className="py-2 px-2 text-[10px] font-black tracking-widest text-gray-600 uppercase text-center border-r border-gray-200 bg-gray-50">
                          {label}
                        </th>
                      )
                    })}
                  </tr>
                  <tr>
                    {MONTHS_FOOTER.map(m => (
                      <React.Fragment key={m.key}>
                        <th className="py-2 px-1 text-[9px] font-bold tracking-widest text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">Núm</th>
                        <th className="py-2 px-1 text-[9px] font-bold tracking-widest text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">Peso</th>
                        <th className="py-2 px-1 text-[9px] font-bold tracking-widest text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">%EV</th>
                        <th className="py-2 px-1 text-[9px] font-bold tracking-widest text-green-700 uppercase text-left border-r border-gray-200 bg-gray-50 border-t border-gray-200">EV</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {herds.map((herd: any, i: number) => {
                    const currentHeadCount = Number(herd.head_count) || 0
                    const peso = Number(herd.avg_weight_kg) || 0
                    let herdEntry = herd.admission_date || '2000-01-01'
                    const herdExit = herd.exit_date || '2100-01-01'

                    // Asegurar que si el rodeo está planificado antes de su fecha de alta, aparezca
                    const herdPlans = plans.filter(p => (p.herd_ids || []).includes(herd.id) && p.status !== 'DELETED')
                    for (const p of herdPlans) {
                      const entry = p.entry_date || p.estimated_entry_date
                      if (entry && entry < herdEntry) {
                        herdEntry = entry
                      }
                    }

                    return (
                      <tr key={herd.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="py-3 px-4 text-xs font-black text-gray-800 border-r border-gray-200 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb] whitespace-nowrap cursor-pointer hover:text-green-700 transition-colors">
                          {i + 1}. {herd.name}
                          {herd.is_temporary && <span className="ml-1 text-[8px] text-sky-600 font-black">TMP</span>}
                        </td>
                        {MONTHS_FOOTER.map(m => {
                          const herdActiveThisMonth = herdEntry <= m.endDate && herdExit >= m.startDate
                          if (!herdActiveThisMonth) {
                            return <td colSpan={4} key={m.key} className="py-3 px-1 text-xs text-gray-200 text-center border-r border-gray-200">—</td>
                          }
                          // ── Proyección de EV y Peso ──
                          const headCount = getDynamicHeadcount(herd.id, currentHeadCount, m.startDate)
                          const catU = herd.categoria?.toUpperCase() || 'VACAS'
                          const referenceDate = new Date().toISOString().split('T')[0]
                          const pesoDinamico = Math.round(calcularPesoParaMes(herd, m.startDate, referenceDate))
                          const gainedWeight = pesoDinamico - peso
                          const pesoForCalc = pesoDinamico > 0 ? pesoDinamico
                            : (CATEGORIA_PESO_DEFAULT[catU as keyof typeof CATEGORIA_PESO_DEFAULT] ?? 450)
                          const ev = headCount > 0 ? calcularEvParaMes(herd, m.startDate, headCount, 'primavera', referenceDate) : 0
                          const evPerH = headCount > 0 && ev > 0 ? ev / headCount : (EV_BASE[catU] ?? 1.0)
                          const eqPct = ev > 0 && headCount > 0 ? evPerH.toFixed(2) : '—'
                          return (
                            <React.Fragment key={m.key}>
                              <td className="py-1 px-1 text-left">
                                <input
                                  key={`ampliar-${herd.id}-${m.key}-${headCount}`}
                                  type="number" min={0}
                                  defaultValue={headCount || ''}
                                  className="w-12 text-[11px] font-black text-gray-800 text-left bg-transparent border-b border-transparent hover:border-gray-300 focus:border-green-500 focus:outline-none rounded-none transition-colors"
                                  onBlur={async (e) => {
                                    const newVal = parseInt(e.target.value, 10)
                                    if (isNaN(newVal) || newVal === headCount) return
                                    const delta = newVal - headCount
                                    if (delta === 0) return
                                    const isAdd = delta > 0
                                    const q = Math.abs(delta)
                                    const oldEv = Number(herd.total_ev) || 0
                                    const oldHc = Number(herd.head_count) || 1
                                    const newEv = newVal * (oldEv / Math.max(1, oldHc))
                                    
                                    try {
                                      // Construir log interno del rodeo (sin crear evento en el calendario)
                                      const currentHerd = herds.find((h: any) => h.id === herd.id)
                                      const existingLog: any[] = Array.isArray(currentHerd?.technical_data?.stock_log)
                                        ? currentHerd.technical_data.stock_log
                                        : []
                                      const newTechData = {
                                        ...(currentHerd?.technical_data || {}),
                                        stock_log: [
                                          ...existingLog,
                                          {
                                            date: new Date().toISOString().split('T')[0],
                                            month: m.key,
                                            delta,
                                            total: newVal,
                                            note: isAdd
                                              ? `Se agregaron ${q} animales el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                                              : `Se retiraron ${q} animales el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
                                          },
                                        ],
                                      }
                                      // Solo actualizar stock y EV — sin movimiento en el calendario
                                      const pRes = await apiFetch(`/api/herds/${herd.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ head_count: newVal, total_ev: newEv, technical_data: newTechData }),
                                      })
                                      if (pRes.ok) {
                                        window.dispatchEvent(new Event('rodeo-gantt-reload'))
                                        toast.success(
                                          isAdd
                                            ? `Se agregaron ${q} animales a ${herd.name}`
                                            : `Se retiraron ${q} animales de ${herd.name}`
                                        )
                                      } else { e.target.value = String(headCount); toast.error('No se pudo guardar') }
                                    } catch { e.target.value = String(headCount); toast.error('Error de conexión') }
                                  }}
                                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                />
                              </td>
                              <td className="py-3 px-1 text-xs text-gray-500 font-bold text-left relative group cursor-default">
                                {pesoForCalc > 0 ? pesoForCalc : '—'}
                                {gainedWeight > 0 && <span className="text-green-600 ml-0.5 inline-block" title={`Aumento proyectado: +${gainedWeight} kg`}>↑</span>}
                              </td>
                              <td className="py-3 px-1 text-xs text-gray-500 font-bold text-left">{eqPct}</td>
                              <td className="py-3 px-1 text-xs font-black text-green-700 text-left border-r border-gray-200">{ev > 0 ? ev.toFixed(0) : '—'}</td>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-100">
                    <td className="py-2.5 px-4 text-[10px] font-black text-gray-700 uppercase tracking-widest border-r border-gray-200 sticky left-0 z-10 bg-gray-100">Total</td>
                    {MONTHS_FOOTER.map(m => {
                      let totalCab = 0, totalEv = 0
                      herds.forEach((h: any) => {
                        const hEntry = h.admission_date || '2000-01-01'
                        const hExit = h.exit_date || '2100-01-01'
                        if (hEntry <= m.endDate && hExit >= m.startDate) {
                          const hc = getDynamicHeadcount(h.id, Number(h.head_count) || 0, m.startDate)
                          const referenceDate = new Date().toISOString().split('T')[0]
                          const evHerd = hc > 0 ? calcularEvParaMes(h, m.startDate, hc, 'primavera', referenceDate) : 0
                          totalCab += hc
                          totalEv += evHerd
                        }
                      })
                      return (
                        <React.Fragment key={m.key}>
                          <td className="py-2.5 px-1 text-xs font-black text-gray-800 text-left bg-gray-100">{totalCab || '—'}</td>
                          <td className="py-2.5 px-1 text-left bg-gray-100 text-gray-300 text-xs">—</td>
                          <td className="py-2.5 px-1 text-left bg-gray-100 text-gray-300 text-xs">—</td>
                          <td className="py-2.5 px-1 text-xs font-black text-green-700 text-left border-r border-gray-200 bg-gray-100">{totalEv > 0 ? totalEv.toFixed(0) : '—'}</td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                  <tr className="border-t border-dashed border-green-200 hover:bg-green-50/40 transition-colors group">
                    <td className="py-2 px-4 border-r border-gray-200 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb]">
                      <button
                        onClick={() => { setShowAnnualHerdModal(false); onAddHerd?.() }}
                        className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-800 transition-colors">
                        <span className="text-sm leading-none">+</span> Rodeo o animales temporarios
                      </button>
                    </td>
                    {MONTHS_FOOTER.map(m => (
                      <td key={m.key} colSpan={4} className="py-2 px-1 text-center border-r border-gray-200 text-[9px] text-gray-200">—</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-3xl shrink-0">
              <button
                onClick={() => setShowAnnualHerdModal(false)}
                className="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    )}
    </>
  )
}

export default InteractiveGantt;
