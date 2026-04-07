'use client'

import React, { useState, useMemo } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import { finishOnboarding } from '../actions'
import {
  Plus, Trash2, ArrowLeft, ClipboardList, Scale, Leaf,
  SkipForward, AlertTriangle, X, CheckCircle2, Loader2, TrendingUp
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SuccessModal from './SuccessModal'
import {
  CATEGORIAS_COMERCIALES, CATEGORIA_PESO_DEFAULT,
  CATEGORIA_DEMAND_FACTOR, RAZAS_POR_CATEGORIA, CATEGORIA_COLORS,
  type CategoriaComercial
} from '@/lib/categorias'

// ── Non-bovine species (for forage / EV purposes but no valuation) ──────────
const OTHER_SPECIES = [
  { id: 'ovejas',    label: 'Ovejas',    demandFactor: 0.15, defaultWeight: 45 },
  { id: 'cabras',    label: 'Cabras',    demandFactor: 0.15, defaultWeight: 40 },
  { id: 'caballos',  label: 'Caballos',  demandFactor: 1.27, defaultWeight: 500 },
]

const MS_PER_EV_DAY = 11

function calcEV(demandFactor: number, weight: number, count: number) {
  return parseFloat((Math.pow(weight / 400, 0.75) * demandFactor * count).toFixed(1))
}

export default function Step3Herds() {
  const { data, updateData, prevStep } = useOnboarding()
  const { user } = useAuth()

  // ── Category selection ─────────────────────────────────────────────────────
  const [selectedCat, setSelectedCat] = useState<CategoriaComercial | string>(CATEGORIAS_COMERCIALES[0])
  const [showOtherSpecies, setShowOtherSpecies] = useState(false)

  // Determine demand factor and default weight from selection
  const selectedIsCat = CATEGORIAS_COMERCIALES.includes(selectedCat as CategoriaComercial)
  const currentDemandFactor = selectedIsCat
    ? CATEGORIA_DEMAND_FACTOR[selectedCat as CategoriaComercial]
    : OTHER_SPECIES.find(s => s.id === selectedCat)?.demandFactor ?? 1.0
  const currentDefaultWeight = selectedIsCat
    ? CATEGORIA_PESO_DEFAULT[selectedCat as CategoriaComercial]
    : OTHER_SPECIES.find(s => s.id === selectedCat)?.defaultWeight ?? 350

  const availableBreeds = RAZAS_POR_CATEGORIA[selectedCat] ?? ['Otra']

  // ── Herd form state ────────────────────────────────────────────────────────
  const [name,   setName]   = useState('')
  const [breed,  setBreed]  = useState('')
  const [count,  setCount]  = useState<number | ''>('')
  const [weight, setWeight] = useState(currentDefaultWeight)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  // ── Finish / submit state ──────────────────────────────────────────────────
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleCatSelect = (cat: string) => {
    setSelectedCat(cat)
    const isPrimary = CATEGORIAS_COMERCIALES.includes(cat as CategoriaComercial)
    const w = isPrimary
      ? CATEGORIA_PESO_DEFAULT[cat as CategoriaComercial]
      : OTHER_SPECIES.find(s => s.id === cat)?.defaultWeight ?? 350
    setWeight(w)
    setBreed('')
  }

  const currentEV    = useMemo(() => calcEV(currentDemandFactor, weight, Number(count) || 0), [currentDemandFactor, weight, count])
  const currentMsDay = useMemo(() => Math.round(currentEV * MS_PER_EV_DAY), [currentEV])
  const totalEV      = data.herds.reduce((s: number, h: any) => s + h.totalEV, 0)
  const totalAnimals = data.herds.reduce((s: number, h: any) => s + h.headCount, 0)
  const totalMsDay   = Math.round(totalEV * MS_PER_EV_DAY)
  const canAdd       = !!(name.trim() && Number(count) > 0)

  // EV vs capacity from paddocks
  const paddocksHa   = data.paddocks.reduce((s: number, p: any) => s + (p.area_ha || 0), 0)
  const fieldHa      = data.fieldBoundaryHa > 0 ? data.fieldBoundaryHa : paddocksHa
  const evPerHa      = fieldHa > 0 && totalEV > 0 ? (totalEV / fieldHa).toFixed(2) : null
  const evCapColor   = !evPerHa ? 'text-gray-400' : parseFloat(evPerHa) <= 0.8 ? 'text-green-600' : parseFloat(evPerHa) <= 1.2 ? 'text-amber-500' : 'text-red-500'
  const evCapLabel   = !evPerHa ? '—' : parseFloat(evPerHa) <= 0.8 ? 'Normal' : parseFloat(evPerHa) <= 1.2 ? 'Carga alta' : 'Sobrepastoreo'

  const addHerd = () => {
    if (!canAdd) return
    const ev = calcEV(currentDemandFactor, weight, Number(count))
    updateData({ herds: [...data.herds, {
      name: name.trim(),
      species: selectedCat,
      categoria: selectedIsCat ? selectedCat : null,
      breed,
      headCount: Number(count),
      avgWeight: weight,
      age: 0,
      totalEV: ev
    }]})
    setName(''); setBreed(''); setCount(''); setWeight(currentDefaultWeight)
  }

  const removeHerd = (i: number) => updateData({ herds: data.herds.filter((_: any, idx: number) => idx !== i) })

  // ── FINISH ONBOARDING ──────────────────────────────────────────────────────
  const handleFinish = async (skipHerds = false) => {
    if (!user) return
    setSubmitting(true)
    setError(null)
    if (skipHerds) updateData({ skippedHerds: true })

    try {
      const paddockAreaHa = data.paddocks.reduce((s: number, p: any) => s + p.area_ha, 0)
      const res = await finishOnboarding({
        firebaseUid:     user.uid,
        fieldName:       data.fieldName,
        totalArea:       data.fieldBoundaryHa || paddockAreaHa,
        location:        data.location!,
        fieldBoundary:   data.fieldBoundary,
        fieldBoundaryHa: data.fieldBoundaryHa || 0,
        herds:           skipHerds ? [] : data.herds,
        paddocks:        data.paddocks,
      })

      if (res.success) {
        setShowSuccess(true)
        try {
          const idToken = await user.getIdToken()
          await fetch('/api/auth/onboarding-step', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ step: 4 }),
          })
        } catch {}
        setTimeout(() => {
          setIsRedirecting(true)
          setTimeout(() => window.location.replace('/dashboard'), 1200)
        }, 800)
      }
    } catch (err: any) {
      console.error('finishOnboarding error:', err)
      setError('Error al guardar: ' + (err.message || 'Intenta de nuevo'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SuccessModal
        isOpen={showSuccess}
        fieldName={data.fieldName}
        totalHa={data.fieldBoundaryHa || data.paddocks.reduce((s: number, p: any) => s + p.area_ha, 0)}
        totalAnimals={totalAnimals}
        totalEV={totalEV}
        paddocksCount={data.paddocks.length}
        isRedirecting={isRedirecting}
      />

      <div className="flex-1 flex flex-col py-4 px-6 bg-white overflow-hidden min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <p className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Paso 3 de 3 · Inventario ganadero</p>
            <h2 className="text-sm font-black text-gray-900">{data.fieldName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSkipWarning(true)} className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors">
              <SkipForward className="w-3 h-3" /> Saltar
            </button>
            <button onClick={prevStep} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors">
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
                <p className="text-xs font-black text-amber-800">¿Finalizar sin inventario?</p>
                <p className="text-[10px] text-amber-600 font-normal mt-0.5 leading-relaxed">
                  Podés cargar los rebaños después desde la sección <strong>Rebaños</strong> del Dashboard.
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleFinish(true)} disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-lg hover:bg-amber-600 transition-all disabled:opacity-50">
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
                    Finalizar igual
                  </button>
                  <button onClick={() => setShowSkipWarning(false)} className="px-3 py-1.5 bg-white text-amber-600 border border-amber-200 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-all">
                    Registrar ahora
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl shrink-0">
            <p className="text-xs font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* Main 50/50 layout */}
        <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

          {/* ── FORM (LEFT) ── */}
          <div className="flex-1 flex flex-col border-r border-gray-100 min-w-0">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-black text-gray-800">Agregar lote de animales</h3>
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">EV y consumo calculados automáticamente</p>
            </div>

            <div className="flex-1 px-5 py-4 overflow-y-auto space-y-4 min-h-0">

              {/* ── Bovine categories (main) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">Categoría comercial</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIAS_COMERCIALES.map(cat => {
                    const colors = CATEGORIA_COLORS[cat]
                    const isSelected = selectedCat === cat
                    return (
                      <button key={cat} type="button"
                        onClick={() => handleCatSelect(cat)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? `${colors.bg} ${colors.text} border-transparent shadow-sm`
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:text-gray-800'
                        }`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? colors.dot : 'bg-gray-300'}`} />
                        {cat}
                      </button>
                    )
                  })}
                </div>
                {/* Otras especies */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOtherSpecies(v => !v)}
                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600 mt-1"
                  >
                    {showOtherSpecies ? '▲ Ocultar otras especies' : '▼ Otras especies (ovejas, caballos...)'}
                  </button>
                  <AnimatePresence>
                    {showOtherSpecies && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap gap-1.5 mt-2 overflow-hidden">
                        {OTHER_SPECIES.map(s => (
                          <button key={s.id} type="button"
                            onClick={() => handleCatSelect(s.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                              selectedCat === s.id
                                ? 'border-violet-300 bg-violet-50 text-violet-700'
                                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                            }`}>
                            {s.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Name + Breed */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">Nombre</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Recría B"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">Raza</label>
                  <div className="flex flex-wrap gap-1">
                    {availableBreeds.slice(0, 4).map(b => (
                      <button key={b} type="button" onClick={() => setBreed(b)}
                        className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all ${
                          breed === b ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-500 bg-gray-50 hover:border-gray-300'
                        }`}>
                        {b}
                      </button>
                    ))}
                    {availableBreeds.length > 4 && (
                      <select value={breed} onChange={e => setBreed(e.target.value)}
                        className="px-2 py-1 text-[9px] font-bold rounded-lg border border-gray-200 bg-gray-50 text-gray-500 outline-none cursor-pointer">
                        <option value="">+ más razas</option>
                        {availableBreeds.slice(4).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Count + Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">Cabezas</label>
                  <input type="number" min="1" value={count} onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">Peso prom. (kg)</label>
                  <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none font-normal" />
                </div>
              </div>

              {/* EV preview */}
              {Number(count) > 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
                    <Scale className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">EV lote</p>
                      <p className="text-base font-black text-green-700 leading-none">{currentEV} <span className="text-[9px] font-normal">EV</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">MS/día</p>
                      <p className="text-base font-black text-emerald-700 leading-none">{currentMsDay} <span className="text-[9px] font-normal">kg</span></p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Add button */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={addHerd} disabled={!canAdd}
                className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 bg-white px-4 py-3 rounded-xl hover:bg-green-50 active:scale-[0.98] transition-all text-sm font-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group">
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Agregar al inventario
              </button>
            </div>
          </div>

          {/* ── INVENTORY (RIGHT) ── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                  <ClipboardList className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">Inventario</h3>
                  <p className="text-[10px] text-gray-500 font-normal">{data.herds.length} lote{data.herds.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {data.herds.length > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-black text-green-600 leading-none">{totalEV.toFixed(1)} <span className="text-xs font-normal text-gray-500">EV</span></p>
                  <p className="text-[10px] font-bold text-emerald-600">{totalMsDay.toLocaleString()} kg MS/día</p>
                </div>
              )}
            </div>

            {/* Stats */}
            {data.herds.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-50 shrink-0 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: totalAnimals, l: 'cabezas' }, { v: totalEV.toFixed(1), l: 'EV totales' }, { v: `${totalMsDay.toLocaleString()}`, l: 'kg MS/día' }].map((s, i) => (
                    <div key={i} className="text-center bg-gray-50 rounded-xl py-2">
                      <p className={`text-lg font-black ${i === 1 ? 'text-green-600' : i === 2 ? 'text-emerald-600' : 'text-gray-800'}`}>{s.v}</p>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{s.l}</p>
                    </div>
                  ))}
                </div>
                {fieldHa > 0 && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                    !evPerHa ? 'bg-gray-50 border-gray-100' :
                    parseFloat(evPerHa) <= 0.8 ? 'bg-green-50 border-green-100' :
                    parseFloat(evPerHa) <= 1.2 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                  }`}>
                    <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${evCapColor}`} />
                    <div className="flex-1">
                      <span className="font-black text-gray-700">Carga actual: </span>
                      <span className={`font-black ${evCapColor}`}>{evPerHa ?? '—'} EV/ha</span>
                      <span className="text-gray-400 font-normal"> · {evCapLabel}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-normal shrink-0">{fieldHa.toFixed(0)} ha</span>
                  </div>
                )}
              </div>
            )}

            {/* Herd list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
              <AnimatePresence>
                {data.herds.map((h: any, idx: number) => {
                  const hMsDay = Math.round(h.totalEV * MS_PER_EV_DAY)
                  const isBovine = CATEGORIAS_COMERCIALES.includes(h.species as CategoriaComercial)
                  const colors = isBovine ? CATEGORIA_COLORS[h.species as CategoriaComercial] : null
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                      className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 hover:border-green-100 transition-all group shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colors ? colors.bg : 'bg-violet-50 border-violet-100'}`}>
                          <span className={`text-[10px] font-black ${colors ? colors.text : 'text-violet-700'}`}>
                            {(h.species || '').slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">{h.name}</p>
                          <p className="text-[10px] text-gray-500 font-normal">{h.headCount} cab. · {h.breed || 'Sin raza'} · {h.avgWeight} kg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-500">{h.totalEV} <span className="text-[9px] font-normal text-gray-400">EV</span></p>
                          <p className="text-[10px] font-bold text-emerald-600">{hMsDay} kg MS/día</p>
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
                    <ClipboardList className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-500">Cargá tu primer lote</p>
                  <p className="text-[10px] text-gray-400 font-normal mt-1">Seleccioná la categoría y completá el formulario</p>
                </div>
              )}
            </div>

            {/* FINISH CTA */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
              <motion.button
                onClick={() => handleFinish(false)}
                disabled={submitting || data.herds.length === 0}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 disabled:opacity-30 disabled:grayscale"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando tu campo...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Finalizar y entrar al Dashboard</>}
              </motion.button>
              {data.herds.length === 0 && (
                <p className="text-center text-[9px] text-gray-400">
                  Agregá al menos 1 lote o usá <strong>"Saltar"</strong> para continuar sin hacienda
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
