'use client'

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { finishOnboarding } from '../actions'
import { useAuth } from '@/components/AuthProvider'
import {
  ArrowLeft, Loader2, Check, MapPin, Users, Map, Satellite,
  Scale, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { motion } from 'framer-motion'

const SPECIES_LABELS: Record<string, { label: string; emoji: string }> = {
  vacas:       { label: 'Vacas',       emoji: '🐄' },
  vaquillonas: { label: 'Vaquillonas', emoji: '🐄' },
  terneros:    { label: 'Terneros',    emoji: '🐄' },
  ovejas:      { label: 'Ovejas',      emoji: '🐑' },
  cabras:      { label: 'Cabras',      emoji: '🐐' },
  caballos:    { label: 'Caballos',   emoji: '🐴' },
  toros:       { label: 'Toros',       emoji: '🐂' },
}

const MS_PER_EV_DAY = 11

export default function Step4Confirm() {
  const { data, prevStep } = useOnboarding()
  const { user, refreshProfile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const totalEV      = data.herds.reduce((s, h) => s + h.totalEV, 0)
  const totalAnimals = data.herds.reduce((s, h) => s + h.headCount, 0)
  const totalMsDay   = Math.round(totalEV * MS_PER_EV_DAY)
  const fieldHa      = data.fieldBoundaryHa > 0
    ? data.fieldBoundaryHa
    : data.paddocks.reduce((s, p) => s + p.area_ha, 0)
  const paddockAreaHa  = data.paddocks.reduce((s, p) => s + p.area_ha, 0)
  const stockingRate   = fieldHa > 0 && totalEV > 0 ? (totalEV / fieldHa).toFixed(2) : null

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await finishOnboarding({
        firebaseUid:     user?.uid ?? '',
        fieldName:       data.fieldName,
        totalArea:       data.fieldBoundaryHa || paddockAreaHa,
        location:        data.location!,
        fieldBoundary:   data.fieldBoundary,
        fieldBoundaryHa: data.fieldBoundaryHa || 0,
        herds:           data.herds,
        paddocks:        data.paddocks,
      })
      if (res.success) {
        // Refresh the AuthProvider cache so it knows step=4 before navigating
        // This prevents the dashboard from redirecting back to onboarding on reload
        await refreshProfile()
        window.location.replace('/dashboard')
      }
    } catch (err: any) {
      console.error('finishOnboarding error:', err)
      setError('Error al guardar: ' + (err.message || 'Intenta de nuevo'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-100 shrink-0">
        <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Paso 4 de 4 · Confirmación</p>
        <h2 className="text-sm font-black text-gray-900 mt-0.5">Todo listo para empezar</h2>
      </div>

      {/* ── Body: scrollable on mobile, split on desktop ──────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col md:flex-row md:divide-x divide-gray-100 min-h-full">

          {/* ══ LEFT — Establecimiento + Potreros ══ */}
          <div className="flex-1 flex flex-col">

            {/* Field header */}
            <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <Map className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Establecimiento</p>
                  <h3 className="text-base font-black text-gray-900 leading-tight">{data.fieldName || '—'}</h3>
                </div>
              </div>
              {data.location && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-gray-400 leading-snug">{data.location.address}</p>
                </div>
              )}
            </div>

            {/* Área stats */}
            <div className="px-4 sm:px-6 py-3 border-b border-gray-50">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border-2 ${data.fieldBoundary ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <Map className={`w-3 h-3 ${data.fieldBoundary ? 'text-blue-500' : 'text-gray-300'}`} />
                    <p className={`text-[8px] font-black tracking-widest uppercase ${data.fieldBoundary ? 'text-blue-600' : 'text-gray-400'}`}>Total campo</p>
                  </div>
                  {data.fieldBoundary ? (
                    <>
                      <p className="text-xl font-black text-blue-700 leading-none">{data.fieldBoundaryHa.toFixed(1)}</p>
                      <p className="text-[8px] text-blue-400 mt-0.5">hectáreas</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-black text-gray-400 leading-none">—</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                        <p className="text-[8px] text-amber-500 font-bold">Sin delimitar</p>
                      </div>
                    </>
                  )}
                </div>

                <div className={`p-3 rounded-xl border-2 ${data.paddocks.length > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <MapPin className={`w-3 h-3 ${data.paddocks.length > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                    <p className={`text-[8px] font-black tracking-widest uppercase ${data.paddocks.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>Potreros</p>
                  </div>
                  {data.paddocks.length > 0 ? (
                    <>
                      <p className="text-xl font-black text-green-700 leading-none">{data.paddocks.length}</p>
                      <p className="text-[8px] text-green-500 mt-0.5">{paddockAreaHa.toFixed(1)} ha</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-black text-gray-400 leading-none">—</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                        <p className="text-[8px] text-amber-500 font-bold">Sin potreros</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* NDVI note */}
            <div className="px-4 sm:px-6 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Satellite className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Índice NDVI</p>
                  <p className="text-[9px] text-gray-400">
                    {data.paddocks.length > 0
                      ? 'Análisis satelital disponible en el Dashboard'
                      : 'Disponible luego de cargar potreros'}
                  </p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
            </div>

            {/* Paddock list */}
            {data.paddocks.length > 0 && (
              <div className="px-4 sm:px-6 py-3 space-y-1.5">
                <p className="text-[8px] font-black text-gray-400 tracking-widest uppercase">Detalle de potreros</p>
                {data.paddocks.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-white border border-gray-200 text-[9px] font-bold text-gray-400 flex items-center justify-center">{idx + 1}</span>
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                    </div>
                    <p className="text-xs font-black text-blue-600">{p.area_ha.toFixed(1)} ha</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT — Hacienda + Confirm ══ */}
          <div className="flex-1 flex flex-col bg-gray-50/30">

            {/* Herds header */}
            <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Hacienda</p>
                  <h3 className="text-base font-black text-gray-900 leading-tight">Inventario de rebaños</h3>
                </div>
              </div>
            </div>

            {/* Totals */}
            {data.herds.length > 0 && (
              <div className="grid grid-cols-3 gap-2 px-4 sm:px-6 py-3 border-b border-gray-100">
                <div className="p-2 bg-white rounded-xl border border-gray-100 text-center">
                  <p className="text-base font-black text-gray-900">{totalAnimals}</p>
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">cabezas</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-orange-100 text-center">
                  <p className="text-base font-black text-orange-500">{totalEV.toFixed(1)}</p>
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">EV tot.</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-emerald-100 text-center">
                  <p className="text-base font-black text-emerald-600">{totalMsDay.toLocaleString()}</p>
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">kg MS/d</p>
                </div>
              </div>
            )}

            {/* Stocking rate */}
            {stockingRate && (
              <div className="px-4 sm:px-6 py-2 border-b border-gray-50">
                <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl border border-green-100">
                  <Scale className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-[8px] font-black text-green-600 uppercase tracking-widest">Carga animal estimada</p>
                    <p className="text-xs font-black text-green-800">{stockingRate} EV/ha <span className="text-[9px] font-normal text-green-500">sobre {fieldHa.toFixed(0)} ha</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Herd list */}
            <div className="flex-1 px-4 sm:px-6 py-3 space-y-2">
              {data.herds.map((h, idx) => {
                const sp = SPECIES_LABELS[h.species]
                const hMsDay = Math.round(h.totalEV * MS_PER_EV_DAY)
                return (
                  <div key={idx} className="flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{sp?.emoji || '🐄'}</span>
                      <div>
                        <p className="text-xs font-black text-gray-900">{h.name}</p>
                        <p className="text-[9px] text-gray-400">{sp?.label || h.species} · {h.headCount} cab.</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-orange-500">{h.totalEV} <span className="text-[8px] font-normal text-gray-400">EV</span></p>
                      <p className="text-[9px] font-bold text-emerald-600">{hMsDay} kg/d</p>
                    </div>
                  </div>
                )
              })}

              {data.herds.length === 0 && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Sin rebaños registrados</p>
                    <p className="text-[9px] text-amber-500 mt-0.5">Podés completarlo desde la sección Rebaños del Dashboard.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600 font-bold">{error}</div>
              )}
            </div>

            {/* ── Confirm CTA ────────────────────────────────────────────── */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-white shrink-0 flex flex-col gap-3">
              <motion.button
                onClick={handleConfirm}
                disabled={submitting || !data.fieldName || !data.location}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-green-600 text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-25 transition-all shadow-lg shadow-green-600/20"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando tu campo...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirmar y entrar al Dashboard</>}
              </motion.button>
              {/* Single back button — bottom only */}
              <button
                onClick={prevStep}
                className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors w-full py-1"
              >
                <ArrowLeft className="w-3 h-3" /> Atrás — Paso 3
              </button>
              <p className="text-center text-[9px] text-gray-400">Todos los datos se guardan de forma segura</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
