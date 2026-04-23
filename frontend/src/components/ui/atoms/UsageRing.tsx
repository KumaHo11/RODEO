'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'

// ─── Portal Tooltip ───────────────────────────────────────────────────────────
// Renders the tooltip outside the DOM tree to avoid overflow:hidden / z-index issues
function TooltipPortal({ text, triggerRef, show }: {
  text: string
  triggerRef: React.RefObject<HTMLElement | null>
  show: boolean
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.top - 8,   // above the element (relative to viewport)
        left: rect.left + rect.width / 2,
      })
    }
  }, [show, triggerRef])

  if (!show || !mounted) return null

  return ReactDOM.createPortal(
    <span
      role="tooltip"
      style={{
        position: 'fixed', // Use fixed to be sure it's relative to viewport
        top: pos.top,
        left: Math.max(110, Math.min(window.innerWidth - 110, pos.left)), // Keep within screen bounds
        transform: 'translate(-50%, -100%)',
        zIndex: 2147483647, // Max z-index
        pointerEvents: 'none',
      }}
      className="w-52 bg-gray-900 text-white text-[10px] font-medium leading-relaxed rounded-xl px-3 py-2 shadow-2xl text-center whitespace-normal"
    >
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </span>,
    document.body
  )
}

// ─── InfoTooltip (i button) ───────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <span className="relative inline-flex" style={{ verticalAlign: 'middle' }}>
      <button
        ref={ref}
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 flex items-center justify-center text-[8px] font-black leading-none cursor-help transition-colors"
        aria-label="Información"
      >
        i
      </button>
      <TooltipPortal text={text} triggerRef={ref} show={show} />
    </span>
  )
}

// ─── HoverTooltip (wrapper around any child) ──────────────────────────────────
export function HoverTooltip({ text, children, className = '' }: {
  text: string
  children: React.ReactNode
  className?: string
}) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <TooltipPortal text={text} triggerRef={ref} show={show} />
    </div>
  )
}

// ─── Semantic color for % USO ─────────────────────────────────────────────────
function getUsageColor(pct: number): { stroke: string; text: string; bg: string; label: string } {
  if (pct < 100) return { stroke: '#16a34a', text: 'text-green-700',  bg: 'rgba(22,163,74,0.10)',  label: 'Sub-uso' }
  if (pct <= 110) return { stroke: '#d97706', text: 'text-amber-700', bg: 'rgba(217,119,6,0.10)',  label: 'Alerta' }
  return              { stroke: '#dc2626', text: 'text-red-700',   bg: 'rgba(220,38,38,0.10)',   label: 'Sobrepastoreo' }
}

// ─── CircularProgress ─────────────────────────────────────────────────────────
interface CircularProgressProps {
  pct: number
  size?: number
  strokeW?: number
}

export function CircularProgress({ pct, size = 52, strokeW = 4 }: CircularProgressProps) {
  const { stroke } = getUsageColor(pct)
  const r = (size - strokeW * 2) / 2
  const circ = 2 * Math.PI * r
  const fillPct = Math.min(pct, 110)
  const dash = (fillPct / 110) * circ
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={strokeW} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }}
      />
    </svg>
  )
}

// ─── UsageRing ────────────────────────────────────────────────────────────────
interface UsageRingProps {
  usagePct: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const SIZE_MAP = {
  sm: { ring: 40, text: 'text-[9px]', sub: 'text-[7px]', sw: 3 },
  md: { ring: 52, text: 'text-xs',    sub: 'text-[8px]', sw: 4 },
  lg: { ring: 68, text: 'text-sm',    sub: 'text-[9px]', sw: 5 },
}

export function UsageRing({ usagePct, size = 'sm', showLabel = false }: UsageRingProps) {
  const { text, bg, label } = getUsageColor(usagePct)
  const { ring, text: tCls, sub, sw } = SIZE_MAP[size]

  return (
    <div className="relative flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: ring, height: ring }}>
        <CircularProgress pct={usagePct} size={ring} strokeW={sw} />
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-full"
          style={{ backgroundColor: bg }}
        >
          <span className={`font-black leading-none ${tCls} ${text}`}>
            {usagePct > 999 ? '999+' : `${usagePct}%`}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className={`${sub} font-black uppercase tracking-tight ${text}`}>{label}</span>
      )}
    </div>
  )
}

// ─── TOOLTIPS centralizados ───────────────────────────────────────────────────
export const HOLISTIC_TOOLTIPS = {
  usagePct:    'Indica la presión de pastoreo del plan actual. Más del 100% significa que el tiempo de permanencia supera la oferta de pasto (Sobre-uso).',
  yieldCoef:   'Rendimiento relativo natural del potrero comparado con el promedio del módulo. >1 está sobre el promedio.',
  estimatedDah:'Días que 1 Hectárea puede alimentar a 1 Equivalente Vaca con la biomasa disponible actual.',
  quality:     'Calidad relativa asignada manualmente en la infraestructura (1–10).',
} as const

// ─── PaddockMetrics ───────────────────────────────────────────────────────────
interface PaddockMetricsProps {
  usagePct:      number | null
  yieldCoef:     number | null
  estimatedDah:  number | null
  qualityScore?: number | null
  showQuality?:  boolean
  compact?:      boolean
}

export function PaddockMetrics({
  usagePct, yieldCoef, estimatedDah, qualityScore,
  showQuality = false, compact = false,
}: PaddockMetricsProps) {
  if (usagePct === null && yieldCoef === null && estimatedDah === null) return null

  return (
    <div className={`flex items-center gap-${compact ? '1.5' : '2'} flex-wrap`}>

      {usagePct !== null && (
        <div className="flex items-center gap-1">
          <UsageRing usagePct={usagePct} size="sm" />
          {!compact && (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">% USO</span>
                <InfoTooltip text={HOLISTIC_TOOLTIPS.usagePct} />
              </div>
              <span className={`text-[9px] font-black leading-none ${getUsageColor(usagePct).text}`}>
                {usagePct < 100 ? 'Equilibrio' : usagePct <= 110 ? 'Alerta' : 'Sobrepastoreo'}
              </span>
            </div>
          )}
        </div>
      )}

      {yieldCoef !== null && (
        <div className="flex items-center gap-0.5">
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              yieldCoef >= 1.1 ? 'text-green-700 bg-green-50 border-green-100'
              : yieldCoef >= 0.9 ? 'text-gray-600 bg-gray-50 border-gray-200'
              : 'text-amber-700 bg-amber-50 border-amber-100'
            }`}
          >
            ×{yieldCoef.toFixed(2)}
          </span>
          <InfoTooltip text={HOLISTIC_TOOLTIPS.yieldCoef} />
        </div>
      )}

      {estimatedDah !== null && (
        <div className="flex items-center gap-0.5">
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">
            {estimatedDah}d DAH
          </span>
          <InfoTooltip text={HOLISTIC_TOOLTIPS.estimatedDah} />
        </div>
      )}

      {showQuality && qualityScore != null && (
        <div className="flex items-center gap-0.5">
          <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-lg border bg-white shadow-sm ${
            qualityScore >= 7 ? 'text-green-700 border-green-200'
            : qualityScore >= 4 ? 'text-amber-600 border-amber-200'
            : 'text-red-600 border-red-200'
          }`}>
            {qualityScore}/10
          </span>
          <InfoTooltip text={HOLISTIC_TOOLTIPS.quality} />
        </div>
      )}
    </div>
  )
}

export { InfoTooltip }
