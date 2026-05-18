'use client'

import React, { useState } from 'react'

interface SliderControlProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  decimals?: number
  onChange: (v: number) => void
  hint?: string
  tooltip?: string
  source?: 'real' | 'manual'
}

export function SliderControl({
  id, label, value, min, max, step = 1,
  unit = '', decimals = 0, onChange, hint, tooltip, source,
}: SliderControlProps) {
  // rawText permite al usuario vaciar el campo y escribir desde cero
  const [rawText, setRawText] = useState<string | null>(null)
  const [showTip, setShowTip] = useState(false)

  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawText(null)
    onChange(parseFloat(e.target.value))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip leading zeros (e.g. "020" → "20") while allowing decimals like "0.5"
    let raw = e.target.value
    if (/^0\d/.test(raw)) raw = raw.replace(/^0+/, '')
    setRawText(raw)
    const v = parseFloat(raw)
    if (!isNaN(v) && isFinite(v)) {
      onChange(Math.min(max, Math.max(min, v)))
    }
  }

  const handleInputBlur = () => {
    // Al perder foco, sincronizamos con el valor numérico real
    setRawText(null)
    const v = parseFloat(rawText ?? '')
    if (isNaN(v) || !isFinite(v)) {
      // Si el campo quedó vacío o inválido, restauramos el valor actual
      onChange(value)
    }
  }

  const displayValue = rawText !== null ? rawText : value.toFixed(decimals)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs text-gray-500 font-normal leading-none select-none flex items-center gap-1.5"
        >
          {label}
          {source === 'real' && (
            <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded-full leading-none">
              dato real
            </span>
          )}
          {tooltip && (
            <span className="relative inline-flex" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
              <span className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 text-[9px] flex items-center justify-center cursor-help leading-none select-none">?</span>
              {showTip && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 bg-gray-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 z-50 pointer-events-none shadow-lg">
                  {tooltip}
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </span>
              )}
            </span>
          )}
        </label>

        <div className="flex items-center gap-1 shrink-0">
          <input
            id={`${id}-num`}
            type="number"
            inputMode="decimal"
            value={displayValue}
            min={min}
            max={max}
            step={step}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={e => e.target.select()}
            className="w-16 text-right text-xs text-gray-800 bg-transparent border-0 border-b border-gray-300 focus:border-gray-600 focus:outline-none py-0.5 px-0 transition-colors tabular-nums"
            aria-label={`${label} — valor numérico`}
          />
          {unit && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{unit}</span>
          )}
        </div>
      </div>

      {/* Track */}
      <div className="relative h-1 rounded-full bg-gray-100">
        <div
          className="absolute left-0 top-0 h-1 rounded-full bg-gray-400 transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSlider}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-gray-600 shadow-sm pointer-events-none transition-all duration-150"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>

      {hint && (
        <p className="text-[10px] text-gray-500 font-medium leading-none">{hint}</p>
      )}
    </div>
  )
}
