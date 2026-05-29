'use client'

/**
 * WeatherConditionChip
 *
 * Chip unificado para cards de Potrero y Rodeo.
 * Muestra:
 *   - Ícono contextual: ☀️ sol · 🌧️ lluvia · ❄️ helada · ⛅ nublado · 💨 viento
 *   - Estado accionable: "Crecimiento óptimo", "Crecimiento lento", "Helada", etc.
 *
 * Al hacer clic abre un drawer lateral con:
 *   - Variables climáticas del momento
 *   - Métricas específicas (pasto o animal, según `mode`)
 *
 * Modos:
 *   paddock → crecimiento de pasto (kg MS/ha/d, NDVI, balance hídrico)
 *   herd    → bienestar animal (THI, ajuste consumo, gasto energético)
 */

import React, { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer, Droplets, X, ExternalLink, Leaf, TrendingDown, TrendingUp, Minus, Info } from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'

function InfoTip({ text, className = '' }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback((e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }, [])
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="text-inherit opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
        aria-label="Información"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999] w-56 bg-gray-900 text-white text-[11px] font-medium leading-relaxed rounded-xl px-3 py-2.5 shadow-xl text-left whitespace-normal">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        </>
      )}
    </span>
  )
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ChipMode = 'paddock' | 'herd'

export interface WeatherConditionChipProps {
  mode: ChipMode
  /** Nombre del potrero o rodeo (para el header del drawer) */
  entityName?: string
  /** Solo para mode='paddock': tasa de crecimiento actual (kg MS/ha/d) */
  grassGrowthRate?: number
  /** Solo para mode='paddock': NDVI del potrero */
  ndvi?: number
  /** Solo para mode='paddock': balance hídrico (lluvia - ET) */
  waterBalance?: number
  /** Clases adicionales */
  className?: string
  /**
   * Render prop opcional: reemplaza el chip visual por un trigger custom.
   * Recibe { onClick, cond } y debe devolver el elemento clickeable.
   * El drawer de detalle sigue siendo manejado internamente.
   */
  customTrigger?: (args: { onClick: () => void; cond: ConditionResult | null }) => React.ReactNode
}

// ── Lógica de condición climática ─────────────────────────────────────────────

type WeatherCondition = 'SUNNY' | 'PARTLY_CLOUDY' | 'CLOUDY' | 'RAINY' | 'STORMY' | 'FROST' | 'WINDY'

interface ConditionResult {
  condition:   WeatherCondition
  /** Label del ícono (visible en el chip) */
  icon:        React.ReactNode
  /** Estado de pasto o animal */
  paddockLabel: string
  herdLabel:    string
  /** Colores semánticos */
  bg:     string
  border: string
  text:   string
}

function classifyCondition(
  tempC: number,
  humidityPct: number,
  windSpeedKmh: number,
  weatherCode: number   // WMO code
): ConditionResult {
  // Helada: temp ≤ 2°C
  if (tempC <= 2) {
    return {
      condition:    'FROST',
      icon:         <CloudSnow className="w-3.5 h-3.5" />,
      paddockLabel: 'Crecimiento detenido',
      herdLabel:    'Gasto elevado',
      bg:    'bg-sky-50',
      border:'border-sky-200',
      text:  'text-sky-700',
    }
  }

  // Tormenta: WMO 95-99
  if (weatherCode >= 95) {
    return {
      condition:    'STORMY',
      icon:         <CloudRain className="w-3.5 h-3.5" />,
      paddockLabel: 'Crecimiento pausado',
      herdLabel:    'Estrés animal',
      bg:    'bg-slate-50',
      border:'border-slate-200',
      text:  'text-slate-700',
    }
  }

  // Lluvia: WMO 51-82
  if (weatherCode >= 51 && weatherCode <= 82) {
    return {
      condition:    'RAINY',
      icon:         <CloudRain className="w-3.5 h-3.5" />,
      paddockLabel: 'Crecimiento activo',
      herdLabel:    'Confort limitado',
      bg:    'bg-blue-50',
      border:'border-blue-200',
      text:  'text-blue-700',
    }
  }

  // Viento fuerte: > 50 km/h
  if (windSpeedKmh > 50) {
    return {
      condition:    'WINDY',
      icon:         <Wind className="w-3.5 h-3.5" />,
      paddockLabel: 'Crecimiento reducido',
      herdLabel:    'Estrés por frío',
      bg:    'bg-gray-50',
      border:'border-gray-200',
      text:  'text-gray-600',
    }
  }

  // Nublado: WMO 2-3 (partly/overcast)
  if (weatherCode >= 2 && weatherCode <= 48) {
    return {
      condition:    'PARTLY_CLOUDY',
      icon:         <Cloud className="w-3.5 h-3.5" />,
      paddockLabel: 'Crecimiento lento',
      herdLabel:    'Confort',
      bg:    'bg-gray-50',
      border:'border-gray-200',
      text:  'text-gray-600',
    }
  }

  // Sol (default): WMO 0-1
  const isHot = tempC > 30 || (tempC > 25 && humidityPct > 70)
  const isCold = tempC < 8 || (tempC < 12 && windSpeedKmh > 20)
  return {
    condition:    'SUNNY',
    icon:         <Sun className="w-3.5 h-3.5" />,
    paddockLabel: 'Crecimiento',
    herdLabel:    isHot ? 'Estrés calórico' : isCold ? 'Estrés térmico' : 'Confort',
    bg:    isHot ? 'bg-orange-50' : isCold ? 'bg-sky-50' : 'bg-emerald-50',
    border:isHot ? 'border-orange-200' : isCold ? 'border-sky-200' : 'border-emerald-100',
    text:  isHot ? 'text-orange-700' : isCold ? 'text-sky-700' : 'text-emerald-700',
  }
}

// ── Cálculo THI para rodeos ───────────────────────────────────────────────────

function calcTHI(tempC: number, humidityPct: number): number {
  const dewpoint = tempC - (100 - humidityPct) / 5
  return parseFloat((tempC + 0.36 * dewpoint + 41.5).toFixed(1))
}

// ── Drawer lateral ────────────────────────────────────────────────────────────

function ClimateDetailDrawer({
  mode, entityName, grassGrowthRate, ndvi, waterBalance, cond, onClose,
}: WeatherConditionChipProps & { cond: ConditionResult; onClose: () => void }) {
  const { current, forecast, locationName } = useWeather()
  if (!current) return null

  const thi = mode === 'herd' ? calcTHI(current.tempC, current.humidityPct) : null
  const thiStress = thi != null ? (thi > 80 ? 'severo' : thi > 72 ? 'moderado' : null) : null
  const consumptionAdj = thi != null && thi > 72 ? Math.round(Math.min(25, (thi - 72) * 1.2) * -1) : 0
  const coldStress     = current.tempC < 8 || (current.tempC < 12 && current.windSpeedKmh > 20)
  const energyAdj      = coldStress ? Math.round((Math.min(0.12, current.windSpeedKmh / 300) + (current.tempC < 5 ? 0.15 : 0.08)) * 100) : 0

  // Próximos 3 días
  const next3 = forecast.slice(0, 3)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-sm bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className={`px-5 py-4 border-b ${cond.border} ${cond.bg} shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                {cond.icon}
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${cond.text} mb-0.5`}>
                  {mode === 'paddock' ? 'Clima del Potrero' : 'Clima del Rodeo'}
                  {locationName && ` · ${locationName}`}
                </p>
                <h3 className={`text-sm font-black ${cond.text} leading-tight`}>
                  {entityName ?? (mode === 'paddock' ? 'Potrero' : 'Rodeo')}
                </h3>
                <p className={`text-xs font-bold ${cond.text} opacity-70 mt-0.5`}>
                  {mode === 'paddock' ? cond.paddockLabel : cond.herdLabel}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50 text-gray-400 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Variables climáticas actuales */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              Condiciones actuales
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Temperatura',  value: `${Math.round(current.tempC)}°C`,          Icon: Thermometer, color: 'text-orange-500' },
                { label: 'Humedad',      value: `${Math.round(current.humidityPct)}%`,      Icon: Droplets,    color: 'text-blue-500' },
                { label: 'Viento',       value: `${Math.round(current.windSpeedKmh)} km/h`, Icon: Wind,        color: 'text-gray-500' },
                { label: 'Sensación',    value: `${Math.round(current.feelsLikeC)}°C`,      Icon: Thermometer, color: 'text-rose-400' },
              ].map(({ label, value, Icon, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3 h-3 ${color}`} />
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                  </div>
                  <p className="text-base font-black text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Métricas específicas por modo */}
          {mode === 'paddock' && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Métricas del potrero
              </p>
              <div className="space-y-2">
                {grassGrowthRate != null && (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${cond.bg} ${cond.border}`}>
                    <div className="flex items-center gap-2">
                      <Leaf className={`w-4 h-4 ${cond.text}`} />
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${cond.text}`}>Tasa de crecimiento</span>
                        <InfoTip className={cond.text} text="Kilogramos de Materia Seca por hectárea, por día. Representa el ritmo de crecimiento diario estimado del pasto." />
                      </div>
                    </div>
                    <span className={`text-base font-black ${cond.text}`}>
                      {grassGrowthRate.toFixed(1)} <span className="text-xs font-medium">kg MS/ha/d</span>
                    </span>
                  </div>
                )}
                {ndvi != null && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-white">
                    <span className="text-xs font-bold text-gray-500">NDVI (verdor)</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Number(ndvi) * 100}%` }} />
                      </div>
                      <span className="text-sm font-black text-gray-700">{Number(ndvi).toFixed(3)}</span>
                    </div>
                  </div>
                )}
                {waterBalance != null && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-white">
                    <div className="flex items-center gap-2">
                      <Droplets className={`w-4 h-4 ${waterBalance >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
                      <span className="text-xs font-bold text-gray-500">Balance hídrico</span>
                    </div>
                    <span className={`text-sm font-black ${waterBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {waterBalance >= 0 ? '+' : ''}{waterBalance.toFixed(1)} mm
                    </span>
                  </div>
                )}
                {/* Interpretación de crecimiento */}
                <div className={`px-4 py-3 rounded-xl border ${cond.border} ${cond.bg}`}>
                  <p className={`text-xs font-bold ${cond.text} leading-relaxed`}>
                    {cond.condition === 'SUNNY' && !grassGrowthRate && 'Condiciones óptimas para el rebrote. El pasto debería crecer bien en los próximos días.'}
                    {cond.condition === 'SUNNY' && grassGrowthRate != null && grassGrowthRate > 15 && 'Crecimiento óptimo. Buenas condiciones para el pastoreo.'}
                    {cond.condition === 'SUNNY' && grassGrowthRate != null && grassGrowthRate <= 15 && 'Sol presente pero crecimiento por debajo del óptimo. Verificar disponibilidad de agua.'}
                    {cond.condition === 'RAINY' && 'La lluvia activa el rebrote. El crecimiento debería acelerar en los próximos 3-5 días.'}
                    {cond.condition === 'FROST' && 'La helada detiene el crecimiento del pasto. No presionar el pastoreo hasta que mejore.'}
                    {cond.condition === 'WINDY' && 'El viento aumenta la evapotranspiración. El pasto puede sufrir estrés hídrico.'}
                    {cond.condition === 'STORMY' && 'Condiciones extremas. Verificar estado del potrero antes de mover animales.'}
                    {cond.condition === 'PARTLY_CLOUDY' && 'Días nublados reducen la fotosíntesis. El crecimiento es más lento de lo esperado.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {mode === 'herd' && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Bienestar del rodeo
              </p>
              <div className="space-y-2">
                {thi != null && (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${thi > 72 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className="text-xs font-bold text-gray-500">Índice THI</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${thi > 80 ? 'bg-red-100 text-red-700' : thi > 72 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {thi > 80 ? 'Severo' : thi > 72 ? 'Moderado' : 'Normal'}
                      </span>
                      <span className="text-base font-black text-gray-700">{thi}</span>
                    </div>
                  </div>
                )}
                {consumptionAdj !== 0 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-100 bg-red-50">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-bold text-red-700">Ajuste de consumo</span>
                    </div>
                    <span className="text-base font-black text-red-700">{consumptionAdj}%</span>
                  </div>
                )}
                {energyAdj > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-sky-100 bg-sky-50">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold text-sky-700">Gasto energético adicional</span>
                    </div>
                    <span className="text-base font-black text-sky-700">+{energyAdj}%</span>
                  </div>
                )}
                {consumptionAdj === 0 && energyAdj === 0 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50">
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">Sin ajuste de consumo</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600">Confort</span>
                  </div>
                )}
                <div className={`px-4 py-3 rounded-xl border ${cond.border} ${cond.bg}`}>
                  <p className={`text-xs font-bold ${cond.text} leading-relaxed`}>
                    {thiStress
                      ? `Estrés calórico ${thiStress}. Los animales reducen su ingesta y producción. Considerar sombra y agua fresca.`
                      : coldStress
                      ? 'El frío aumenta el requerimiento energético del rodeo. Verificar disponibilidad de alimento.'
                      : 'Condiciones de bienestar óptimas. El rodeo consume a plena capacidad.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pronóstico próximos 3 días */}
          {next3.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Próximos 3 días
              </p>
              <div className="grid grid-cols-3 gap-2">
                {next3.map((day, i) => {
                  const date = new Date(day.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
                  const rain = day.precipitationMm > 0
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl px-2 py-3 text-center border border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{date}</p>
                      {rain
                        ? <CloudRain className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                        : day.maxTempC <= 2
                        ? <CloudSnow className="w-5 h-5 text-sky-400 mx-auto mb-1.5" />
                        : <Sun className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                      }
                      <p className="text-xs font-black text-gray-800">{Math.round(day.maxTempC)}°</p>
                      <p className="text-[9px] text-gray-400 font-medium">{Math.round(day.minTempC)}° mín</p>
                      {rain && <p className="text-[9px] text-blue-500 font-bold mt-0.5">{day.precipitationMm.toFixed(0)}mm</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <a
            href="/dashboard/clima"
            className="flex items-center justify-center gap-2 text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver panel completo de Clima
          </a>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function WeatherConditionChip({
  mode, entityName, grassGrowthRate, ndvi, waterBalance, className = '', customTrigger,
}: WeatherConditionChipProps) {
  const { current, isLoading } = useWeather()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mounted, setMounted]       = useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  const cond = useMemo<ConditionResult | null>(() => {
    if (!current) return null
    return classifyCondition(current.tempC, current.humidityPct, current.windSpeedKmh, current.weatherCode)
  }, [current])

  // ── Modo custom trigger ───────────────────────────────────────────────────
  if (customTrigger) {
    if (isLoading || !cond || !current) {
      return <>{customTrigger({ onClick: () => {}, cond: null })}</>
    }
    return (
      <>
        {customTrigger({ onClick: () => setDrawerOpen(true), cond })}
        {drawerOpen && mounted && (
          <ClimateDetailDrawer
            mode={mode}
            entityName={entityName}
            grassGrowthRate={grassGrowthRate}
            ndvi={ndvi}
            waterBalance={waterBalance}
            cond={cond}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </>
    )
  }

  // ── Chip default ──────────────────────────────────────────────────────────
  if (isLoading || !cond || !current) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-100 bg-gray-50 ${className}`}>
        <div className="w-2.5 h-2.5 rounded-full bg-gray-200 animate-pulse" />
        <span className="text-[10px] text-gray-300 font-bold">Clima...</span>
      </div>
    )
  }

  const label = mode === 'paddock' ? cond.paddockLabel : cond.herdLabel

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className={`
          flex items-center gap-1.5 transition-all hover:opacity-70 active:scale-95 cursor-pointer
          bg-transparent border-none ${className}
        `}
        title={`${label} · Clic para ver detalle`}
      >
        <span className={cond.text}>{cond.icon}</span>
        <span className={`text-[10px] font-black leading-none ${cond.text}`}>{label}</span>
      </button>

      {drawerOpen && mounted && (
        <ClimateDetailDrawer
          mode={mode}
          entityName={entityName}
          grassGrowthRate={grassGrowthRate}
          ndvi={ndvi}
          waterBalance={waterBalance}
          cond={cond}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  )
}
