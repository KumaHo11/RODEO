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
  TrendingDown, Clock, CloudLightning,
} from 'lucide-react'

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
  adjustedDays: number
): { title: string; body: string; action: string; factors: { label: string; desc: string; icon: string }[] } {
  const delta = originalDays - adjustedDays

  // Factores climáticos detectados según el tipo de estrés dominante
  const factorsByStress: Record<string, { label: string; desc: string; icon: string }[]> = {
    heat: [
      { icon: '🌡️', label: 'Temperatura alta', desc: 'Por encima de 30°C el crecimiento del pasto se reduce significativamente porque la planta usa energía en transpirar en lugar de crecer.' },
      { icon: '💧', label: 'Estrés hídrico', desc: 'El calor aumenta la evapotranspiración: el suelo pierde agua más rápido, limitando el rebrote.' },
      { icon: '☀️', label: 'Radiación intensa', desc: 'La alta radiación solar combinada con calor puede quemar los meristemas activos del pasto.' },
    ],
    cold: [
      { icon: '🌡️', label: 'Temperatura baja', desc: 'Debajo de 5–8°C el crecimiento del pasto se detiene: las enzimas del metabolismo vegetal dejan de funcionar.' },
      { icon: '💧', label: 'Lluvia y barro', desc: 'El exceso de humedad en el suelo dificulta el ingreso del rodeo y aumenta el pisoteo, dañando la base de las plantas.' },
      { icon: '☁️', label: 'Baja radiación solar', desc: 'Los días nublados y cortos reducen la fotosíntesis, limitando la tasa de crecimiento diario.' },
    ],
    drought: [
      { icon: '🏜️', label: 'Déficit hídrico', desc: 'Sin lluvias recientes el suelo está seco: el pasto entra en latencia y casi no crece.' },
      { icon: '🌡️', label: 'Temperatura elevada', desc: 'El calor seco acelera la evaporación del poco agua disponible, agravando la sequía.' },
      { icon: '💨', label: 'Viento seco', desc: 'El viento aumenta la transpiración de la planta y seca el suelo más rápido.' },
    ],
    storm: [
      { icon: '⛈️', label: 'Tormenta / granizo', desc: 'Las condiciones extremas pueden dañar físicamente el pasto y hacer inseguro el ingreso del rodeo.' },
      { icon: '💧', label: 'Exceso de lluvia', desc: 'El suelo saturado no permite el ingreso del rodeo sin riesgo de compactación severa.' },
      { icon: '💨', label: 'Viento fuerte', desc: 'Los vientos superiores a 50 km/h generan estrés en las plantas y dificultan el manejo del rodeo.' },
    ],
    default: [
      { icon: '🌡️', label: 'Temperatura', desc: 'Las temperaturas fuera del rango óptimo (8–25°C) reducen la tasa de crecimiento diario del pasto.' },
      { icon: '💨', label: 'Viento', desc: 'El viento aumenta la evapotranspiración y puede enfriar o resecar el canopeo, frenando el rebrote.' },
      { icon: '☀️', label: 'Radiación solar', desc: 'La fotosíntesis depende de la luz disponible. Menos sol significa menos energía para crecer.' },
      { icon: '💧', label: 'Humedad del suelo', desc: 'Tanto la sequía como el exceso de agua limitan el acceso de las raíces a nutrientes y frenan el crecimiento.' },
    ],
  }

  const stressTitles: Record<string, string> = {
    heat:    `Estadía reducida — condiciones de calor`,
    cold:    `Estadía reducida — frío y barro`,
    drought: `Estadía reducida — déficit hídrico`,
    storm:   `Estadía reducida — tormenta`,
    default: `Estadía ajustada por condiciones climáticas`,
  }

  const stressBodies: Record<string, string> = {
    heat:    `El calor intenso y la evapotranspiración reducen el crecimiento del pasto. El plan estimaba ${originalDays} días — el clima ajusta a ${adjustedDays} días útiles.`,
    cold:    `El frío, el barro y la baja radiación frenan el rebrote. En lugar de ${originalDays} días, este potrero rinde ${adjustedDays} días útiles.`,
    drought: `La falta de lluvias mantiene el suelo seco y el pasto en latencia. El potrero tiene menos días disponibles de lo planeado (${originalDays} → ${adjustedDays}).`,
    storm:   `Las condiciones extremas acortan el tiempo de pastoreo seguro: de ${originalDays} días planificados quedan ${adjustedDays} días viables.`,
    default: `Las condiciones climáticas actuales combinan varios factores que reducen la tasa de crecimiento del pasto. El plan estimaba ${originalDays} días — ahora son ${adjustedDays}.`,
  }

  const key = stressType ?? 'default'
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
}: GanttClimateAlertProps & { onClose: () => void }) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied]   = useState(false)

  const cfg    = LEVEL_CONFIG[alertLevel]
  const delta  = originalDays - adjustedDays
  const reason = buildReason(stressType, originalDays, adjustedDays)
  const StressIcon = STRESS_ICONS[stressType ?? 'default'] ?? STRESS_ICONS.default

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
                  Impacto Climático · {paddockName}
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

          {/* Por qué ocurre */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Por qué ocurre
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">{reason.body}</p>
            {alertMessage && (
              <div className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                <Info className={`w-3.5 h-3.5 ${cfg.iconColor} shrink-0 mt-0.5`} />
                <p className={`text-xs leading-relaxed ${cfg.textColor}`}>{alertMessage}</p>
              </div>
            )}
          </div>

          {/* Factores climáticos detectados */}
          {reason.factors.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Factores que reducen el crecimiento
              </p>
              <div className="space-y-2">
                {reason.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <span className="text-base leading-none shrink-0 mt-0.5">{f.icon}</span>
                    <div>
                      <p className="text-xs font-black text-gray-700">{f.label}</p>
                      <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{f.desc}</p>
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
}: GanttClimateAlertProps) {
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [dismissed, setDismissed]     = useState(false)
  const [mounted,   setMounted]       = useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  if (dismissed) return null

  const delta  = originalDays - adjustedDays
  if (delta <= 0) return null // Sin cambio → no mostrar

  const cfg    = LEVEL_CONFIG[alertLevel]
  const reason = buildReason(stressType, originalDays, adjustedDays)
  const StressIcon = STRESS_ICONS[stressType ?? 'default'] ?? STRESS_ICONS.default

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
          −{delta}d clima
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
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  )
}
