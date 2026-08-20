'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { Package, Plus, X, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

const FEED_TYPES: Record<string, string> = {
  SOJA: 'Soja',
  MAIZ: 'Maíz',
  SORGO: 'Sorgo',
  ALFALFA: 'Alfalfa',
  SILAJE: 'Silaje',
  NUCLEO_MINERAL: 'Núcleo Mineral',
  BALANCEADO: 'Balanceado',
  HENO: 'Heno',
  OTRO: 'Otro',
}

interface FeedBatch {
  id: string
  feed_type: string
  supplier_name?: string
  supplier_cuit?: string
  supplier_country: string
  eudr_compliant: boolean
  invoice_url?: string
  lot_number?: string
  quantity_kg?: number
  received_date: string
  expiry_date?: string
  notes?: string
  created_at: string
}

interface FeedStats {
  total: number
  compliant: number
  non_compliant: number
  compliance_rate: number
}

export default function InsumosPage() {
  const { user } = useAuth()
  const [batches, setBatches]   = useState<FeedBatch[]>([])
  const [stats, setStats]       = useState<FeedStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)

  const [form, setForm] = useState({
    feed_type: 'SOJA',
    supplier_name: '',
    supplier_cuit: '',
    supplier_country: 'ARG',
    eudr_compliant: false,
    lot_number: '',
    quantity_kg: '',
    received_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    notes: '',
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/eudr/feed-batches').then(r => r.json())
      setBatches(res.batches ?? [])
      setStats(res.stats ?? null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.received_date) { alert('La fecha de recepción es requerida'); return }
    setSaving(true)
    try {
      const res = await apiFetch('/api/eudr/feed-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity_kg: form.quantity_kg ? parseFloat(form.quantity_kg) : undefined,
        }),
      })
      if (!res.ok) throw new Error('Error guardando')
      setShowForm(false)
      setForm({
        feed_type: 'SOJA', supplier_name: '', supplier_cuit: '',
        supplier_country: 'ARG', eudr_compliant: false, lot_number: '',
        quantity_kg: '', received_date: new Date().toISOString().split('T')[0],
        expiry_date: '', notes: '',
      })
      load()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
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
            <Package className="w-5 h-5 text-violet-500" />
            Trazabilidad de Insumos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registrá lotes de soja, maíz y suplementos. EUDR exige verificar que la dieta del rodeo sea libre de deforestación.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo Lote
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-black text-gray-900">{stats.total}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Total Lotes</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-black text-green-700">{stats.compliant}</p>
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mt-0.5">Certificados EUDR</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-black text-red-600">{stats.non_compliant}</p>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-0.5">Sin Certificar</p>
          </div>
          <div className={clsx('rounded-xl border p-4 text-center', stats.compliance_rate >= 100 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}>
            <p className={clsx('text-2xl font-black', stats.compliance_rate >= 100 ? 'text-green-700' : 'text-amber-700')}>{stats.compliance_rate}%</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Tasa EUDR</p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-900">Nuevo Lote de Insumo</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de insumo *</label>
              <select value={form.feed_type} onChange={e => setForm(p => ({ ...p, feed_type: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {Object.entries(FEED_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Proveedor</label>
              <input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))}
                placeholder="Nombre del proveedor" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CUIT Proveedor</label>
              <input value={form.supplier_cuit} onChange={e => setForm(p => ({ ...p, supplier_cuit: e.target.value }))}
                placeholder="XX-XXXXXXXX-X" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cantidad (kg)</label>
              <input type="number" value={form.quantity_kg} onChange={e => setForm(p => ({ ...p, quantity_kg: e.target.value }))}
                placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nro. de lote</label>
              <input value={form.lot_number} onChange={e => setForm(p => ({ ...p, lot_number: e.target.value }))}
                placeholder="LOT-2024-001" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha de recepción *</label>
              <input type="date" value={form.received_date} onChange={e => setForm(p => ({ ...p, received_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border-2 border-dashed transition-all"
                style={{ borderColor: form.eudr_compliant ? '#16a34a' : '#e5e7eb', background: form.eudr_compliant ? '#f0fdf4' : '#f9fafb' }}>
                <input type="checkbox" checked={form.eudr_compliant}
                  onChange={e => setForm(p => ({ ...p, eudr_compliant: e.target.checked }))}
                  className="w-4 h-4 rounded text-green-600 accent-green-600" />
                <div>
                  <p className="text-sm font-black text-gray-800">
                    ✅ El proveedor certifica que este insumo es libre de deforestación
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Requerido si el commodity proviene de regiones con riesgo de deforestación (Cerrado, Chaco, etc.)
                  </p>
                </div>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-xs font-bold bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Guardar Lote'}
            </button>
          </div>
        </div>
      )}

      {/* Batches list */}
      {batches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">Sin lotes de insumos registrados</p>
          <p className="text-xs text-gray-300 mt-1">Registrá la soja, maíz u otros suplementos que consume tu rodeo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Insumo</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Proveedor</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Cantidad</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">Recepción</th>
                <th className="text-left px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-[9px]">EUDR</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-gray-800">{FEED_TYPES[b.feed_type] ?? b.feed_type}</p>
                    {b.lot_number && <p className="text-[10px] text-gray-400">Lote: {b.lot_number}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{b.supplier_name ?? '—'}</p>
                    {b.supplier_cuit && <p className="text-[10px] text-gray-400">{b.supplier_cuit}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.quantity_kg ? `${b.quantity_kg.toLocaleString('es-AR')} kg` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(b.received_date).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3">
                    {b.eudr_compliant ? (
                      <span className="flex items-center gap-1 text-green-600 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sí
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="w-3.5 h-3.5" /> Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
