'use client'

/**
 * GanttClimateMonthRow
 *
 * Fila única que reemplaza "Resumen (kg/ha)" + "Clima (chips por potrero)".
 * Organizada por columnas de mes — igual que el Gantt.
 *
 * Por mes muestra:
 *   - Ícono climático estacional
 *   - Crecimiento ajustado por clima (kg/ha/d)
 *   - Δ días neto para los planes de ese mes
 *   - Ajuste de consumo animal (THI)
 *
 * Clic → drawer con detalle del mes + botón "Aplicar al Plan Modificado"
 */

import React, { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Sun, Cloud, CloudRain, CloudSnow, Wind,
  Leaf, Users, X, TrendingDown, TrendingUp, Minus,
  AlertTriangle, CheckCircle2, ArrowRight, ChevronRight,
  Thermometer, Droplets, BarChart3,
} from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MonthMeta {
  key: string        // e.g. "2025-06"
  month: number      // 0-11
  label?: string     // "Jun" — optional, derived from key if absent
  leftPct: number
  widthPct: number
  startDate?: string
  endDate?: string
}

export interface PlanInMonth {
  id: string
  paddockName: string
  paddockId: string
  baseDays: number
  climateMultiplier: number   // from paddockCAdj
  areaHa: number
  isPlanModified: boolean     // false = locked original, true = can apply
}

export interface HerdInMonth {
  id: string
  name: string
  headCount: number
  totalEv: number
}

interface Props {
  months: MonthMeta[]
  plansPerMonth: Record<string, PlanInMonth[]>  // key = "YYYY-MM"
  herdsPerMonth: Record<string, HerdInMonth[]>
  growthPerMonth: Record<string, number>         // kg/ha/d base (before climate)
  rainfallPerMonth: Record<string, number>       // mm registered
  seasonalMult: Record<number, number>           // SEASONAL_MS_GROWTH
  labelW: number
  totalHa: number
  totalMs: number
  climateEnabled: boolean
  onApplyMonthAdjustment?: (monthKey: string, adjustments: { planId: string; newDays: number }[]) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function thiIndex(tempC: number, humPct: number) {
  const dp = tempC - (100 - humPct) / 5
  return tempC + 0.36 * dp + 41.5
}

type Season = 'summer' | 'autumn' | 'winter' | 'spring'
function getSeason(month: number): Season {
  if ([11, 0, 1].includes(month))  return 'summer'
  if ([2, 3, 4].includes(month))   return 'autumn'
  if ([5, 6, 7].includes(month))   return 'winter'
  return 'spring'
}

function getSeasonIcon(season: Season, rainMm: number, mult: number) {
  if (mult <= 0.3) return <CloudSnow className="w-3 h-3 text-sky-500" />
  if (rainMm > 20) return <CloudRain className="w-3 h-3 text-blue-500" />
  if (season === 'winter') return <Cloud className="w-3 h-3 text-gray-400" />
  if (season === 'summer') return <Sun className="w-3 h-3 text-amber-500" />
  return <Cloud className="w-3 h-3 text-emerald-400" />
}

function getGrowthColor(mult: number): string {
  if (mult <= 0.3)  return '#94a3b8' // frost/stop
  if (mult <= 0.7)  return '#d97706' // slow
  if (mult >= 1.2)  return '#16a34a' // optimal
  return '#22c55e'
}

function getGrowthLabel(mult: number): string {
  if (mult <= 0.1) return 'Detenido'
  if (mult <= 0.5) return 'Lento'
  if (mult <= 0.9) return 'Moderado'
  if (mult <= 1.2) return 'Óptimo'
  return 'Excelente'
}

// ── Monthly Drawer ─────────────────────────────────────────────────────────────

interface DrawerProps {
  monthLabel: string
  monthKey: string
  plans: PlanInMonth[]
  herds: HerdInMonth[]
  growthKgHa: number
  growthMult: number
  rainMm: number
  consumptionAdj: number
  energyAdj: number
  thi: number
  onClose: () => void
  onApply?: (adjustments: { planId: string; newDays: number }[]) => void
}

function MonthDrawer({
  monthLabel, monthKey, plans, herds,
  growthKgHa, growthMult, rainMm,
  consumptionAdj, energyAdj, thi,
  onClose, onApply,
}: DrawerProps) {
  const [applied, setApplied] = useState(false)
  const growthColor = getGrowthColor(growthMult)
  const growthLabel = getGrowthLabel(growthMult)

  const adjustments = plans
    .filter(p => p.isPlanModified && p.climateMultiplier !== 1.0)
    .map(p => ({
      planId: p.id,
      newDays: Math.max(1, Math.round(p.baseDays * p.climateMultiplier)),
    }))

  const totalDelta = plans.reduce((s, p) => {
    const adj = Math.max(1, Math.round(p.baseDays * p.climateMultiplier))
    return s + (adj - p.baseDays)
  }, 0)

  const canApply = !applied && adjustments.length > 0

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-sm bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-black text-gray-900">Clima · {monthLabel}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              Crecimiento · Consumo · Impacto en planificación
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* KPIs del mes */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Crecimiento</p>
              <p className="text-lg font-black leading-none" style={{ color: growthColor }}>
                {growthKgHa > 0 ? growthKgHa : '—'}
              </p>
              <p className="text-[9px] text-gray-400 font-medium mt-0.5">kg/ha/d</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${totalDelta < 0 ? 'bg-red-50 border-red-100' : totalDelta > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Δ Días</p>
              <p className={`text-lg font-black leading-none ${totalDelta < 0 ? 'text-red-600' : totalDelta > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {totalDelta > 0 ? '+' : ''}{totalDelta}
              </p>
              <p className="text-[9px] text-gray-400 font-medium mt-0.5">vs plan base</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${consumptionAdj < 0 ? 'bg-orange-50 border-orange-100' : energyAdj > 0 ? 'bg-sky-50 border-sky-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Consumo</p>
              <p className={`text-lg font-black leading-none ${consumptionAdj < 0 ? 'text-orange-600' : energyAdj > 0 ? 'text-sky-600' : 'text-emerald-600'}`}>
                {consumptionAdj < 0 ? `${consumptionAdj}%` : energyAdj > 0 ? `+${energyAdj}%` : 'OK'}
              </p>
              <p className="text-[9px] text-gray-400 font-medium mt-0.5">animal</p>
            </div>
          </div>

          {/* Estado del pasto */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <Leaf className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Crecimiento de Pasto</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Estado estacional</span>
                <span className="font-black" style={{ color: growthColor }}>{growthLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Multiplicador</span>
                <span className="font-black text-gray-700">×{growthMult.toFixed(2)}</span>
              </div>
              {rainMm > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Lluvia registrada</span>
                  <span className="font-black text-blue-600">{rainMm} mm</span>
                </div>
              )}
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, growthMult * 60)}%`, backgroundColor: growthColor }}
                />
              </div>
            </div>
          </div>

          {/* Planes de este mes */}
          {plans.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Potreros planificados en {monthLabel}
              </p>
              <div className="space-y-1.5">
                {plans.map(p => {
                  const adjDays = Math.max(1, Math.round(p.baseDays * p.climateMultiplier))
                  const delta = adjDays - p.baseDays
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs ${p.isPlanModified ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-70'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 truncate">{p.paddockName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-gray-400">{p.baseDays}d base</span>
                          {delta !== 0 && (
                            <>
                              <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                              <span className={`text-[9px] font-black ${delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {adjDays}d ({delta > 0 ? '+' : ''}{delta}d)
                              </span>
                            </>
                          )}
                          {!p.isPlanModified && (
                            <span className="text-[8px] text-gray-400 bg-gray-100 px-1 rounded">bloqueado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bienestar animal */}
          {herds.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Rodeos en {monthLabel}
              </p>
              <div className="space-y-1.5">
                {herds.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-xs">
                    <div>
                      <p className="font-black text-gray-800">{h.name}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">{h.headCount} cab. · {h.totalEv.toFixed(1)} EV</p>
                    </div>
                    <div className="text-right">
                      {consumptionAdj < 0 ? (
                        <>
                          <p className="font-black text-orange-600">{consumptionAdj}%</p>
                          <p className="text-[9px] text-gray-400">consumo</p>
                        </>
                      ) : energyAdj > 0 ? (
                        <>
                          <p className="font-black text-sky-600">+{energyAdj}%</p>
                          <p className="text-[9px] text-gray-400">energía</p>
                        </>
                      ) : (
                        <p className="font-black text-emerald-600">Normal</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interpretación */}
          {totalDelta !== 0 && (
            <div className={`rounded-2xl border p-4 ${totalDelta < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${totalDelta < 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                <p className={`text-[11px] font-medium leading-relaxed ${totalDelta < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {totalDelta < 0
                    ? `El clima reduce la oferta en ${monthLabel}: los potreros planificados durarán ${Math.abs(totalDelta)} día(s) menos. Considerá ajustar las estadías en el plan modificado.`
                    : `Condiciones favorables en ${monthLabel}: el pasto crece más de lo habitual. Podés extender las estadías o dejar descansar más potreros.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — CTA aplicar */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {canApply ? (
            <button
              onClick={() => {
                onApply?.(adjustments)
                setApplied(true)
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aplicar ajuste al Plan Modificado
            </button>
          ) : applied ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs font-black text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Ajuste aplicado
            </div>
          ) : (
            <p className="text-[10px] text-center text-gray-400 font-medium py-1">
              {adjustments.length === 0
                ? 'Sin cambios necesarios para este mes'
                : 'Solo se puede aplicar al Plan Modificado (no al original bloqueado)'}
            </p>
          )}
          <button onClick={onClose} className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors py-1">
            Cerrar
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GanttClimateMonthRow({
  months, plansPerMonth, herdsPerMonth, growthPerMonth,
  rainfallPerMonth, seasonalMult, labelW,
  totalHa, totalMs, climateEnabled,
  onApplyMonthAdjustment,
}: Props) {
  const { current } = useWeather()
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const { thi, consumptionAdj, energyAdj } = useMemo(() => {
    if (!current) return { thi: 65, consumptionAdj: 0, energyAdj: 0 }
    const thi = thiIndex(current.tempC, current.humidityPct)
    const consumptionAdj = thi > 72 ? Math.round(Math.min(25, (thi - 72) * 1.2) * -1) : 0
    const coldStress = current.tempC < 8 || (current.tempC < 12 && current.windSpeedKmh > 20)
    const energyAdj = coldStress
      ? Math.round((Math.min(0.12, current.windSpeedKmh / 300) + (current.tempC < 5 ? 0.15 : 0.08)) * 100)
      : 0
    return { thi, consumptionAdj, energyAdj }
  }, [current])

  const openMonthData = openMonth ? {
    plans: plansPerMonth[openMonth] || [],
    herds: herdsPerMonth[openMonth] || [],
    meta: months.find(m => m.key === openMonth)!,
  } : null

  return (
    <>
      <div
        className="flex border-t bg-white"
        style={{ minHeight: 52, borderColor: climateEnabled ? '#d1fae5' : '#f3f4f6' }}
      >
        {/* Label col */}
        <div
          style={{ width: labelW, minWidth: labelW }}
          className="px-2.5 py-2 flex flex-col justify-center gap-0.5 border-r border-gray-100 shrink-0"
        >
          <div className="flex items-center gap-1 mb-0.5">
            <BarChart3 className="w-3 h-3 text-gray-400" />
            <span className="text-[9px] font-black text-gray-500 tracking-widest uppercase">Resumen</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total</span>
            <span className="text-[9px] font-bold text-gray-700">{totalHa.toFixed(0)} ha</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">MS</span>
            <span className="text-[9px] font-bold text-gray-700">{Math.round(totalMs / 1000).toLocaleString('es')} t</span>
          </div>
          {climateEnabled && (
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Clima activo</span>
            </div>
          )}
        </div>

        {/* Monthly cells */}
        <div className="flex-1 relative">
          {months.map(m => {
            const mult = seasonalMult[m.month] ?? 1.0
            const rain = rainfallPerMonth[m.key] || 0
            const rainBonus = rain > 0 ? Math.min(rain / 100 * 0.2, 0.4) : 0
            const adjMult = mult * (1 + rainBonus)
            const baseGrowth = totalHa > 0 ? (totalMs / totalHa) * adjMult / 12 : 0
            const growthKgHaDay = Math.round(baseGrowth / 30)
            const growthColor = getGrowthColor(adjMult)
            const season = getSeason(m.month)
            const plansInMonth = plansPerMonth[m.key] || []
            const herdsInMonth = herdsPerMonth[m.key] || []

            // Net days delta for this month's planned paddocks
            const deltaForMonth = plansInMonth.reduce((s, p) => {
              const adj = Math.max(1, Math.round(p.baseDays * p.climateMultiplier))
              return s + (adj - p.baseDays)
            }, 0)

            const hasAlert = climateEnabled && (deltaForMonth !== 0 || consumptionAdj < 0 || energyAdj > 0)
            const barPct = Math.min(100, adjMult * 50)

            return (
              <button
                key={m.key}
                onClick={() => setOpenMonth(m.key)}
                className={`absolute inset-y-0 border-r flex flex-col items-center justify-center gap-0.5 px-1 transition-all group ${
                  climateEnabled
                    ? 'hover:bg-emerald-50/60 cursor-pointer border-emerald-100/60'
                    : 'hover:bg-gray-50 cursor-pointer border-gray-100'
                }`}
                style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                title={`${m.label ?? m.key}: ${getGrowthLabel(adjMult)} · Δ${deltaForMonth > 0 ? '+' : ''}${deltaForMonth}d`}
              >
                {/* Row 1: weather icon + growth bar */}
                <div className="flex items-center gap-1 w-full justify-center">
                  {climateEnabled && getSeasonIcon(season, rain, adjMult)}
                  <div className="flex-1 max-w-[70%] h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barPct}%`, backgroundColor: growthColor }}
                    />
                  </div>
                </div>

                {/* Row 2: kg/ha/d */}
                {growthKgHaDay > 0 ? (
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[8px] font-black" style={{ color: growthColor }}>{growthKgHaDay}</span>
                    <span className="text-[6px] text-gray-400 font-bold">kg/ha/d</span>
                  </div>
                ) : (
                  <span className="text-[7px] text-gray-200">—</span>
                )}

                {/* Row 3: climate delta (only if active and has plans) */}
                {climateEnabled && deltaForMonth !== 0 && (
                  <div className={`flex items-center gap-0.5 px-1 rounded text-[7px] font-black ${
                    deltaForMonth < 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'
                  }`}>
                    {deltaForMonth > 0 ? '+' : ''}{deltaForMonth}d
                  </div>
                )}

                {/* Row 4: animal consumption (only if active) */}
                {climateEnabled && (consumptionAdj < 0 || energyAdj > 0) && herdsInMonth.length > 0 && (
                  <div className={`flex items-center gap-0.5 px-1 rounded text-[6px] font-black ${
                    consumptionAdj < 0 ? 'text-orange-600 bg-orange-50' : 'text-sky-600 bg-sky-50'
                  }`}>
                    <Users className="w-2 h-2" />
                    {consumptionAdj < 0 ? `${consumptionAdj}%` : `+${energyAdj}%E`}
                  </div>
                )}

                {/* Hover indicator */}
                {climateEnabled && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Monthly Drawer */}
      {openMonthData && mounted && (
        <MonthDrawer
          monthLabel={openMonthData.meta.label ?? new Date(openMonthData.meta.key + '-01').toLocaleString('es-AR', { month: 'long' })}
          monthKey={openMonth!}
          plans={openMonthData.plans}
          herds={openMonthData.herds}
          growthKgHa={(() => {
            const m = openMonthData.meta
            const mult = seasonalMult[m.month] ?? 1.0
            const rain = rainfallPerMonth[m.key] || 0
            const rainBonus = rain > 0 ? Math.min(rain / 100 * 0.2, 0.4) : 0
            return Math.round(totalHa > 0 ? (totalMs / totalHa) * mult * (1 + rainBonus) / 12 / 30 : 0)
          })()}
          growthMult={(() => {
            const m = openMonthData.meta
            const mult = seasonalMult[m.month] ?? 1.0
            const rain = rainfallPerMonth[m.key] || 0
            const rainBonus = rain > 0 ? Math.min(rain / 100 * 0.2, 0.4) : 0
            return mult * (1 + rainBonus)
          })()}
          rainMm={rainfallPerMonth[openMonth!] || 0}
          consumptionAdj={consumptionAdj}
          energyAdj={energyAdj}
          thi={thi}
          onClose={() => setOpenMonth(null)}
          onApply={adjustments => {
            onApplyMonthAdjustment?.(openMonth!, adjustments)
            setTimeout(() => setOpenMonth(null), 1200)
          }}
        />
      )}
    </>
  )
}
