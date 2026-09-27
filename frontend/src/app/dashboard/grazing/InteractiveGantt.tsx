'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Lock, AlertTriangle, EyeOff, ToggleLeft, ToggleRight, ChevronUp, ChevronDown,
  X, MessageSquare, Send
} from 'lucide-react'
import { HOLISTIC_TOOLTIPS, HoverTooltip } from '@/components/ui/atoms/UsageRing'
import { calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'
import { detectForageGaps, type ForageGap } from '@/lib/forage-gaps'
import GanttClimateMonthRow from '@/components/GanttClimateMonthRow'
import GanttClimateAlert from '@/components/GanttClimateAlert'
import { GanttAnimalTable } from '@/components/GanttAnimalTable'

// ─────────────── IMPORTS DE FUENTES Únicas DE VERDAD ───────────────
import { safeIso, fmt, daysBetween, addDays } from '@/lib/grazing/dateUtils'
import {
  HERD_COLORS, PURPLE_LEVELS, STATUS_MAP, getSeason,
  EVT_CONFIG, SEASONAL_MS_GROWTH, REGION_DROUGHT_REF,
} from '@/lib/grazing/constants'
import {
  calculateDynamicHeadcount,
  getDynamicHerdEV,
  EV_BASE,
  calculateBaseEV,
  obtenerEvRodeoParaFecha,
  calcularEvParaMes,
  calcularPesoParaMes,
  type BioMilestone,
} from '@/lib/grazing/evProjection'
import { BASE_GROWTH_RATE_KG_HA_DAY } from '@/lib/grazing/forageCurves'







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
  onHerdUpdate, onEditEvent, onDeleteEvent, onHerdClick,
  paddockOrder = [], onPaddockReorder,
  seasonPlanColorMap = {},
  seasonPlanNames = {},
  ganttLayers = { showOriginal: true, showPlanned: true, showReal: true, showEvents: true, showAgenda: true, showRemnant: true, showAnimals: true },
  onPaddockToggle,
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
  onHerdUpdate?: (herdId: string, updates: Record<string, any>) => void
  onEditEvent?: (evt: any) => void
  onDeleteEvent?: (evt: any) => void
  onHerdClick?: (herd: any) => void
  /** Optional ordered paddock IDs — when provided, rows are rendered in this sequence */
  paddockOrder?: string[]
  onPaddockReorder?: (paddockId: string, direction: 'up' | 'down') => void
  /** Mapa season_plan_id → color hex/CSS del plan (por rodeo o púrpura fallback) */
  seasonPlanColorMap?: Record<string, string>
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
  /** Hitos biológicos compartidos (destete, servicio, parición) para EV dinámico */
  bioMilestones?: BioMilestone[]
}) {
  // ── Filtrado estricto: solo potreros y rodeos involucrados en los planes visibles ──
  const activePlanPaddockIds = useMemo(() => {
    return new Set(plans.filter(p => p.status !== 'DELETED').map((p: any) => p.paddock_id))
  }, [plans])

  const activePlanHerdIds = useMemo(() => {
    const ids = new Set<string>()
    plans.filter((p: any) => p.status !== 'DELETED').forEach((p: any) => {
      ;(p.herd_ids ?? []).forEach((id: string) => ids.add(id))
      if (p.herd_id) ids.add(p.herd_id)
    })
    return ids
  }, [plans])

  // Solo los paddocks que tienen planes activos
  const relevantPaddocks = useMemo(() => {
    // El filtrado upstream en GanttView ya garantiza que solo lleguen los paddocks
    // con planes activos. Mantenemos el filtro interno como defensa en profundidad,
    // pero si llegan 0 planes (carga inicial) mostramos los paddocks recibidos.
    if (activePlanPaddockIds.size === 0) return paddocks
    return paddocks.filter((p: any) => activePlanPaddockIds.has(p.id))
  }, [paddocks, activePlanPaddockIds])

  // Solo los herds involucrados en los planes visibles
  const relevantHerds = useMemo(() => {
    if (activePlanHerdIds.size === 0) return herds
    return herds.filter((h: any) => activePlanHerdIds.has(h.id))
  }, [herds, activePlanHerdIds])

  // Sort paddocks by suggested order when paddockOrder is provided
  const orderedPaddocks = useMemo(() => {
    if (paddockOrder.length > 0) {
      return [
        ...paddockOrder
          .map(id => relevantPaddocks.find((p: any) => p.id === id))
          .filter(Boolean),
        ...relevantPaddocks.filter((p: any) => !paddockOrder.includes(p.id)),
      ]
    }
    return relevantPaddocks
  }, [paddockOrder, relevantPaddocks])

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

  // Compute forage gaps for the current window (using only herds from visible plans)
  const forageGaps = useMemo(() => {
    const herdIdsInPlans = new Set<string>()
    plans.filter(p => p.status !== 'DELETED').forEach(p => {
      if (p.herd_ids?.length) p.herd_ids.forEach((id: string) => herdIdsInPlans.add(id))
      else if (p.herd_id) herdIdsInPlans.add(p.herd_id)
    })
    const planHerds = herdIdsInPlans.size > 0
      ? herds.filter((h: any) => herdIdsInPlans.has(h.id))
      : herds
    const totalEv = planHerds.reduce((s: number, h: any) => s + Number(h.total_ev || 0), 0)
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
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onBlockMove, pxPerDay, windowStart, windowDays])

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
      style={{ cursor: 'default', maxHeight: 'calc(100vh - 220px)' }}
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
          // BUG 3 FIX: Un potrero SIEMPRE aparece en el Gantt si:
          //  a) está activo Y tiene aforo declarado, O
          //  b) tiene al menos 1 plan de pastoreo asociado (independientemente del aforo)
          // Esto garantiza que los planes creados desde la Sandbox se pinten
          // aunque el potrero no tenga dry_matter_kg_ha registrado.
          const paddocksWithPlans = new Set(plans.filter(p => p.status !== 'DELETED').map((p: any) => p.paddock_id))
          const activePaddocks = orderedPaddocks.filter((p: any) =>
            (p.is_active !== false && Number(p.dry_matter_kg_ha) > 0) ||
            paddocksWithPlans.has(p.id)
          )
          const inactivePaddocks = orderedPaddocks.filter((p: any) =>
            !(p.is_active !== false && Number(p.dry_matter_kg_ha) > 0) &&
            !paddocksWithPlans.has(p.id)
          )

          // Con el filtrado estricto ya aplicado, todos los paddocks tienen planes activos
          const plannedPaddocks = activePaddocks
          const unplannedPaddocks: any[] = []

          return (
            <>
            {/* Show planned paddocks (or all active if no plans exist yet) */}
            {(plannedPaddocks.length > 0 ? plannedPaddocks : activePaddocks).map((paddock, rowIdx) => {
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
              // DAH Estimado: (MS - remanente) × ha / (EV_plan × kg/día)
              // Use only EV from herds assigned to plans on THIS paddock
              const paddockHerdIds = new Set<string>()
              paddockPlans.forEach(p => {
                if (p.herd_ids?.length) p.herd_ids.forEach((id: string) => paddockHerdIds.add(id))
                else if (p.herd_id) paddockHerdIds.add(p.herd_id)
              })
              const paddockHerds = paddockHerdIds.size > 0
                ? herds.filter((h: any) => paddockHerdIds.has(h.id))
                : herds
              const totalEV = paddockHerds.reduce((s: number, h: any) => s + Number(h.total_ev || 0), 0)
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
              >
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
                    const isLast = rowIdx === orderedPaddocks.length - 1
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
                  // Compute actual pixels-per-day from the inner container formula:
                  // innerW = Math.max(1000, windowDays * 6 + LABEL_W)
                  const innerW = Math.max(1000, windowDays * 6 + LABEL_W)
                  const pxPerDay = (innerW - LABEL_W) / windowDays

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
                    // isSuggested = solo planes sugeridos POR IA (ai_analysis.plan_source).
                    // Los planes del Sandbox (plan_type==='suggested' sin ai_analysis.plan_source)
                    // son planes manuales del usuario y van por el branch normal (is_locked=false).
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
                      const isManualResizable = isGrabbable && !isCompleted && !hasRealEntry && !isSuggested
                      return (
                      <div
                        key={key}
                        style={{
                          position: 'absolute',
                          left: `${Math.min(startPct, 99)}%`,
                          // Ancho exacto en %; garantizado al menos 1 día via oneDayPct en la lógica JS
                          width: `${Math.min(Math.max(oneDayPct, widthPctArg), 100 - Math.min(startPct, 99))}%`,
                          top: top,
                          height: BAR_H,
                          // minWidth garantizado en px = 1 día real. Evita que bloques de 1 día
                          // colapsen a 0 por redondeo de % en navegadores.
                          minWidth: Math.max(6, pxPerDay * 1),
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
                        onMouseDown={e => isGrabbable && !isCompleted && !hasRealEntry && handleMouseDown(e, plan)}
                        onClick={(e) => { 
                          e.stopPropagation()
                          onBlockClick(plan, e)
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
                      const spId = (plan.season_plan_id || plan.ai_analysis?.season_plan_id) as string | undefined
                      const baseColor = spId ? seasonPlanColorMap[spId] : undefined

                      if (isSuggested) {
                        // ── Color dinámico por season_plan_id (v30: campo directo + legacy fallback) ──
                        // Color directo desde el mapa (por rodeo) o fallback púrpura
                        const planColor = baseColor ?? PURPLE_LEVELS[0].bg
                        const pl = { bg: planColor, border: planColor }
                        // ── Etiqueta interna: conteo de animales de esta planificación ──
                        const blockHerdIds: string[] = Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0
                          ? plan.herd_ids
                          : plan.herd_id ? [plan.herd_id] : []
                        const blockHerds = herds.filter((h: any) => blockHerdIds.includes(h.id))
                        const blockHeadCount = blockHerds.reduce((s: number, h: any) => s + (Number(h.head_count) || 0), 0)
                        const primaryBlockHerd = blockHerds[0]
                        const planSourceName = spId ? (seasonPlanNames[spId] || 'Plan forrajero') : 'Plan forrajero'
                        renderBlocks.push(createBlock(
                          `t2-${plan.id}`, TRACK2_TOP, leftPct, widthPct,
                          pl.bg, pl.border, pl.border, false, 1, 10,
                          `⚡ SUGERIDA — ${planSourceName}`,
                          false, '', ''
                        ))
                      } else {
                        // ── BUG 3 FIX: Matemática robusta de posicionamiento para planes manuales/Sandbox ──
                        // Usamos entry_date/exit_date directos (sin depender de is_locked ni adjusted_*)
                        // ya que los planes nuevos de Sandbox no tienen esos campos.
                        const t2Entry = plan.entry_date
                        const t2Exit  = plan.exit_date || addDays(plan.entry_date, 14)
                        const t2EntryDiff = daysBetween(windowStart, t2Entry)
                        const t2Duration  = Math.max(1, daysBetween(t2Entry, t2Exit))
                        // leftPct ya calculado arriba — reutilizarlo si la entrada es la misma
                        const t2Left  = Math.max(0, (t2EntryDiff / windowDays) * 100)
                        const t2Width = Math.max((1 / windowDays) * 100, (t2Duration / windowDays) * 100)

                        // Use baseColor if available, otherwise use defaults.
                        const hexToRgba = (hex: string, alpha: number) => {
                          const r = parseInt(hex.slice(1, 3), 16)
                          const g = parseInt(hex.slice(3, 5), 16)
                          const b = parseInt(hex.slice(5, 7), 16)
                          return `rgba(${r},${g},${b},${alpha})`
                        }

                        let customBg = T2_BG
                        let customBor = T2_BORDER
                        let customPat = T2_PAT

                        if (baseColor && baseColor.startsWith('#')) {
                          customBg = hexToRgba(baseColor, 0.2)
                          customBor = baseColor
                          customPat = baseColor
                        }

                        const t2Bg  = isOverdue ? T2_OVD_BG  : isActiveNow ? T2_ACT_BG  : customBg
                        const t2Bor = isOverdue ? T2_OVD_BOR : isActiveNow ? T2_ACT_BOR : customBor
                        const t2Pat = isOverdue ? T2_OVD_PAT : isActiveNow ? T2_ACT_PAT : customPat
                        const t2Title = isOverdue
                          ? '⚠️ PLAN VENCIDO — Fecha superada sin completar'
                          : isActiveNow
                          ? '🟢 EN PASTOREO — Plan en curso'
                          : '✏️ PLAN MODIFICABLE'

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

        {/* ── Potreros Sin Planificación (activos pero sin planes) ── */}
        {plannedPaddocks.length > 0 && unplannedPaddocks.length > 0 && (
          <div className="bg-gray-50/40 border-t border-dashed border-gray-200 px-4 py-2.5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300"></span>
              Sin planificación ({unplannedPaddocks.length})
              <span className="font-medium normal-case tracking-normal text-gray-400 ml-1">
                — {unplannedPaddocks.map(p => p.name).join(', ')}
              </span>
            </p>
          </div>
        )}

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

              {/* Row — Tipo de Animal — delegado al componente GanttAnimalTable */}

              {ganttLayers.showAnimals && relevantHerds.length > 0 && (
                <GanttAnimalTable
                  herds={relevantHerds}
                  plans={plans}
                  months={MONTHS_FOOTER}
                  labelW={LABEL_W}
                  unifiedEvents={[...(farmEvents || []), ...(movements || [])]}
                  windowDays={windowDays}
                  referenceDate={new Date().toISOString().split('T')[0]}
                  onHerdClick={onHerdClick}
                />
              )}


      </div>{/* end minWidth wrapper */}
    </div>{/* end containerRef scroll container */}

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
    {selectedGap && typeof document !== 'undefined' && createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setSelectedGap(null)}
        />
        {/* Panel */}
        <div className="fixed right-0 top-0 h-full w-80 z-[10001] bg-white border-l border-gray-100 shadow-2xl flex flex-col animate-in slide-in-from-right-4 duration-300">
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
            <h3 className="modal-title leading-tight">
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
      </>,
      document.body
    )}

    </>
  )
}

export default InteractiveGantt;
