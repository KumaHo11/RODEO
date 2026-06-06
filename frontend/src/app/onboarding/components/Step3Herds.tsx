'use client'

/**
 * Step3Herds — Paso 3: Inventario Ganadero (Onboarding)
 *
 * Rediseño unificado v2:
 *  - Usa HerdFormFields (componente único de alta de rodeos)
 *  - EV calculado via tablas Cocimano (calcularEVRodeo) con peso real
 *  - Categoría fisiológica como campo primario (sin CATEGORIA_DEMAND_FACTOR)
 *  - Categoría comercial derivada automáticamente con physioToComercial()
 *  - Sin emojis — diseño limpio y profesional
 */

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import { finishOnboarding } from '../actions'
import {
  Plus, Trash2, ArrowLeft, ClipboardList,
  CheckCircle2, Loader2, TrendingUp, Scale, Leaf,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SuccessModal from './SuccessModal'
import HerdFormFields, { type HerdFormValue, calcHerdEV } from '@/components/HerdFormFields'
import {
  physioToComercial,
  PHYSIO_LABEL,
  PHYSIO_PESO_DEFAULT,
} from '@/lib/grazing/evProjection'
import { CATEGORIA_COLORS, CATEGORIA_LABEL_RAE, type CategoriaComercial } from '@/lib/categorias'
import OnboardingTour from '@/components/OnboardingTour'
import { Step } from 'react-joyride'

const MS_PER_EV = 12  // kg MS/EV/día — ración base unificada

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

const EMPTY_FORM: HerdFormValue = {
  name: '',
  physioCategory: '',
  weightKg: '',
  count: '',
  breed: '',
  ageMonths: '',
}

export default function Step3Herds() {
  const { data, updateData, prevStep, setIsCompleting } = useOnboarding()
  const { user } = useAuth()

  const [form, setForm] = useState<HerdFormValue>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // ── Totales del inventario ────────────────────────────────────────────────
  const totalEV      = data.herds.reduce((s: number, h: any) => s + (h.totalEV || 0), 0)
  const totalAnimals = data.herds.reduce((s: number, h: any) => s + (h.headCount || 0), 0)
  const totalMsDay   = Math.round(totalEV * MS_PER_EV)

  const paddocksHa = data.paddocks.reduce((s: number, p: any) => s + (p.area_ha || 0), 0)
  const fieldHa    = data.fieldBoundaryHa > 0 ? data.fieldBoundaryHa : paddocksHa
  const evPerHa    = fieldHa > 0 && totalEV > 0 ? (totalEV / fieldHa).toFixed(2) : null
  const evCapColor = !evPerHa ? 'text-gray-400' : parseFloat(evPerHa) <= 0.8 ? 'text-green-600' : parseFloat(evPerHa) <= 1.2 ? 'text-amber-500' : 'text-red-500'
  const evCapLabel = !evPerHa ? '—' : parseFloat(evPerHa) <= 0.8 ? 'Normal' : parseFloat(evPerHa) <= 1.2 ? 'Carga alta' : 'Sobrepastoreo'

  // ── Validación: puede agregar si tiene categoría + cantidad ───────────────
  const canAdd = !!form.physioCategory && Number(form.count) > 0

  // ── Agregar lote al inventario ────────────────────────────────────────────
  const addHerd = () => {
    if (!canAdd || !form.physioCategory) return
    const comercial = physioToComercial(form.physioCategory)
    const ev = calcHerdEV(form.physioCategory, form.weightKg, form.count)
    const weight = Number(form.weightKg) || PHYSIO_PESO_DEFAULT[form.physioCategory] || 400
    const name = form.name.trim() || `${PHYSIO_LABEL[form.physioCategory]} ${data.herds.length + 1}`

    updateData({
      herds: [...data.herds, {
        name,
        species:              CATEGORIA_LABEL_RAE[comercial as CategoriaComercial] ?? comercial,
        categoria:            comercial,
        breed:                form.breed || null,
        headCount:            Number(form.count),
        avgWeight:            weight,
        age:                  Number(form.ageMonths) || 0,
        ageMonths:            Number(form.ageMonths) || null,
        admissionDate:        todayISO(),
        totalEV:              ev,
        physiologicalCategory: form.physioCategory,
        lastWeighDate:        null,
        dailyGainKg:          null,
      }],
    })
    setForm(EMPTY_FORM)
  }

  const removeHerd = (i: number) =>
    updateData({ herds: data.herds.filter((_: any, idx: number) => idx !== i) })

  // ── Finalizar onboarding ──────────────────────────────────────────────────
  const handleFinish = async (skipHerds = false) => {
    if (!user) return
    setSubmitting(true)
    setError(null)
    if (skipHerds) {
      updateData({ skippedHerds: true })
      import('@/lib/analytics').then(({ event }) => {
        event({ action: 'onboarding_skip', category: 'onboarding', step_number: 3, skipped_fields: ['herds'] })
      })
    }
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
        import('@/lib/analytics').then(({ event }) => {
          event({ action: 'onboarding_complete', category: 'onboarding' })
        })
        setShowSuccess(true)
        setIsCompleting(true)
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

  // ── Render ────────────────────────────────────────────────────────────────
  const tourSteps: Step[] = [
    {
      target: '.tour-categoria-hacienda',
      title: 'Categorías y Consumo',
      content: 'Selecciona la categoría de tu ganado. El sistema calculará automáticamente sus requerimientos de Equivalente Vaca (EV) según las tablas de consumo oficiales.',
      skipBeacon: true,
    },
    {
      target: '#add-herd-btn',
      title: 'Añadir al Inventario',
      content: 'Una vez cargados los datos, agrégalos a tu inventario. Podrás ver en tiempo real cómo impactan en la carga total de tu campo.',
    },
    {
      target: '#finish-onboarding-btn',
      title: '¡Todo listo!',
      content: 'Cuando termines, finaliza la configuración para ingresar al Dashboard principal. Puedes volver a editar tu inventario en cualquier momento.',
    }
  ]

  return (
    <>
      <OnboardingTour tourId="onboarding-step3-v1" steps={tourSteps} />
      <SuccessModal
        isOpen={showSuccess}
        fieldName={data.fieldName}
        totalHa={data.fieldBoundaryHa || paddocksHa}
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
          <button
            onClick={prevStep}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Atrás
          </button>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl shrink-0">
            <p className="text-xs font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* ─── Layout 50/50 ─── */}
        <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

          {/* ═══ FORM (izquierda) ═══ */}
          <div className="flex-1 flex flex-col border-r border-gray-100 min-w-0 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-black text-gray-800">Agregar lote de animales</h3>
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">
                EV y consumo calculados automáticamente con tablas Cocimano
              </p>
            </div>

            <div className="tour-categoria-hacienda flex-1 px-5 py-4 overflow-y-auto min-h-0">
              <HerdFormFields
                value={form}
                onChange={setForm}
                showName
              />
            </div>

            {/* Botón agregar */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              <button
                type="button"
                id="add-herd-btn"
                onClick={addHerd}
                disabled={!canAdd}
                className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 bg-white px-4 py-3 rounded-xl hover:bg-green-50 active:scale-[0.98] transition-all text-sm font-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                Agregar al inventario
              </button>
              {!form.physioCategory && (
                <p className="text-center text-[9px] text-gray-400 font-normal mt-1.5">
                  Seleccioná una categoría para habilitar el botón
                </p>
              )}
            </div>
          </div>

          {/* ═══ INVENTARIO (derecha) ═══ */}
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

            {/* Stats totales */}
            {data.herds.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-50 shrink-0 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: totalAnimals,               l: 'Cabezas' },
                    { v: totalEV.toFixed(1),         l: 'EV totales' },
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

            {/* Lista de lotes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
              <AnimatePresence>
                {data.herds.map((h: any, idx: number) => {
                  const hMsDay = Math.round((h.totalEV || 0) * MS_PER_EV)
                  const comercial = h.categoria as CategoriaComercial | undefined
                  const colors = comercial ? CATEGORIA_COLORS[comercial] : null
                  const dispLabel = comercial ? (CATEGORIA_LABEL_RAE[comercial] ?? h.species) : h.species
                  const physioLabel = h.physiologicalCategory ? PHYSIO_LABEL[h.physiologicalCategory as keyof typeof PHYSIO_LABEL] : null

                  return (
                    <motion.div key={idx}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 hover:border-green-100 transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colors ? colors.bg : 'bg-gray-50 border-gray-200'}`}>
                          <span className={`text-[10px] font-black ${colors ? colors.text : 'text-gray-600'}`}>
                            {(physioLabel ?? dispLabel ?? 'RDO').slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900 truncate">{h.name}</p>
                          <p className="text-[10px] text-gray-500 font-normal">
                            {h.headCount} cab. · {h.breed || 'Sin raza'} · {h.avgWeight} kg
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-500">
                            {(h.totalEV || 0).toFixed(1)} <span className="text-[9px] font-normal text-gray-400">EV</span>
                          </p>
                          <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <Leaf className="w-2.5 h-2.5" />{hMsDay} kg MS/día
                          </p>
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

            {/* CTAs finales */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
              <motion.button
                id="finish-onboarding-btn"
                onClick={() => handleFinish(data.herds.length === 0)}
                disabled={submitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20 disabled:opacity-30 disabled:grayscale"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando tu campo...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Finalizar y entrar al Dashboard</>}
              </motion.button>
              {data.herds.length === 0 && !submitting && (
                <p className="text-center text-[9px] text-gray-400">
                  Se guardará sin hacienda — podés cargarla después desde <strong>Rodeos</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
