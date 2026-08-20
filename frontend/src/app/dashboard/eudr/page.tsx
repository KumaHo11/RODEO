'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import Link from 'next/link'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  FileText, Leaf, MapPin, ChevronRight, RefreshCw, Download,
  AlertCircle, TrendingUp, Package, Layers
} from 'lucide-react'
import clsx from 'clsx'

interface ValidationSummary {
  total_paddocks: number
  valid_for_dds: number
  missing_geometry: number
  deforested: number
  at_risk: number
  clean: number
  pending_check: number
  ready_for_dds: boolean
}

interface PaddockResult {
  paddock_id: string
  paddock_name: string
  has_geometry: boolean
  eudr_area_ha: number | null
  eudr_geom_type: string
  deforestation_status: string | null
  is_valid_for_eudr: boolean
  validation_issues: string[]
}

interface DocsStats { total: number; verified: number; expiring_soon: number }
interface FeedStats { total: number; compliant: number; compliance_rate: number }
interface DdsHistory { id: string; status: string; created_at: string; paddock_count: number }

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

  const load = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    setError(null)
    try {
      const [valRes, docsRes, feedRes, ddsRes] = await Promise.allSettled([
        apiFetch('/api/eudr/validate-paddocks').then(r => r.json()),
        apiFetch('/api/eudr/documents').then(async r => {
          const d = await r.json()
          const docs = d.documents ?? []
          return {
            total: docs.length,
            verified: docs.filter((x: any) => x.verified).length,
            expiring_soon: docs.filter((x: any) => x.expiry_status === 'EXPIRING_SOON' || x.expiry_status === 'EXPIRED').length,
          }
        }),
        apiFetch('/api/eudr/feed-batches').then(r => r.json()),
        apiFetch('/api/eudr/generate-dds').then(r => r.json()),
      ])

      if (valRes.status === 'fulfilled') setValidation(valRes.value)
      if (docsRes.status === 'fulfilled') setDocsStats(docsRes.value)
      if (feedRes.status === 'fulfilled') {
        const s = feedRes.value.stats
        setFeedStats(s ? { total: s.total, compliant: s.compliant, compliance_rate: s.compliance_rate } : null)
      }
      if (ddsRes.status === 'fulfilled') {
        setDdsHistory((ddsRes.value.submissions ?? []).slice(0, 5))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleGenerateDDS = async () => {
    if (!user) return
    setGeneratingDDS(true)
    try {
      const res = await apiFetch('/api/eudr/generate-dds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.submission_id) {
        // Download dossier PDF
        const pdfUrl = `/api/eudr/dossier?submission_id=${data.submission_id}`
        window.open(pdfUrl, '_blank')
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

  const handleDownloadGeoJSON = () => {
    window.open('/api/eudr/traces-geojson', '_blank')
  }

  const s = validation?.summary
  const eudrScore = s
    ? Math.round(
        (s.clean / Math.max(s.total_paddocks, 1)) * 40 +
        (s.missing_geometry === 0 ? 20 : 0) +
        (docsStats?.total ? Math.min(20, docsStats.total * 4) : 0) +
        ((feedStats?.compliance_rate ?? 0) / 100 * 20)
      )
    : 0

  const scoreColor =
    eudrScore >= 80 ? 'text-green-600' :
    eudrScore >= 50 ? 'text-amber-600' :
    'text-red-600'

  const scoreBg =
    eudrScore >= 80 ? 'bg-green-50 border-green-200' :
    eudrScore >= 50 ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-black text-gray-900">Cumplimiento EUDR</h1>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 tracking-wider">
              UE 2023/1115
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Reglamento de la UE sobre Deforestación. Gestión de Due Diligence Statements (DDS).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Actualizar
          </button>
          <button
            onClick={handleGenerateDDS}
            disabled={generatingDDS || !s?.ready_for_dds}
            title={!s?.ready_for_dds ? 'Todos los potreros deben estar LIMPIOS para generar la DDS' : undefined}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all',
              s?.ready_for_dds
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* EUDR Score */}
        <div className={clsx('col-span-2 sm:col-span-1 p-4 rounded-2xl border', scoreBg)}>
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Score EUDR</p>
          <p className={clsx('text-4xl font-black', scoreColor)}>{eudrScore}<span className="text-lg">%</span></p>
          <p className="text-xs text-gray-500 mt-1">
            {eudrScore >= 80 ? 'Listo para DDS' : eudrScore >= 50 ? 'Requiere mejoras' : 'No apto aún'}
          </p>
        </div>

        {/* Potreros */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="w-4 h-4 text-green-500" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Potreros</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{s?.clean ?? 0}<span className="text-sm text-gray-400">/{s?.total_paddocks ?? 0}</span></p>
          <p className="text-[11px] text-gray-500 mt-0.5">Limpios de deforestación</p>
          {(s?.deforested ?? 0) > 0 && (
            <p className="text-[10px] font-black text-red-600 mt-1">⚠ {s?.deforested} con alerta</p>
          )}
        </div>

        {/* Documentos */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Documentos</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{docsStats?.total ?? 0}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{docsStats?.verified ?? 0} verificados</p>
          {(docsStats?.expiring_soon ?? 0) > 0 && (
            <p className="text-[10px] font-black text-amber-600 mt-1">⚠ {docsStats?.expiring_soon} por vencer</p>
          )}
        </div>

        {/* Insumos */}
        <div className="p-4 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-4 h-4 text-violet-500" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Insumos</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{feedStats?.compliance_rate ?? 0}<span className="text-sm text-gray-400">%</span></p>
          <p className="text-[11px] text-gray-500 mt-0.5">{feedStats?.compliant ?? 0}/{feedStats?.total ?? 0} certificados EUDR</p>
        </div>
      </div>

      {/* Main grid: Paddocks + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Paddock validation table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-black text-gray-900">Validación de Potreros</h2>
            </div>
            <span className={clsx(
              'text-[10px] font-black px-2.5 py-1 rounded-full',
              s?.ready_for_dds ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            )}>
              {s?.ready_for_dds ? '✅ Listo para DDS' : '⚠ Pendiente'}
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
                </tr>
              </thead>
              <tbody>
                {(validation?.paddocks ?? []).map(p => (
                  <tr key={p.paddock_id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-gray-800">{p.paddock_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {p.eudr_area_ha != null ? p.eudr_area_ha.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={clsx(
                        'inline-block px-2 py-0.5 rounded-full text-[9px] font-black',
                        p.eudr_geom_type === 'POLYGON' ? 'bg-blue-100 text-blue-700' :
                        p.eudr_geom_type === 'POINT' ? 'bg-gray-100 text-gray-600' :
                        p.eudr_geom_type === 'MISSING' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      )}>
                        {p.eudr_geom_type === 'MISSING' ? '⚠ Sin geometría' :
                         p.eudr_geom_type === 'INVALID' ? '❌ Inválida' :
                         p.eudr_geom_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.deforestation_status === 'CLEAN' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Limpio
                        </span>
                      ) : p.deforestation_status === 'DEFORESTED' ? (
                        <span className="flex items-center gap-1 text-red-600 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> ALERTA
                        </span>
                      ) : p.deforestation_status === 'AT_RISK' ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> Riesgo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-3.5 h-3.5" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.is_valid_for_eudr ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="group relative cursor-help">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(validation?.paddocks ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                      No hay potreros registrados. <Link href="/dashboard/mi-campo" className="text-green-600 font-bold">Ir a Potreros →</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: actions + history */}
        <div className="flex flex-col gap-4">

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">Acciones Rápidas</h2>
            <div className="space-y-2">
              <Link
                href="/dashboard/eudr/documentos"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-blue-700">Bóveda Documental</p>
                    <p className="text-[10px] text-gray-400">{docsStats?.total ?? 0} documentos</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" />
              </Link>

              <Link
                href="/dashboard/eudr/insumos"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-violet-50 hover:text-violet-700 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-violet-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-violet-700">Insumos / Suplementos</p>
                    <p className="text-[10px] text-gray-400">{feedStats?.total ?? 0} lotes registrados</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400" />
              </Link>

              <Link
                href="/dashboard/eudr/exportar"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-green-50 hover:text-green-700 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-green-700">Exportar DDS / TRACES-NT</p>
                    <p className="text-[10px] text-gray-400">GeoJSON + PDF Dossier</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-green-400" />
              </Link>

              <button
                onClick={handleDownloadGeoJSON}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
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

          {/* DDS History */}
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
                      dds.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                      dds.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      dds.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    )}>
                      {dds.status === 'DRAFT' ? 'Borrador' :
                       dds.status === 'SUBMITTED' ? 'Enviada' :
                       dds.status === 'ACCEPTED' ? 'Aceptada' :
                       dds.status === 'REJECTED' ? 'Rechazada' : dds.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance checklist */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-black text-gray-900 mb-4">Checklist de Cumplimiento EUDR</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Cero Deforestación',
              ok: (s?.deforested ?? 0) === 0 && (s?.total_paddocks ?? 0) > 0,
              desc: s?.deforested ? `${s.deforested} potrero(s) con alerta` : `${s?.clean ?? 0} potreros limpios`,
              icon: Leaf,
            },
            {
              label: 'Geometría GIS',
              ok: (s?.missing_geometry ?? 0) === 0 && (s?.total_paddocks ?? 0) > 0,
              desc: s?.missing_geometry ? `${s.missing_geometry} sin polígono` : 'Todos georreferenciados',
              icon: MapPin,
            },
            {
              label: 'Documentos Legales',
              ok: (docsStats?.total ?? 0) > 0,
              desc: docsStats?.total ? `${docsStats.total} doc(s), ${docsStats.verified} verificados` : 'Sin documentos cargados',
              icon: FileText,
            },
            {
              label: 'Insumos Certificados',
              ok: (feedStats?.compliance_rate ?? 0) >= 100 || (feedStats?.total ?? 0) === 0,
              desc: feedStats?.total ? `${feedStats.compliance_rate}% certificados EUDR` : 'Sin insumos registrados',
              icon: Package,
            },
          ].map(item => (
            <div
              key={item.label}
              className={clsx(
                'p-4 rounded-xl border',
                item.ok ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {item.ok
                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : <AlertCircle className="w-4 h-4 text-amber-500" />
                }
                <span className={clsx('text-xs font-black', item.ok ? 'text-green-800' : 'text-gray-700')}>
                  {item.label}
                </span>
              </div>
              <p className={clsx('text-[11px]', item.ok ? 'text-green-600' : 'text-gray-500')}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
