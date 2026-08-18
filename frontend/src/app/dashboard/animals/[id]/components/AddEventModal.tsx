'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function AddEventModal({ 
  isOpen, 
  onClose, 
  onAdd 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onAdd: (data: any) => Promise<void> 
}) {
  const [loading, setLoading] = useState(false)
  const [eventType, setEventType] = useState('OBSERVACION')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  
  // Detalles dinámicos
  const [peso, setPeso] = useState('')
  const [vacuna, setVacuna] = useState('')
  const [destino, setDestino] = useState('')
  const [nota, setNota] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const details: any = {}
    if (eventType === 'PESAJE') details.peso = peso
    if (eventType === 'VACUNACION') details.vacuna = vacuna
    if (eventType === 'MOVIMIENTO') details.destino = destino
    if (eventType === 'OBSERVACION') details.nota = nota
    
    try {
      await onAdd({
        event_type: eventType,
        event_date: new Date(eventDate).toISOString(),
        details,
        source: 'APP'
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert('Error al guardar el evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Agregar Evento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Evento</label>
            <select 
              value={eventType} 
              onChange={e => setEventType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="OBSERVACION">Observación</option>
              <option value="PESAJE">Pesaje</option>
              <option value="VACUNACION">Vacunación / Tratamiento</option>
              <option value="MOVIMIENTO">Movimiento</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input 
              type="date" 
              required
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {eventType === 'PESAJE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input 
                type="number" 
                step="0.1"
                required
                value={peso}
                onChange={e => setPeso(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          )}

          {eventType === 'VACUNACION' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vacuna aplicada</label>
              <input 
                type="text" 
                required
                value={vacuna}
                onChange={e => setVacuna(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          )}

          {eventType === 'MOVIMIENTO' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Potrero Destino</label>
              <input 
                type="text" 
                required
                value={destino}
                onChange={e => setDestino(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Nombre del potrero"
              />
            </div>
          )}

          {eventType === 'OBSERVACION' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detalles</label>
              <textarea 
                required
                rows={3}
                value={nota}
                onChange={e => setNota(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          )}

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
