'use client'

/**
 * Step2Panel — Left panel for Step 2 (Delimitación / Potreros).
 *
 * SIMPLIFIED: The polygon tool labels (Crear, Editar, Eliminar, Volver)
 * are now shown as tooltips directly on the Geoman map toolbar buttons —
 * NOT here in the left panel.
 *
 * This panel shows only:
 *  1. If KML paddocks already loaded → green success card + optional reimport
 *  2. "¿Querés demarcar el área total?" question (optional perimeter)
 *  3. Draft confirm / field confirmed state
 *  4. Paddock list (rename + forraje)
 *  5. Next / Skip CTAs (always enabled)
 */

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import {
  ArrowRight, ArrowLeft, Trash2, Ruler,
  AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, PenLine, Map, Info,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PADDOCK_COLORS } from './paddockColors'
import { parseKmlFile } from '@/lib/kmlParser'
import type { ParsedKmlFeature } from '@/lib/kmlParser'
import OnboardingTour from '@/components/OnboardingTour'
import { Step } from 'react-joyride'

interface Props {
  midDrawArea: number | null
  onKmlParsed?: (features: ParsedKmlFeature[]) => void
}

export default function Step2Panel({ midDrawArea, onKmlParsed }: Props) {
  const { data, updateData, nextStep, prevStep } = useOnboarding()
  const { user } = useAuth()

  const draftShape = (data as any)._draftShape ?? null
  const [draftName, setDraftName] = useState(data.fieldName || '')
  const kmlFileRef = React.useRef<HTMLInputElement>(null)
  const [kmlLoading, setKmlLoading] = useState(false)
  const [kmlError, setKmlError] = useState<string | null>(null)

  // Whether the user opted in to drawing the field perimeter manually
  const [showDrawPerimeter, setShowDrawPerimeter] = useState(false)

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setKmlLoading(true)
    setKmlError(null)
    const result = await parseKmlFile(file)
    setKmlLoading(false)
    if (kmlFileRef.current) kmlFileRef.current.value = ''
    if (result.error) { setKmlError(result.error); return }
    onKmlParsed?.(result.features)
  }

  const hasField    = !!data.fieldBoundary
  const hasDraft    = !!draftShape && !hasField
  const hasPaddocks = data.paddocks.length > 0

  // Confirm drawn perimeter
  const confirmField = () => {
    if (!draftShape || !draftName.trim()) return
    updateData({
      fieldLayerId:    draftShape.id,
      fieldBoundary:   draftShape.geojson,
      fieldBoundaryHa: draftShape.area_ha,
      totalArea:       draftShape.area_ha,
      fieldName:       draftName.trim(),
      _draftShape:     null,
    } as any)
  }

  const cancelField = () => {
    draftShape?.layer?.remove?.()
    updateData({ _draftShape: null } as any)
  }

  const resetField = () => {
    updateData({ fieldBoundary: null, fieldBoundaryHa: 0, paddocks: [], totalArea: 0, _draftShape: null } as any)
  }

  const removePaddock = (idx: number) => {
    const updated = data.paddocks.filter((_, i) => i !== idx)
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
  }

  const renamePaddock = (idx: number, name: string) => {
    updateData({ paddocks: data.paddocks.map((p, i) => i === idx ? { ...p, name } : p) })
  }

  const setForrajePaddock = (idx: number, val: string) => {
    updateData({
      paddocks: data.paddocks.map((p, i) =>
        i === idx ? { ...p, dry_matter_kg_ha: val === '' ? undefined : Number(val) } : p
      ),
    })
  }

  const persistStep = async (s: number) => {
    try {
      if (!user) return
      const tok = await user.getIdToken()
      await fetch('/api/auth/onboarding-step', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ step: s }),
      })
    } catch {}
  }

  const handleNext = async () => {
    const isSkip = !hasField && !hasPaddocks
    updateData({ skippedMap: isSkip })
    if (isSkip) {
      import('@/lib/analytics').then(({ event }) => {
        event({ action: 'onboarding_skip', category: 'onboarding', step_number: 2, skipped_fields: ['map', 'paddocks'] })
      })
    }
    await persistStep(2)
    nextStep()
  }

  const tourSteps: Step[] = [
    {
      target: '.tour-herramientas-potreros',
      title: 'Crear Potreros',
      content: 'Puedes dibujar cada uno de tus potreros en el mapa usando las herramientas, o si tienes un archivo KML de tu campo, ¡cárgalo directamente aquí!',
      skipBeacon: true,
    },
    {
      target: '.leaflet-pm-toolbar',
      title: 'Herramientas de Dibujo',
      content: 'Utiliza esta barra lateral en el mapa para trazar polígonos, editarlos o borrarlos. El área se calculará automáticamente.',
    },
    {
      target: '.tour-perimetro-campo',
      title: 'Demarcar tu Campo (Opcional)',
      content: 'Si quieres, también puedes dibujar el perímetro exterior total de tu establecimiento.',
    }
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OnboardingTour tourId="onboarding-step2-v1" steps={tourSteps} />

      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Paso 2 de 3 · Delimitación</p>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">{data.fieldName || 'Tu campo'}</h2>
          </div>
          <button onClick={prevStep} className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Paso anterior
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 px-6 py-4 space-y-3 overflow-y-auto min-h-0">

        {/* ── A) KML paddocks already loaded ── */}
        {hasPaddocks && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-2xl border bg-green-50 border-green-200">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-green-500 text-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-green-700">
                {data.paddocks.length} potrero{data.paddocks.length !== 1 ? 's' : ''} cargado{data.paddocks.length !== 1 ? 's' : ''} del KML
              </p>
              <p className="text-[10px] text-green-600 font-normal mt-0.5">
                {data.paddocks.reduce((s, p) => s + p.area_ha, 0).toFixed(1)} ha · marcados en el mapa
              </p>
              <button
                onClick={() => kmlFileRef.current?.click()}
                disabled={kmlLoading}
                className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-green-200 text-green-700 text-[10px] font-bold rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                {kmlLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Procesando...</>
                  : <><Map className="w-3 h-3" /> Reimportar KML</>}
              </button>
              {kmlError && <p className="text-[10px] text-red-600 font-bold mt-1">{kmlError}</p>}
            </div>
          </motion.div>
        )}

        {/* ── B) Empty state — no paddocks ── */}
        {!hasPaddocks && !hasDraft && !hasField && (
          <div className="space-y-3">
            {/* Alert */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-black text-amber-800">Sin potreros — algunas métricas no estarán disponibles</p>
                <ul className="mt-1 space-y-0.5 text-amber-700 font-normal text-[10px]">
                  <li>· NDVI, vigor de fotosíntesis, métricas satelitales por potrero</li>
                  <li>· Crecimiento de pasto, movimientos de ganado desde el mapa</li>
                </ul>
                <p className="mt-1.5 text-amber-600 font-normal text-[10px]">
                  Podés delimitarlos desde el panel de gestión de potreros cuando quieras.
                </p>
              </div>
            </div>

            {/* KML import or draw hint */}
            <div className="tour-herramientas-potreros border-2 border-dashed border-gray-100 rounded-2xl py-7 flex flex-col items-center gap-3 text-center">
              <PenLine className="w-7 h-7 text-gray-200" />
              <div>
                <p className="text-xs font-bold text-gray-400">Dibujá los potreros en el mapa</p>
                <p className="text-[10px] text-gray-300 font-normal mt-0.5">Usá las herramientas de la barra lateral del mapa →</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">O si ya tenés el archivo</span>
                <button
                  onClick={() => kmlFileRef.current?.click()}
                  disabled={kmlLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-bold rounded-lg hover:bg-cyan-100 transition-colors disabled:opacity-50"
                >
                  {kmlLoading
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Procesando...</>
                    : <><Map className="w-3 h-3" /> Cargar potreros desde KML</>}
                </button>
                {kmlError && <p className="text-[10px] text-red-600 font-bold">{kmlError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── C) Optional: demarcar área total del campo ── */}
        {/* Only show if the user has not already drawn/confirmed the field */}
        {!hasField && !hasDraft && (
          <div className="tour-perimetro-campo rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-100">
                <Info className="w-3 h-3 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-gray-700">¿Querés demarcar el área total de tu campo?</p>
                <p className="text-[10px] text-gray-500 font-normal mt-0.5 leading-relaxed">
                  {hasPaddocks
                    ? 'Con los potreros ya tenemos lo necesario. El perímetro total del campo es opcional.'
                    : 'Podés dibujar el contorno completo del campo en el mapa usando la herramienta de dibujo.'}
                </p>
                {!showDrawPerimeter && (
                  <button
                    onClick={() => setShowDrawPerimeter(true)}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <PenLine className="w-3 h-3" /> Sí, quiero dibujarlo
                  </button>
                )}
                {showDrawPerimeter && (
                  <p className="mt-1.5 text-[10px] text-blue-500 font-normal">
                    Hacé clic en el mapa para trazar el perímetro del campo.
                    {midDrawArea !== null && (
                      <span className="ml-1.5 font-black text-blue-600">
                        <Ruler className="w-2.5 h-2.5 inline mb-0.5 mr-0.5" />
                        {midDrawArea.toFixed(1)} ha en progreso...
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── D) Draft confirmation card ── */}
        {hasDraft && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl border bg-amber-50 border-amber-200">
            <p className="text-xs font-black text-amber-700">Perímetro dibujado</p>
            <p className="text-[10px] text-amber-600 font-normal mt-0.5">{draftShape.area_ha.toFixed(1)} ha · Confirmá para guardar</p>
            <div className="mt-2.5 space-y-2">
              <input
                type="text" value={draftName} onChange={e => setDraftName(e.target.value)}
                placeholder="Nombre del campo"
                className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 outline-none font-medium placeholder:text-gray-300"
              />
              <div className="flex gap-2">
                <button onClick={confirmField} disabled={!draftName.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 text-white text-[10px] font-black rounded-lg hover:bg-green-700 transition-all disabled:opacity-30">
                  <CheckCircle2 className="w-3 h-3" /> Confirmar perímetro
                </button>
                <button onClick={cancelField}
                  className="px-3 py-1.5 border border-gray-200 text-gray-500 text-[10px] font-bold rounded-lg hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── E) Field confirmed ── */}
        {hasField && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 p-3.5 rounded-2xl border bg-green-50 border-green-200">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-green-500 text-white">
              <CheckCircle2 className="w-3 h-3" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-green-700">Perímetro confirmado</p>
              <p className="text-[10px] text-green-600 font-normal mt-0.5">
                {data.fieldBoundaryHa.toFixed(1)} ha · {data.fieldName}
              </p>
              <button onClick={resetField} className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors">
                <RefreshCw className="w-2.5 h-2.5" /> Redibujar
              </button>
            </div>
          </motion.div>
        )}

        {/* ── F) Paddock import button (after field confirmed) ── */}
        {hasField && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => kmlFileRef.current?.click()}
              disabled={kmlLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-700 text-[10px] font-bold rounded-lg hover:bg-cyan-100 transition-colors disabled:opacity-50"
            >
              {kmlLoading
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Procesando KML...</>
                : <><Map className="w-3 h-3" /> Importar potreros (KML)</>}
            </button>
            {kmlError && <p className="text-[10px] text-red-600 font-bold">{kmlError}</p>}
          </div>
        )}

        {/* ── G) Paddocks list ── */}
        <AnimatePresence>
          {hasPaddocks && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                Potreros · {data.paddocks.length}
              </p>
              {data.paddocks.map((p, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  className="bg-white border border-gray-100 rounded-xl hover:border-green-100 overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] }} />
                    <input
                      type="text" value={p.name}
                      onChange={e => renamePaddock(idx, e.target.value)}
                      className="flex-1 text-xs font-bold text-gray-700 bg-transparent outline-none focus:bg-gray-50 rounded px-1 py-0.5 min-w-0"
                    />
                    <span className="text-[9px] font-black text-gray-400 shrink-0">{p.area_ha.toFixed(1)} ha</span>
                    <button onClick={() => removePaddock(idx)}
                      className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Forraje row */}
                  <div className="flex items-center gap-2 px-2.5 pb-2">
                    <div className="w-3 h-3 shrink-0" />
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">Forraje:</span>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0" max="10000" step="50"
                          value={(p as any).dry_matter_kg_ha ?? ''}
                          onChange={e => setForrajePaddock(idx, e.target.value)}
                          placeholder="kg MS/ha"
                          className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-0.5 text-[10px] font-bold text-gray-700 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-green-400 pr-14"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-gray-300 font-bold">kg MS/ha</span>
                      </div>
                    </div>
                    {(p as any).dry_matter_kg_ha > 0 && (
                      <span className="text-[8px] font-bold text-green-600 shrink-0">
                        {Math.round((p as any).dry_matter_kg_ha * p.area_ha).toLocaleString()} kg
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <input type="file" ref={kmlFileRef} accept=".kml" className="hidden" onChange={handleKmlUpload} />
      </div>

      {/* ── CTAs ── */}
      <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
        <button
          onClick={handleNext}
          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
        >
          Siguiente — Cargar hacienda <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          Saltar este paso por ahora
        </button>
      </div>
    </div>
  )
}
