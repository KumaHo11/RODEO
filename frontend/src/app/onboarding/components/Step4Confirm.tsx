'use client'

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { finishOnboarding } from '../actions'
import { ArrowLeft, Loader2, Check, MapPin, Users, Map, Satellite, Leaf, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

const SPECIES_LABELS: Record<string, { label: string; emoji: string }> = {
  vacas: { label: 'Vacas', emoji: '🐄' },
  vaquillonas: { label: 'Vaquillonas', emoji: '🐄' },
  terneros: { label: 'Terneros', emoji: '🐄' },
  ovejas: { label: 'Ovejas', emoji: '🐑' },
  cabras: { label: 'Cabras', emoji: '🐐' },
  caballos: { label: 'Caballos', emoji: '🐴' },
  toros: { label: 'Toros', emoji: '🐂' },
}

const MS_PER_EV_DAY = 11

export default function Step4Confirm() {
  const { data, prevStep } = useOnboarding()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalEV        = data.herds.reduce((s, h) => s + h.totalEV, 0)
  const totalAnimals   = data.herds.reduce((s, h) => s + h.headCount, 0)
  const totalMsDay     = Math.round(totalEV * MS_PER_EV_DAY)
  // Use fieldBoundaryHa (drawn perimeter) as primary; fall back to sum of paddocks
  const fieldHa        = data.fieldBoundaryHa > 0
    ? data.fieldBoundaryHa
    : data.paddocks.reduce((s, p) => s + p.area_ha, 0)
  const paddockAreaHa  = data.paddocks.reduce((s, p) => s + p.area_ha, 0)
  const stockingRate   = fieldHa > 0 && totalEV > 0 ? (totalEV / fieldHa).toFixed(2) : null

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await finishOnboarding({
        fieldName:       data.fieldName,
        totalArea:       data.fieldBoundaryHa || paddockAreaHa,
        location:        data.location!,
        fieldBoundary:   data.fieldBoundary,
        fieldBoundaryHa: data.fieldBoundaryHa || 0,
        herds:           data.herds,
        paddocks:        data.paddocks,
      })
      if (res.success) window.location.href = '/dashboard'
    } catch {
      setError('Hubo un error al guardar. Por favor intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col py-4 px-6 bg-white overflow-hidden min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Paso 4 de 4 · Confirmación</p>
          <h2 className="text-sm font-black text-gray-900">Todo listo para empezar</h2>
        </div>
        <button onClick={prevStep} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-3 h-3" /> Atrás
        </button>
      </div>

      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

        {/* ══ LEFT — Field + Paddocks ══ */}
        <div className="flex-1 flex flex-col border-r border-gray-100 min-h-0">

          {/* Field header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                <Map className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Establecimiento</p>
                <h3 className="text-lg font-black text-gray-900">{data.fieldName || '—'}</h3>
              </div>
            </div>
            {data.location && (
              <div className="flex items-start gap-1.5 mt-1">
                <MapPin className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-gray-400 leading-snug">{data.location.address}</p>
              </div>
            )}
          </div>

          {/* Área stats */}
          <div className="px-6 py-4 border-b border-gray-50 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              {/* Campo total — from drawn boundary */}
              <div className={`p-4 rounded-2xl border-2 ${data.fieldBoundary ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Map className={`w-3 h-3 ${data.fieldBoundary ? 'text-blue-500' : 'text-gray-300'}`} />
                  <p className={`text-[9px] font-black tracking-widest uppercase ${data.fieldBoundary ? 'text-blue-600' : 'text-gray-400'}`}>Total del campo</p>
                </div>
                {data.fieldBoundary ? (
                  <>
                    <p className="text-2xl font-black text-blue-700 leading-none">{data.fieldBoundaryHa.toFixed(1)}</p>
                    <p className="text-[9px] text-blue-400 font-normal mt-0.5">hectáreas delimitadas</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-black text-gray-400 leading-none">—</p>
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <p className="text-[9px] text-amber-500 font-bold">Sin delimitar</p>
                    </div>
                    <p className="text-[8px] text-gray-400 mt-0.5">Completar desde Mi Campo</p>
                  </>
                )}
              </div>

              {/* Potreros */}
              <div className={`p-4 rounded-2xl border-2 ${data.paddocks.length > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className={`w-3 h-3 ${data.paddocks.length > 0 ? 'text-green-500' : 'text-gray-300'}`} />
                  <p className={`text-[9px] font-black tracking-widest uppercase ${data.paddocks.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>Potreros</p>
                </div>
                {data.paddocks.length > 0 ? (
                  <>
                    <p className="text-2xl font-black text-green-700 leading-none">{data.paddocks.length}</p>
                    <p className="text-[9px] text-green-500 font-normal mt-0.5">{paddockAreaHa.toFixed(1)} ha en potreros</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-black text-gray-400 leading-none">—</p>
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <p className="text-[9px] text-amber-500 font-bold">Sin potreros</p>
                    </div>
                    <p className="text-[8px] text-gray-400 mt-0.5">Agregar desde Mi Campo</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* NDVI placeholder */}
          <div className="px-6 py-4 border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <Satellite className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Índice NDVI</p>
                <p className="text-[10px] text-gray-400 font-normal">
                  {data.paddocks.length > 0
                    ? 'Análisis satelital pendiente — disponible en minutos dentro del Dashboard'
                    : 'Disponible luego de cargar los potreros desde Mi Campo'}
                </p>
              </div>
              <div className="ml-auto">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Paddock list */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0 space-y-1.5 pt-3">
            {data.paddocks.length > 0 && (
              <>
                <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-2">Detalle de potreros</p>
                {data.paddocks.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-400 flex items-center justify-center">{idx + 1}</span>
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-blue-600">{p.area_ha.toFixed(1)} ha</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Back */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <button onClick={prevStep} className="text-gray-400 hover:text-gray-700 font-bold text-[9px] tracking-widest uppercase flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Atrás
            </button>
          </div>
        </div>

        {/* ══ RIGHT — Herds + Confirm ══ */}
        <div className="flex-1 flex flex-col bg-gray-50/20 min-h-0">

          {/* Herds header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Hacienda</p>
                <h3 className="text-lg font-black text-gray-900">Inventario de rebaños</h3>
              </div>
            </div>
          </div>

          {/* Totals */}
          {data.herds.length > 0 && (
            <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                <p className="text-lg font-black text-gray-900">{totalAnimals}</p>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">cabezas</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-orange-100 text-center">
                <p className="text-lg font-black text-orange-500">{totalEV.toFixed(1)}</p>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">EV totales</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-100 text-center">
                <p className="text-lg font-black text-emerald-600">{totalMsDay.toLocaleString()}</p>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">kg MS/día</p>
              </div>
            </div>
          )}

          {/* Stocking rate */}
          {stockingRate && (
            <div className="px-6 py-3 border-b border-gray-50 shrink-0">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                <Scale className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">Carga animal estimada</p>
                  <p className="text-sm font-black text-green-800">{stockingRate} EV/ha <span className="text-[10px] font-normal text-green-500">sobre {fieldHa.toFixed(0)} ha totales</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Herd list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
            {data.herds.map((h, idx) => {
              const sp = SPECIES_LABELS[h.species]
              const hMsDay = Math.round(h.totalEV * MS_PER_EV_DAY)
              return (
                <div key={idx} className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{sp?.emoji || '🐄'}</span>
                    <div>
                      <p className="text-xs font-black text-gray-900">{h.name}</p>
                      <p className="text-[10px] text-gray-400 font-normal">
                        {sp?.label || h.species} · {h.headCount} cab. · {h.avgWeight} kg
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-orange-500">{h.totalEV} <span className="text-[9px] font-normal text-gray-400">EV</span></p>
                    <p className="text-[9px] font-bold text-emerald-600">{hMsDay} kg MS/día</p>
                  </div>
                </div>
              )
            })}
            {data.herds.length === 0 && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-700">Sin rebaños registrados</p>
                  <p className="text-[10px] text-amber-500 font-normal mt-0.5">Podés completarlo desde la sección Rebaños del Dashboard.</p>
                </div>
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600 font-bold">{error}</div>
            )}
          </div>

          {/* Confirm */}
          <div className="px-6 py-5 border-t border-gray-100 shrink-0">
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
            <p className="text-center text-[9px] text-gray-400 mt-2">Todos los datos se guardan de forma segura</p>
          </div>
        </div>

      </div>
    </div>
  )
}
