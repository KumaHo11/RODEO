'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'


interface SelectorOption {
  id: string
  name: string
}

interface PotreroRodeoSelectorProps {
  noteId: string
  potreroId?: string
  potreroName?: string
  rodeoId?: string
  paddocks?: SelectorOption[]
  herds?: SelectorOption[]
  onPotreroChange?: (id: string | null) => void
  onRodeoChange?: (id: string | null) => void
}

// ─── Pill Dropdown ────────────────────────────────────────────────────────────
function PillDropdown({
  label,
  value,
  valueName,
  options,
  onChange,
  icon: Icon,
  colorClass,
}: {
  label: string
  value: string
  valueName?: string
  options: SelectorOption[]
  onChange: (id: string) => void
  icon: React.ComponentType<any>
  colorClass: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const displayName = valueName || options.find(o => o.id === value)?.name || label

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all hover:opacity-80 ${
          value
            ? colorClass
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
        }`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate max-w-[80px]">{displayName}</span>
        <ChevronDown className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-48 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1">
            <button
              onClick={() => { onChange(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[11px] text-gray-400 font-semibold hover:bg-gray-50 transition-colors"
            >
              Sin asignar
            </button>
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-colors ${
                  opt.id === value
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PotreroRodeoSelector({
  noteId,
  potreroId = '',
  potreroName,
  rodeoId = '',
  paddocks = [],
  herds = [],
  onPotreroChange,
  onRodeoChange,
}: PotreroRodeoSelectorProps) {
  const [localPotreroId, setLocalPotreroId] = useState(potreroId)
  const [localRodeoId, setLocalRodeoId] = useState(rodeoId)

  const handlePotreroChange = useCallback((id: string) => {
    // Solo actualiza estado local.
    // NO hacemos PATCH paddock_id en la field_note: si lo hiciéramos, la nota
    // quedaría excluida del filtro bitacora_only=1 (WHERE paddock_id IS NULL)
    // y desaparecería del feed de Bitácora tras recargar.
    // El selector es puramente UI: enriquece la card y dirige el análisis IA.
    setLocalPotreroId(id)
    onPotreroChange?.(id || null)
  }, [onPotreroChange])

  const handleRodeoChange = useCallback((id: string) => {
    // Idem: solo estado local, sin PATCH en DB.
    setLocalRodeoId(id)
    onRodeoChange?.(id || null)
  }, [onRodeoChange])


  if (paddocks.length === 0 && herds.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {paddocks.length > 0 && (
        <PillDropdown
          label="Potrero"
          value={localPotreroId}
          valueName={potreroName || paddocks.find(p => p.id === localPotreroId)?.name}
          options={paddocks}
          onChange={handlePotreroChange}
          icon={MapPin}
          colorClass="bg-green-50 border-green-200 text-green-700"
        />
      )}
      {herds.length > 0 && (
        <PillDropdown
          label="Rodeo"
          value={localRodeoId}
          valueName={herds.find(h => h.id === localRodeoId)?.name}
          options={herds}
          onChange={handleRodeoChange}
          icon={MapPin}
          colorClass="bg-blue-50 border-blue-200 text-blue-700"
        />
      )}
    </div>
  )
}
