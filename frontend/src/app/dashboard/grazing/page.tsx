'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  Calendar, Plus, CheckCircle2, Clock, MapPin, Search, Filter,
  AlignJustify, CalendarDays, Lightbulb, CloudRain, Sun, ChevronLeft, ChevronRight,
  X, Check, Loader2, Droplets, AlertTriangle, Camera, Leaf, Users, Sparkles, HistoryIcon, Download,
  Zap, TrendingUp, BarChart3, Target, ArrowDown, Share, Trash2
} from 'lucide-react'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'
import * as XLSX from 'xlsx'

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

// ─────────────── INTERACTIVE GANTT ───────────────
interface GanttBlock {
  plan: any
  herdColor: string
  herdIdx: number
}

function InteractiveGantt({
  plans, paddocks, herds, farmEvents, windowStart, windowDays, onBlockClick, onBlockMove,
  rainfallData, onRainfallChange, weatherEvents = [], onPaddockClick

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
}) {
  const ROW_H = 60
  const LABEL_W = 200
  const HEADER_H = 48
  const RAIN_ROW_H = 36
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ planId: string; startX: number; origEntry: string; origExit: string } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)
  const [editingRainKey, setEditingRainKey] = useState<string | null>(null)

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
            <CloudRain className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] font-black text-blue-500 tracking-widest uppercase">Lluvia / Nieve mm</span>
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

          return (
            <div
              key={paddock.id}
              className={`flex border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
              style={{ height: ROW_H }}
            >
              {/* Label — 4 data rows */}
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-2.5 flex items-center gap-2 border-r border-gray-100 shrink-0">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="min-w-0 flex-1 flex flex-col pt-1">
                  {/* Row 1: Nombre + Calidad */}
                  <div className="flex items-center justify-between gap-1 w-full">
                    <button
                      type="button"
                      onClick={() => onPaddockClick?.(paddock.id)}
                      className="text-[12px] font-black text-gray-900 truncate hover:text-green-700 hover:underline transition-colors text-left pb-0.5"
                      title={`Ir al potrero ${paddock.name}`}
                    >
                      {paddock.name}
                    </button>
                    {qualityScore != null && (
                      <span className={`text-[9px] font-black shrink-0 px-1.5 py-0.5 rounded border border-gray-100 bg-gray-50/50 ${qColor}`} title="Calidad de campo">
                        {qualityScore}/10
                      </span>
                    )}
                  </div>
                  {/* Row 2: Hectáreas + Materia Seca */}
                  <div className="flex items-center gap-1.5 opacity-90 mt-0.5">
                    <span className="text-[10px] font-bold text-gray-500">{areaHa.toFixed(1)} ha</span>
                    {msHa > 0 && (
                      <>
                        <span className="text-[8px] text-gray-300">•</span>
                        <span className="text-[10px] text-gray-500">
                          <span className="font-bold text-gray-600">{msHa.toLocaleString('es')}</span> kg MS
                        </span>
                      </>
                    )}
                  </div>
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

                    // ── Color scheme: VIOLET (sugerida) / GREEN (manual) / RED (vencida) ──
                    const isSuggested  = plan.ai_analysis?.plan_source === 'suggested'
                    const VIOLET = '#7c3aed'
                    const GREEN  = '#16a34a'
                    const ORANGE = '#f97316'
                    const RED    = '#dc2626'
                    const planColor = isOverdue ? RED : isSuggested ? VIOLET : GREEN

                    // Plan bar: top half of row
                    const PLAN_TOP = 4
                    const REAL_TOP = 36
                    const BAR_H   = 28

                    // ── PLAN block — diagonal stripes; faded if completed ──
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
                          border: `1.5px solid ${planColor}${isCompleted ? '55' : '88'}`,
                          backgroundColor: 'transparent',
                          cursor: isCompleted ? 'pointer' : 'grab',
                          zIndex: 20,
                          overflow: 'hidden',
                          opacity: isCompleted ? 0.55 : 1,
                          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${planColor}50 4px, ${planColor}50 8px)`,
                          backgroundSize: '8px 8px'
                        }}
                        className="transition-all hover:brightness-90"
                        onMouseDown={e => !isCompleted && !hasRealEntry && handleMouseDown(e, plan)}
                        onClick={(e) => { e.stopPropagation(); onBlockClick(plan, e) }}
                        title={`${isSuggested ? '⚡ SUGERIDA' : '✏️ MANUAL'} — ${herdLabel} · ${fmt(plan.entry_date)}→${fmt(exitDate)}${isCompleted ? ' ✔ Completado' : ''}`}
                      />
                    )

                    // ── REAL block — solid orange, deviation badge ──
                    // Shows for any plan that has actual_entry_date set (ACTIVE or COMPLETED)
                    let realBlock = null
                    if (hasRealEntry) {
                      const realExit      = plan.actual_exit_date || (isCompleted ? exitDate : new Date().toISOString().split('T')[0])
                      const realEntryDiff = daysBetween(windowStart, plan.actual_entry_date)
                      const realDuration  = daysBetween(plan.actual_entry_date, realExit)
                      const realLeft      = Math.max(0, (realEntryDiff / windowDays) * 100)
                      const realWidth     = Math.max(0.3, (realDuration / windowDays) * 100)

                      const plannedDuration = daysBetween(plan.entry_date, exitDate)
                      const devDays  = realDuration - plannedDuration
                      const devLabel = devDays === 0 ? '=' : (devDays > 0 ? `+${devDays}d` : `${devDays}d`)
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
                          title={`REAL: ${herdLabel} · ${fmt(plan.actual_entry_date)}→${fmt(realExit)} · Desvío vs plan: ${devLabel}`}
                        >
                          {/* Deviation badge — always show when there's a real bar */}
                          {plan.entry_date && (
                            <span
                              className="text-[7px] font-black px-1 py-0.5 rounded shrink-0 whitespace-nowrap"
                              style={{ backgroundColor: devColor, color: 'white', marginRight: -2 }}
                            >
                              {devLabel}
                            </span>
                          )}
                        </div>
                      )
                    }

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
                      <span className="text-[9px] font-black text-violet-600 tracking-widest uppercase">Totales</span>
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
                    {/* Carga Global EV/ha */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">EV/ha</span>
                      <span className="text-[10px] font-bold" style={{ color: caColor }}>
                        {cargaGlobal > 0 ? cargaGlobal.toFixed(2) : '—'}
                      </span>
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
                          {/* Labels */}
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ color: caColor, backgroundColor: `${caColor}18` }}>
                              {ca > 0 ? `${ca.toFixed(1)} EV/ha` : '—'}
                            </span>
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
              <div className="w-8 h-4 border-[1.5px] border-violet-500" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(124,58,237,0.4) 3px, rgba(124,58,237,0.4) 6px)' }} />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Sugerida</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 border-[1.5px] border-green-600" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(22,163,74,0.4) 3px, rgba(22,163,74,0.4) 6px)' }} />
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

  // SDH/mm balance
  const totalRainfall = useMemo(() => Object.values(rainfallData).reduce((s, v) => s + v, 0), [rainfallData])

  // AI & Holistics
  const [suggesting, setSuggesting] = useState(false)
  const [suggestedPlans, setSuggestedPlans] = useState<any[]>([])
  const [targetRemnant, setTargetRemnant] = useState(1000)
  const [graceDays, setGraceDays] = useState(0)
  const [inlineDryMatter, setInlineDryMatter] = useState('')
  const [savingInlineData, setSavingInlineData] = useState(false)

  const [viewMode, setViewMode] = useState<'gantt' | 'list' | 'history'>('gantt')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [ganttPeriod, setGanttPeriod] = useState<'trimestral' | 'semestral' | 'anual'>('trimestral')
  const [seasonalFilter, setSeasonalFilter] = useState<'all' | 'abierta' | 'cerrada'>('all')

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
    if (seasonalFilter === 'abierta') {
      const oct = new Date(year, 9, 1)
      setGanttWindow(oct.toISOString().split('T')[0])
      setGanttPeriod('semestral')
    } else if (seasonalFilter === 'cerrada') {
      const mar = new Date(year, 2, 1)
      setGanttWindow(mar.toISOString().split('T')[0])
      setGanttPeriod('semestral')
    }
  }, [seasonalFilter])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showPlanDropdown, setShowPlanDropdown] = useState(false)
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
      return sum + (Number(h?.total_ev) || 0)
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

  // Holistic suggestion using actual dry_matter_kg_ha (60% harvest, 40% remnant)
  const suggestion = useMemo(() => {
    const paddock = paddocks.find(p => String(p.id) === String(formData.paddock_id))
    if (!paddock) return { days: 0, recovery: 60, availableMs: 0, paddockMaxEV: 0, usableMsTotal: 0 }
    const area = Number(paddock.area_ha) || 0
    const ms = Number(paddock.dry_matter_kg_ha) || Number(paddock.estimated_adh) * 66 || 0
    const totalMs = ms * area
    
    // Holistic Calculation: (Available - TargetRemnant) * Area / DailyDemand - GraceDays
    const dailyDemand = totalPlanEV * 11 // 11 kg MS/EV/day
    const availablePerHa = Math.max(0, ms - targetRemnant)
    const usableMsTotal = availablePerHa * area
    
    const baseDays = dailyDemand > 0 ? Math.floor(usableMsTotal / dailyDemand) : 0
    const days = Math.max(0, baseDays - graceDays)
    
    // Max EV this paddock can support for the same days
    const paddockMaxEV = days > 0 ? Math.floor(usableMsTotal / ((days + graceDays) * 11)) : 0
    
    let recovery = 60
    if (weather?.currentSeason === 'SUMMER') recovery = 40
    if (weather?.currentSeason === 'SPRING') recovery = 45
    if (weather?.currentSeason === 'AUTUMN') recovery = 65
    if (weather?.currentSeason === 'WINTER') recovery = 95
    return { days, recovery, availableMs: Math.round(ms), paddockMaxEV, usableMsTotal: Math.round(usableMsTotal) }
  }, [formData.paddock_id, totalPlanEV, paddocks, weather, targetRemnant, graceDays])

  // Drought Reserve (Savory Metric)
  const droughtReserve = useMemo(() => {
    const totalSupply = paddocks.reduce((sum, p) => {
      const ms = Number(p.dry_matter_kg_ha) || Number(p.estimated_adh) * 66 || 0
      return sum + (ms * Number(p.area_ha || 0))
    }, 0)
    const dailyDemand = herds.reduce((sum, h) => sum + (Number(h.total_ev || 0) * 11), 0)
    const days = dailyDemand > 0 ? Math.floor(totalSupply / dailyDemand) : 0
    return { days, isCritical: days < 10 && days > 0 }
  }, [paddocks, herds])

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

  const handleGeneratePlanCycle = async () => {
    // Usar multi-selección del panel sugerido, con fallback a manual si no hay selección
    const activePaddockIds = suggestPaddockIds.length > 0
      ? suggestPaddockIds
      : formData.paddock_id ? [formData.paddock_id] : paddocks.map(p => p.id)
    const activeHerdIds = suggestHerdIds.length > 0
      ? suggestHerdIds
      : formData.herd_ids.length > 0 ? formData.herd_ids : herds.map(h => h.id)
    const startDate = showSuggestPanel ? suggestStartDate : formData.entry_date

    if (activeHerdIds.length === 0 || activePaddockIds.length === 0 || !startDate) {
      alert('Seleccioná al menos un potrero, un rebaño y una fecha de inicio.')
      return
    }

    setSaving(true)
    try {
      const activePaddocks = paddocks.filter(p => activePaddockIds.includes(p.id))
      const activeHerds    = herds.filter(h => activeHerdIds.includes(h.id))

      // EV total incluyendo animales temporales
      const herdsEV = activeHerds.reduce((s, h) => s + Number(h.total_ev || 0), 0)
      const tempEV  = tempAnimals.reduce((sum, a) => sum + (a.count * a.weight_kg) / 450, 0)
      const totalEV = herdsEV + tempEV
      const dailyDemand = totalEV * 13 // 11 kg MS + 2 kg margen

      let currentEntry = new Date(startDate + 'T12:00:00')
      const targetEndDate = new Date(currentEntry)
      targetEndDate.setFullYear(targetEndDate.getFullYear() + 1)

      const newPlans: any[] = []
      // Shared cycle identifier — all plans in this rotation share the same cycle_id
      const cycleId = crypto.randomUUID()
      const cycleAllHerdIds    = activeHerdIds
      const cycleAllPaddockIds = activePaddockIds

      // availabilityMap: timestamp en que cada potrero termina su descanso
      const availabilityMap = new Map<string, number>()
      activePaddocks.forEach(p => {
        // Respetar planificaciones existentes no completadas
        const activePlans = plans.filter(pl =>
          pl.paddock_id === p.id && pl.status !== 'COMPLETED' && pl.exit_date
        )
        if (activePlans.length > 0) {
          const maxExitTs = Math.max(...activePlans.map(pl => new Date(pl.exit_date).getTime()))
          const maxExitDate = new Date(maxExitTs)
          const recDays = getRecoveryDays(maxExitDate)
          maxExitDate.setDate(maxExitDate.getDate() + recDays)
          availabilityMap.set(p.id, maxExitDate.getTime())
        } else {
          availabilityMap.set(p.id, currentEntry.getTime()) // disponible desde el inicio
        }
      })

      // Índice de rotación de rebaños (intercalado)
      let herdRotationIdx = 0
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
          // Ninguno listo → avanzar currentEntry al próximo disponible
          const nextTs = Math.min(...activePaddocks.map(p => availabilityMap.get(p.id) || 0))
          if (!isFinite(nextTs) || nextTs <= currentEntry.getTime()) break
          currentEntry = new Date(nextTs)
          continue
        }

        // Rebaño en turno
        const chosenHerd = activeHerds[herdRotationIdx % activeHerds.length]
        herdRotationIdx++

        // Días de estadía según biomasa disponible (máx 14 días)
        const ms      = Number(chosenPaddock.dry_matter_kg_ha) || 1800
        const area    = Number(chosenPaddock.area_ha) || 10
        const usableMs = Math.max(0, ms - 1100) * area
        const rawDays  = dailyDemand > 0 ? Math.floor(usableMs / dailyDemand) : 3
        const stayDays = Math.max(1, Math.min(rawDays, 14))

        const exitDate = new Date(currentEntry)
        exitDate.setDate(exitDate.getDate() + stayDays)

        // Días de descanso regenerativo según estacionalidad de la fecha de SALIDA (usando valores del usuario)
        const exitMonth = exitDate.getMonth()
        const userRecDays = exitMonth >= 8 || exitMonth <= 1
          ? suggestRestDays.spring
          : exitMonth >= 2 && exitMonth <= 4
            ? suggestRestDays.autumn
            : suggestRestDays.winter
        const recDays = getRecoveryDays(exitDate, userRecDays)

        newPlans.push({
          paddock_id: chosenPaddock.id,
          herd_id:    chosenHerd.id,
          // For this specific block, only the current herd is actively grazing
          herd_ids:   [chosenHerd.id],
          entry_date: currentEntry.toISOString().split('T')[0],
          exit_date:  exitDate.toISOString().split('T')[0],
          planned_recovery_days: recDays,
          status: 'PLANNED',
          temporary_animals: tempAnimals.length > 0 ? tempAnimals : undefined,
          ai_analysis: {
            plan_source: 'suggested',
            // Cycle metadata — allows reconstructing the full selection when editing
            cycle_id:              cycleId,
            cycle_all_herd_ids:    cycleAllHerdIds,
            cycle_all_paddock_ids: cycleAllPaddockIds,
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
        alert('No se generaron planificaciones. Verificá que los potreros y rebaños tengan datos de forraje.')
        setSaving(false)
        return
      }

      // Crear todas las planificaciones en paralelo
      await Promise.all(
        newPlans.map(p => apiFetch('/api/grazing-plans', { method: 'POST', body: JSON.stringify(p) }))
      )

      setIsModalOpen(false)
      setShowSuggestPanel(false)
      loadData()
    } catch(err) {
      console.error(err)
      alert('Error al generar la planificación. Por favor, intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!formData.id) return
    if (!confirm('¿Estás seguro de que deseas eliminar esta planificación?')) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/grazing-plans/${formData.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPlans(prev => prev.filter(p => p.id !== formData.id))
        setIsModalOpen(false)
      } else {
        const errData = await res.json().catch(()=>({error: 'Error desconocido'}))
        alert(`No se pudo eliminar: ${errData.error}`)
      }
    } catch(err: any) {
      console.error(err)
      alert(`No se pudo eliminar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDeletePlanned = async () => {
    const plannedCount = plans.filter(p => p.status === 'PLANNED').length
    if (plannedCount === 0) {
      alert('No hay planificaciones sugeridas para eliminar.')
      return
    }
    if (!confirm(`¿Eliminar ${plannedCount} planificaci${plannedCount === 1 ? 'ón' : 'ones'} sugerida${plannedCount === 1 ? '' : 's'}? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/grazing-plans/bulk-delete?status=PLANNED', { method: 'DELETE' })
      if (res.ok) {
        const { deleted } = await res.json()
        setPlans(prev => prev.filter(p => p.status !== 'PLANNED'))
        alert(`✅ Se eliminaron ${deleted} planificaciones sugeridas.`)
      } else {
        alert('Error al eliminar las planificaciones. Intentá nuevamente.')
      }
    } catch(err) {
      console.error(err)
      alert('Error de conexión.')
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
          alert(`🚨 Potrero bloqueado hasta el ${paddockAvailable} (salida ${conflictExit} + ${recoveryDays} días de descanso regenerativo obligatorio). No se puede solapar ni interrumpir la recuperación del pasto.`)
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
          const usableMs      = Math.max(0, (ms - remnant) * area) // total consumable MS

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
          const dailyDemandNew    = totalEVWithExtras * 11 // 11 kg MS/EV/day
          const newDays           = dailyDemandNew > 0 ? Math.max(1, Math.floor(usableMs / dailyDemandNew)) : planDaysTotal

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
      alert('Error al guardar. Por favor, intentá de nuevo.')
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
      if (!res.ok) { alert('Error al exportar. Intentá de nuevo.'); return }
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
      alert('Error al exportar el historial.')
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
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${season.color}`}>
              {season.icon} {season.name} · {season.type}
            </div>
            {/* ── Weather quick-access badges ── */}
            {(() => {
              const totalRainMm = weatherEvents
                .filter((ev: any) => ev.type === 'RAIN')
                .reduce((s: number, ev: any) => s + Number(ev.value || 0), 0)
              const frostCount = weatherEvents.filter((ev: any) => ev.type === 'FROST').length
              return (
                <>
                  <button
                    onClick={() => router.push('/dashboard/clima')}
                    title="Ver historial de lluvias en Clima"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <CloudRain className="w-3 h-3" />
                    {totalRainMm > 0 ? `${Math.round(totalRainMm)} mm` : 'Lluvia'}
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/clima')}
                    title="Ver heladas en Clima"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100 transition-colors cursor-pointer"
                  >
                    <Droplets className="w-3 h-3" />
                    {frostCount > 0 ? `${frostCount} helada${frostCount > 1 ? 's' : ''}` : 'Heladas'}
                  </button>
                </>
              )
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex items-center shadow-sm gap-0.5">
            {[
              { id: 'gantt', Icon: CalendarDays, label: 'Gantt' },
              { id: 'list',  Icon: AlignJustify,  label: 'Lista' },
              { id: 'history', Icon: HistoryIcon, label: 'Historial' }
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === id ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Split button — Nueva planificación (manual directo) + ∨ → sugerida */}
          <div className="relative">
            <div className="flex items-stretch shadow-md shadow-green-200 rounded-xl overflow-hidden">
              <button
                onClick={() => { setShowPlanDropdown(false); handleOpenModal() }}
                disabled={loading || paddocks.length === 0 || herds.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white hover:bg-green-700 font-bold text-sm disabled:opacity-50 transition-all"
              >
                <Plus className="w-4 h-4" /> Nueva planificación
              </button>
              <div className="w-px bg-green-500/60" />
              <button
                onClick={() => setShowPlanDropdown(v => !v)}
                disabled={loading || paddocks.length === 0 || herds.length === 0}
                className="flex items-center px-2.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all"
                title="Planificación sugerida"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            </div>

            {showPlanDropdown && (
              <>
                <div className="fixed inset-0 z-[998]" onClick={() => setShowPlanDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 z-[999] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[240px]">
                  <button
                    onClick={() => {
                      setShowPlanDropdown(false)
                      setShowSuggestPanel(true)
                      setSuggestPaddockIds(paddocks.map(p => p.id))
                      setSuggestHerdIds(herds.map(h => h.id))
                      setSuggestStartDate(new Date().toISOString().split('T')[0])
                    }}
                    disabled={paddocks.length === 0 || herds.length === 0}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-all text-left disabled:opacity-40"
                  >
                    <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-green-700" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">Planificación sugerida</p>
                      <p className="text-[10px] text-gray-400 font-medium">Genera el ciclo anual automáticamente</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Warning banner if missing data */}
      {!loading && (paddocks.length === 0 || herds.length === 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Necesitás al menos <strong>1 potrero</strong> y <strong>1 rebaño</strong> para planificar.
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
          {/* Gantt period control */}
          <div className="flex flex-wrap items-center gap-2 justify-start w-full">
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
              <div className="w-[1px] bg-gray-200 mx-1" />
              <button
                onClick={() => {
                  const now = new Date()
                  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
                  setGanttWindow(`${year}-09-21`)
                  setGanttPeriod('semestral')
                  setSeasonalFilter('abierta')
                }}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  seasonalFilter === 'abierta' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Temporada abierta
              </button>
              <button
                onClick={() => {
                  const now = new Date()
                  const year = now.getMonth() >= 2 && now.getMonth() < 8 ? now.getFullYear() : (now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear())
                  setGanttWindow(`${year}-03-21`)
                  setGanttPeriod('semestral')
                  setSeasonalFilter('cerrada')
                }}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                  seasonalFilter === 'cerrada' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Temporada cerrada
              </button>
            </div>

            {/* Borrar planificaciones — aparece solo cuando hay proyectadas */}
            {plans.filter(p => p.status === 'PLANNED').length > 0 && (
              <button
                onClick={handleBulkDeletePlanned}
                disabled={saving}
                title="Eliminar todas las planificaciones proyectadas"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 text-red-500 rounded-xl hover:bg-red-100 font-bold text-[10px] disabled:opacity-40 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Borrar {plans.filter(p => p.status === 'PLANNED').length} planificadas
              </button>
            )}
          </div>


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
          />

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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="text-sm font-black text-gray-950">Registro Histórico de Pastoreo</h3>
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
                  {['Potrero / Rodeo', 'Estado', 'Entrada (Real)', 'Salida (Real)', 'Días Efectivos', 'Remanente', 'Desvío vs Plan'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
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
                  
                  return (
                    <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleOpenModal(plan)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{plan.paddocks?.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 max-w-[150px] truncate">{herdNames}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium tabular-nums text-gray-900">
                        {plan.actual_entry_date ? fmt(plan.actual_entry_date) : <span className="text-gray-400 text-[10px]">No reg.</span>}
                        {plan.entry_date && plan.actual_entry_date && plan.entry_date !== plan.actual_entry_date && (
                          <span className="block text-[9px] text-gray-500 mt-0.5" title="Planificado">Plan: {fmt(plan.entry_date)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium tabular-nums text-gray-900">
                        {plan.actual_exit_date ? fmt(plan.actual_exit_date) : <span className="text-gray-400 text-[10px]">No reg.</span>}
                        {plan.exit_date && plan.actual_exit_date && plan.exit_date !== plan.actual_exit_date && (
                          <span className="block text-[9px] text-gray-500 mt-0.5" title="Planificado">Plan: {fmt(plan.exit_date)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-gray-900">
                        {actualDays ?? '—'}
                        <span className="text-[10px] font-normal text-gray-400 ml-1">d</span>
                      </td>
                      <td className="px-5 py-4">
                        {plan.exit_dry_matter_kg_ha ? (
                          <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                            {plan.exit_dry_matter_kg_ha} <span className="text-[9px] text-green-600 font-medium">kg MS/ha</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">Sin dato</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {hasDeviation ? (
                          <span className={`text-xs font-bold ${daysDev > 0 ? 'text-gray-700' : 'text-green-700'}`}>
                            {daysDev > 0 ? '+' : ''}{daysDev} días
                          </span>
                        ) : actualDays !== null ? (
                          <span className="text-xs font-bold text-gray-400">Sin desvío</span>
                        ) : (
                          <span className="text-xs font-bold text-gray-300">—</span>
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
              {/* Actions */}
              <div className="px-5 pb-4 pt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setPlanPopover(null)
                    handleOpenModal(plan)
                  }}
                  className="flex-1 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all"
                >
                  Editar planificación
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('¿Eliminar esta planificación?')) return
                    try {
                      const res = await apiFetch(`/api/grazing-plans/${plan.id}`, { method: 'DELETE' })
                      if (res.ok) {
                        setPlans((prev: any[]) => prev.filter(p => p.id !== plan.id))
                        setPlanPopover(null)
                      } else {
                        const err = await res.json().catch(() => ({ error: 'Error' }))
                        alert(err.error || 'No se pudo eliminar')
                      }
                    } catch(e: any) { alert(e.message) }
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
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
                    {formData.id ? 'Editar movimiento' : 'Nueva planificación'}
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
                      return `${paddockName} · ${formData.herd_ids.length} rebaño${formData.herd_ids.length > 1 ? 's' : ''} · ${totalPlanEV > 0 ? `${totalPlanEV.toFixed(0)} EV total` : ''}`
                    }
                    return 'Elegí los rebaños y el potrero de destino'
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
                        Ciclo Sugerido — {cyclePaddocks.length} Potreros × {cycleHerds.length} Rebaños
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
                        <p className="text-[9px] font-black text-green-600 tracking-widest uppercase mb-1.5">Rebaños en la rotación</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cycleHerds.map(h => (
                            <span
                              key={h.id}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-violet-700 border border-violet-300"
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

              {/* ① REBAÑOS — lo más importante primero, tarjetas grandes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">
                    {formData.ai_analysis?.plan_source === 'suggested' && formData.id
                      ? 'Rebaños del ciclo (este bloque usa el rebaño activo)'
                      : '¿Qué rebaños van a moverse?'
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
                              value={ta.weight_kg}
                              onChange={e => { const nm = [...tempAnimals]; nm[idx].weight_kg = Number(e.target.value); setTempAnimals(nm) }}
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
                  const usableMs = Math.max(0, (ms - remnant) * area)
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
                  const dailyDemandNew = newTotalEV * 11
                  const newDays        = dailyDemandNew > 0 ? Math.max(1, Math.floor(usableMs / dailyDemandNew)) : planDays
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
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, paddock_id: p.id })}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border-2 text-left transition-all ${
                          isSelected ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelected
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                          }
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-gray-900">{p.name}</p>
                              {p.technical_data?.relative_quality && (
                                <span className="text-[9px] text-gray-400 font-bold">{p.technical_data.relative_quality}/10</span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">{Number(p.area_ha).toFixed(1)} ha</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-gray-700 shrink-0">{p.dry_matter_kg_ha || 0} <span className="text-[9px] font-normal text-gray-400">MS/ha</span></p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ③ SUGERENCIA HOLÍSTICA — aparece cuando hay potrero + rebaños */}
              {formData.paddock_id && totalPlanEV > 0 && suggestion.days > 0 && (() => {
                const sugDays = Math.min(suggestion.days, 14)
                return (
                  <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-gray-900 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-green-700" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Motor holístico</p>
                      {/* Carga Animal chip */}
                      {selectedPaddock && totalPlanEV > 0 && (() => {
                        const ca = totalPlanEV / Math.max(0.1, Number(selectedPaddock.area_ha || 1))
                        const caColor = ca < 3 ? '#4ade80' : ca < 5 ? '#fbbf24' : '#f87171'
                        return (
                          <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full border" style={{ backgroundColor: `${caColor}22`, borderColor: caColor, color: caColor }}>
                            🐄 {ca.toFixed(1)} EV/ha
                          </span>
                        )
                      })()}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white border border-green-100 shadow-sm rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider mb-0.5">Estadía</p>
                        <p className={`text-2xl font-black ${sugDays >= 14 ? 'text-green-800' : 'text-gray-900'}`}>{sugDays}<span className="text-xs ml-0.5 text-green-700">d</span></p>
                        {sugDays >= 14 && <p className="text-[8px] text-green-800 font-bold">límite holístico</p>}
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
                      className="w-full py-2 bg-white text-green-700 rounded-xl text-xs font-black hover:bg-green-700 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Aplicar sugerencia al plan
                    </button>
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
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all ${
                          formData.exit_date && daysBetween(formData.entry_date, formData.exit_date) > 14
                            ? 'border-gray-300 focus:ring-gray-400'
                            : 'border-gray-200 focus:ring-green-500'
                        }`}
                      />
                    </div>
                  </div>
                  {formData.exit_date && daysBetween(formData.entry_date, formData.exit_date) > 14 && (
                    <div className="flex items-center gap-2 bg-gray-50 border-gray-200 rounded-xl px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <p className="text-[11px] text-gray-600 font-bold">Supera el límite holístico de 14 días. Considerá dividir el lote.</p>
                    </div>
                  )}
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

              {/* ⑤ REAL: Fechas reales — solo planes existentes */}
              {formData.id && (
                <div className="rounded-2xl border-2 border-green-200 bg-green-50/40 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-green-100/60 border-b border-green-100">
                    <div className="w-4 h-4 bg-green-600 rounded-sm" />
                    <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Real — lo que ocurrió</span>
                    <span className="ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 border bg-white text-gray-400 border-gray-100">
                      {formData.actual_exit_date ? '✅ Completado' : formData.actual_entry_date ? '🐄 En pastoreo' : '⏳ Pendiente'}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-green-700 tracking-widest uppercase flex items-center gap-1">
                          Entrada real
                          {formData.entry_date && formData.actual_entry_date && (
                            <span className={`normal-case font-black text-[9px] px-1.5 py-0.5 rounded-full ${
                              formData.actual_entry_date > formData.entry_date ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'
                            }`}>
                              {formData.actual_entry_date === formData.entry_date ? '= plan'
                                : formData.actual_entry_date > formData.entry_date
                                  ? `+${daysBetween(formData.entry_date, formData.actual_entry_date)}d tardío`
                                  : `−${daysBetween(formData.actual_entry_date, formData.entry_date)}d antes`}
                            </span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={formData.actual_entry_date}
                          onChange={e => setFormData({ ...formData, actual_entry_date: e.target.value })}
                          className="w-full bg-white border-2 border-green-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-green-500 outline-none text-gray-900"
                        />
                        {!formData.actual_entry_date && (
                          <button type="button" onClick={() => setFormData(p => ({ ...p, actual_entry_date: new Date().toISOString().split('T')[0] }))}
                            className="text-[9px] text-green-600 font-black hover:underline">
                            🟢 Entraron hoy
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-green-700 tracking-widest uppercase flex items-center gap-1">
                          Salida real
                          {formData.actual_entry_date && formData.actual_exit_date && (
                            <span className="normal-case font-black text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              {daysBetween(formData.actual_entry_date, formData.actual_exit_date)}d
                            </span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={formData.actual_exit_date}
                          onChange={e => setFormData({ ...formData, actual_exit_date: e.target.value })}
                          disabled={!formData.actual_entry_date}
                          className="w-full bg-white border-2 border-green-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-green-500 outline-none text-gray-900 disabled:opacity-40"
                        />
                        {formData.actual_entry_date && !formData.actual_exit_date && (
                          <button type="button" onClick={() => setFormData(p => ({ ...p, actual_exit_date: new Date().toISOString().split('T')[0] }))}
                            className="text-[9px] text-green-600 font-black hover:underline">
                            🔴 Salieron hoy
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Remanente al cierre — aparece al registrar salida real */}
                    {formData.actual_exit_date && (
                      <div className="bg-gray-50 border-2 border-gray-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-3.5 h-3.5 text-green-700" />
                          <p className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Pasto remanente al cierre</p>
                          <span className="ml-auto text-[9px] text-gray-500 font-bold">Dato holístico clave</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            placeholder="kg MS/ha"
                            value={remnantAnalysis?.dry_matter_kg_ha || ''}
                            onChange={e => setRemnantAnalysis({ dry_matter_kg_ha: Number(e.target.value) })}
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-green-500 outline-none"
                          />
                          <span className="text-xs text-green-700 font-black whitespace-nowrap">kg MS/ha</span>
                        </div>
                        {remnantAnalysis?.dry_matter_kg_ha > 0 && (
                          <p className="text-[9px] text-green-700 font-bold">
                            ✓ Se actualizará el potrero al guardar para calibrar el próximo plan
                          </p>
                        )}
                      </div>
                    )}

                    {formData.actual_entry_date && formData.actual_exit_date && formData.exit_date && (() => {
                      const planD = daysBetween(formData.entry_date, formData.exit_date)
                      const realD = daysBetween(formData.actual_entry_date, formData.actual_exit_date)
                      const dev = realD - planD
                      return (
                        <div className="flex items-center justify-around bg-white border-2 border-green-100 rounded-xl px-4 py-3">
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Plan</p>
                            <p className="text-2xl font-black text-gray-700">{planD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>
                          </div>
                          <div className="text-2xl text-gray-200">→</div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Real</p>
                            <p className="text-2xl font-black text-green-600">{realD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Desvío</p>
                            <p className={`text-2xl font-black ${dev > 0 ? 'text-gray-700' : dev < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {dev > 0 ? '+' : ''}{dev}<span className="text-xs ml-0.5">d</span>
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

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

      {/* ─── MODAL: PLANIFICACIÓN SUGERIDA (multi-potrero, multi-rebaño) ────── */}
      {showSuggestPanel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-950">Planificación Sugerida</h3>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Ciclo anual · rotación intercalada · estacionalidad automática</p>
                </div>
              </div>
              <button onClick={() => setShowSuggestPanel(false)} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-all border-none w-8 h-8">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Fecha de inicio */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">Fecha de inicio del ciclo</label>
                <input
                  type="date"
                  value={suggestStartDate}
                  onChange={e => setSuggestStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Regla estacional — editable */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> Días de descanso regenerativo por estación (H. Sur)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'spring' as const, label: 'Sep–Feb', sub: 'Prim/Verano' },
                    { key: 'autumn' as const, label: 'Mar–May', sub: 'Otoño' },
                    { key: 'winter' as const, label: 'Jun–Ago', sub: 'Invierno' },
                  ] as const).map(s => (
                    <div key={s.key} className="rounded-xl border border-gray-200 bg-white p-2.5 text-center">
                      <p className="text-[11px] font-black text-gray-700">{s.label}</p>
                      <p className="text-[9px] text-gray-400 mb-1">{s.sub}</p>
                      <input
                        type="number"
                        min={7}
                        max={180}
                        value={suggestRestDays[s.key]}
                        onChange={e => setSuggestRestDays(prev => ({ ...prev, [s.key]: Math.max(7, Number(e.target.value)) }))}
                        className="w-full text-center text-xl font-black text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0"
                      />
                      <p className="text-[9px] text-gray-400">días</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-gray-400 font-bold">El algoritmo usa estos valores según la estación de cada turno proyectado.</p>
              </div>

              {/* Multi-selección de Potreros */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">Potreros a incluir en la rotación</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSuggestPaddockIds(paddocks.map(p => p.id))} className="text-[9px] font-black text-green-600 hover:underline">Todos</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSuggestPaddockIds([])} className="text-[9px] font-black text-gray-400 hover:underline">Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {paddocks.map(p => {
                    const isSel = suggestPaddockIds.includes(p.id)
                    const msColor = 'text-green-700'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSuggestPaddockIds(prev =>
                          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        )}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all ${
                          isSel ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSel
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                          }
                          <div>
                            <p className="text-sm font-bold text-gray-900">{p.name}</p>
                            <p className="text-[10px] text-gray-400">{Number(p.area_ha).toFixed(1)} ha</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-700">{p.dry_matter_kg_ha || 0}</p>
                          <p className="text-[9px] text-gray-400">kg MS/ha</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                
              </div>

              {/* Multi-selección de Rebaños */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-700 tracking-widest uppercase">Rebaños a rotar</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSuggestHerdIds(herds.map(h => h.id))} className="text-[9px] font-black text-green-600 hover:underline">Todos</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSuggestHerdIds([])} className="text-[9px] font-black text-gray-400 hover:underline">Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {herds.map((h, i) => {
                    const isSel = suggestHerdIds.includes(h.id)
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSuggestHerdIds(prev =>
                          prev.includes(h.id) ? prev.filter(id => id !== h.id) : [...prev, h.id]
                        )}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all ${
                          isSel ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSel
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                          }
                          <div>
                            <p className="text-sm font-bold text-gray-900">{h.name}</p>
                            <p className="text-[10px] text-gray-400">{Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                
              </div>

              {/* Resumen del algoritmo */}
              {suggestPaddockIds.length > 0 && suggestHerdIds.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1.5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista previa de la rotación</p>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed">
                    <span className="font-black text-gray-900">{suggestPaddockIds.length} potrero{suggestPaddockIds.length > 1 ? 's' : ''}</span> rotando con{' '}
                    <span className="font-black text-gray-900">{suggestHerdIds.length} rebaño{suggestHerdIds.length > 1 ? 's' : ''}</span> en ciclo intercalado a lo largo de <span className="font-black text-green-700">12 meses</span>.
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Cada potrero se asignará al siguiente rebaño disponible cuando su período de descanso (40–92 días según estación) haya concluido.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/60 shrink-0">
              <button onClick={() => setShowSuggestPanel(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all">
                Cancelar
              </button>
              <button
                onClick={handleGeneratePlanCycle}
                disabled={saving || suggestPaddockIds.length === 0 || suggestHerdIds.length === 0 || !suggestStartDate}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando ciclo anual...</>
                  : <><Zap className="w-4 h-4" /> Generar ciclo anual ({suggestPaddockIds.length}P × {suggestHerdIds.length}R)</>
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
