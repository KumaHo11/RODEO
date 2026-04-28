'use client'

/**
 * ClimateAdjustmentWidget
 *
 * Widget compacto para el Panel Principal y la sección de Potreros/Rodeos.
 * Muestra el estado de Ajuste Clima de un potrero: días ajustados,
 * multiplicador climático, alerta y tasa de crecimiento.
 */

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { usePlan } from '@/hooks/usePlan'
import { CloudRain, Leaf, AlertTriangle, TrendingUp, TrendingDown, Loader2, Lock } from 'lucide-react'

interface ClimateWidgetProps {
  paddockId: string
  paddockName: string
  plannedDays?: number
  rainfallManualMm?: number
  compact?: boolean
  onResult?: (result: any) => void
}

interface WidgetResult {
  adjustedRemainingDays: number
  baseRemainingDays: number
  grassGrowthRateKgHaDay: number
  climateMultiplier: number
  alertLevel: 'ok' | 'warning' | 'critical'
  alertMessage: string | null
  deltaFromPlan: number
}

const ALERT_STYLES = {
  ok:       { bg: 'bg-emerald-50 border-emerald-100',   text: 'text-emerald-700',  icon: <Leaf className="w-4 h-4" /> },
  warning:  { bg: 'bg-amber-50 border-amber-200',       text: 'text-amber-700',    icon: <AlertTriangle className="w-4 h-4" /> },
  critical: { bg: 'bg-red-50 border-red-200',           text: 'text-red-700',      icon: <AlertTriangle className="w-4 h-4" /> },
}

export function ClimateAdjustmentWidget({
  paddockId, paddockName, plannedDays = 21, rainfallManualMm, compact = false, onResult,
}: ClimateWidgetProps) {
  const { hasFeature } = usePlan()
  const hasAccess = hasFeature('grazing_planner')

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<WidgetResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [ran, setRan]         = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/climate-adjustment', {
        method: 'POST',
        body: JSON.stringify({ paddockId, plannedDays, rainfallManualMm }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al calcular')
        return
      }
      const data = await res.json()
      setResult(data.result)
      onResult?.(data)
    } catch {
      setError('Sin conexión')
    } finally {
      setLoading(false)
      setRan(true)
    }
  }

  useEffect(() => { if (hasAccess && paddockId) run() }, [paddockId, hasAccess])

  if (!hasAccess) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>Ajuste Clima disponible desde <strong>Planificador</strong></span>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      Calculando ajuste clima...
    </div>
  )

  if (error) return (
    <div className="text-xs text-red-500 flex items-center gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      {error}
    </div>
  )

  if (!result) return null

  const style = ALERT_STYLES[result.alertLevel]
  const delta = result.deltaFromPlan
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown

  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs font-bold ${style.bg} ${style.text}`}>
        {style.icon}
        <span>{result.adjustedRemainingDays}d estadía</span>
        {delta !== 0 && (
          <span className={`flex items-center gap-0.5 ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <DeltaIcon className="w-3 h-3" />
            {delta >= 0 ? '+' : ''}{delta}d
          </span>
        )}
        <span className="opacity-60">· {result.grassGrowthRateKgHaDay} kg/ha/d</span>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${style.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudRain className={`w-4 h-4 ${style.text}`} />
          <h4 className={`text-sm font-black ${style.text}`}>Ajuste Clima</h4>
        </div>
        <button onClick={run} disabled={loading} className="text-[9px] font-bold text-gray-400 hover:text-gray-600 underline">
          Actualizar
        </button>
      </div>

      {/* Main metric */}
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-black ${style.text}`}>{result.adjustedRemainingDays}</span>
        <span className="text-sm text-gray-500 font-bold">días de estadía</span>
        {delta !== 0 && (
          <span className={`ml-auto flex items-center gap-1 text-sm font-black ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <DeltaIcon className="w-4 h-4" />
            {delta >= 0 ? '+' : ''}{delta}d
          </span>
        )}
      </div>

      {/* Sub-metrics */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Crecimiento', value: `${result.grassGrowthRateKgHaDay} kg/ha/d`, color: 'text-emerald-700' },
          { label: 'Mult. clima', value: `×${result.climateMultiplier.toFixed(2)}`, color: 'text-blue-700' },
          { label: 'Base s/ajuste', value: `${result.baseRemainingDays}d`, color: 'text-gray-600' },
        ].map(m => (
          <div key={m.label} className="bg-white/60 rounded-xl px-2 py-1.5 text-center">
            <p className={`text-sm font-black ${m.color}`}>{m.value}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Alert message */}
      {result.alertMessage && (
        <p className={`text-xs font-medium leading-relaxed ${style.text}`}>{result.alertMessage}</p>
      )}
    </div>
  )
}

export default ClimateAdjustmentWidget
