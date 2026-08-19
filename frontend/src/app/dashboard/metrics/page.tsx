'use client'

/**
 * /dashboard/metrics — RODEO Metrics Dashboard
 *
 * Pilar 1: Vegetación y Carbono (NDVI, EVI, SAVI, fCover, Biomasa, SOC)
 * Pilar 2: Agua y Humedad (NDMI, Soil Moisture, Precipitación, Sequía)
 * Pilar 3: Suelo y Uso de Tierra (BSI, Deforestation Guard, Compactación)
 * Pilar 4: Biodiversidad y Ecosistema (Heterogeneidad, Fenología, Ocu/Desc)
 *
 * Métricas Nivel 1 (100% automáticas, solo necesitan polígono PostGIS).
 */

import { useState } from 'react'
import { RefreshCw, Satellite, Calendar, Lock, AlertTriangle, FlaskConical, Leaf, Droplets, Layers, TreePine } from 'lucide-react'
import { MetricCard, type MetricType } from './components/MetricCard'
import { useMetrics } from './hooks/useMetrics'
import { usePlan } from '@/hooks/usePlan'
import Link from 'next/link'
import { DownloadReportButton } from './components/DownloadReportButton'

// ── Pillars config ────────────────────────────────────────────────────────────

const PILLARS: Array<{
  id:      string
  label:   string
  icon:    React.ElementType
  metrics: MetricType[]
}> = [
  {
    id:      'vegetation',
    label:   'Vegetación y Carbono',
    icon:    Leaf,
    metrics: ['NDVI', 'EVI', 'SAVI', 'FCOVER', 'BIOMASS', 'SOC_ESTIMATED'],
  },
  {
    id:      'water',
    label:   'Agua y Humedad',
    icon:    Droplets,
    metrics: ['NDMI', 'SOIL_MOISTURE', 'DROUGHT_INDEX', 'PRECIPITATION'],
  },
  {
    id:      'soil',
    label:   'Suelo y Uso de Tierra',
    icon:    Layers,
    metrics: ['BSI', 'DEFORESTATION_GUARD', 'COMPACTION_PROXY'],
  },
  {
    id:      'biodiversity',
    label:   'Biodiversidad y Ecosistema',
    icon:    TreePine,
    metrics: ['SPECTRAL_HETEROGENEITY', 'PHENOLOGY', 'OCCUPATION_REST_RATIO'],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MetricsDashboardPage() {
  const { planSlug, hasFeature } = usePlan()
  const [selectedPaddock, setSelectedPaddock] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('vegetation')

  const { snapshots, trends, baselines, captureDate, loading, error, refetch } =
    useMetrics(selectedPaddock)

  // Paywall: metrics_module requires HOLISTICO+ plan
  const hasAccess = hasFeature('metrics_module')

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
          <FlaskConical className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-xl font-black text-gray-950">Observatorio Satelital</h2>
        <p className="text-gray-500 text-sm max-w-md">
          El módulo de MRV satelital está disponible en los planes <strong>Holístico</strong> y superiores.
          Accedé a 16 métricas automáticas, compliance EUDR, y reportes MRV.
        </p>
        <Link href="/dashboard/planes" className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Ver planes
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">
            Observatorio Satelital
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitoreo, Reporte y Verificación satelital automático · Sentinel-2 / Sentinel-1
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Capture date badge */}
          {captureDate && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <Calendar className="w-3.5 h-3.5" />
              <span>Actualizado: {new Date(captureDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          )}

          {/* Satellite badge */}
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
            <Satellite className="w-3.5 h-3.5" />
            <span>Sentinel-2 L2A</span>
          </div>

          {/* Refresh */}
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Compliance summary strip */}
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs items-center">
        <span className="font-semibold text-gray-600">Normativas:</span>
        {['EUDR', 'EOV Savory', 'GRSB', 'Verra', 'ISO 14046'].map(norm => (
          <span key={norm} className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 font-medium">
            ✓ {norm}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-4">
          <DownloadReportButton orgId="user-org-id" />
          <Link href="/dashboard/metrics/compliance" className="flex items-center gap-1 text-green-600 hover:underline font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">
            → Ver Compliance Dashboard
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={refetch} className="ml-auto underline">Reintentar</button>
        </div>
      )}

      {/* Empty state — no metrics yet */}
      {!loading && !error && Object.keys(snapshots).length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">🛰️</span>
          <div>
            <p className="font-semibold text-gray-700">No hay métricas disponibles aún</p>
            <p className="text-sm text-gray-400 mt-1">
              Las métricas se calculan automáticamente para todos los potreros con polígono satelital.
              Verificá que tus potreros tengan geometría definida en Mi Campo.
            </p>
          </div>
          <Link href="/dashboard/mi-campo" className="text-sm text-green-600 hover:underline font-medium">
            Ir a Mi Campo → Definir polígonos
          </Link>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-100 pb-2">
        {PILLARS.map(pillar => {
          const Icon = pillar.icon
          const isActive = activeTab === pillar.id
          return (
            <button
              key={pillar.id}
              onClick={() => setActiveTab(pillar.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-colors ${
                isActive ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {pillar.label.replace(' y Ecosistema', '').replace(' y Uso de Tierra', '')}
            </button>
          )
        })}
      </div>

      {/* Metric pillars */}
      {PILLARS.filter(p => p.id === activeTab).map(pillar => {
        const pillarMetrics = pillar.metrics
        const hasAnyData = pillarMetrics.some(m => snapshots[m] != null)

        return (
          <section key={pillar.id}>
            {/* Pillar header */}
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-black text-gray-950">{pillar.label}</h2>
              {!loading && !hasAnyData && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Sin datos — se calculará en la próxima ingesta
                </span>
              )}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {pillarMetrics.map(metricType => (
                <MetricCard
                  key={metricType}
                  metricType={metricType}
                  snapshot={loading ? undefined : snapshots[metricType] ?? null}
                  trend={loading ? undefined : trends[metricType] ?? null}
                  baselineValue={loading ? undefined : baselines[metricType] ?? null}
                  onClick={() => {
                    // TODO Phase 2: navigate to Time Machine for this metric
                  }}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Carbon Dashboard CTA */}
      <Link href="/dashboard/metrics/carbon" className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-50 rounded-2xl border border-green-200 hover:border-green-300 transition-colors group mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl group-hover:scale-110 transition-transform">🌿</span>
          <div>
            <p className="font-bold text-green-900">Huella de Carbono — Emisiones vs Secuestro</p>
            <p className="text-sm text-green-600">
              Cálculo de emisiones IPCC Tier 1 y remociones con proxy SOC para estimar tu balance neto.
            </p>
          </div>
        </div>
        <span className="text-sm font-semibold text-green-600 bg-white px-4 py-2 rounded-xl border border-green-200 shadow-sm group-hover:bg-green-50">
          Calcular →
        </span>
      </Link>

      {/* Time Machine CTA — Phase 2 */}
      <Link href="/dashboard/metrics/time-machine" className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 hover:border-blue-300 transition-colors group">
        <div className="flex items-center gap-3">
          <span className="text-2xl group-hover:scale-110 transition-transform">⏰</span>
          <div>
            <p className="font-bold text-blue-900">Time Machine — Análisis Histórico 2020→Hoy</p>
            <p className="text-sm text-blue-600">
              Visualizá cómo evolucionó cada métrica desde la fecha de corte EUDR (31/12/2020).
            </p>
          </div>
        </div>
        <span className="text-sm font-semibold text-blue-600 bg-white px-4 py-2 rounded-xl border border-blue-200 shadow-sm group-hover:bg-blue-50">
          Explorar →
        </span>
      </Link>
    </div>
  )
}
