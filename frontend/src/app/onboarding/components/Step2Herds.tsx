'use client'

import React, { useState, useMemo } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { Plus, Trash2, ArrowLeft, ArrowRight, ClipboardList, Info, ChevronDown } from 'lucide-react'

const SPECIES = [
  { id: 'vacas',       label: 'Vaca',       baseWeight: 400, demandFactor: 1.0 },
  { id: 'vaquillonas', label: 'Vaquillona', baseWeight: 300, demandFactor: 1.0 },
  { id: 'terneros',    label: 'Ternero',    baseWeight: 160, demandFactor: 1.0 },
  { id: 'ovejas',      label: 'Oveja',      baseWeight: 45,  demandFactor: 0.84 },
  { id: 'cabras',      label: 'Cabra',      baseWeight: 40,  demandFactor: 0.84 },
  { id: 'caballos',    label: 'Caballo',    baseWeight: 500, demandFactor: 1.27 },
  { id: 'toros',       label: 'Toro',       baseWeight: 600, demandFactor: 1.0 },
]

export default function Step2Herds() {
  const { data, updateData, prevStep, nextStep } = useOnboarding()

  const [selectedSpecies, setSelectedSpecies] = useState(SPECIES[0].id)
  const [name,   setName]   = useState('')
  const [breed,  setBreed]  = useState('')
  const [count,  setCount]  = useState(0)
  const [weight, setWeight] = useState(400)
  const [age,    setAge]    = useState(2)

  const currentEV = useMemo(() => {
    const sp = SPECIES.find(s => s.id === selectedSpecies)
    if (!sp) return 0
    return parseFloat((Math.pow(weight / 400, 0.75) * sp.demandFactor * count).toFixed(1))
  }, [selectedSpecies, weight, count])

  const addHerd = () => {
    if (!name || count <= 0) return
    updateData({ herds: [...data.herds, { name, species: selectedSpecies as any, breed, headCount: count, avgWeight: weight, age, totalEV: currentEV }] })
    setName(''); setBreed(''); setCount(0); setWeight(400); setAge(2)
  }

  const removeHerd = (i: number) => updateData({ herds: data.herds.filter((_, idx) => idx !== i) })

  const totalEV = data.herds.reduce((s, h) => s + h.totalEV, 0)

  return (
    <div className="flex-1 flex flex-col py-6 px-8 bg-white overflow-hidden min-h-0">
      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

        {/* ══ COL LEFT — Form (50%) ══ */}
        <div className="flex-1 flex flex-col border-r border-gray-100 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-7 pb-5 border-b border-gray-100 shrink-0">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-1">Inventario ganadero</h2>
            <p className="text-xs text-gray-400 font-normal leading-relaxed">
              Registrá los lotes de animales que pastorean en tu establecimiento.
            </p>
          </div>

          {/* Form body — scrollable if content overflows */}
          <div className="flex-1 px-8 py-5 flex flex-col gap-4 overflow-y-auto min-h-0 custom-scrollbar">
            {/* Species */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Especie / Categoría</label>
              <div className="relative">
                <select value={selectedSpecies}
                  onChange={e => { const s = SPECIES.find(sp => sp.id === e.target.value); setSelectedSpecies(e.target.value); if (s) setWeight(s.baseWeight) }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none font-normal appearance-none pr-10 transition-all">
                  {SPECIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Name + Breed */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Nombre del lote</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Recría B"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Raza</label>
                <input type="text" value={breed} onChange={e => setBreed(e.target.value)} placeholder="Ej: Angus"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal transition-all" />
              </div>
            </div>

            {/* Count + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Cabezas</label>
                <input type="number" min="0" value={count || ''} onChange={e => setCount(Number(e.target.value))} placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Peso prom. (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none font-normal transition-all" />
              </div>
            </div>

            {/* Age */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Edad (años)</label>
              <input type="number" step="0.5" min="0" value={age || ''} onChange={e => setAge(Number(e.target.value))} placeholder="Ej: 2.5"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal transition-all" />
            </div>

            {/* EV Badge */}
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-xl border border-green-100 shrink-0">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-green-600" />
                <p className="text-[10px] font-bold text-green-700 tracking-widest uppercase">Demanda estimada</p>
              </div>
              <p className="text-lg font-bold text-green-700 leading-none">{currentEV} <span className="text-[10px] font-normal opacity-60">EV</span></p>
            </div>

            {/* ══ AGREGAR BOTÓN ══ */}
            <div className="pt-2 shrink-0">
              <button 
                type="button" 
                onClick={addHerd} 
                disabled={!name || count <= 0}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all text-sm font-bold shadow-sm shadow-green-200 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> 
                Agregar al inventario
              </button>
            </div>
          </div>

          {/* ── ATRÁS — bottom left of form col only ── */}
          <div className="px-8 py-5 border-t border-gray-100 shrink-0">
            <button onClick={prevStep}
              className="text-gray-400 hover:text-gray-700 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Atrás
            </button>
          </div>
        </div>

        {/* ══ COL RIGHT — Inventory (50%) ══ */}
        <div className="flex-1 flex flex-col bg-gray-50/30 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-7 pb-5 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">Inventario</h3>
                <p className="text-[10px] text-gray-400 font-normal">{data.herds.length} lote{data.herds.length !== 1 ? 's' : ''} cargado{data.herds.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {data.herds.length > 0 && (
              <div className="text-right">
                <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Carga total</p>
                <p className="text-2xl font-bold text-green-600 leading-none">{totalEV.toFixed(1)} <span className="text-xs font-normal text-gray-400">EV</span></p>
              </div>
            )}
          </div>

          {/* Herd cards — INDEPENDENT SCROLL */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2.5 min-h-0">
            {data.herds.map((h, idx) => (
              <div key={idx}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-green-100 transition-all group shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:bg-green-600 group-hover:text-white transition-colors uppercase">
                    {h.species.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{h.name}</p>
                    <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                      {h.headCount} cabezas · {h.breed || 'Sin raza'} · {h.age} años
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-orange-500">{h.totalEV} <span className="text-[10px] font-normal text-gray-400">EV</span></p>
                  <button onClick={() => removeHerd(idx)}
                    className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {data.herds.length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl py-20 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center mb-4">
                  <ClipboardList className="w-5 h-5 text-gray-200" />
                </div>
                <p className="text-sm font-bold text-gray-400">Cargá tu primer lote</p>
                <p className="text-[10px] text-gray-300 font-normal mt-1">Completá el formulario y agregá</p>
              </div>
            )}
          </div>

          {/* ── SIGUIENTE — bottom right of inventory col ── */}
          <div className="px-8 py-5 border-t border-gray-100 shrink-0 flex justify-end">
            <button onClick={nextStep} disabled={data.herds.length === 0}
              className="bg-green-600 text-white font-bold px-8 py-3 rounded-xl text-sm flex items-center gap-2 hover:bg-green-700 disabled:opacity-20 transition-all">
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
