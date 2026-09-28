'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, MapPin, Save, Check } from 'lucide-react'
import { IconoRodeos } from '@/components/icons/IconoRodeos'
import { apiFetch } from '@/lib/apiFetch'


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
  // Track whether the user made a change that hasn't been saved yet
  const [unsaved, setUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handlePotreroChange = useCallback((id: string) => {
    setLocalPotreroId(id)
    setUnsaved(true)
    setSaved(false)
    onPotreroChange?.(id || null)
  }, [onPotreroChange])

  const handleRodeoChange = useCallback((id: string) => {
    setLocalRodeoId(id)
    setUnsaved(true)
    setSaved(false)
    onRodeoChange?.(id || null)
  }, [onRodeoChange])

  // Explicit save: persists paddock/herd assignment in the field_note
  // This is needed ONLY when the user assigns without running AI analysis.
  // Note: We deliberately save paddock_id/herd_id here because the user
  // explicitly requested it via "Guardar". This is distinct from the AI flow
  // which avoids persisting to prevent note disappearance from the bitacora feed.
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const patch: Record<string, string | null> = {}
      if (localPotreroId) patch.paddock_id = localPotreroId
      if (localRodeoId)  patch.herd_id    = localRodeoId
      if (Object.keys(patch).length === 0) return
      await apiFetch(`/api/field-notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      setUnsaved(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // Silently fail — note it in UI
    } finally {
      setSaving(false)
    }
  }, [noteId, localPotreroId, localRodeoId])

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
          icon={IconoRodeos}
          colorClass="bg-purple-50 border-purple-200 text-purple-700"
        />
      )}

      {/* Guardar explícito — solo cuando hay cambio sin análisis IA */}
      {unsaved && !saving && (
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-500 hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-all"
          title="Guardar asignación"
        >
          <Save className="w-2.5 h-2.5" />
          Guardar
        </button>
      )}
      {saving && (
        <span className="text-[10px] text-gray-400 font-medium">Guardando…</span>
      )}
      {saved && !unsaved && (
        <span className="flex items-center gap-0.5 text-[10px] text-green-600 font-bold">
          <Check className="w-2.5 h-2.5" /> Guardado
        </span>
      )}
    </div>
  )
}
