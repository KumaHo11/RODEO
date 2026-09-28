'use client'

/**
 * CustomSelect — Dropdown consistente con el Design System.
 *
 * Reemplaza el <select> nativo del SO.
 * - Fondo blanco, borde, typography consistente con los inputs del form
 * - z-index alto (z-[9999]) para no quedar oculto bajo otros elementos
 * - Cierra al hacer click fuera o al presionar Escape
 * - Accesible: role="combobox", aria-expanded, keyboard navigation básica
 */

import React, { useState, useRef, useEffect, useId } from 'react'
import clsx from 'clsx'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  id?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  className,
  id,
}: CustomSelectProps) {
  const [open, setOpen]             = useState(false)
  const [focused, setFocused]       = useState(-1)
  const containerRef                = useRef<HTMLDivElement>(null)
  const listRef                     = useRef<HTMLUListElement>(null)
  const uid                         = useId()
  const triggerId                   = id ?? `custom-select-${uid}`
  const listId                      = `${triggerId}-list`

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  // Scroll del item enfocado
  useEffect(() => {
    if (!open || focused < 0) return
    const list = listRef.current
    const item = list?.children[focused] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [focused, open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault(); setOpen(true); setFocused(0)
      }
      return
    }
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && focused >= 0) {
      e.preventDefault()
      onChange(options[focused].value)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger */}
      <button
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => { setOpen(o => !o); setFocused(0) }}
        onKeyDown={handleKeyDown}
        className={clsx(
          'w-full flex items-center justify-between',
          'border-2 border-gray-200 rounded-xl px-3.5 py-3',
          'text-sm font-medium text-left bg-white',
          'focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none',
          'transition-all hover:border-gray-300',
          !value && 'text-gray-400',
          value  && 'text-gray-800',
        )}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-labelledby={triggerId}
          className={clsx(
            'absolute left-0 right-0 mt-1',
            'bg-white border border-gray-200 rounded-2xl shadow-xl',
            'max-h-56 overflow-y-auto py-1',
            'z-[9999]',        // siempre encima de todo
          )}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            const isFocused  = focused === idx
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setFocused(idx)}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 cursor-pointer text-sm font-medium',
                  'transition-colors select-none',
                  isFocused && 'bg-gray-50',
                  isSelected ? 'text-green-700 font-bold' : 'text-gray-700',
                )}
              >
                <Check
                  className={clsx(
                    'w-3.5 h-3.5 shrink-0 transition-opacity',
                    isSelected ? 'opacity-100 text-green-600' : 'opacity-0'
                  )}
                />
                {opt.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
