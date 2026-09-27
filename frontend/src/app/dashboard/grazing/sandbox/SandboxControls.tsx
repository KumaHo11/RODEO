/**
 * SandboxControls.tsx — Header de parámetros globales (Mesa de Planificación)
 * ─────────────────────────────────────────────────────────────────────
 * Fecha Inicio · Fecha Corte (con tooltip) · Fecha Fin
 * Descanso Primavera / Descanso Verano (inputs libres sin bloqueo)
 * Ración diaria
 */
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Info } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'

// ── Tooltip de información ────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative inline-flex items-center ml-1" ref={ref}>
      <button
        type="button"
        className="text-gray-400 hover:text-green-500 transition-colors cursor-pointer p-0 border-none bg-transparent"
        onClick={() => setOpen(v => !v)}
        aria-label="Más información"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[500] bg-gray-900 text-gray-100 text-[11px] leading-relaxed font-normal rounded-lg p-3 w-[260px] shadow-lg pointer-events-none">
          {content}
          <div className="absolute bottom-[100%] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-gray-900" />
        </div>
      )}
    </div>
  )
}

// ── Input de fecha compacto ──────────────────────────────────────────────────

function DateField({ id, label, value, onChange, tooltip }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  tooltip?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center">
        <label htmlFor={id} className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</label>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <input
        id={id}
        type="date"
        className="text-xs font-bold text-gray-800 border border-gray-200 rounded-lg bg-white px-3 py-1.5 outline-none focus:border-green-500 transition-colors h-8"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// ── Input numérico libre — sin bloqueo mientras escribe ──────────────────────

function FreeNumField({ id, label, value, unit, min, max, decimals = 0, onChange }: {
  id: string
  label: string
  value: number
  unit?: string
  min: number
  max: number
  decimals?: number
  onChange: (v: number) => void
}) {
  const [raw, setRaw] = useState(decimals > 0 ? value.toFixed(decimals) : String(value))

  useEffect(() => {
    setRaw(decimals > 0 ? value.toFixed(decimals) : String(value))
  }, [value, decimals])

  const commit = useCallback(() => {
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      const clamped = Math.min(max, Math.max(min, n))
      onChange(clamped)
      setRaw(decimals > 0 ? clamped.toFixed(decimals) : String(clamped))
    } else {
      setRaw(decimals > 0 ? value.toFixed(decimals) : String(value))
    }
  }, [raw, min, max, decimals, onChange, value])

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center border border-gray-200 rounded-lg bg-white px-2 h-8 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition-all">
        <input
          id={id}
          type="number"
          className="w-12 text-sm font-bold text-gray-800 border-none outline-none text-center bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={raw}
          min={min}
          max={max}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
        />
        {unit && <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-1">{unit}</span>}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

const CORTE_TOOLTIP =
  'Fecha de quiebre estacional: define el paso de días de descanso en primavera (crecimiento activo) a días de descanso en verano (estrés térmico y menor tasa de rebrote). Normalmente: 15 de diciembre.'

export default function SandboxControls() {
  const config    = useSandboxStore(s => s.config)
  const setConfig = useSandboxStore(s => s.setConfig)

  const isOpen   = config.mode === 'open'
  const isClosed = config.mode === 'closed'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">

        {/* ── Temporada Selector ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Temporada</label>
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <button
              id="sandbox-mode-open"
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isOpen ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setConfig({ mode: 'open' })}
            >
              Abierta
            </button>
            <button
              id="sandbox-mode-closed"
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isClosed ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setConfig({ mode: 'closed' })}
            >
              Cerrada
            </button>
          </div>
        </div>

        {/* ── Fecha Inicio (siempre visible) ── */}
        <DateField
          id="sh-inicio"
          label="Fecha Inicio"
          value={config.fechaInicio}
          onChange={v => setConfig({ fechaInicio: v })}
        />

        {/* ── Fecha de Corte (solo Abierta) ── */}
        {isOpen && (
          <DateField
            id="sh-corte"
            label="Fecha de Corte"
            value={config.fechaCorte}
            onChange={v => setConfig({ fechaCorte: v })}
            tooltip={CORTE_TOOLTIP}
          />
        )}

        {/* ── Fecha Fin (siempre visible) ── */}
        <DateField
          id="sh-fin"
          label="Fecha Fin"
          value={config.fechaFin}
          onChange={v => setConfig({ fechaFin: v })}
        />

        {/* ── Separator ── */}
        <div className="hidden lg:block w-px h-8 bg-gray-200 mx-2" />

        {/* ── Descanso Primavera / Verano (solo Abierta) ── */}
        {isOpen && (
          <>
            <FreeNumField
              id="sh-desc-p"
              label="Descanso Primavera"
              value={config.descansosPrimavera}
              min={20}
              max={180}
              onChange={v => setConfig({ descansosPrimavera: v })}
            />
            <FreeNumField
              id="sh-desc-v"
              label="Descanso Verano"
              value={config.descansosVerano}
              min={20}
              max={180}
              onChange={v => setConfig({ descansosVerano: v })}
            />
          </>
        )}

        {/* ── Remanente (solo Cerrada) ── */}
        {isClosed && (
          <FreeNumField
            id="sh-remanente"
            label="Remanente obj."
            value={config.targetRemnantKgHa}
            unit="kg MS/ha"
            min={0}
            max={3000}
            onChange={v => setConfig({ targetRemnantKgHa: v })}
          />
        )}

        {/* ── Ración Base (siempre visible) ── */}
        <FreeNumField
          id="sh-racion"
          label="Ración Base"
          value={config.dailyAllocationKgEv}
          unit="kg MS / EV / día"
          min={4}
          max={40}
          decimals={1}
          onChange={v => setConfig({ dailyAllocationKgEv: v })}
        />

      </div>
    </div>
  )
}
