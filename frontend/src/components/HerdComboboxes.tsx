'use client'

/**
 * HerdComboboxes — Shared typeable comboboxes for herd category and breed.
 * Used by: Step3Herds (Onboarding) and HerdModal (Dashboard).
 *
 * UX fix: when the user opens the dropdown (focus), all options are shown
 * regardless of the current value. Filtering only activates once the user
 * starts typing, allowing them to change selection without clearing first.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import {
  CATEGORIAS_COMERCIALES, CATEGORIA_LABEL_RAE, CATEGORIA_COLORS,
  type CategoriaComercial,
} from '@/lib/categorias'

// ── Shared standard bovine options ──────────────────────────────────────────
export const BOVINE_OPTIONS = CATEGORIAS_COMERCIALES.map(k => ({
  key: k as CategoriaComercial,
  label: CATEGORIA_LABEL_RAE[k as CategoriaComercial] ?? k,
}))

// ── Category Combobox ────────────────────────────────────────────────────────
export interface CatComboboxProps {
  /** Current display value (label in RAE format, e.g. "Novillo") */
  value: string
  /** Called on every change: (displayLabel, internalKey | null) */
  onChange: (label: string, key: CategoriaComercial | null) => void
  placeholder?: string
  className?: string
}

export function CatCombobox({ value, onChange, placeholder = 'Ej: Ternero, Novillo...', className }: CatComboboxProps) {
  // inputVal: what the <input> shows (display value)
  // hasTyped: true only while the user is actively typing (not just having opened the dropdown)
  const [inputVal, setInputVal] = useState(value)
  const [open,     setOpen]     = useState(false)
  const [hasTyped, setHasTyped] = useState(false)
  const ref                     = useRef<HTMLDivElement>(null)

  // Sync display when parent value changes externally
  useEffect(() => { setInputVal(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setHasTyped(false)
        // If the user closed without selecting a valid option, restore the last committed value
        setInputVal(value)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [value])

  // Show ALL options when the user just opened the dropdown (hasn't typed yet).
  // Filter only when user actively types (hasTyped = true).
  const filtered = useMemo(() => {
    if (!hasTyped) return BOVINE_OPTIONS
    const q = inputVal.trim().toLowerCase()
    if (!q) return BOVINE_OPTIONS
    return BOVINE_OPTIONS.filter(o => o.label.toLowerCase().startsWith(q))
  }, [inputVal, hasTyped])

  const handleFocus = () => {
    setHasTyped(false) // reset → show all options
    setOpen(true)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputVal(v)
    setHasTyped(true)
    setOpen(true)
    // Check if user typed an exact match
    const matched = BOVINE_OPTIONS.find(o => o.label.toLowerCase() === v.trim().toLowerCase())
    onChange(v, matched?.key ?? null)
  }

  const selectOption = (o: { key: CategoriaComercial; label: string }) => {
    setInputVal(o.label)
    setHasTyped(false)
    setOpen(false)
    onChange(o.label, o.key)
  }

  const showCustomEntry = hasTyped &&
    inputVal.trim().length > 0 &&
    !BOVINE_OPTIONS.some(o => o.label.toLowerCase() === inputVal.trim().toLowerCase())

  const baseInput = 'w-full bg-white border-2 border-gray-200 rounded-xl px-3.5 py-3 pr-9 text-base text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-medium'

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={handleInput}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={baseInput}
          autoComplete="off"
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform pointer-events-none ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (filtered.length > 0 || showCustomEntry) && (
        <ul className="absolute z-[9999] top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(o => {
            const colors = CATEGORIA_COLORS[o.key]
            const isActive = inputVal.trim().toLowerCase() === o.label.toLowerCase() && !hasTyped
            return (
              <li
                key={o.key}
                onMouseDown={() => selectOption(o)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-colors ${
                  isActive ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${colors?.dot ?? 'bg-gray-400'}`} />
                <span className={`text-sm ${isActive ? 'font-semibold text-green-700' : 'text-gray-800'}`}>
                  {o.label}
                </span>
                {isActive && <span className="ml-auto text-[10px] text-green-500 font-bold">✓</span>}
              </li>
            )
          })}
          {showCustomEntry && (
            <li
              onMouseDown={() => { setOpen(false); onChange(inputVal.trim(), null) }}
              className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500">
                Usar "<strong>{inputVal.trim()}</strong>" <span className="text-gray-400">(sin cotización de mercado)</span>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

// ── Breed Combobox ────────────────────────────────────────────────────────────
export interface BreedComboboxProps {
  value: string
  onChange: (val: string) => void
  /** List of standard breeds to show (filtered by selected category) */
  breeds: string[]
  placeholder?: string
  className?: string
}

export function BreedCombobox({ value, onChange, breeds, placeholder = 'Buscar o escribir raza...', className }: BreedComboboxProps) {
  const [open,     setOpen]     = useState(false)
  const [hasTyped, setHasTyped] = useState(false)
  const ref                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setHasTyped(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Show all breeds on open; filter only when typing
  const filtered = useMemo(() => {
    if (!hasTyped) return breeds
    const q = value.trim().toLowerCase()
    if (!q) return breeds
    return breeds.filter(b => b.toLowerCase().includes(q))
  }, [value, breeds, hasTyped])

  const showCustomEntry = hasTyped &&
    value.trim().length > 0 &&
    !breeds.some(b => b.toLowerCase() === value.trim().toLowerCase())

  const baseInput = 'w-full bg-white border-2 border-gray-200 rounded-xl px-3.5 py-3 pr-9 text-base text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-medium'

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setHasTyped(true); setOpen(true) }}
          onFocus={() => { setHasTyped(false); setOpen(true) }}
          placeholder={placeholder}
          className={baseInput}
          autoComplete="off"
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform pointer-events-none ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (filtered.length > 0 || showCustomEntry) && (
        <ul className="absolute z-[9999] top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-44 overflow-y-auto">
          {filtered.map(b => {
            const isActive = b.toLowerCase() === value.toLowerCase() && !hasTyped
            return (
              <li
                key={b}
                onMouseDown={() => { onChange(b); setHasTyped(false); setOpen(false) }}
                className={`px-3.5 py-2 cursor-pointer text-sm transition-colors flex items-center justify-between ${
                  isActive ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {b}
                {isActive && <span className="text-[10px] text-green-500 font-bold">✓</span>}
              </li>
            )
          })}
          {showCustomEntry && (
            <li
              onMouseDown={() => { setOpen(false); setHasTyped(false) }}
              className="flex items-center gap-2 px-3.5 py-2 cursor-pointer border-t border-gray-100 hover:bg-gray-50 text-xs text-gray-500"
            >
              <Plus className="w-3 h-3 shrink-0 text-gray-400" />
              Guardar "<strong>{value.trim()}</strong>" como nueva raza
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
