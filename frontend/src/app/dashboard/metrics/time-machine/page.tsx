'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Clock, Activity, TrendingUp, AlertTriangle, Leaf,
  Droplets, RefreshCw, X, Bell, ShieldCheck, ShieldAlert,
  Download, FileText, TreePine, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/apiFetch'
import { useTimeMachine } from '../hooks/useTimeMachine'
import { useMultiMetric, type MultiMetricPoint, type EudrStatus } from '../hooks/useMultiMetric'
import { TimeChart } from '../components/TimeChart'
import { TimeSlider } from '../components/TimeSlider'

const CHART_METRICS = ['NDVI', 'EVI', 'SAVI', 'NDMI', 'SOC_ESTIMATED', 'FCOVER']

// ─── Color helpers ─────────────────────────────────────────────────────────────
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
  if (['NDVI', 'EVI', 'SAVI', 'FCOVER', 'BSI'].includes(metricType)) return getNdviColor(val)
  if (metricType === 'NDMI' || metricType === 'SOIL_MOISTURE') return '#2563eb'
  if (metricType === 'SOC_ESTIMATED') return '#92400e'
  if (metricType === 'COMPACTION_PROXY') return '#6b7280'
  return '#16a34a'
}
function formatMonthLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// ─── SVG Polygon overlay ────────────────────────────────────────────────────────
// Converts GeoJSON polygon coordinates to an SVG path scaled to [width x height]
function geojsonToSvgPath(geojson: any, width: number, height: number): string | null {
  try {
    let coords: number[][]
    if (geojson?.type === 'Polygon') coords = geojson.coordinates[0]
    else if (geojson?.type === 'MultiPolygon') coords = geojson.coordinates[0][0]
    else if (geojson?.type === 'Feature') return geojsonToSvgPath(geojson.geometry, width, height)
    else return null

    if (!coords || coords.length < 3) return null

    const lngs = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const rangeX = maxLng - minLng || 1
    const rangeY = maxLat - minLat || 1

    const pts = coords.map(([lng, lat]) => {
      const x = ((lng - minLng) / rangeX) * (width - 4) + 2
      // Flip Y: higher lat → lower pixel Y
      const y = ((maxLat - lat) / rangeY) * (height - 4) + 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    return `M ${pts.join(' L ')} Z`
  } catch {
    return null
  }
}

// ─── Satellite image with SVG polygon overlay ──────────────────────────────────
interface SatelliteImageProps {
  sceneId: string | null
  paddockId: string
  geojson: any
  color: string
  eudrAlert: boolean
}

function SatelliteImage({ sceneId, paddockId, geojson, color, eudrAlert }: SatelliteImageProps) {
  const [imgSrc, setImgSrc]       = useState<string | null>(null)
  const [imgError, setImgError]   = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => {
    if (!sceneId || !paddockId) { setImgSrc(null); return }
    setImgError(false)
    setImgLoaded(false)
    // Build the URL — apiFetch adds auth token, but here we need a URL for <img src>
    // We'll use a data-loading approach instead: fetch via apiFetch and create an object URL
    let objectUrl: string | null = null
    let cancelled = false

    apiFetch(`/api/metrics/satellite-image?scene_id=${encodeURIComponent(sceneId)}&paddock_id=${paddockId}&width=300&height=300`)
      .then(async res => {
        if (cancelled) return
        if (!res.ok) { setImgError(true); return }
        const blob = await res.blob()
        if (cancelled) { URL.revokeObjectURL(objectUrl || '') ; return }
        objectUrl = URL.createObjectURL(blob)
        setImgSrc(objectUrl)
      })
      .catch(() => { if (!cancelled) setImgError(true) })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sceneId, paddockId])

  const W = 300, H = 112
  const svgPath = useMemo(() => geojson ? geojsonToSvgPath(geojson, W, H) : null, [geojson])

  // Gradient fallback (original behavior)
  if (!sceneId || imgError) {
    return (
      <div
        className="relative h-28 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)` }}
      >
        <TreePine className="w-7 h-7 opacity-15" style={{ color }} />
        {eudrAlert && (
          <div className="absolute inset-0 bg-red-600/10 border-b-2 border-red-500" />
        )}
      </div>
    )
  }

  return (
    <div className="relative h-28 overflow-hidden bg-gray-900">
      {/* Satellite image */}
      {imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt="Imagen satelital"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
        />
      )}

      {/* Loading skeleton */}
      {!imgLoaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}

      {/* SVG polygon overlay */}
      {svgPath && imgLoaded && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ pointerEvents: 'none' }}
        >
          <path
            d={svgPath}
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* EUDR alert overlay on image */}
      {eudrAlert && (
        <div className="absolute inset-0 bg-red-600/20 border-b-2 border-red-500" />
      )}
    </div>
  )
}

// ─── Trend arrow ───────────────────────────────────────────────────────────────
function TrendBadge({ arrow }: { arrow: '↑' | '↓' | '~' }) {
  const cls = arrow === '↑'
    ? 'text-green-600 bg-green-50'
    : arrow === '↓'
      ? 'text-red-500 bg-red-50'
      : 'text-gray-400 bg-gray-100'
  return (
    <span className={`inline-flex items-center px-1 rounded text-[10px] font-bold leading-none ${cls}`}>
      {arrow}
    </span>
  )
}

// ─── Enhanced SnapshotCard ─────────────────────────────────────────────────────
interface SnapshotCardProps {
  point: MultiMetricPoint
  geojson: any
  paddockId: string
  isBaseline?: boolean
  isLatest?: boolean
  index: number
}

function SnapshotCard({ point, geojson, paddockId, isBaseline, isLatest, index }: SnapshotCardProps) {
  // Derive primary color from NDVI
  const ndviColor = point.ndvi !== null ? getMetricColor('NDVI', point.ndvi) : '#16a34a'
  const ndviLabel = point.ndvi !== null ? getNdviLabel(point.ndvi) : null

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
      style={{ animation: `fadeSlideIn 0.3s ease-out ${index * 0.02}s both` }}
    >
      {/* Top accent bar — red if EUDR alert, green otherwise */}
      <div style={{ height: 3, background: point.eudr_alert ? '#dc2626' : ndviColor }} />

      {/* Satellite image with polygon overlay */}
      <SatelliteImage
        sceneId={point.scene_id}
        paddockId={paddockId}
        geojson={geojson}
        color={ndviColor}
        eudrAlert={point.eudr_alert}
      />

      {/* Floating badges over image */}
      <div className="absolute top-4 left-1.5 flex flex-col gap-1 z-10">
        {isBaseline && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-100/90 text-amber-700 backdrop-blur-sm">
            Baseline
          </span>
        )}
        {isLatest && !isBaseline && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-green-100/90 text-green-700 backdrop-blur-sm">
            Actual
          </span>
        )}
        {point.eudr_alert && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-red-600/90 text-white backdrop-blur-sm">
            ⚠ EUDR
          </span>
        )}
      </div>

      {/* Month label over image */}
      <span className="absolute top-[5.5rem] right-2 z-10 text-[10px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {formatMonthLabel(point.period_month)}
      </span>

      {/* Multi-metric body */}
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1">
        {/* NDVI */}
        {point.ndvi !== null ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 w-8">NDVI</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: getNdviColor(point.ndvi) }}>
              {point.ndvi.toFixed(3)}
            </span>
            <TrendBadge arrow={point.ndvi_trend} />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 w-8">NDVI</span>
            <span className="text-[10px] text-gray-300">—</span>
          </div>
        )}

        {/* EVI */}
        {point.evi !== null ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 w-8">EVI</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: getNdviColor(point.evi) }}>
              {point.evi.toFixed(3)}
            </span>
            <TrendBadge arrow={point.evi_trend} />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 w-8">EVI</span>
            <span className="text-[10px] text-gray-300">—</span>
          </div>
        )}

        {/* SOC */}
        {point.soc !== null ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 w-8">SOC</span>
            <span className="text-xs font-bold tabular-nums text-amber-700">
              {point.soc.toFixed(3)}
            </span>
            <TrendBadge arrow={point.soc_trend} />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 w-8">SOC</span>
            <span className="text-[10px] text-gray-300">—</span>
          </div>
        )}

        {/* Mini progress bar for NDVI */}
        {point.ndvi !== null && (
          <div className="h-0.5 rounded-full bg-gray-100 overflow-hidden mt-0.5">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, point.ndvi * 100))}%`, background: ndviColor }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EUDR Report Banner ────────────────────────────────────────────────────────
interface EUDRBannerProps {
  eudr: EudrStatus
  paddockName: string
}

function EUDRBanner({ eudr, paddockName }: EUDRBannerProps) {
  if (eudr.hasAlert) {
    const alertDate = eudr.alertMonth
      ? new Date(eudr.alertMonth).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      : 'período desconocido'

    return (
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 overflow-hidden">
        <div className="flex gap-3 p-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">⚠️ Alerta EUDR — Pérdida de bosque nativo detectada</p>
            <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
              Se detectó pérdida de cobertura forestal en <strong>{paddockName}</strong> a partir de{' '}
              <strong>{alertDate}</strong>. Esto puede comprometer la elegibilidad para exportación al mercado europeo
              bajo el Reglamento UE 2023/1115 (EUDR).
            </p>
            <div className="flex gap-2 flex-wrap mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                fCover &lt; 10% post-2020
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Reglamento UE 2023/1115
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-red-200 px-4 py-2.5 bg-red-50/50 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-red-500 font-medium">
            Documentar y reportar a su operador o importador
          </p>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Descargar Reporte EUDR
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-green-800">✅ EUDR: Sin deforestación detectada</p>
          <p className="text-xs text-green-600 mt-0.5 leading-relaxed">
            <strong>{paddockName}</strong> mantiene cobertura forestal estable desde el baseline de diciembre 2020.
            No se registraron eventos de deforestación o cambio de uso de suelo en el período analizado.
          </p>
          <div className="flex gap-2 flex-wrap mt-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              ✓ Libre de deforestación
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              ✓ Elegible mercado UE
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-green-200 px-4 py-2.5 bg-green-50/50 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-green-600 font-medium">
          Cumple con el Reglamento UE 2023/1115 (EUDR) · Baseline 31 dic. 2020
        </p>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 text-white text-[11px] font-bold hover:bg-green-800 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          Reporte EUDR Formal
        </button>
      </div>
    </div>
  )
}

// ─── Background banner ─────────────────────────────────────────────────────────
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

// ─── Full-screen loading overlay ───────────────────────────────────────────────
function BackfillLoader({
  paddockName, elapsed, onMinimize,
}: { paddockName: string; elapsed: number; onMinimize: () => void }) {
  const phases = [
    'Conectando con satélites Sentinel-2…',
    'Buscando imágenes históricas 2020–2021…',
    'Procesando 2022–2023 · Calculando NDVI, EVI, SAVI…',
    'Procesando 2024–2025 · Calculando humedad y suelo…',
    'Finalizando · Guardando snapshots en la base de datos…',
  ]
  const phase    = Math.min(phases.length - 1, Math.floor(elapsed / 50))
  const progress = Math.round(Math.min(90, (elapsed / 180) * 90))

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/96 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 max-w-sm w-full px-8 text-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-green-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-green-600 border-r-green-300"
            style={{ animation: 'spin 1.2s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Leaf className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-green-600 mb-1">Generando Historial</p>
          <h2 className="text-xl font-bold text-gray-900">{paddockName}</h2>
          <p className="text-sm text-gray-400 mt-1">~72 imágenes satelitales desde 2020</p>
        </div>
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
interface PaddockInfo {
  id: string
  name: string
  geojson?: any
}

export default function TimeMachinePage() {
  const [paddocks, setPaddocks]   = useState<PaddockInfo[]>([])
  const [selectedPaddock, setSelectedPaddock] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric]   = useState<string>('NDVI')
  const [sliderIndex, setSliderIndex]         = useState(0)
  const [snapshotPage, setSnapshotPage]       = useState(1)
  const ITEMS_PER_PAGE = 12

  // Backfill state
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [showOverlay, setShowOverlay]     = useState(false)
  const [elapsed, setElapsed]             = useState(0)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevCountRef = useRef(0)

  // Derived paddock info
  const selectedPaddockInfo = paddocks.find(p => p.id === selectedPaddock)
  const selectedPaddockName = selectedPaddockInfo?.name || 'Potrero'
  const selectedGeojson     = selectedPaddockInfo?.geojson || null

  // Single-metric for chart (still uses useTimeMachine for chart rendering)
  const { monthlyData, baseline, loading, error } = useTimeMachine(selectedPaddock, selectedMetric)

  // Multi-metric for gallery cards + EUDR
  const { data: multiData, eudr, loading: multiLoading } = useMultiMetric(selectedPaddock)

  // Load paddocks WITH geojson
  useEffect(() => {
    apiFetch('/api/paddocks').then(async res => {
      if (!res.ok) return
      const data = await res.json()
      if (data.paddocks?.length > 0) {
        // Fetch geojson for each paddock (paddocks endpoint may already include it)
        const enriched: PaddockInfo[] = (data.paddocks as any[]).map((p: any) => ({
          id:      p.id,
          name:    p.name,
          geojson: p.geojson || p.geometry || null,
        }))
        setPaddocks(enriched)
        setSelectedPaddock(enriched[0].id)
      }
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (monthlyData.length > 0) setSliderIndex(monthlyData.length - 1)
    else setSliderIndex(0)
    setSnapshotPage(1) // Reset pagination when metric or paddock changes
  }, [monthlyData])

  // ── Polling ─────────────────────────────────────────────────────────────────
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

  useEffect(() => () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

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
        body: JSON.stringify({ paddock_id: selectedPaddock, year_from: 2020 }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al iniciar el backfill')
        setIsBackfilling(false)
        setShowOverlay(false)
        clearInterval(timerRef.current!)
        return
      }
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

  // ── Derived values for summary cards ────────────────────────────────────────
  const currentPoint = monthlyData[sliderIndex]
  const currentValue = currentPoint?.value ?? 0
  const pctChange = baseline && baseline !== 0
    ? ((currentValue - baseline) / baseline) * 100 : 0

  const hasData = multiData.length > 0 || monthlyData.length > 0
  const isLoadingAny = loading || multiLoading

  const totalSnapshotPages = Math.ceil(multiData.length / ITEMS_PER_PAGE)
  const paginatedSnapshots = multiData.slice((snapshotPage - 1) * ITEMS_PER_PAGE, snapshotPage * ITEMS_PER_PAGE)

  return (
    <>
      {showOverlay && isBackfilling && (
        <BackfillLoader paddockName={selectedPaddockName} elapsed={elapsed} onMinimize={handleMinimize} />
      )}

      <div className="space-y-5" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-green-600">Time Machine</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Evolución histórica</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Análisis retrospectivo desde 2020 · EUDR · Sentinel-2
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

        {/* ── Selectors ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Potrero</label>
            <select
              value={selectedPaddock || ''}
              onChange={e => setSelectedPaddock(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all"
            >
              {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Gráfico</label>
            <select
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all"
            >
              {CHART_METRICS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {hasData && !isBackfilling && (
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
        {isLoadingAny ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
            <div className="h-[280px] rounded-2xl bg-gray-100 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[0,1,2,3,4,5].map(i => <div key={i} className="h-52 rounded-2xl bg-gray-100 animate-pulse" />)}
            </div>
          </div>

        ) : !hasData && selectedPaddock && !isBackfilling ? (
          /* ── Empty state ───────────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-5 py-14 px-6 text-center bg-gradient-to-b from-gray-50 to-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-[72px] h-[72px] rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-800 mb-1">Sin historial para {selectedPaddockName}</p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                Generá ~72 snapshots satelitales mensuales desde 2020. El proceso corre en paralelo y tarda 3–5 minutos.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {['NDVI', 'EVI', 'SAVI', 'NDMI', 'SOIL_MOISTURE', 'SOC_ESTIMATED', 'COMPACTION_PROXY'].map(m => (
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

        ) : hasData ? (
          <div className="space-y-5">
            {/* ── Summary cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Baseline 2020
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
                <span className="text-[11px] text-gray-400">vs. baseline 2020</span>
              </div>
            </div>

            {/* ── EUDR Banner ───────────────────────────────────────────── */}
            <EUDRBanner eudr={eudr} paddockName={selectedPaddockName} />

            {/* ── Chart ─────────────────────────────────────────────────── */}
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

            {/* ── Snapshot gallery ──────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Galería de snapshots satelitales</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    NDVI · EVI · SOC · {multiData.length} fotografías desde {multiData[0]?.month}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {eudr.hasAlert ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      <ShieldAlert className="w-3.5 h-3.5" /> Alerta EUDR
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> EUDR OK
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                    <Leaf className="w-3.5 h-3.5 text-green-500" /> Sentinel-2
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {paginatedSnapshots.map((point, idx) => (
                  <SnapshotCard
                    key={point.period_month}
                    point={point}
                    geojson={selectedGeojson}
                    paddockId={selectedPaddock || ''}
                    isBaseline={snapshotPage === 1 && idx === 0}
                    isLatest={snapshotPage === totalSnapshotPages && idx === paginatedSnapshots.length - 1}
                    index={idx}
                  />
                ))}
              </div>
              
              {/* Pagination Controls */}
              {totalSnapshotPages > 1 && (
                <div className="flex items-center justify-between mt-4 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-xs font-medium text-gray-500">
                    Página {snapshotPage} de {totalSnapshotPages}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSnapshotPage(p => Math.max(1, p - 1))}
                      disabled={snapshotPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setSnapshotPage(p => Math.min(totalSnapshotPages, p + 1))}
                      disabled={snapshotPage === totalSnapshotPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
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
