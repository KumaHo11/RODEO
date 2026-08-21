'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import Link from 'next/link'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  FileText, Leaf, MapPin, ChevronRight, RefreshCw, Download,
  AlertCircle, TrendingUp, Package, Layers, XCircle, ScanLine,
  Image as ImageIcon,
} from 'lucide-react'
import clsx from 'clsx'

interface ValidationSummary {
  total_paddocks:  number
  valid_for_dds:   number
  missing_geometry: number
  deforested:      number
  at_risk:         number
  clean:           number
  pending_check:   number
  ready_for_dds:   boolean
}

interface PaddockResult {
  paddock_id:              string
  paddock_name:            string
  has_geometry:            boolean
  eudr_area_ha:            number | null
  eudr_geom_type:          string
  deforestation_status:    string | null
  deforestation_confidence: string | null
  is_valid_for_eudr:       boolean
  validation_issues:       string[]
}

interface DocsStats  { total: number; verified: number; expiring_soon: number }
interface FeedStats  { total: number; compliant: number; compliance_rate: number }
interface DdsHistory { id: string; status: string; created_at: string; paddock_count: number }

// ─── Tarjeta de imagen satelital mensual ──────────────────────────────────────
interface MonthlyImageCardProps {
  paddockId:   string
  geojson:     any
  month:       number
  year:        number
  label:       string
}

function MonthlyImageCard({ paddockId, geojson, month, year, label }: MonthlyImageCardProps) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!geojson) return
    const params = new URLSearchParams({
      paddock_id: paddockId,
      month:      String(month),
      year:       String(year),
      geojson:    encodeURIComponent(JSON.stringify(geojson)),
    })
    apiFetch(`/api/satellite-thumbnail?${params.toString()}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [paddockId, geojson, month, year])

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.thumbnail_url}
            alt={`Sentinel-2 ${label}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
            <ImageIcon className="w-5 h-5 text-gray-300" />
            <span className="text-[8px] text-gray-400 text-center leading-tight">
              {data?.reason === 'no_scenes' ? 'Sin imagen\ndisponible' : 'Error de carga'}
            </span>
          </div>
        )}
        {data?.cloud_cover != null && (
          <span className="absolute bottom-1 right-1 text-[7px] bg-black/50 text-white px-1 py-0.5 rounded">
            ☁ {Math.round(data.cloud_cover)}%
          </span>
        )}
      </div>
      {data?.capture_date && (
        <span className="text-[8px] text-gray-400 truncate">
          {new Date(data.capture_date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
        </span>
      )}
    </div>
  )
}

// ─── Panel de evidencia satelital por potrero ─────────────────────────────────
interface SatelliteEvidencePanelProps {
  paddock: PaddockResult
  geojson: any
}

function SatelliteEvidencePanel({ paddock, geojson }: SatelliteEvidencePanelProps) {
  // Mostrar: dic-2020 (baseline), y cada año post-2020 en época seca (julio)
  const periods = [
    { month: 10, year: 2020, label: 'Oct 2020\n(Baseline)' },
    { month:  7, year: 2021, label: 'Jul 2021' },
    { month:  7, year: 2022, label: 'Jul 2022' },
    { month:  7, year: 2023, label: 'Jul 2023' },
    { month:  7, year: 2024, label: 'Jul 2024' },
  ]

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <ScanLine className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
          Evidencia satelital Sentinel-2 — {paddock.paddock_name}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {periods.map(p => (
          <MonthlyImageCard
            key={`${p.year}-${p.month}`}
            paddockId={paddock.paddock_id}
            geojson={geojson}
            month={p.month}
            year={p.year}
            label={p.label}
          />
        ))}
      </div>
      <p className="text-[9px] text-gray-400 mt-2">
        * Época seca (julio) para reducir efecto de lluvias en el Chaco. Composites RGB True Color (B04/B03/B02).
      </p>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function EUDRDashboardPage() {
  const { user } = useAuth()

  const [validation, setValidation]     = useState<{ summary: ValidationSummary; paddocks: PaddockResult[] } | null>(null)
  const [docsStats, setDocsStats]       = useState<DocsStats | null>(null)
  const [feedStats, setFeedStats]       = useState<FeedStats | null>(null)
  const [ddsHistory, setDdsHistory]     = useState<DdsHistory[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [generatingDDS, setGeneratingDDS] = useState(false)
  const [checkingAll, setCheckingAll]   = useState(false)
  const [checkProgress, setCheckProgress] = useState<{ done: number; total: number } | null>(null)
  // Potrero expandido para mostrar evidencia satelital
  const [expandedPaddock, setExpandedPaddock] = useState<string | null>(null)
  // GeoJSON cache por paddock (cargado del GET /api/paddocks)
  const [paddockGeoms, setPaddockGeoms] = useState<Record<string, any>>({})

  const load = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    setError(null)
    try {
      const [valRes, docsRes, feedRes, ddsRes, geoRes] = await Promise.allSettled([
        apiFetch('/api/eudr/validate-paddocks').then(r => r.json()),
        apiFetch('/api/eudr/documents').then(async r => {
          const d = await r.json()
          const docs = d.documents ?? []
          return {
            total:         docs.length,
            verified:      docs.filter((x: any) => x.verified).length,
            expiring_soon: docs.filter((x: any) => x.expiry_status === 'EXPIRING_SOON' || x.expiry_status === 'EXPIRED').length,
          }
        }),
        apiFetch('/api/eudr/feed-batches').then(r => r.json()),
        apiFetch('/api/eudr/generate-dds').then(r => r.json()),
        // Cargar geometrías para el panel satelital
        apiFetch('/api/paddocks').then(r => r.json()),
      ])

      if (valRes.status === 'fulfilled')  setValidation(valRes.value)
      if (docsRes.status === 'fulfilled') setDocsStats(docsRes.value)
      if (feedRes.status === 'fulfilled') {
        const s = feedRes.value.stats
        setFeedStats(s ? { total: s.total, compliant: s.compliant, compliance_rate: s.compliance_rate } : null)
      }
      if (ddsRes.status === 'fulfilled') {
        setDdsHistory((ddsRes.value.submissions ?? []).slice(0, 5))
      }
      if (geoRes.status === 'fulfilled') {
        const geoms: Record<string, any> = {}
        for (const p of (geoRes.value.paddocks ?? [])) {
          if (p.geometry || p.boundary) geoms[p.id] = p.geometry ?? p.boundary
        }
        setPaddockGeoms(geoms)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Análisis masivo de potreros pendientes ────────────────────────────────
  const handleRunAllChecks = useCallback(async () => {
    const pendingPaddocks = (validation?.paddocks ?? []).filter(
      p => !p.deforestation_status || p.deforestation_status === 'PENDING'
    )
    if (pendingPaddocks.length === 0) return

    setCheckingAll(true)
    setCheckProgress({ done: 0, total: pendingPaddocks.length })

    // Procesar en batches de 3 para no saturar el API
    const BATCH_SIZE = 3
    for (let i = 0; i < pendingPaddocks.length; i += BATCH_SIZE) {
      const batch = pendingPaddocks.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(
        batch.map(p =>
          apiFetch('/api/deforestation/check', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ paddock_id: p.paddock_id }),
          })
        )
      )
      setCheckProgress(prev => prev ? { ...prev, done: Math.min(i + BATCH_SIZE, pendingPaddocks.length) } : null)
    }

    setCheckingAll(false)
    setCheckProgress(null)
    await load() // Refrescar validación
  }, [validation?.paddocks, load])

  // ── Análisis individual ───────────────────────────────────────────────────
  const handleCheckPaddock = useCallback(async (paddockId: string) => {
    try {
      await apiFetch('/api/deforestation/check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paddock_id: paddockId }),
      })
      await load()
    } catch (e: any) {
      console.error('[EUDR] check paddock error:', e.message)
    }
  }, [load])

  const handleGenerateDDS = async () => {
    if (!user) return
    setGeneratingDDS(true)
    try {
      const res  = await apiFetch('/api/eudr/generate-dds', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (data.submission_id) {
        window.open(`/api/eudr/dossier?submission_id=${data.submission_id}`, '_blank')
        load()
      } else {
        alert('Error generando DDS: ' + (data.error ?? 'Error desconocido'))
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setGeneratingDDS(false)
    }
  }

  const handleDownloadGeoJSON = () => { window.open('/api/eudr/traces-geojson', '_blank') }

  const s = validation?.summary
  const pendingCount = s?.pending_check ?? 0

  const eudrScore = s
    ? Math.round(
        (s.clean / Math.max(s.total_paddocks, 1)) * 40 +
        (s.missing_geometry === 0 ? 20 : 0) +
        (docsStats?.total ? Math.min(20, docsStats.total * 4) : 0) +
        ((feedStats?.compliance_rate ?? 0) / 100 * 20)
      )
    : 0

  const scoreColor = eudrScore >= 80 ? 'text-green-600' : eudrScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const scoreBg    = eudrScore >= 80 ? 'bg-green-50 border-green-200' : eudrScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Cumplimiento EUDR</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reglamento UE 2023/1115 · Declaraciones de diligencia debida (DDS)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">

          {/* Botón: Verificar deforestación en potreros sin análisis */}
          {pendingCount > 0 && (
            <button
              onClick={handleRunAllChecks}
              disabled={checkingAll}
              title="Consulta GFW + NDVI/BSI satelital para detectar deforestación post-31/12/2020 en cada potrero pendiente"
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-60"
            >
              <ScanLine className={clsx('w-3.5 h-3.5', checkingAll && 'animate-pulse')} />
              {checkingAll && checkProgress
                ? `Verificando... ${checkProgress.done}/${checkProgress.total}`
                : `Verificar deforestación (${pendingCount} sin analizar)`
              }
            </button>
          )}

          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            Actualizar
          </button>

          <button
            onClick={handleGenerateDDS}
            disabled={generatingDDS || !s?.ready_for_dds}
            title={!s?.ready_for_dds ? 'Todos los potreros deben estar LIMPIOS para generar la DDS' : undefined}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-sm',
              s?.ready_for_dds
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <FileText className="w-4 h-4" />
            {generatingDDS ? 'Generando...' : 'Generar DDS + PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Banner alerta si hay potreros deforestados ─────────────────── */}
      {(s?.deforested ?? 0) > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-800">
              {s!.deforested} potrero{s!.deforested !== 1 ? 's' : ''} con deforestación post-2020 detectada
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Estos potreros están bloqueados para exportación DDS según el Reglamento UE 2023/1115
              (corte: 31/12/2020). Revisá la evidencia satelital y cargá documentación de descargo si corresponde.
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={clsx('col-span-2 sm:col-span-1 p-6 rounded-2xl border shadow-sm', scoreBg)}>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Score EUDR</h3>
          <div className={clsx('text-3xl font-black tabular-nums', scoreColor)}>
            {eudrScore}<span className="text-lg font-normal text-gray-500">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {eudrScore >= 80 ? 'Listo para DDS' : eudrScore >= 50 ? 'Requiere mejoras' : 'No apto aún'}
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Potreros</h3>
          <div className="text-3xl font-black text-gray-950 tabular-nums">
            {s?.clean ?? 0}<span className="text-lg font-normal text-gray-500">/{s?.total_paddocks ?? 0}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Limpios de deforestación</p>
          {(s?.deforested ?? 0) > 0 && (
            <p className="text-[10px] font-black text-red-600 mt-1 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {s?.deforested} NO CONFORME{s!.deforested !== 1 ? 'S' : ''}
            </p>
          )}
          {(s?.at_risk ?? 0) > 0 && (
            <p className="text-[10px] font-bold text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {s?.at_risk} en riesgo
            </p>
          )}
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Documentos</h3>
          <div className="text-3xl font-black text-gray-950 tabular-nums">{docsStats?.total ?? 0}</div>
          <p className="text-xs text-gray-500 mt-2">{docsStats?.verified ?? 0} verificados</p>
          {(docsStats?.expiring_soon ?? 0) > 0 && (
            <p className="text-[10px] font-black text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {docsStats?.expiring_soon} por vencer
            </p>
          )}
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Insumos</h3>
          <div className="text-3xl font-black text-gray-950 tabular-nums">
            {feedStats?.compliance_rate ?? 0}<span className="text-lg font-normal text-gray-500">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{feedStats?.compliant ?? 0}/{feedStats?.total ?? 0} certificados</p>
        </div>
      </div>

      {/* ── Grid: tabla de potreros + acciones rápidas ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Tabla de potreros */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-black text-gray-900">Validación de potreros</h2>
            </div>
            <span className={clsx(
              'text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1',
              s?.ready_for_dds ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            )}>
              {s?.ready_for_dds
                ? <><CheckCircle2 className="w-3 h-3" /> Listo para DDS</>
                : <><AlertTriangle className="w-3 h-3" /> Pendiente</>
              }
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-black text-gray-400 uppercase tracking-widest text-[9px]">Potrero</th>
                  <th className="text-left px-4 py-2.5 font-black text-gray-400 uppercase tracking-widest text-[9px]">Área (ha)</th>
                  <th className="text-left px-4 py-2.5 font-black text-gray-400 uppercase tracking-widest text-[9px]">Tipo GIS</th>
                  <th className="text-left px-4 py-2.5 font-black text-gray-400 uppercase tracking-widest text-[9px]">Deforestación</th>
                  <th className="text-left px-4 py-2.5 font-black text-gray-400 uppercase tracking-widest text-[9px]">EUDR</th>
                  <th className="text-left px-4 py-2.5 font-black text-gray-400 uppercase tracking-widest text-[9px]">Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {(validation?.paddocks ?? []).map(p => (
                  <Fragment key={p.paddock_id}>
                    <tr
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-bold text-gray-800">{p.paddock_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {p.eudr_area_ha != null ? p.eudr_area_ha.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={clsx(
                          'inline-block px-2 py-0.5 rounded-full text-[9px] font-black',
                          p.eudr_geom_type === 'POLYGON' ? 'bg-blue-100 text-blue-700' :
                          p.eudr_geom_type === 'POINT'   ? 'bg-gray-100 text-gray-600' :
                          p.eudr_geom_type === 'MISSING' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {p.eudr_geom_type === 'MISSING'
                            ? <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sin geometría</span>
                            : p.eudr_geom_type === 'INVALID'
                            ? <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Inválida</span>
                            : p.eudr_geom_type}
                        </span>
                      </td>

                      {/* ── Columna de estado de deforestación ── */}
                      <td className="px-4 py-2.5">
                        {p.deforestation_status === 'CLEAN' ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Limpio
                          </span>
                        ) : p.deforestation_status === 'DEFORESTED' ? (
                          <span className="flex items-center gap-1 text-red-700 font-black bg-red-50 px-2 py-0.5 rounded-full text-[10px]">
                            <XCircle className="w-3.5 h-3.5" /> NO CONFORME
                          </span>
                        ) : p.deforestation_status === 'AT_RISK' ? (
                          <span className="flex items-center gap-1 text-amber-600 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" /> En riesgo
                          </span>
                        ) : (
                          // Sin análisis todavía — botón para correr verificación satelital
                          <button
                            onClick={() => handleCheckPaddock(p.paddock_id)}
                            title="Consultar GFW + NDVI/BSI para detectar deforestación post-2020"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-[10px] font-bold transition-colors"
                          >
                            <ScanLine className="w-3.5 h-3.5" /> Verificar ahora
                          </button>
                        )}
                      </td>

                      {/* ── Columna EUDR final ── */}
                      <td className="px-4 py-2.5">
                        {p.deforestation_status === 'DEFORESTED' ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : p.is_valid_for_eudr ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="group relative cursor-help">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          </div>
                        )}
                      </td>

                      {/* ── Columna evidencia satelital ── */}
                      <td className="px-4 py-2.5">
                        {paddockGeoms[p.paddock_id] && (
                          <button
                            onClick={() => setExpandedPaddock(prev => prev === p.paddock_id ? null : p.paddock_id)}
                            className={clsx(
                              'flex items-center gap-1 text-[10px] font-bold transition-colors px-2 py-0.5 rounded-lg',
                              expandedPaddock === p.paddock_id
                                ? 'bg-violet-100 text-violet-700'
                                : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'
                            )}
                          >
                            <ImageIcon className="w-3 h-3" />
                            {expandedPaddock === p.paddock_id ? 'Ocultar' : 'Ver'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Panel de evidencia satelital (expandible) */}
                    {expandedPaddock === p.paddock_id && paddockGeoms[p.paddock_id] && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-4">
                          <SatelliteEvidencePanel
                            paddock={p}
                            geojson={paddockGeoms[p.paddock_id]}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}

                {(validation?.paddocks ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                      No hay potreros registrados. <Link href="/dashboard/mi-campo" className="text-green-600 font-bold">Ir a Potreros →</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Columna derecha: acciones + historial ───────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">Acciones rápidas</h2>
            <div className="space-y-2">
              <Link href="/dashboard/eudr/documentos"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-blue-700">Bóveda Documental</p>
                    <p className="text-[10px] text-gray-400">{docsStats?.total ?? 0} documentos</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" />
              </Link>

              <Link href="/dashboard/eudr/insumos"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-violet-50 hover:text-violet-700 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-violet-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-violet-700">Insumos / Suplementos</p>
                    <p className="text-[10px] text-gray-400">{feedStats?.total ?? 0} lotes registrados</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400" />
              </Link>

              <Link href="/dashboard/eudr/exportar"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-green-50 hover:text-green-700 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-green-700">Exportar DDS / TRACES-NT</p>
                    <p className="text-[10px] text-gray-400">GeoJSON + PDF Dossier</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-green-400" />
              </Link>

              <button onClick={handleDownloadGeoJSON}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-gray-500" />
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-800">Descargar GeoJSON</p>
                    <p className="text-[10px] text-gray-400">Formato TRACES-NT directo</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Historial DDS */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-gray-900">Historial DDS</h2>
              <Link href="/dashboard/eudr/exportar" className="text-[10px] font-bold text-green-600 hover:text-green-700">
                Ver todo →
              </Link>
            </div>
            {ddsHistory.length === 0 ? (
              <div className="text-center py-6">
                <ShieldCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Sin DDS generadas todavía</p>
                <p className="text-[10px] text-gray-300 mt-1">Completá los pasos y generá tu primera DDS</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ddsHistory.map(dds => (
                  <div key={dds.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-[11px] font-bold text-gray-700">
                        {new Date(dds.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-[9px] text-gray-400">{dds.paddock_count ?? '—'} potreros · {dds.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <span className={clsx(
                      'text-[9px] font-black px-2 py-0.5 rounded-full',
                      dds.status === 'ACCEPTED'  ? 'bg-green-100 text-green-700' :
                      dds.status === 'REJECTED'  ? 'bg-red-100 text-red-700' :
                      dds.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    )}>
                      {dds.status === 'DRAFT'     ? 'Borrador' :
                       dds.status === 'SUBMITTED' ? 'Enviada'  :
                       dds.status === 'ACCEPTED'  ? 'Aceptada' :
                       dds.status === 'REJECTED'  ? 'Rechazada': dds.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Checklist de cumplimiento ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-black text-gray-900 mb-4">Checklist de cumplimiento EUDR</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Cero Deforestación',
              ok:    (s?.deforested ?? 0) === 0 && (s?.total_paddocks ?? 0) > 0,
              desc:  s?.deforested
                ? `${s.deforested} potrero(s) NO CONFORME — bloqueado para DDS`
                : `${s?.clean ?? 0} potreros limpios (Regl. UE 2023/1115)`,
              icon: Leaf,
              danger: (s?.deforested ?? 0) > 0,
            },
            {
              label: 'Geometría GIS',
              ok:    (s?.missing_geometry ?? 0) === 0 && (s?.total_paddocks ?? 0) > 0,
              desc:  s?.missing_geometry
                ? `${s.missing_geometry} sin polígono WGS84`
                : 'Todos georreferenciados en TRACES-NT',
              icon: MapPin,
              danger: false,
            },
            {
              label: 'Documentos Legales',
              ok:    (docsStats?.total ?? 0) > 0,
              desc:  docsStats?.total
                ? `${docsStats.total} doc(s), ${docsStats.verified} verificados`
                : 'Sin documentos cargados',
              icon: FileText,
              danger: false,
            },
            {
              label: 'Insumos Certificados',
              ok:    (feedStats?.compliance_rate ?? 0) >= 100 || (feedStats?.total ?? 0) === 0,
              desc:  feedStats?.total
                ? `${feedStats.compliance_rate}% certificados EUDR`
                : 'Sin insumos registrados',
              icon: Package,
              danger: false,
            },
          ].map(item => (
            <div
              key={item.label}
              className={clsx(
                'p-4 rounded-xl border',
                item.danger ? 'bg-red-50 border-red-200' :
                item.ok     ? 'bg-green-50 border-green-200' :
                              'bg-gray-50 border-gray-200'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {item.danger
                  ? <XCircle className="w-4 h-4 text-red-600" />
                  : item.ok
                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : <AlertCircle className="w-4 h-4 text-amber-500" />
                }
                <span className={clsx(
                  'text-xs font-black',
                  item.danger ? 'text-red-800' :
                  item.ok     ? 'text-green-800' :
                                'text-gray-700'
                )}>
                  {item.label}
                </span>
              </div>
              <p className={clsx(
                'text-[11px]',
                item.danger ? 'text-red-600' :
                item.ok     ? 'text-green-600' :
                              'text-gray-500'
              )}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
