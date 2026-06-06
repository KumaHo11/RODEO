'use client'

/**
 * CustomSelect — Dropdown unificado para toda la app.
 *
 * Visualmente idéntico al CatCombobox: fondo blanco, border-2,
 * rounded-xl, py-3, text-base, focus:ring-green-500.
 * Usa createPortal para nunca quedar oculto por overflow-hidden.
 *
 * Uso simple:
 *   <CustomSelect
 *     value={value}
 *     onChange={setValue}
 *     options={[{ label: 'Opción A', value: 'a' }, ...]}
 *   />
 *
 * Con grupos:
 *   <CustomSelect
 *     value={value}
 *     onChange={setValue}
 *     groups={[{ label: 'Grupo', options: [{ label: 'X', value: 'x' }] }]}
 *   />
 */

import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  label: string
  value: string | number
  /** Optional dot color (hex or tailwind bg class) for decorative indicator */
  dotColor?: string
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

interface CustomSelectProps {
  value: string | number
  onChange: (value: string | number) => void
  /** Flat list of options (mutually exclusive with groups) */
  options?: SelectOption[]
  /** Grouped options (mutually exclusive with options) */
  groups?: SelectGroup[]
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Extra class applied to the trigger button */
  triggerClassName?: string
}

const BASE =
  'w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-medium text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-left flex items-center justify-between gap-2 cursor-pointer'

export function CustomSelect({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = '— Seleccionar —',
  className = '',
  disabled = false,
  triggerClassName = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  // Flatten all options for label lookup
  const allOptions: SelectOption[] = groups.length > 0
    ? groups.flatMap(g => g.options)
    : options

  const selectedLabel = allOptions.find(o => o.value === value)?.label ?? ''
  const selectedDot   = allOptions.find(o => o.value === value)?.dotColor

  // Position the portal dropdown to align with the trigger
  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH = Math.min(320, allOptions.length * 44 + 16)
    const openUpward = spaceBelow < dropH + 8 && rect.top > dropH + 8

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }

  const toggle = () => {
    if (disabled) return
    if (!open) updatePosition()
    setOpen(v => !v)
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onScroll = () => { updatePosition() }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      window.removeEventListener('scroll', onScroll, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const select = (opt: SelectOption) => {
    onChange(opt.value)
    setOpen(false)
  }

  const renderOption = (opt: SelectOption) => {
    const isActive = opt.value === value
    return (
      <button
        key={opt.value}
        type="button"
        onMouseDown={() => select(opt)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
          isActive ? 'bg-green-50 text-green-800 font-semibold' : 'text-gray-800 hover:bg-gray-50'
        }`}
      >
        {opt.dotColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={opt.dotColor.startsWith('#') || opt.dotColor.startsWith('rgb')
              ? { backgroundColor: opt.dotColor }
              : undefined}
          />
        )}
        <span className="flex-1">{opt.label}</span>
        {isActive && <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />}
      </button>
    )
  }

  const dropdown = open ? (
    <div
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden overflow-y-auto max-h-80"
    >
      {groups.length > 0
        ? groups.map(g => (
            <div key={g.label}>
              <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{g.label}</span>
              </div>
              {g.options.map(renderOption)}
            </div>
          ))
        : options.map(renderOption)}
    </div>
  ) : null

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={`${BASE} ${triggerClassName} ${open ? 'ring-2 ring-green-500 border-transparent' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selectedDot && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={selectedDot.startsWith('#') || selectedDot.startsWith('rgb')
                ? { backgroundColor: selectedDot }
                : undefined}
            />
          )}
          <span className={`truncate ${selectedLabel ? 'text-gray-900' : 'text-gray-400'}`}>
            {selectedLabel || placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {typeof document !== 'undefined' && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  )
}
