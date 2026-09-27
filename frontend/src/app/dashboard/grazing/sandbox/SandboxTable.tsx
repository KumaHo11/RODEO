/**
 * SandboxTable.tsx → PaddockCards — Columna 2: Potreros de la Célula
 *
 *  - ▲/▼ buttons para reordenar (además de drag)
 *  - Modo Cerrado: muestra Aforo + Remanente inputs
 *  - Modo Abierto: solo ranking, ha y badge Boyero
 */
'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { GripVertical, Check, ChevronUp, ChevronDown, Search, X, Info, Scissors, RotateCcw } from 'lucide-react' // Info used by MetricPill tooltip buttons
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import type { PaddockSimResult } from '@/lib/grazing/types'
import AsimetriaBanner from './AsimetriaBanner'

// ── Drag & Drop state ────────────────────────────────────────────────────────

interface DragState { draggingIdx: number | null; overIdx: number | null }

// ── Card individual ──────────────────────────────────────────────────────────

interface PaddockCardProps {
  row: PaddockSimResult
  idx: number
  totalCount: number
  orderNumber: number | null
  isHovered: boolean
  isSelected: boolean
  isDragging: boolean
  isDragOver: boolean
  mode: 'open' | 'closed'
  avgCoeficiente: number
  isSubRow: boolean
  originalId?: string
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
  onToggle: () => void
  onRankChange: (rank: number) => void
  onAforoChange: (v: number) => void
  onRemanenteChange: (v: number) => void
  onTCChange: (v: number) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRestore?: () => void
}

function PaddockCard({
  row, orderNumber, isHovered, isSelected, isDragging, isDragOver,
  mode, totalCount, idx, avgCoeficiente, isSubRow, originalId,
  onMouseEnter, onMouseLeave, onClick, onDragStart, onDragOver, onDrop, onDragEnd,
  onToggle, onRankChange, onAforoChange, onRemanenteChange,
  onTCChange, onMoveUp, onMoveDown, onRestore,
}: PaddockCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const isOn = row.enabled

  let containerCls = isOn
    ? 'flex flex-col px-3 py-3 rounded-xl border-2 border-green-500 bg-green-50 transition-all cursor-pointer shadow-xs gap-2'
    : 'flex flex-col px-3 py-3 rounded-xl border border-gray-200 bg-white opacity-60 hover:opacity-100 transition-all cursor-pointer gap-2'

  if (isDragging) containerCls += ' opacity-40'
  if (isDragOver) containerCls += ' border-t-4 border-t-green-500'
  if (isSelected && isOn) containerCls += ' ring-2 ring-green-600'
  if (isHovered && isOn && !isSelected) containerCls += ' border-green-400'
  if (isSubRow) containerCls = containerCls.replace('rounded-xl', 'rounded-lg') + ' border-l-4 border-l-green-400 ml-2'

  return (
    <div
      className={containerCls}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left side: Arrow buttons, Checkbox, Order, Name */}
        <div className="flex items-center gap-2">
          {/* Arrow reorder buttons */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              type="button"
              className="w-5 h-4 flex items-center justify-center rounded hover:bg-green-200 text-gray-400 hover:text-green-700 transition-colors disabled:opacity-30"
              onClick={e => { e.stopPropagation(); onMoveUp() }}
              disabled={idx === 0}
              title="Subir"
            >
              <ChevronUp size={12} strokeWidth={3} />
            </button>
            <button
              type="button"
              className="w-5 h-4 flex items-center justify-center rounded hover:bg-green-200 text-gray-400 hover:text-green-700 transition-colors disabled:opacity-30"
              onClick={e => { e.stopPropagation(); onMoveDown() }}
              disabled={idx === totalCount - 1}
              title="Bajar"
            >
              <ChevronDown size={12} strokeWidth={3} />
            </button>
          </div>

          <div
            className={
              isOn
                ? 'w-5 h-5 rounded-lg border-2 bg-green-600 border-green-600 text-white flex items-center justify-center shrink-0'
                : 'w-5 h-5 rounded-lg border-2 border-gray-300 bg-white shrink-0'
            }
            onClick={e => { e.stopPropagation(); onToggle() }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onToggle() } }}
          >
            {isOn && <Check size={14} strokeWidth={4} />}
          </div>

          {orderNumber !== null ? (
            <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
              {orderNumber}°
            </span>
          ) : (
            <span className="w-5 text-center text-gray-300 text-xs">—</span>
          )}

          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-800 leading-tight">{row.name}</span>
            <span className="text-[10px] text-gray-400">{row.areaHa.toFixed(1)} ha</span>
          </div>
        </div>

        {/* Right side: Sub-row badge + Restore + Grip */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isSubRow && (
            <span className="flex items-center gap-1 text-[9px] font-black text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
              <Scissors size={9} />
              Parcela
            </span>
          )}
          {isSubRow && onRestore && (
            <button
              type="button"
              className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-full transition-colors shrink-0"
              onClick={e => { e.stopPropagation(); onRestore() }}
              title="Restaurar potrero original"
              aria-label="Restaurar potrero original"
            >
              <RotateCcw size={10} />
            </button>
          )}
          <div className="text-gray-400 hover:text-gray-700 bg-gray-50 rounded-md p-1 cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200 transition-colors">
            <GripVertical size={16} />
          </div>
        </div>
      </div>

      {isOn && (
        <div className="border-t border-green-200/50 pt-2 flex flex-col gap-2">
          {/* Rank Selector + DP info */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor={`rank-${row.id}`} className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Ranking
              </label>
              <select
                id={`rank-${row.id}`}
                className="text-xs font-bold text-gray-800 border border-gray-200 rounded-md bg-white px-2 py-1 outline-none focus:border-green-500 cursor-pointer appearance-none text-center w-12"
                value={row.rank}
                onChange={e => onRankChange(Number(e.target.value))}
                onClick={e => e.stopPropagation()}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="text-[10px] text-gray-400 font-medium">
              {mode === 'open' ? (
                <span>{Math.min(row.dpPrimavera, row.dpVerano)}d — {Math.max(row.dpPrimavera, row.dpVerano)}d</span>
              ) : (
                <span>{row.dpSugerido}d pastoreo</span>
              )}
            </div>
          </div>

          {/* ── Acordeón de detalles ── */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIsDetailsOpen(v => !v) }}
            className="flex items-center justify-between w-full px-2 py-1 rounded-lg
                       text-[10px] font-semibold text-gray-400 hover:text-gray-600
                       hover:bg-green-100/40 transition-colors group"
            aria-expanded={isDetailsOpen}
            aria-label={isDetailsOpen ? 'Ocultar detalles del potrero' : 'Ver detalles del potrero'}
          >
            <span className="group-hover:text-green-700 transition-colors">
              {isDetailsOpen ? 'Ocultar detalles' : 'Ver detalles'}
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 group-hover:text-green-600 ${
                isDetailsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Panel de detalles expandible */}
          {isDetailsOpen && (
            <div className="flex flex-col gap-2 pt-1 border-t border-green-100/60 animate-[fadeSlideDown_0.18s_ease]">

              {/* TC editable (solo Temporada Abierta) */}
              {mode === 'open' && (
                <TCField
                  paddockId={row.id}
                  value={row.tasaCrecimientoKgHaDia ?? 25}
                  onChange={onTCChange}
                />
              )}

              {/* Modo Cerrado: Aforo + Remanente inputs */}
              {mode === 'closed' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Aforo (kg MS/ha)</label>
                    <input
                      type="number"
                      className="text-xs font-bold text-gray-800 border border-gray-200 rounded-md bg-white px-2 py-1 outline-none focus:border-blue-500 w-full"
                      value={row.aforoKgMsHa || ''}
                      placeholder="0"
                      onChange={e => onAforoChange(Number(e.target.value))}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Remanente (kg MS/ha)</label>
                    <input
                      type="number"
                      className="text-xs font-bold text-gray-800 border border-gray-200 rounded-md bg-white px-2 py-1 outline-none focus:border-blue-500 w-full"
                      value={row.remanenteObjetivoKgMsHa || ''}
                      placeholder="600"
                      onChange={e => onRemanenteChange(Number(e.target.value))}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}

              {/* Métricas derivadas: Coeficiente + Calidad Relativa */}
              <div className="flex items-center gap-3">
                <MetricPill
                  label="Coeficiente"
                  value={row.coeficiente > 0 ? row.coeficiente.toFixed(1) : '—'}
                  tooltip="Hectáreas × Ranking. Es la 'moneda' de pastoreo: permite igualar potreros chicos de pasto excelente con potreros grandes de pasto pobre."
                />
                <MetricPill
                  label="Calidad Relativa"
                  value={avgCoeficiente > 0 && row.coeficiente > 0
                    ? (row.coeficiente / avgCoeficiente).toFixed(2) + '×'
                    : '—'}
                  tooltip="Compara este potrero contra el promedio del grupo. Si dice 2.0, este potrero rinde el doble que el promedio."
                  highlight={avgCoeficiente > 0 && row.coeficiente / avgCoeficiente > 1.8}
                />
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── MetricPill: coeficiente + calidad relativa ───────────────────────────────────

function MetricPill({
  label, value, tooltip, highlight = false,
}: { label: string; value: string; tooltip: string; highlight?: boolean }) {
  const [showTip, setShowTip] = useState(false)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTip) return
    const handler = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) setShowTip(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTip])

  return (
    <div className="flex items-center gap-1 relative" ref={tipRef}>
      <span className={`text-[9px] font-bold uppercase tracking-wider ${
        highlight ? 'text-amber-600' : 'text-gray-400'
      }`}>
        {label}
      </span>
      <span className={`text-[10px] font-black ${
        highlight ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-gray-600 bg-gray-100'
      } px-1.5 py-0.5 rounded`}>
        {value}
      </span>
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500 transition-colors p-0 border-none bg-transparent"
        onClick={e => { e.stopPropagation(); setShowTip(v => !v) }}
        aria-label={`Info ${label}`}
      >
        <Info size={10} />
      </button>
      {showTip && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-[500] bg-gray-900 text-gray-100 text-[10px] leading-relaxed font-normal rounded-lg p-2.5 w-[220px] shadow-xl pointer-events-none">
          {tooltip}
          <div className="absolute top-[100%] left-3 border-[5px] border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

// ── Campo de Tasa de Crecimiento (TC) con tooltip agronómico ──────────────────

const TC_TOOLTIP = 'Tasa diaria de crecimiento estimada: el sistema sugiere este valor mediante el motor agroclimático y satelital (balance hídrico, temperatura y tendencia NDVI). Podés mantener el valor estimado o ajustarlo manualmente con un número fijo para la temporada.'

function TCField({
  paddockId, value, onChange,
}: { paddockId: string; value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(String(value))
  const [showTip, setShowTip] = useState(false)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setRaw(String(value)) }, [value])

  useEffect(() => {
    if (!showTip) return
    const handler = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) setShowTip(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTip])

  const commit = () => {
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) {
      onChange(Math.min(200, Math.max(0, n)))
    } else {
      setRaw(String(value))
    }
  }

  return (
    <div className="flex items-center gap-2 bg-green-50/60 border border-green-100 rounded-lg px-2.5 py-1.5">
      <div className="flex-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">TC Crecimiento</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          id={`tc-${paddockId}`}
          type="number"
          min={0}
          max={200}
          step={1}
          className="w-14 text-xs font-bold text-green-800 border border-green-200 rounded-md bg-white px-2 py-0.5 outline-none focus:border-green-500 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          onClick={e => e.stopPropagation()}
        />
        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">kg/ha/d</span>
        <div className="relative" ref={tipRef}>
          <button
            type="button"
            className="text-gray-400 hover:text-green-600 transition-colors p-0 border-none bg-transparent"
            onClick={e => { e.stopPropagation(); setShowTip(v => !v) }}
            aria-label="Info tasa de crecimiento"
          >
            <Info size={13} />
          </button>
          {showTip && (
            <div className="absolute bottom-[calc(100%+6px)] right-0 z-[500] bg-gray-900 text-gray-100 text-[11px] leading-relaxed font-normal rounded-lg p-3 w-[260px] shadow-xl pointer-events-none">
              {TC_TOOLTIP}
              <div className="absolute top-[100%] right-3 border-[5px] border-transparent border-t-gray-900" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Columna principal ─────────────────────────────────────────────────────────

export default function SandboxTable() {
  const result              = useSandboxStore(s => s.result)
  const config              = useSandboxStore(s => s.config)
  const hoveredPaddockId    = useSandboxStore(s => s.hoveredPaddockId)
  const selectedPaddockId   = useSandboxStore(s => s.selectedPaddockId)
  const togglePaddockEnabled = useSandboxStore(s => s.togglePaddockEnabled)
  const updatePaddockRow    = useSandboxStore(s => s.updatePaddockRow)
  const reorderPaddocks     = useSandboxStore(s => s.reorderPaddocks)
  const setHoveredPaddock   = useSandboxStore(s => s.setHoveredPaddock)
  const setSelectedPaddock  = useSandboxStore(s => s.setSelectedPaddock)
  const subdivisionSources  = useSandboxStore(s => s.subdivisionSources)
  const restoreSubdividedRow = useSandboxStore(s => s.restoreSubdividedRow)

  const rawRows = useSandboxStore(s => s.paddockRows)
  const paddockRows = useMemo(
    () => [...rawRows].sort((a, b) => a.order - b.order),
    [rawRows],
  )

  const resultMap = useMemo(
    () => new Map<string, PaddockSimResult>(result?.rows.map(r => [r.id, r]) ?? []),
    [result],
  )

  const rows = useMemo(() => {
    const calculated = paddockRows.map(p => resultMap.get(p.id) ?? {
      ...p, coeficiente: 0, dpPrimavera: 0, dpVerano: 0,
      dpSugerido: 0, descansoResultante: 0, needsBoyero: false,
      aforoDisponibleKgMs: 0, status: 'ok' as const, statusMsg: '',
    })

    // Enabled first, then disabled, each sorted by order
    const enabled  = calculated.filter(r => r.enabled).sort((a, b) => a.order - b.order)
    const disabled = calculated.filter(r => !r.enabled).sort((a, b) => a.order - b.order)

    return [...enabled, ...disabled]
  }, [paddockRows, resultMap])

  const orderNumbers = useMemo(() => {
    const m = new Map<string, number>()
    let n = 1
    for (const p of paddockRows) { if (p.enabled) m.set(p.id, n++) }
    return m
  }, [paddockRows])


  const [drag, setDrag] = useState<DragState>({ draggingIdx: null, overIdx: null })
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // ── Avg coeficiente for Calidad Relativa (per-card accordion)
  const avgCoeficiente = useMemo(() => {
    const enabledWithCoef = rows.filter(r => r.enabled && r.coeficiente > 0)
    if (enabledWithCoef.length === 0) return 0
    return enabledWithCoef.reduce((s, r) => s + r.coeficiente, 0) / enabledWithCoef.length
  }, [rows])

  // ── Build a reverse lookup: sub-row ID → original ID ──
  const subRowToOriginal = useMemo(() => {
    const map: Record<string, string> = {}
    Object.entries(subdivisionSources).forEach(([origId, subIds]) => {
      subIds.forEach(sid => { map[sid] = origId })
    })
    return map
  }, [subdivisionSources])

  const displayedRows = useMemo(() => {
    if (!search) return rows
    const term = search.toLowerCase()
    return rows.filter(r => r.name.toLowerCase().includes(term))
  }, [rows, search])

  const idAtIdx = useMemo(() => displayedRows.map(r => r.id), [displayedRows])

  const handleDragStart = useCallback((idx: number) => setDrag({ draggingIdx: idx, overIdx: idx }), [])
  const handleDragOver  = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDrag(prev => ({ ...prev, overIdx: idx }))
  }, [])
  const handleDrop = useCallback((toIdx: number) => {
    const { draggingIdx } = drag
    if (draggingIdx !== null && draggingIdx !== toIdx) {
      const fromId = idAtIdx[draggingIdx]
      const toId   = idAtIdx[toIdx]
      const fromRealIdx = paddockRows.findIndex(p => p.id === fromId)
      const toRealIdx   = paddockRows.findIndex(p => p.id === toId)
      if (fromRealIdx !== -1 && toRealIdx !== -1) {
        reorderPaddocks(fromRealIdx, toRealIdx)
      }
    }
    setDrag({ draggingIdx: null, overIdx: null })
  }, [drag, idAtIdx, paddockRows, reorderPaddocks])

  const handleMoveUp = useCallback((idx: number) => {
    if (idx <= 0) return
    const fromId = idAtIdx[idx]
    const toId   = idAtIdx[idx - 1]
    const fromRealIdx = paddockRows.findIndex(p => p.id === fromId)
    const toRealIdx   = paddockRows.findIndex(p => p.id === toId)
    if (fromRealIdx !== -1 && toRealIdx !== -1) reorderPaddocks(fromRealIdx, toRealIdx)
  }, [idAtIdx, paddockRows, reorderPaddocks])

  const handleMoveDown = useCallback((idx: number) => {
    if (idx >= displayedRows.length - 1) return
    const fromId = idAtIdx[idx]
    const toId   = idAtIdx[idx + 1]
    const fromRealIdx = paddockRows.findIndex(p => p.id === fromId)
    const toRealIdx   = paddockRows.findIndex(p => p.id === toId)
    if (fromRealIdx !== -1 && toRealIdx !== -1) reorderPaddocks(fromRealIdx, toRealIdx)
  }, [idAtIdx, paddockRows, rows.length, reorderPaddocks])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-[13px] text-center gap-1">
        <p>Sin potreros disponibles.</p>
        <p className="text-[11px] text-gray-300">Creá potreros en Mi Campo primero.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-2 h-full">
      <div className="flex items-start justify-between mb-1 shrink-0 min-h-[32px]">
        {!isSearchOpen && (
          <div>
            <h3 className="text-xs font-black text-gray-500 tracking-wider uppercase">
              Potreros de la Célula
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Seleccioná y ordená los potreros</p>
          </div>
        )}

        {/* Buscador expandible */}
        <div className={`relative ${isSearchOpen ? 'w-full' : 'w-auto'}`}>
          {isSearchOpen ? (
            <>
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search size={12} className="text-gray-600" />
              </div>
              <input
                autoFocus
                type="text"
                className="w-full pl-7 pr-8 py-1.5 text-[11px] font-medium text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:bg-white transition-colors placeholder-gray-500"
                placeholder="Buscar potreros..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button 
                onClick={() => { setIsSearchOpen(false); setSearch('') }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-700"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="text-gray-400 hover:text-gray-700 p-1 -mt-1 -mr-1"
            >
              <Search size={14} className="text-gray-700" />
            </button>
          )}
        </div>
      </div>

      {/* ── Asimetría Banner ── */}
      <AsimetriaBanner />

      <div className="flex flex-col gap-2 overflow-y-auto pb-4">
        {displayedRows.map((row, idx) => {
          const isSubRow = row.id.includes('__sub')
          const originalId = subRowToOriginal[row.id]
          return (
            <PaddockCard
              key={row.id}
              row={row}
              idx={idx}
              totalCount={displayedRows.length}
              orderNumber={orderNumbers.get(row.id) ?? null}
              isHovered={row.id === hoveredPaddockId}
              isSelected={row.id === selectedPaddockId}
              isDragging={drag.draggingIdx === idx}
              isDragOver={drag.overIdx === idx && drag.draggingIdx !== idx}
              mode={config.mode}
              avgCoeficiente={avgCoeficiente}
              isSubRow={isSubRow}
              originalId={originalId}
              onMouseEnter={() => setHoveredPaddock(row.id)}
              onMouseLeave={() => setHoveredPaddock(null)}
              onClick={() => setSelectedPaddock(row.id === selectedPaddockId ? null : row.id)}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => setDrag({ draggingIdx: null, overIdx: null })}
              onToggle={() => togglePaddockEnabled(row.id)}
              onRankChange={rank => updatePaddockRow(row.id, { rank })}
              onAforoChange={v => updatePaddockRow(row.id, { aforoKgMsHa: v })}
              onRemanenteChange={v => updatePaddockRow(row.id, { remanenteObjetivoKgMsHa: v })}
              onTCChange={v => updatePaddockRow(row.id, { tasaCrecimientoKgHaDia: v })}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
              onRestore={originalId ? () => restoreSubdividedRow(originalId) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
