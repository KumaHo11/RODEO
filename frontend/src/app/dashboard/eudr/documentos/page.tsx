'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FileText, Plus, Check, AlertTriangle, Upload, X, Shield, ExternalLink, Clock } from 'lucide-react'
import clsx from 'clsx'

const DOC_TYPES: Record<string, string> = {
  TITLE_DEED: 'Título de Propiedad',
  LEASE_CONTRACT: 'Contrato de Arrendamiento',
  ENVIRONMENTAL_PERMIT: 'Permiso Ambiental',
  DTE: 'Guía de Traslado (DTE)',
  ORIGIN_CERTIFICATE: 'Certificado de Origen',
  FISCAL_CERTIFICATE: 'Constancia AFIP/CUIT',
  FEED_INVOICE: 'Remito de Insumos',
  DEFORESTATION_AUDIT: 'Auditoría de Deforestación',
  OTHER: 'Otro',
}

interface Document {
  id: string
  doc_type: string
  file_url: string
  file_name?: string
  paddock_name?: string
  issued_date?: string
  expiry_date?: string
  expiry_status?: string
  issuer?: string
  reference_number?: string
  verified: boolean
  verified_by_name?: string
  verified_at?: string
  notes?: string
  created_at: string
}

export default function DocumentosPage() {
  const { user } = useAuth()
  const [docs, setDocs]       = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [paddocks, setPaddocks] = useState<{ id: string; name: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    doc_type: 'TITLE_DEED',
    paddock_id: '',
    issued_date: '',
    expiry_date: '',
    issuer: '',
    reference_number: '',
    notes: '',
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [docsRes, padsRes] = await Promise.all([
        apiFetch('/api/eudr/documents').then(r => r.json()),
        apiFetch('/api/paddocks').then(r => r.json()),
      ])
      setDocs(docsRes.documents ?? [])
      setPaddocks((padsRes.paddocks ?? []).map((p: any) => ({ id: p.id, name: p.name })))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleUploadAndSave = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { alert('Seleccioná un archivo'); return }
    if (!user) return

    setUploading(true)
    try {
      // 1. Upload file
      const idToken = await user.getIdToken()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'eudr-docs')

      const upRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: fd,
      })
      const upData = await upRes.json()
      if (!upData.url) throw new Error(upData.error ?? 'Error subiendo archivo')

      // 2. Register document
      await apiFetch('/api/eudr/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          file_url: upData.url,
          file_name: file.name,
          file_size_bytes: file.size,
          paddock_id: form.paddock_id || undefined,
        }),
      })

      setShowForm(false)
      setForm({ doc_type: 'TITLE_DEED', paddock_id: '', issued_date: '', expiry_date: '', issuer: '', reference_number: '', notes: '' })
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleVerify = async (id: string, current: boolean) => {
    await apiFetch('/api/eudr/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, verified: !current }),
    })
    load()
  }

  const expiryStyles = (status?: string) => {
    if (status === 'EXPIRED') return 'text-red-600 bg-red-50'
    if (status === 'EXPIRING_SOON') return 'text-amber-600 bg-amber-50'
    return 'text-green-600 bg-green-50'
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Bóveda Documental EUDR
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Títulos, permisos, certificados y guías de traslado requeridos por el Reglamento UE 2023/1115.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar Documento
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-900">Nuevo Documento</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tipo de Documento *</label>
              <select
                value={form.doc_type}
                onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Potrero (opcional)</label>
              <select
                value={form.paddock_id}
                onChange={e => setForm(p => ({ ...p, paddock_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toda la organización</option>
                {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Ente emisor</label>
              <input
                value={form.issuer}
                onChange={e => setForm(p => ({ ...p, issuer: e.target.value }))}
                placeholder="SENASA, Catastro, AFIP..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nro. de referencia</label>
              <input
                value={form.reference_number}
                onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                placeholder="Ej: EXP-2024-00001"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Fecha de emisión</label>
              <input type="date" value={form.issued_date} onChange={e => setForm(p => ({ ...p, issued_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Fecha de vencimiento</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Archivo *</label>
              <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {fileRef.current?.files?.[0]?.name ?? 'Seleccionar PDF, imagen o documento'}
                </span>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
            <button onClick={handleUploadAndSave} disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Subiendo...' : 'Guardar Documento'}
            </button>
          </div>
        </div>
      )}

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">Sin documentos en la bóveda</p>
          <p className="text-xs text-gray-300 mt-1">Cargá títulos, permisos y certificados para completar tu DDS</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {docs.map(doc => (
            <div key={doc.id} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                    {DOC_TYPES[doc.doc_type] ?? doc.doc_type}
                  </span>
                  {doc.paddock_name && (
                    <p className="text-[10px] text-gray-400 mt-1">📍 {doc.paddock_name}</p>
                  )}
                </div>
                {doc.verified ? (
                  <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                    <Check className="w-2.5 h-2.5" /> Verificado
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full shrink-0">Sin verificar</span>
                )}
              </div>

              {doc.file_name && (
                <p className="text-xs font-bold text-gray-800 mb-1 truncate">{doc.file_name}</p>
              )}
              {doc.issuer && (
                <p className="text-[11px] text-gray-500">{doc.issuer}</p>
              )}
              {doc.reference_number && (
                <p className="text-[10px] text-gray-400">Ref: {doc.reference_number}</p>
              )}

              {doc.expiry_date && (
                <div className={clsx('flex items-center gap-1 mt-2 px-2 py-1 rounded-lg text-[10px] font-bold', expiryStyles(doc.expiry_status))}>
                  <Clock className="w-3 h-3" />
                  Vence: {new Date(doc.expiry_date).toLocaleDateString('es-AR')}
                  {doc.expiry_status === 'EXPIRED' && ' (VENCIDO)'}
                  {doc.expiry_status === 'EXPIRING_SOON' && ' (PRÓXIMO)'}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-3 h-3" /> Ver archivo
                </a>
                <button
                  onClick={() => handleVerify(doc.id, doc.verified)}
                  className={clsx(
                    'ml-auto flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors',
                    doc.verified
                      ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  )}
                >
                  {doc.verified ? 'Desmarcar' : '✓ Verificar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
