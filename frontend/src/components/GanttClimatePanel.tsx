'use client'

/**
 * GanttClimatePanel
 *
 * Fila compacta dentro del Gantt que muestra:
 *   - Un chip por potrero: ícono climático + crecimiento (kg/ha/d)
 *   - Un chip por rodeo: ícono climático + bienestar (THI / confort)
 *
 * Al hacer clic → drawer lateral con:
 *   - Días afectados por potrero (plan base vs ajustado)
 *   - Ajuste de demanda animal por THI
 *   - Botón "Aplicar ajuste al plan"
 */

import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Sun, Cloud, CloudRain, CloudSnow, Wind, Leaf, Users,
  X, TrendingDown, TrendingUp, Minus, ChevronRight,
  AlertTriangle, CheckCircle2, Thermometer, Droplets, ArrowRight,
} from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PaddockClimateInfo {
  id: string
  name: string
  areaHa: number
  climateMultiplier: number   // 1.0 = sin ajuste, <1 = menos días, >1 = más días
  baseDays: number
  adjustedDays: number
  growthRate?: number          // kg MS/ha/d
}

export interface HerdClimateInfo {
  id: string
  name: string
  headCount: number
  totalEv: number
}

interface Props {
  paddocks: PaddockClimateInfo[]
  herds: HerdClimateInfo[]
  climateEnabled: boolean
  onApplyAdjustment?: (paddockId: string, newDays: number) => void
  /** Width of the label column (same as LABEL_W in grazing page) */
  labelW: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcTHI(tempC: number, humPct: number) {
  const dp = tempC - (100 - humPct) / 5
  return parseFloat((tempC + 0.36 * dp + 41.5).toFixed(1))
}

type CondCode = 'SUNNY' | 'RAINY' | 'FROST' | 'WINDY' | 'CLOUDY'

function getCondition(tempC: number, windKmh: number, wmoCode: number): CondCode {
  if (tempC <= 2)                   return 'FROST'
  if (wmoCode >= 51 && wmoCode <= 99) return 'RAINY'
  if (windKmh > 50)                 return 'WINDY'
  if (wmoCode >= 2)                 return 'CLOUDY'
  return 'SUNNY'
}

const COND_ICON: Record<CondCode, React.ReactNode> = {
  SUNNY:  <Sun       className="w-3 h-3" />,
  RAINY:  <CloudRain className="w-3 h-3" />,
  FROST:  <CloudSnow className="w-3 h-3" />,
  WINDY:  <Wind      className="w-3 h-3" />,
  CLOUDY: <Cloud     className="w-3 h-3" />,
}

const GROWTH_LABEL: Record<CondCode, string> = {
  SUNNY:  'Óptimo',
  RAINY:  'Activo',
  FROST:  'Detenido',
  WINDY:  'Reducido',
  CLOUDY: 'Lento',
}

const GROWTH_COLOR: Record<CondCode, string> = {
  SUNNY:  'text-emerald-700 bg-emerald-50 border-emerald-100',
  RAINY:  'text-blue-700 bg-blue-50 border-blue-100',
  FROST:  'text-sky-700 bg-sky-50 border-sky-100',
  WINDY:  'text-gray-600 bg-gray-50 border-gray-100',
  CLOUDY: 'text-amber-700 bg-amber-50 border-amber-100',
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

function ClimateDrawer({
  paddocks, herds, cond, thi, consumptionAdj, energyAdj,
  onClose, onApply,
}: {
  paddocks: PaddockClimateInfo[]
  herds: HerdClimateInfo[]
  cond: CondCode
  thi: number
  consumptionAdj: number
  energyAdj: number
  onClose: () => void
  onApply?: (paddockId: string, days: number) => void
}) {
  const [applied, setApplied] = useState<Set<string>>(new Set())

  const affectedPaddocks = paddocks.filter(p => p.adjustedDays !== p.baseDays)
  const totalDeltaDays   = paddocks.reduce((s, p) => s + (p.adjustedDays - p.baseDays), 0)

  const handleApply = (p: PaddockClimateInfo) => {
    onApply?.(p.id, p.adjustedDays)
    setApplied(prev => new Set([...prev, p.id]))
  }

  const thiColor = thi > 80 ? 'text-red-600' : thi > 72 ? 'text-orange-600' : 'text-emerald-600'
  const thiLabel = thi > 80 ? 'Estrés severo' : thi > 72 ? 'Estrés moderado' : 'Confort'

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-sm bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-900">Impacto Climático · Planificador</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                {affectedPaddocks.length > 0 ? `${affectedPaddocks.length} potrero${affectedPaddocks.length > 1 ? 's' : ''} afectado${affectedPaddocks.length > 1 ? 's' : ''}` : 'Sin ajustes necesarios'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Resumen de impacto global */}
          <div className={`rounded-2xl border p-4 ${totalDeltaDays < 0 ? 'bg-red-50 border-red-100' : totalDeltaDays > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Impacto total en planificación</p>
            <div className="flex items-end gap-2">
              {totalDeltaDays < 0
                ? <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
                : totalDeltaDays > 0
                ? <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />
                : <Minus className="w-5 h-5 text-gray-400 shrink-0" />}
              <p className={`text-2xl font-black leading-none ${totalDeltaDays < 0 ? 'text-red-700' : totalDeltaDays > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                {totalDeltaDays > 0 ? '+' : ''}{totalDeltaDays} días
              </p>
              <p className="text-xs text-gray-400 font-medium pb-0.5">vs. plan base</p>
            </div>
            <p className="text-[10px] text-gray-500 font-medium mt-2">
              {totalDeltaDays < 0
                ? 'El clima reduce la oferta forrajera. Considerá acortar las estadías o mover animales antes.'
                : totalDeltaDays > 0
                ? 'Buenas condiciones. El pasto crece más de lo esperado — podés extender las estadías.'
                : 'El clima no afecta el plan actual.'}
            </p>
          </div>

          {/* Potreros afectados */}
          {paddocks.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Potreros · Crecimiento <span className="text-emerald-600">({GROWTH_LABEL[cond]})</span>
              </p>
              <div className="space-y-2">
                {paddocks.map(p => {
                  const delta = p.adjustedDays - p.baseDays
                  const isApplied = applied.has(p.id)
                  return (
                    <div key={p.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400">{p.baseDays}d base</span>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <span className={`text-[10px] font-black ${delta < 0 ? 'text-red-600' : delta > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {p.adjustedDays}d ajustado
                          </span>
                          {delta !== 0 && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${delta < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {delta > 0 ? '+' : ''}{delta}d
                            </span>
                          )}
                        </div>
                        {p.growthRate != null && (
                          <p className="text-[9px] text-gray-400 mt-0.5">{p.growthRate.toFixed(1)} kg MS/ha/d</p>
                        )}
                      </div>
                      {delta !== 0 && !isApplied && (
                        <button
                          onClick={() => handleApply(p)}
                          className="shrink-0 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Aplicar
                        </button>
                      )}
                      {isApplied && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rodeos — bienestar animal */}
          {herds.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Rodeos · Bienestar <span className={thiColor}>({thiLabel})</span>
              </p>
              <div className="space-y-2">
                {herds.map(h => (
                  <div key={h.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-gray-800">{h.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{h.headCount} cab. · {h.totalEv.toFixed(1)} EV</p>
                      </div>
                      <div className="text-right">
                        {consumptionAdj < 0 ? (
                          <>
                            <p className="text-xs font-black text-red-600">{consumptionAdj}%</p>
                            <p className="text-[9px] text-gray-400">consumo</p>
                          </>
                        ) : energyAdj > 0 ? (
                          <>
                            <p className="text-xs font-black text-sky-600">+{energyAdj}%</p>
                            <p className="text-[9px] text-gray-400">energía</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-black text-emerald-600">Normal</p>
                            <p className="text-[9px] text-gray-400">consumo</p>
                          </>
                        )}
                      </div>
                    </div>
                    {(consumptionAdj < 0 || energyAdj > 0) && (
                      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                        {consumptionAdj < 0
                          ? `THI ${thi} → Estrés calórico. El rodeo consume menos — el pasto puede acumularse más de lo planificado.`
                          : `Frío y viento → Mayor gasto energético. Verificar disponibilidad de forraje adicional.`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendación */}
          {(totalDeltaDays !== 0 || consumptionAdj < 0 || energyAdj > 0) && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-800 mb-1">Recomendación</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    {totalDeltaDays < 0 && consumptionAdj < 0
                      ? 'El clima reduce tanto la oferta de pasto como el consumo animal. El balance puede mantenerse — monitorear diariamente.'
                      : totalDeltaDays < 0
                      ? 'Menos días disponibles por potrero. Ajustá las estadías o redistribuí la carga entre los potreros disponibles.'
                      : consumptionAdj < 0
                      ? 'Los animales consumen menos por calor. El pasto puede alcanzar por más tiempo del planificado.'
                      : 'Condiciones favorables. El plan actual es viable.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <a href="/dashboard/clima?tab=potreros" className="flex items-center justify-center gap-2 text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors">
            Ver ajuste climático completo <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GanttClimatePanel({ paddocks, herds, climateEnabled, onApplyAdjustment, labelW }: Props) {
  const { current, isLoading } = useWeather()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const { cond, thi, consumptionAdj, energyAdj } = useMemo(() => {
    if (!current) return { cond: 'SUNNY' as CondCode, thi: 65, consumptionAdj: 0, energyAdj: 0 }
    const cond = getCondition(current.tempC, current.windSpeedKmh, current.weatherCode)
    const thi  = calcTHI(current.tempC, current.humidityPct)
    const consumptionAdj = thi > 72 ? Math.round(Math.min(25, (thi - 72) * 1.2) * -1) : 0
    const coldStress = current.tempC < 8 || (current.tempC < 12 && current.windSpeedKmh > 20)
    const energyAdj  = coldStress ? Math.round((Math.min(0.12, current.windSpeedKmh / 300) + (current.tempC < 5 ? 0.15 : 0.08)) * 100) : 0
    return { cond, thi, consumptionAdj, energyAdj }
  }, [current])

  // Only show if climate view is enabled and we have data
  if (!climateEnabled || isLoading || !current) return null

  const affectedCount  = paddocks.filter(p => p.adjustedDays !== p.baseDays).length
  const totalDelta     = paddocks.reduce((s, p) => s + (p.adjustedDays - p.baseDays), 0)
  const hasAlert       = affectedCount > 0 || consumptionAdj < 0 || energyAdj > 0
  const thiLabel       = thi > 80 ? 'Estrés severo' : thi > 72 ? 'Moderado' : 'Confort'
  const thiColor       = thi > 80 ? 'text-red-600' : thi > 72 ? 'text-orange-600' : 'text-emerald-600'
  const growthColorCls = GROWTH_COLOR[cond]

  return (
    <>
      {/* ── Inline Gantt row ── */}
      <div
        className={`flex border-t items-stretch ${hasAlert ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-gray-50/60'}`}
        style={{ minHeight: 40 }}
      >
        {/* Label col — matches LABEL_W */}
        <div
          style={{ width: labelW, minWidth: labelW }}
          className={`px-2.5 flex items-center gap-1.5 border-r shrink-0 ${hasAlert ? 'border-amber-200' : 'border-gray-200'}`}
        >
          <Leaf className={`w-3 h-3 shrink-0 ${hasAlert ? 'text-amber-500' : 'text-emerald-400'}`} />
          <span className="text-[9px] font-black text-gray-500 tracking-widest uppercase leading-none">
            Clima
          </span>
          {hasAlert && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          )}
        </div>

        {/* Scrollable chips area */}
        <div className="flex-1 flex items-center gap-2 px-3 overflow-x-auto scrollbar-none">

          {/* Paddock chips */}
          {paddocks.slice(0, 6).map(p => {
            const delta = p.adjustedDays - p.baseDays
            return (
              <button
                key={p.id}
                onClick={() => setDrawerOpen(true)}
                title={`${p.name}: ${p.baseDays}d → ${p.adjustedDays}d`}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black whitespace-nowrap transition-all hover:shadow-sm shrink-0 ${
                  delta < 0 ? 'bg-red-50 border-red-200 text-red-700'
                  : delta > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : growthColorCls
                }`}
              >
                <span className="shrink-0">{COND_ICON[cond]}</span>
                <span className="truncate max-w-[64px]">{p.name}</span>
                {delta !== 0 && (
                  <span className="font-black shrink-0">
                    {delta > 0 ? '+' : ''}{delta}d
                  </span>
                )}
              </button>
            )
          })}

          {/* Separator */}
          {herds.length > 0 && (
            <div className="w-px h-5 bg-gray-200 shrink-0" />
          )}

          {/* Herd chips */}
          {herds.slice(0, 4).map(h => (
            <button
              key={h.id}
              onClick={() => setDrawerOpen(true)}
              title={`${h.name}: ${thiLabel}`}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black whitespace-nowrap transition-all hover:shadow-sm shrink-0 ${
                consumptionAdj < 0 ? 'bg-orange-50 border-orange-200 text-orange-700'
                : energyAdj > 0 ? 'bg-sky-50 border-sky-200 text-sky-700'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
              }`}
            >
              <Users className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[56px]">{h.name}</span>
              {consumptionAdj < 0 && <span className="shrink-0">{consumptionAdj}%</span>}
              {energyAdj > 0 && <span className="shrink-0">+{energyAdj}%E</span>}
            </button>
          ))}

          {/* Global delta badge + open drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black whitespace-nowrap shrink-0 border transition-all hover:shadow-sm ${
              totalDelta < 0 ? 'bg-red-600 text-white border-red-700'
              : totalDelta > 0 ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {totalDelta < 0 ? <TrendingDown className="w-3 h-3" /> : totalDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {totalDelta > 0 ? '+' : ''}{totalDelta}d
            <ChevronRight className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && mounted && (
        <ClimateDrawer
          paddocks={paddocks}
          herds={herds}
          cond={cond}
          thi={thi}
          consumptionAdj={consumptionAdj}
          energyAdj={energyAdj}
          onClose={() => setDrawerOpen(false)}
          onApply={onApplyAdjustment}
        />
      )}
    </>
  )
}
