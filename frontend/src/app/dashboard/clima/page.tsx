'use client'

import { useWeatherEvents, useWeatherInsights } from './hooks/useWeatherEvents'
import { WeatherWidget }        from './components/WeatherWidget'
import { RainForm }             from './components/RainForm'
import { FrostForm }            from './components/FrostForm'
import { WeatherHistoryTable }  from './components/WeatherHistoryTable'
import { WeatherInsightsPanel } from './components/WeatherInsightsPanel'
import type { CreateWeatherEventPayload } from '@/lib/types/weather'
import { FeatureGate } from '@/components/FeatureGate'

export default function ClimaPage() {
  const {
    events, isLoading, isSaving, createEvent, refetch: refetchEvents,
  } = useWeatherEvents()

  const {
    insights, isLoading: insightsLoading, refetch: refetchInsights,
  } = useWeatherInsights()

  const handleSave = async (payload: CreateWeatherEventPayload): Promise<boolean> => {
    const ok = await createEvent(payload)
    if (ok) refetchInsights()
    return ok
  }

  return (
    <FeatureGate
      feature="clima"
      title="Módulo de clima y alertas"
      description="Registrá lluvias, heladas y consultá el pronóstico integrado. Disponible desde el plan Brote."
      requiredPlan="Brote"
    >
      <div className="flex flex-col gap-6 pb-8">

        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Clima</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">
            Condiciones actuales · Registro de precipitaciones y heladas
          </p>
        </div>

        {/* ── Section 1: Three cards at the same visual level ─────────────────── */}
        <section aria-label="Clima actual y registro de eventos">
          <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-3">
            Condición actual y registro
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <WeatherWidget />
            <RainForm onSave={handleSave} isSaving={isSaving} />
            <FrostForm onSave={handleSave} isSaving={isSaving} />
          </div>
        </section>

        {/* ── Section 2: Metrics ──────────────────────────────────────────────── */}
        <section aria-label="Métricas e insights">
          <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-3">
            Métricas generales
          </p>
          <WeatherInsightsPanel insights={insights} isLoading={insightsLoading} />
        </section>

        {/* ── Section 3: Combined history ──────────────────────────────────────── */}
        <section aria-label="Historial de registros">
          <WeatherHistoryTable events={events} isLoading={isLoading} />
        </section>

      </div>
    </FeatureGate>
  )
}
