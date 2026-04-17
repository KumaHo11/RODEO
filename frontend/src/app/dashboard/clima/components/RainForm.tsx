'use client'

import { useState } from 'react'
import { CloudRain, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { PaddockMultiSelect } from './PaddockMultiSelect'
import type { CreateWeatherEventPayload } from '@/lib/types/weather'

interface RainFormProps {
  onSave: (payload: CreateWeatherEventPayload) => Promise<boolean>
  isSaving: boolean
}

export function RainForm({ onSave, isSaving }: RainFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [mm, setMm]               = useState('')
  const [date, setDate]           = useState(today)
  const [paddockIds, setPaddockIds] = useState<string[]>([])
  const [notes, setNotes]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const isValid = Number(mm) > 0 && paddockIds.length > 0 && !!date

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValid) return

    const ok = await onSave({
      type:       'RAIN',
      value:      Number(mm),
      date,
      paddockIds,
      notes:      notes.trim() || undefined,
    })

    if (ok) {
      setSuccess(true)
      setMm('')
      setPaddockIds([])
      setNotes('')
      setDate(today)
      setTimeout(() => setSuccess(false), 2500)
    } else {
      setError('No se pudo guardar el registro. Intentá de nuevo.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <CloudRain className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900">Registro de precipitaciones</h3>
          <p className="text-[11px] text-gray-400 font-semibold">Registrá mm caídos y los potreros afectados</p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-3">
        {/* MM field */}
        <div>
          <label className="block text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1.5">
            Milímetros (mm) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={mm}
              onChange={e => setMm(e.target.value)}
              min="0"
              step="0.1"
              placeholder="0.0"
              required
              className={clsx(
                'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-10',
                'text-sm font-bold text-gray-800 placeholder-gray-300',
                'focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all'
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-400">mm</span>
          </div>
        </div>

        {/* Date field */}
        <div>
          <label className="block text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1.5">
            Fecha <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            max={today}
            className={clsx(
              'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5',
              'text-sm font-bold text-gray-800',
              'focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all'
            )}
          />
        </div>
      </div>

      {/* Paddock selector */}
      <PaddockMultiSelect
        selected={paddockIds}
        onChange={setPaddockIds}
        required
      />

      {/* Notes */}
      <div>
        <label className="block text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1.5">
          Observaciones
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: lluvia intensa por 2 horas…"
          rows={2}
          className={clsx(
            'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2',
            'text-sm font-semibold text-gray-700 placeholder-gray-300 resize-none',
            'focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all'
          )}
        />
      </div>

      {/* Error */}
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || isSaving}
        className={clsx(
          'flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-sm font-bold transition-all',
          isValid && !isSaving
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          success && 'bg-green-600 text-white'
        )}
      >
        {isSaving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
        ) : success ? (
          '✓ Registrado'
        ) : (
          'Registrar lluvia'
        )}
      </button>
    </form>
  )
}
