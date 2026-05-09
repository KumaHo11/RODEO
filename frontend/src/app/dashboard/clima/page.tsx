'use client'

import { useCallback, useEffect, useState } from 'react'
import { useWeatherEvents } from './hooks/useWeatherEvents'
import { WeatherWidget }          from './components/WeatherWidget'
import { ClimateGrowthChart }     from './components/ClimateGrowthChart'
import { ClimateAdjustmentPanel } from './components/ClimateAdjustmentPanel'
import { WeatherHistoryTable }    from './components/WeatherHistoryTable'
import { FeatureGate } from '@/components/FeatureGate'
import { apiFetch } from '@/lib/apiFetch'

export default function ClimaPage() {
  const { events, isLoading, createEvent } = useWeatherEvents()
  const [orgName, setOrgName] = useState<string | null>(null)

  // Fetch field name for display in the summary header
  useEffect(() => {
    apiFetch('/api/organizations')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.organization?.name) setOrgName(d.organization.name) })
      .catch(() => {})
  }, [])

  return (
    <FeatureGate
      feature="clima"
      title="Módulo de clima y alertas"
      description="Registrá lluvias, heladas y consultá el pronóstico integrado. Disponible desde el plan Brote."
      requiredPlan="Brote"
    >
      <div className="flex flex-col gap-6 pb-8">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Clima</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">
            Condiciones actuales · Crecimiento de pasto · Ajuste por potrero
          </p>
        </div>

        {/* ── Sección 1+2: card envolvente — 2 columnas egal height ─── */}
        <section aria-label="Condiciones y crecimiento">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-4">
              Condiciones actuales y crecimiento
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <WeatherWidget />
              <ClimateGrowthChart baseGrowthRate={20} />
            </div>
          </div>
        </section>

        {/* ── Sección 3: Ajuste por potrero — con registro inline ─────── */}
        <section aria-label="Ajuste climático por potrero">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <ClimateAdjustmentPanel
              showGlobalSummary
              orgName={orgName}
              onSaveWeatherEvent={createEvent}
            />
          </div>
        </section>

        {/* ── Sección 4: Historial compacto ─────────────────────────── */}
        <section aria-label="Historial de registros">
          <WeatherHistoryTable events={events} isLoading={isLoading} />
        </section>

      </div>
    </FeatureGate>
  )
}
