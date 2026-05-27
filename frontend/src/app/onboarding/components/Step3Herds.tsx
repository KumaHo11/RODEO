'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import { finishOnboarding } from '../actions'
import {
  Plus, Trash2, ArrowLeft, ClipboardList, Scale, Leaf,
  SkipForward, AlertTriangle, X, CheckCircle2, Loader2, TrendingUp,
  ChevronDown, Calendar, Hash, Clock, Info, Activity,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SuccessModal from './SuccessModal'
import {
  CATEGORIAS_COMERCIALES, CATEGORIA_PESO_DEFAULT,
  CATEGORIA_DEMAND_FACTOR, RAZAS_POR_CATEGORIA, CATEGORIA_COLORS,
  CATEGORIA_LABEL_RAE, CATEGORIA_KEY_FROM_LABEL, CATEGORIA_REF,
  type CategoriaComercial,
} from '@/lib/categorias'
import {
  PHYSIOLOGICAL_CATEGORIES, PHYSIO_LABEL, PHYSIO_EV_BASE, GROWTH_PHYSIO_CATEGORIES,
  type PhysiologicalCategory,
} from '@/lib/grazing/evProjection'

// ── Non-bovine species (forage / EV purposes — no market valuation) ────────────
const OTHER_SPECIES = [
  { id: 'ovejas',   label: 'Oveja',   demandFactor: 0.15, defaultWeight: 45 },
  { id: 'cabras',   label: 'Cabra',   demandFactor: 0.15, defaultWeight: 40 },
  { id: 'caballos', label: 'Caballo', demandFactor: 1.27, defaultWeight: 500 },
]

const MS_PER_EV_DAY = 11

function calcEV(demandFactor: number, weight: number, count: number) {
  return parseFloat((Math.pow(weight / 400, 0.75) * demandFactor * count).toFixed(1))
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ── Standard bovine categories as RAE-labeled options ─────────────────────────
const BOVINE_OPTIONS = CATEGORIAS_COMERCIALES.map(k => ({
  key: k,
  label: CATEGORIA_LABEL_RAE[k as CategoriaComercial] ?? k,
}))

// ── Category Combobox ──────────────────────────────────────────────────────────
interface CatComboboxProps {
  value: string
  onChange: (val: string, key: string | null) => void
}

function CatCombobox({ value, onChange }: CatComboboxProps) {
  const [query, setQuery]     = useState(value)
  const [open, setOpen]       = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)

  // Sync display when value changes externally
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return BOVINE_OPTIONS
    return BOVINE_OPTIONS.filter(o => o.label.toLowerCase().startsWith(q))
  }, [query])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    // Check if it matches a known RAE label exactly
    const matched = BOVINE_OPTIONS.find(o => o.label.toLowerCase() === v.trim().toLowerCase())
    if (matched) {
      onChange(matched.label, matched.key)
    } else {
      // Custom category — no valuation key
      onChange(v, null)
    }
  }

  const selectOption = (o: { key: string; label: string }) => {
    setQuery(o.label)
    setOpen(false)
    onChange(o.label, o.key)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder="Ej: Ternero, Novillo..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 pr-8 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto"
            style={{ transformOrigin: 'top' }}
          >
            {filtered.length === 0 && (
              <li className="px-3.5 py-2.5 text-xs text-gray-400 italic">
                "{query}" — categoría personalizada (sin valuación de mercado)
              </li>
            )}
            {filtered.map(o => {
              const colors = CATEGORIA_COLORS[o.key as CategoriaComercial]
              return (
                <li
                  key={o.key}
                  onMouseDown={() => selectOption(o)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-green-50 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${colors?.dot ?? 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-800">{o.label}</span>
                </li>
              )
            })}
            {/* Custom option hint when user typed something non-standard */}
            {query.trim() && !BOVINE_OPTIONS.some(o => o.label.toLowerCase() === query.trim().toLowerCase()) && (
              <li
                onMouseDown={() => { setOpen(false); onChange(query.trim(), null) }}
                className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer border-t border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500">Usar "<strong>{query.trim()}</strong>" (sin cotización de mercado)</span>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Breed Combobox ─────────────────────────────────────────────────────────────
interface BreedComboboxProps {
  value: string
  onChange: (val: string) => void
  breeds: string[]
}

function BreedCombobox({ value, onChange, breeds }: BreedComboboxProps) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return breeds
    return breeds.filter(b => b.toLowerCase().includes(q))
  }, [value, breeds])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar o escribir raza..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 pr-8 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-44 overflow-y-auto"
            style={{ transformOrigin: 'top' }}
          >
            {filtered.map(b => (
              <li
                key={b}
                onMouseDown={() => { onChange(b); setOpen(false) }}
                className={`px-3.5 py-2 cursor-pointer text-sm transition-colors ${value === b ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {b}
              </li>
            ))}
            {value.trim() && !breeds.some(b => b.toLowerCase() === value.trim().toLowerCase()) && (
              <li
                onMouseDown={() => setOpen(false)}
                className="flex items-center gap-2 px-3.5 py-2 cursor-pointer border-t border-gray-100 hover:bg-gray-50 text-xs text-gray-500"
              >
                <Plus className="w-3 h-3 shrink-0 text-gray-400" />
                Guardar "<strong>{value.trim()}</strong>" como nueva raza
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Step3Herds() {
  const { data, updateData, prevStep } = useOnboarding()
  const { user } = useAuth()

  // ── Category state (combobox) ──────────────────────────────────────────────
  // catKey = internal key (e.g. "NOVILLOS") or null for custom
  // catLabel = display string in RAE format (e.g. "Novillo")
  const [catLabel, setCatLabel] = useState<string>(CATEGORIA_LABEL_RAE['TERNEROS'])
  const [catKey,   setCatKey]   = useState<CategoriaComercial | null>('TERNEROS')

  const [showOtherSpecies, setShowOtherSpecies] = useState(false)
  const [otherSpecies, setOtherSpecies]         = useState<string | null>(null) // null = bovine selected

  // Resolve demand factor and default weight from current selection
  const currentDemandFactor = useMemo(() => {
    if (otherSpecies) return OTHER_SPECIES.find(s => s.id === otherSpecies)?.demandFactor ?? 1.0
    if (catKey) return CATEGORIA_DEMAND_FACTOR[catKey]
    return 1.0
  }, [catKey, otherSpecies])

  const currentDefaultWeight = useMemo(() => {
    if (otherSpecies) return OTHER_SPECIES.find(s => s.id === otherSpecies)?.defaultWeight ?? 350
    if (catKey) return CATEGORIA_PESO_DEFAULT[catKey]
    return 350
  }, [catKey, otherSpecies])

  const availableBreeds = useMemo(() => {
    if (otherSpecies) return RAZAS_POR_CATEGORIA[otherSpecies] ?? ['Otra']
    if (catKey) return RAZAS_POR_CATEGORIA[catKey] ?? ['Otra']
    return ['Otra']
  }, [catKey, otherSpecies])

  // Current reference hints
  const currentRef = catKey ? CATEGORIA_REF[catKey] : undefined

  // ── Form fields ────────────────────────────────────────────────────────────
  const [name,          setName]          = useState('')
  const [breed,         setBreed]         = useState('')
  const [count,         setCount]         = useState<number | ''>('')
  const [weight,        setWeight]        = useState(currentDefaultWeight)
  const [admissionDate, setAdmissionDate] = useState(todayISO())
  const [ageValue,      setAgeValue]      = useState<number | ''>(6)
  const [ageUnit,       setAgeUnit]       = useState<'months' | 'years'>('months')

  // ── v8: Campos fisiológicos ────────────────────────────────────────────────
  const [physioCategory, setPhysioCategory] = useState<PhysiologicalCategory | ''>('')
  const [lastWeighDate,  setLastWeighDate]  = useState('')
  const [dailyGainKg,    setDailyGainKg]   = useState<number | ''>('')

  const [showSkipWarning, setShowSkipWarning] = useState(false)
  const [submitting,     setSubmitting]       = useState(false)
  const [error,          setError]            = useState<string | null>(null)
  const [showSuccess,    setShowSuccess]      = useState(false)
  const [isRedirecting,  setIsRedirecting]    = useState(false)

  // Update weight default when category changes
  useEffect(() => { setWeight(currentDefaultWeight) }, [currentDefaultWeight])

  // GDP defaults inteligentes según categoría fisiológica
  useEffect(() => {
    if (physioCategory === '') return
    if (GROWTH_PHYSIO_CATEGORIES.has(physioCategory)) {
      if (dailyGainKg === '' || dailyGainKg === 0) setDailyGainKg(0.5)
    } else if (physioCategory === 'VACA_CON_TERNERO') {
      setDailyGainKg(0)
    }
  }, [physioCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Category change handler ────────────────────────────────────────────────
  const handleCatChange = (label: string, key: string | null) => {
    setCatLabel(label)
    setCatKey(key as CategoriaComercial | null)
    setOtherSpecies(null)
    setBreed('')
  }

  const handleOtherSpecies = (id: string) => {
    setOtherSpecies(id)
    setCatKey(null)
    setCatLabel(OTHER_SPECIES.find(s => s.id === id)?.label ?? id)
    setBreed('')
  }

  // ── Computed EV ──
  // Prioridad 1: categoría fisiológica seleccionada → EV = Cabezas × EV_base
  // Prioridad 2: fallback con peso y factor de demanda comercial
  const currentEV = useMemo(() => {
    const n = Number(count) || 0
    if (n <= 0) return 0
    if (physioCategory) {
      const evBase = PHYSIO_EV_BASE[physioCategory] ?? 1.0
      return parseFloat((evBase * n).toFixed(1))
    }
    return calcEV(currentDemandFactor, weight, n)
  }, [physioCategory, count, currentDemandFactor, weight])

  const currentMsDay = useMemo(() => Math.round(currentEV * MS_PER_EV_DAY), [currentEV])

  const totalEV      = data.herds.reduce((s: number, h: any) => s + h.totalEV, 0)
  const totalAnimals = data.herds.reduce((s: number, h: any) => s + h.headCount, 0)
  const totalMsDay   = Math.round(totalEV * MS_PER_EV_DAY)

  // Age in months for storage
  const ageMonths = ageValue !== '' ? (ageUnit === 'years' ? Number(ageValue) * 12 : Number(ageValue)) : null

  const canAdd = !!(name.trim() && Number(count) > 0)

  // EV capacity vs paddocks
  const paddocksHa = data.paddocks.reduce((s: number, p: any) => s + (p.area_ha || 0), 0)
  const fieldHa    = data.fieldBoundaryHa > 0 ? data.fieldBoundaryHa : paddocksHa
  const evPerHa    = fieldHa > 0 && totalEV > 0 ? (totalEV / fieldHa).toFixed(2) : null
  const evCapColor = !evPerHa ? 'text-gray-400' : parseFloat(evPerHa) <= 0.8 ? 'text-green-600' : parseFloat(evPerHa) <= 1.2 ? 'text-amber-500' : 'text-red-500'
  const evCapLabel = !evPerHa ? '—' : parseFloat(evPerHa) <= 0.8 ? 'Normal' : parseFloat(evPerHa) <= 1.2 ? 'Carga alta' : 'Sobrepastoreo'

  // ── Add herd ───────────────────────────────────────────────────────────────
  const addHerd = () => {
    if (!canAdd) return
    const ev       = currentEV
    const species  = (otherSpecies ?? catLabel) || 'Otra'
    const categoria = catKey ?? null
    updateData({
      herds: [...data.herds, {
        name:                 name.trim(),
        species,
        categoria,
        breed:                breed.trim() || null,
        headCount:            Number(count),
        avgWeight:            weight,
        age:                  ageMonths ?? 0,
        ageMonths:            ageMonths,
        admissionDate,
        totalEV:              ev,
        physiologicalCategory: physioCategory || null,
        lastWeighDate:        lastWeighDate || null,
        dailyGainKg:          dailyGainKg !== '' ? Number(dailyGainKg) : null,
      }],
    })
    setName(''); setBreed(''); setCount(''); setWeight(currentDefaultWeight)
    setAgeValue(6); setAgeUnit('months')
    setAdmissionDate(todayISO())
    setPhysioCategory('')
    setLastWeighDate('')
    setDailyGainKg('')
  }

  const removeHerd = (i: number) => updateData({ herds: data.herds.filter((_: any, idx: number) => idx !== i) })

  // ── Finish onboarding ──────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
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

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <p className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Paso 3 de 3 · Inventario ganadero</p>
            <h2 className="text-sm font-black text-gray-900">{data.fieldName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSkipWarning(true)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <SkipForward className="w-3 h-3" /> Saltar
            </button>
            <button
              onClick={prevStep}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Atrás
            </button>
          </div>
        </div>

        {/* ─── Skip warning ─── */}
        <AnimatePresence>
          {showSkipWarning && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-black text-amber-800">¿Finalizar sin inventario?</p>
                <p className="text-[10px] text-amber-600 font-normal mt-0.5 leading-relaxed">
                  Podés cargar los rodeos después desde la sección <strong>Rodeos</strong> del Dashboard.
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleFinish(true)} disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-lg hover:bg-amber-600 transition-all disabled:opacity-50">
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
                    Finalizar igual
                  </button>
                  <button onClick={() => setShowSkipWarning(false)}
                    className="px-3 py-1.5 bg-white text-amber-600 border border-amber-200 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-all">
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

        {/* ─── Main 50/50 layout ─── */}
        <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

          {/* ═══════════════════ FORM (LEFT) ═══════════════════ */}
          <div className="flex-1 flex flex-col border-r border-gray-100 min-w-0">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-black text-gray-800">Agregar lote de animales</h3>
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">Ev y consumo calculados automáticamente</p>
            </div>

            <div className="flex-1 px-5 py-4 overflow-y-auto space-y-4 min-h-0">

              {/* ── Categoría comercial ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">
                  Categoría comercial
                </label>
                <CatCombobox value={catLabel} onChange={handleCatChange} />
                {catKey === null && catLabel.trim() && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3 shrink-0" />
                    Categoría personalizada — sin cotización del Mercado de Cañuelas
                  </p>
                )}

                {/* Otras especies */}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setShowOtherSpecies(v => !v)}
                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600"
                  >
                    {showOtherSpecies ? '▲ Ocultar otras especies' : '▼ Otras especies (ovejas, caballos...)'}
                  </button>
                  <AnimatePresence>
                    {showOtherSpecies && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap gap-1.5 mt-2 overflow-hidden">
                        {OTHER_SPECIES.map(s => (
                          <button key={s.id} type="button"
                            onClick={() => handleOtherSpecies(s.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                              otherSpecies === s.id
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

              {/* ── v8: Estado Fisiológico ── */}
              {!otherSpecies && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-teal-100 flex items-center justify-center shrink-0">
                      <Activity className="w-3 h-3 text-teal-600" />
                    </div>
                    <p className="text-[10px] font-black text-teal-700 tracking-widest uppercase">Estado Fisiológico</p>
                    <span className="text-[8px] text-teal-400 font-medium">(opcional — mejora el cálculo de EV)</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">Categoría fisiológica</label>
                    <select
                      className="w-full bg-white border border-teal-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none transition-all"
                      value={physioCategory}
                      onChange={e => setPhysioCategory(e.target.value as PhysiologicalCategory | '')}
                    >
                      <option value="">— Opcional: seleccionar estado —</option>
                      {PHYSIOLOGICAL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {PHYSIO_LABEL[cat]} · EV base {PHYSIO_EV_BASE[cat].toFixed(2)}
                        </option>
                      ))}
                    </select>
                    {physioCategory && (
                      <p className="text-[9px] text-teal-600 font-medium">
                        EV = {count || '?'} cab × {PHYSIO_EV_BASE[physioCategory]?.toFixed(2)} = <strong>{currentEV.toFixed(1)} EV</strong>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-teal-400" /> Último pesaje
                      </label>
                      <input type="date"
                        value={lastWeighDate}
                        onChange={e => setLastWeighDate(e.target.value)}
                        className="w-full bg-white border border-teal-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5 text-teal-400" /> GDP kg/día
                        {physioCategory === 'VACA_CON_TERNERO' && <span className="text-[8px] text-gray-400 font-normal">inh.</span>}
                      </label>
                      <input type="number" step="0.05" min="0" max="3"
                        value={dailyGainKg}
                        onChange={e => setDailyGainKg(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={physioCategory === 'VACA_CON_TERNERO'}
                        placeholder={physioCategory === 'VACA_CON_TERNERO' ? '0.000' : 'ej: 0.500'}
                        className={`w-full bg-white border border-teal-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none transition-all ${
                          physioCategory === 'VACA_CON_TERNERO' ? 'opacity-40 cursor-not-allowed' : ''
                        }`} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Nombre del rodeo ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">
                  Nombre del rodeo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Recría Norte, Vientres 1..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* ── Fecha de ingreso ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  Fecha de ingreso
                </label>
                <input
                  type="date"
                  value={admissionDate}
                  onChange={e => setAdmissionDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-[10px] text-gray-400 italic">
                  Fecha oficial de alta del rodeo en la plataforma
                </p>
              </div>

              {/* ── Stock + Raza ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-gray-400" />
                    Stock
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={count}
                    onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Cant. de cabezas"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase">
                    Raza
                  </label>
                  <BreedCombobox value={breed} onChange={setBreed} breeds={availableBreeds} />
                </div>
              </div>

              {/* ── Peso promedio ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1.5">
                  <Scale className="w-3 h-3 text-gray-400" />
                  Peso promedio (kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  placeholder={currentRef ? `Ej: ${currentRef.hintPeso}` : 'Ej: 300 kg'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
                {currentRef && (
                  <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    Referencia para {catLabel}: {currentRef.hintPeso}
                  </p>
                )}
              </div>

              {/* ── Edad ── */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-600 tracking-widest uppercase flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Edad
                </label>
                <div className="flex items-center gap-2">
                  {/* Unit toggle */}
                  <div className="flex shrink-0 bg-gray-100 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setAgeUnit('months')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${
                        ageUnit === 'months'
                          ? 'bg-white text-green-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Meses
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgeUnit('years')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${
                        ageUnit === 'years'
                          ? 'bg-white text-green-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Años
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step={ageUnit === 'years' ? 0.5 : 1}
                    value={ageValue}
                    onChange={e => setAgeValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={ageUnit === 'months' ? 'Ej: 8' : 'Ej: 2'}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                {currentRef && (
                  <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    Referencia para {catLabel}: {currentRef.hintEdad}
                  </p>
                )}
              </div>

              {/* ── EV preview ── */}
              {Number(count) > 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
                      <Scale className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Ev lote</p>
                          {physioCategory && (
                            <span className="text-[7px] font-black bg-teal-100 text-teal-700 px-1 rounded">
                              {PHYSIO_EV_BASE[physioCategory]?.toFixed(2)}×
                            </span>
                          )}
                        </div>
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
                  </div>
                  {physioCategory && (
                    <p className="text-[9px] text-teal-600/70 mt-1.5">
                      {PHYSIO_LABEL[physioCategory]} · EV = {count} × {PHYSIO_EV_BASE[physioCategory]?.toFixed(2)} = {currentEV} EV
                    </p>
                  )}
                </motion.div>
              )}
            </div>

            {/* Add button */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={addHerd}
                disabled={!canAdd}
                className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 bg-white px-4 py-3 rounded-xl hover:bg-green-50 active:scale-[0.98] transition-all text-sm font-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Agregar al inventario
              </button>
            </div>
          </div>

          {/* ═══════════════════ INVENTORY (RIGHT) ═══════════════════ */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                  <ClipboardList className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">Inventario</h3>
                  <p className="text-[10px] text-gray-500 font-normal">
                    {data.herds.length} lote{data.herds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {data.herds.length > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-black text-green-600 leading-none">
                    {totalEV.toFixed(1)} <span className="text-xs font-normal text-gray-500">EV</span>
                  </p>
                  <p className="text-[10px] font-bold text-emerald-600">{totalMsDay.toLocaleString()} kg MS/día</p>
                </div>
              )}
            </div>

            {/* Stats */}
            {data.herds.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-50 shrink-0 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: totalAnimals,              l: 'Cabezas' },
                    { v: totalEV.toFixed(1),        l: 'EV totales' },
                    { v: totalMsDay.toLocaleString(), l: 'kg MS/día' },
                  ].map((s, i) => (
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
                  const hMsDay   = Math.round(h.totalEV * MS_PER_EV_DAY)
                  const isBovine = CATEGORIAS_COMERCIALES.includes(h.species as CategoriaComercial) || (h.categoria && CATEGORIAS_COMERCIALES.includes(h.categoria))
                  const colorKey = h.categoria ?? h.species
                  const colors   = isBovine ? CATEGORIA_COLORS[colorKey as CategoriaComercial] : null
                  const dispLabel = h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? h.species) : h.species
                  return (
                    <motion.div key={idx}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 hover:border-green-100 transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colors ? colors.bg : 'bg-violet-50 border-violet-100'}`}>
                          <span className={`text-[10px] font-black ${colors ? colors.text : 'text-violet-700'}`}>
                            {dispLabel.slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">{h.name}</p>
                          <p className="text-[10px] text-gray-500 font-normal">
                            {h.headCount} cab. · {h.breed || 'Sin raza'} · {h.avgWeight} kg
                            {h.admissionDate && <> · <Calendar className="w-2.5 h-2.5 inline mb-0.5 ml-0.5 text-gray-400" /> {h.admissionDate}</>}
                          </p>
                          {h.physiologicalCategory && (
                            <span className="inline-flex items-center gap-1 mt-0.5 text-[8px] font-black bg-teal-50 text-teal-600 border border-teal-100 px-1.5 py-0.5 rounded-full">
                              <Activity className="w-2 h-2" />
                              {PHYSIO_LABEL[h.physiologicalCategory as PhysiologicalCategory]}
                              {h.dailyGainKg ? ` · GDP ${h.dailyGainKg} kg/d` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-500">{h.totalEV} <span className="text-[9px] font-normal text-gray-400">EV</span></p>
                          <p className="text-[10px] font-bold text-emerald-600">{hMsDay} kg MS/día</p>
                        </div>
                        <button onClick={() => removeHerd(idx)}
                          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
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

            {/* Finish CTA */}
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
