'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  Calendar, Plus, CheckCircle2, Clock, MapPin, Search, Filter,
  AlignJustify, CalendarDays, Lightbulb, CloudRain, Sun, ChevronLeft, ChevronRight,
  X, Check, Loader2, Droplets, AlertTriangle, Camera, Leaf, Users
} from 'lucide-react'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'

// ─────────────── CONSTANTS ───────────────
const HERD_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#4338ca'
]

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:    { label: 'Pastando',     color: 'text-green-700',  bg: 'bg-green-100' },
  PLANNED:   { label: 'Planificado',  color: 'text-blue-700',   bg: 'bg-blue-100'  },
  COMPLETED: { label: 'Completado',   color: 'text-gray-600',   bg: 'bg-gray-100'  },
}

// Season dict for southern hemisphere
const getSeason = () => {
  const m = new Date().getMonth() + 1
  if (m >= 12 || m <= 2) return { name: 'Verano', type: 'Temporada abierta', icon: '🌿', color: 'bg-green-100 text-green-700' }
  if (m >= 3 && m <= 5)  return { name: 'Otoño',   type: 'Temporada cerrada', icon: '🍂', color: 'bg-amber-100 text-amber-700' }
  if (m >= 6 && m <= 8)  return { name: 'Invierno',type: 'Temporada cerrada', icon: '❄️', color: 'bg-blue-100 text-blue-700' }
  return                         { name: 'Primavera',type: 'Temporada abierta', icon: '🌱', color: 'bg-lime-100 text-lime-700' }
}

// Format date as dd/MM
const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

// days between two ISO dates
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b+'T00:00:00').getTime() - new Date(a+'T00:00:00').getTime()) / 86400000)

// Add n days to ISO date string
const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// Event type config used in Gantt badges and legend
const EVT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  SANITARIO:      { label: 'Sanitario',      emoji: '💉', color: '#7c3aed' },
  REPRODUCCION:   { label: 'Reproducción',   emoji: '🐄', color: '#be185d' },
  MANEJO:         { label: 'Manejo',          emoji: '🔧', color: '#d97706' },
  INFRAESTRUCTURA:{ label: 'Infraestructura', emoji: '🏗️', color: '#0891b2' },
  PASTOREO:       { label: 'Pastoreo',        emoji: '🌿', color: '#16a34a' },
}

// ─────────────── INTERACTIVE GANTT ───────────────
interface GanttBlock {
  plan: any
  herdColor: string
  herdIdx: number
}

function InteractiveGantt({
  plans, paddocks, herds, farmEvents, windowStart, windowDays, onBlockClick, onBlockMove
}: {
  plans: any[]
  paddocks: any[]
  herds: any[]
  farmEvents: any[]
  windowStart: string
  windowDays: number
  onBlockClick: (plan: any) => void
  onBlockMove: (planId: string, newEntry: string, newExit: string) => void
}) {
  const ROW_H = 56
  const LABEL_W = 160
  const HEADER_H = 40
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ planId: string; startX: number; origEntry: string; origExit: string } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)

  const herdColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    herds.forEach((h, i) => { map[h.id] = HERD_COLORS[i % HERD_COLORS.length] })
    return map
  }, [herds])

  // Adaptive time markers: weekly for <=90d, monthly for longer
  const timeMarkers = useMemo(() => {
    const marks: { label: string; day: number }[] = []
    const step = windowDays <= 90 ? 7 : windowDays <= 180 ? 14 : 28
    for (let d = 0; d < windowDays; d += step) {
      const dt = new Date(windowStart + 'T00:00:00')
      dt.setDate(dt.getDate() + d)
      const label = step >= 28
        ? `${dt.toLocaleString('es', { month: 'short' }).toUpperCase()} ${dt.getFullYear()}`
        : `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`
      marks.push({ label, day: d })
    }
    return marks
  }, [windowStart, windowDays])

  // Keep backward compat — week markers used in row grid lines
  const weekMarkers = useMemo(() => {
    const marks: { day: number }[] = []
    const step = windowDays <= 90 ? 7 : windowDays <= 180 ? 14 : 28
    for (let d = 0; d < windowDays; d += step) marks.push({ day: d })
    return marks
  }, [windowStart, windowDays])

  const pxPerDay = useCallback((containerW: number) => {
    return (containerW - LABEL_W) / windowDays
  }, [windowDays, LABEL_W])

  const handleMouseDown = (e: React.MouseEvent, plan: any) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    dragging.current = {
      planId: plan.id,
      startX: e.clientX,
      origEntry: plan.entry_date,
      origExit: plan.exit_date || addDays(plan.entry_date, plan.planned_recovery_days || 14)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const ppd = pxPerDay(containerRef.current.clientWidth)
      const dxDays = Math.round((e.clientX - dragging.current.startX) / ppd)
      if (dxDays === 0) return
      const origDuration = daysBetween(dragging.current.origEntry, dragging.current.origExit)
      const newEntry = addDays(dragging.current.origEntry, dxDays)
      const newExit = addDays(newEntry, origDuration)
      onBlockMove(dragging.current.planId, newEntry, newExit)
    }
    const handleMouseUp = () => { dragging.current = null }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onBlockMove, pxPerDay])

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
          className="fixed z-[999] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-60"
          style={{
            left: Math.min(px - 120, (typeof window !== 'undefined' ? window.innerWidth : 800) - 256),
            top: py > 200 ? py - 160 : py + 20,
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
        </div>
      </>
    )
  })() : null

  return (
    <>
    <div
      ref={containerRef}
      className="select-none overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm"
      onClick={() => { setSelectedEvent(null); setPopupPos(null) }}
    >
      <div style={{ minWidth: LABEL_W + windowDays * 8 }}>
        {/* Header row */}
        <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10" style={{ height: HEADER_H }}>
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-4 flex items-center text-[10px] font-black text-gray-400 tracking-widest uppercase border-r border-gray-200 shrink-0">
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
            {/* Today line */}
            {(() => {
              const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
              if (todayDiff >= 0 && todayDiff <= windowDays) {
                return (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-red-400 pointer-events-none z-20"
                    style={{ left: `${(todayDiff / windowDays) * 100}%` }}
                  >
                    <span className="text-[8px] font-black text-red-500 ml-0.5 absolute top-2">HOY</span>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </div>

        {/* Paddock rows */}
        {paddocks.map((paddock, rowIdx) => {
          const paddockPlans = plans.filter(p =>
            p.paddock_id === paddock.id && p.status !== 'COMPLETED'
          )
          const isGrazing = paddockPlans.some(p => p.status === 'ACTIVE')

          return (
            <div
              key={paddock.id}
              className={`flex border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
              style={{ height: ROW_H }}
            >
              {/* Label */}
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-3 flex items-center gap-2 border-r border-gray-100 shrink-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${isGrazing ? 'bg-orange-400' : 'bg-green-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{paddock.name}</p>
                  <p className="text-[9px] text-gray-400">{Number(paddock.area_ha).toFixed(0)} ha</p>
                </div>
              </div>

              {/* Timeline area */}
              <div className="flex-1 relative overflow-hidden">
                {/* Grid lines */}
                {weekMarkers.map(m => (
                  <div
                    key={m.day}
                    className="absolute top-0 bottom-0 border-l border-dashed border-gray-100 pointer-events-none"
                    style={{ left: `${(m.day / windowDays) * 100}%` }}
                  />
                ))}
                {/* Today line */}
                {(() => {
                  const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
                  if (todayDiff >= 0 && todayDiff <= windowDays) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 border-l border-red-300 pointer-events-none z-10"
                        style={{ left: `${(todayDiff / windowDays) * 100}%` }}
                      />
                    )
                  }
                  return null
                })()}

                {/* Plan blocks */}
                {paddockPlans.map(plan => {
                  const entryDiff = daysBetween(windowStart, plan.entry_date)
                  const exitDate = plan.exit_date || addDays(plan.entry_date, 14)
                  const duration = daysBetween(plan.entry_date, exitDate)
                  const leftPct = Math.max(0, (entryDiff / windowDays) * 100)
                  const widthPct = Math.max(0.5, (duration / windowDays) * 100)
                  const color = herdColorMap[plan.herd_id] || '#16a34a'
                  const herd = herds.find(h => h.id === plan.herd_id)
                  const isActive = plan.status === 'ACTIVE'

                  if (entryDiff > windowDays || (entryDiff + duration) < 0) return null

                  return (
                    <div
                      key={plan.id}
                      className={`absolute top-2 bottom-2 rounded-lg text-white text-[10px] font-bold flex items-center px-2 shadow-sm cursor-grab active:cursor-grabbing transition-opacity hover:opacity-90 z-20 ${isActive ? 'opacity-100 ring-2 ring-white ring-offset-1' : 'opacity-80'}`}
                      style={{
                        left: `${Math.min(leftPct, 99)}%`,
                        width: `${Math.min(widthPct, 100 - Math.min(leftPct, 99))}%`,
                        backgroundColor: color,
                        minWidth: 8
                      }}
                      onMouseDown={e => handleMouseDown(e, plan)}
                      onClick={() => onBlockClick(plan)}
                      title={`${herd?.name} — ${fmt(plan.entry_date)} → ${fmt(exitDate)} (${duration}d)`}
                    >
                      {widthPct > 6 && (
                        <span className="truncate">
                          {isActive ? '● ' : ''}{herd?.name || 'Rebaño'}
                        </span>
                      )}
                    </div>
                  )
                })}
                {/* ── No more per-row event diamonds; they are now shown once in the Agenda header row above ── */}
              </div>
            </div>
          )
        })}

        {/* ── Events header row: each event appears ONCE here, not repeated per paddock ── */}
        {farmEvents.filter(evt => {
          const d = daysBetween(windowStart, evt.event_date)
          return d >= 0 && d <= windowDays
        }).length > 0 && (
          <div
            className="flex border-b border-gray-100 bg-amber-50/40"
            style={{ height: ROW_H * 0.75 }}
          >
            <div
              style={{ width: LABEL_W, minWidth: LABEL_W }}
              className="px-3 flex items-center border-r border-gray-100 shrink-0"
            >
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Agenda</p>
            </div>
            <div className="flex-1 relative overflow-hidden">
              {farmEvents
                .filter(evt => {
                  const d = daysBetween(windowStart, evt.event_date)
                  return d >= 0 && d <= windowDays
                })
                .map(evt => {
                  const cfg = EVT_CONFIG[evt.event_type] || { label: evt.event_type, emoji: '📌', color: '#374151' }
                  const evtDay = daysBetween(windowStart, evt.event_date)
                  const leftPct = (evtDay / windowDays) * 100
                  const isSelected = selectedEvent?.id === evt.id
                  return (
                    <div
                      key={evt.id}
                      className="absolute z-30"
                      style={{ left: `calc(${leftPct}% - 6px)`, top: '50%', transform: 'translateY(-50%)' }}
                    >
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          if (isSelected) {
                            setSelectedEvent(null)
                            setPopupPos(null)
                          } else {
                            const rect = (e.target as HTMLElement).getBoundingClientRect()
                            setPopupPos({ x: rect.left + rect.width / 2, y: rect.top })
                            setSelectedEvent({ ...evt, cfg })
                          }
                        }}
                        className={`w-3.5 h-3.5 rotate-45 block shadow-md border-2 border-white transition-transform hover:scale-125 ${
                          isSelected ? 'scale-150' : ''
                        }`}
                        style={{ backgroundColor: cfg.color }}
                        title={`${cfg.emoji} ${evt.title} — ${fmt(evt.event_date)}`}
                        aria-label={`${cfg.label}: ${evt.title}`}
                      />
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex-wrap">
          {Object.entries(EVT_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: cfg.color }} />
              <span className="text-[9px] font-bold text-gray-500">{cfg.emoji} {cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-3 h-0.5 bg-red-400" />
            <span className="text-[9px] font-bold text-gray-400">Hoy</span>
          </div>
        </div>

      </div>
    </div>
    {eventPopup}
    </>
  )
}

// ─────────────── MAIN COMPONENT ───────────────
export default function GrazingPlanner() {
  const { user } = useAuth()
  const supabase = createClient()

  const [plans, setPlans] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [farmEvents, setFarmEvents] = useState<any[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [ganttPeriod, setGanttPeriod] = useState<'trimestral' | 'semestral' | 'anual'>('trimestral')
  const [seasonalFilter, setSeasonalFilter] = useState<'all' | 'open' | 'closed'>('all')

  // Dynamic window days based on period
  const PERIODS = { trimestral: 84, semestral: 180, anual: 365 }
  const WINDOW_DAYS = PERIODS[ganttPeriod]

  // Gantt window: starts 4 weeks ago by default
  const [ganttWindow, setGanttWindow] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 28)
    return d.toISOString().split('T')[0]
  })

  // Jump to open/closed season when filter changes
  useEffect(() => {
    const year = new Date().getFullYear()
    if (seasonalFilter === 'open') {
      // Temporada abierta: Oct to Feb (spring/summer hemisphere sur)
      const oct = new Date(year, 9, 1)  // Oct 1
      setGanttWindow(oct.toISOString().split('T')[0])
      setGanttPeriod('semestral')
    } else if (seasonalFilter === 'closed') {
      // Temporada cerrada: Mar to Sep
      const mar = new Date(year, 2, 1)  // Mar 1
      setGanttWindow(mar.toISOString().split('T')[0])
      setGanttPeriod('semestral')
    }
  }, [seasonalFilter])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    id: '',
    paddock_id: '',
    herd_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    exit_date: '',
    planned_recovery_days: 60,
    status: 'PLANNED'
  })
  // Temporary animals for a plan (e.g. bulls during service)
  const [tempAnimals, setTempAnimals] = useState<{species: string; count: number; weight_kg: number}[]>([])
  // Multi-herd (only if forage is limiting)
  const [additionalHerdIds, setAdditionalHerdIds] = useState<string[]>([])
  // Exit date warning (user shortened auto-calculated date)
  const [exitDateWarning, setExitDateWarning] = useState(false)
  const [suggestedExitDate, setSuggestedExitDate] = useState<string>('')
  // Completion report
  const [completionNote, setCompletionNote] = useState('')
  const [completionPhoto, setCompletionPhoto] = useState<string>('')  // base64
  const [analyzingRemnant, setAnalyzingRemnant] = useState(false)
  const [remnantAnalysis, setRemnantAnalysis] = useState<any>(null)

  const season = getSeason()

  // EV de la planificación (todos los rebaños seleccionados + temporales)
  const totalPlanEV = useMemo(() => {
    const primaryHerd = herds.find(h => h.id === formData.herd_id)
    const primaryEV = Number(primaryHerd?.total_ev) || 0
    const additionalEV = additionalHerdIds.reduce((sum, hid) => {
      const h = herds.find(h => h.id === hid)
      return sum + (Number(h?.total_ev) || 0)
    }, 0)
    const tempEV = tempAnimals.reduce((sum, a) =>
      sum + (a.count * a.weight_kg) / 450, 0)
    return primaryEV + additionalEV + tempEV
  }, [formData.herd_id, herds, additionalHerdIds, tempAnimals])

  // Holistic suggestion using actual dry_matter_kg_ha (60% harvest, 40% remnant)
  const suggestion = useMemo(() => {
    const paddock = paddocks.find(p => p.id === formData.paddock_id)
    if (!paddock || totalPlanEV === 0) return { days: 0, recovery: 60, availableMs: 0, paddockMaxEV: 0 }
    const area = Number(paddock.area_ha) || 0
    const ms = Number(paddock.dry_matter_kg_ha) || Number(paddock.estimated_adh) * 66 || 0
    const totalMs = ms * area
    const usableMs = totalMs * 0.6  // 60% harvest, 40% holistic remnant
    const dailyConsumption = totalPlanEV * 11  // 11 kg MS/EV/day
    const days = dailyConsumption > 0 && usableMs > 0 ? Math.floor(usableMs / dailyConsumption) : 0
    // Max EV this paddock can support for the same days at 60% harvest
    const paddockMaxEV = days > 0 ? Math.floor(usableMs / (days * 11)) : 0
    let recovery = 60
    if (weather?.currentSeason === 'SUMMER') recovery = 40
    if (weather?.currentSeason === 'SPRING') recovery = 45
    if (weather?.currentSeason === 'AUTUMN') recovery = 65
    if (weather?.currentSeason === 'WINTER') recovery = 95
    return { days, recovery, availableMs: Math.round(usableMs), paddockMaxEV }
  }, [formData.paddock_id, totalPlanEV, paddocks, weather])

  // Detect if primary herd alone exceeds paddock capacity
  const primaryHerdEV = useMemo(() => {
    const h = herds.find(h => h.id === formData.herd_id)
    return Number(h?.total_ev) || 0
  }, [formData.herd_id, herds])
  const isForageLimiting = suggestion.paddockMaxEV > 0 && primaryHerdEV > suggestion.paddockMaxEV

  // Events in the selected date range
  const eventsInRange = useMemo(() => {
    if (!formData.entry_date || !formData.exit_date) return []
    return farmEvents.filter(e =>
      e.event_date >= formData.entry_date &&
      e.event_date <= formData.exit_date
    )
  }, [farmEvents, formData.entry_date, formData.exit_date])

  useEffect(() => {
    if (suggestion.days > 0 && formData.entry_date && !formData.id) {
      const exit = addDays(formData.entry_date, suggestion.days)
      setSuggestedExitDate(exit)
      setFormData(prev => prev.exit_date === exit ? prev : { ...prev, exit_date: exit })
      setExitDateWarning(false)
    }
  }, [suggestion.days, formData.entry_date, formData.id])

  async function loadData() {
    if (!user) return
    setLoading(true)
    const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!orgData?.organization_id) return setLoading(false)
    setOrgId(orgData.organization_id)

    const [{ data: pData }, { data: hData }, { data: evtsData }] = await Promise.all([
      supabase.from('paddocks').select('id, name, area_ha, current_status, estimated_adh, is_active, dry_matter_kg_ha').eq('org_id', orgData.organization_id),
      supabase.from('herds').select('id, name, head_count, total_ev, avg_weight_kg').eq('org_id', orgData.organization_id),
      supabase.from('farm_events').select('id, title, event_type, event_date, end_date, herd_id, status').eq('org_id', orgData.organization_id)
    ])
    setPaddocks(pData || [])
    setHerds(hData || [])
    setFarmEvents(evtsData || [])

    const paddockIds = (pData || []).map(p => p.id)
    if (paddockIds.length > 0) {
      const { data: plansData } = await supabase
        .from('grazing_plans')
        .select('*, paddocks(name, area_ha), herds(name, head_count, total_ev), temporary_animals, notes')
        .in('paddock_id', paddockIds)
        .order('entry_date', { ascending: true })
      setPlans(plansData || [])
    }

    try {
      const wData = await getPaddockWeather(-37.32, -59.13)
      setWeather(wData)
    } catch { /* ignore */ }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [user])

  const handleOpenModal = (plan: any = null) => {
    if (plan) {
      setFormData({
        id: plan.id, paddock_id: plan.paddock_id, herd_id: plan.herd_id,
        entry_date: plan.entry_date, exit_date: plan.exit_date || '',
        planned_recovery_days: plan.planned_recovery_days, status: plan.status
      })
      setTempAnimals(plan.temporary_animals || [])
      setAdditionalHerdIds(plan.herd_ids?.filter((id: string) => id !== plan.herd_id) || [])
      setCompletionNote('')
      setCompletionPhoto('')
      setRemnantAnalysis(null)
      setExitDateWarning(false)
    } else {
      setFormData({
        id: '', paddock_id: paddocks[0]?.id || '', herd_id: herds[0]?.id || '',
        entry_date: new Date().toISOString().split('T')[0], exit_date: '',
        planned_recovery_days: 60, status: 'PLANNED'
      })
      setTempAnimals([])
      setAdditionalHerdIds([])
      setCompletionNote('')
      setCompletionPhoto('')
      setRemnantAnalysis(null)
      setExitDateWarning(false)
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const allHerdIds = [formData.herd_id, ...additionalHerdIds].filter(Boolean)
    const payload = {
      paddock_id: formData.paddock_id, herd_id: formData.herd_id,
      herd_ids: allHerdIds,
      entry_date: formData.entry_date, exit_date: formData.exit_date || null,
      planned_recovery_days: formData.planned_recovery_days, status: formData.status,
      temporary_animals: tempAnimals,
      exit_notes: formData.status === 'COMPLETED' ? completionNote : undefined,
      exit_dry_matter_kg_ha: formData.status === 'COMPLETED' && remnantAnalysis?.dry_matter_kg_ha
        ? remnantAnalysis.dry_matter_kg_ha : undefined,
    }
    if (formData.id) {
      await supabase.from('grazing_plans').update(payload).eq('id', formData.id)
    } else {
      await supabase.from('grazing_plans').insert([payload])
    }
    if (formData.status === 'ACTIVE') {
      await supabase.from('paddocks').update({ current_status: 'GRAZING' }).eq('id', formData.paddock_id)
    } else if (formData.status === 'COMPLETED') {
      await supabase.from('paddocks').update({ current_status: 'RESTING' }).eq('id', formData.paddock_id)
      // Save paddock_observations record with photo + AI analysis
      if ((completionPhoto || completionNote || remnantAnalysis) && orgId) {
        await supabase.from('paddock_observations').insert([{
          org_id: orgId,
          paddock_id: formData.paddock_id,
          plan_id: formData.id || undefined,
          observation_type: 'EXIT',
          observed_at: formData.exit_date || new Date().toISOString().split('T')[0],
          dry_matter_kg_ha: remnantAnalysis?.dry_matter_kg_ha,
          photo_data: completionPhoto || undefined,
          notes: completionNote || undefined,
          ai_analysis: remnantAnalysis || {},
          created_by: (await supabase.auth.getUser()).data.user?.id,
        }])
      }
    }
    setIsModalOpen(false)
    setSaving(false)
    loadData()
  }

  // Move a block by drag → update dates optimistically
  const handleBlockMove = useCallback(async (planId: string, newEntry: string, newExit: string) => {
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, entry_date: newEntry, exit_date: newExit }
      : p
    ))
    // persist async
    await supabase.from('grazing_plans').update({ entry_date: newEntry, exit_date: newExit }).eq('id', planId)
  }, [supabase])

  const filteredPlans = useMemo(() =>
    plans.filter(p => {
      const matchSearch = (p.paddocks?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (p.herds?.name || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || p.status === filterStatus
      return matchSearch && matchStatus
    }),
    [plans, search, filterStatus]
  )

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

  // Gantt window navigation
  const shiftGantt = (weeks: number) => {
    const d = new Date(ganttWindow + 'T00:00:00')
    d.setDate(d.getDate() + weeks * 7)
    setGanttWindow(d.toISOString().split('T')[0])
  }

  const ganttEnd = addDays(ganttWindow, WINDOW_DAYS)
  const ganttStartLabel = fmt(ganttWindow)
  const ganttEndLabel = fmt(ganttEnd)

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Planificador de pastoreo</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            Carta de pastoreo rotacional — {season.icon} {season.name} · {season.type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex items-center shadow-sm gap-0.5">
            {[
              { id: 'gantt', Icon: CalendarDays, label: 'Gantt' },
              { id: 'list',  Icon: AlignJustify,  label: 'Lista' },
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === id ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleOpenModal()}
            disabled={loading || paddocks.length === 0 || herds.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold text-sm disabled:opacity-50 shadow-md shadow-green-200 transition-all"
          >
            <Plus className="w-4 h-4" /> Nueva planificación
          </button>
        </div>
      </div>

      {/* Empty state warning — only after load completes */}
      {!loading && (paddocks.length === 0 || herds.length === 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 font-medium">
          Necesitás al menos <strong>1 potrero</strong> y <strong>1 rebaño</strong> para planificar.
        </div>
      )}

      {/* KPI Strip — 3 cards, no redundancy */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Activo ahora',  value: activePlans,    color: 'text-green-600',  bg: 'bg-green-50',  sub: `${activePlans === 1 ? 'plan activo' : 'planes activos'}` },
          { label: 'Planificado',   value: plannedPlans,   color: 'text-blue-600',   bg: 'bg-blue-50',   sub: `${plannedPlans === 1 ? 'movimiento pendiente' : 'movimientos pendientes'}` },
          { label: 'En descanso',   value: restingPaddocks,color: 'text-gray-600',   bg: 'bg-gray-50',   sub: `${restingPaddocks === 1 ? 'potrero recuperando' : 'potreros recuperando'}` },
        ].map(({ label, value, color, bg, sub }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 p-4`}>
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">{label}</p>
            <p className={`text-3xl font-black leading-none ${color}`}>{loading ? '—' : value}</p>
            <p className="text-[9px] text-gray-400 mt-1">{!loading && sub}</p>
          </div>
        ))}
      </div>

      {/* Climate pill */}
      {weather && (() => {
        const now = new Date()
        const from30 = new Date(now); from30.setDate(now.getDate() - 30)
        const to15 = new Date(now); to15.setDate(now.getDate() + 15)
        const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
        return (
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-3.5 shadow-sm space-y-1.5">
            <div className="flex items-center gap-2">
              {weather.droughtRisk === 'HIGH' ? <Sun className="w-4 h-4 text-orange-400 shrink-0" /> : <Droplets className="w-4 h-4 text-blue-400 shrink-0" />}
              <p className="text-xs text-gray-600">
                Del <strong>{fmt(from30)}</strong> al <strong>{fmt(now)}</strong> cayeron{' '}
                <strong className="text-gray-900">{weather.past30DaysRain} mm</strong> en la zona de tu campo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-sky-400 shrink-0" />
              <p className="text-xs text-gray-600">
                Se proyectan <strong className="text-gray-900">{weather.next15DaysRain} mm</strong> de lluvia durante los próximos 15 días
                {' '}(hasta el <strong>{fmt(to15)}</strong>)
              </p>
            </div>
            <div className="flex items-center gap-3 pt-0.5 flex-wrap">
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${weather.droughtRisk === 'HIGH' ? 'bg-red-100 text-red-600' : weather.droughtRisk === 'MODERATE' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                Riesgo sequía: {weather.droughtRisk === 'HIGH' ? 'CRÍTICO' : weather.droughtRisk === 'MODERATE' ? 'MODERADO' : 'BAJO'}
              </span>
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${season.color}`}>
                {season.icon} {season.name} · {season.type}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por potrero o rebaño..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-medium focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="pl-10 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-medium focus:ring-1 focus:ring-green-600 outline-none text-gray-900 appearance-none pr-8"
          >
            <option value="all">Todos los estados</option>
            <option value="ACTIVE">Pastando</option>
            <option value="PLANNED">Planificados</option>
            <option value="COMPLETED">Completados</option>
          </select>
        </div>
      </div>

      {/* Herd legend */}
      {herds.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase mr-1">Rebaños:</span>
          {herds.map((h, i) => (
            <span key={h.id} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HERD_COLORS[i % HERD_COLORS.length] }} />
              {h.name}
            </span>
          ))}
        </div>
      )}

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      ) : plans.length === 0 && viewMode === 'gantt' ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-sm font-bold text-gray-400">Sin planificaciones aún</p>
          <p className="text-xs text-gray-300 mt-1">Creá tu primera planificación usando el botón de arriba</p>
        </div>
      ) : viewMode === 'gantt' ? (
        <div className="space-y-3">
          {/* Gantt navigation + period + season controls */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            {/* Left: nav arrows + date label */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => shiftGantt(-4)} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-all shadow-sm">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => shiftGantt(4)} className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-all shadow-sm">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm">
                {ganttStartLabel} — {ganttEndLabel}
              </span>
              <button
                onClick={() => { const d = new Date(); d.setDate(d.getDate() - 28); setGanttWindow(d.toISOString().split('T')[0]) }}
                className="text-[10px] font-bold text-green-600 hover:text-green-700 bg-green-50 px-2.5 py-2 rounded-xl border border-green-100 transition-all"
              >
                Hoy
              </button>
            </div>

            {/* Right: period selector + season filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Period selector */}
              <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
                {(['trimestral', 'semestral', 'anual'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => { setGanttPeriod(p); setSeasonalFilter('all') }}
                    className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all capitalize ${
                      ganttPeriod === p && seasonalFilter === 'all'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              {/* Season filter */}
              <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
                <button
                  onClick={() => setSeasonalFilter('all')}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    seasonalFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Todo el año
                </button>
                <button
                  onClick={() => setSeasonalFilter('open')}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    seasonalFilter === 'open' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🌿 T. Abierta
                </button>
                <button
                  onClick={() => setSeasonalFilter('closed')}
                  className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                    seasonalFilter === 'closed' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ❄️ T. Cerrada
                </button>
              </div>
            </div>
          </div>

          <InteractiveGantt
            plans={filteredPlans}
            paddocks={paddocks}
            herds={herds}
            farmEvents={farmEvents}
            windowStart={ganttWindow}
            windowDays={WINDOW_DAYS}
            onBlockClick={handleOpenModal}
            onBlockMove={handleBlockMove}
          />

          <p className="text-[10px] text-gray-400 text-center font-medium">
            Arrastrá los bloques para mover la planificación · Clic para editar · Clic en ♦ para ver eventos de agenda
          </p>
        </div>

      ) : (
        /* List View */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Potrero / Rebaño', 'Estado', 'Entrada', 'Salida', 'Días', 'Descanso', 'EV'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPlans.map(plan => {
                const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
                const color = herdColorMap[plan.herd_id]
                const days = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : null
                return (
                  <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleOpenModal(plan)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{plan.paddocks?.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{plan.herds?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-700 font-medium tabular-nums">{fmt(plan.entry_date)}</td>
                    <td className="px-5 py-4 text-xs text-gray-700 font-medium tabular-nums">{plan.exit_date ? fmt(plan.exit_date) : '—'}</td>
                    <td className="px-5 py-4 text-sm font-black text-gray-900">{days ?? '—'}<span className="text-[10px] font-normal text-gray-400 ml-1">d</span></td>
                    <td className="px-5 py-4 text-sm font-bold text-green-700">{plan.planned_recovery_days}<span className="text-[10px] font-normal text-gray-400 ml-1">d</span></td>
                    <td className="px-5 py-4 text-sm font-bold text-orange-600">{Number(plan.herds?.total_ev || 0).toFixed(1)}</td>
                  </tr>
                )
              })}
              {filteredPlans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">
                    No hay planificaciones que coincidan con la búsqueda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-950">
                  {formData.id ? 'Editar planificación' : 'Nueva planificación'}
                </h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Pastoreo rotacional holístico</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Paddock & Herd */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Potrero *</label>
                    <select
                      required
                      value={formData.paddock_id}
                      onChange={e => setFormData({ ...formData, paddock_id: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
                    >
                      <option value="" disabled>Seleccioná...</option>
                      {paddocks.map(p => <option key={p.id} value={p.id}>{p.name} ({Number(p.area_ha).toFixed(0)} ha)</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Rebaño *</label>
                    <select
                      required
                      value={formData.herd_id}
                      onChange={e => setFormData({ ...formData, herd_id: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
                    >
                      <option value="" disabled>Seleccioná...</option>
                      {herds.map(h => <option key={h.id} value={h.id}>{h.name} ({Number(h.total_ev).toFixed(1)} EV)</option>)}
                    </select>
                  </div>
                </div>

                {/* Holistic Suggestion */}
                {suggestion.days > 0 && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-green-600" />
                      <p className="text-[10px] font-black text-green-600 tracking-widest uppercase">Sugerencia holística</p>
                      <span className="text-[9px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-bold ml-auto">40% remanente</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded-lg p-2.5 text-center">
                        <p className="text-xl font-black text-gray-900">{suggestion.days}</p>
                        <p className="text-[9px] text-gray-400 font-bold">días pastoreo</p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 text-center">
                        <p className="text-xl font-black text-green-600">{suggestion.recovery}</p>
                        <p className="text-[9px] text-gray-400 font-bold">días descanso</p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 text-center">
                        <p className="text-xl font-black text-amber-600">{suggestion.availableMs >= 1000 ? `${(suggestion.availableMs/1000).toFixed(1)}k` : suggestion.availableMs}</p>
                        <p className="text-[9px] text-gray-400 font-bold">kg MS oferta</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Fecha de entrada *</label>
                    <input
                      required type="date"
                      value={formData.entry_date}
                      onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1">
                      Fecha de salida {suggestedExitDate && formData.exit_date === suggestedExitDate && <span className="text-green-500">✓ auto</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.exit_date}
                      onChange={e => {
                        const val = e.target.value
                        setFormData({ ...formData, exit_date: val })
                        if (suggestedExitDate && val < suggestedExitDate) {
                          setExitDateWarning(true)
                        } else {
                          setExitDateWarning(false)
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
                    />
                  </div>
                </div>

                {/* EXIT DATE WARNING */}
                {exitDateWarning && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-red-700">Atenção: estás consumiendo el remanente</p>
                      <p className="text-[9px] text-red-600 mt-0.5">
                        La salida anticipada reduce el forraje remanente ({'>'}40%) que el potrero necesita para recuperarse.
                        Esto puede prolongar el tiempo de descanso y degradar el suelo a largo plazo.
                      </p>
                    </div>
                  </div>
                )}

                {/* EVENTS IN RANGE */}
                {eventsInRange.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                    <p className="text-[10px] font-black text-amber-700 tracking-widest uppercase flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> Eventos en este período
                    </p>
                    {eventsInRange.map(evt => {
                      const cfg = EVT_CONFIG[evt.event_type] || { emoji: '📅', label: evt.event_type }
                      return (
                        <div key={evt.id} className="flex items-center gap-2 text-[10px] text-amber-800 font-medium">
                          <span>{cfg.emoji}</span>
                          <span className="font-bold">{evt.title}</span>
                          <span className="text-amber-500 ml-auto">{fmt(evt.event_date)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Recovery & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Días de descanso</label>
                    <input
                      required type="number" min="0"
                      value={formData.planned_recovery_days}
                      onChange={e => setFormData({ ...formData, planned_recovery_days: parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Estado</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none text-gray-900"
                    >
                      <option value="PLANNED">Planificado</option>
                      <option value="ACTIVE">Activo (pastando)</option>
                      <option value="COMPLETED">Completado</option>
                    </select>
                  </div>
                </div>

                {/* ── Animales Temporales (toros de servicio, etc.) ── */}
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-amber-700 tracking-widest uppercase">Animales temporales</p>
                      <p className="text-[9px] text-amber-600 mt-0.5">Ej: toros de servicio — impactan el consumo de forraje</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTempAnimals(prev => [...prev, { species: 'Toro', count: 1, weight_kg: 550 }])}
                      className="text-[10px] font-bold bg-amber-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-700 transition-all"
                    >
                      + Agregar
                    </button>
                  </div>

                  {tempAnimals.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-amber-100">
                        <div className="flex-1">
                          <p className="text-[9px] text-gray-400 font-black uppercase">EV total del plan</p>
                          <p className="text-sm font-black text-orange-600">{totalPlanEV.toFixed(1)} EV</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 font-black uppercase">EV temporales</p>
                          <p className="text-sm font-black text-amber-600">+{tempAnimals.reduce((s, a) => s + (a.count * a.weight_kg) / 450, 0).toFixed(1)} EV</p>
                        </div>
                      </div>
                      {tempAnimals.map((a, i) => (
                        <div key={i} className="grid grid-cols-[1fr_56px_66px_28px] gap-1.5 items-center">
                          <input type="text" placeholder="Especie" value={a.species}
                            onChange={e => { const c = [...tempAnimals]; c[i] = { ...c[i], species: e.target.value }; setTempAnimals(c) }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 outline-none"
                          />
                          <input type="number" min="1" placeholder="Cant." value={a.count}
                            onChange={e => { const c = [...tempAnimals]; c[i] = { ...c[i], count: parseInt(e.target.value) || 1 }; setTempAnimals(c) }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 text-center outline-none"
                          />
                          <input type="number" min="1" placeholder="kg" value={a.weight_kg}
                            onChange={e => { const c = [...tempAnimals]; c[i] = { ...c[i], weight_kg: parseInt(e.target.value) || 0 }; setTempAnimals(c) }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 text-center outline-none"
                          />
                          <button type="button" onClick={() => setTempAnimals(prev => prev.filter((_, idx) => idx !== i))}
                            className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-lg hover:bg-red-100 text-xs"
                          >✕</button>
                        </div>
                      ))}
                      <p className="text-[9px] text-amber-600 font-medium">1 EV = 450 kg peso vivo. Los animales temporales reducen los días óptimos de pastoreo.</p>
                    </div>
                  )}
                </div>

                {/* ── Multi-rebaño: solo si el forraje es limitante ── */}
                {isForageLimiting && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-orange-700 tracking-widest uppercase">Capacidad limitada por forraje</p>
                        <p className="text-[9px] text-orange-600 mt-0.5">
                          El potrero soporta ~{suggestion.paddockMaxEV} EV. Tu rebaño tiene {primaryHerdEV.toFixed(1)} EV.
                          Considerà dividir o ingresar solo parte del rebaño.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-orange-700 uppercase tracking-wider">Agregar otro rebaño al mismo potrero:</p>
                      {herds.filter(h => h.id !== formData.herd_id).map(h => (
                        <label key={h.id} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={additionalHerdIds.includes(h.id)}
                            onChange={e => {
                              if (e.target.checked) setAdditionalHerdIds(prev => [...prev, h.id])
                              else setAdditionalHerdIds(prev => prev.filter(id => id !== h.id))
                            }}
                            className="w-3.5 h-3.5 rounded accent-orange-600"
                          />
                          <span className="text-[10px] font-bold text-gray-800">
                            {h.name} <span className="text-orange-600">({Number(h.total_ev).toFixed(1)} EV)</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {formData.status === 'ACTIVE' && (
                  <p className="text-[10px] text-orange-600 bg-orange-50 p-2.5 rounded-lg font-medium">
                    El potrero cambiará su estado a «En pastoreo» automáticamente.
                  </p>
                )}

                {/* ── Reporte de cierre (solo COMPLETED) ── */}
                {formData.status === 'COMPLETED' && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-green-600" />
                      <p className="text-[10px] font-black text-green-700 tracking-widest uppercase">Registro de cierre</p>
                      <span className="text-[9px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-bold ml-auto">Histórico de potrero</span>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-green-700 uppercase tracking-wider">Descripción del remanente</label>
                      <textarea
                        rows={2}
                        value={completionNote}
                        onChange={e => setCompletionNote(e.target.value)}
                        placeholder="Ej: Buen remanente visible, cobertura uniforme, sin plantas invasoras..."
                        className="w-full bg-white border border-green-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-green-600 outline-none text-gray-900 resize-none"
                      />
                    </div>

                    {/* Photo upload */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-green-700 uppercase tracking-wider">Foto del remanente</label>
                      {!completionPhoto ? (
                        <label className="flex flex-col items-center gap-2 bg-white border-2 border-dashed border-green-300 rounded-xl p-4 cursor-pointer hover:border-green-500 transition-all">
                          <Camera className="w-6 h-6 text-green-400" />
                          <span className="text-[10px] font-bold text-green-600">Tomar foto o seleccionar archivo</span>
                          <input
                            type="file" accept="image/*" capture="environment"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = ev => {
                                setCompletionPhoto(ev.target?.result as string)
                                setRemnantAnalysis(null)
                              }
                              reader.readAsDataURL(file)
                            }}
                          />
                        </label>
                      ) : (
                        <div className="relative">
                          <img src={completionPhoto} alt="Remanente" className="w-full h-28 object-cover rounded-xl border border-green-200" />
                          <button
                            type="button"
                            onClick={() => { setCompletionPhoto(''); setRemnantAnalysis(null) }}
                            className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow text-gray-600 hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* AI Analysis */}
                    {completionPhoto && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={analyzingRemnant}
                          onClick={async () => {
                            setAnalyzingRemnant(true)
                            try {
                              const res = await fetch('/api/analyze-remnant', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ photo: completionPhoto, paddock_id: formData.paddock_id })
                              })
                              const data = await res.json()
                              setRemnantAnalysis(data)
                            } catch { setRemnantAnalysis({ error: true }) }
                            setAnalyzingRemnant(false)
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-700 text-white rounded-xl text-[10px] font-black hover:bg-green-800 disabled:opacity-50 transition-all"
                        >
                          {analyzingRemnant ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                          {analyzingRemnant ? 'Analizando con IA...' : 'Analizar remanente con IA'}
                        </button>
                        {remnantAnalysis && !remnantAnalysis.error && (
                          <div className="bg-white rounded-xl border border-green-200 p-3 space-y-1">
                            <p className="text-[9px] font-black text-green-700 uppercase tracking-wider">Resultado IA</p>
                            {remnantAnalysis.dry_matter_kg_ha && (
                              <p className="text-sm font-black text-gray-900">
                                ~{remnantAnalysis.dry_matter_kg_ha.toLocaleString()} kg MS/ha
                                <span className="text-[9px] text-gray-400 font-normal ml-1">estimado</span>
                              </p>
                            )}
                            {remnantAnalysis.description && (
                              <p className="text-[9px] text-gray-600">{remnantAnalysis.description}</p>
                            )}
                          </div>
                        )}
                        {remnantAnalysis?.error && (
                          <p className="text-[9px] text-red-500 font-medium">Error al analizar. Verificá tu conexión.</p>
                        )}
                      </div>
                    )}

                    <p className="text-[9px] text-green-600 font-medium">
                      Este registro queda guardado en el histórico del potrero para medir su mejora o degradación con el tiempo.
                    </p>
                  </div>
                )}

                {formData.status === 'COMPLETED' && !completionPhoto && !completionNote && (
                  <p className="text-[10px] text-green-600 bg-green-50 p-2.5 rounded-lg font-medium">
                    El potrero entrará en «Descanso» para iniciar su recuperación.
                  </p>
                )}
              </div>


              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {formData.id ? 'Actualizar' : 'Crear plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
