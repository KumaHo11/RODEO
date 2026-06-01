'use client'

/**
 * Step3Herds2 — Paso 3: Hacienda (v2 — Wizard radical)
 *
 * Rediseño completo vs el original:
 *  1. Selector visual de TARJETAS FISIOLÓGICAS como punto de entrada principal
 *  2. Al seleccionar una tarjeta, se infiere automáticamente la categoría comercial (EV)
 *  3. Campos de cantidad y peso COMPLETAMENTE OPCIONALES (colapsables)
 *  4. Botón "Finalizar y entrar al dashboard" SIEMPRE HABILITADO
 *  5. Botón "Completar después" como acción secundaria visible
 *  6. Se muestra el EV calculado de forma sutil al seleccionar categoría + cantidad
 */

import React, { useState, useMemo, useEffect } from 'react'
import { useOnboarding2 } from '../OnboardingContext2'
import { useAuth } from '@/components/AuthProvider'
import { finishOnboarding } from '@/app/onboarding/actions'
import {
  ArrowLeft, CheckCircle2, Loader2, Plus, Trash2,
  ChevronDown, ChevronRight, Info, Scale, Activity,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SuccessModal from '@/app/onboarding/components/SuccessModal'
import {
  CATEGORIA_LABEL_RAE, CATEGORIA_COLORS, CATEGORIA_DEMAND_FACTOR, CATEGORIA_PESO_DEFAULT,
  type CategoriaComercial,
} from '@/lib/categorias'
import {
  PHYSIOLOGICAL_CATEGORIES, PHYSIO_LABEL, PHYSIO_EV_BASE,
  type PhysiologicalCategory,
} from '@/lib/grazing/evProjection'

// ── Mapa fisiológico → categoría comercial inferida ────────────────────────────
// Usada para mostrar el hint debajo de cada tarjeta
const PHYSIO_TO_COMERCIAL: Partial<Record<PhysiologicalCategory, CategoriaComercial>> = {
  VACA_CON_TERNERO:  'VACAS',
  VACA_PRENADA:      'VACAS',
  VACA_VACIA:        'VACAS',
  VACA_SECA:         'VACAS',
  TERNERO:           'TERNEROS',
  RECRIA_NOVILLO:    'NOVILLOS',
  RECRIA_VAQUILLONA: 'VAQUILLONAS',
  TORO_DESCANSO:     'TOROS',
  TORO_SERVICIO:     'TOROS',
}

// ── Orden y configuración visual de las tarjetas ───────────────────────────────
interface PhysioCard {
  physio: PhysiologicalCategory
  emoji: string
  description: string
  isPrimary: boolean // se muestra siempre; las secundarias requieren expandir
}

const PHYSIO_CARDS: PhysioCard[] = [
  {
    physio: 'VACA_CON_TERNERO',
    emoji: '🐄',
    description: 'En lactancia activa, cría al pie',
    isPrimary: true,
  },
  {
    physio: 'VACA_PRENADA',
    emoji: '🤰',
    description: 'En gestación avanzada (8.° mes)',
    isPrimary: true,
  },
  {
    physio: 'VACA_VACIA',
    emoji: '🐮',
    description: 'Vaca seca o sin preñar',
    isPrimary: true,
  },
  {
    physio: 'TERNERO',
    emoji: '🐃',
    description: 'Ternero/a en destete o pre-destete',
    isPrimary: true,
  },
  {
    physio: 'RECRIA_NOVILLO',
    emoji: '🐂',
    description: 'Macho en recría, novillo en engorde',
    isPrimary: true,
  },
  {
    physio: 'RECRIA_VAQUILLONA',
    emoji: '🐄',
    description: 'Hembra joven en recría',
    isPrimary: false,
  },
  {
    physio: 'TORO_DESCANSO',
    emoji: '🐃',
    description: 'Toro fuera de temporada de servicio',
    isPrimary: false,
  },
  {
    physio: 'TORO_SERVICIO',
    emoji: '🐂',
    description: 'Toro activo en temporada de monta',
    isPrimary: false,
  },
  {
    physio: 'VACA_SECA',
    emoji: '🐮',
    description: 'Vaca en período seco (sin lactancia)',
    isPrimary: false,
  },
]

const MS_PER_EV_DAY = 11

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ── Componente de tarjeta fisiológica ─────────────────────────────────────────
interface PhysioCardProps {
  card: PhysioCard
  selected: boolean
  onClick: () => void
}

function PhysioCardTile({ card, selected, onClick }: PhysioCardProps) {
  const comercial = PHYSIO_TO_COMERCIAL[card.physio]
  const colors    = comercial ? CATEGORIA_COLORS[comercial] : null
  const evBase    = PHYSIO_EV_BASE[card.physio]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
        selected
          ? 'border-green-500 bg-green-50 shadow-md shadow-green-600/10'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" role="img" aria-label={PHYSIO_LABEL[card.physio]}>
          {card.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-black leading-tight ${selected ? 'text-green-800' : 'text-gray-800'}`}>
              {PHYSIO_LABEL[card.physio]}
            </p>
            {selected && (
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            )}
          </div>
          <p className={`text-[10px] font-normal mt-0.5 leading-relaxed ${selected ? 'text-green-600' : 'text-gray-400'}`}>
            {card.description}
          </p>
          {selected && comercial && (
            <p className="text-[10px] font-black text-green-700 mt-1.5">
              EV base: {evBase.toFixed(2)} · Categoría: {CATEGORIA_LABEL_RAE[comercial]}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Step3Herds2() {
  const { data, updateData, prevStep } = useOnboarding2()
  const { user } = useAuth()

  // Tarjeta seleccionada
  const [selectedPhysio, setSelectedPhysio] = useState<PhysiologicalCategory | null>(null)
  const [showAllCards, setShowAllCards]       = useState(false)

  // Campos opcionales (colapsados por defecto)
  const [showOptional, setShowOptional] = useState(false)
  const [count, setCount]               = useState<number | ''>('')
  const [weight, setWeight]             = useState(350)
  const [herdName, setHerdName]         = useState('')
  const [admissionDate, setAdmissionDate] = useState(todayISO())

  // Estado de envío
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Inferir peso por defecto al seleccionar categoría
  useEffect(() => {
    if (!selectedPhysio) return
    const comercial = PHYSIO_TO_COMERCIAL[selectedPhysio]
    if (comercial) setWeight(CATEGORIA_PESO_DEFAULT[comercial] ?? 350)
  }, [selectedPhysio])

  // EV calculado para el lote actual
  const currentEV = useMemo(() => {
    if (!selectedPhysio || !count || Number(count) <= 0) return 0
    return parseFloat((PHYSIO_EV_BASE[selectedPhysio] * Number(count)).toFixed(1))
  }, [selectedPhysio, count])

  const currentMsDay = Math.round(currentEV * MS_PER_EV_DAY)

  // Totales del inventario
  const totalEV      = data.herds.reduce((s: number, h: any) => s + h.totalEV, 0)
  const totalAnimals = data.herds.reduce((s: number, h: any) => s + h.headCount, 0)
  const totalMsDay   = Math.round(totalEV * MS_PER_EV_DAY)

  // Tarjetas a mostrar
  const visibleCards = PHYSIO_CARDS.filter(c => showAllCards || c.isPrimary)
  const hiddenCount  = PHYSIO_CARDS.filter(c => !c.isPrimary).length

  // ── Agregar lote ──────────────────────────────────────────────────────────
  const canAdd = !!selectedPhysio && Number(count) > 0

  const addHerd = () => {
    if (!selectedPhysio) return
    const comercial = PHYSIO_TO_COMERCIAL[selectedPhysio] ?? null
    const headCount = Number(count) || 1
    const ev = selectedPhysio
      ? parseFloat((PHYSIO_EV_BASE[selectedPhysio] * headCount).toFixed(1))
      : 0

    const name = herdName.trim()
      || `${PHYSIO_LABEL[selectedPhysio]} ${data.herds.length + 1}`

    updateData({
      herds: [...data.herds, {
        name,
        species: comercial ? CATEGORIA_LABEL_RAE[comercial] : PHYSIO_LABEL[selectedPhysio],
        categoria: comercial,
        breed: null,
        headCount,
        avgWeight: weight,
        age: 0,
        admissionDate,
        totalEV: ev,
        physiologicalCategory: selectedPhysio,
        lastWeighDate: null,
        dailyGainKg: null,
      }],
    })

    // Reset form
    setSelectedPhysio(null)
    setCount('')
    setHerdName('')
    setShowOptional(false)
  }

  const removeHerd = (i: number) =>
    updateData({ herds: data.herds.filter((_: any, idx: number) => idx !== i) })

  // ── Finalizar onboarding ──────────────────────────────────────────────────
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
      setError('Error al guardar: ' + (err.message || 'Intentá de nuevo'))
    } finally {
      setSubmitting(false)
    }
  }

  const paddocksHa = data.paddocks.reduce((s: number, p: any) => s + (p.area_ha || 0), 0)
  const fieldHa    = data.fieldBoundaryHa > 0 ? data.fieldBoundaryHa : paddocksHa

  return (
    <>
      <SuccessModal
        isOpen={showSuccess}
        fieldName={data.fieldName}
        totalHa={data.fieldBoundaryHa || paddocksHa}
        totalAnimals={totalAnimals}
        totalEV={totalEV}
        paddocksCount={data.paddocks.length}
        isRedirecting={isRedirecting}
      />

      <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                Paso 3 de 3 · Hacienda
              </p>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                {data.fieldName || 'Tu campo'}
              </h2>
            </div>
            <button
              onClick={prevStep}
              className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Volver
            </button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl shrink-0">
            <p className="text-xs font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* ── Cuerpo (dos columnas) ─────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ══════════════ FORM (izquierda) ══════════════ */}
          <div className="w-[52%] flex flex-col border-r border-gray-100 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-gray-50 shrink-0">
              <h3 className="text-sm font-black text-gray-800">Agregar lote de hacienda</h3>
              <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                Seleccioná la categoría principal del rodeo
              </p>
            </div>

            <div className="flex-1 px-5 py-4 overflow-y-auto space-y-4 min-h-0">

              {/* ── Tarjetas fisiológicas ─────────────────────────────── */}
              <div className="space-y-2">
                {visibleCards.map(card => (
                  <PhysioCardTile
                    key={card.physio}
                    card={card}
                    selected={selectedPhysio === card.physio}
                    onClick={() => setSelectedPhysio(
                      selectedPhysio === card.physio ? null : card.physio
                    )}
                  />
                ))}

                {/* Mostrar más / menos categorías */}
                <button
                  type="button"
                  onClick={() => setShowAllCards(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showAllCards ? (
                    <><ChevronDown className="w-3 h-3 rotate-180" /> Mostrar menos categorías</>
                  ) : (
                    <><Plus className="w-3 h-3" /> Ver {hiddenCount} categorías más</>
                  )}
                </button>
              </div>

              {/* ── Campos opcionales (se despliegan al seleccionar una tarjeta) */}
              <AnimatePresence>
                {selectedPhysio && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                      {/* Cantidad (campo principal dentro de los opcionales) */}
                      <div className="p-4 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase">
                            Cantidad de cabezas
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={count}
                            onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ej: 50"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          />
                        </div>

                        {/* EV preview inline */}
                        {Number(count) > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl"
                          >
                            <Activity className="w-4 h-4 text-green-600 shrink-0" />
                            <div>
                              <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                                EV estimado
                              </p>
                              <p className="text-base font-black text-green-700 leading-none">
                                {currentEV} <span className="text-[10px] font-normal text-green-500">EV · {currentMsDay} kg MS/día</span>
                              </p>
                            </div>
                          </motion.div>
                        )}

                        {/* Campos adicionales colapsables */}
                        <button
                          type="button"
                          onClick={() => setShowOptional(v => !v)}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showOptional
                            ? <><ChevronDown className="w-3 h-3" /> Ocultar datos adicionales</>
                            : <><ChevronRight className="w-3 h-3" /> Peso promedio y otros datos (opcional)</>
                          }
                        </button>

                        <AnimatePresence>
                          {showOptional && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3 overflow-hidden"
                            >
                              {/* Nombre del lote */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase">
                                  Nombre del lote <span className="font-normal normal-case text-gray-300">(opcional)</span>
                                </label>
                                <input
                                  type="text"
                                  value={herdName}
                                  onChange={e => setHerdName(e.target.value)}
                                  placeholder={`Ej: ${PHYSIO_LABEL[selectedPhysio]} Norte`}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                />
                              </div>

                              {/* Peso */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase flex items-center gap-1.5">
                                  <Scale className="w-3 h-3 text-gray-400" />
                                  Peso promedio (kg) <span className="font-normal normal-case text-gray-300">(opcional)</span>
                                </label>
                                <input
                                  type="number"
                                  min="10"
                                  value={weight}
                                  onChange={e => setWeight(Number(e.target.value))}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                />
                              </div>

                              {/* Fecha de ingreso */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase">
                                  Fecha de ingreso <span className="font-normal normal-case text-gray-300">(opcional)</span>
                                </label>
                                <input
                                  type="date"
                                  value={admissionDate}
                                  onChange={e => setAdmissionDate(e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Botón agregar */}
                      <div className="px-4 pb-4">
                        <button
                          type="button"
                          onClick={addHerd}
                          disabled={!canAdd}
                          className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 bg-white px-4 py-3 rounded-xl hover:bg-green-50 active:scale-[0.98] transition-all text-sm font-black disabled:opacity-30 disabled:cursor-not-allowed group"
                        >
                          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                          Agregar al inventario
                        </button>
                        {!count && selectedPhysio && (
                          <p className="text-center text-[10px] text-gray-400 font-normal mt-1.5">
                            Ingresá la cantidad de cabezas para agregar el lote
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hint cuando no se seleccionó nada */}
              {!selectedPhysio && (
                <div className="flex items-center gap-2 px-1">
                  <Info className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <p className="text-[10px] text-gray-400 font-normal leading-relaxed">
                    Podés agregar tantos lotes como necesités. También podés cargar el inventario completo después desde el dashboard.
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* ══════════════ INVENTARIO (derecha) ══════════════ */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-gray-50 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-800">Inventario</h3>
                <p className="text-[10px] text-gray-400 font-normal">
                  {data.herds.length} lote{data.herds.length !== 1 ? 's' : ''} agregado{data.herds.length !== 1 ? 's' : ''}
                </p>
              </div>
              {data.herds.length > 0 && (
                <div className="text-right">
                  <p className="text-xl font-black text-green-600 leading-none">
                    {totalEV.toFixed(1)} <span className="text-xs font-normal text-gray-400">EV</span>
                  </p>
                  <p className="text-[10px] font-bold text-emerald-600">{totalMsDay.toLocaleString()} kg MS/día</p>
                </div>
              )}
            </div>

            {/* Stats summary */}
            {data.herds.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-50 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: totalAnimals, l: 'Cabezas' },
                    { v: totalEV.toFixed(1), l: 'EV totales' },
                  ].map((s, i) => (
                    <div key={i} className="text-center bg-gray-50 rounded-xl py-2">
                      <p className={`text-lg font-black ${i === 1 ? 'text-green-600' : 'text-gray-800'}`}>{s.v}</p>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de lotes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
              <AnimatePresence>
                {data.herds.map((h: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:border-green-100 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                        <span className="text-sm">
                          {PHYSIO_CARDS.find(c => c.physio === h.physiologicalCategory)?.emoji ?? '🐄'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">{h.name}</p>
                        <p className="text-[10px] text-gray-500 font-normal">
                          {h.headCount} cab. · {h.avgWeight} kg
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-orange-500">
                          {h.totalEV} <span className="text-[10px] font-normal text-gray-400">EV</span>
                        </p>
                      </div>
                      <button
                        onClick={() => removeHerd(idx)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Estado vacío */}
              {data.herds.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <span className="text-2xl">🐄</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-400">Sin hacienda por ahora</p>
                    <p className="text-[10px] text-gray-300 font-normal mt-0.5">
                      Seleccioná una categoría para agregar tu primer lote
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── CTAs finales ─────────────────────────────────────────── */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
              <motion.button
                onClick={() => handleFinish(data.herds.length === 0)}
                disabled={submitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando tu campo...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Finalizar y entrar al dashboard</>
                }
              </motion.button>

              {data.herds.length === 0 && (
                <p className="text-center text-[10px] text-gray-400 font-normal">
                  Podés completar el inventario de hacienda después desde el dashboard.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
