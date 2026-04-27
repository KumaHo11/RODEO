'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FeatureGate } from '@/components/FeatureGate'
import {
  Calendar, Plus, CheckCircle2, Clock, MapPin, Search, Filter,
  AlignJustify, CalendarDays, Lightbulb, CloudRain, Sun, ChevronLeft, ChevronRight,
  X, Check, Loader2, Droplets, AlertTriangle, Camera, Leaf, Users, Sparkles, HistoryIcon, Download,
  Zap, TrendingUp, BarChart3, Target, ArrowDown, Share, Trash2, BookOpen, Upload
} from 'lucide-react'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'
import { DashboardMetricsBar, DashboardMetricsData } from '@/design-system/molecules/DashboardMetricsBar'
import SeasonPlanModal from './SeasonPlanModal'
import ExcelImporter from './ExcelImporter'
import RawDataModal from './RawDataModal'
import { HOLISTIC_TOOLTIPS, HoverTooltip } from '@/components/ui/atoms/UsageRing'
import { calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/ConfirmModal'

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
  if (m >= 12 || m <= 2) return { name: 'Verano', type: 'Temporada abierta', icon: '', color: 'bg-green-100 text-green-700' }
  if (m >= 3 && m <= 5)  return { name: 'Otoño',   type: 'Temporada cerrada', icon: '', color: 'bg-amber-100 text-gray-700' }
  if (m >= 6 && m <= 8)  return { name: 'Invierno',type: 'Temporada cerrada', icon: '', color: 'bg-blue-100 text-blue-700' }
  return                         { name: 'Primavera',type: 'Temporada abierta', icon: '🌱', color: 'bg-lime-100 text-lime-700' }
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

// Biological Demand Evolution
export const getDynamicHerdEV = (herd: any, dateISO: string, farmEvents: any[]): number => {
  const baseEV = Number(herd?.total_ev) || 0
  if (baseEV === 0) return 0
  const headCount = Number(herd?.head_count || herd?.animal_count) || baseEV 

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
  return baseEV
}


// Event type config — colors from Bitacora reference
const EVT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  servicio:              { label: 'Servicio',              emoji: '●', color: '#ef4444' },
  paricion:              { label: 'Parición',              emoji: '●', color: '#3b82f6' },
  destete:               { label: 'Destete',               emoji: '●', color: '#eab308' },
  diagnostico_prenez:   { label: 'Diagnóstico preñez',   emoji: '●', color: '#f97316' },
  tratamiento_sanitario: { label: 'Sanitario',             emoji: '●', color: '#78350f' },
  esquila:               { label: 'Esquila',               emoji: '●', color: '#8b5cf6' },
  vacaciones:            { label: 'Vacaciones',            emoji: '●', color: '#ec4899' },
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

function InteractiveGantt({
  plans, paddocks, herds, farmEvents, windowStart, windowDays, onBlockClick, onBlockMove,
  rainfallData, onRainfallChange, weatherEvents = [], onPaddockClick,
  droughtThresholdMm, onDroughtThresholdChange,
  targetRemnant, dailyAllocationKg,
}: {
  plans: any[]
  paddocks: any[]
  herds: any[]
  farmEvents: any[]
  windowStart: string
  windowDays: number
  onBlockClick: (plan: any, evt?: React.MouseEvent) => void
  onBlockMove: (planId: string, newEntry: string, newExit: string) => void
  rainfallData: Record<string, number>
  onRainfallChange: (monthKey: string, mm: number) => void
  weatherEvents?: any[]
  onPaddockClick?: (paddockId: string) => void
  droughtThresholdMm: number
  onDroughtThresholdChange: (mm: number) => void
  targetRemnant: number
  dailyAllocationKg: number
}) {
  const ROW_H = 84
  const LABEL_W = 220
  const HEADER_H = 48
  const RAIN_ROW_H = 36
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ planId: string; startX: number; origEntry: string; origExit: string } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)
  const [editingRainKey, setEditingRainKey] = useState<string | null>(null)
  const [editingThreshold, setEditingThreshold] = useState(false)

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

  // Auto-scroll to Today
  useEffect(() => {
    if (containerRef.current) {
      const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
      if (todayDiff >= 0 && todayDiff <= windowDays) {
        const ppd = pxPerDay(containerRef.current.clientWidth)
        const scrollX = (todayDiff * ppd) - (containerRef.current.clientWidth / 2) + LABEL_W
        containerRef.current.scrollTo({ left: Math.max(0, scrollX), behavior: 'smooth' })
      }
    }
  }, [windowStart, windowDays, pxPerDay])

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
      <div className="w-full">
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
            {/* Today line — green, solid, clear */}
            {(() => {
              const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
              if (todayDiff >= 0 && todayDiff <= windowDays) {
                return (
                  <div
                    className="absolute top-0 bottom-0 z-30 pointer-events-none"
                    style={{ left: `${(todayDiff / windowDays) * 100}%` }}
                  >
                    <div className="h-full w-[2px] bg-green-500" />
                    <div className="absolute top-1 -left-3 bg-green-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full select-none uppercase tracking-tighter shadow-sm shadow-green-300">
                      HOY
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Agenda Event Lines & Markers (interactive in header) */}
            {farmEvents
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
                const isSelected = selectedEvent?.id === evt.id

                return (
                  <div key={`evt-h-${evt.id}`} className="absolute top-0 bottom-0 z-20" style={{ left: `${leftPct}%`, width: isMultiDay ? `${widthPct}%` : 'auto' }}>
                    {/* The Line or Range Rectangle */}
                    {isMultiDay ? (
                      <div className="absolute top-0 bottom-0 w-full border-2 rounded flex justify-between items-center" style={{ borderColor: cfg.color, backgroundColor: `${cfg.color}20` }}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 -ml-[1px]" style={{ backgroundColor: cfg.color }} />
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 -mr-[1px]" style={{ backgroundColor: cfg.color }} />
                      </div>
                    ) : (
                      <div className="absolute top-0 bottom-0 border-l-2" style={{ borderColor: cfg.color, opacity: isSelected ? 1 : 0.8 }} />
                    )}
                    
                    {/* Interactive Marker (always at the start or center) */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setPopupPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height })
                        setSelectedEvent({ ...evt, cfg })
                      }}
                      className={`absolute top-2 ${isMultiDay ? 'left-1/2 -translate-x-1/2' : '-translate-x-[4px]'} w-2 h-2 rounded-full border border-white shadow-sm transition-all hover:scale-150 focus:outline-none ${isSelected ? 'scale-150 ring-2 ring-white/60' : 'opacity-90 hover:opacity-100'}`}
                      style={{ backgroundColor: cfg.color }}
                      title={`${cfg.emoji} ${evt.title}`}
                    />
                  </div>
                )
              })}
          </div>
        </div>

        {/* ── Rainfall + Snow Row ── */}
        <div className="flex border-b border-blue-100 bg-blue-50" style={{ height: RAIN_ROW_H }}>
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-3 flex items-center gap-1.5 border-r border-blue-100 shrink-0">
            <CloudRain className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-[9px] font-black text-blue-500 tracking-widest uppercase">Lluvia registrada</span>
            {/* Drought alert — only visible when an active month is below threshold */}
            {(() => {
              const hasActiveDrought = Object.entries(rainfallData).some(
                ([, mm]) => mm > 0 && mm < droughtThresholdMm
              )
              if (!hasActiveDrought) return null
              return (
                <span
                  className="ml-auto text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0"
                  title={`Alerta: hay meses con lluvia por debajo de ${droughtThresholdMm}mm. El crecimiento de pasto está reducido un 30% en esos períodos.`}
                >
                  ⚠ Lluvia insuficiente
                </span>
              )
            })()}
          </div>
          <div className="flex-1 relative">
            {(() => {
              const months: { key: string; label: string; leftPct: number; widthPct: number }[] = []
              for (let d = 0; d < windowDays; d++) {
                const dt = new Date(windowStart + 'T00:00:00')
                dt.setDate(dt.getDate() + d)
                const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`
                if (!months.find(m => m.key === key)) {
                  const daysInMonth = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate()
                  const endDay = Math.min(d + (daysInMonth - dt.getDate()), windowDays - 1)
                  months.push({ key, label: dt.toLocaleString('es', { month: 'short' }).toUpperCase(), leftPct: (d / windowDays) * 100, widthPct: ((endDay - d + 1) / windowDays) * 100 })
                  d = endDay
                }
              }
              return months.map(m => {
                const mm = rainfallData[m.key] || 0
                // Snow: sum FROST events for this month (value in mm water equivalent)
                const snowMm = weatherEvents.filter(ev =>
                  ev.type === 'FROST' && (ev.date as string).slice(0, 7) === m.key
                ).reduce((s: number, ev: any) => s + Number(ev.value || 0), 0)
                const isEditing = editingRainKey === m.key
                return (
                  <div key={m.key} className="absolute inset-y-0 border-r border-blue-100/60 flex flex-col items-center justify-center group cursor-pointer"
                    style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                    onClick={() => !isEditing && setEditingRainKey(m.key)}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        defaultValue={mm || ''}
                        onBlur={e => { onRainfallChange(m.key, Number(e.target.value)); setEditingRainKey(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="w-12 text-[9px] font-black text-center bg-white border border-blue-400 rounded px-1 py-0.5 outline-none shadow"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-0 hover:bg-blue-100 rounded w-full h-full justify-center transition-all">
                        {mm > 0 || snowMm > 0 ? (
                          <>
                            {mm > 0 && (
                              <div className="flex items-center gap-0.5">
                                <span className="text-[9px] font-black text-blue-700 leading-none">{mm}</span>
                                <span className="text-[6px] text-blue-400 font-bold leading-none">mm</span>
                              </div>
                            )}
                            {snowMm > 0 && (
                              <div className="flex items-center gap-0.5">
                                <span className="text-[8px]"></span>
                                <span className="text-[8px] font-black text-sky-600 leading-none">{snowMm}mm</span>
                              </div>
                            )}
                            <div className="w-4/5 h-[3px] rounded-full mt-0.5" style={{ backgroundColor: `rgba(59,130,246,${Math.min((mm+snowMm)/100, 1)})` }} />
                          </>
                        ) : (
                          <span className="text-[8px] text-blue-200 group-hover:text-blue-400 transition-colors">＋</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>


        {/* Paddock rows */}
        {paddocks.map((paddock, rowIdx) => {
          const paddockPlans = plans.filter(p => p.paddock_id === paddock.id)
          // Dot: green if enabled (is_active), gray if disabled
          const isEnabled = paddock.is_active !== false
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
          const moduleMsHaAvg = paddocks.filter((p: any) => Number(p.dry_matter_kg_ha) > 0).length > 0
            ? paddocks.filter((p: any) => Number(p.dry_matter_kg_ha) > 0).reduce((s: number, p: any) => s + Number(p.dry_matter_kg_ha), 0)
              / paddocks.filter((p: any) => Number(p.dry_matter_kg_ha) > 0).length
            : 0
          const yieldCoef = moduleMsHaAvg > 0 && msHa > 0 ? (msHa / moduleMsHaAvg) : null

          return (
            <div
              key={paddock.id}
              className={`flex border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}`}
              style={{ height: ROW_H }}
            >
              {/* Label — datos del potrero */}
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-3 py-2 flex items-center gap-2 border-r border-gray-100 shrink-0 overflow-hidden">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 self-start mt-2 ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                  {/* Row 1: Nombre + badge calidad */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onPaddockClick?.(paddock.id)}
                      className="text-sm font-black text-gray-950 tracking-tight truncate hover:text-green-700 transition-colors text-left leading-tight"
                      title={`Ir al potrero ${paddock.name}`}
                    >
                      {paddock.name}
                    </button>
                    {qualityScore != null && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <HoverTooltip text={HOLISTIC_TOOLTIPS.quality}>
                          <span className={`text-[10px] font-black min-w-[36px] text-center px-1.5 py-0.5 rounded-lg border bg-white shadow-sm cursor-help ${qColor}`}>
                            {qualityScore}/10
                          </span>
                        </HoverTooltip>
                      </div>
                    )}
                  </div>
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
                        {/* DAH badge */}
                        {estimatedDah !== null && (
                            <HoverTooltip text={HOLISTIC_TOOLTIPS.estimatedDah}>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full cursor-help">
                                {estimatedDah}d DAH
                              </span>
                            </HoverTooltip>
                        )}
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
                      </div>
                    )
                  })()}
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
                {/* Today line — green, full height across row */}
                {(() => {
                  const todayDiff = daysBetween(windowStart, new Date().toISOString().split('T')[0])
                  if (todayDiff >= 0 && todayDiff <= windowDays) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none z-10"
                        style={{ left: `${(todayDiff / windowDays) * 100}%` }}
                      >
                        <div className="h-full w-[2px] bg-green-500" />
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Agenda Event Lines (visual only in rows) */}
                {farmEvents
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

                    return (
                      <div 
                        key={`evt-line-row-${evt.id}`} 
                        className={`absolute top-0 bottom-0 pointer-events-none z-0 ${isMultiDay ? 'border-2 opacity-30 rounded' : 'border-l-[1px] opacity-40'}`} 
                        style={{ 
                          left: `${leftPct}%`, 
                          width: isMultiDay ? `${widthPct}%` : 'auto',
                          borderColor: cfg.color,
                          backgroundColor: isMultiDay ? `${cfg.color}10` : 'transparent'
                        }} 
                      />
                    )
                  })}

                {/* Plan blocks with Stacking Logic */}
                {(() => {
                  const sorted = [...paddockPlans].sort((a,b) => a.entry_date.localeCompare(b.entry_date))
                  const today = new Date().toISOString().split('T')[0]

                  return sorted.map((plan, idx) => {
                    const entryDiff = daysBetween(windowStart, plan.entry_date)
                    const exitDate = plan.exit_date || addDays(plan.entry_date, 14)
                    const duration = daysBetween(plan.entry_date, exitDate)
                    const leftPct = Math.max(0, (entryDiff / windowDays) * 100)
                    const widthPct = Math.max(0.5, (duration / windowDays) * 100)
                    if (entryDiff > windowDays || (entryDiff + duration) < 0) return null

                    const hasRealEntry = !!plan.actual_entry_date
                    const hasRealExit  = !!plan.actual_exit_date
                    const isOverdue    = !hasRealEntry && plan.entry_date < today && plan.status !== 'COMPLETED'
                    const isCompleted  = plan.status === 'COMPLETED'
                    const isMultiHerd  = plan.herd_ids && plan.herd_ids.length > 1
                    const primaryHerd  = herds.find(h => plan.herd_ids?.includes(h.id))
                    const herdLabel    = isMultiHerd ? `${plan.herd_ids.length} rodeos` : (primaryHerd?.name || 'Rodeo')

                    // ── Color scheme pasteles ──
                    // Planificado (futuro): cyan pastel
                    // En curso (entry <= today, sin salida): verde pastel
                    // Completado en tiempo: verde pastel
                    // Completado pasado del tiempo: naranja pastel
                    // Vencido sin completar: rojo pastel
                    const isSuggested  = plan.ai_analysis?.plan_source === 'suggested'
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

                    // Plan bar positions
                    const PLAN_TOP = 4
                    const REAL_TOP = 36
                    const BAR_H    = 28

                    let planColor: string
                    let patternColor: string
                    if (isCompleted) {
                      const realDur = plan.actual_entry_date && plan.actual_exit_date
                        ? daysBetween(plan.actual_entry_date, plan.actual_exit_date) : planDuration
                      const deviation = realDur - planDuration
                      // Verde pastel si cumplió, naranja pastel si se pasó, celeste pastel si sobró
                      planColor    = deviation > 1 ? 'rgba(251,146,60,0.18)'   // naranja pastel
                                  : deviation < -1 ? 'rgba(125,211,252,0.22)'  // celeste pastel
                                  : 'rgba(134,239,172,0.25)'                    // verde pastel
                      patternColor = deviation > 1 ? 'rgba(251,146,60,0.35)'
                                  : deviation < -1 ? 'rgba(14,165,233,0.35)'
                                  : 'rgba(34,197,94,0.35)'
                    } else if (isOverdue) {
                      planColor    = 'rgba(252,165,165,0.22)'   // rojo pastel
                      patternColor = 'rgba(239,68,68,0.40)'
                    } else if (isPast) {
                      // En curso: sugerida=cyan, manual=verde
                      planColor    = isSuggested ? 'rgba(186,230,253,0.22)' : 'rgba(134,239,172,0.22)'
                      patternColor = isSuggested ? 'rgba(14,165,233,0.40)' : 'rgba(34,197,94,0.40)'
                    } else {
                      // Futuro planificado: sugerida=celeste, manual=verde pastel
                      planColor    = isSuggested ? 'rgba(186,230,253,0.22)' : 'rgba(134,239,172,0.18)'
                      patternColor = isSuggested ? 'rgba(14,165,233,0.40)' : 'rgba(34,197,94,0.40)'
                    }

                    const borderColor = isCompleted
                      ? ((() => { const d = plan.actual_entry_date && plan.actual_exit_date ? daysBetween(plan.actual_entry_date, plan.actual_exit_date) - planDuration : 0; return d > 1 ? 'rgba(251,146,60,0.55)' : d < -1 ? 'rgba(14,165,233,0.55)' : 'rgba(34,197,94,0.55)' })())
                      : isOverdue ? 'rgba(239,68,68,0.55)'
                      : isSuggested ? 'rgba(14,165,233,0.55)' : 'rgba(34,197,94,0.55)'

                    // ── % USO: días planificados / DAH estimado × 100 ─────────
                    const planUsableMs = calculateUsableForage(ghostMsHa, targetRemnant, ghostAreaHa)
                    const planDailyDemand = ghostHerdsEV * dailyAllocationKg
                    const planDahEstimated = Math.max(1, calculateGrazingDays(planUsableMs, planDailyDemand))
                    const usagePct = planDahEstimated > 0 ? Math.round((duration / planDahEstimated) * 100) : null
                    const usageBadgeStyle = usagePct === null ? null
                      : usagePct < 90  ? { bg: '#334155',  label: `${usagePct}%`, tip: 'Sub-uso — queda remanente sin consumir' }
                      : usagePct <= 110 ? { bg: '#166534',   label: `${usagePct}%`, tip: 'Uso equilibrado — presión de pastoreo óptima' }
                      : { bg: '#991b1b', label: `${usagePct}%`, tip: 'Alerta sobrepastoreo — más del 100% de capacidad' }

                    // ── PLAN block — diagonal stripes pasteles ──
                    const planBlock = (
                      <div
                        key={`plan-${plan.id}`}
                        style={{
                          position: 'absolute',
                          left: `${Math.min(leftPct, 99)}%`,
                          width: `${Math.min(widthPct, 100 - Math.min(leftPct, 99))}%`,
                          top: PLAN_TOP,
                          height: BAR_H,
                          minWidth: 8,
                          borderRadius: 3,
                          border: `1.5px solid ${borderColor}`,
                          backgroundColor: planColor,
                          cursor: isCompleted ? 'pointer' : 'grab',
                          zIndex: 20,
                          overflow: 'hidden',
                          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${patternColor} 4px, ${patternColor} 8px)`,
                          backgroundSize: '8px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          paddingLeft: 3,
                        }}
                        className="transition-all hover:brightness-90"
                        onMouseDown={e => !isCompleted && !hasRealEntry && handleMouseDown(e, plan)}
                        onClick={(e) => { e.stopPropagation(); onBlockClick(plan, e) }}
                        title={`${isSuggested ? '⚡ SUGERIDA' : '✏️ MANUAL'} — ${herdLabel} · ${fmt(plan.entry_date)}→${fmt(exitDate)}${isCompleted ? ' ✔ Completado' : ''}`}
                      >
                        {/* Badge % USO — solo en planes activos/futuros (no completados) */}
                        {usageBadgeStyle && !isCompleted && widthPct > 3 && (
                          <HoverTooltip text={usageBadgeStyle.tip} className="shrink-0 relative z-30">
                            <span
                              className="text-[8px] font-black px-1 py-px rounded shadow-sm whitespace-nowrap select-none"
                              style={{ backgroundColor: usageBadgeStyle.bg, color: 'white' }}
                            >
                              {usageBadgeStyle.label}
                            </span>
                          </HoverTooltip>
                        )}
                      </div>
                    )

                    // ── Ghost Bar — dashed outline of the optimal duration ──────────────
                    const ghostBar = ghostDays > 0 && !isCompleted ? (
                      <div
                        key={`ghost-${plan.id}`}
                        style={{
                          position: 'absolute',
                          left: `${Math.min(leftPct, 99)}%`,
                          width: `${Math.min(ghostWidthPct, 100 - Math.min(leftPct, 99))}%`,
                          top: PLAN_TOP,
                          height: BAR_H,
                          minWidth: 4,
                          borderRadius: 3,
                          border: `1.5px dashed rgba(156,163,175,0.55)`,
                          backgroundColor: 'rgba(156,163,175,0.06)',
                          zIndex: 12,
                          pointerEvents: 'none',
                        }}
                        title={`Duración óptima calculada: ${ghostDays}d`}
                      />
                    ) : null

                    // ── REAL block — sólido naranja con badge de desvío ──
                    // Aparece cuando hay actual_exit_date (aunque no haya actual_entry_date)
                    let realBlock = null
                    const effectiveRealEntry = plan.actual_entry_date || (isCompleted ? plan.entry_date : null)
                    if (effectiveRealEntry && isCompleted) {
                      const realExit      = plan.actual_exit_date || exitDate
                      const realEntryDiff = daysBetween(windowStart, effectiveRealEntry)
                      const realDuration  = daysBetween(effectiveRealEntry, realExit)
                      const realLeft      = Math.max(0, (realEntryDiff / windowDays) * 100)
                      const realWidth     = Math.max(0.3, (realDuration / windowDays) * 100)

                      const plannedDuration = daysBetween(plan.entry_date, exitDate)
                      const devDays  = realDuration - plannedDuration
                      const devLabel = devDays === 0 ? '= plan' : (devDays > 0 ? `+${devDays}d` : `${devDays}d`)
                      const ORANGE   = '#f97316'
                      const devColor = devDays === 0 ? 'rgba(0,0,0,0.25)' : devDays > 0 ? '#854d0e' : '#14532d'

                      realBlock = (
                        <div
                          key={`real-${plan.id}`}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(realLeft, 99)}%`,
                            width: `${Math.min(realWidth, 100 - Math.min(realLeft, 99))}%`,
                            top: REAL_TOP,
                            height: BAR_H,
                            minWidth: 6,
                            borderRadius: 3,
                            backgroundColor: ORANGE,
                            zIndex: 25,
                            cursor: 'pointer',
                            boxShadow: `0 1px 4px ${ORANGE}55`,
                            overflow: 'visible',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: 4,
                          }}
                          onClick={(e) => { e.stopPropagation(); onBlockClick(plan, e) }}
                          title={`REAL: ${herdLabel} · ${fmt(effectiveRealEntry)}→${fmt(realExit)} · Desvío vs plan: ${devLabel}`}
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

                    // Ghost bar removed — the orange border warning on the plan block
                    // already communicates when the user is over the safe grazing limit.
                    return <React.Fragment key={plan.id}>{planBlock}{realBlock}</React.Fragment>
                  })
                })()}
                {/* ── No more per-row event diamonds; they are now shown once in the Agenda header row above ── */}
              </div>
            </div>
          )
        })}

        {/* ── Monthly Metrics Row (footer) ── */}
        {(() => {
          const MONTHS_FOOTER: { key: string; leftPct: number; widthPct: number; startDate: string; endDate: string }[] = []
          for (let d = 0; d < windowDays; d++) {
            const dt = new Date(windowStart + 'T00:00:00')
            dt.setDate(dt.getDate() + d)
            const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`
            if (!MONTHS_FOOTER.find(m => m.key === key)) {
              const daysInMonth = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate()
              const endDay = Math.min(d + (daysInMonth - dt.getDate()), windowDays - 1)
              const endDt = new Date(windowStart + 'T00:00:00')
              endDt.setDate(endDt.getDate() + endDay)
              MONTHS_FOOTER.push({
                key,
                leftPct: (d / windowDays) * 100,
                widthPct: ((endDay - d + 1) / windowDays) * 100,
                startDate: dt.toISOString().split('T')[0],
                endDate: endDt.toISOString().split('T')[0],
              })
              d = endDay
            }
          }
          return (
            <div className="flex border-t-2 border-violet-200 bg-gradient-to-b from-violet-50/80 to-white" style={{ minHeight: 72 }}>
              {/* Footer label column — totals */}
              {(() => {
                const totalHa = paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
                const totalMs = paddocks.reduce((s, p) => {
                  const ms = Number(p.dry_matter_kg_ha) || 0
                  const ha = Number(p.area_ha) || 0
                  return s + ms * ha
                }, 0)
                const totalEV = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
                const cargaGlobal = totalHa > 0 ? totalEV / totalHa : 0
                const caColor = cargaGlobal === 0 ? '#9ca3af' : cargaGlobal < 3 ? '#16a34a' : cargaGlobal < 5 ? '#d97706' : '#dc2626'
                return (
                  <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-2.5 py-2.5 flex flex-col justify-center gap-1 border-r border-violet-200 shrink-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <BarChart3 className="w-3 h-3 text-violet-500" />
                      <span className="text-[9px] font-black text-violet-600 tracking-widest uppercase">Resumen</span>
                    </div>
                    {/* Σ ha */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Σ ha</span>
                      <span className="text-[10px] font-bold text-gray-700">{totalHa.toFixed(1)}</span>
                    </div>
                    {/* Σ MS total */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Σ MS</span>
                      <span className="text-[10px] font-bold text-gray-700">{totalMs >= 1000 ? `${(totalMs/1000).toFixed(0)}t` : `${Math.round(totalMs)}kg`}</span>
                    </div>
                  </div>
                )
              })()}
              <div className="flex-1 relative">
                {MONTHS_FOOTER.map(m => {
                  const monthPlans = plans.filter(p =>
                    (p.exit_date || p.entry_date) >= m.startDate &&
                    p.entry_date <= m.endDate
                  )
                  const paddockIdsM = [...new Set(monthPlans.map(p => p.paddock_id))]
                  const haTotal = paddockIdsM.reduce((s, pid) => {
                    const pad = paddocks.find(p => p.id === pid)
                    return s + Number(pad?.area_ha || 0)
                  }, 0)
                  const herdIdsM  = [...new Set(monthPlans.flatMap(p => p.herd_ids || []))]
                  const herdsM    = herds.filter(h => herdIdsM.includes(h.id))
                  const cabezas   = herdsM.reduce((s, h) => s + (Number(h.head_count) || 0), 0)
                  const evTotal   = herdsM.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
                  const ca        = haTotal > 0 ? evTotal / haTotal : 0
                  const caColor   = ca === 0 ? '#9ca3af' : ca < 3 ? '#16a34a' : ca < 5 ? '#d97706' : '#dc2626'
                  const completedM = monthPlans.filter(p => p.status === 'COMPLETED').length
                  const plannedM   = monthPlans.filter(p => p.status === 'PLANNED').length
                  return (
                    <div
                      key={m.key}
                      className="absolute inset-y-0 border-r border-violet-100 flex flex-col items-center justify-center gap-1 py-2"
                      style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                    >
                      {monthPlans.length > 0 ? (
                        <>
                          {/* Visual bar: carga animal */}
                          <div className="w-4/5 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, (ca / 7) * 100)}%`, backgroundColor: caColor }}
                            />
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[7px] text-gray-500 font-bold">{haTotal.toFixed(0)}ha</span>
                              <span className="text-[7px] text-gray-500 font-bold">{cabezas}cab</span>
                              {completedM > 0 && <span className="text-[7px] text-gray-500 font-bold">{completedM} real</span>}
                              {plannedM > 0 && <span className="text-[7px] text-violet-500 font-bold">{plannedM} plan</span>}
                            </div>
                          </div>
                        </>

                      ) : (
                        <span className="text-[8px] text-gray-200">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Legend: Sugerida / Manual / Real + Agenda + Hoy */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 flex-wrap">
          <div className="flex items-center gap-3 mr-2">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 border-[1.5px] border-sky-500" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(14,165,233,0.3) 3px, rgba(14,165,233,0.3) 6px)' }} />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Sugerida</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 border-[1.5px] border-green-600" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(34,197,94,0.3) 3px, rgba(34,197,94,0.3) 6px)' }} />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Manual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 rounded-sm bg-orange-400" />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Real</span>
            </div>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Agenda:</span>
          {Object.entries(EVT_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-[9px] font-bold text-gray-500">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-0.5 h-3 bg-green-500 rounded-full" />
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Hoy</span>
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
  const [loading, setLoading] = useState(true)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [mercado, setMercado] = useState<any>(null)
  // Weather events from /api/weather (rain, frost/snow) for Gantt rainfall row
  const [weatherEvents, setWeatherEvents] = useState<any[]>([])

  // Rainfall data: key = 'YYYY-MM', value = mm
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

  // Drought threshold: auto-detected from farm lat/lng, configurable per campo
  // Default region: coordinates used throughout the app (-37.32, -59.13 = Pampa Húmeda)
  const [droughtThresholdMm, setDroughtThresholdMm] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('rodeo_drought_threshold')
      if (stored) return Number(stored)
    } catch {}
    return REGION_DROUGHT_REF(-37.32, -59.13).triggerMm  // Pampa Húmeda: 50mm
  })
  const handleDroughtThresholdChange = useCallback((mm: number) => {
    setDroughtThresholdMm(mm)
    try { localStorage.setItem('rodeo_drought_threshold', String(mm)) } catch {}
  }, [])

  // SDH/mm balance
  const totalRainfall = useMemo(() => Object.values(rainfallData).reduce((s, v) => s + v, 0), [rainfallData])

  // AI & Holistics
  const [suggesting, setSuggesting] = useState(false)
  const [suggestedPlans, setSuggestedPlans] = useState<any[]>([])
  const [targetRemnant, setTargetRemnant] = useState(1000)
  const [graceDays, setGraceDays] = useState(0)
  const [dailyAllocationKg, setDailyAllocationKg] = useState(12)
  const [inlineDryMatter, setInlineDryMatter] = useState('')
  const [savingInlineData, setSavingInlineData] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  // Raw string states for numeric inputs (prevents clearing bug when user backspaces)
  const [rawDailyAlloc, setRawDailyAlloc] = useState('12')
  const [rawTargetRemnant, setRawTargetRemnant] = useState('1000')
  const [rawGraceDays, setRawGraceDays] = useState('0')
  // Remnant mode: 'kg' = kg MS/ha absolute, 'pct' = % of total MS
  const [remnantMode, setRemnantMode] = useState<'kg' | 'pct'>('kg')
  const [remnantPct, setRemnantPct] = useState(25)  // default 25%
  const [rawRemnantPct, setRawRemnantPct] = useState('25')
  // Planificar dropdown
  const [planMenuOpen, setPlanMenuOpen] = useState(false)
  // Modal de cierre/finalización de pastoreo
  const [closePlanModal, setClosePlanModal] = useState<{ plan: any } | null>(null)
  const [closeForm, setCloseForm] = useState({ actual_exit_date: '', exit_dry_matter_kg_ha: '' })
  const [savingClose, setSavingClose] = useState(false)
  // Modal de confirmación de borrado masivo
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [viewMode, setViewMode] = useState<'gantt' | 'list' | 'history'>('gantt')
  const [seasonPlans, setSeasonPlans] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [ganttPeriod, setGanttPeriod] = useState<'trimestral' | 'semestral' | 'anual'>('trimestral')
  const [seasonalFilters, setSeasonalFilters] = useState<string[]>(['abierta', 'cerrada']) // ['abierta', 'cerrada'] mean 'all'


  // Dynamic window days based on period
  const PERIODS = { trimestral: 84, semestral: 180, anual: 365 }
  const WINDOW_DAYS = PERIODS[ganttPeriod]

  // Gantt window: starts 4 weeks ago by default
  const [ganttWindow, setGanttWindow] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 28)
    return d.toISOString().split('T')[0]
  })

  // Jump to open/closed season when filter changes (only when exactly one is selected)
  useEffect(() => {
    const year = new Date().getFullYear()
    if (seasonalFilters.length === 1) {
      if (seasonalFilters[0] === 'abierta') {
        const oct = new Date(year, 9, 1)
        setGanttWindow(oct.toISOString().split('T')[0])
        setGanttPeriod('semestral')
      } else if (seasonalFilters[0] === 'cerrada') {
        const mar = new Date(year, 2, 1)
        setGanttWindow(mar.toISOString().split('T')[0])
        setGanttPeriod('semestral')
      }
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
  // Temporary animals for a plan (e.g. bulls during service)
  const [tempAnimals, setTempAnimals] = useState<{
    species: string
    count: number
    weight_kg: number
    entry_date: string
    exit_date: string
  }[]>([])
  // ── Suggested-plan multi-selection state ──────────────────────────────────
  const [suggestPaddockIds, setSuggestPaddockIds] = useState<string[]>([])
  const [suggestHerdIds, setSuggestHerdIds]       = useState<string[]>([])
  const [suggestStartDate, setSuggestStartDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [suggestRestDays, setSuggestRestDays]     = useState({ spring: 40, autumn: 65, winter: 92 })
  // Mini plan-info popover (click on Gantt block)
  const [planPopover, setPlanPopover] = useState<{ plan: any; x: number; y: number } | null>(null)
  const [showSuggestPanel, setShowSuggestPanel]   = useState(false)
  const [exitDateWarning, setExitDateWarning] = useState(false)
  const [suggestedExitDate, setSuggestedExitDate] = useState<string>('')
  // Completion report
  const [completionNote, setCompletionNote] = useState('')
  const [completionPhoto, setCompletionPhoto] = useState<string>('') 
  const [analyzingRemnant, setAnalyzingRemnant] = useState(false)
  const [remnantAnalysis, setRemnantAnalysis] = useState<any>(null)

  const season = getSeason()

  // EV de la planificación — ponderado por período de permanencia de animales extra
  const totalPlanEV = useMemo(() => {
    const herdsEV = formData.herd_ids.reduce((sum, hid) => {
      const h = herds.find(h => h.id === hid)
      return sum + getDynamicHerdEV(h, formData.entry_date || suggestStartDate, farmEvents)
    }, 0)
    // EV ponderado: si hay fechas del plan y del animal extra, calcular solapamiento proporcional
    const planDays = formData.entry_date && formData.exit_date
      ? Math.max(1, Math.ceil((new Date(formData.exit_date).getTime() - new Date(formData.entry_date).getTime()) / 86400000))
      : 1
    const tempEV = tempAnimals.reduce((sum, a) => {
      const evRaw = (a.count * a.weight_kg) / 450
      if (a.entry_date && a.exit_date && formData.entry_date && formData.exit_date) {
        // Calcular solapamiento entre [a.entry_date, a.exit_date] y [plan.entry_date, plan.exit_date]
        const overlapStart = a.entry_date > formData.entry_date ? a.entry_date : formData.entry_date
        const overlapEnd   = a.exit_date  < formData.exit_date  ? a.exit_date  : formData.exit_date
        const overlapDays  = Math.max(0, Math.ceil((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000))
        return sum + evRaw * (overlapDays / planDays)
      }
      return sum + evRaw // sin fechas → suma completa (conservador)
    }, 0)
    return herdsEV + tempEV
  }, [formData.herd_ids, formData.entry_date, formData.exit_date, herds, tempAnimals])

  const [modalStep, setModalStep] = useState(1)

  // Holistic suggestion using actual dry_matter_kg_ha and user defined variables
  const suggestion = useMemo(() => {
    const paddock = paddocks.find(p => String(p.id) === String(formData.paddock_id))
    const ms       = paddock ? Number(paddock.dry_matter_kg_ha) || 0 : 0
    const areaHa   = paddock ? Number(paddock.area_ha) || 0 : 0

    // Effective remnant: depends on remnantMode
    const effectiveRemnant = remnantMode === 'pct'
      ? ms * (remnantPct / 100)
      : targetRemnant

    const dailyDemand = totalPlanEV * dailyAllocationKg
    const usableMsTotal = calculateUsableForage(ms, effectiveRemnant, areaHa)
    
    const baseDays = calculateGrazingDays(usableMsTotal, dailyDemand)
    const days = Math.max(0, baseDays - graceDays)
    
    // Max EV this paddock can support for the same days
    const paddockMaxEV = days > 0 ? Math.floor(usableMsTotal / ((days + graceDays) * dailyAllocationKg)) : 0
    
    let recovery = 60
    if (weather?.currentSeason === 'SUMMER') recovery = 40
    if (weather?.currentSeason === 'SPRING') recovery = 45
    if (weather?.currentSeason === 'AUTUMN') recovery = 65
    if (weather?.currentSeason === 'WINTER') recovery = 95
    return { days, recovery, availableMs: Math.round(ms), paddockMaxEV, usableMsTotal: Math.round(usableMsTotal) }
  }, [formData.paddock_id, totalPlanEV, paddocks, weather, targetRemnant, graceDays, dailyAllocationKg, remnantMode, remnantPct])

  // Drought Reserve (Savory Metric)
  const droughtReserve = useMemo(() => {
    const totalSupply = paddocks.reduce((sum, p) => {
      const ms = Number(p.dry_matter_kg_ha) || Number(p.estimated_adh) * 66 || 0
      return sum + (ms * Number(p.area_ha || 0))
    }, 0)
    const dailyDemand = herds.reduce((sum, h) => sum + (getDynamicHerdEV(h, suggestStartDate, farmEvents) * 12), 0)
    const days = dailyDemand > 0 ? Math.floor(totalSupply / dailyDemand) : 0
    return { days, isCritical: days < 10 && days > 0 }
  }, [paddocks, herds, suggestStartDate, farmEvents])

  // Detect if paddock capacity is exceeded
  const isForageLimiting = suggestion.paddockMaxEV > 0 && totalPlanEV > suggestion.paddockMaxEV

  // Gap Logic
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
      // Update local state temporarily
      setPaddocks(prev => prev.map(p => p.id === formData.paddock_id ? { ...p, dry_matter_kg_ha: Number(inlineDryMatter), last_monitoring_date: new Date().toISOString() } : p))
      setInlineDryMatter('')
    } catch(err) {
      console.error(err)
    } finally {
      setSavingInlineData(false)
    }
  }

  // ── Función de descanso estacional (Hemisferio Sur) ──────────────────────
  const getRecoveryDays = (exitDate: Date, overrideDays?: number): number => {
    if (overrideDays && overrideDays > 0) return overrideDays
    const month = exitDate.getMonth() // 0=Jan
    // Temporada abierta (H. Sur): Sep–Feb → faster regrowth
    if (month >= 8 || month <= 1) return 40  // Sep–Feb: Primavera/Verano
    if (month >= 2 && month <= 4) return 65  // Mar–May: Otoño
    return 92                                  // Jun–Ago: Invierno
  }

  const handleGeneratePlanCycle = async (seasonPlan: any) => {
    // Usar todos los potreros activos (is_active !== false).
    // Si no tienen dry_matter_kg_ha, se usa 1200 kg/ha como valor conservador estimado.
    const allActivePaddocks = paddocks.filter(p => p.is_active !== false)
    const activePaddocks = allActivePaddocks.length > 0 ? allActivePaddocks : paddocks
    // Para el EV: usar rodeos con total_ev > 0, o todos como fallback
    const activeHerds = herds.filter(h => Number(h.total_ev) > 0).length > 0
      ? herds.filter(h => Number(h.total_ev) > 0)
      : herds
    const startDate = seasonPlan.start_date || new Date().toISOString().split('T')[0]

    if (activeHerds.length === 0 || activePaddocks.length === 0 || !startDate) {
      toast.error('Faltá configurar potreros y rodeos. Verificá que existan en "Potreros" y "Rodeos".')
      return
    }

    // Advertir si ningún potrero tiene datos de MS
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
    try {
      const dailyDemandMultiplier = Number(seasonPlan.daily_allocation_kg) || 12
      const remnant = Number(seasonPlan.target_remnant_kg_ha ?? targetRemnant ?? 1000)

      // ── Mapa de días disponibles pre-calculados por el modal ──────────────────
      // supply_snapshot.by_paddock ya contiene avail_days calculados con la misma
      // fórmula del Motor Holístico (targetRemnant × totalEV × dailyAllocationKg).
      // Usar estos valores garantiza consistencia total con lo que vio el usuario.
      const precomputedDays: Record<string, number> = {}
      if (seasonPlan.supply_snapshot?.by_paddock) {
        for (const pd of seasonPlan.supply_snapshot.by_paddock) {
          if (pd.id && pd.avail_days > 0) precomputedDays[pd.id] = pd.avail_days
        }
      }

      // Ciclo anual por defecto o hasta la fecha de fin definida en el plan
      let currentEntry = new Date(startDate + 'T12:00:00')
      let targetEndDate = new Date(currentEntry)
      if (seasonPlan.end_date) {
        targetEndDate = new Date(seasonPlan.end_date + 'T12:00:00')
      } else {
        targetEndDate.setFullYear(targetEndDate.getFullYear() + 1)
      }

      const newPlans: any[] = []
      const cycleId = crypto.randomUUID()

      // ── EV total de TODOS los rodeos activos (movimiento en masa) ─────────────
      // En pastoreo holístico el mob entero se mueve junto.
      const totalEV = activeHerds.reduce((sum, h) => {
        return sum + getDynamicHerdEV(h, startDate, farmEvents)
      }, 0)
      const allHerdIds = activeHerds.map(h => h.id)

      // availabilityMap: timestamp en que cada potrero termina su descanso
      const availabilityMap = new Map<string, number>()
      activePaddocks.forEach(p => {
        const activePlansList = plans.filter(pl =>
          pl.paddock_id === p.id && pl.status !== 'COMPLETED' && pl.exit_date
        )
        if (activePlansList.length > 0) {
          const maxExitTs = Math.max(...activePlansList.map(pl => new Date(pl.exit_date).getTime()))
          const maxExitDate = new Date(maxExitTs)
          const recDays = getRecoveryDays(maxExitDate)
          maxExitDate.setDate(maxExitDate.getDate() + recDays)
          availabilityMap.set(p.id, maxExitDate.getTime())
        } else {
          availabilityMap.set(p.id, currentEntry.getTime())
        }
      })

      let iteration = 0

      while (currentEntry < targetEndDate && iteration < 300) {
        iteration++

        // Elegir el potrero listo con mayor biomasa
        const readyPaddocks = activePaddocks
          .filter(p => (availabilityMap.get(p.id) || 0) <= currentEntry.getTime())
          .sort((a, b) => (Number(b.dry_matter_kg_ha) || 0) - (Number(a.dry_matter_kg_ha) || 0))

        let chosenPaddock: any = null
        if (readyPaddocks.length > 0) {
          chosenPaddock = readyPaddocks[0]
        } else {
          const nextTs = Math.min(...activePaddocks.map(p => availabilityMap.get(p.id) || 0))
          if (!isFinite(nextTs) || nextTs <= currentEntry.getTime()) break
          currentEntry = new Date(nextTs)
          continue
        }

        // ── Días de estadía: usar avail_days pre-calculado o recalcular ──────────
        let stayDays: number
        if (precomputedDays[chosenPaddock.id] > 0) {
          // Fuente de verdad: mismo número que vio el usuario en el modal
          stayDays = precomputedDays[chosenPaddock.id]
        } else {
          // Fallback: recalcular con la misma fórmula holística.
          // Si no hay MS dato, usar estimación conservadora de 1200 kg/ha.
          const ms   = Number(chosenPaddock.dry_matter_kg_ha) > 0 ? Number(chosenPaddock.dry_matter_kg_ha) : 1200
          const area = Number(chosenPaddock.area_ha) || 10
          const evForCalc = totalEV > 0 ? totalEV
            : activeHerds.reduce((s, h) => s + getDynamicHerdEV(h, currentEntry.toISOString().split('T')[0], farmEvents), 0)
          const usableMs = calculateUsableForage(ms, remnant, area)
          const dailyDemand = evForCalc * dailyDemandMultiplier
          // Si no hay MS suficiente → al menos 3 días mínimos
          const rawDays = calculateGrazingDays(usableMs, dailyDemand) || 3
          stayDays = Math.max(1, rawDays)
        }

        const exitDate = new Date(currentEntry)
        exitDate.setDate(exitDate.getDate() + stayDays)

        // Días de descanso regenerativo según estacionalidad de la fecha de SALIDA
        const recDays = getRecoveryDays(exitDate)

        newPlans.push({
          paddock_id: chosenPaddock.id,
          herd_id:    activeHerds[0]?.id,   // herd_id principal (primer rodeo)
          herd_ids:   allHerdIds,            // todos los rodeos en masa
          entry_date: currentEntry.toISOString().split('T')[0],
          exit_date:  exitDate.toISOString().split('T')[0],
          planned_recovery_days: recDays,
          status: 'PLANNED',
          ai_analysis: {
            plan_source: 'season_plan',
            season_plan_id: seasonPlan.id,
            cycle_id: cycleId,
          },
        })

        // Bloquear el potrero hasta exit + recDays completo
        const recoveryEnd = new Date(exitDate)
        recoveryEnd.setDate(recoveryEnd.getDate() + recDays)
        availabilityMap.set(chosenPaddock.id, recoveryEnd.getTime())

        // Avanzar currentEntry al próximo potrero disponible
        const nextAvailableTs = Math.min(
          ...activePaddocks
            .filter(p => p.id !== chosenPaddock.id)
            .map(p => availabilityMap.get(p.id) || currentEntry.getTime())
        )
        const nextEntry = new Date(Math.max(exitDate.getTime() + 86400000, isFinite(nextAvailableTs) ? nextAvailableTs : 0))
        currentEntry = nextEntry
      }

      if (newPlans.length === 0) {
        toast.error(
          'No se pudieron generar planificaciones. Verificá que los rodeos tengan EV calculado, las fechas sean válidas y que el remanente objetivo no supere el pasto disponible.',
          { duration: 7000 }
        )
        setSaving(false)
        return
      }

      // Crear todas las planificaciones (bloques del Gantt) en paralelo
      await Promise.all(
        newPlans.map(p => apiFetch('/api/grazing-plans', { method: 'POST', body: JSON.stringify(p) }))
      )

      toast.success(`Gantt generado: ${newPlans.length} bloques de pastoreo creados para ${activePaddocks.length} potreros`)
      loadData()
    } catch(err) {
      console.error(err)
      toast.error('Se guardó el plan, pero hubo un error al renderizar el Gantt. Intentá refrescar la página.')
    } finally {
      setSaving(false)
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

  // Events in the selected date range
  const eventsInRange = useMemo(() => {
    if (!formData.entry_date || !formData.exit_date) return []
    return farmEvents.filter(e =>
      e.event_date >= formData.entry_date &&
      e.event_date <= formData.exit_date
    )
  }, [farmEvents, formData.entry_date, formData.exit_date])

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      const [paddocksRes, herdsRes, plansRes, eventsRes, mercadoRes] = await Promise.all([
        apiFetch('/api/paddocks').catch(() => null),
        apiFetch('/api/herds').catch(() => null),
        apiFetch('/api/grazing-plans').catch(() => null),
        apiFetch('/api/farm-events').catch(() => null),
        fetch('/api/mercado').catch(() => null),
      ])

      const [paddocksResJson, herdsResJson, plansResJson, eventsResJson] = await Promise.all([
        paddocksRes?.ok ? paddocksRes.json() : Promise.resolve({ paddocks: [] }),
        herdsRes?.ok    ? herdsRes.json()    : Promise.resolve({ herds: [] }),
        plansRes?.ok    ? plansRes.json()    : Promise.resolve({ plans: [] }),
        eventsRes?.ok   ? eventsRes.json()   : Promise.resolve({ events: [] }),
      ])
      setPaddocks(paddocksResJson.paddocks ?? [])
      setHerds(herdsResJson.herds ?? [])
      setPlans(plansResJson.plans ?? [])
      setFarmEvents(eventsResJson.events ?? [])
      setMercado(mercadoRes?.ok ? (await mercadoRes.json()) : null)

      // Cargar planes de temporada históricos (Excel imports + season plans guardados)
      try {
        const spRes = await apiFetch('/api/season-plans')
        if (spRes.ok) {
          const spJson = await spRes.json()
          setSeasonPlans(spJson.plans ?? spJson ?? [])
        }
      } catch { /* season plans son opcionales */ }

      // Load weather events for the Gantt rainfall row
      try {
        const wEvRes = await apiFetch('/api/weather?limit=200')
        if (wEvRes.ok) {
          const wEvJson = await wEvRes.json()
          setWeatherEvents(wEvJson.events || [])
          // Build rainfallData from DB events (RAIN type), merging with localStorage
          const fromDb: Record<string, number> = {}
          ;(wEvJson.events || []).forEach((ev: any) => {
            if (ev.type === 'RAIN') {
              const key = (ev.date as string).slice(0, 7) // 'YYYY-MM'
              fromDb[key] = (fromDb[key] || 0) + Number(ev.value)
            }
          })
          // Merge: DB values override localStorage for same month key
          setRainfallData(prev => ({ ...prev, ...fromDb }))
        }
      } catch { /* weather events optional */ }

      try {
        const wData = await getPaddockWeather(-37.32, -59.13)
        setWeather(wData)
      } catch { /* ignore — weather is optional */ }
    } catch (err) {
      console.error('Grazing loadData error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user])

  const handleOpenModal = (plan: any = null) => {
    setInlineDryMatter('')
    if (plan) {
      const isSuggestedPlan = plan.ai_analysis?.plan_source === 'suggested'

      // For SUGGESTED plans: restore all herds and paddocks from the full cycle metadata.
      // Each block in the cycle knows its own herd (herd_ids = [thisHerd]) but the
      // ai_analysis.cycle_all_herd_ids and cycle_all_paddock_ids hold the full selection.
      let resolvedHerdIds: string[]
      let resolvedPaddockId: string = plan.paddock_id

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
        entry_date: safeIso(plan.entry_date),
        exit_date: safeIso(plan.exit_date),
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
        herd_ids: [],
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
    
    // ── Validar Exclusividad Extendida (ocupación + descanso regenerativo) ──
    if (formData.paddock_id && formData.entry_date) {
      const newEntry = formData.entry_date
      const newExit  = formData.exit_date || formData.entry_date
      const conflict = plans.find(p => 
        p.id !== formData.id &&
        p.paddock_id === formData.paddock_id &&
        p.status !== 'COMPLETED'
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
      const payload = {
        paddock_id: formData.paddock_id,
        herd_id: formData.herd_ids[0] || null,
        herd_ids: formData.herd_ids,
        entry_date: formData.entry_date,
        exit_date: formData.exit_date || null,
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
        },
      }

      // ── Cascade recalculation for suggested cycles with extra animals ──────
      // When tempAnimals are added to a plan in a suggested cycle, we need to:
      // 1. Recalculate the new exit_date for this plan (increased EV → fewer days)
      // 2. Shift all subsequent plans in the same cycle forward/backward by the delta
      // 3. For plans that overlap with the extra-animal period, also recalculate their days
      const cycleId = formData.ai_analysis?.cycle_id as string | undefined
      const isSuggestedWithExtras = cycleId && tempAnimals.length > 0 && formData.paddock_id && formData.entry_date && formData.exit_date

      let cascadeUpdates: Array<{ id: string; entry_date: string; exit_date: string }> = []

      if (isSuggestedWithExtras) {
        // ── Step 1: Compute NEW exit_date for this plan with extra animal EV included ──
        const paddock = paddocks.find(p => p.id === formData.paddock_id)
        if (paddock) {
          const area          = Number(paddock.area_ha) || 0
          const ms            = Number(paddock.dry_matter_kg_ha) || 1800
          const remnant       = 1100 // kg MS/ha target remnant (conservative)
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
          const dailyDemandNew    = totalEVWithExtras * 12 // 12 kg MS/EV/day
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
            payload.exit_date = newExitStr

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
                  const sibDailyDemand = sibTotalEV * 11
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

      // ── Save main plan ──
      if (formData.id) {
        await apiFetch(`/api/grazing-plans/${formData.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await apiFetch('/api/grazing-plans', { method: 'POST', body: JSON.stringify(payload) })
      }

      // ── Apply cascade updates to sibling plans ──
      if (cascadeUpdates.length > 0) {
        await Promise.all(
          cascadeUpdates.map(u =>
            apiFetch(`/api/grazing-plans/${u.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ entry_date: u.entry_date, exit_date: u.exit_date }),
            })
          )
        )
      }

      // Update paddock status
      if (payload.status === 'ACTIVE') {
        await apiFetch(`/api/paddocks/${formData.paddock_id}`, { method: 'PATCH', body: JSON.stringify({ current_status: 'GRAZING' }) })
      } else if (payload.status === 'COMPLETED') {
        await apiFetch(`/api/paddocks/${formData.paddock_id}`, { method: 'PATCH', body: JSON.stringify({ current_status: 'RESTING' }) })
      }

      // Notify user about cascade if it happened
      if (cascadeUpdates.length > 0) {
        console.info(`[Cascade] Updated ${cascadeUpdates.length} sibling plans in cycle ${cycleId}`)
      }
    } catch (err) {
      console.error('handleSave error:', err)
      toast.error('Error al guardar. Intentá de nuevo.')
    } finally {
      setIsModalOpen(false)
      setSaving(false)
      loadData()
    }
  }


  // Move a block by drag → update dates optimistically
  const handleBlockMove = useCallback(async (planId: string, newEntry: string, newExit: string) => {
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, entry_date: newEntry, exit_date: newExit }
      : p
    ))
    // persist async
    await apiFetch(`/api/grazing-plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify({ entry_date: newEntry, exit_date: newExit }),
    })
  }, [])

  const filteredPlans = useMemo(() =>
    plans.filter(p => {
      const matchSearch = (p.paddocks?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (p.herds?.name || '').toLowerCase().includes(search.toLowerCase())
      // In History mode, default to showing COMPLETED, unless user overrides
      const isHistoryMode = viewMode === 'history'
      const matchStatus = filterStatus === 'all' ? (isHistoryMode ? p.status === 'COMPLETED' : true) : p.status === filterStatus
      return matchSearch && matchStatus
    }),
    [plans, search, filterStatus, viewMode]
  )

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

  // ── Season Plan Modal state ────────────────────────────────────────────────
  const [showSeasonPlan, setShowSeasonPlan] = useState(false)
  const [showExcelImporter, setShowExcelImporter] = useState(false)

  // ── History Tab Actions ───────────────────────────────────────────────────
  const handleDeleteSeasonPlan = async (id: string, name: string) => {
    const ok = await confirm({
      title: `¿Eliminar el plan "${name}"?`,
      description: 'Se borrarán todos los movimientos del Gantt asociados a esta importación en modo cascada. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar en cascada',
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
      // Fallback a enero de ese año si el archivo no tenía fechas específicas
      focusDate = plan.year ? `${plan.year}-01-01` : new Date().toISOString().split('T')[0]
    }
    setGanttWindow(focusDate)
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
      <div className="space-y-5 pb-10">

      {/* ─── Header simplificado ─── */}
      <div className="flex items-center justify-between gap-4">

        {/* Left: Título + badges de contexto */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-gray-950 leading-tight">
              Planificador de pastoreo
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${season.color}`}>
                {season.icon} {season.name}
              </span>
              {/* Weather quick link */}
              <button
                onClick={() => router.push('/dashboard/clima')}
                title="Ver datos climáticos"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <CloudRain className="w-2.5 h-2.5" />
                {(() => {
                  const mm = weatherEvents
                    .filter((ev: any) => ev.type === 'RAIN')
                    .reduce((s: number, ev: any) => s + Number(ev.value || 0), 0)
                  const h = weatherEvents.filter((ev: any) => ev.type === 'FROST').length
                  if (mm > 0 || h > 0) return `${Math.round(mm)} mm · ${h} helada${h !== 1 ? 's' : ''}`
                  return 'Clima'
                })()}
              </button>
            </div>
          </div>
        </div>

        {/* Right: View toggle + acciones */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Vista toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex items-center shadow-sm gap-0.5">
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

          {/* Botón Planificar — dropdown con Manual y Sugerida */}
          <div className="relative">
            <button
              onClick={() => setPlanMenuOpen(v => !v)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-bold text-sm rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Planificar
            </button>
            {planMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPlanMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50">
                  <button
                    onClick={() => { setPlanMenuOpen(false); setShowSeasonPlan(true) }}
                    disabled={loading}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40 text-left transition-colors group"
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-400 group-hover:bg-sky-500 shrink-0 transition-colors" />
                    <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Sugerida</span>
                  </button>
                  <button
                    onClick={() => { setPlanMenuOpen(false); handleOpenModal() }}
                    disabled={loading}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-700 disabled:opacity-40 text-left transition-colors group"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 group-hover:bg-green-600 shrink-0 transition-colors" />
                    <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Manual</span>
                  </button>
                </div>
              </>
            )}
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

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      ) : plans.length === 0 && viewMode === 'gantt' ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <Calendar className="w-8 h-8 text-gray-200" />
          </div>
          <p className="text-sm font-black text-gray-950">Sin planificaciones aún</p>
          <p className="text-xs text-gray-400 mt-1 mb-6">Empezá tu primer plan de pastoreo sugerido o manual.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setShowSeasonPlan(true)}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-sky-400 text-sky-700 font-bold text-sm rounded-xl transition-all hover:bg-sky-50 hover:shadow-md disabled:opacity-50 group"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400 group-hover:scale-125 transition-transform" />
              <Plus className="w-4 h-4" /> Sugerida
            </button>
            <button
              onClick={() => { handleOpenModal() }}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-green-400 text-green-700 font-bold text-sm rounded-xl transition-all hover:bg-green-50 hover:shadow-md disabled:opacity-50 group"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 group-hover:scale-125 transition-transform" />
              <Plus className="w-4 h-4" /> Manual
            </button>
          </div>
        </div>
      ) : viewMode === 'gantt' ? (
        <div className="space-y-3">
          {/* Gantt period control — solo Anual + filtros de temporada */}
          <div className="flex flex-wrap items-center gap-2 justify-start w-full">
            <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
              <button
                onClick={() => setSeasonalFilters(['abierta', 'cerrada'])}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  seasonalFilters.length === 2 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Anual
              </button>
              <div className="w-[1px] bg-gray-200 mx-1" />
              <button
                onClick={() => {
                  setSeasonalFilters(prev => {
                    if (prev.includes('abierta')) {
                      if (prev.length === 1) return prev // don't allow empty
                      return prev.filter(x => x !== 'abierta')
                    }
                    return [...prev, 'abierta']
                  })
                }}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  seasonalFilters.includes('abierta') && seasonalFilters.length === 1 ? 'bg-white text-gray-900 shadow-sm' : 
                  seasonalFilters.includes('abierta') ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Temporada abierta
              </button>
              <button
                onClick={() => {
                  setSeasonalFilters(prev => {
                    if (prev.includes('cerrada')) {
                      if (prev.length === 1) return prev // don't allow empty
                      return prev.filter(x => x !== 'cerrada')
                    }
                    return [...prev, 'cerrada']
                  })
                }}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  seasonalFilters.includes('cerrada') && seasonalFilters.length === 1 ? 'bg-white text-gray-900 shadow-sm' :
                  seasonalFilters.includes('cerrada') ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Temporada cerrada
              </button>
            </div>

            {/* Borrar planificadas — solo ícono, abre modal de acción crítica */}
            {plans.filter(p => p.status === 'PLANNED').length > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                title={`Eliminar ${plans.filter(p => p.status === 'PLANNED').length} planificaciones`}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-all disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>


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
                        setCloseForm({ actual_exit_date: new Date().toISOString().split('T')[0], exit_dry_matter_kg_ha: '' })
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
            farmEvents={farmEvents}
            windowStart={ganttWindow}
            windowDays={WINDOW_DAYS}
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
              router.push(`/dashboard/mi-campo?editPaddock=${paddockId}`)
            }}
            droughtThresholdMm={droughtThresholdMm}
            onDroughtThresholdChange={handleDroughtThresholdChange}
            targetRemnant={targetRemnant}
            dailyAllocationKg={dailyAllocationKg}
          />

          <div className="mt-4">
            <DashboardMetricsBar data={dashboardMetricsData} />
          </div>

          {/* Hint + quick export */}
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="text-[10px] text-gray-400 font-medium">
              Arrastrá bloques para cambiar fechas · Clic en cualquier bloque para registrar fechas reales
            </p>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 hover:border-green-300 hover:text-green-700 transition-all shadow-sm shrink-0"
            >
              <Download className="w-3 h-3" /> Exportar Excel
            </button>
          </div>
        </div>


      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <p className="text-xs font-black text-gray-500">{filteredPlans.length} planificaciones</p>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-600 hover:border-green-300 hover:text-green-700 transition-all shadow-sm"
            >
              <Download className="w-3 h-3" /> Exportar Excel
            </button>
          </div>
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
                        <p className="text-sm font-bold text-gray-900">{sp.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {sp.year} · {sp.season_type === 'cerrado' ? 'Plan cerrado' : 'Plan abierto'}
                          {sp.total_ha ? ` · ${Number(sp.total_ha).toFixed(0)} ha` : ''}
                          {sp.source === 'excel_import' ? ' · Excel' : ''}
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
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Potrero / Rodeo', 'Estado', 'Entrada plan', 'Entrada real', 'Salida plan', 'Salida real', 'Días plan', 'Días reales', 'Remanente', 'Desvío vs plan'].map(h => (
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
                  
                  const plannedDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : 0
                  const actualDays = (plan.actual_entry_date && plan.actual_exit_date) 
                    ? daysBetween(plan.actual_entry_date, plan.actual_exit_date) 
                    : null
                    
                  const daysDev = actualDays !== null && plannedDays > 0 ? (actualDays - plannedDays) : 0
                  const hasDeviation = daysDev !== 0
                  
                  const isCompletedPlan = plan.status === 'COMPLETED'
                  return (
                    <tr
                      key={plan.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (isCompletedPlan) {
                          // Abrir mini-modal de corrección de fecha real
                          setCloseForm({
                            actual_exit_date: plan.actual_exit_date || plan.exit_date || new Date().toISOString().split('T')[0],
                            exit_dry_matter_kg_ha: plan.exit_dry_matter_kg_ha?.toString() || '',
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
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
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
                        {plan.actual_entry_date ? (
                          <span className={`font-bold ${
                            plan.entry_date && plan.actual_entry_date !== plan.entry_date ? 'text-amber-700' : 'text-gray-900'
                          }`}>{fmt(plan.actual_entry_date)}</span>
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
                    </tr>
                  )
                })}
                {filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">
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
        const plan = planPopover.plan
        const paddock = paddocks.find((p: any) => p.id === plan.paddock_id) || plan.paddocks
        // For suggested plans use the full cycle herd list, otherwise use block herd_ids
        const cycleHerdIds = plan.ai_analysis?.cycle_all_herd_ids
        const displayHerdIds = cycleHerdIds?.length > 0 ? cycleHerdIds : (plan.herd_ids || [plan.herd_id])
        const planHerds = herds.filter((h: any) => displayHerdIds.includes(h.id))
        const planDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : null
        const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
        return (
          <>
            <div className="fixed inset-0 z-[9990]" onClick={() => setPlanPopover(null)} />
            <div
              className="fixed z-[9991] bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 overflow-hidden"
              style={{ left: Math.min(planPopover.x - 144, window.innerWidth - 296), top: Math.min(planPopover.y, window.innerHeight - 320) }}
            >
              {/* Header — paddock name is the hero */}
              <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-black text-gray-950 leading-tight">{paddock?.name || '—'}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{Number(paddock?.area_ha || 0).toFixed(1)} ha</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1 ${st.bg} ${st.color}`}>{st.label}</span>
              </div>
              {/* Dates row */}
              <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-gray-50">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Entrada</p>
                  <p className="text-xs font-bold text-gray-900">{fmt(plan.entry_date)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Salida</p>
                  <p className="text-xs font-bold text-gray-900">{plan.exit_date ? fmt(plan.exit_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Estadía</p>
                  <p className="text-xs font-bold text-gray-900">{planDays ? `${planDays}d` : '—'}</p>
                </div>
              </div>
              {/* Herds — simplified: Nombre + Cabezas only */}
              {planHerds.length > 0 && (
                <div className="px-5 py-3 space-y-1.5 border-b border-gray-50">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hacienda</p>
                  {planHerds.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">{h.name}</span>
                      <span className="text-xs font-bold text-gray-500">{h.animal_count || h.head_count || '—'} cab.</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Actions — diferenciar por estado del plan */}
              {(() => {
                const today = new Date()
                today.setHours(0,0,0,0)
                const exitDate  = plan.exit_date  ? new Date(plan.exit_date  + 'T00:00:00') : null
                const entryDate = plan.entry_date ? new Date(plan.entry_date + 'T00:00:00') : null
                const daysUntilExit = exitDate ? Math.ceil((exitDate.getTime() - today.getTime()) / 86400000) : null
                const isCompleted = plan.status === 'COMPLETED'
                const isOverdue  = exitDate && exitDate <= today && !isCompleted
                const isUrgent   = daysUntilExit !== null && daysUntilExit <= 1 && !isCompleted
                return (
                  <div className="px-5 pb-4 pt-3 space-y-2">
                    {/* Alerta de movimiento urgente en el popover */}
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
                          {/* Finalizar — siempre disponible para planes no completados */}
                          <button
                            onClick={() => {
                              setPlanPopover(null)
                              setCloseForm({
                                actual_exit_date: new Date().toISOString().split('T')[0],
                                exit_dry_matter_kg_ha: '',
                              })
                              setClosePlanModal({ plan })
                            }}
                            className="flex-1 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> Finalizar pastoreo
                          </button>
                          {/* Editar — secundario */}
                          <button
                            onClick={() => { setPlanPopover(null); handleOpenModal(plan) }}
                            title="Editar fechas planificadas"
                            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all border border-gray-200 text-xs font-bold"
                          >
                            Editar
                          </button>
                        </>
                      ) : (
                        /* Plan completado — abrir modal de corrección de cierre */
                        <button
                          onClick={() => {
                            setPlanPopover(null)
                            setCloseForm({
                              actual_exit_date: plan.actual_exit_date || plan.exit_date || new Date().toISOString().split('T')[0],
                              exit_dry_matter_kg_ha: plan.exit_dry_matter_kg_ha?.toString() || '',
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
                          const ok = await confirm({
                            title: '¿Eliminar esta planificación?',
                            description: 'El bloque de pastoreo será eliminado del Gantt.',
                            confirmLabel: 'Eliminar',
                            variant: 'danger',
                          })
                          if (!ok) return
                          try {
                            const res = await apiFetch(`/api/grazing-plans/${plan.id}`, { method: 'DELETE' })
                            if (res.ok) {
                              setPlans((prev: any[]) => prev.filter(p => p.id !== plan.id))
                              setPlanPopover(null)
                              toast.success('Planificación eliminada')
                            } else {
                              const err = await res.json().catch(() => ({ error: 'Error' }))
                              toast.error(err.error || 'No se pudo eliminar')
                            }
                          } catch(e: any) { toast.error(e.message) }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </>
        )
      })()}

      {/* ─── MODAL: Finalizar Pastoreo ──────────────────────────────────────── */}
      {closePlanModal && (() => {
        const plan = closePlanModal.plan
        const paddock = paddocks.find((p: any) => p.id === plan.paddock_id)
        const planHerds = herds.filter((h: any) => (plan.herd_ids || [plan.herd_id]).includes(h.id))
        const planDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : null
        const isAlreadyCompleted = plan.status === 'COMPLETED'
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isAlreadyCompleted ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <p className="text-base font-black text-gray-950">
                      {isAlreadyCompleted ? 'Corregir datos de cierre' : 'Finalizar pastoreo'}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                    {paddock?.name || '—'} · {Number(paddock?.area_ha || 0).toFixed(1)} ha
                  </p>
                </div>
                <button onClick={() => setClosePlanModal(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Plan summary — readonly */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
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
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {planHerds.map((h: any) => (
                      <span key={h.id} className="text-[10px] font-bold px-2 py-0.5 bg-white rounded-lg border border-gray-200 text-gray-600">
                        {h.name} · {h.animal_count || h.head_count || '?'} cab.
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Form — solo 2 campos */}
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Fecha real de salida *</label>
                  <input
                    type="date"
                    value={closeForm.actual_exit_date}
                    onChange={e => setCloseForm(prev => ({ ...prev, actual_exit_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  />
                  <p className="text-[10px] text-gray-400 font-medium">La fecha en que realmente salieron los animales del potrero.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Remanente de pasto (kg MS/ha)</label>
                  <input
                    type="number"
                    step={50}
                    min={0}
                    value={closeForm.exit_dry_matter_kg_ha}
                    onChange={e => setCloseForm(prev => ({ ...prev, exit_dry_matter_kg_ha: e.target.value }))}
                    placeholder="Ej: 800"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-gray-300"
                  />
                  <p className="text-[10px] text-gray-400 font-medium">Pasto que quedó en pie al terminar el pastoreo. Dato clave para validar el remanente objetivo.</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setClosePlanModal(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={!closeForm.actual_exit_date || savingClose}
                  onClick={async () => {
                    if (!closeForm.actual_exit_date) return
                    setSavingClose(true)
                    try {
                      const body: any = {
                        status: 'COMPLETED',
                        actual_exit_date: closeForm.actual_exit_date,
                      }
                      if (closeForm.exit_dry_matter_kg_ha) {
                        body.exit_dry_matter_kg_ha = Number(closeForm.exit_dry_matter_kg_ha)
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
                  className="flex-2 px-8 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {savingClose ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isAlreadyCompleted ? 'Actualizar' : 'Confirmar salida'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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

      {/* ─── MODAL: Vista única — diseño unificado ─────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* ─── MODAL HEADER ─── */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
              <div>
                {/* Title: distinguish suggested vs manual */}
                <div className="flex items-center gap-2">
                  {formData.id && formData.ai_analysis?.plan_source === 'suggested' && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 uppercase tracking-widest">Sugerida</span>
                  )}
                  {formData.id && formData.ai_analysis?.plan_source === 'manual' && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-widest">Manual</span>
                  )}
                  <h3 className="text-base font-black text-gray-950">
                    {formData.id ? 'Editar planificación manual' : 'Planificación manual'}
                  </h3>
                </div>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                  {(() => {
                    const isSuggested = formData.ai_analysis?.plan_source === 'suggested'
                    const cycleAllPaddockIds = formData.ai_analysis?.cycle_all_paddock_ids as string[] | undefined
                    const paddockName = paddocks.find(p => p.id === formData.paddock_id)?.name
                    if (isSuggested && cycleAllPaddockIds && cycleAllPaddockIds.length > 0) {
                      const nPaddocks = cycleAllPaddockIds.length
                      const nHerds   = (formData.ai_analysis?.cycle_all_herd_ids as string[] | undefined)?.length || formData.herd_ids.length
                      return `Ciclo ${nPaddocks}P × ${nHerds}R · Bloque en ${paddockName} · ${totalPlanEV.toFixed(0)} EV`
                    }
                    if (formData.paddock_id && formData.herd_ids.length > 0) {
                      return `${paddockName} · ${formData.herd_ids.length} rodeo${formData.herd_ids.length > 1 ? 's' : ''} · ${totalPlanEV > 0 ? `${totalPlanEV.toFixed(0)} EV total` : ''}`
                    }
                    return 'Elegí los rodeos y el potrero de destino'
                  })()}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>


            {/* ─── MODAL BODY ─── */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Cycle info banner — only for suggested plans */}
              {formData.id && formData.ai_analysis?.plan_source === 'suggested' && formData.ai_analysis?.cycle_id && (() => {
                const cycleAllPaddockIds = formData.ai_analysis.cycle_all_paddock_ids as string[] | undefined || []
                const cycleAllHerdIds    = formData.ai_analysis.cycle_all_herd_ids    as string[] | undefined || []
                const cyclePaddocks = paddocks.filter(p => cycleAllPaddockIds.includes(p.id))
                const cycleHerds   = herds.filter(h => cycleAllHerdIds.includes(h.id))
                return (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-xs font-black text-green-800 uppercase tracking-wider">
                        Ciclo Sugerido — {cyclePaddocks.length} Potreros × {cycleHerds.length} Rodeos
                      </p>
                    </div>
                    {/* Paddocks in cycle */}
                    {cyclePaddocks.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-green-600 tracking-widest uppercase mb-1.5">Potreros en la rotación</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cyclePaddocks.map(p => (
                            <span
                              key={p.id}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                p.id === formData.paddock_id
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-white text-green-700 border-green-300'
                              }`}
                            >
                              {p.id === formData.paddock_id ? '✓ ' : ''}{p.name}
                              <span className={`text-[8px] ${p.id === formData.paddock_id ? 'text-green-200' : 'text-green-400'}`}>
                                {Number(p.area_ha).toFixed(0)}ha
                              </span>
                              {p.technical_data?.relative_quality && (
                                <span className={`text-[8px] font-black ${p.id === formData.paddock_id ? 'text-green-800' : 'text-green-700'}`}>
                                  {p.technical_data.relative_quality}/10
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Herds in cycle */}
                    {cycleHerds.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-green-600 tracking-widest uppercase mb-1.5">Rodeos en la rotación</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cycleHerds.map(h => (
                            <span
                              key={h.id}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-blue-700 border border-blue-200"
                            >
                              {h.name} · {Number(h.total_ev).toFixed(0)} EV
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[9px] text-green-600 font-medium">
                      Este bloque corresponde a un giro del ciclo. Editando las fechas sólo afectars este movimiento.
                    </p>
                  </div>
                )
              })()}

              {/* ① RODEOS — lo más importante primero, tarjetas grandes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">
                    {formData.ai_analysis?.plan_source === 'suggested' && formData.id
                      ? 'Rodeos del ciclo (este bloque usa el rodeo activo)'
                      : '¿Qué rodeos van a moverse?'
                    }
                  </label>

                  {formData.herd_ids.length > 0 && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      {formData.herd_ids.length} seleccionado{formData.herd_ids.length > 1 ? 's' : ''} · {totalPlanEV.toFixed(0)} EV
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {herds.map(h => {
                    const isSelected = formData.herd_ids.includes(h.id)
                    const hColor = herdColorMap[h.id] || '#16a34a'
                    const isSuggestedEdit  = formData.ai_analysis?.plan_source === 'suggested' && formData.id
                    // For suggested: the active grazing herd = the original plan.herd_id (first in original herd_ids before expansion)
                    // We stored it before; use the stored plan data which had herd_ids=[activeHerd]
                    // Fallback: first selected herd alphabetically to indicate which is "active" this block
                    const isActiveHerd = isSuggestedEdit
                      ? (formData as any)._original_herd_id
                        ? h.id === (formData as any)._original_herd_id
                        : false
                      : false
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          if (!isSuggestedEdit) {
                            if (isSelected) setFormData({ ...formData, herd_ids: formData.herd_ids.filter(id => id !== h.id) })
                            else setFormData({ ...formData, herd_ids: [...formData.herd_ids, h.id] })
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border-2 text-left transition-all ${
                          isSuggestedEdit
                            ? isSelected
                              ? 'border-green-600 bg-white shadow-sm'
                              : 'border-gray-100 bg-white text-gray-400 opacity-50 cursor-default'
                            : isSelected
                              ? 'border-green-600 bg-white shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelected
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                          }
                          <div>
                            <p className={`text-sm font-bold text-gray-900 flex items-center gap-1.5`}>
                              {h.name}
                              {isSuggestedEdit && h.id === (formData as any)._original_herd_id && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Activo</span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400">{Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>


                

                {/* Animales Extra */}
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Inclusión de Animales Extra (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => setTempAnimals([...tempAnimals, { species: 'Toros', count: 1, weight_kg: 450, entry_date: formData.entry_date || '', exit_date: formData.exit_date || '' }])}
                      className="text-[10px] font-black text-green-600 flex items-center gap-1 hover:underline px-2 py-1 bg-green-50 rounded-lg"
                    >
                      <Plus className="w-3 h-3" /> Agregar grupo extra
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tempAnimals.map((ta, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-100 shadow-sm">
                        {/* Fila 1: Especie + Cantidad + Peso */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={ta.species}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].species = e.target.value; setTempAnimals(nm) }}
                            placeholder="Ej: Toros"
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <input
                            type="number"
                            min="1"
                            value={ta.count}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].count = Number(e.target.value); setTempAnimals(nm) }}
                            placeholder="Cant."
                            className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 w-24">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={Math.round(ta.weight_kg)}
                              onChange={e => { const nm = [...tempAnimals]; nm[idx].weight_kg = Math.round(Number(e.target.value)); setTempAnimals(nm) }}
                              className="w-full text-xs font-bold focus:outline-none text-right"
                            />
                            <span className="text-[10px] text-gray-400 font-bold shrink-0">kg</span>
                          </div>
                          <button type="button" onClick={() => setTempAnimals(tempAnimals.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {/* Fila 2: Fechas de ingreso/egreso */}
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] font-black text-gray-700 tracking-wider uppercase whitespace-nowrap">Ingreso</label>
                          <input
                            type="date"
                            value={ta.entry_date || ''}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].entry_date = e.target.value; setTempAnimals(nm) }}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <label className="text-[9px] font-black text-gray-700 tracking-wider uppercase whitespace-nowrap">Egreso</label>
                          <input
                            type="date"
                            value={ta.exit_date || ''}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].exit_date = e.target.value; setTempAnimals(nm) }}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          {/* EV ponderado preview */}
                          {ta.entry_date && ta.exit_date && formData.entry_date && formData.exit_date && (() => {
                            const planD = Math.max(1, Math.ceil((new Date(formData.exit_date).getTime() - new Date(formData.entry_date).getTime()) / 86400000))
                            const oS = ta.entry_date > formData.entry_date ? ta.entry_date : formData.entry_date
                            const oE = ta.exit_date  < formData.exit_date  ? ta.exit_date  : formData.exit_date
                            const oD = Math.max(0, Math.ceil((new Date(oE).getTime() - new Date(oS).getTime()) / 86400000))
                            const ev = ((ta.count * ta.weight_kg) / 450) * (oD / planD)
                            return <span className="text-[9px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">{ev.toFixed(1)} EV</span>
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Live cascade impact preview (for suggested cycle plans with extra animals) ── */}
                {formData.ai_analysis?.plan_source === 'suggested' && formData.ai_analysis?.cycle_id && tempAnimals.length > 0 && formData.paddock_id && formData.entry_date && formData.exit_date && (() => {
                  const cycleId = formData.ai_analysis.cycle_id as string
                  const paddock = paddocks.find(p => p.id === formData.paddock_id)
                  if (!paddock) return null
                  const area     = Number(paddock.area_ha) || 0
                  const ms       = Number(paddock.dry_matter_kg_ha) || 1800
                  const remnant  = 1100
                  const usableMs = calculateUsableForage(ms, remnant, area)
                  // Base EV from this block's original herd
                  const origHerdId = (formData as any)._original_herd_id || formData.herd_ids[0]
                  const baseHerd = herds.find(h => h.id === origHerdId)
                  const baseEV = baseHerd ? Number(baseHerd.total_ev || 0) : 0
                  // Extra EV weighted
                  const planEntry = new Date(formData.entry_date + 'T00:00:00')
                  const planExit  = new Date(formData.exit_date  + 'T00:00:00')
                  const planDays  = Math.max(1, Math.round((planExit.getTime() - planEntry.getTime()) / 86400000))
                  const extraEV = tempAnimals.reduce((sum, a) => {
                    const evRaw = (a.count * a.weight_kg) / 450
                    if (a.entry_date && a.exit_date) {
                      const aE = new Date(a.entry_date + 'T00:00:00'), aX = new Date(a.exit_date + 'T00:00:00')
                      const oS = aE > planEntry ? aE : planEntry, oE = aX < planExit ? aX : planExit
                      const oD = Math.max(0, Math.round((oE.getTime() - oS.getTime()) / 86400000))
                      return sum + evRaw * (oD / planDays)
                    }
                    return sum + evRaw
                  }, 0)
                  const newTotalEV     = baseEV + extraEV
                  const dailyDemandNew = newTotalEV * 12
                  const newDays        = dailyDemandNew > 0 ? Math.max(1, calculateGrazingDays(usableMs, dailyDemandNew)) : planDays
                  const deltaDays      = newDays - planDays // negative = fewer days
                  const siblingsCount  = plans.filter(p => p.ai_analysis?.cycle_id === cycleId && p.entry_date > formData.entry_date).length
                  const extraAnimalEndDate = tempAnimals.reduce((latest, a) => a.exit_date && a.exit_date > latest ? a.exit_date : latest, formData.exit_date)
                  const isMultiMonth = extraAnimalEndDate > formData.exit_date
                  if (Math.abs(deltaDays) === 0) return null
                  return (
                    <div className={`mt-2 p-3 rounded-xl border flex items-start gap-2.5 ${deltaDays < 0 ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${deltaDays < 0 ? 'text-gray-500' : 'text-green-500'}`} />
                      <div>
                        <p className={`text-xs font-black ${deltaDays < 0 ? 'text-gray-800' : 'text-green-800'}`}>
                          {deltaDays < 0
                            ? `⚠ Días reducidos: ${planDays}d → ${newDays}d (${Math.abs(deltaDays)}d menos por mayor demanda EV)`
                            : `↑ Días ampliados: ${planDays}d → ${newDays}d (+${deltaDays}d)`
                          }
                        </p>
                        <p className={`text-[10px] font-medium mt-0.5 ${deltaDays < 0 ? 'text-gray-600' : 'text-green-600'}`}>
                          {siblingsCount > 0
                            ? `Se correrán automáticamente ${siblingsCount} bloque${siblingsCount > 1 ? 's' : ''} siguiente${siblingsCount > 1 ? 's' : ''} del ciclo.`
                            : 'No hay bloques siguientes en este ciclo.'
                          }
                          {isMultiMonth && ' Los animales extra afectarán también los bloques que se solapan.'}
                        </p>
                      </div>
                    </div>
                  )
                })()}

              </div>

              {/* ② POTRERO DESTINO */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">¿A qué potrero van?</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {paddocks.map(p => {
                    const isSelected = formData.paddock_id === p.id
                    const pMsHa = Number(p.dry_matter_kg_ha) || 0
                    const pAreaHa = Number(p.area_ha) || 0
                    // Per-paddock holistic metrics for the modal paddock list
                    const pUsableMs = pMsHa > 0 ? Math.max(0, (pMsHa - targetRemnant) * pAreaHa) : 0
                    const pDah = totalPlanEV > 0 && dailyAllocationKg > 0 && pUsableMs > 0
                      ? Math.max(0, Math.floor(pUsableMs / (totalPlanEV * dailyAllocationKg)))
                      : null
                    // yield coef vs module average
                    const modAvg = paddocks.filter((px: any) => Number(px.dry_matter_kg_ha) > 0).length > 0
                      ? paddocks.filter((px: any) => Number(px.dry_matter_kg_ha) > 0).reduce((s: number, px: any) => s + Number(px.dry_matter_kg_ha), 0)
                        / paddocks.filter((px: any) => Number(px.dry_matter_kg_ha) > 0).length
                      : 0
                    const pCoef = modAvg > 0 && pMsHa > 0 ? pMsHa / modAvg : null
                    // % USO: sum of planned days in active plans for this paddock / DAH
                    const paddockActiveDays = plans
                      .filter(pl => pl.paddock_id === p.id && pl.status !== 'COMPLETED')
                      .reduce((s, pl) => {
                        if (!pl.entry_date || !pl.exit_date) return s
                        return s + Math.max(0, Math.round((new Date(pl.exit_date).getTime() - new Date(pl.entry_date).getTime()) / 86400000))
                      }, 0)
                    const pUsagePct = pDah !== null && pDah > 0
                      ? Math.round((paddockActiveDays / pDah) * 100)
                      : null
                    const qualityScore = p.technical_data?.quality_score ?? p.technical_data?.relative_quality ?? null
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, paddock_id: p.id })}
                        className={`flex items-start justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                          isSelected ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {isSelected
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0 mt-0.5"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0 mt-0.5" />
                          }
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-gray-900">{p.name}</p>
                              {qualityScore != null && (
                                  <span title={HOLISTIC_TOOLTIPS.quality} className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border bg-white cursor-help ${
                                    qualityScore >= 7 ? 'text-green-700 border-green-200'
                                    : qualityScore >= 4 ? 'text-amber-600 border-amber-200'
                                    : 'text-red-600 border-red-200'
                                  }`}>{qualityScore}/10</span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">{pAreaHa.toFixed(1)} ha · {pMsHa > 0 ? `${pMsHa.toLocaleString('es')} kg MS/ha` : 'Sin datos MS'}</p>
                            {/* Holistic metrics row */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {pDah !== null && (
                                  <span title={HOLISTIC_TOOLTIPS.estimatedDah} className="text-[9px] font-bold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full cursor-help">{pDah}d DAH</span>
                              )}
                              {pCoef !== null && (
                                  <HoverTooltip text={HOLISTIC_TOOLTIPS.yieldCoef}>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border cursor-help ${
                                      pCoef >= 1.05 ? 'text-green-700 bg-green-50 border-green-100'
                                      : pCoef >= 0.95 ? 'text-gray-600 bg-gray-50 border-gray-200'
                                      : 'text-amber-700 bg-amber-50 border-amber-100'
                                    }`}>×{pCoef.toFixed(2)}</span>
                                  </HoverTooltip>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* MS / ha - right side instead of usage ring */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0 ml-2">
                          <span className="text-[10px] font-black text-gray-700">
                            {pMsHa > 0 ? `${pMsHa.toLocaleString('es')}` : '—'}
                            {pMsHa > 0 && <span className="text-[9px] font-normal text-gray-400 ml-0.5">kg/ha</span>}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ③ SUGERENCIA HOLÍSTICA — aparece cuando hay potrero + rebaños */}
              {formData.paddock_id && totalPlanEV > 0 && suggestion.days > 0 && (() => {
                const sugDays = suggestion.days
                return (
                  <div className="rounded-2xl bg-green-50 border border-green-200 overflow-hidden text-gray-900 shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-green-700" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Motor holístico</p>
                        {selectedPaddock && totalPlanEV > 0 && (() => {
                          const ca = totalPlanEV / Math.max(0.1, Number(selectedPaddock.area_ha || 1))
                          const caColor = ca < 3 ? '#16a34a' : ca < 5 ? '#d97706' : '#dc2626'
                          return (
                            <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full border" style={{ backgroundColor: `${caColor}18`, borderColor: caColor, color: caColor }}>
                              {ca.toFixed(1)} EV/ha
                            </span>
                          )
                        })()}
                      </div>

                      <div className="mb-4 bg-white/70 rounded-xl p-3 border border-green-100 space-y-3">
                        <p className="text-[9px] font-black text-green-700 uppercase tracking-widest">Variables del cálculo</p>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Asign. Diaria */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-600">Asign. Diaria (kg MS/EV)</label>
                            <input
                              type="number" step={0.5} min={6} max={25}
                              value={rawDailyAlloc}
                              onChange={e => {
                                setRawDailyAlloc(e.target.value)
                                const n = parseFloat(e.target.value)
                                if (!isNaN(n) && n > 0) setDailyAllocationKg(n)
                              }}
                              onBlur={() => {
                                const n = parseFloat(rawDailyAlloc)
                                if (isNaN(n) || n <= 0) { setRawDailyAlloc(String(dailyAllocationKg)) }
                              }}
                              className="w-full bg-white border border-green-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-green-500 outline-none"
                            />
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded inline-flex ${
                              dailyAllocationKg <= 11 ? 'bg-red-50 text-red-600'
                              : dailyAllocationKg <= 13 ? 'bg-green-100 text-green-700'
                              : 'bg-blue-50 text-blue-600'
                            }`}>
                              {dailyAllocationKg <= 11 ? 'Déficit' : dailyAllocationKg <= 13 ? 'Normal' : 'Abundante'}
                            </span>
                          </div>

                          {/* Remanente con toggle kg / % */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-600">
                                Remanente {remnantMode === 'kg' ? '(kg MS/ha)' : '(% del total)'}
                              </label>
                              <button
                                type="button"
                                onClick={() => setRemnantMode(m => m === 'kg' ? 'pct' : 'kg')}
                                className="text-[9px] font-black px-1.5 py-0.5 rounded-md border border-green-200 text-green-700 bg-white hover:bg-green-50 transition-colors"
                              >
                                {remnantMode === 'kg' ? 'Cambiar a %' : 'Cambiar a kg'}
                              </button>
                            </div>
                            {remnantMode === 'kg' ? (
                              <input
                                type="number" step={50} min={0}
                                value={rawTargetRemnant}
                                onChange={e => {
                                  setRawTargetRemnant(e.target.value)
                                  const n = parseFloat(e.target.value)
                                  if (!isNaN(n) && n >= 0) setTargetRemnant(n)
                                }}
                                onBlur={() => {
                                  const n = parseFloat(rawTargetRemnant)
                                  if (isNaN(n) || n < 0) setRawTargetRemnant(String(targetRemnant))
                                }}
                                className="w-full bg-white border border-green-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-green-500 outline-none"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number" step={5} min={0} max={80}
                                  value={rawRemnantPct}
                                  onChange={e => {
                                    setRawRemnantPct(e.target.value)
                                    const n = parseFloat(e.target.value)
                                    if (!isNaN(n) && n >= 0 && n <= 80) {
                                      setRemnantPct(n)
                                      const ms = Number(selectedPaddock?.dry_matter_kg_ha) || 0
                                      if (ms > 0) setTargetRemnant(ms * n / 100)
                                    }
                                  }}
                                  onBlur={() => {
                                    const n = parseFloat(rawRemnantPct)
                                    if (isNaN(n) || n < 0) setRawRemnantPct(String(remnantPct))
                                  }}
                                  className="w-full bg-white border border-green-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-green-500 outline-none"
                                />
                                <span className="text-[10px] font-bold text-gray-400 shrink-0">%</span>
                              </div>
                            )}
                            {remnantMode === 'pct' && selectedPaddock?.dry_matter_kg_ha && (
                              <p className="text-[9px] text-gray-400 font-medium">
                                = {Math.round((Number(selectedPaddock.dry_matter_kg_ha) * remnantPct) / 100)} kg/ha
                              </p>
                            )}
                          </div>

                          {/* Días de Gracia */}
                          <div className="space-y-1 col-span-2">
                            <label className="text-[10px] font-bold text-gray-600">Días de Gracia / Reserva</label>
                            <input
                              type="number" min={0}
                              value={rawGraceDays}
                              onChange={e => {
                                setRawGraceDays(e.target.value)
                                const n = parseInt(e.target.value, 10)
                                if (!isNaN(n) && n >= 0) setGraceDays(n)
                              }}
                              onBlur={() => {
                                const n = parseInt(rawGraceDays, 10)
                                if (isNaN(n) || n < 0) setRawGraceDays(String(graceDays))
                              }}
                              className="w-full bg-white border border-green-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-green-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white border border-green-100 shadow-sm rounded-xl p-2.5 text-center">
                          <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider mb-0.5">Estadía</p>
                          <p className="text-2xl font-black text-gray-900">{sugDays}<span className="text-xs ml-0.5 text-green-700">d</span></p>
                        </div>
                        <div className="bg-white border border-green-100 shadow-sm rounded-xl p-2.5 text-center">
                          <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider mb-0.5">Descanso</p>
                          <p className="text-2xl font-black text-gray-900">{suggestion.recovery}<span className="text-xs ml-0.5 text-green-700">d</span></p>
                        </div>
                        <div className="bg-white border border-green-100 shadow-sm rounded-xl p-2.5 text-center">
                          <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider mb-0.5">MS útil</p>
                          <p className="text-base font-black text-gray-900">{Math.round(suggestion.usableMsTotal / 1000).toFixed(1)}<span className="text-xs ml-0.5 text-green-700">t</span></p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!formData.entry_date}
                        onClick={() => {
                          if (!formData.entry_date) return
                          setFormData(prev => ({
                            ...prev,
                            exit_date: addDays(prev.entry_date, sugDays),
                            planned_recovery_days: suggestion.recovery
                          }))
                        }}
                        className="w-full py-2 bg-white text-green-700 rounded-xl text-xs font-black hover:bg-green-700 transition-all hover:text-white border border-green-200 disabled:opacity-40 flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Aplicar sugerencia al plan
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* ④ PLAN: Fechas planificadas */}
              <div className="rounded-2xl border-2 border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100/60 border-b border-gray-200">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(59,130,246,0.35) 2px, rgba(59,130,246,0.35) 4px)' }} />
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Plan — lo que proyectás</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">Entrada plan</label>
                      <input
                        type="date"
                        value={formData.entry_date}
                        onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase flex items-center gap-1">
                        Salida plan
                        {formData.exit_date && formData.entry_date && (
                          <span className={`normal-case font-black ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                            daysBetween(formData.entry_date, formData.exit_date) > 14
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {daysBetween(formData.entry_date, formData.exit_date)}d
                          </span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={formData.exit_date}
                        onChange={e => setFormData({ ...formData, exit_date: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase whitespace-nowrap">Descanso del potrero</label>
                    <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2 flex-1">
                      <input
                        type="number" min={1} max={365}
                        value={formData.planned_recovery_days}
                        onChange={e => setFormData({ ...formData, planned_recovery_days: Number(e.target.value) })}
                        className="w-14 text-sm font-black text-blue-700 bg-transparent outline-none"
                      />
                      <span className="text-xs text-gray-400 font-bold">días</span>
                      {suggestion.recovery > 0 && formData.planned_recovery_days !== suggestion.recovery && (
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, planned_recovery_days: suggestion.recovery }))}
                          className="ml-auto text-[9px] text-gray-600 font-black hover:underline"
                        >
                          Usar sugerido ({suggestion.recovery}d)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GAP: Dato desactualizado */}
                  {isStaleData && formData.paddock_id && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <p className="text-xs font-black text-gray-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Dato de forraje desactualizado (+7 días)
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="kg MS/ha actual"
                          value={inlineDryMatter}
                          onChange={e => setInlineDryMatter(e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-green-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveInlineData}
                          disabled={!inlineDryMatter || savingInlineData}
                          className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-black hover:bg-gray-900 disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingInlineData ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Actualizar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>



            </div>

            {/* ─── MODAL FOOTER ─── */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/60 shrink-0">
              {formData.id && (
                <button type="button" onClick={handleDeletePlan} disabled={saving}
                  className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all" title="Eliminar planificación">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.paddock_id || formData.herd_ids.length === 0 || !formData.entry_date || !formData.exit_date}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Check className="w-4 h-4" /> {formData.id ? 'Guardar cambios' : 'Crear planificación'}</>
                }
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Season Plan Modal ─────────────────────────────────────────── */}
      {showSeasonPlan && (
        <SeasonPlanModal
          paddocks={paddocks}
          herds={herds}
          onClose={() => setShowSeasonPlan(false)}
          onSaved={(seasonPlan) => {
            setShowSeasonPlan(false)
            // Cuando se guarda el plan maestro, pintamos el Gantt matemáticamente
            handleGeneratePlanCycle(seasonPlan)
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
    </div>
    </>
  )
}

