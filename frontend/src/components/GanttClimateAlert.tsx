'use client'

/**
 * GanttClimateAlert
 *
 * Banner contextual de alerta climática para el Planificador (Gantt).
 * Aparece INLINE debajo de un bloque de pastoreo cuando el clima
 * acorta los días disponibles.
 *
 * Principio: 3-click rule
 *   Clic 1: el banner está visible en el Gantt (no requiere clic)
 *   Clic 2: [Ver impacto] → abre el drawer lateral con detalle
 *   Clic 3: [Aplicar cambio] → ejecuta el callback onApply
 *
 * No es un modal. Es un drawer lateral que NO bloquea el flujo.
 */

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Thermometer, Snowflake, CloudRain, AlertTriangle,
  X, ChevronRight, CheckCircle2, Info,
  TrendingDown, TrendingUp, Clock, CloudLightning,
  Droplets, Sun, Wind, Cloud, Minus
} from 'lucide-react'
import { useWeather } from '@/lib/context/WeatherContext'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ClimateAlertLevel = 'warning' | 'critical'

export interface GanttClimateAlertProps {
  /** Nombre del potrero afectado */
  paddockName: string
  /** Días originales del plan (sin ajuste climático) */
  originalDays: number
  /** Días ajustados por clima */
  adjustedDays: number
  /** Nivel de alerta */
  alertLevel: ClimateAlertLevel
  /** Causa principal (viene del motor de cálculo) */
  alertMessage?: string | null
  /** Tipo de estrés climático predominante */
  stressType?: 'heat' | 'cold' | 'drought' | 'storm'
  /** Callback al aplicar el cambio sugerido (puede ser null si no hay acción disponible) */
  onApply?: () => void | Promise<void>
  /** Callback al ignorar la alerta */
  onDismiss?: () => void
  /** Mostrar en modo ultra-compacto (solo el pill) — para filas Gantt */
  compact?: boolean
  /** Consumo diario total original (para calcular variación) */
  dailyDemand?: number
  /** Multiplicador de consumo climático */
  aAdj?: number
}

// ── Helpers visuales ──────────────────────────────────────────────────────────

const STRESS_ICONS = {
  heat:    Thermometer,
  cold:    Snowflake,
  drought: CloudRain,
  storm:   CloudLightning,
  default: AlertTriangle,
}

const LEVEL_CONFIG = {
  warning: {
    barColor:   'bg-amber-400',
    bg:         'bg-amber-50',
    border:     'border-amber-200',
    textColor:  'text-amber-800',
    badgeBg:    'bg-amber-100 text-amber-800',
    iconColor:  'text-amber-500',
    pillBg:     'bg-amber-50 border-amber-200',
    applyBtn:   'bg-amber-600 hover:bg-amber-700 text-white',
    pulse:      false,
  },
  critical: {
    barColor:   'bg-red-500',
    bg:         'bg-red-50',
    border:     'border-red-200',
    textColor:  'text-red-900',
    badgeBg:    'bg-red-100 text-red-800',
    iconColor:  'text-red-500',
    pillBg:     'bg-red-50 border-red-200',
    applyBtn:   'bg-red-600 hover:bg-red-700 text-white',
    pulse:      true,
  },
}

// Génera el micro-copy del motivo con explicación completa de factores climáticos
function buildReason(
  stressType: string | undefined,
  originalDays: number,
  adjustedDays: number,
  thi?: number | null
): { title: string; body: string; action: string; factors: { label: string; desc: string; icon: React.ReactNode }[] } {
  const delta = originalDays - adjustedDays

  // Factores climáticos detectados según el tipo de estrés dominante
  const factorsByStress: Record<string, { label: string; desc: string; icon: React.ReactNode }[]> = {
    heat: [
      { icon: <Thermometer className="w-5 h-5 text-red-500" />, label: 'Estrés por calor', desc: 'El ganado gasta energía extra intentando refrescarse, y el estrés térmico altera su metabolismo, reduciendo la eficiencia.' },
      { icon: <Sun className="w-5 h-5 text-amber-500" />, label: 'Búsqueda de sombra', desc: 'El rodeo se agrupa en zonas de sombra, pisoteando y desperdiciando una gran cantidad de forraje en esas áreas.' },
    ],
    cold: [
      { icon: <Thermometer className="w-5 h-5 text-blue-400" />, label: 'Requerimiento térmico', desc: 'Las bajas temperaturas obligan al animal a consumir más alimento simplemente para mantener su temperatura corporal.' },
      { icon: <Droplets className="w-5 h-5 text-blue-600" />, label: 'Barro y pisoteo', desc: 'El exceso de humedad genera barro. El animal camina más pesado y entierra gran cantidad de pasto al pisar, aumentando el desperdicio.' },
    ],
    default: [
      { icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, label: 'Condiciones adversas', desc: 'El clima extremo obliga a los animales a gastar más energía y aumenta el desperdicio de forraje por pisoteo o búsqueda de reparo.' },
    ],
  }

  const stressTitles: Record<string, string> = {
    heat:    `Estadía reducida — consumo por calor`,
    cold:    `Estadía reducida — frío y barro`,
    default: `Estadía ajustada por aumento de demanda`,
  }

  const stressBodies: Record<string, string> = {
    heat:    `El estrés térmico eleva los requerimientos y el desperdicio por sombra. El plan estimaba ${originalDays} días — el aumento de demanda ajusta a ${adjustedDays} días útiles.`,
    cold:    `El frío extremo y el barro incrementan el consumo por termorregulación y el desperdicio. En lugar de ${originalDays} días, rinde ${adjustedDays} días útiles.`,
    default: `Las condiciones ambientales elevan el requerimiento efectivo del rodeo. El plan estimaba ${originalDays} días — ahora son ${adjustedDays}.`,
  }

  let key = stressType ?? 'default'
  if (key === 'auto' && thi != null) {
    if (thi >= 72) key = 'heat'
    else if (thi < 60) key = 'cold' // Roughly < 15C
    else key = 'default'
  }
  const title   = stressTitles[key]   ?? stressTitles.default
  const body    = stressBodies[key]   ?? stressBodies.default
  const factors = factorsByStress[key] ?? factorsByStress.default

  return {
    title,
    body,
    factors,
    action: `Sugerimos mover el rodeo ${delta} día${delta !== 1 ? 's' : ''} antes de lo planeado.`,
  }
}

// ── Drawer lateral ────────────────────────────────────────────────────────────

function ClimateAlertDrawer({
  paddockName,
  originalDays,
  adjustedDays,
  alertLevel,
  alertMessage,
  stressType,
  onApply,
  onClose,
  dailyDemand,
  aAdj,
}: GanttClimateAlertProps & { onClose: () => void }) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied]   = useState(false)
  const { current } = useWeather()

  const cfg    = LEVEL_CONFIG[alertLevel]
  const delta  = originalDays - adjustedDays
  const thi = current ? parseFloat((current.tempC + 0.36 * (current.tempC - (100 - current.humidityPct) / 5) + 41.5).toFixed(1)) : null
  const reason = buildReason(stressType, originalDays, adjustedDays, thi)
  let resolvedStress = stressType ?? 'default'
  if (resolvedStress === 'auto' && thi != null) {
    resolvedStress = thi >= 72 ? 'heat' : (thi < 60 ? 'cold' : 'default')
  }
  const StressIcon = STRESS_ICONS[resolvedStress as keyof typeof STRESS_ICONS] ?? STRESS_ICONS.default

  const extraDailyDemand = dailyDemand && aAdj ? dailyDemand * (aAdj - 1.0) : 0

  const handleApply = async () => {
    if (!onApply) return
    setApplying(true)
    await onApply()
    setApplied(true)
    setApplying(false)
    setTimeout(onClose, 800)
  }

  return createPortal(
    <>
      {/* Backdrop (no-bloquear — solo oscurece fondo) */}
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer derecho */}
      <div className="fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className={`px-5 py-4 border-b ${cfg.border} ${cfg.bg} shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0`}>
                <StressIcon className={`w-5 h-5 ${cfg.iconColor}`} />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${cfg.iconColor} mb-0.5`}>
                  IMPACTO CLIMÁTICO - {paddockName}
                </p>
                <h3 className={`text-sm font-black ${cfg.textColor} leading-tight`}>
                  {reason.title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/50 text-gray-400 shrink-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Comparativa Plan Base vs Ajustado */}
          <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Comparativa de días
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-300" />
                  <span className="text-xs font-bold text-gray-500">Plan original</span>
                </div>
                <span className="text-sm font-black text-gray-700">{originalDays} días</span>
              </div>
              <div className={`px-4 py-3 flex items-center justify-between ${cfg.bg}`}>
                <div className="flex items-center gap-2">
                  <StressIcon className={`w-4 h-4 ${cfg.iconColor}`} />
                  <span className={`text-xs font-bold ${cfg.textColor}`}>Plan ajustado por clima</span>
                </div>
                <span className={`text-sm font-black ${cfg.textColor}`}>{adjustedDays} días</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-gray-500">Diferencia</span>
                </div>
                <span className="text-sm font-black text-red-600">−{delta} día{delta !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Condiciones actuales */}
          {current && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Condiciones climáticas actuales
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
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
                {extraDailyDemand !== 0 && (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${extraDailyDemand > 0 ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'}`}>
                    <div className="flex items-center gap-2">
                      {extraDailyDemand > 0 ? (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-emerald-500" />
                      )}
                      <span className={`text-xs font-bold ${extraDailyDemand > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Variación diaria de ración</span>
                    </div>
                    <span className={`text-base font-black ${extraDailyDemand > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {extraDailyDemand > 0 ? '+' : ''}{extraDailyDemand.toFixed(0)} kg
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Por qué ocurre */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Por qué ocurre
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">{reason.body}</p>
            {alertMessage && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50`}>
                <Info className={`w-3.5 h-3.5 text-amber-600 shrink-0`} />
                <p className={`text-xs font-semibold text-amber-800`}>{alertMessage}</p>
              </div>
            )}
          </div>

          {/* Factores climáticos detectados */}
          {reason.factors.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Factores que elevan el consumo
              </p>
              <div className="space-y-2">
                {reason.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-3 border border-gray-100">
                    <div className="shrink-0 flex items-center justify-center bg-white rounded-full p-1.5 shadow-sm border border-gray-100">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">{f.label}</p>
                      <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sugerencia */}
          {onApply && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3.5">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">
                💡 Acción sugerida
              </p>
              <p className="text-sm text-emerald-800 leading-relaxed">{reason.action}</p>
            </div>
          )}
        </div>

        {/* Footer — CTAs */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0 space-y-2">
          {onApply && !applied && (
            <button
              onClick={handleApply}
              disabled={applying}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${cfg.applyBtn}`}
            >
              {applying ? (
                <span className="animate-pulse">Aplicando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Aplicar este cambio
                </>
              )}
            </button>
          )}
          {applied && (
            <div className="w-full py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              ✓ Cambio aplicado
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
          >
            Ignorar por ahora
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Componente principal exportado ────────────────────────────────────────────

export default function GanttClimateAlert({
  paddockName,
  originalDays,
  adjustedDays,
  alertLevel,
  alertMessage,
  stressType,
  onApply,
  onDismiss,
  compact = false,
  ...props
}: GanttClimateAlertProps) {
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [dismissed, setDismissed]     = useState(false)
  const [mounted,   setMounted]       = useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  if (dismissed) return null

  const delta  = originalDays - adjustedDays
  if (delta <= 0) return null // Sin cambio → no mostrar

  const cfg    = LEVEL_CONFIG[alertLevel]
  const { current } = useWeather()
  const thi = current ? parseFloat((current.tempC + 0.36 * (current.tempC - (100 - current.humidityPct) / 5) + 41.5).toFixed(1)) : null
  const reason = buildReason(stressType, originalDays, adjustedDays, thi)
  
  let resolvedStress = stressType ?? 'default'
  if (resolvedStress === 'auto' && thi != null) {
    resolvedStress = thi >= 72 ? 'heat' : (thi < 60 ? 'cold' : 'default')
  }
  const StressIcon = STRESS_ICONS[resolvedStress as keyof typeof STRESS_ICONS] ?? STRESS_ICONS.default

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  // ── Compact: pill mínimo (para la fila del Gantt) ──────────────────────────
  if (compact) {
    return (
      <>
        <button
          onClick={() => setDrawerOpen(true)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black
            transition-all hover:shadow-sm uppercase tracking-wide
            ${cfg.pillBg} ${cfg.textColor}
            ${cfg.pulse ? 'animate-pulse' : ''}
          `}
        >
          <StressIcon className="w-3 h-3" />
          Ajuste Clima
          <ChevronRight className="w-2.5 h-2.5" />
        </button>

        {drawerOpen && mounted && (
          <ClimateAlertDrawer
            paddockName={paddockName}
            originalDays={originalDays}
            adjustedDays={adjustedDays}
            alertLevel={alertLevel}
            alertMessage={alertMessage}
            stressType={stressType}
            onApply={onApply}
            onDismiss={onDismiss}
            compact={compact}
            dailyDemand={props.dailyDemand}
            aAdj={props.aAdj}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </>
    )
  }

  // ── Full banner (debajo del bloque Gantt) ──────────────────────────────────
  return (
    <>
      <div className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 border
        ${cfg.bg} ${cfg.border}
        ${alertLevel === 'critical' ? 'border-l-red-500' : 'border-l-amber-400'}
        ${cfg.pulse ? 'shadow-sm shadow-red-100' : ''}
      `}>
        {/* Icono */}
        <StressIcon className={`w-4 h-4 ${cfg.iconColor} shrink-0 mt-0.5`} />

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black ${cfg.textColor} leading-tight`}>
            {reason.title}
          </p>
          <p className={`text-[10px] font-medium ${cfg.textColor} opacity-70 mt-0.5 leading-snug`}>
            Plan original: {originalDays}d · Ajustado: <strong>{adjustedDays}d</strong> (−{delta}d)
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className={`
              text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-all
              ${cfg.bg} ${cfg.border} ${cfg.textColor}
              hover:brightness-95
            `}
          >
            Ver impacto
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
            title="Ignorar alerta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && mounted && (
        <ClimateAlertDrawer
          paddockName={paddockName}
          originalDays={originalDays}
          adjustedDays={adjustedDays}
          alertLevel={alertLevel}
          alertMessage={alertMessage}
          stressType={stressType}
          onApply={onApply}
          onDismiss={onDismiss}
          compact={compact}
          dailyDemand={props.dailyDemand}
          aAdj={props.aAdj}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  )
}
