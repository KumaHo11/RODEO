'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

interface CreateAnimalModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateAnimalModal({ isOpen, onClose, onCreated }: CreateAnimalModalProps) {
  const [herds, setHerds]       = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const emptyForm = {
    rfid_code:          '',
    visual_tag:         '',
    name:               '',
    sex:                'HEMBRA',
    breed:              '',
    birth_date:         '',
    current_herd_id:    '',
    current_paddock_id: '',
    notes:              '',
  }
  const [form, setForm] = useState(emptyForm)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm)
      setError(null)
    }
  }, [isOpen])

  // Load herds + paddocks
  useEffect(() => {
    if (!isOpen) return
    Promise.all([
      apiFetch('/api/herds').then(r => r.json()),
      apiFetch('/api/paddocks').then(r => r.json()),
    ]).then(([herdsData, paddocksData]) => {
      setHerds(herdsData.herds || herdsData || [])
      setPaddocks(paddocksData.paddocks || paddocksData || [])
    }).catch(console.error)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.rfid_code && !form.visual_tag && !form.name) {
      setError('Completá al menos un identificador: RFID, caravana o nombre.')
      return
    }

    setLoading(true)
    try {
      const payload: any = {
        sex: form.sex,
      }
      if (form.rfid_code)          payload.rfid_code          = form.rfid_code
      if (form.visual_tag)         payload.visual_tag         = form.visual_tag
      if (form.name)               payload.name               = form.name
      if (form.breed)              payload.breed              = form.breed
      if (form.birth_date)         payload.birth_date         = form.birth_date
      if (form.current_herd_id)    payload.current_herd_id    = form.current_herd_id
      if (form.current_paddock_id) payload.current_paddock_id = form.current_paddock_id
      if (form.notes)              payload.notes              = form.notes

      const res = await apiFetch('/api/animals', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al crear el animal')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors'
  const labelClass = 'block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5'

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-black text-gray-950">Nuevo animal</h2>
            <p className="text-sm text-gray-500 mt-0.5">Completá al menos un identificador</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          {/* Identificadores */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              Identificadores — al menos uno requerido
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Caravana (Tag visual)</label>
                <input
                  type="text"
                  value={form.visual_tag}
                  onChange={e => handleChange('visual_tag', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: A1234"
                />
              </div>
              <div>
                <label className={labelClass}>Código RFID</label>
                <input
                  type="text"
                  value={form.rfid_code}
                  onChange={e => handleChange('rfid_code', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: 982000123456789"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelClass}>Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                className={inputClass}
                placeholder="Nombre del animal (opcional)"
              />
            </div>
          </div>

          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Sexo</label>
              <select
                value={form.sex}
                onChange={e => handleChange('sex', e.target.value)}
                className={inputClass}
              >
                <option value="MACHO">Macho</option>
                <option value="HEMBRA">Hembra</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Raza</label>
              <input
                type="text"
                value={form.breed}
                onChange={e => handleChange('breed', e.target.value)}
                className={inputClass}
                placeholder="Ej: Angus"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Fecha de nacimiento</label>
            <input
              type="date"
              value={form.birth_date}
              onChange={e => handleChange('birth_date', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Asignación */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Rodeo</label>
              <select
                value={form.current_herd_id}
                onChange={e => handleChange('current_herd_id', e.target.value)}
                className={inputClass}
              >
                <option value="">Sin rodeo</option>
                {herds.map((h: any) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Potrero</label>
              <select
                value={form.current_paddock_id}
                onChange={e => handleChange('current_paddock_id', e.target.value)}
                className={inputClass}
              >
                <option value="">Sin potrero</option>
                {paddocks.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notas</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              className={inputClass}
              placeholder="Observaciones adicionales..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {loading ? 'Creando...' : 'Crear animal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
