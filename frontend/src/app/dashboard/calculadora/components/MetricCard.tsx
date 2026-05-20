'use client'

import React, { useState } from 'react'
import clsx from 'clsx'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: number
  deltaLabel?: string
  highlight?: boolean
  alert?: 'ok' | 'warning' | 'critical'
  sub?: string
  tooltip?: string
}

export function MetricCard({
  label, value, unit, delta, deltaLabel,
  highlight = false, alert, sub, tooltip,
}: MetricCardProps) {
  const [showTip, setShowTip] = useState(false)

  const alertBorder: Record<string, string> = {
    ok:       'border-gray-100',
    warning:  'border-amber-200',
    critical: 'border-red-200',
  }
  const alertBg: Record<string, string> = {
    ok:       '',
    warning:  'bg-amber-50/40',
    critical: 'bg-red-50/40',
  }

  const borderClass = alert ? alertBorder[alert] : 'border-gray-100'
  const bgClass     = alert ? alertBg[alert]     : ''

  return (
    <div className={clsx(
      'bg-white border rounded-2xl px-4 py-4 flex flex-col gap-1.5 transition-all duration-200 shadow-sm',
      borderClass, bgClass,
      highlight && 'py-5'
    )}>
      <div className="flex items-start justify-between gap-1">
        {/* Label — sentence case, 11px, medium weight — NOT uppercase */}
        <p className="text-[11px] font-semibold text-gray-500 leading-tight select-none">
          {label}
        </p>
        {tooltip && (
          <span className="relative shrink-0" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
            <span className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 text-[9px] flex items-center justify-center cursor-help leading-none select-none">?</span>
            {showTip && (
              <span className="absolute bottom-full right-0 mb-1.5 w-52 bg-gray-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 z-50 pointer-events-none shadow-lg">
                {tooltip}
                <span className="absolute top-full right-2 border-4 border-transparent border-t-gray-800" />
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={clsx(
          'text-gray-900 font-black leading-none tabular-nums',
          highlight ? 'text-3xl' : 'text-2xl'
        )}>
          {value}
        </span>
        {unit && (
          <span className={clsx(
            'text-gray-400 font-medium leading-none',
            highlight ? 'text-sm' : 'text-xs'
          )}>
            {unit}
          </span>
        )}
      </div>

      {sub && (
        <p className="text-[10px] text-gray-400 font-medium leading-snug">{sub}</p>
      )}

      {delta !== undefined && (
        <p className={clsx(
          'text-[10px] font-bold leading-none',
          delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'
        )}>
          {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(1) : delta}
          {deltaLabel ? ` ${deltaLabel}` : ''} vs. escenario B
        </p>
      )}
    </div>
  )
}
