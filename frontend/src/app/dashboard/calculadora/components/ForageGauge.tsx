'use client'

import React from 'react'
import clsx from 'clsx'
import type { CalculatorResult } from '../calculatorEngine'

interface ForageGaugeProps {
  result: CalculatorResult
}

export function ForageGauge({ result }: ForageGaugeProps) {
  const { autonomiaDias, alertLevel } = result

  // El arco va de 0 a 90 días (cap)
  const maxDias = 90
  const capped  = Math.min(autonomiaDias, maxDias)
  const fraction = capped / maxDias

  // SVG semicírculo
  const cx = 80, cy = 80, r = 58
  const circumference = Math.PI * r   // medio arco
  const dashOffset    = circumference * (1 - fraction)

  const colorStroke: Record<string, string> = {
    ok:       '#6b7280',   // gray-500
    warning:  '#d97706',   // amber-600
    critical: '#dc2626',   // red-600
  }

  const colorText: Record<string, string> = {
    ok:       'text-gray-700',
    warning:  'text-amber-600',
    critical: 'text-red-600',
  }

  const stroke = colorStroke[alertLevel]

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 160, height: 88 }}>
        <svg
          viewBox="0 0 160 88"
          width="160"
          height="88"
          aria-label={`Autonomía forrajera: ${autonomiaDias} días`}
          role="img"
        >
          {/* Track background */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Arc relleno */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.4s ease' }}
          />
        </svg>

        {/* Valor central */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={clsx('text-3xl leading-none font-medium tabular-nums', colorText[alertLevel])}>
            {autonomiaDias >= maxDias ? `+${maxDias}` : autonomiaDias}
          </span>
          <span className="text-[10px] text-gray-400 leading-none mt-0.5">días</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center leading-snug">
        Autonomía forrajera
      </p>

      {/* Escala mínima */}
      <div className="flex w-40 justify-between px-1">
        <span className="text-[9px] text-gray-300">0</span>
        <span className="text-[9px] text-gray-300">45</span>
        <span className="text-[9px] text-gray-300">90+</span>
      </div>
    </div>
  )
}
