'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Leaf } from 'lucide-react'

interface Paddock {
  id: string
}

interface Herd {
  id: string
  name: string
  head_count: number
  total_ev: number | null
  categoria: string | null
}

interface SeasonPlan {
  id?: string
  name: string
  season_type: 'cerrado' | 'abierto' | 'ambos'
  year: number
  start_date: string
  end_date: string
}

interface Props {
  plan: SeasonPlan
  herds: Herd[]
  initialHerdIds: string[]
  initialDailyAllocationKg: number
  initialTargetRemnant: number
  onClose: () => void
  onContinue: (selectedHerdIds: string[], dailyAllocationKg: number, targetRemnant: number) => void
}

const LABEL = 'text-[10px] font-black text-gray-400 uppercase tracking-widest'

function Stepper({
  value, onChange, min, max, step = 1, unit,
}: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const [inputValue, setInputValue] = useState(value.toString())

  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  return (
    <div className="flex items-center gap-2">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-black text-base transition-all shrink-0">−</button>
      <div className="flex-1 flex flex-col items-center justify-center">
        <input 
          type="number"
          min={min} max={max} step={step}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min && v <= max) {
              onChange(v)
            }
          }}
          onBlur={() => {
            let v = parseFloat(inputValue)
            if (isNaN(v)) v = min
            v = Math.max(min, Math.min(max, v))
            setInputValue(v.toString())
            onChange(v)
          }}
          className="w-20 text-center text-lg font-black text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && <p className="text-[9px] text-gray-400 leading-none">{unit}</p>}
      </div>
      <button type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-black text-base transition-all shrink-0">+</button>
    </div>
  )
}

export default function ContinuePlanModal({
  plan, herds, initialHerdIds, initialDailyAllocationKg, initialTargetRemnant, onClose, onContinue
}: Props) {
  const [selectedHerdIds, setSelectedHerdIds] = useState<string[]>(initialHerdIds)
  const [dailyAllocationKg, setDailyAllocationKg] = useState<number>(initialDailyAllocationKg || 12)
  const [targetRemnant, setTargetRemnant] = useState<number>(initialTargetRemnant || 600)

  useEffect(() => {
    if (initialHerdIds.length === 0 && herds.length > 0) {
      setSelectedHerdIds(herds.map(h => h.id))
    }
  }, [initialHerdIds, herds])

  const toggleHerd = (id: string) =>
    setSelectedHerdIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const currentTotalEV = herds.filter(h => selectedHerdIds.includes(h.id)).reduce((sum, h) => sum + Number(h.total_ev || 0), 0)
  
  const seasonDays = plan.start_date && plan.end_date
    ? Math.round((new Date(plan.end_date).getTime() - new Date(plan.start_date).getTime()) / 86400000)
    : 180

  const accent = { btn: 'bg-green-600 hover:bg-green-700', ring: 'ring-green-500/20', border: 'border-green-500', text: 'text-green-600', chip: 'bg-green-600 border-green-600', chipBg: 'bg-green-50 border-green-500' }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header fijo */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0 flex items-start justify-between">
          <div>
            <h3 className="text-base font-black text-gray-950">Continuar Plan Forrajero</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
              Revisá los datos y seleccioná los rodeos a trazar
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scroll body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Resumen del Plan */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={LABEL}>Nombre del Plan</p>
                <p className="text-sm font-black text-gray-900 mt-1">{plan.name}</p>
              </div>
              <div className="text-right">
                <p className={LABEL}>Temporada</p>
                <p className="text-sm font-black text-gray-900 mt-1 capitalize">{plan.season_type === 'cerrado' ? 'Otoño/Invierno' : plan.season_type === 'abierto' ? 'Primavera/Verano' : 'Anual'}</p>
              </div>
            </div>
            
            {plan.start_date && plan.end_date && (
              <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                <Leaf className="w-4 h-4 text-green-600" />
                <p className="text-sm font-black text-gray-700">{seasonDays} días de temporada</p>
                <span className="text-xs text-gray-400 font-medium">
                  ({new Date(plan.start_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} → {new Date(plan.end_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })})
                </span>
              </div>
            )}
          </div>

          {/* Rodeos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={LABEL}>Rodeos para este trazado</label>
              <span className="text-[10px] text-gray-400 font-bold">{selectedHerdIds.length} seleccionados</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {herds.map(h => {
                const sel = selectedHerdIds.includes(h.id)
                const displayEV = Number(h.total_ev || 0)
                return (
                  <div key={h.id} onClick={() => toggleHerd(h.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer transition-all ${sel ? `${accent.chipBg} ${accent.border}` : 'border-gray-100 bg-white hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-lg border-2 flex items-center justify-center shrink-0 ${sel ? `${accent.chip} text-white` : 'border-gray-300'}`}>
                        {sel && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{h.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {h.head_count} cab. · <span className="font-black text-green-700">{displayEV.toFixed(1)} EV</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {herds.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No hay rodeos configurados.</p>
            )}
          </div>

          {/* Parámetros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
              <div>
                <p className={LABEL}>Ración diaria</p>
                <p className="text-[10px] text-gray-400 mt-0.5">kg MS / EV / día</p>
              </div>
              <Stepper value={dailyAllocationKg} onChange={setDailyAllocationKg} min={6} max={25} step={0.5} />
            </div>
            <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
              <div>
                <p className={LABEL}>Remanente</p>
                <p className="text-[10px] text-gray-400 mt-0.5">kg MS / ha al salir</p>
              </div>
              <Stepper value={targetRemnant} onChange={setTargetRemnant} min={0} max={3000} step={50} />
            </div>
          </div>

          {/* Resumen de consumo */}
          {selectedHerdIds.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-800 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" /> EV total: {Number(currentTotalEV).toFixed(1)}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-600" /> Consumo diario: {(currentTotalEV * dailyAllocationKg).toFixed(0)} kg MS
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onContinue(selectedHerdIds, dailyAllocationKg, targetRemnant)}
            disabled={selectedHerdIds.length === 0}
            className={`px-8 py-2.5 rounded-xl text-white text-sm font-black shadow-sm transition-all disabled:opacity-50 ${accent.btn}`}
          >
            Comenzar a trazar
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
