'use client'

/**
 * HerdClimateStatusBadge
 *
 * Chip de bienestar animal basado en condiciones climáticas actuales.
 * No muestra datos crudos — traduce temp/humedad/viento a estado legible.
 *
 * Estados:
 *   CONFORT          → sin ajuste de consumo
 *   ESTRÉS CALÓRICO  → temp + humedad altas, reduce consumo estimado
 *   ESTRÉS POR FRÍO  → viento + lluvia + temp baja, aumenta gasto energético
 */

import React, { useMemo, useState } from 'react'
import { Thermometer, Snowflake, CheckCircle2, X } from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'

// ── Lógica de clasificación ──────────────────────────────────────────────────

type ClimateStress = 'CONFORT' | 'HEAT' | 'COLD'

interface StressResult {
  type: ClimateStress
  /** Micro-copy principal — qué le pasa al animal */
  label: string
  /** Impacto cuantificado en consumo / gasto energético */
  impact: string
  /** Explicación expandida (tooltip) */
  detail: string
  /** THI estimado (solo heat) */
  thi?: number
  /** Ajuste porcentual de consumo (negativo = reducción) */
  consumptionAdjPct: number
  /** Ajuste porcentual de gasto energético (positivo = aumento) */
  energyExpAdjPct: number
}

function classifyStress(
  tempC: number,
  humidityPct: number,
  windKmh: number,
  precipMm: number   // precip últimas 24h
): StressResult {
  // ── THI: Temperature Humidity Index ─────────────────────────────────────
  // THI = temp + 0.36 * dewpoint + 41.5
  // Dewpoint approx: temp - ((100 - hum) / 5)
  const dewpoint = tempC - (100 - humidityPct) / 5
  const thi = parseFloat((tempC + 0.36 * dewpoint + 41.5).toFixed(1))

  // ── Estrés calórico ──────────────────────────────────────────────────────
  // THI > 72 = inicio de estrés · > 80 = severo
  if (thi > 72) {
    const thiExcess = Math.max(0, thi - 72)
    // Reducción de consumo: ~1.2% por cada punto THI sobre 72
    const consumptionAdjPct = Math.round(Math.min(25, thiExcess * 1.2) * -1)
    const severity = thi > 80 ? 'severo' : 'moderado'

    return {
      type: 'HEAT',
      label: 'Estrés calórico',
      impact: `Consumo reducido ~${Math.abs(consumptionAdjPct)}%`,
      detail: `Hace demasiado calor para que los animales coman bien. Con ${Math.round(tempC)}°C y ${Math.round(humidityPct)}% de humedad, el rodeo consume menos forraje de lo proyectado (estrés ${severity}).`,
      thi,
      consumptionAdjPct,
      energyExpAdjPct: 0,
    }
  }

  // ── Estrés por frío / barro ──────────────────────────────────────────────
  // Temp < 8°C + viento > 15 km/h o lluvia > 5mm
  const isColdStress =
    tempC < 8 || (tempC < 12 && windKmh > 20) || (tempC < 15 && precipMm > 10)

  if (isColdStress) {
    // Aumento de gasto energético por frío + barro
    const windFactor  = Math.min(0.12, windKmh / 300)
    const rainFactor  = precipMm > 5 ? 0.10 : 0
    const tempFactor  = tempC < 5 ? 0.15 : tempC < 8 ? 0.08 : 0.04
    const energyExpAdjPct = Math.round((windFactor + rainFactor + tempFactor) * 100)

    return {
      type: 'COLD',
      label: 'Estrés por frío',
      impact: `Gasto energético +${energyExpAdjPct}%`,
      detail: `Frío${precipMm > 5 ? ' y barro' : ''} aumentan el gasto de energía del rodeo. Los animales consumen más calorías para mantenerse calientes, reduciendo la ganancia de peso.`,
      consumptionAdjPct: 0,
      energyExpAdjPct,
    }
  }

  // ── Confort ──────────────────────────────────────────────────────────────
  return {
    type: 'CONFORT',
    label: 'Confort',
    impact: 'Sin ajuste de consumo',
    detail: 'Las condiciones climáticas son óptimas para el bienestar animal. El consumo de forraje está en los niveles esperados.',
    consumptionAdjPct: 0,
    energyExpAdjPct: 0,
  }
}

// ── Configuración visual por estado ──────────────────────────────────────────

const STRESS_CONFIG = {
  CONFORT: {
    bg:     'bg-emerald-50',
    border: 'border-emerald-100',
    text:   'text-emerald-700',
    dot:    'bg-emerald-400',
    Icon:   CheckCircle2,
  },
  HEAT: {
    bg:     'bg-orange-50',
    border: 'border-orange-200',
    text:   'text-orange-700',
    dot:    'bg-orange-400',
    Icon:   Thermometer,
  },
  COLD: {
    bg:     'bg-sky-50',
    border: 'border-sky-200',
    text:   'text-sky-700',
    dot:    'bg-sky-400',
    Icon:   Snowflake,
  },
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  /** Muestra solo el chip pequeño sin el panel expandido */
  compact?: boolean
  className?: string
}

export default function HerdClimateStatusBadge({ compact = false, className = '' }: Props) {
  const { current, isLoading } = useWeather()
  const [expanded, setExpanded] = useState(false)

  const stress = useMemo<StressResult | null>(() => {
    if (!current) return null
    return classifyStress(
      current.tempC,
      current.humidityPct,
      current.windSpeedKmh,
      0 // No hay acceso directo a precip 24h desde current — usar 0 como fallback
    )
  }, [current])

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-100 bg-gray-50 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
        <span className="text-[10px] text-gray-300 font-bold">Clima...</span>
      </div>
    )
  }

  if (!stress || !current) return null

  const cfg = STRESS_CONFIG[stress.type]
  const { Icon } = cfg

  // ── Compact chip (para cards de Rodeo) ───────────────────────────────────
  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setExpanded(v => !v)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border
            transition-all hover:shadow-sm cursor-pointer
            ${cfg.bg} ${cfg.border} ${className}
          `}
          title={stress.detail}
        >
          <Icon className={`w-3 h-3 ${cfg.text}`} />
          <span className={`text-[10px] font-black uppercase tracking-wide ${cfg.text}`}>
            {stress.label}
          </span>
          {stress.type !== 'CONFORT' && (
            <span className={`text-[9px] font-bold opacity-70 ${cfg.text}`}>
              · {stress.impact}
            </span>
          )}
        </button>

        {/* Tooltip expandido */}
        {expanded && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setExpanded(false)} />
            <div className={`
              absolute bottom-full left-0 mb-2 z-[9999] w-64
              ${cfg.bg} border ${cfg.border} rounded-2xl p-4 shadow-xl
            `}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.text} shrink-0`} />
                  <p className={`text-xs font-black ${cfg.text}`}>{stress.label}</p>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-gray-300 hover:text-gray-500 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className={`text-[11px] leading-relaxed ${cfg.text} opacity-80 mb-3`}>
                {stress.detail}
              </p>

              {/* Métricas de impacto */}
              {stress.type !== 'CONFORT' && (
                <div className="bg-white/70 rounded-xl px-3 py-2">
                  {stress.consumptionAdjPct !== 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500">Ajuste de consumo</span>
                      <span className={`text-xs font-black ${stress.consumptionAdjPct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {stress.consumptionAdjPct > 0 ? '+' : ''}{stress.consumptionAdjPct}%
                      </span>
                    </div>
                  )}
                  {stress.energyExpAdjPct !== 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-bold text-gray-500">Gasto energético</span>
                      <span className="text-xs font-black text-sky-600">
                        +{stress.energyExpAdjPct}%
                      </span>
                    </div>
                  )}
                  {stress.thi !== undefined && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-bold text-gray-500">Índice THI</span>
                      <span className={`text-xs font-black ${stress.thi > 80 ? 'text-red-600' : 'text-orange-600'}`}>
                        {stress.thi}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Condiciones actuales (datos crudos solo en el tooltip) */}
              <p className="text-[9px] text-gray-400 font-medium mt-2 text-right">
                {Math.round(current.tempC)}°C · {Math.round(current.humidityPct)}% hum · {Math.round(current.windSpeedKmh)} km/h viento
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Full card (para panel de detalle) ────────────────────────────────────
  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border} ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/60`}>
          <Icon className={`w-5 h-5 ${cfg.text}`} />
        </div>
        <div>
          <p className={`text-xs font-black uppercase tracking-widest ${cfg.text}`}>
            Estado del rodeo
          </p>
          <p className={`text-base font-black ${cfg.text} leading-tight`}>
            {stress.label}
          </p>
        </div>
      </div>

      <p className={`text-[11px] leading-relaxed ${cfg.text} opacity-80 mb-3`}>
        {stress.detail}
      </p>

      {stress.type !== 'CONFORT' && (
        <div className="bg-white/60 rounded-xl px-3 py-2.5 space-y-1.5">
          {stress.consumptionAdjPct !== 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500">Ajuste de consumo estimado</span>
              <span className={`text-sm font-black ${stress.consumptionAdjPct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {stress.consumptionAdjPct > 0 ? '+' : ''}{stress.consumptionAdjPct}%
              </span>
            </div>
          )}
          {stress.energyExpAdjPct !== 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500">Aumento en gasto energético</span>
              <span className="text-sm font-black text-sky-600">+{stress.energyExpAdjPct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
