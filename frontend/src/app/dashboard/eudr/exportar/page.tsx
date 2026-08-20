'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  FileText, Download, Send, Globe, CheckCircle2, AlertTriangle,
  RefreshCw, Copy, ExternalLink
} from 'lucide-react'
import clsx from 'clsx'

interface DdsSubmission {
  id: string
  submission_type: string
  status: string
  external_ref?: string
  herd_count?: number
  paddock_count?: number
  geojson_url?: string
  pdf_url?: string
  submitted_at?: string
  created_at: string
}

export default function ExportarPage() {
  const { user } = useAuth()
  const [submissions, setSubmissions]   = useState<DdsSubmission[]>([])
  const [loading, setLoading]           = useState(true)
  const [generatingDDS, setGeneratingDDS] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [submittingVisec, setSubmittingVisec] = useState<string | null>(null)
  const [lastDDS, setLastDDS]           = useState<any>(null)
  const [copied, setCopied]             = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/eudr/generate-dds').then(r => r.json())
      setSubmissions(res.submissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleGenerateDDS = async () => {
    setGeneratingDDS(true)
    try {
      const res = await apiFetch('/api/eudr/generate-dds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLastDDS(data)
      load()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setGeneratingDDS(false)
    }
  }

  const handleDownloadGeoJSON = () => {
    window.open('/api/eudr/traces-geojson', '_blank')
  }

  const handleDownloadPDF = (submissionId?: string) => {
    const url = submissionId
      ? `/api/eudr/dossier?submission_id=${submissionId}`
      : '/api/eudr/dossier'
    window.open(url, '_blank')
  }

  const handleSubmitVisec = async (submissionId: string) => {
    setSubmittingVisec(submissionId)
    try {
      const res = await apiFetch('/api/eudr/visec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      alert(`DDS enviada a VISEC${data.mock_mode ? ' (modo simulación)' : ''}.\nRef: ${data.external_ref}`)
      load()
    } catch (e: any) {
      alert('Error VISEC: ' + e.message)
    } finally {
      setSubmittingVisec(null)
    }
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      DRAFT: 'Borrador',
      SUBMITTED: 'Enviada',
      ACCEPTED: 'Aceptada',
      REJECTED: 'Rechazada',
      EXPIRED: 'Expirada',
    }
    return map[s] ?? s
  }
  const statusStyle = (s: string) => ({
    DRAFT: 'bg-gray-100 text-gray-600',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    ACCEPTED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-amber-100 text-amber-700',
  })[s] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" />
            Exportar DDS / TRACES-NT
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generá y exportá Due Diligence Statements en los formatos requeridos por la UE y plataformas sectoriales.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Export actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Generate DDS */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="text-sm font-black text-gray-900">Generar DDS</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Ensambla el Due Diligence Statement completo con todos los potreros, rodeos y documentos de tu organización.
          </p>
          <button
            onClick={handleGenerateDDS}
            disabled={generatingDDS}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {generatingDDS ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</> : 'Generar DDS'}
          </button>
          {lastDDS && (
            <div className="mt-3 p-3 bg-green-50 rounded-xl text-[10px] text-green-700">
              <p className="font-black">DDS generada ✅</p>
              <p className="mt-1 font-mono break-all">{lastDDS.payload_hash?.slice(0, 32)}...</p>
              <button onClick={() => copyHash(lastDDS.payload_hash)} className="mt-1 flex items-center gap-1 text-green-600 hover:text-green-800">
                <Copy className="w-2.5 h-2.5" /> {copied ? 'Copiado!' : 'Copiar hash'}
              </button>
            </div>
          )}
        </div>

        {/* GeoJSON TRACES-NT */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-black text-gray-900">GeoJSON TRACES-NT</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Descargá el archivo GeoJSON en el formato exacto requerido por la plataforma oficial TRACES-NT de la Comisión Europea.
          </p>
          <button
            onClick={handleDownloadGeoJSON}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Descargar GeoJSON
          </button>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Solo incluye potreros con estado CLEAN
          </p>
        </div>

        {/* PDF Dossier */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-violet-600" />
            </div>
            <h2 className="text-sm font-black text-gray-900">Pasaporte Digital PDF</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Generá el Pasaporte Digital EUDR en PDF con hash de verificación criptográfico, mapa de potreros y declaración legal.
          </p>
          <button
            onClick={() => handleDownloadPDF(lastDDS?.submission_id)}
            disabled={generatingPDF}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Descargar PDF
          </button>
        </div>
      </div>

      {/* VISEC section */}
      <div className="bg-white rounded-2xl border border-amber-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Send className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-black text-gray-900">Integración VISEC</h2>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">MOCK</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Envío automático a VISEC (plataforma sectorial Argentina). Actualmente en modo simulación — configurar{' '}
          <code className="text-[10px] bg-gray-100 px-1 rounded">VISEC_API_KEY</code> y{' '}
          <code className="text-[10px] bg-gray-100 px-1 rounded">VISEC_API_URL</code> para activar la integración real.
        </p>
        {submissions.filter(s => s.status === 'DRAFT').length === 0 ? (
          <p className="text-xs text-gray-400 italic">Generá una DDS primero para poder enviarla a VISEC.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {submissions.filter(s => s.status === 'DRAFT').slice(0, 3).map(s => (
              <button
                key={s.id}
                onClick={() => handleSubmitVisec(s.id)}
                disabled={submittingVisec === s.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3 h-3" />
                {submittingVisec === s.id ? 'Enviando...' : `Enviar ${s.id.slice(0, 6).toUpperCase()}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-black text-gray-900">Historial de DDS</h2>
        </div>
        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Sin DDS generadas todavía</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Referencia</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Tipo</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Estado</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Fecha</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[11px] text-gray-600">{s.id.slice(0, 8).toUpperCase()}</p>
                    {s.external_ref && <p className="text-[10px] text-blue-600">{s.external_ref}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.submission_type ?? 'MANUAL_PDF'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-[9px] font-black px-2 py-0.5 rounded-full', statusStyle(s.status))}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadPDF(s.id)}
                        className="flex items-center gap-0.5 text-[10px] font-bold text-violet-600 hover:text-violet-700"
                        title="Descargar PDF"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                      {s.status === 'DRAFT' && (
                        <button
                          onClick={() => handleSubmitVisec(s.id)}
                          disabled={submittingVisec === s.id}
                          className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 disabled:opacity-50"
                          title="Enviar a VISEC"
                        >
                          <Send className="w-3 h-3" /> VISEC
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
