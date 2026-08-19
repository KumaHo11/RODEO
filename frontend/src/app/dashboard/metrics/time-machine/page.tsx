'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Activity, TrendingUp, AlertTriangle, Satellite, Leaf, RefreshCw, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useTimeMachine } from '../hooks/useTimeMachine'
import { TimeChart } from '../components/TimeChart'
import { TimeSlider } from '../components/TimeSlider'

const METRICS = ['NDVI', 'EVI', 'SAVI', 'NDMI']

// NDVI color scale based on value
function getNdviColor(val: number): string {
  if (val >= 0.6) return '#16a34a'   // Optimal — Rodeo Green
  if (val >= 0.4) return '#65a30d'   // Good — lime
  if (val >= 0.2) return '#ca8a04'   // Fair — amber
  return '#dc2626'                    // Low — red
}

function getNdviLabel(val: number): string {
  if (val >= 0.6) return 'Óptimo'
  if (val >= 0.4) return 'Bueno'
  if (val >= 0.2) return 'Moderado'
  return 'Bajo'
}

function getMetricColor(metricType: string, val: number): string {
  if (metricType === 'NDVI' || metricType === 'EVI' || metricType === 'SAVI') return getNdviColor(val)
  return '#2563eb'
}

// Format month label
function formatMonthLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }).replace(' ', "'")
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Card component
// ─────────────────────────────────────────────────────────────────────────────
interface SnapshotCardProps {
  point: { month: string; value: number; period_month: string }
  metricType: string
  isBaseline?: boolean
  isLatest?: boolean
  index: number
}

function SnapshotCard({ point, metricType, isBaseline, isLatest, index }: SnapshotCardProps) {
  const color = getMetricColor(metricType, point.value)
  const label = metricType === 'NDVI' ? getNdviLabel(point.value) : null
  const barWidth = Math.min(100, Math.max(0, point.value * 100))

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
      style={{
        animation: `fadeSlideIn 0.35s ease-out ${index * 0.025}s both`,
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: color }} />

      {/* Satellite "thumbnail" placeholder — gradient based on NDVI */}
      <div
        className="relative h-28 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
        }}
      >
        <Satellite className="w-8 h-8 opacity-20" style={{ color }} />
        {/* Badge: baseline or latest */}
        {isBaseline && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
            Baseline
          </span>
        )}
        {isLatest && !isBaseline && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700">
            Actual
          </span>
        )}
        {/* Month label */}
        <span className="absolute bottom-2 right-2 text-[11px] font-semibold text-gray-500">
          {formatMonthLabel(point.period_month)}
        </span>
      </div>

      {/* Metric value */}
      <div className="px-3 pt-3 pb-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{metricType}</span>
          {label && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: color + '20', color }}>
              {label}
            </span>
          )}
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
          {point.value.toFixed(3)}
        </span>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${barWidth}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen loading overlay
// ─────────────────────────────────────────────────────────────────────────────
function BackfillLoader({ paddockName }: { paddockName: string }) {
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState(0)

  const phases = [
    'Conectando con satélites Sentinel-2…',
    'Buscando imágenes históricas desde 2019…',
    'Calculando índices NDVI, EVI, SAVI, NDMI…',
    'Guardando snapshots mensuales…',
    'Casi listo — procesando últimos meses…',
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPhase(Math.min(phases.length - 1, Math.floor(elapsed / 18)))
  }, [elapsed])

  const estimatedTotal = 90 // ~90 months from 2019
  const estimatedProcessed = Math.min(estimatedTotal, Math.floor((elapsed / 180) * estimatedTotal))
  const progressPct = Math.min(95, (estimatedProcessed / estimatedTotal) * 100)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full px-8 text-center">
        {/* Animated satellite icon */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-green-100" />
          <div
            className="absolute inset-0 rounded-full border-4 border-t-green-600 border-r-green-400"
            style={{ animation: 'spin 1.2s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Satellite className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-green-600 mb-1">
            Generando Historial
          </p>
          <h2 className="text-xl font-bold text-gray-900">
            {paddockName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ~90 fotografías satelitales desde 2019
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between text-[11px] font-semibold text-gray-400 mb-2">
            <span>{phases[phase]}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Time elapsed */}
        <p className="text-xs text-gray-400">
          Procesando… {elapsed}s transcurridos — esto puede tomar 2–5 minutos
        </p>

        <p className="text-[11px] text-gray-400 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          ⚡ El proceso continúa en segundo plano. Podés cerrar esta ventana y los datos aparecerán al recargar.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TimeMachinePage() {
  const [paddocks, setPaddocks] = useState<{ id: string; name: string }[]>([])
  const [selectedPaddock, setSelectedPaddock] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string>('NDVI')
  const [sliderIndex, setSliderIndex] = useState(0)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [backfillDone, setBackfillDone] = useState(false)

  const { monthlyData, baseline, loading, error } = useTimeMachine(selectedPaddock, selectedMetric)

  const selectedPaddockName = paddocks.find(p => p.id === selectedPaddock)?.name || 'Potrero'

  useEffect(() => {
    async function loadPaddocks() {
      try {
        const res = await apiFetch('/api/paddocks')
        if (res.ok) {
          const data = await res.json()
          if (data.paddocks?.length > 0) {
            setPaddocks(data.paddocks)
            setSelectedPaddock(data.paddocks[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load paddocks', err)
      }
    }
    loadPaddocks()
  }, [])

  useEffect(() => {
    if (monthlyData.length > 0) {
      setSliderIndex(monthlyData.length - 1)
    } else {
      setSliderIndex(0)
    }
  }, [monthlyData])

  // Poll for data after backfill is dispatched
  useEffect(() => {
    if (!backfillDone) return
    const poll = setInterval(async () => {
      if (!selectedPaddock) return
      try {
        const res = await apiFetch(
          `/api/metrics/trends?paddock_id=${selectedPaddock}&metric_type=${selectedMetric}&limit=1`
        )
        if (res.ok) {
          const d = await res.json()
          if ((d.trends || []).length > 0) {
            clearInterval(poll)
            setIsBackfilling(false)
            window.location.reload()
          }
        }
      } catch {}
    }, 15_000)
    return () => clearInterval(poll)
  }, [backfillDone, selectedPaddock, selectedMetric])

  const handleBackfill = useCallback(async () => {
    if (!selectedPaddock) return
    setIsBackfilling(true)
    setBackfillDone(false)
    try {
      const res = await apiFetch('/api/metrics/backfill', {
        method: 'POST',
        body: JSON.stringify({ paddock_id: selectedPaddock, year_from: 2019 }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al iniciar el backfill.')
        setIsBackfilling(false)
      } else {
        // Fire-and-forget: server responds immediately, backfill runs in BG
        setBackfillDone(true)
      }
    } catch (err) {
      console.error(err)
      alert('Error al conectar con el servidor')
      setIsBackfilling(false)
    }
  }, [selectedPaddock])

  const currentPoint = monthlyData[sliderIndex]
  const currentValue = currentPoint?.value ?? 0
  const pctChange =
    baseline && baseline !== 0 ? ((currentValue - baseline) / baseline) * 100 : 0

  return (
    <>
      {/* Full-screen loading overlay */}
      {isBackfilling && <BackfillLoader paddockName={selectedPaddockName} />}

      <div className="p-4 md:p-6 space-y-5" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-green-600">
                Time Machine
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Evolución histórica
            </h1>
            <p className="text-sm text-gray-500 mt-1 leading-snug">
              Análisis retrospectivo desde 2019 · Cumplimiento EUDR · ~90 imágenes satelitales
            </p>
          </div>
          <Link
            href="/dashboard/metrics"
            className="flex-shrink-0 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
        </div>

        {/* ── Selectors ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Potrero
            </label>
            <select
              value={selectedPaddock || ''}
              onChange={(e) => setSelectedPaddock(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
            >
              {paddocks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Métrica
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {monthlyData.length > 0 && (
            <button
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isBackfilling ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          )}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
            <div className="h-[300px] rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : monthlyData.length === 0 && selectedPaddock ? (
          /* ── Empty State ──────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-5 py-16 px-6 text-center bg-gradient-to-b from-gray-50 to-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
              <Satellite className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800 mb-1">
                Sin historial para {selectedPaddockName}
              </p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                Generá ~90 snapshots satelitales mes a mes desde 2019. El proceso tarda 2–5 minutos y corre en segundo plano.
              </p>
            </div>

            {/* Metrics preview */}
            <div className="flex gap-3 flex-wrap justify-center">
              {['NDVI', 'EVI', 'SAVI', 'NDMI'].map((m) => (
                <span
                  key={m}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100"
                >
                  {m}
                </span>
              ))}
            </div>

            <button
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="flex items-center gap-2 px-7 py-3.5 bg-green-600 text-white text-sm font-bold rounded-2xl hover:bg-green-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-green-200"
            >
              {isBackfilling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Iniciando…
                </>
              ) : (
                <>
                  <Satellite className="w-4 h-4" />
                  Generar Historial (Backfill)
                </>
              )}
            </button>

            <p className="text-[11px] text-gray-400">
              Solo disponible para plan Holístico y Latifundio
            </p>
          </div>
        ) : monthlyData.length > 0 ? (
          /* ── Data view ────────────────────────────────────────────────── */
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* Baseline */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Baseline 2019
                </span>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  {baseline !== null ? baseline.toFixed(3) : '—'}
                </span>
                <span className="text-[11px] text-gray-400">{selectedMetric} promedio EUDR</span>
              </div>

              {/* Current */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Valor Actual
                </span>
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: getMetricColor(selectedMetric, currentValue) }}
                >
                  {currentValue.toFixed(3)}
                </span>
                <span className="text-[11px] text-gray-400">{currentPoint?.month || '—'}</span>
              </div>

              {/* Delta */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Δ Mejora
                </span>
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: pctChange >= 0 ? '#16a34a' : '#dc2626' }}
                >
                  {pctChange > 0 ? '+' : ''}
                  {pctChange.toFixed(1)}%
                </span>
                <span className="text-[11px] text-gray-400">vs. baseline 2019</span>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Evolución temporal — {selectedMetric}</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">{monthlyData.length} mediciones registradas</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {monthlyData.length} meses
                </span>
              </div>
              <TimeChart data={monthlyData} baseline={baseline} metricType={selectedMetric} />
              <TimeSlider
                data={monthlyData}
                selectedIndex={sliderIndex}
                onChange={setSliderIndex}
                metricType={selectedMetric}
              />
            </div>

            {/* ── Snapshot gallery ──────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">
                    Galería de snapshots satelitales
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {selectedMetric} · {monthlyData.length} fotografías desde{' '}
                    {monthlyData[0]?.month}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                  <Leaf className="w-3.5 h-3.5 text-green-500" />
                  Sentinel-2
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {monthlyData.map((point, idx) => (
                  <SnapshotCard
                    key={point.period_month}
                    point={point}
                    metricType={selectedMetric}
                    isBaseline={idx === 0}
                    isLatest={idx === monthlyData.length - 1}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
