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
 *  2. Paddock list (rename + forraje)
 *  3. Next / Skip CTAs (always enabled)
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

  const kmlFileRef = React.useRef<HTMLInputElement>(null)
  const [kmlLoading, setKmlLoading] = useState(false)
  const [kmlError, setKmlError] = useState<string | null>(null)

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

  const hasPaddocks = data.paddocks.length > 0

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
    const isSkip = !hasPaddocks
    
    // Sum area from all paddocks
    const totalHa = data.paddocks.reduce((s, p) => s + p.area_ha, 0)
    updateData({ 
      skippedMap: isSkip,
      totalArea: totalHa,
      fieldBoundaryHa: totalHa 
    } as any)
    
    if (isSkip) {
      import('@/lib/analytics').then(({ event }) => {
        event({ action: 'onboarding_skip', category: 'onboarding', step_number: 2, skipped_fields: ['map', 'paddocks'] })
      })
    }
    await persistStep(2)
    nextStep()
  }

  const tourSteps = [
    {
      target: '.tour-herramientas-potreros',
      title: 'Crear Potreros',
      content: 'Podés dibujar cada potrero en el mapa o cargar un archivo KML de tu campo directamente.',
      skipBeacon: true,
      placement: 'bottom' as const,
    },
    {
      target: '.leaflet-pm-toolbar',
      title: 'Herramientas de Dibujo',
      content: 'Usá esta barra para trazar polígonos, editarlos o borrarlos. El área se calcula automáticamente.',
      placement: 'auto' as const,
    }
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OnboardingTour tourId="onboarding-step2-v1" steps={tourSteps} />

      {/* ── Header ── */}
      <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Paso 2 de 3 · Delimitación</p>
            <h2 className="text-base md:text-lg font-black text-gray-900 tracking-tight">{data.fieldName || 'Tu campo'}</h2>
          </div>
          <button onClick={prevStep} className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Atrás
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 px-4 md:px-6 py-3 md:py-4 overflow-y-auto min-h-0">
        <div className="rounded-2xl border-2 border-green-100 md:border-gray-200 bg-white shadow-sm p-3 md:p-4 space-y-3">

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
        {!hasPaddocks && (
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
            <div className="tour-herramientas-potreros">
              {/* Draw hint */}
              <div className="flex flex-col items-center text-center gap-1.5 mb-5 mt-2">
                <PenLine className="w-5 h-5 text-gray-300" />
                <p className="text-xs font-bold text-gray-400">Dibujá los potreros en el mapa</p>
                <p className="text-[10px] text-gray-300 font-normal">Usá las herramientas del mapa <span className="hidden md:inline">→</span><span className="md:hidden">↓</span></p>
              </div>
              
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px bg-gray-100 flex-1"></div>
                <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">O Subí tu archivo</span>
                <div className="h-px bg-gray-100 flex-1"></div>
              </div>

              {/* Big File Upload Button */}
              <button
                onClick={() => kmlFileRef.current?.click()}
                disabled={kmlLoading}
                className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-50 group-hover:bg-green-50 border border-gray-100 group-hover:border-green-200 flex items-center justify-center transition-all">
                  {kmlLoading ? <Loader2 className="w-6 h-6 animate-spin text-green-500" /> : <Map className="w-6 h-6 text-gray-300 group-hover:text-green-500 transition-colors" />}
                </div>
                <div className="text-center space-y-1 px-4">
                  <p className="text-sm font-black text-gray-600 group-hover:text-green-700 transition-colors">Cargar potreros (KML/Qgis)</p>
                  <p className="text-[10px] text-gray-400 font-normal">Soporta .kml, .kmz, .zip (shapefile) y .geojson</p>
                </div>
              </button>
              {kmlError && <p className="text-[10px] text-red-500 font-bold flex items-center justify-center gap-1.5 mt-3"><AlertTriangle className="w-3 h-3 shrink-0" />{kmlError}</p>}
            </div>
          </div>
        )}


        {/* ── G) Paddocks list ── */}
        <AnimatePresence>
          {hasPaddocks && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                Potreros · {data.paddocks.length}
              </p>
              {data.paddocks.map((p, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  className="bg-white border border-gray-100 rounded-xl hover:border-green-100 transition-all shadow-sm overflow-hidden">
                  {/* Top row: color dot + name + area + delete */}
                  <div className="flex items-center gap-2.5 p-3">
                    <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] }} />
                    <input
                      type="text" value={p.name}
                      onChange={e => renamePaddock(idx, e.target.value)}
                      className="flex-1 text-sm font-bold text-gray-800 bg-transparent outline-none focus:bg-gray-50 rounded px-1.5 py-0.5 min-w-0 transition-colors"
                    />
                    <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-md shrink-0">{p.area_ha.toFixed(1)} ha</span>
                    <button onClick={() => removePaddock(idx)}
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Forraje row */}
                  <div className="flex items-center gap-2 px-3 pb-2.5 border-t border-gray-50 pt-2">
                    <div className="w-4 shrink-0" />
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Forraje:</span>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0" max="10000" step="50"
                          value={(p as any).dry_matter_kg_ha ?? ''}
                          onChange={e => setForrajePaddock(idx, e.target.value)}
                          placeholder="kg MS/ha"
                          className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-green-400 pr-14"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-300 font-bold">kg MS/ha</span>
                      </div>
                    </div>
                    {(p as any).dry_matter_kg_ha > 0 && (
                      <span className="text-[10px] font-bold text-green-600 shrink-0">
                        {Math.round((p as any).dry_matter_kg_ha * p.area_ha).toLocaleString()} kg
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <input type="file" ref={kmlFileRef} accept=".kml,.kmz,.zip,.geojson,.json" className="hidden" onChange={handleKmlUpload} />
        </div>{/* end card */}
      </div>

      {/* ── CTAs ── */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 shrink-0 space-y-2">
        <button
          onClick={handleNext}
          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-3.5 md:py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
        >
          Siguiente — Cargar hacienda <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-1.5 py-2 md:py-2.5 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          Saltar este paso por ahora
        </button>
      </div>
    </div>
  )
}
