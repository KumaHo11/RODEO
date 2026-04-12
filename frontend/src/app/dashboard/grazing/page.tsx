'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
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
  if (m >= 12 || m <= 2) return { name: 'Verano', type: 'Temporada abierta', icon: '🌿', color: 'bg-green-100 text-green-700' }
  if (m >= 3 && m <= 5)  return { name: 'Otoño',   type: 'Temporada cerrada', icon: '🍂', color: 'bg-amber-100 text-amber-700' }
  if (m >= 6 && m <= 8)  return { name: 'Invierno',type: 'Temporada cerrada', icon: '❄️', color: 'bg-blue-100 text-blue-700' }
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
  rainfallData, onRainfallChange
}: {
  plans: any[]
  paddocks: any[]
  herds: any[]
  farmEvents: any[]
  windowStart: string
  windowDays: number
  onBlockClick: (plan: any) => void
  onBlockMove: (planId: string, newEntry: string, newExit: string) => void
  rainfallData: Record<string, number>
  onRainfallChange: (monthKey: string, mm: number) => void
}) {
  const ROW_H = 68
  const LABEL_W = 170
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
                      <div className="absolute top-0 bottom-0 w-full border-x-2 opacity-20" style={{ borderColor: cfg.color, backgroundColor: `${cfg.color}15` }} />
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

        {/* ── Rainfall Row ── (not sticky: lives inside scrollable content) */}
        <div className="flex border-b border-blue-100 bg-blue-50" style={{ height: RAIN_ROW_H }}>
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-3 flex items-center gap-1.5 border-r border-blue-100 shrink-0">
            <CloudRain className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] font-black text-blue-500 tracking-widest uppercase">Lluvia mm</span>
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
                        {mm > 0 ? (
                          <>
                            <span className="text-[9px] font-black text-blue-700 leading-none">{mm}</span>
                            <span className="text-[6px] text-blue-400 font-bold leading-none">mm</span>
                            <div className="w-4/5 h-[3px] rounded-full mt-0.5" style={{ backgroundColor: `rgba(59,130,246,${Math.min(mm/100, 1)})` }} />
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
                        className={`absolute top-0 bottom-0 pointer-events-none z-0 ${isMultiDay ? 'border-x-2 opacity-10' : 'border-l-[1px] opacity-40'}`} 
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
                    const hasRealExit = !!plan.actual_exit_date
                    const isOverdue = !hasRealEntry && plan.entry_date < today && plan.status !== 'COMPLETED'
                    const isCompleted = plan.status === 'COMPLETED'
                    const isMultiHerd = plan.herd_ids && plan.herd_ids.length > 1
                    const color = herdColorMap[plan.herd_ids?.[0]] || '#16a34a'
                    const primaryHerd = herds.find(h => plan.herd_ids?.includes(h.id))
                    const herdLabel = isMultiHerd ? `${plan.herd_ids.length} Rebaños` : (primaryHerd?.name || 'Rebaño')

                    const overlaps = sorted.filter((p, i) => i < idx &&
                      !(( p.exit_date || addDays(p.entry_date,14)) <= plan.entry_date || p.entry_date >= exitDate))
                    const stackIdx = overlaps.length % 2
                    const topPos = 4 + (stackIdx * 30)
                    const barH = 26

                    // ── PLAN block (dashed border, light fill, draggable)
                    const planBlock = (
                      <div
                        key={`plan-${plan.id}`}
                        style={{
                          position: 'absolute',
                          left: `${Math.min(leftPct, 99)}%`,
                          width: `${Math.min(widthPct, 100 - Math.min(leftPct, 99))}%`,
                          top: topPos,
                          height: barH,
                          minWidth: 8,
                          borderRadius: 0,
                          border: isOverdue ? '2px solid #dc2626' : `2px solid ${color}`,
                          backgroundColor: isOverdue ? 'rgba(220,38,38,0.12)' : `${color}22`,
                          color: isOverdue ? '#dc2626' : color,
                          cursor: isCompleted ? 'default' : 'grab',
                          zIndex: 20,
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 6,
                          paddingRight: 4,
                          overflow: 'hidden',
                          // diagonal stripe pattern for PLAN
                          backgroundImage: isOverdue ? undefined : `repeating-linear-gradient(45deg, transparent, transparent 4px, ${color}18 4px, ${color}18 8px)`,
                          backgroundSize: '8px 8px'
                        }}
                        className="text-[9px] font-black transition-all hover:brightness-95"
                        onMouseDown={e => !isCompleted && !hasRealEntry && handleMouseDown(e, plan)}
                        onClick={() => onBlockClick(plan)}
                        title={`PLAN: ${herdLabel} · ${fmt(plan.entry_date)}→${fmt(exitDate)} · Click para registrar fechas reales`}
                      >
                        {widthPct > 4 && (
                          <span className="truncate flex items-center gap-1">
                            {isOverdue
                              ? <><AlertTriangle className="w-2.5 h-2.5 shrink-0" />{herdLabel}</>
                              : <><Clock className="w-2 h-2 shrink-0" />{herdLabel}</>
                            }
                          </span>
                        )}
                      </div>
                    )

                    // ── REAL block (solid fill, shown ABOVE the plan block if both exist)
                    let realBlock = null
                    if (hasRealEntry) {
                      const realExit = plan.actual_exit_date || (hasRealExit ? plan.actual_exit_date : exitDate)
                      const realEntryDiff = daysBetween(windowStart, plan.actual_entry_date)
                      const realDuration = daysBetween(plan.actual_entry_date, realExit)
                      const realLeft = Math.max(0, (realEntryDiff / windowDays) * 100)
                      const realWidth = Math.max(0.3, (realDuration / windowDays) * 100)

                      realBlock = (
                        <div
                          key={`real-${plan.id}`}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(realLeft, 99)}%`,
                            width: `${Math.min(realWidth, 100 - Math.min(realLeft, 99))}%`,
                            top: topPos,
                            height: barH,
                            minWidth: 6,
                            borderRadius: 0,
                            backgroundColor: isCompleted ? '#6b7280' : color,
                            color: 'white',
                            zIndex: 25,
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: 6,
                            paddingRight: 4,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            boxShadow: `0 1px 4px ${color}66`
                          }}
                          className="text-[9px] font-black"
                          onClick={() => onBlockClick(plan)}
                          title={`REAL: ${herdLabel} · ${fmt(plan.actual_entry_date)}→${fmt(realExit)}`}
                        >
                          {realWidth > 4 && (
                            <span className="truncate flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                              {herdLabel}
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

        {/* ── Legend */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 flex-wrap">
          {/* Plan vs Real */}
          <div className="flex items-center gap-4 mr-2">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 border-2 border-gray-500" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(107,114,128,0.25) 3px, rgba(107,114,128,0.25) 6px)' }} />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Plan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 bg-gray-600" />
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

  const [plans, setPlans] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [farmEvents, setFarmEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [mercado, setMercado] = useState<any>(null)

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
  const [formData, setFormData] = useState({
    id: '',
    paddock_id: '',
    herd_ids: [] as string[],
    entry_date: new Date().toISOString().split('T')[0],
    exit_date: '',
    actual_entry_date: '',
    actual_exit_date: '',
    planned_recovery_days: 60,
    status: 'PLANNED'
  })
  // Temporary animals for a plan (e.g. bulls during service)
  const [tempAnimals, setTempAnimals] = useState<{species: string; count: number; weight_kg: number}[]>([])
  const [exitDateWarning, setExitDateWarning] = useState(false)
  const [suggestedExitDate, setSuggestedExitDate] = useState<string>('')
  // Completion report
  const [completionNote, setCompletionNote] = useState('')
  const [completionPhoto, setCompletionPhoto] = useState<string>('') 
  const [analyzingRemnant, setAnalyzingRemnant] = useState(false)
  const [remnantAnalysis, setRemnantAnalysis] = useState<any>(null)

  const season = getSeason()

  // EV de la planificación (todos los rebaños seleccionados + temporales)
  const totalPlanEV = useMemo(() => {
    const herdsEV = formData.herd_ids.reduce((sum, hid) => {
      const h = herds.find(h => h.id === hid)
      return sum + (Number(h?.total_ev) || 0)
    }, 0)
    const tempEV = tempAnimals.reduce((sum, a) => sum + (a.count * a.weight_kg) / 450, 0)
    return herdsEV + tempEV
  }, [formData.herd_ids, herds, tempAnimals])

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

  const handleGeneratePlanCycle = async () => {
    if (formData.herd_ids.length === 0 || !formData.entry_date) return
    setSaving(true)
    try {
      const startPaddockId = formData.paddock_id || paddocks[0]?.id
      if (!startPaddockId) return

      // Use mid-day to avoid timezone offset issues
      let currentEntry = new Date(formData.entry_date + 'T12:00:00')
      const targetEndDate = new Date(currentEntry)
      targetEndDate.setFullYear(targetEndDate.getFullYear() + 1)
      
      const newPlans: any[] = []
      const startIdx = paddocks.findIndex(p => p.id === startPaddockId)
      // Cycle through all paddocks starting from the selected one

      const dailyDemand = totalPlanEV * 13 // 11 kg + 2kg margin
      
      // Map to track when each paddock is ready to be grazed again
      const availabilityMap = new Map<string, number>()
      paddocks.forEach(p => availabilityMap.set(p.id, 0)) // 0 means ready initially

      let iteration = 0
      while (currentEntry < targetEndDate && iteration < 200) { // Safety iteration limit
        iteration++
        
        // Determinar días de recuperación según el mes
        const month = currentEntry.getMonth()
        let recDays = 60
        if (month >= 9 || month <= 1) recDays = 45  // Primavera / Verano (H. Sur)
        else if (month >= 2 && month <= 4) recDays = 65 // Otoño
        else recDays = 95 // Invierno

        // Seleccionar potrero
        let selectedPaddock: any = null
        
        if (iteration === 1) {
          // El primer potrero es el que eligió el usuario en el modal
          selectedPaddock = paddocks.find(p => p.id === formData.paddock_id)
        } else {
          // Filtrar potreros que ya cumplieron su tiempo de descanso
          const readyPaddocks = paddocks.filter(p => (availabilityMap.get(p.id) || 0) <= currentEntry.getTime())
          
          if (readyPaddocks.length > 0) {
            // De los recuperados, elegir el que tenga más biomasa
            selectedPaddock = readyPaddocks.sort((a,b) => 
              (Number(b.dry_matter_kg_ha) || 0) - (Number(a.dry_matter_kg_ha) || 0)
            )[0]
          } else {
            // Ninguno listo: elegir el que falte menos para recuperarse para minimizar el daño
            selectedPaddock = [...paddocks].sort((a,b) => 
              (availabilityMap.get(a.id) || 0) - (availabilityMap.get(b.id) || 0)
            )[0]
          }
        }

        if (!selectedPaddock) break

        const ms = Number(selectedPaddock.dry_matter_kg_ha) || 1800
        const area = Number(selectedPaddock.area_ha) || 10
        const usableMs = Math.max(0, ms - 1100) * area
        const rawDays = dailyDemand > 0 ? Math.floor(usableMs / dailyDemand) : 3
        
        // LÍMITE BIOLÓGICO: Máximo 14 días para evitar alerta de sobrepastoreo y daño a la corona
        const stayDays = Math.max(1, Math.min(rawDays, 14)) 
        
        const exitDate = new Date(currentEntry)
        exitDate.setDate(exitDate.getDate() + stayDays)
        
        newPlans.push({
          paddock_id: selectedPaddock.id,
          herd_id: formData.herd_ids[0],
          herd_ids: formData.herd_ids,
          entry_date: currentEntry.toISOString().split('T')[0],
          exit_date: exitDate.toISOString().split('T')[0],
          status: 'PLANNED'
        })

        // El potrero no podrá volver a usarse hasta: Fecha de salida + días de recuperación
        const recoveryFinish = new Date(exitDate)
        recoveryFinish.setDate(recoveryFinish.getDate() + recDays)
        availabilityMap.set(selectedPaddock.id, recoveryFinish.getTime())
        
        // La próxima entrada es DESPUÉS del período de descanso del siguiente potrero disponible
        // (no forzamos entrada inmediata — respetamos que los animales deben esperar a que
        // otro potrero esté listo, o avanzamos al siguiente potrero disponible)
        const readyNext = [...paddocks]
          .filter(p => p.id !== selectedPaddock.id)
          .map(p => ({ p, t: availabilityMap.get(p.id) || 0 }))
          .sort((a, b) => a.t - b.t)[0]
        
        if (readyNext && readyNext.t > exitDate.getTime()) {
          // El siguiente potrero todavía está en descanso; avanzamos al momento en que estará listo
          currentEntry = new Date(readyNext.t)
        } else {
          // Hay un potrero listo: entramos el día siguiente a la salida
          currentEntry = new Date(exitDate)
          currentEntry.setDate(currentEntry.getDate() + 1)
        }
      } // end while

      // Ejecutar todas las creaciones en paralelo para máxima velocidad
      await Promise.all(
        newPlans.map(p => apiFetch('/api/grazing-plans', { method: 'POST', body: JSON.stringify(p) }))
      )

      setIsModalOpen(false)
      loadData()
    } catch(err) {
      console.error(err)
      alert("Error al generar la planificación. Por favor, intente de nuevo.")
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
      }
    } catch(err) {
      console.error(err)
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

      setPaddocks(paddocksRes?.ok ? (await paddocksRes.json()).paddocks ?? [] : [])
      setHerds(herdsRes?.ok ? (await herdsRes.json()).herds ?? [] : [])
      setPlans(plansRes?.ok ? (await plansRes.json()).plans ?? [] : [])
      setFarmEvents(eventsRes?.ok ? (await eventsRes.json()).events ?? [] : [])
      setMercado(mercadoRes?.ok ? (await mercadoRes.json()) : null)

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
      setFormData({
        ...plan,
        entry_date: safeIso(plan.entry_date),
        exit_date: safeIso(plan.exit_date),
        actual_entry_date: safeIso(plan.actual_entry_date),
        actual_exit_date: safeIso(plan.actual_exit_date),
      })
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
    setSaving(true)
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
    }
    if (formData.id) {
      await apiFetch(`/api/grazing-plans/${formData.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    } else {
      await apiFetch('/api/grazing-plans', { method: 'POST', body: JSON.stringify(payload) })
    }
    // Update paddock status
    if (payload.status === 'ACTIVE') {
      await apiFetch(`/api/paddocks/${formData.paddock_id}`, { method: 'PATCH', body: JSON.stringify({ current_status: 'GRAZING' }) })
    } else if (payload.status === 'COMPLETED') {
      await apiFetch(`/api/paddocks/${formData.paddock_id}`, { method: 'PATCH', body: JSON.stringify({ current_status: 'RESTING' }) })
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

  const handleExportExcel = () => {
    const data = filteredPlans.map(plan => {
      const pHerds = herds.filter(h => plan.herd_ids?.includes(h.id))
      const totalEv = pHerds.reduce((s, h) => s + Number(h.total_ev || 0), 0)
      const plannedDays = plan.exit_date ? daysBetween(plan.entry_date, plan.exit_date) : ''
      const actualDays = (plan.actual_entry_date && plan.actual_exit_date)
        ? daysBetween(plan.actual_entry_date, plan.actual_exit_date) : ''
      return {
        'Potrero': plan.paddocks?.name || '',
        'Hectáreas': Number(plan.paddocks?.area_ha || 0).toFixed(1),
        'Rebaño': pHerds.map((h: any) => h.name).join(', ') || 'Sin rebaño',
        'Estado': STATUS_MAP[plan.status]?.label || plan.status,
        'Entrada Planif.': plan.entry_date || '',
        'Salida Planif.': plan.exit_date || '',
        'Días Planif.': plannedDays,
        'Entrada Real': plan.actual_entry_date || '',
        'Salida Real': plan.actual_exit_date || '',
        'Días Reales': actualDays,
        'Desvío (días)': (typeof plannedDays === 'number' && typeof actualDays === 'number') ? actualDays - plannedDays : '',
        'Descanso (días)': plan.planned_recovery_days || '',
        'EV Total': totalEv.toFixed(1),
        'Remanente kg MS/ha': plan.exit_dry_matter_kg_ha || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planificación')
    XLSX.writeFile(wb, `rodeo-planif-${new Date().toISOString().split('T')[0]}.xlsx`)
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
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mt-1 ${season.color}`}>
            {season.icon} {season.name} · {season.type}
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

          {/* Split button — Nueva planificación */}
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
                title="Más opciones"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            </div>

            {showPlanDropdown && (
              <>
                <div className="fixed inset-0 z-[998]" onClick={() => setShowPlanDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 z-[999] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[220px]">
                  <button
                    onClick={() => { setShowPlanDropdown(false); handleOpenModal() }}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Plus className="w-4 h-4 text-green-700" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">Planificación manual</p>
                      <p className="text-[10px] text-gray-400 font-medium">Configura potrero, rebaño y fechas</p>
                    </div>
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => {
                      setShowPlanDropdown(false)
                      handleOpenModal()
                      setTimeout(() => setModalStep(3), 50)
                    }}
                    disabled={paddocks.length === 0 || herds.length === 0}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-indigo-50 transition-all text-left disabled:opacity-40"
                    title="Genera el ciclo anual automáticamente"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-indigo-700" />
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
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 font-medium flex items-center gap-2">
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
            onBlockClick={handleOpenModal}
            onBlockMove={handleBlockMove}
            rainfallData={rainfallData}
            onRainfallChange={handleRainfallChange}
          />

          {/* SDH/mm Balance Panel */}
          {(() => {
            const totalDays = plans.filter(p => p.status !== 'COMPLETED').reduce((s, p) => {
              const d = p.actual_exit_date ? daysBetween(p.actual_entry_date || p.entry_date, p.actual_exit_date)
                : p.exit_date ? daysBetween(p.entry_date, p.exit_date) : 0
              return s + Math.max(0, d)
            }, 0)
            const totalEV = herds.reduce((s, h) => s + Number(h.total_ev || 0), 0)
            const sdhMm = totalRainfall > 0 ? ((totalDays * totalEV) / totalRainfall).toFixed(2) : '—'
            const droughtDays = (() => {
              const supply = paddocks.reduce((s, p) => s + ((Number(p.dry_matter_kg_ha) || 0) * Number(p.area_ha || 0)), 0)
              const demand = totalEV * 11
              return demand > 0 ? Math.floor(supply / demand) : 999
            })()
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {/* SDH/mm */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-blue-50 border-blue-100" title="Días de Pastoreo × EV / mm lluvia total">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">SDH/mm (lluvia)</p>
                    <p className="text-lg font-black leading-tight text-blue-700">{sdhMm}</p>
                  </div>
                </div>
                {/* Lluvia — editable inline */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-blue-50 border-blue-100 group cursor-pointer" title="Click para editar lluvia total del período">
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lluvia registrada</p>
                    <p className="text-lg font-black leading-tight text-blue-600">{totalRainfall}<span className="text-xs font-bold ml-1 text-gray-400">mm</span></p>
                    <p className="text-[8px] text-blue-400 font-bold group-hover:text-blue-600 transition-colors">↑ editá en la fila del Gantt</p>
                  </div>
                </div>
                {/* Reserva de Sequía — con nota */}
                <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${droughtDays < 15 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`} title="Días de forraje disponible para la demanda actual">
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Reserva de sequía</p>
                    <p className={`text-lg font-black leading-tight ${droughtDays < 15 ? 'text-red-600' : 'text-green-700'}`}>{droughtDays}<span className="text-xs font-bold ml-1 text-gray-400">d</span></p>
                    <p className="text-[8px] text-gray-400 font-bold">oferta forraje / demanda</p>
                  </div>
                </div>
                {/* Planificaciones */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl border bg-gray-50 border-gray-100">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Planificaciones</p>
                    <p className="text-lg font-black leading-tight text-gray-700">{plans.filter(p=>p.status==='PLANNED').length}<span className="text-xs font-bold ml-1 text-gray-400">plan / {plans.filter(p=>p.status==='ACTIVE').length} activas</span></p>
                  </div>
                </div>
              </div>
            )
          })()}

          <p className="text-[10px] text-gray-400 text-center font-medium">
            Arrastrá bloques de plan para mover fechas · Clic en cualquier bloque para registrar fechas reales
          </p>
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
                  {['Potrero / Rebaño', 'Ha', 'Estado', 'Entrada', 'Salida', 'Días', 'Descanso', 'EV'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.map(plan => {
                  const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
                  const pHerds = herds.filter(h => plan.herd_ids?.includes(h.id))
                  const herdNames = pHerds.length > 0 ? pHerds.map(h => h.name).join(', ') : 'Rebaño desconocido'
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
                      <td className="px-5 py-4 text-sm font-bold text-orange-600">{Number(totalEv).toFixed(1)}</td>
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
                  {['Potrero / Rebaño', 'Estado', 'Entrada (Real)', 'Salida (Real)', 'Días Efectivos', 'Remanente', 'Desvío vs Plan'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.map(plan => {
                  const st = STATUS_MAP[plan.status] || STATUS_MAP.PLANNED
                  const pHerds = herds.filter(h => plan.herd_ids?.includes(h.id))
                  const herdNames = pHerds.length > 0 ? pHerds.map(h => h.name).join(', ') : 'Rebaño desconocido'
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
                          <span className="block text-[9px] text-orange-500 mt-0.5" title="Planificado">Plan: {fmt(plan.entry_date)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium tabular-nums text-gray-900">
                        {plan.actual_exit_date ? fmt(plan.actual_exit_date) : <span className="text-gray-400 text-[10px]">No reg.</span>}
                        {plan.exit_date && plan.actual_exit_date && plan.exit_date !== plan.actual_exit_date && (
                          <span className="block text-[9px] text-orange-500 mt-0.5" title="Planificado">Plan: {fmt(plan.exit_date)}</span>
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
                          <span className={`text-xs font-bold ${daysDev > 0 ? 'text-red-600' : 'text-blue-600'}`}>
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

      {/* ─── MODAL: Vista única — diseño unificado ─────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* ─── MODAL HEADER ─── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-950 tracking-tight">
                  {formData.id ? 'Editar movimiento' : 'Nueva planificación'}
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {formData.paddock_id && formData.herd_ids.length > 0
                    ? `${paddocks.find(p => p.id === formData.paddock_id)?.name} · ${formData.herd_ids.length} rebaño${formData.herd_ids.length > 1 ? 's' : ''} · ${totalPlanEV > 0 ? `${totalPlanEV.toFixed(0)} EV total` : ''}`
                    : 'Elegí los rebaños y el potrero de destino'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ─── MODAL BODY ─── */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* ① REBAÑOS — lo más importante primero, tarjetas grandes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-700 tracking-wide">¿Qué rebaños van a moverse?</label>
                  {formData.herd_ids.length > 0 && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      {formData.herd_ids.length} seleccionado{formData.herd_ids.length > 1 ? 's' : ''} · {totalPlanEV.toFixed(0)} EV
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {herds.map(h => {
                    const isSelected = formData.herd_ids.includes(h.id)
                    const hColor = herdColorMap[h.id] || '#16a34a'
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setFormData({ ...formData, herd_ids: formData.herd_ids.filter(id => id !== h.id) })
                          else setFormData({ ...formData, herd_ids: [...formData.herd_ids, h.id] })
                        }}
                        className={`relative flex flex-col items-start gap-1 p-3.5 rounded-2xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                            : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="w-8 h-2 rounded-full" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.4)' : hColor }} />
                        <p className="text-sm font-black leading-tight">{h.name}</p>
                        <p className={`text-xs font-bold ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                          {Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas
                        </p>
                      </button>
                    )
                  })}
                </div>
                {formData.herd_ids.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold text-center py-1">👆 Seleccioná al menos un rebaño para continuar</p>
                )}
              </div>

              {/* ② POTRERO DESTINO */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 tracking-wide">¿A qué potrero van?</label>
                {paddocks.length <= 6 ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {paddocks.map(p => {
                      const isSelected = formData.paddock_id === p.id
                      const dmColor = (p.dry_matter_kg_ha || 0) >= 1500 ? 'text-green-600' : (p.dry_matter_kg_ha || 0) >= 800 ? 'text-amber-600' : 'text-red-500'
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, paddock_id: p.id })}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected
                              ? <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>
                              : <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                            }
                            <div>
                              <p className={`text-sm font-bold ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>{p.name}</p>
                              <p className="text-[10px] text-gray-400">{Number(p.area_ha).toFixed(1)} ha</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-black ${dmColor}`}>{p.dry_matter_kg_ha || 0}</p>
                            <p className="text-[9px] text-gray-400 font-bold">kg MS/ha</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <select
                    value={formData.paddock_id}
                    onChange={e => setFormData({ ...formData, paddock_id: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-green-600"
                  >
                    <option value="">Seleccionar potrero...</option>
                    {paddocks.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {Number(p.area_ha).toFixed(1)} ha · {p.dry_matter_kg_ha || 0} kg MS/ha</option>
                    ))}
                  </select>
                )}
              </div>

              {/* ③ SUGERENCIA HOLÍSTICA — aparece cuando hay potrero + rebaños */}
              {formData.paddock_id && totalPlanEV > 0 && suggestion.days > 0 && (() => {
                const sugDays = Math.min(suggestion.days, 14)
                return (
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-4 text-white shadow-lg shadow-indigo-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-indigo-200" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Motor holístico</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">Estadía</p>
                        <p className={`text-2xl font-black ${sugDays >= 14 ? 'text-amber-300' : 'text-white'}`}>{sugDays}<span className="text-xs ml-0.5 text-indigo-200">d</span></p>
                        {sugDays >= 14 && <p className="text-[8px] text-amber-300 font-bold">límite holístico</p>}
                      </div>
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">Descanso</p>
                        <p className="text-2xl font-black text-white">{suggestion.recovery}<span className="text-xs ml-0.5 text-indigo-200">d</span></p>
                      </div>
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">MS útil</p>
                        <p className="text-lg font-black text-white">{Math.round(suggestion.usableMsTotal / 1000).toFixed(1)}<span className="text-xs ml-0.5 text-indigo-200">t</span></p>
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
                      className="w-full py-2 bg-white text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Aplicar sugerencia al plan
                    </button>
                  </div>
                )
              })()}

              {/* ④ PLAN: Fechas planificadas */}
              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-100/60 border-b border-blue-100">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(59,130,246,0.35) 2px, rgba(59,130,246,0.35) 4px)' }} />
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Plan — lo que proyectás</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-600 tracking-widest uppercase">Entrada plan</label>
                      <input
                        type="date"
                        value={formData.entry_date}
                        onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
                        className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-600 tracking-widest uppercase flex items-center gap-1">
                        Salida plan
                        {formData.exit_date && formData.entry_date && (
                          <span className={`normal-case font-black ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                            daysBetween(formData.entry_date, formData.exit_date) > 14
                              ? 'bg-red-100 text-red-600'
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
                        className={`w-full bg-white border-2 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 outline-none text-gray-900 ${
                          formData.exit_date && daysBetween(formData.entry_date, formData.exit_date) > 14
                            ? 'border-red-300 focus:ring-red-400'
                            : 'border-blue-200 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  {formData.exit_date && daysBetween(formData.entry_date, formData.exit_date) > 14 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <p className="text-[11px] text-red-600 font-bold">Supera el límite holístico de 14 días. Considerá dividir el lote.</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-[9px] font-black text-blue-600 tracking-widest uppercase whitespace-nowrap">Descanso del potrero</label>
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
                          className="ml-auto text-[9px] text-indigo-600 font-black hover:underline"
                        >
                          Usar sugerido ({suggestion.recovery}d)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GAP: Dato desactualizado */}
                  {isStaleData && formData.paddock_id && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-black text-amber-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Dato de forraje desactualizado (+7 días)
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="kg MS/ha actual"
                          value={inlineDryMatter}
                          onChange={e => setInlineDryMatter(e.target.value)}
                          className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-amber-400 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveInlineData}
                          disabled={!inlineDryMatter || savingInlineData}
                          className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
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
                              formData.actual_entry_date > formData.entry_date ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'
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
                      <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-3.5 h-3.5 text-amber-600" />
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Pasto remanente al cierre</p>
                          <span className="ml-auto text-[9px] text-amber-500 font-bold">Dato holístico clave</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            placeholder="kg MS/ha"
                            value={remnantAnalysis?.dry_matter_kg_ha || ''}
                            onChange={e => setRemnantAnalysis({ dry_matter_kg_ha: Number(e.target.value) })}
                            className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-amber-400 outline-none"
                          />
                          <span className="text-xs text-amber-600 font-black whitespace-nowrap">kg MS/ha</span>
                        </div>
                        {remnantAnalysis?.dry_matter_kg_ha > 0 && (
                          <p className="text-[9px] text-amber-600 font-bold">
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
                            <p className="text-2xl font-black text-blue-600">{planD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>
                          </div>
                          <div className="text-2xl text-gray-200">→</div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Real</p>
                            <p className="text-2xl font-black text-green-600">{realD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Desvío</p>
                            <p className={`text-2xl font-black ${dev > 0 ? 'text-red-500' : dev < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
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
                  className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Eliminar planificación">
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
    </div>
  )
}
