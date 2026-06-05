'use client'

/**
 * WeaningWizard — Wizard asistido de 2 pasos para el evento de Destete
 * ─────────────────────────────────────────────────────────────────────
 * Paso 1 — Madres:
 *   Muta la categoría fisiológica del rodeo de VACA_CON_TERNERO → VACA_VACIA.
 *   Permite editar el peso post-destete de la vaca.
 *
 * Paso 2 — Crías:
 *   Define el destino de los terneros:
 *   A) Transferir a rodeo existente de recría
 *   B) Crear un nuevo rodeo de terneros en el acto
 *
 * Al confirmar automatiza:
 *  1. PATCH rodeo madre: categoría fisiológica + peso post-destete + EV nuevo
 *  2. POST o PATCH del rodeo destino de las crías
 *  3. POST /api/farm-events con el evento destete documentado
 */

import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronRight, ChevronLeft, Check, Loader2,
  Baby, AlertTriangle, ArrowRight, Plus,
} from 'lucide-react'
import { IconoRodeos } from '@/components/icons/IconoRodeos'
import { apiFetch } from '@/lib/apiFetch'
import { todayISO } from '@/lib/utils/dates'
import {
  calculateProjectedEV,
  PHYSIO_LABEL,
  PHYSIO_EV_BASE,
  type PhysiologicalCategory,
} from '@/lib/grazing/evProjection'
import { toast } from 'sonner'
import type { HerdData } from '@/components/HerdModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WeaningWizardProps {
  herd: HerdData                   // Rodeo madre (debe ser VACA_CON_TERNERO o VACAS)
  allHerds: HerdData[]             // Todos los rodeos para buscar destino existente
  weanedCount: number              // Cabezas a destetar
  weanDate: string                 // Fecha del evento
  notes?: string
  onClose: () => void
  onCompleted: () => void          // Callback cuando todo se guardó OK
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LABEL = 'text-[10px] font-black text-gray-700 tracking-widest uppercase mb-1 block'
const INPUT  = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all'

const EV_VACA_CON_TERNERO = PHYSIO_EV_BASE['VACA_CON_TERNERO'] // 1.35
const EV_VACA_VACIA       = PHYSIO_EV_BASE['VACA_VACIA']       // 0.80
const EV_TERNERO          = PHYSIO_EV_BASE['TERNERO']           // 0.45

// ── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {[1, 2].map((s) => (
        <React.Fragment key={s}>
          <div className={`flex items-center gap-2 ${s <= step ? 'opacity-100' : 'opacity-40'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all
              ${s < step ? 'bg-teal-500 text-white' : s === step ? 'bg-teal-600 text-white ring-4 ring-teal-100' : 'bg-gray-200 text-gray-500'}`}>
              {s < step ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            <span className={`text-xs font-bold hidden sm:block ${s === step ? 'text-teal-700' : 'text-gray-400'}`}>
              {s === 1 ? 'Madres' : 'Crías'}
            </span>
          </div>
          {s < 2 && (
            <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s ? 'bg-teal-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── EV Impact Badge ────────────────────────────────────────────────────────────

function EvImpactBadge({ label, before, after }: { label: string; before: number; after: number }) {
  const diff = parseFloat((after - before).toFixed(1))
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-1">{label}</p>
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-black text-gray-600">{before.toFixed(0)} EV</span>
        <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
        <span className={`text-sm font-black ${diff < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {after.toFixed(0)} EV
        </span>
      </div>
      <p className={`text-[9px] font-bold mt-1 ${diff < 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
        {diff > 0 ? '+' : ''}{diff} EV
      </p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WeaningWizard({
  herd,
  allHerds,
  weanedCount,
  weanDate,
  notes,
  onClose,
  onCompleted,
}: WeaningWizardProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)

  // ── Step 1: Madres ──────────────────────────────────────────────────────────
  const [motherWeightPost, setMotherWeightPost] = useState<number | ''>(
    herd.avg_weight_kg ? Math.round(Number(herd.avg_weight_kg) - 30) : ''
  )

  // ── Step 2: Crías ───────────────────────────────────────────────────────────
  const [calfCount,     setCalfCount]     = useState<number | ''>(weanedCount)
  const [calfWeight,    setCalfWeight]    = useState<number | ''>(170)   // kg al destete
  const [calfGdp,       setCalfGdp]       = useState<number | ''>(0.5)   // GDP estimada
  const [destination,   setDestination]   = useState<'existing' | 'new'>('new')
  const [targetHerdId,  setTargetHerdId]  = useState('')
  const [newHerdName,   setNewHerdName]   = useState(`Terneros · ${herd.name}`)
  const [newHerdBreed,  setNewHerdBreed]  = useState(herd.breed ?? '')

  // Rodeos existentes aptos para recibir terneros
  const reciaMatureHerds = useMemo(() =>
    allHerds.filter(h =>
      h.id !== herd.id &&
      (h.physiological_category === 'TERNERO' || h.physiological_category === 'RECRIA_NOVILLO' ||
       h.categoria === 'TERNEROS' || h.categoria === 'TERNERAS' || h.categoria === 'NOVILLITOS')
    ),
    [allHerds, herd.id]
  )

  // ── Live EV calculations ────────────────────────────────────────────────────

  const currentMothersEV = useMemo(() =>
    calculateProjectedEV('VACA_CON_TERNERO', Number(herd.avg_weight_kg || 420), herd.head_count),
    [herd]
  )

  const newMothersEV = useMemo(() => {
    const w = motherWeightPost !== '' ? Number(motherWeightPost) : Number(herd.avg_weight_kg || 390)
    return calculateProjectedEV('VACA_VACIA', w, herd.head_count)
  }, [motherWeightPost, herd])

  const calvesEV = useMemo(() => {
    const w = calfWeight !== '' ? Number(calfWeight) : 170
    const n = calfCount  !== '' ? Number(calfCount)  : weanedCount
    return calculateProjectedEV('TERNERO', w, n)
  }, [calfWeight, calfCount, weanedCount])

  // ── Validation ──────────────────────────────────────────────────────────────

  const step1Valid = motherWeightPost !== '' && Number(motherWeightPost) > 0
  const step2Valid = calfCount !== '' && Number(calfCount) > 0 &&
    calfWeight !== '' && Number(calfWeight) > 0 &&
    calfGdp !== '' && Number(calfGdp) > 0 &&
    (destination === 'new' ? !!newHerdName.trim() : !!targetHerdId)

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!step2Valid) return
    setSaving(true)

    try {
      const n       = Number(calfCount)
      const cWeight = Number(calfWeight)
      const cGdp    = Number(calfGdp)
      const mWeight = Number(motherWeightPost)
      const today   = todayISO()

      // ── 1. PATCH rodeo madre ───────────────────────────────────────────────
      await apiFetch(`/api/herds/${herd.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          physiological_category: 'VACA_VACIA',
          avg_weight_kg: mWeight,
          total_ev: newMothersEV,
          last_weigh_date: weanDate || today,
        }),
      })

      // ── 2. Crías — Opción A: transferir a rodeo existente ─────────────────
      if (destination === 'existing' && targetHerdId) {
        const targetHerd = allHerds.find(h => h.id === targetHerdId)
        if (targetHerd) {
          const existingCount  = targetHerd.head_count || 0
          const existingWeight = Number(targetHerd.avg_weight_kg || cWeight)
          const newCount       = existingCount + n
          const newWeight      = Math.round((existingCount * existingWeight + n * cWeight) / newCount)
          const newEV          = calculateProjectedEV(
            targetHerd.physiological_category ?? 'TERNERO', newWeight, newCount
          )
          await apiFetch(`/api/herds/${targetHerdId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              head_count: newCount,
              avg_weight_kg: newWeight,
              total_ev: newEV,
              daily_gain_kg: cGdp,
              last_weigh_date: weanDate || today,
            }),
          })
        }
      }

      // ── 2. Crías — Opción B: crear nuevo rodeo ────────────────────────────
      if (destination === 'new') {
        await apiFetch('/api/herds', {
          method: 'POST',
          body: JSON.stringify({
            name:                   newHerdName.trim(),
            species:                'terneros',
            categoria:              'TERNEROS',
            physiological_category: 'TERNERO',
            breed:                  newHerdBreed.trim() || herd.breed || null,
            head_count:             n,
            avg_weight_kg:          cWeight,
            total_ev:               calvesEV,
            daily_gain_kg:          cGdp,
            last_weigh_date:        weanDate || today,
            parent_herd_id:         herd.id,
            admission_date:         weanDate || today,
          }),
        })
      }

      // ── 3. POST evento destete documentado ───────────────────────────────
      const evBefore = currentMothersEV.toFixed(1)
      const evAfter  = (newMothersEV + calvesEV).toFixed(1)
      const description = [
        `Destete de ${n} terneros. Peso al destete: ${cWeight} kg/cab (EV ~${EV_TERNERO.toFixed(2)}/cab).`,
        `Madres → Vaca Vacía/Seca. EV base baja de ~${EV_VACA_CON_TERNERO} → ${EV_VACA_VACIA} por madre.`,
        `Peso post-destete madres: ${mWeight} kg.`,
        `EV rodeo madre: ${evBefore} → ${newMothersEV.toFixed(1)} EV.`,
        `GDP estimada crías: ${cGdp} kg/día.`,
        destination === 'new'
          ? `Nuevo rodeo creado: "${newHerdName.trim()}" (${n} cab · ${cWeight} kg · EV: ${calvesEV.toFixed(1)}).`
          : `Transferido a rodeo existente (${n} cab).`,
        notes ? `Notas: ${notes}` : '',
      ].filter(Boolean).join(' ')

      await apiFetch('/api/farm-events', {
        method: 'POST',
        body: JSON.stringify({
          title: `Destete: ${n} terneros · ${herd.name}`,
          event_type: 'destete',
          event_date: weanDate || today,
          herd_id: herd.id,
          herd_ids: [herd.id],
          description,
          status: 'completado',
          impacts: {
            ev_before: evBefore,
            ev_after: evAfter,
            calves_count: n,
            calves_weight_kg: cWeight,
            mother_weight_post: mWeight,
            destination,
          },
        }),
      })

      toast.success(`Destete completado · ${n} terneros segregados · EV madres actualizado`)
      onCompleted()
    } catch (err: any) {
      toast.error('Error al guardar el destete: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 pt-5 pb-4 rounded-t-2xl z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <Baby className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900">Destete Asistido</h2>
                  <p className="text-[10px] text-gray-400 font-medium">{herd.name}</p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <StepIndicator step={step} />
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          <AnimatePresence mode="wait">
            {/* ════ PASO 1: MADRES ════ */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Alerta de impacto */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-bold mb-1">Cambio de categoría fisiológica</p>
                      <p>Las <strong>{herd.head_count} vacas</strong> de «<em>{herd.name}</em>» cambiarán de
                        {' '}<strong>Vaca con Ternero al Pie</strong> → <strong>Vaca Vacía / Seca</strong>.
                      </p>
                      <p className="mt-1">
                        El EV base por vaca bajará de <strong>~{EV_VACA_CON_TERNERO}</strong> → <strong>{EV_VACA_VACIA}</strong>
                        {' '}(~{Math.round((1 - EV_VACA_VACIA / EV_VACA_CON_TERNERO) * 100)}% menos carga).
                      </p>
                    </div>
                  </div>
                </div>

                {/* EV Impact visual */}
                <EvImpactBadge
                  label="EV del rodeo madre"
                  before={currentMothersEV}
                  after={newMothersEV}
                />

                {/* Peso post-destete */}
                <div>
                  <label className={LABEL}>Peso promedio post-destete (kg)</label>
                  <input
                    type="number"
                    className={INPUT}
                    value={motherWeightPost}
                    onChange={e => setMotherWeightPost(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="ej: 390 kg"
                    min={100}
                    max={700}
                    step={5}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Peso anterior: {herd.avg_weight_kg ? `${Math.round(Number(herd.avg_weight_kg))} kg` : '—'}.
                    Las vacas suelen perder 20–40 kg al destete.
                  </p>
                </div>

                {/* GDP para madres (opcional) */}
                <div>
                  <label className={LABEL}>
                    GDP madres post-destete (kg/día) —{' '}
                    <span className="text-gray-400 normal-case font-medium">opcional</span>
                  </label>
                  <input
                    type="number"
                    className={INPUT}
                    placeholder="ej: 0.200 (recuperación corporal)"
                    min={0}
                    max={2}
                    step={0.05}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Si el campo queda vacío no se proyecta variación de peso en madres.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ════ PASO 2: CRÍAS ════ */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Terneros resumen */}
                <div className="bg-lime-50 border border-lime-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Baby className="w-4 h-4 text-lime-600" />
                    <p className="text-xs font-black text-lime-800">Datos de los terneros al destete</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Cabezas a destetar</label>
                      <input
                        type="number"
                        className={INPUT}
                        value={calfCount}
                        onChange={e => setCalfCount(e.target.value === '' ? '' : Number(e.target.value))}
                        min={1}
                        max={herd.head_count}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>
                        Peso al destete (kg)
                        <span className="ml-1 font-medium text-gray-400">160–180 kg</span>
                      </label>
                      <input
                        type="number"
                        className={INPUT}
                        value={calfWeight}
                        onChange={e => setCalfWeight(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="ej: 170"
                        min={80}
                        max={280}
                        step={5}
                      />
                    </div>
                  </div>
                  {calfWeight !== '' && calfCount !== '' && (
                    <div className="mt-2 flex gap-3 text-[10px] text-lime-700">
                      <span>EV estimado: <strong>{calvesEV.toFixed(1)}</strong> EV total</span>
                      <span>·</span>
                      <span>~<strong>{(calvesEV * 11).toFixed(0)}</strong> kg MS/día</span>
                    </div>
                  )}
                </div>

                {/* GDP crías */}
                <div>
                  <label className={LABEL}>GDP estimada para la nueva etapa (kg/día)</label>
                  <input
                    type="number"
                    className={INPUT}
                    value={calfGdp}
                    onChange={e => setCalfGdp(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="ej: 0.500"
                    min={0.05}
                    max={2}
                    step={0.05}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Rango típico post-destete: 0.400 – 0.600 kg/día.
                  </p>
                </div>

                {/* Destino de las crías */}
                <div>
                  <label className={LABEL}>Destino de las crías</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDestination('existing')}
                      className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-xs font-bold transition-all text-left
                        ${destination === 'existing'
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                    >
                      <IconoRodeos className="w-4 h-4 shrink-0" />
                      <div>
                        <p>Rodeo existente</p>
                        <p className="font-medium text-[10px] opacity-70">Transferir a recría</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setDestination('new')}
                      className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-xs font-bold transition-all text-left
                        ${destination === 'new'
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <div>
                        <p>Nuevo rodeo</p>
                        <p className="font-medium text-[10px] opacity-70">Crear en el acto</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Opción A: Rodeo existente */}
                {destination === 'existing' && (
                  <div>
                    <label className={LABEL}>Seleccionar rodeo destino</label>
                    {reciaMatureHerds.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-400">No hay rodeos de recría disponibles.</p>
                        <button
                          onClick={() => setDestination('new')}
                          className="mt-2 text-xs font-bold text-teal-600 hover:underline"
                        >
                          Crear un nuevo rodeo →
                        </button>
                      </div>
                    ) : (
                      <select
                        className={INPUT}
                        value={targetHerdId}
                        onChange={e => setTargetHerdId(e.target.value)}
                      >
                        <option value="">— Seleccioná un rodeo —</option>
                        {reciaMatureHerds.map(h => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.head_count} cab · {h.avg_weight_kg ? `${Math.round(Number(h.avg_weight_kg))} kg` : '—'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Opción B: Nuevo rodeo */}
                {destination === 'new' && (
                  <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Datos del nuevo rodeo</p>
                    <div>
                      <label className={LABEL}>Nombre del rodeo</label>
                      <input
                        type="text"
                        className={INPUT}
                        value={newHerdName}
                        onChange={e => setNewHerdName(e.target.value)}
                        placeholder="ej: Terneros 2025"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Raza (opcional)</label>
                      <input
                        type="text"
                        className={INPUT}
                        value={newHerdBreed}
                        onChange={e => setNewHerdBreed(e.target.value)}
                        placeholder={herd.breed ?? 'Angus, Hereford…'}
                      />
                    </div>
                  </div>
                )}

                {/* Resumen final */}
                <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-100 space-y-2">
                  <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Resumen del destete</p>
                  <div className="grid grid-cols-2 gap-2">
                    <EvImpactBadge
                      label="EV madres"
                      before={currentMothersEV}
                      after={newMothersEV}
                    />
                    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-1">Nuevas crías</p>
                      <p className="text-sm font-black text-lime-600">{calvesEV.toFixed(1)} EV</p>
                      <p className="text-[9px] font-bold text-gray-400 mt-1">
                        {calfCount} cab · {calfWeight} kg
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-6 py-4 rounded-b-2xl flex items-center justify-between gap-3">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-teal-200"
            >
              Siguiente: Crías
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!step2Valid || saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-teal-200"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              ) : (
                <><Check className="w-4 h-4" /> Confirmar destete</>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>{content}</AnimatePresence>,
    document.body
  )
}
