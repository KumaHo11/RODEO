import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2, Zap, HelpCircle } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

const LABEL = "text-sm font-black text-gray-950"

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
            const v = parseFloat(inputValue)
            if (isNaN(v) || v < min || v > max) {
              setInputValue(value.toString())
            } else {
              setInputValue(v.toString())
            }
          }}
          className="text-2xl font-black text-center bg-transparent border-none focus:outline-none w-24 text-gray-900"
        />
        {unit && <span className="text-[10px] font-bold text-gray-400 mt-0.5">{unit}</span>}
      </div>
      <button type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-black text-base transition-all shrink-0">+</button>
    </div>
  )
}

export default function PlanBlockModal({
  plan,
  paddocks,
  herds,
  onClose,
  onSaved
}: {
  plan: any
  paddocks: any[]
  herds: any[]
  onClose: () => void
  onSaved: (updatedPlan: any) => void
}) {
  const paddock = paddocks.find((p) => p.id === plan.paddock_id)
  
  const [selectedHerdIds, setSelectedHerdIds] = useState<string[]>(
    plan.herd_ids && plan.herd_ids.length > 0 ? plan.herd_ids : (plan.herd_id ? [plan.herd_id] : [])
  )
  const [dailyAllocationKg, setDailyAllocationKg] = useState(Number(plan.ai_analysis?.daily_allocation_kg || plan.daily_allocation_kg) || 12)
  const [targetRemnant, setTargetRemnant] = useState(Number(plan.ai_analysis?.target_remnant_kg_ha || plan.target_remnant_kg_ha) || 400)
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSuggested = plan.ai_analysis?.plan_source === 'suggested'

  // Calculations for Holistic Motor display
  const msHa = Number(paddock?.dry_matter_kg_ha || 0)
  const areaHa = Number(paddock?.area_ha || 0)
  const totalEV = herds.filter((h) => selectedHerdIds.includes(h.id)).reduce((sum, h) => sum + Number(h.total_ev || 0), 0)
  
  const usableMs = Math.max(0, (msHa - targetRemnant) * areaHa)
  const dailyDemand = totalEV * dailyAllocationKg
  const estimatedDah = (dailyDemand > 0 && usableMs > 0) ? Math.max(0, Math.floor(usableMs / dailyDemand)) : 0

  const toggleHerd = (id: string) => {
    setSelectedHerdIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (selectedHerdIds.length === 0) {
      setError('Debes seleccionar al menos un rodeo.')
      return
    }
    
    setSaving(true)
    setError(null)
    try {
      const newExitDate = new Date(plan.entry_date + 'T00:00:00')
      newExitDate.setDate(newExitDate.getDate() + (estimatedDah > 0 ? estimatedDah : 1))
      const newExitStr = newExitDate.toISOString().split('T')[0]

      const payload = {
        herd_ids: selectedHerdIds,
        // Preserve herd_id as the primary herd for backward compatibility
        herd_id: selectedHerdIds[0] || null,
        exit_date: newExitStr,
        ai_analysis: {
          ...(plan.ai_analysis || {}),
          daily_allocation_kg: dailyAllocationKg,
          target_remnant_kg_ha: targetRemnant,
        }
      }
      
      const res = await apiFetch(`/api/grazing-plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `Error ${res.status}`)
        return
      }
      const data = await res.json()
      onSaved({ ...plan, ...data })
      onClose()
    } catch (e: any) {
      setError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${isSuggested ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {isSuggested ? 'Sugerida' : 'Manual'}
                </span>
                <h3 className="text-base font-black text-gray-950">
                  Editar bloque de plan
                </h3>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                {paddock?.name} · {areaHa.toFixed(1)} ha
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          
          {/* Rodeos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={LABEL}>Animales a pastorear</label>
              {selectedHerdIds.length > 0 && (
                <span className="text-[10px] font-bold text-gray-500">
                  {selectedHerdIds.length} seleccionado{selectedHerdIds.length > 1 ? 's' : ''} · {totalEV.toFixed(0)} EV
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {herds.map(h => {
                const isSelected = selectedHerdIds.includes(h.id)
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleHerd(h.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isSelected ? 'text-green-800' : 'text-gray-900'}`}>{h.name}</p>
                      <p className={`text-[10px] ${isSelected ? 'text-green-600' : 'text-gray-400'}`}>
                        {Number(h.head_count || h.animal_count || 0)} cab. · {Number(h.total_ev).toFixed(0)} EV
                      </p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-green-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ración */}
          <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div>
              <p className={LABEL}>Ración diaria por EV</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Cuánto consume cada equivalente vaca por día</p>
            </div>
            <Stepper value={dailyAllocationKg} onChange={setDailyAllocationKg} min={6} max={20} step={0.5} unit="kg MS/EV/día" />
          </div>

          {/* Remanente */}
          <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div>
              <p className={LABEL}>Remanente objetivo</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Biomasa mínima que dejás en {paddock?.name} al salir</p>
            </div>
            <Stepper value={targetRemnant} onChange={setTargetRemnant} min={0} max={2000} step={50} unit="kg MS/ha" />
          </div>

          {/* Motor holístico */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-2 border border-gray-100">
               <Zap className="w-5 h-5 text-gray-900" />
             </div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
               Disponibilidad estimada
             </p>
             <p className="text-3xl font-black text-gray-950 mb-1">
               {estimatedDah} <span className="text-sm text-gray-400 font-bold">días</span>
             </p>
             <p className="text-[10px] text-gray-500 font-medium max-w-xs mx-auto">
               En base a {msHa} kg MS/ha actuales de {paddock?.name}, reservando {targetRemnant} kg de remanente.
             </p>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || selectedHerdIds.length === 0}
            className="w-full flex justify-center items-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Ajustar plan'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
