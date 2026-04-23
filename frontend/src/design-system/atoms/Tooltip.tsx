'use client'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  const show = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Coords for portal (relative to viewport)
      setCoords({ x: r.left + r.width / 2, y: r.top })
    }
    if (timer.current) clearTimeout(timer.current)
    setVisible(true)
  }

  const hide = () => {
    timer.current = setTimeout(() => setVisible(false), 80)
  }

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  const btnSize  = size === 'md' ? 'w-5 h-5'  : 'w-4 h-4'

  const tooltipContent = visible && mounted ? (
    <div
      role="tooltip"
      onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); setVisible(true) }}
      onMouseLeave={hide}
      style={{
        position: 'fixed',
        left: Math.max(10, Math.min(coords.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 130)),
        top: coords.y - 8,
        transform: 'translate(-50%, -100%)',
        zIndex: 2147483647, // Max z-index
        pointerEvents: 'auto',
      }}
      className="w-56 bg-gray-900 text-white text-[11px] leading-relaxed font-medium px-3 py-2.5 rounded-xl shadow-2xl"
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
  ) : null

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
        <svg
          className={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {visible && mounted && createPortal(tooltipContent, document.body)}
    </>
  )
}
