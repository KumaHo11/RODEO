'use client'

import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Sun, Cloud, CloudRain, CloudSnow,
  Leaf, Users, X, TrendingDown, TrendingUp, Minus,
  AlertTriangle, CheckCircle2, ArrowRight,
  Thermometer, Droplets, BarChart3, Sprout,
} from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'
import { useClimateAnalytics } from '@/lib/context/ClimateAnalyticsContext'
import { getAustralSeason, type AustralSeason } from '@/lib/grazing/forageCurves'

export interface MonthMeta {
  key: string
  month: number
  label?: string
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
  cAdj: number
  aAdj: number
  areaHa: number
  isPlanModified: boolean
}

export interface HerdInMonth {
  id: string
  name: string
  headCount: number
  totalEv: number
}

interface Props {
  months: MonthMeta[]
  plansPerMonth: Record<string, PlanInMonth[]>
  herdsPerMonth: Record<string, HerdInMonth[]>
  growthPerMonth: Record<string, number>
  rainfallPerMonth: Record<string, number>
  seasonalMult: Record<number, number>
  labelW: number
  climateEnabled: boolean
  onApplyMonthAdjustment?: (monthKey: string, adjustments: { planId: string; newDays: number }[]) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function thiIndex(tempC: number, humPct: number) {
  const dp = tempC - (100 - humPct) / 5
  return tempC + 0.36 * dp + 41.5
}

// getAustralSeason importado desde lib/grazing/forageCurves.ts
// Mapa de estación austral → ícono de clima
function getSeasonIcon(season: AustralSeason, rainMm: number, mult: number) {
  if (mult <= 0.3) return <CloudSnow className="w-3 h-3 text-sky-500" />
  if (rainMm > 20) return <CloudRain className="w-3 h-3 text-blue-500" />
  if (season === 'INVIERNO') return <Cloud className="w-3 h-3 text-gray-400" />
  if (season === 'VERANO')   return <Sun className="w-3 h-3 text-amber-500" />
  return <Cloud className="w-3 h-3 text-emerald-400" />
}

function getGrowthColor(mult: number): string {
  if (mult <= 0.1)  return '#dc2626' // seqía crítica — rojo
  if (mult <= 0.7)  return '#9ca3af' // estancamiento/lento — gris
  if (mult >= 1.2)  return '#16a34a' // excelente — verde oscuro
  return '#22c55e'                    // óptimo — verde
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
  monthLabel, plans, herds,
  growthKgHa, growthMult, rainMm,
  consumptionAdj, energyAdj,
  onClose, onApply,
}: DrawerProps) {
  const [applied, setApplied] = useState(false)
  const growthColor = getGrowthColor(growthMult)
  const growthLabel = getGrowthLabel(growthMult)

  const adjustments = plans
    .filter(p => p.isPlanModified && p.aAdj !== 1.0)
    .map(p => ({
      planId: p.id,
      newDays: Math.max(1, Math.round(p.baseDays / p.aAdj)),
    }))

  const totalDelta = plans.reduce((s, p) => {
    const adj = Math.max(1, Math.round(p.baseDays / p.aAdj))
    return s + (adj - p.baseDays)
  }, 0)

  const canApply = !applied && adjustments.length > 0

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-sm bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-black text-gray-900">Ajuste por Clima · {monthLabel}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Pasto · Animal · Impacto en planificación</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Pasto</p>
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
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Animal</p>
              <p className={`text-lg font-black leading-none ${consumptionAdj < 0 ? 'text-orange-600' : energyAdj > 0 ? 'text-sky-600' : 'text-emerald-600'}`}>
                {consumptionAdj < 0 ? `${consumptionAdj}%` : energyAdj > 0 ? `+${energyAdj}%` : 'OK'}
              </p>
              <p className="text-[9px] text-gray-400 font-medium mt-0.5">consumo</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <Sprout className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Ajuste de Pasto</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Estado estacional</span>
                <span className="font-black" style={{ color: growthColor }}>{growthLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Multiplicador global estacional</span>
                <span className="font-black text-gray-700">×{growthMult.toFixed(2)}</span>
              </div>
              {rainMm > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Lluvia registrada</span>
                  <span className="font-black text-blue-600">{rainMm} mm</span>
                </div>
              )}
              <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, growthMult * 60)}%`, backgroundColor: growthColor }} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <Thermometer className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Ajuste Animal</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {consumptionAdj < 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Variación consumo (calor)</span>
                    <span className="font-black text-orange-600">{consumptionAdj}%</span>
                  </div>
                  <p className="text-[10px] text-orange-500 bg-orange-50 rounded-lg px-3 py-2">
                    Estrés calórico. El animal reduce su consumo voluntario de MS.
                  </p>
                </>
              ) : energyAdj > 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Demanda energética (frío)</span>
                    <span className="font-black text-sky-600">+{energyAdj}%</span>
                  </div>
                  <p className="text-[10px] text-sky-600 bg-sky-50 rounded-lg px-3 py-2">
                    Estrés frío. El animal incrementa su consumo para mantener temperatura.
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Consumo</span>
                  <span className="font-black text-emerald-600">Normal — sin penalidad</span>
                </div>
              )}
            </div>
          </div>

          {plans.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Potreros planificados</p>
              <div className="space-y-1.5">
                {plans.map(p => {
                  const adjDays = Math.max(1, Math.round(p.baseDays / p.aAdj))
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
                          {!p.isPlanModified && <span className="text-[8px] text-gray-400 bg-gray-100 px-1 rounded">bloqueado</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[9px] text-gray-500 font-medium">
                          <span title="Multiplicador Crecimiento Pasto">Pasto: <span className="text-gray-700 font-black">×{p.cAdj.toFixed(2)}</span></span>
                          <span title="Multiplicador Demanda Animal">Animal: <span className="text-gray-700 font-black">×{p.aAdj.toFixed(2)}</span></span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {totalDelta !== 0 && (
            <div className={`rounded-2xl border p-4 ${totalDelta < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${totalDelta < 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                <p className={`text-[11px] font-medium leading-relaxed ${totalDelta < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {totalDelta < 0
                    ? `El clima reduce la oferta: los potreros planificados durarán ${Math.abs(totalDelta)} día(s) menos. Considerá ajustar las estadías en el plan modificable.`
                    : `Condiciones favorables: el pasto crece más de lo habitual. Podés extender estadías o dejar descansar más potreros.`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {canApply ? (
            <button
              onClick={() => { onApply?.(adjustments); setApplied(true) }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aplicar ajuste al Plan Modificable
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
                : 'Solo se puede aplicar al Plan Modificable (no al original bloqueado)'}
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
  months, plansPerMonth, herdsPerMonth,
  rainfallPerMonth, seasonalMult, labelW,
  climateEnabled,
  onApplyMonthAdjustment,
}: Props) {
  const { current } = useWeather()
  const { avgGrowthRate } = useClimateAnalytics()
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

  // Standard daily ration per EV (20 kg MS/EV/day is the base)
  const STANDARD_RATION_KG = 20

  // Calcular delta real en kg para el ajuste animal
  const animalDeltaKg = consumptionAdj < 0
    ? Math.round(STANDARD_RATION_KG * (consumptionAdj / 100))   // negativo (calor)
    : energyAdj > 0
    ? Math.round(STANDARD_RATION_KG * (energyAdj / 100))         // positivo (frío)
    : 0
  const animalTotalKg = STANDARD_RATION_KG + animalDeltaKg

  // Anchor future predictions on the CURRENT real average growth rate
  const currentMonthKey = new Date().toISOString().substring(0, 7)
  const currentMonthIdx = new Date().getMonth()
  const currentRain = rainfallPerMonth[currentMonthKey] || 0
  const currentRainBonus = currentRain > 0 ? Math.min(currentRain / 100 * 0.2, 0.4) : 0
  const currentAdjMult = (seasonalMult[currentMonthIdx] ?? 1.0) * (1 + currentRainBonus)
  const annualBaseDaily = currentAdjMult > 0 ? avgGrowthRate / currentAdjMult : avgGrowthRate

  return (
    <>
      <div
        className="flex border-t bg-white"
        style={{ minHeight: 60, borderColor: climateEnabled ? '#d1fae5' : '#f3f4f6' }}
      >
          {/* Label col */}
          <div
            style={{ width: labelW, minWidth: labelW }}
            className={`px-2.5 py-2 flex flex-col justify-center gap-1 border-r shrink-0 sticky left-0 z-10 transition-colors ${climateEnabled ? 'bg-white border-gray-100' : 'bg-gray-50/60 border-gray-100'}`}
          >
            <span className={`text-[9px] font-black tracking-widest uppercase transition-colors ${climateEnabled ? 'text-gray-500' : 'text-gray-300'}`}>Ajuste por clima</span>
            {/* Sub-labels */}
            <div className="flex flex-col gap-0.5 pl-0.5">
              <div className="flex items-center gap-1">
                <Sprout className={`w-2.5 h-2.5 transition-colors ${climateEnabled ? 'text-emerald-400' : 'text-gray-300'}`} />
                <span className={`text-[8px] font-semibold transition-colors ${climateEnabled ? 'text-gray-400' : 'text-gray-300'}`}>Pasto</span>
              </div>
              <div className="flex items-center gap-1">
                <Thermometer className={`w-2.5 h-2.5 transition-colors ${climateEnabled ? 'text-orange-400' : 'text-gray-300'}`} />
                <span className={`text-[8px] font-semibold transition-colors ${climateEnabled ? 'text-gray-400' : 'text-gray-300'}`}>Animal</span>
              </div>
            </div>
          </div>

        {/* Monthly cells */}
        <div className="flex-1 relative">
          {months.map(m => {
            const mult = seasonalMult[m.month] ?? 1.0
            const rain = rainfallPerMonth[m.key] || 0
            const rainBonus = rain > 0 ? Math.min(rain / 100 * 0.2, 0.4) : 0
            const adjMult = mult * (1 + rainBonus)
            const growthKgHaDay = Math.round(annualBaseDaily * adjMult)
            const growthColor = climateEnabled ? getGrowthColor(adjMult) : '#d1d5db'

            // Flecha de tendencia — gris cuando está desactivado
            const isGrowth   = adjMult >= 1.0
            const isDrought  = adjMult <= 0.1
            const TrendIcon = climateEnabled
              ? isGrowth
                ? <TrendingUp className="w-3 h-3 shrink-0" style={{ color: growthColor }} />
                : isDrought
                ? <TrendingDown className="w-3 h-3 shrink-0" style={{ color: growthColor }} />
                : <Minus className="w-3 h-3 shrink-0" style={{ color: '#9ca3af' }} />
              : <Minus className="w-3 h-3 shrink-0 text-gray-300" />

            // Colores animal — gris cuando desactivado
            const hasHeatStress = climateEnabled && consumptionAdj < 0
            const hasColdStress = climateEnabled && energyAdj > 0
            const animalColor = hasHeatStress ? '#dc2626' : hasColdStress ? '#f97316' : climateEnabled ? '#16a34a' : '#d1d5db'

            const animalLine = climateEnabled
              ? (hasHeatStress || hasColdStress
                  ? `${hasHeatStress ? '' : '+'}${animalDeltaKg} kg → ${animalTotalKg} kg`
                  : `${STANDARD_RATION_KG} kg`)
              : '—'

            const animalTitle = climateEnabled
              ? (hasHeatStress
                  ? `Estrés calor: −${Math.abs(animalDeltaKg)} kg (${animalTotalKg} kg/día)`
                  : hasColdStress
                  ? `Estrés frío: +${animalDeltaKg} kg (${animalTotalKg} kg/día)`
                  : `Confort: ${STANDARD_RATION_KG} kg/día`)
              : 'Ajuste climático desactivado'

            return (
              <button
                key={m.key}
                onClick={() => climateEnabled && setOpenMonth(m.key)}
                className={`absolute inset-y-0 border-r flex flex-col justify-center px-1.5 py-1 transition-all group ${
                  climateEnabled
                    ? 'hover:bg-emerald-50/60 cursor-pointer border-emerald-100/60 bg-white'
                    : 'cursor-default border-gray-100 bg-gray-50/30'
                }`}
                style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                title={`${m.label ?? m.key}: ${climateEnabled ? getGrowthLabel(adjMult) + ' · ' + animalTitle : 'Desactivado'}`}
              >
                {/* Sub-fila A — Ajuste Pasto */}
                <div className="flex items-center gap-0.5 w-full">
                  {TrendIcon}
                  {climateEnabled && growthKgHaDay > 0 ? (
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[9px] font-black leading-none tabular-nums" style={{ color: growthColor }}>
                        {growthKgHaDay}
                      </span>
                      <span className="text-[6px] text-gray-400 font-bold">kg/ha/d</span>
                    </div>
                  ) : (
                    <span className="text-[8px] font-black text-gray-300">—</span>
                  )}
                </div>

                {/* Separador */}
                <div className="w-full border-t border-gray-100 my-0.5" />

                {/* Sub-fila B — Ajuste Animal */}
                <div className="flex items-center gap-0.5 w-full">
                  <Thermometer className="w-2.5 h-2.5 shrink-0" style={{ color: animalColor }} />
                  <span className="text-[8px] font-black leading-none tabular-nums truncate" style={{ color: animalColor }}>
                    {animalLine}
                  </span>
                </div>

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
            return Math.round(annualBaseDaily * mult * (1 + rainBonus))
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
