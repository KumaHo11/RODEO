'use client'

/**
 * HerdWeatherPanel — Panel de clima y bienestar THI para un rodeo.
 *
 * Consume useWeather() (WeatherContext ya existente en la app).
 * - Condiciones actuales: Temp, Humedad, Viento
 * - THI calculado con la fórmula estándar: THI = T + 0.36·Td + 41.5
 *   donde Td = punto de rocío = T - (100 - RH) / 5
 * - Estado de bienestar: Confort / Alerta / Peligro
 * - Ajuste de consumo estimado
 * - Pronóstico 3 días
 */

import React, { useMemo } from 'react'
import clsx from 'clsx'
import { Thermometer, Droplets, Wind, Leaf, CloudSun, Sun, Cloud, CloudRain } from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'

// ── THI calculation ────────────────────────────────────────────────────────────

interface THIResult {
  thi:        number
  status:     'confort' | 'alerta' | 'peligro' | 'sin_datos'
  label:      string
  color:      string
  bgColor:    string
  adjustment: string    // Texto del ajuste de consumo
  adjPct:     number    // % ajuste numérico (0 = sin ajuste, -10 = -10%)
}

function calcTHI(tempC: number, humidityPct: number): THIResult {
  // Punto de rocío (Td) por aproximación de August-Roche-Magnus
  const Td  = tempC - ((100 - humidityPct) / 5)
  const thi = parseFloat((tempC + 0.36 * Td + 41.5).toFixed(1))

  if (thi < 68) return {
    thi, status: 'confort', label: 'Confort',
    color: 'text-green-700', bgColor: 'bg-green-50 border-green-200',
    adjustment: 'Sin ajuste de consumo — Confort térmico', adjPct: 0,
  }
  if (thi < 72) return {
    thi, status: 'alerta', label: 'Alerta leve',
    color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200',
    adjustment: 'Caída estimada del 5% por estrés calórico leve', adjPct: -5,
  }
  if (thi < 78) return {
    thi, status: 'alerta', label: 'Alerta moderada',
    color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200',
    adjustment: 'Caída estimada del 10% por estrés calórico', adjPct: -10,
  }
  return {
    thi, status: 'peligro', label: 'Peligro — estrés severo',
    color: 'text-red-700', bgColor: 'bg-red-50 border-red-200',
    adjustment: 'Caída del 15–20% del consumo — revisar aguadas y sombra', adjPct: -15,
  }
}

function getForecastIcon(condition: string | undefined) {
  if (!condition) return Sun
  const c = condition.toUpperCase()
  if (c.includes('RAIN') || c.includes('STORM')) return CloudRain
  if (c.includes('CLOUD'))  return Cloud
  if (c.includes('PARTLY')) return CloudSun
  return Sun
}

interface HerdWeatherPanelProps {
  msDay: number  // Consumo base MS del rodeo (kg/día), para proyectar ajuste
}

export function HerdWeatherPanel({ msDay }: HerdWeatherPanelProps) {
  const { current, forecast, isLoading } = useWeather()

  const thiResult: THIResult = useMemo(() => {
    if (!current) return {
      thi: 0, status: 'sin_datos', label: 'Sin datos',
      color: 'text-gray-400', bgColor: 'bg-gray-50 border-gray-200',
      adjustment: 'Sin datos climáticos disponibles', adjPct: 0,
    }
    return calcTHI(current.tempC, current.humidityPct)
  }, [current])

  const adjustedMS = msDay + Math.round(msDay * thiResult.adjPct / 100)

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* ── Condiciones actuales ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Thermometer className="w-3.5 h-3.5 text-orange-500" />
          Condiciones actuales
        </p>

        {current ? (
          <div className="grid grid-cols-3 gap-3">
            {/* Temperatura */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
              <Thermometer className="w-4 h-4 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-black text-orange-900 tabular-nums">{current.tempC.toFixed(1)}°</p>
              <p className="text-[9px] font-bold text-orange-600 uppercase">Temperatura</p>
            </div>
            {/* Humedad */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <Droplets className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <p className="text-xl font-black text-blue-900 tabular-nums">{current.humidityPct}%</p>
              <p className="text-[9px] font-bold text-blue-600 uppercase">Humedad</p>
            </div>
            {/* Viento */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <Wind className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xl font-black text-gray-700 tabular-nums">
                {current.windSpeedKmh !== undefined ? `${Math.round(current.windSpeedKmh)}` : '—'}
              </p>
              <p className="text-[9px] font-bold text-gray-500 uppercase">km/h viento</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic text-center py-3">Sin datos climáticos</p>
        )}
      </div>

      {/* ── Bienestar animal (THI) ───────────────────────────────────────── */}
      <div className={clsx('rounded-2xl border p-5', thiResult.bgColor)}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-emerald-500" />
              Bienestar del rodeo — THI
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              Índice de Temperatura y Humedad (Temperatura-Humidity Index)
            </p>
          </div>
          {/* Badge de estado */}
          <div className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-black border', thiResult.bgColor, thiResult.color)}>
            {thiResult.label}
          </div>
        </div>

        {/* Valor THI */}
        <div className="flex items-center gap-6 mb-3">
          <div>
            <p className={clsx('text-3xl font-black tabular-nums', thiResult.color)}>
              {thiResult.status !== 'sin_datos' ? thiResult.thi.toFixed(1) : '—'}
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase">Índice THI</p>
          </div>
          <div className="flex-1">
            {/* Barra de escala */}
            <div className="h-2 rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-500 relative">
              {thiResult.status !== 'sin_datos' && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-700 shadow"
                  style={{ left: `${Math.min(100, Math.max(0, ((thiResult.thi - 50) / 50) * 100))}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-[8px] font-bold text-gray-400 mt-1">
              <span>50 — Confort</span>
              <span>72 — Alerta</span>
              <span>78 — Peligro</span>
            </div>
          </div>
        </div>

        {/* Ajuste de consumo */}
        <div className="bg-white/70 rounded-xl p-3 border border-white">
          <p className="text-[10px] font-black text-gray-600 mb-1">Ajuste de Consumo MS</p>
          <p className={clsx('text-xs font-bold', thiResult.color)}>{thiResult.adjustment}</p>
          {thiResult.adjPct !== 0 && msDay > 0 && (
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              Consumo estimado ajustado:{' '}
              <span className="font-black text-gray-700">{adjustedMS.toLocaleString('es-AR')} kg MS/día</span>
              {' '}(base: {msDay.toLocaleString('es-AR')} kg/día)
            </p>
          )}
        </div>
      </div>

      {/* ── Pronóstico 3 días ────────────────────────────────────────────── */}
      {forecast && forecast.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <CloudSun className="w-3.5 h-3.5 text-blue-400" />
            Pronóstico 3 días
          </p>
          <div className="grid grid-cols-3 gap-2">
            {forecast.slice(0, 3).map((day, i) => {
              const FIcon  = getForecastIcon(day.condition)
              const dayTHI = (day.maxTempC !== undefined && day.humidityPct !== undefined)
                ? calcTHI(day.maxTempC, day.humidityPct)
                : null
              return (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1.5">
                    {i === 0 ? 'Mañana' : i === 1 ? 'Pasado' : `Día ${i + 1}`}
                  </p>
                  <FIcon className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                  <p className="text-sm font-black text-gray-800 tabular-nums">
                    {day.maxTempC !== undefined ? `${Math.round(day.maxTempC)}°` : '—'}
                  </p>
                  {day.minTempC !== undefined && (
                    <p className="text-[9px] font-bold text-gray-400 tabular-nums">{Math.round(day.minTempC)}°</p>
                  )}
                  {dayTHI && dayTHI.status !== 'sin_datos' && (
                    <div className={clsx('mt-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black border', dayTHI.bgColor, dayTHI.color)}>
                      THI {dayTHI.thi.toFixed(0)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
