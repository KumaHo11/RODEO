'use client'

import { useCompliance } from '../hooks/useCompliance'
import { usePlan } from '@/hooks/usePlan'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, CheckCircle2, XCircle, Info, RefreshCw, ClipboardCheck } from 'lucide-react'
import { DownloadReportButton } from '../components/DownloadReportButton'

function getStatusColor(score: number) {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function getStatusText(score: number, goodText: string, badText: string) {
  if (score >= 75) return { text: goodText, color: 'text-green-700' }
  if (score >= 50) return { text: 'En progreso', color: 'text-amber-700' }
  return { text: badText, color: 'text-red-700' }
}

export default function ComplianceDashboardPage() {
  const { hasFeature } = usePlan()
  const { scores, paddocksDetail, recommendations, loading, error, refetch } = useCompliance()

  if (!hasFeature('metrics_module')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
          <ClipboardCheck className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-xl font-black text-gray-950">Compliance Dashboard</h2>
        <p className="text-gray-500 text-sm max-w-md">
          El módulo de Compliance está disponible en los planes <strong>Holístico</strong> y superiores.
          Evaluación automática EUDR, EOV y GRSB con semáforo por potrero.
        </p>
        <Link href="/dashboard/planes" className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Ver planes
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !scores) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Error cargando compliance: {error}
        <button onClick={refetch} className="underline ml-auto">Reintentar</button>
      </div>
    )
  }

  const { eudr, eov, grsb } = scores

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Compliance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Evaluación automática contra normativas internacionales</p>
        </div>
        <div className="flex flex-col items-end">
          <DownloadReportButton orgId="user-org-id" />
        </div>
      </div>

      {/* Sección 1: Semáforo de normativas */}
      <section>
        <h2 className="text-lg font-black text-gray-950 mb-4">Semáforo de Normativas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* EUDR */}
          <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="font-black text-base text-gray-900">EUDR</span>
              <span className="text-2xl font-black tabular-nums">{eudr.total}%</span>
            </div>
            
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${getStatusColor(eudr.total)}`} style={{ width: `${eudr.total}%` }} />
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(eudr.total)}`} />
              <span className={`font-semibold ${getStatusText(eudr.total, 'Cumple EUDR', 'Riesgo EUDR').color}`}>
                {getStatusText(eudr.total, 'Cumple EUDR', 'Riesgo EUDR').text}
              </span>
            </div>

            <p className="text-xs text-gray-500">Evalúa deforestación post-2020 y estabilidad de vegetación.</p>
            <div className="mt-auto pt-4 flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-center"><span>Sin deforestación</span> {eudr.breakdown.no_deforestation.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
              <div className="flex justify-between items-center"><span>NDVI estable</span> {eudr.breakdown.ndvi_stable.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
              <div className="flex justify-between items-center"><span>Trazabilidad</span> {eudr.breakdown.traceability.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
            </div>
          </div>

          {/* EOV */}
          <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="font-black text-base text-gray-900">EOV Savory</span>
              <span className="text-2xl font-black tabular-nums">{eov.total}%</span>
            </div>
            
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${getStatusColor(eov.total)}`} style={{ width: `${eov.total}%` }} />
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(eov.total)}`} />
              <span className={`font-semibold ${getStatusText(eov.total, 'Cumple EOV', 'Riesgo EOV').color}`}>
                {getStatusText(eov.total, 'Cumple EOV', 'Riesgo EOV').text}
              </span>
            </div>

            <p className="text-xs text-gray-500">Evalúa regeneración ecológica y salud del suelo.</p>
            <div className="mt-auto pt-4 flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-center"><span>NDVI mejorando</span> {eov.breakdown.ndvi_improving.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
              <div className="flex justify-between items-center"><span>Heterogeneidad espectral</span> {eov.breakdown.spectral_heterogeneity.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
              <div className="flex justify-between items-center"><span>BSI bajo</span> {eov.breakdown.bsi_low.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
            </div>
          </div>

          {/* GRSB */}
          <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="font-black text-base text-gray-900">GRSB</span>
              <span className="text-2xl font-black tabular-nums">{grsb.total}%</span>
            </div>
            
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${getStatusColor(grsb.total)}`} style={{ width: `${grsb.total}%` }} />
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(grsb.total)}`} />
              <span className={`font-semibold ${getStatusText(grsb.total, 'Cumple GRSB', 'Riesgo GRSB').color}`}>
                {getStatusText(grsb.total, 'Cumple GRSB', 'Riesgo GRSB').text}
              </span>
            </div>

            <p className="text-xs text-gray-500">Global Roundtable for Sustainable Beef (Principios 2024).</p>
            <div className="mt-auto pt-4 flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-center"><span>NDVI estable</span> {grsb.breakdown.ndvi_stable.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
              <div className="flex justify-between items-center"><span>Sin deforestación</span> {grsb.breakdown.no_deforestation.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
              <div className="flex justify-between items-center"><span>Datos satelitales</span> {grsb.breakdown.data_coverage.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección 3: Checklist / Alertas */}
      <section>
        <h2 className="text-lg font-black text-gray-950 mb-4">Checklist de Acciones</h2>
        {recommendations && recommendations.length > 0 ? (
          <div className="flex flex-col gap-3">
            {recommendations.map((rec, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${rec.level === 'URGENTE' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{rec.level === 'URGENTE' ? 'Acción Urgente' : 'Recomendación'}</p>
                  <p className="text-sm mt-1">{rec.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800">
            <CheckCircle className="w-5 h-5" />
            <p>Todo en orden. No hay acciones pendientes urgentes.</p>
          </div>
        )}
      </section>

      {/* Sección 2: Tabla de potreros */}
      <section>
        <h2 className="text-lg font-black text-gray-950 mb-4">Detalle por Potrero</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3">Potrero</th>
                <th className="px-4 py-3">NDVI</th>
                <th className="px-4 py-3">Deforestación</th>
                <th className="px-4 py-3">fCover</th>
                <th className="px-4 py-3">EUDR</th>
                <th className="px-4 py-3">EOV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paddocksDetail?.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    {p.ndvi} {p.ndviTrend > 0 ? '↑' : p.ndviTrend < 0 ? '↓' : ''}
                  </td>
                  <td className="px-4 py-3">{p.deforest}</td>
                  <td className="px-4 py-3">{p.fCover}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(p.eudr)}`} />
                      {p.eudr}%
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(p.eov)}`} />
                      {p.eov}%
                    </div>
                  </td>
                </tr>
              ))}
              {(!paddocksDetail || paddocksDetail.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No hay potreros con datos satelitales en esta organización.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
