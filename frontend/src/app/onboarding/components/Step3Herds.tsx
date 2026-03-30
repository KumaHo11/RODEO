'use client'

import React, { useState, useMemo } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { Plus, Trash2, ArrowLeft, ArrowRight, ClipboardList, Scale, Leaf, SkipForward, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const SPECIES = [
  { id: 'vacas',       label: 'Vaca',       emoji: '🐄', baseWeight: 400, demandFactor: 1.0  },
  { id: 'vaquillonas', label: 'Vaquillona', emoji: '🐄', baseWeight: 300, demandFactor: 1.0  },
  { id: 'terneros',    label: 'Ternero',    emoji: '🐄', baseWeight: 160, demandFactor: 1.0  },
  { id: 'ovejas',      label: 'Oveja',      emoji: '🐑', baseWeight: 45,  demandFactor: 0.84 },
  { id: 'cabras',      label: 'Cabra',      emoji: '🐐', baseWeight: 40,  demandFactor: 0.84 },
  { id: 'caballos',    label: 'Caballo',    emoji: '🐴', baseWeight: 500, demandFactor: 1.27 },
  { id: 'toros',       label: 'Toro',       emoji: '🐂', baseWeight: 600, demandFactor: 1.0  },
]

const MS_PER_EV_DAY = 11

function calcEV(species: string, weight: number, count: number) {
  const sp = SPECIES.find(s => s.id === species)
  if (!sp) return 0
  return parseFloat((Math.pow(weight / 400, 0.75) * sp.demandFactor * count).toFixed(1))
}

export default function Step3Herds() {
  const { data, updateData, prevStep, nextStep } = useOnboarding()
  const [selectedSpecies, setSelectedSpecies] = useState(SPECIES[0].id)
  const [name,   setName]   = useState('')
  const [breed,  setBreed]  = useState('')
  const [count,  setCount]  = useState<number | ''>('')
  const [weight, setWeight] = useState(400)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  const currentEV     = useMemo(() => calcEV(selectedSpecies, weight, Number(count) || 0), [selectedSpecies, weight, count])
  const currentMsDay  = useMemo(() => Math.round(currentEV * MS_PER_EV_DAY), [currentEV])
  const totalEV       = data.herds.reduce((s, h) => s + h.totalEV, 0)
  const totalAnimals  = data.herds.reduce((s, h) => s + h.headCount, 0)
  const totalMsDay    = Math.round(totalEV * MS_PER_EV_DAY)
  const canAdd        = !!(name.trim() && Number(count) > 0)

  const addHerd = () => {
    if (!canAdd) return
    const ev = calcEV(selectedSpecies, weight, Number(count))
    updateData({ herds: [...data.herds, { name: name.trim(), species: selectedSpecies as any, breed, headCount: Number(count), avgWeight: weight, age: 0, totalEV: ev }] })
    const sp = SPECIES.find(s => s.id === selectedSpecies)!
    setName(''); setBreed(''); setCount(''); setWeight(sp.baseWeight)
  }

  const removeHerd = (i: number) => updateData({ herds: data.herds.filter((_, idx) => idx !== i) })
  const handleSkip = () => { updateData({ skippedHerds: true }); nextStep() }
  const handleNext = () => { updateData({ skippedHerds: false }); nextStep() }

  return (
    <div className="flex-1 flex flex-col py-4 px-6 bg-white overflow-hidden min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Paso 3 de 4 · Inventario ganadero</p>
          <h2 className="text-sm font-black text-gray-900">{data.fieldName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSkipWarning(true)} className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors">
            <SkipForward className="w-3 h-3" /> Saltar este paso
          </button>
          <button onClick={prevStep} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Atrás
          </button>
        </div>
      </div>

      {/* Skip warning */}
      <AnimatePresence>
        {showSkipWarning && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-black text-amber-800">¿Saltar el inventario de rebaños?</p>
              <p className="text-[10px] text-amber-600 font-normal mt-0.5 leading-relaxed">
                Los cálculos de <strong>carga animal (EV/ha)</strong>, demanda forrajera y planificación requieren los rebaños.
                Podés completarlo después desde la sección <strong>Rebaños</strong>.
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={handleSkip} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-lg hover:bg-amber-600 transition-all">
                  <SkipForward className="w-3 h-3" /> Saltar igual
                </button>
                <button onClick={() => setShowSkipWarning(false)} className="px-3 py-1.5 bg-white text-amber-600 border border-amber-200 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-all">
                  Registrar ahora
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

        {/* FORM */}
        <div className="w-[320px] shrink-0 flex flex-col border-r border-gray-100">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <h3 className="text-sm font-black text-gray-900">Agregar lote de animales</h3>
            <p className="text-[10px] text-gray-400 font-normal mt-0.5">EV y consumo calculados automáticamente</p>
          </div>

          <div className="flex-1 px-6 py-5 overflow-y-auto space-y-4 min-h-0">
            {/* Species pills */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Especie / Categoría</label>
              <div className="grid grid-cols-4 gap-1.5">
                {SPECIES.map(s => (
                  <button key={s.id} type="button" onClick={() => { setSelectedSpecies(s.id); setWeight(s.baseWeight) }}
                    className={`flex flex-col items-center px-1 py-2 rounded-xl border text-[9px] font-bold transition-all ${
                      selectedSpecies === s.id ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                    }`}>
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="mt-1 leading-tight text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Breed */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nombre</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Recría B"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Raza</label>
                <input type="text" value={breed} onChange={e => setBreed(e.target.value)} placeholder="Ej: Angus"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal" />
              </div>
            </div>

            {/* Count + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Cabezas</label>
                <input type="number" min="1" value={count} onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Peso prom. (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none font-normal" />
              </div>
            </div>

            {/* EV + MS preview */}
            {Number(count) > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
                  <Scale className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-[8px] font-black text-green-500 uppercase tracking-widest">EV este lote</p>
                    <p className="text-base font-black text-green-700 leading-none">{currentEV} <span className="text-[9px] font-normal">EV</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">MS/día</p>
                    <p className="text-base font-black text-emerald-700 leading-none">{currentMsDay} <span className="text-[9px] font-normal">kg</span></p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Add — always visible */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={addHerd} disabled={!canAdd}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all text-sm font-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Agregar al inventario
            </button>
          </div>
        </div>

        {/* INVENTORY */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                <ClipboardList className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900">Inventario</h3>
                <p className="text-[9px] text-gray-400 font-normal">{data.herds.length} lote{data.herds.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {data.herds.length > 0 && (
              <div className="text-right">
                <p className="text-2xl font-black text-green-600 leading-none">{totalEV.toFixed(1)} <span className="text-xs font-normal text-gray-400">EV</span></p>
                <p className="text-[9px] font-bold text-emerald-600">{totalMsDay.toLocaleString()} kg MS/día</p>
              </div>
            )}
          </div>

          {/* Stats */}
          {data.herds.length > 0 && (
            <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-gray-50 shrink-0">
              {[{ v: totalAnimals, l: 'cabezas' }, { v: totalEV.toFixed(1), l: 'EV totales' }, { v: `${totalMsDay.toLocaleString()}`, l: 'kg MS/día' }].map((s, i) => (
                <div key={i} className="text-center bg-gray-50 rounded-xl py-2">
                  <p className={`text-lg font-black ${i === 1 ? 'text-green-600' : i === 2 ? 'text-emerald-600' : 'text-gray-800'}`}>{s.v}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{s.l}</p>
                </div>
              ))}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
            <AnimatePresence>
              {data.herds.map((h, idx) => {
                const hMsDay = Math.round(h.totalEV * MS_PER_EV_DAY)
                const sp = SPECIES.find(s => s.id === h.species)
                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-green-100 transition-all group shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-base shrink-0">
                        {sp?.emoji || '🐄'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900">{h.name}</p>
                        <p className="text-[10px] text-gray-400 font-normal">{h.headCount} cab. · {h.breed || 'Sin raza'} · {h.avgWeight} kg</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-orange-500">{h.totalEV} <span className="text-[9px] font-normal text-gray-400">EV</span></p>
                        <p className="text-[9px] font-bold text-emerald-600">{hMsDay} kg MS/día</p>
                      </div>
                      <button onClick={() => removeHerd(idx)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {data.herds.length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center mb-4">
                  <ClipboardList className="w-5 h-5 text-gray-200" />
                </div>
                <p className="text-sm font-bold text-gray-400">Cargá tu primer lote</p>
                <p className="text-[10px] text-gray-300 font-normal mt-1">Seleccioná la especie y completá el formulario</p>
              </div>
            )}
          </div>

          {/* Next */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
            <p className="text-[10px] text-gray-400 font-normal">
              {data.herds.length === 0 && 'Sin rebaños — usá "Saltar este paso" para continuar'}
            </p>
            <button onClick={handleNext} disabled={data.herds.length === 0}
              className="bg-green-600 text-white font-black px-8 py-3 rounded-xl text-sm flex items-center gap-2 hover:bg-green-700 disabled:opacity-25 transition-all">
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
