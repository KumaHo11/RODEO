'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function AddEventModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: any) => Promise<void>
}) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [eventType, setEventType] = useState('OBSERVACION')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [peso, setPeso]         = useState('')
  const [vacuna, setVacuna]     = useState('')
  const [destino, setDestino]   = useState('')
  const [nota, setNota]         = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEventType('OBSERVACION')
      setEventDate(new Date().toISOString().split('T')[0])
      setPeso('')
      setVacuna('')
      setDestino('')
      setNota('')
      setError(null)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const details: any = {}
    if (eventType === 'PESAJE')      details.peso    = Number(peso)
    if (eventType === 'VACUNACION')  details.vacuna  = vacuna
    if (eventType === 'MOVIMIENTO')  details.destino = destino
    if (eventType === 'OBSERVACION') details.nota    = nota

    try {
      await onAdd({
        event_type: eventType,
        event_date: new Date(eventDate).toISOString(),
        details,
        source: 'APP',
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el evento. Intentá nuevamente.')
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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-950">Agregar evento</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <label className={labelClass}>Tipo de evento</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className={inputClass}
            >
              <option value="OBSERVACION">Observación</option>
              <option value="PESAJE">Pesaje</option>
              <option value="VACUNACION">Vacunación / Tratamiento</option>
              <option value="MOVIMIENTO">Movimiento</option>
              <option value="PARTO">Parto</option>
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              required
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Campos dinámicos */}
          {eventType === 'PESAJE' && (
            <div>
              <label className={labelClass}>Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={peso}
                onChange={e => setPeso(e.target.value)}
                className={inputClass}
                placeholder="Ej: 350.5"
              />
            </div>
          )}

          {eventType === 'VACUNACION' && (
            <div>
              <label className={labelClass}>Vacuna / Producto aplicado</label>
              <input
                type="text"
                required
                value={vacuna}
                onChange={e => setVacuna(e.target.value)}
                className={inputClass}
                placeholder="Ej: Clostridiosis 8 vías"
              />
            </div>
          )}

          {eventType === 'MOVIMIENTO' && (
            <div>
              <label className={labelClass}>Potrero destino</label>
              <input
                type="text"
                required
                value={destino}
                onChange={e => setDestino(e.target.value)}
                className={inputClass}
                placeholder="Nombre del potrero destino"
              />
            </div>
          )}

          {eventType === 'OBSERVACION' && (
            <div>
              <label className={labelClass}>Observación</label>
              <textarea
                required
                rows={3}
                value={nota}
                onChange={e => setNota(e.target.value)}
                className={inputClass}
                placeholder="Describí lo observado..."
              />
            </div>
          )}

          {eventType === 'PARTO' && (
            <div>
              <label className={labelClass}>Notas del parto</label>
              <textarea
                rows={2}
                value={nota}
                onChange={e => setNota(e.target.value)}
                className={inputClass}
                placeholder="Ej: Sin complicaciones, ternero macho"
              />
            </div>
          )}

          {/* Error inline */}
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
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Guardar evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
