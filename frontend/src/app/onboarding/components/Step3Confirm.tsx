'use client'

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { finishOnboarding } from '../actions'
import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, Loader2, Check, MapPin, Users, Map } from 'lucide-react'

const SPECIES_LABELS: Record<string, string> = {
  vacas: 'Vacas', vaquillonas: 'Vaquillonas', terneros: 'Terneros',
  ovejas: 'Ovejas', cabras: 'Cabras', caballos: 'Caballos', toros: 'Toros',
}

export default function Step3Confirm() {
  const { data, prevStep } = useOnboarding()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalEV        = data.herds.reduce((s, h) => s + h.totalEV, 0)
  const totalAnimals   = data.herds.reduce((s, h) => s + h.headCount, 0)
  const totalPaddockHa = data.paddocks.reduce((s, p) => s + p.area_ha, 0)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await finishOnboarding({
        firebaseUid:     user?.uid ?? '',
        fieldName:       data.fieldName,
        totalArea:       data.totalArea || totalPaddockHa,
        location:        data.location!,
        fieldBoundary:   data.fieldBoundary,
        fieldBoundaryHa: data.fieldBoundaryHa || 0,
        herds:           data.herds,
        paddocks:        data.paddocks,
      })
      if (res.success) window.location.href = '/dashboard'
    } catch {
      setError('Hubo un error al guardar los datos. Por favor intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col py-6 px-8 bg-white overflow-hidden min-h-0">
      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

        {/* ══ LEFT — Field + Paddocks ══ */}
        <div className="flex-1 flex flex-col border-r border-gray-100 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-7 pb-5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
                <Map className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Establecimiento</p>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">{data.fieldName || '—'}</h2>
              </div>
            </div>
            {data.location && (
              <p className="text-xs text-gray-400 font-normal mt-2 leading-relaxed">{data.location.address}</p>
            )}
          </div>

          {/* Field stats */}
          <div className="grid grid-cols-2 gap-3 px-8 pt-6 pb-4 shrink-0">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1.5">Superficie total</p>
              <p className="text-2xl font-bold text-gray-900 leading-none">{(data.totalArea || totalPaddockHa).toFixed(1)}</p>
              <p className="text-[10px] text-gray-400 font-normal mt-0.5">hectáreas</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1.5">Potreros</p>
              <p className="text-2xl font-bold text-gray-900 leading-none">{data.paddocks.length}</p>
              <p className="text-[10px] text-gray-400 font-normal mt-0.5">registrados</p>
            </div>
          </div>

          {/* Paddock list — INDEPENDENT SCROLL */}
          <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0 space-y-2">
            {data.paddocks.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Detalle de potreros</p>
                {data.paddocks.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-400 flex items-center justify-center">{idx + 1}</span>
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                    </div>
                    <p className="text-xs text-gray-400 font-normal">{p.area_ha} ha</p>
                  </div>
                ))}
              </>
            )}
            {data.paddocks.length === 0 && (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-orange-700">Sin potreros dibujados</p>
                  <p className="text-[10px] text-orange-400 font-normal mt-0.5">Podés agregarlos desde el Dashboard.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── ATRÁS — bottom left ── */}
          <div className="px-8 py-5 border-t border-gray-100 shrink-0">
            <button onClick={prevStep}
              className="text-gray-400 hover:text-gray-700 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Atrás
            </button>
          </div>
        </div>

        {/* ══ RIGHT — Herds + Confirm ══ */}
        <div className="flex-1 flex flex-col bg-gray-50/20 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-7 pb-5 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Hacienda</p>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Inventario de rebaños</h2>
              </div>
            </div>
            {data.herds.length > 0 && (
              <div className="text-right">
                <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Carga total</p>
                <p className="text-2xl font-bold text-orange-500 leading-none">{totalEV.toFixed(1)} <span className="text-xs font-normal text-gray-400">EV</span></p>
              </div>
            )}
          </div>

          {/* Totals strip */}
          <div className="grid grid-cols-2 gap-3 px-8 pt-6 pb-4 shrink-0">
            <div className="p-4 bg-white rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1.5">Animales</p>
              <p className="text-2xl font-bold text-gray-900 leading-none">{totalAnimals}</p>
              <p className="text-[10px] text-gray-400 font-normal mt-0.5">cabezas totales</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-orange-100">
              <p className="text-[10px] font-bold text-orange-400 tracking-widest uppercase mb-1.5">Carga EV</p>
              <p className="text-2xl font-bold text-orange-500 leading-none">{totalEV.toFixed(1)}</p>
              <p className="text-[10px] text-orange-300 font-normal mt-0.5">Equivalente Vaca</p>
            </div>
          </div>

          {/* Herd list — INDEPENDENT SCROLL */}
          <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0 space-y-2">
            {data.herds.map((h, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-900">{h.name}</p>
                  <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                    {SPECIES_LABELS[h.species] || h.species} · {h.headCount} cab. · {h.age} meses
                  </p>
                </div>
                <p className="text-sm font-bold text-orange-500">{h.totalEV} <span className="text-[10px] font-normal text-gray-400">EV</span></p>
              </div>
            ))}
            {data.herds.length === 0 && (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-3">
                <Users className="w-4 h-4 text-orange-300 shrink-0" />
                <p className="text-xs font-bold text-orange-600">Sin rebaños registrados</p>
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600 font-bold mt-2">{error}</div>
            )}
          </div>

          {/* ── CONFIRMAR — bottom right ── */}
          <div className="px-8 py-5 border-t border-gray-100 shrink-0 flex justify-end">
            <button onClick={handleConfirm} disabled={submitting || !data.fieldName || !data.location}
              className="bg-green-600 text-white font-bold px-8 py-3 rounded-xl text-sm flex items-center gap-2 hover:bg-green-700 disabled:opacity-25 transition-all">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : <><Check className="w-4 h-4" /> Confirmar y empezar</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
