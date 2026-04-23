/**
 * RODEO Design System — Tooltip Atom
 * ────────────────────────────────────
 * Botón (i) circular que muestra un popover explicativo al hacer hover.
 * Ideal para campos técnicos que necesitan explicación didáctica.
 *
 * Uso: <Tooltip text="Explicación del campo" />
 */
'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export interface TooltipProps {
  /** Texto explicativo que se muestra en el popover */
  text: string
  /** Posición del popover respecto al botón */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Tamaño del ícono (i) */
  size?: 'sm' | 'md'
  className?: string
}

export function Tooltip({
  text,
  position = 'top',
  size = 'sm',
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ x: r.left + r.width / 2, y: r.top })
    }
    setVisible(true)
  }

  const hide = () => {
    timer.current = setTimeout(() => setVisible(false), 80)
  }

  // Clean up timer on unmount
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  const btnSize  = size === 'md' ? 'w-5 h-5'  : 'w-4 h-4'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Más información"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={twMerge(
          btnSize,
          'inline-flex items-center justify-center rounded-full',
          'bg-gray-100 hover:bg-green-100 text-gray-400 hover:text-green-600',
          'transition-all duration-150 shrink-0 cursor-help',
          className
        )}
      >
        <Info className={iconSize} />
      </button>

      {visible && (
        <div
          role="tooltip"
          onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); setVisible(true) }}
          onMouseLeave={() => setVisible(false)}
          style={{
            position: 'fixed',
            left: Math.min(coords.x - 120, (typeof window !== 'undefined' ? window.innerWidth : 800) - 260),
            top: coords.y - 8,
            transform: 'translateY(-100%)',
            zIndex: 99999,
          }}
          className="w-56 bg-gray-900 text-white text-[11px] leading-relaxed font-medium px-3 py-2.5 rounded-xl shadow-xl pointer-events-auto"
        >
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 10,
              height: 10,
              background: '#111827',
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            }}
          />
          {text}
        </div>
      )}
    </>
  )
}
