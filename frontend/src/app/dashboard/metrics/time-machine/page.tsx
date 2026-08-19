'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Activity, TrendingUp, AlertTriangle, Leaf, Droplets, RefreshCw, X, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/apiFetch'
import { useTimeMachine } from '../hooks/useTimeMachine'
import { TimeChart } from '../components/TimeChart'
import { TimeSlider } from '../components/TimeSlider'

const METRICS = ['NDVI', 'EVI', 'SAVI', 'NDMI']

function getNdviColor(val: number): string {
  if (val >= 0.6) return '#16a34a'
  if (val >= 0.4) return '#65a30d'
  if (val >= 0.2) return '#ca8a04'
  return '#dc2626'
}
function getNdviLabel(val: number): string {
  if (val >= 0.6) return 'Óptimo'
  if (val >= 0.4) return 'Bueno'
  if (val >= 0.2) return 'Moderado'
  return 'Bajo'
}
function getMetricColor(metricType: string, val: number): string {
  if (['NDVI','EVI','SAVI','FCOVER','BSI'].includes(metricType)) return getNdviColor(val)
  if (metricType === 'NDMI' || metricType === 'SOIL_MOISTURE') return '#2563eb'
  if (metricType === 'SOC_ESTIMATED') return '#92400e'
  if (metricType === 'COMPACTION_PROXY') return '#6b7280'
  return '#16a34a'
}
function formatMonthLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// ─── Snapshot card ────────────────────────────────────────────────────────────
interface SnapshotCardProps {
  point: { month: string; value: number; period_month: string }
  metricType: string
  isBaseline?: boolean
  isLatest?: boolean
  index: number
}
function SnapshotCard({ point, metricType, isBaseline, isLatest, index }: SnapshotCardProps) {
  const color    = getMetricColor(metricType, point.value)
  const label    = ['NDVI','EVI','SAVI'].includes(metricType) ? getNdviLabel(point.value) : null
  const barWidth = Math.min(100, Math.max(0, point.value * 100))
  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
      style={{ animation: `fadeSlideIn 0.3s ease-out ${index * 0.02}s both` }}
    >
      <div style={{ height: 3, background: color }} />
      <div className="relative h-24 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}06 100%)` }}>
        <Leaf className="w-7 h-7 opacity-15" style={{ color }} />
        {isBaseline && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
            Baseline
          </span>
        )}
        {isLatest && !isBaseline && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-green-100 text-green-700">
            Actual
          </span>
        )}
        <span className="absolute bottom-1.5 right-2 text-[10px] font-semibold text-gray-400">
          {formatMonthLabel(point.period_month)}
        </span>
      </div>
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{metricType}</span>
          {label && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: color + '20', color }}>
              {label}
            </span>
          )}
        </div>
        <span className="text-xl font-bold tabular-nums leading-none" style={{ color }}>
          {point.value.toFixed(3)}
        </span>
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}

// ─── Background banner (shown when user closes overlay) ──────────────────────
function BackgroundBanner({ paddockName, onCancel }: { paddockName: string; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-2xl">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
        <RefreshCw className="w-3.5 h-3.5 text-green-600 animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-800">Generando historial en segundo plano</p>
        <p className="text-[11px] text-green-600 truncate">{paddockName} · Te avisaremos cuando esté listo</p>
      </div>
      <button onClick={onCancel} className="flex-shrink-0 p-1 rounded-full hover:bg-green-200 transition-colors">
        <X className="w-4 h-4 text-green-600" />
      </button>
    </div>
  )
}

// ─── Fullscreen loading overlay ───────────────────────────────────────────────
function BackfillLoader({
  paddockName,
  elapsed,
  onMinimize,
}: {
  paddockName: string
  elapsed: number
  onMinimize: () => void
}) {
  const phases = [
    'Conectando con satélites Sentinel-2…',
    'Buscando imágenes históricas 2019–2021…',
    'Procesando 2022–2023 · Calculando NDVI, EVI, SAVI…',
    'Procesando 2024–2025 · Calculando humedad y suelo…',
    'Finalizando · Guardando snapshots en la base de datos…',
  ]
  const phase    = Math.min(phases.length - 1, Math.floor(elapsed / 50))
  // Progress: start fast, slow down near 90%, never exceed 90% until done
  const rawPct   = Math.min(90, (elapsed / 180) * 90)
  const progress = Math.round(rawPct)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/96 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 max-w-sm w-full px-8 text-center">
        {/* Spinner */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-green-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-green-600 border-r-green-300"
            style={{ animation: 'spin 1.2s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Leaf className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Labels */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-green-600 mb-1">
            Generando Historial
          </p>
          <h2 className="text-xl font-bold text-gray-900">{paddockName}</h2>
          <p className="text-sm text-gray-400 mt-1">~90 imágenes satelitales desde 2019</p>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between text-[11px] font-medium text-gray-400 mb-2">
            <span className="text-left leading-tight">{phases[phase]}</span>
            <span className="flex-shrink-0 ml-2 font-bold text-gray-600">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-[2000ms]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400">{elapsed}s procesando · puede tomar 3–5 min</p>

        {/* Minimize button */}
        <button
          onClick={onMinimize}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Bell className="w-4 h-4" />
          Continuar en segundo plano · Te avisamos al terminar
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TimeMachinePage() {
  const [paddocks, setPaddocks]   = useState<{ id: string; name: string }[]>([])
  const [selectedPaddock, setSelectedPaddock] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric]   = useState<string>('NDVI')
  const [sliderIndex, setSliderIndex]         = useState(0)

  // Backfill state
  const [isBackfilling, setIsBackfilling]     = useState(false)
  const [showOverlay, setShowOverlay]         = useState(false)
  const [elapsed, setElapsed]                 = useState(0)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevCountRef = useRef(0)

  const { monthlyData, baseline, loading, error } = useTimeMachine(selectedPaddock, selectedMetric)
  const selectedPaddockName = paddocks.find(p => p.id === selectedPaddock)?.name || 'Potrero'

  // Load paddocks
  useEffect(() => {
    apiFetch('/api/paddocks').then(async res => {
      if (!res.ok) return
      const data = await res.json()
      if (data.paddocks?.length > 0) {
        setPaddocks(data.paddocks)
        setSelectedPaddock(data.paddocks[0].id)
      }
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (monthlyData.length > 0) setSliderIndex(monthlyData.length - 1)
    else setSliderIndex(0)
  }, [monthlyData])

  // ── Polling: check if new snapshots arrived ─────────────────────────────
  const startPolling = useCallback((paddockId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    prevCountRef.current = 0

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/metrics/trends?paddock_id=${paddockId}&metric_type=NDVI&limit=5&order=desc`)
        if (!res.ok) return
        const d = await res.json()
        const count = (d.trends || []).length

        if (count > 0 && count > prevCountRef.current) {
          prevCountRef.current = count
          // Data arrived! Notify and reload
          clearInterval(pollRef.current!)
          clearInterval(timerRef.current!)
          setIsBackfilling(false)
          setShowOverlay(false)
          toast.success('✅ Historial generado', {
            description: `${selectedPaddockName} ya tiene datos satelitales. Recargando…`,
            duration: 5000,
          })
          setTimeout(() => window.location.reload(), 1500)
        }
      } catch {}
    }, 12_000)
  }, [selectedPaddockName])

  // Cleanup on unmount
  useEffect(() => () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  // Elapsed timer
  const startTimer = useCallback(() => {
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }, [])

  const handleBackfill = useCallback(async () => {
    if (!selectedPaddock) return
    setIsBackfilling(true)
    setShowOverlay(true)
    startTimer()

    try {
      const res  = await apiFetch('/api/metrics/backfill', {
        method: 'POST',
        body: JSON.stringify({ paddock_id: selectedPaddock, year_from: 2019 }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al iniciar el backfill')
        setIsBackfilling(false)
        setShowOverlay(false)
        clearInterval(timerRef.current!)
        return
      }
      // Backend accepted and is processing in background via after()
      // Start polling for results
      startPolling(selectedPaddock)
    } catch (err) {
      console.error(err)
      toast.error('Error al conectar con el servidor')
      setIsBackfilling(false)
      setShowOverlay(false)
      clearInterval(timerRef.current!)
    }
  }, [selectedPaddock, startTimer, startPolling])

  const handleMinimize = useCallback(() => {
    setShowOverlay(false)
    // Polling continues in background; toast will fire when done
    toast.info('⏳ Procesando en segundo plano', {
      description: 'Te avisaremos con una notificación cuando el historial esté listo.',
      duration: 8000,
    })
  }, [])

  const handleCancelBanner = useCallback(() => {
    setIsBackfilling(false)
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    toast.info('Backfill cancelado. Podés reiniciarlo cuando quieras.')
  }, [])

  // ─── Derived values ──────────────────────────────────────────────────────
  const currentPoint = monthlyData[sliderIndex]
  const currentValue = currentPoint?.value ?? 0
  const pctChange = baseline && baseline !== 0
    ? ((currentValue - baseline) / baseline) * 100 : 0

  return (
    <>
      {/* Full-screen overlay */}
      {showOverlay && isBackfilling && (
        <BackfillLoader paddockName={selectedPaddockName} elapsed={elapsed} onMinimize={handleMinimize} />
      )}

      <div className="space-y-5" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-green-600">
                Time Machine
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Evolución histórica
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Análisis retrospectivo desde 2019 · EUDR · Sentinel-2
            </p>
          </div>
          <Link href="/dashboard/metrics"
            className="flex-shrink-0 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
        </div>

        {/* Background processing banner */}
        {isBackfilling && !showOverlay && (
          <BackgroundBanner paddockName={selectedPaddockName} onCancel={handleCancelBanner} />
        )}

        {/* ── Selectors ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Potrero</label>
            <select value={selectedPaddock || ''} onChange={e => setSelectedPaddock(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all">
              {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Métrica</label>
            <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all">
              {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {monthlyData.length > 0 && !isBackfilling && (
            <button onClick={handleBackfill}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[0,1,2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
            <div className="h-[280px] rounded-2xl bg-gray-100 animate-pulse" />
          </div>

        ) : monthlyData.length === 0 && selectedPaddock && !isBackfilling ? (
          /* ── Empty state ─────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-5 py-14 px-6 text-center bg-gradient-to-b from-gray-50 to-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-800 mb-1">Sin historial para {selectedPaddockName}</p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                Generá ~90 snapshots satelitales mensuales desde 2019. El proceso corre en paralelo y tarda 3–5 minutos.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {['NDVI','EVI','SAVI','NDMI','SOIL_MOISTURE','SOC_ESTIMATED','COMPACTION_PROXY'].map(m => (
                <span key={m} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-100">{m}</span>
              ))}
            </div>
            <button onClick={handleBackfill}
              className="flex items-center gap-2 px-7 py-3.5 bg-green-600 text-white text-sm font-bold rounded-2xl hover:bg-green-700 active:scale-95 transition-all shadow-md shadow-green-200">
              <Leaf className="w-4 h-4" />
              Generar Historial (Backfill)
            </button>
            <p className="text-[11px] text-gray-400">Solo disponible para plan Holístico y Latifundio</p>
          </div>

        ) : monthlyData.length > 0 ? (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Baseline 2019
                </span>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  {baseline !== null ? baseline.toFixed(3) : '—'}
                </span>
                <span className="text-[11px] text-gray-400">{selectedMetric} promedio</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Valor Actual
                </span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: getMetricColor(selectedMetric, currentValue) }}>
                  {currentValue.toFixed(3)}
                </span>
                <span className="text-[11px] text-gray-400">{currentPoint?.month || '—'}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Δ Mejora
                </span>
                <span className="text-2xl font-bold tabular-nums"
                  style={{ color: pctChange >= 0 ? '#16a34a' : '#dc2626' }}>
                  {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                </span>
                <span className="text-[11px] text-gray-400">vs. baseline 2019</span>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Evolución temporal — {selectedMetric}</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">{monthlyData.length} mediciones</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  <Activity className="w-3.5 h-3.5" />
                  {monthlyData.length} meses
                </span>
              </div>
              <TimeChart data={monthlyData} baseline={baseline} metricType={selectedMetric} />
              <TimeSlider data={monthlyData} selectedIndex={sliderIndex} onChange={setSliderIndex} metricType={selectedMetric} />
            </div>

            {/* Snapshot gallery */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Galería de snapshots satelitales</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {selectedMetric} · {monthlyData.length} fotografías desde {monthlyData[0]?.month}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                  <Leaf className="w-3.5 h-3.5 text-green-500" /> Sentinel-2
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {monthlyData.map((point, idx) => (
                  <SnapshotCard key={point.period_month} point={point} metricType={selectedMetric}
                    isBaseline={idx === 0} isLatest={idx === monthlyData.length - 1} index={idx} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
