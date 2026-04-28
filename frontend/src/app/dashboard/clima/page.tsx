'use client'

import { useState } from 'react'
import { useWeatherEvents, useWeatherInsights } from './hooks/useWeatherEvents'
import { WeatherWidget }          from './components/WeatherWidget'
import { RainForm }               from './components/RainForm'
import { FrostForm }              from './components/FrostForm'
import { WeatherHistoryTable }    from './components/WeatherHistoryTable'
import { WeatherInsightsPanel }   from './components/WeatherInsightsPanel'
import { ClimateAdjustmentPanel } from './components/ClimateAdjustmentPanel'
import type { CreateWeatherEventPayload } from '@/lib/types/weather'
import { FeatureGate } from '@/components/FeatureGate'

type Tab = 'condiciones' | 'ajuste'

export default function ClimaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('condiciones')

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

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950">Clima</h1>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              {activeTab === 'condiciones'
                ? 'Condiciones actuales · Registro de precipitaciones y heladas'
                : 'Impacto del clima en la planificación de pastoreo · por potrero y campo'}
            </p>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
            {([
              { key: 'condiciones', label: 'Condiciones' },
              { key: 'ajuste',      label: 'Ajuste Clima' },
            ] as { key: Tab; label: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                  activeTab === t.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab: Condiciones ────────────────────────────────────────── */}
        {activeTab === 'condiciones' && (
          <>
            {/* Section 1: Three cards */}
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

            {/* Section 2: Metrics */}
            <section aria-label="Métricas e insights">
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-3">
                Métricas generales
              </p>
              <WeatherInsightsPanel insights={insights} isLoading={insightsLoading} />
            </section>

            {/* Section 3: History */}
            <section aria-label="Historial de registros">
              <WeatherHistoryTable events={events} isLoading={isLoading} />
            </section>
          </>
        )}

        {/* ── Tab: Ajuste Clima ────────────────────────────────────────── */}
        {activeTab === 'ajuste' && (
          <section aria-label="Ajuste clima y estadía">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <ClimateAdjustmentPanel showGlobalSummary />
            </div>
          </section>
        )}

      </div>
    </FeatureGate>
  )
}
