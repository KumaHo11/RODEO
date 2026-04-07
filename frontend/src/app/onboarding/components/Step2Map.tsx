'use client'

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import { Loader2, ArrowRight, ArrowLeft, Trash2, Ruler, Map, MapPin, SkipForward, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import turfArea from '@turf/area'
import { PADDOCK_COLORS } from './paddockColors'

type PaddockDrawMapProps = {
  center: [number, number]
  mode: 'field' | 'paddock'
  paddockCount: number
  onShapeDrawn: (geojson: any, layer: any) => void
  onMidDraw?: (areaHa: number | null) => void
}

const PaddockDrawMap = dynamic<PaddockDrawMapProps>(() => import('./PaddockDrawMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      <p className="text-[10px] font-bold text-gray-400 tracking-widest">Iniciando mapa...</p>
    </div>
  ),
})

interface DraftShape { geojson: any; area_ha: number; layer: any }

export default function Step2Map() {
  const { data, updateData, nextStep, prevStep } = useOnboarding()
  const { user } = useAuth()

  // Map center from location selected in step 1
  const mapCenter: [number, number] = data.location
    ? [data.location.lat, data.location.lng]
    : [-34.6037, -58.3816]

  const phase = data.fieldBoundary ? 'paddock' : 'field'
  const [draft,          setDraft]          = useState<DraftShape | null>(null)
  const [draftName,      setDraftName]      = useState('')
  const [draftFieldName, setDraftFieldName] = useState(data.fieldName || '') // pre-fill from Step1
  const [midDrawArea,    setMidDrawArea]    = useState<number | null>(null)
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  const handleShapeDrawn = useCallback((geojson: any, layer: any) => {
    const area_ha = parseFloat((turfArea(geojson) / 10000).toFixed(2))
    setDraft({ geojson, area_ha, layer })
    setDraftName('')
  }, [])

  const confirmField = () => {
    if (!draft || !draftFieldName.trim()) return
    // Save boundary + name together — this is the definitive write to context
    updateData({
      fieldBoundary:   draft.geojson,
      fieldBoundaryHa: draft.area_ha,
      totalArea:       draft.area_ha,
      fieldName:       draftFieldName.trim(),
    })
    setDraft(null)
    setDraftName('')
  }

  const cancelDraft = () => {
    draft?.layer?.remove()
    setDraft(null)
    setDraftFieldName(data.fieldName || '') // restore
  }

  const confirmPaddock = () => {
    if (!draft || !draftName.trim()) return
    const updated = [...data.paddocks, { name: draftName.trim(), geojson: draft.geojson, area_ha: draft.area_ha }]
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
    setDraft(null)
    setDraftName('')
  }

  const removePaddock = (idx: number) => {
    const updated = data.paddocks.filter((_, i) => i !== idx)
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
  }

  const resetField = () => {
    updateData({ fieldBoundary: null, fieldBoundaryHa: 0, paddocks: [], totalArea: 0 })
    setDraft(null)
  }

  // Persist step to DB
  const persistStep = async (step: number) => {
    try {
      if (!user) return
      const idToken = await user.getIdToken()
      await fetch('/api/auth/onboarding-step', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ step }),
      })
    } catch (e) { console.warn('Could not persist step 2:', e) }
  }

  // Skip handler: mark skipped and advance
  const handleSkip = async () => {
    updateData({ skippedMap: true })
    await persistStep(2)
    nextStep()
  }

  const handleNext = async () => {
    updateData({ skippedMap: false })
    await persistStep(2)
    nextStep()
  }

  const hasPaddocks = data.paddocks.length > 0

  return (
    <div className="flex-1 flex flex-col py-4 px-6 bg-white overflow-hidden min-h-0">

      {/* Context strip — field name from step 1 */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
            <Map className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div>
            <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Paso 2 de 3 · Delimitación cartográfica</p>
            <p className="text-sm font-black text-gray-900 tracking-tight">{data.fieldName || 'Tu establecimiento'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Skip button */}
          <button
            onClick={() => setShowSkipWarning(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <SkipForward className="w-3 h-3" /> Saltar este paso
          </button>
          <button
            onClick={prevStep}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Atrás
          </button>
        </div>
      </div>

      {/* Skip warning banner */}
      <AnimatePresence>
        {showSkipWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shrink-0"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-800">¿Saltar la delimitación del campo?</p>
              <p className="text-[10px] text-amber-600 font-normal mt-0.5 leading-relaxed">
                Los datos satelitales de NDVI y biomasa se calculan a partir de los potreros dibujados.
                Sin ellos, algunos análisis no estarán disponibles hasta que los completes desde la sección <strong>Mi Campo</strong>.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={handleSkip} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-lg hover:bg-amber-600 transition-all">
                  <SkipForward className="w-3 h-3" /> Saltar igual
                </button>
                <button onClick={() => setShowSkipWarning(false)} className="px-3 py-1.5 bg-white text-amber-600 border border-amber-200 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-all">
                  Volver a dibujar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

        {/* COL LEFT — form */}
        <div className="w-[256px] shrink-0 flex flex-col border-r border-gray-100 bg-white">
          {/* Phase steps */}
          <div className="p-5 space-y-2 border-b border-gray-100">
            <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-3">Instrucciones</p>
            {/* Step A */}
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
              phase === 'field' ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50 opacity-60'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                phase === 'paddock' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {phase === 'paddock' ? '✓' : '1'}
              </div>
              <div>
                <p className={`text-[10px] font-black tracking-wide uppercase ${phase === 'field' ? 'text-blue-700' : 'text-gray-400'}`}>
                  Delimitá tu campo
                </p>
                <p className="text-[9px] text-gray-400 font-normal mt-0.5">Dibujá el perímetro total</p>
              </div>
            </div>
            {/* Step B */}
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
              phase === 'paddock' ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-40'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                phase === 'paddock' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>2</div>
              <div>
                <p className={`text-[10px] font-black tracking-wide uppercase ${phase === 'paddock' ? 'text-green-700' : 'text-gray-400'}`}>
                  Agregá los potreros
                </p>
                <p className="text-[9px] text-gray-400 font-normal mt-0.5">Dibujá cada lote dentro</p>
              </div>
            </div>
          </div>

          {/* Field stats */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-2">
            {/* Campo total */}
            <div className={`p-3 rounded-xl border-2 border-dashed transition-all ${
              data.fieldBoundary ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Ruler className="w-3 h-3 text-blue-500" />
                  <p className="text-[9px] font-black text-blue-600 tracking-widest uppercase">Campo total</p>
                </div>
                {data.fieldBoundary && (
                  <button onClick={resetField} className="text-[8px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wide transition-colors">
                    Redibujar
                  </button>
                )}
              </div>
              {data.fieldBoundary ? (
                <>
                  <p className="text-xl font-black text-blue-700 leading-none">{data.fieldBoundaryHa.toFixed(1)} <span className="text-xs font-bold text-blue-400">ha</span></p>
                  <p className="text-[9px] text-blue-400 font-normal">perímetro delimitado</p>
                </>
              ) : (
                <p className="text-[10px] text-gray-300 font-normal">Sin delimitar — dibujá el perímetro</p>
              )}
            </div>

            {/* Potreros total */}
            {data.paddocks.length > 0 && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-green-600" />
                    <p className="text-[9px] font-black text-green-700 tracking-widest uppercase">En potreros</p>
                  </div>
                  <p className="text-[9px] font-bold text-green-600">{data.paddocks.length} potrero{data.paddocks.length !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-xl font-black text-green-700 leading-none mt-1">
                  {data.paddocks.reduce((s, p) => s + p.area_ha, 0).toFixed(1)} <span className="text-xs font-bold text-green-400">ha</span>
                </p>
              </div>
            )}
          </div>

          {/* Paddock list — scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            <AnimatePresence>
              {data.paddocks.map((p, idx) => (
                <motion.div key={idx}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 transition-all"
                  style={{ borderLeftColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length], borderLeftWidth: 3, backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] + '10' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] }}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{p.name}</p>
                      <p className="text-[9px] text-gray-400 font-normal">{p.area_ha} ha</p>
                    </div>
                  </div>
                  <button onClick={() => removePaddock(idx)}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {data.paddocks.length === 0 && data.fieldBoundary && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <MapPin className="w-4 h-4 text-gray-200 mb-2" />
                <p className="text-[10px] font-bold text-gray-300">Sin potreros</p>
                <p className="text-[9px] text-gray-200 font-normal">Dibujá uno dentro del campo</p>
              </div>
            )}
          </div>

          {/* Next button */}
          <div className="px-4 pb-5 pt-3 border-t border-gray-100 shrink-0">
            <button
              onClick={handleNext}
              disabled={!hasPaddocks}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              {hasPaddocks ? <><CheckCircle2 className="w-4 h-4" /> Siguiente</> : <><ArrowRight className="w-4 h-4" /> Siguiente</>}
            </button>
            {!hasPaddocks && (
              <p className="text-center text-[9px] text-gray-400 mt-2">Dibujá al menos 1 potrero para continuar</p>
            )}
          </div>
        </div>

        {/* COL MAP */}
        <div className="flex-grow relative z-0 bg-gray-100">
          <PaddockDrawMap
            center={mapCenter}
            mode={phase}
            paddockCount={data.paddocks.length}
            onShapeDrawn={handleShapeDrawn}
            onMidDraw={setMidDrawArea}
          />

          {/* Floating badge — real-time area while drawing */}
          {midDrawArea !== null && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg backdrop-blur-sm border ${
                phase === 'field'
                  ? 'bg-blue-600/90 border-blue-400/50 text-white'
                  : 'bg-green-600/90 border-green-400/50 text-white'
              }`}>
                <Ruler className="w-3.5 h-3.5" />
                <p className="text-sm font-black">{midDrawArea.toFixed(1)} <span className="text-xs font-bold opacity-80">ha</span></p>
                <p className="text-[10px] font-normal opacity-70">{phase === 'field' ? '· perímetro campo' : '· potrero'}</p>
              </div>
            </div>
          )}

          {/* Tooltip — Phase 1 */}
          {phase === 'field' && !draft && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0, duration: 0.4 }}
              className="absolute z-[1000] pointer-events-none" style={{ top: '73px', left: '46px' }}>
              <div className="flex items-center gap-1">
                <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-r-[8px] border-t-transparent border-b-transparent border-r-blue-500" />
                <div className="w-3 h-px bg-blue-500" />
                <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2.5 max-w-[190px]">
                  <p className="text-[11px] font-bold text-gray-900 mb-0.5 flex items-center gap-1.5">
                    <Ruler className="w-3 h-3 text-blue-600 shrink-0" /> Delimitá tu campo
                  </p>
                  <p className="text-[10px] text-gray-400 leading-snug font-normal">
                    Usá la herramienta <strong className="text-gray-600 font-bold">Polígono</strong> para trazar el perímetro total del campo.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tooltip — Phase 2 */}
          {phase === 'paddock' && !draft && data.paddocks.length === 0 && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.4 }}
              className="absolute z-[1000] pointer-events-none" style={{ top: '73px', left: '46px' }}>
              <div className="flex items-center gap-1">
                <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-r-[8px] border-t-transparent border-b-transparent border-r-green-500" />
                <div className="w-3 h-px bg-green-500" />
                <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2.5 max-w-[190px]">
                  <p className="text-[11px] font-bold text-gray-900 mb-0.5 flex items-center gap-1.5">
                    <Map className="w-3 h-3 text-green-600 shrink-0" /> Dibujá los potreros
                  </p>
                  <p className="text-[10px] text-gray-400 leading-snug font-normal">
                    Campo delimitado ✓ Ahora trazá los lotes dentro del perímetro.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Modal — confirm FIELD boundary */}
          <AnimatePresence>
            {phase === 'field' && draft && (
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                className="absolute top-4 right-4 z-[1000] bg-white rounded-2xl shadow-xl border border-gray-100 w-72 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Ruler className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Confirmar campo</h3>
                </div>
                <p className="text-[10px] text-gray-400 mb-4 font-normal">
                  Superficie total: <strong className="text-gray-700 font-bold">{draft.area_ha} ha</strong>
                </p>
                {/* Field name input — key moment to confirm the name */}
                <div className="space-y-1.5 mb-4">
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Nombre del establecimiento</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ej: La Posta, Estancia El Ombú..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none placeholder:text-gray-300 font-normal transition-all"
                    value={draftFieldName}
                    onChange={e => setDraftFieldName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && draftFieldName.trim() && confirmField()}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelDraft} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancelar</button>
                  <button
                    onClick={confirmField}
                    disabled={!draftFieldName.trim()}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-30"
                  >Confirmar campo</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal — name PADDOCK */}
          <AnimatePresence>
            {phase === 'paddock' && draft && (
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                className="absolute top-4 right-4 z-[1000] bg-white rounded-2xl shadow-xl border border-gray-100 w-64 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: PADDOCK_COLORS[data.paddocks.length % PADDOCK_COLORS.length] }} />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Nuevo potrero</h3>
                </div>
                <p className="text-[10px] text-gray-400 mb-4 font-normal">
                  Área calculada: <strong className="text-gray-700 font-bold">{draft.area_ha} ha</strong>
                </p>
                <div className="space-y-1.5 mb-4">
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Nombre del potrero</label>
                  <input
                    autoFocus type="text" placeholder="Ej: Lote Norte"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmPaddock()}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelDraft} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancelar</button>
                  <button onClick={confirmPaddock} disabled={!draftName.trim()} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all disabled:opacity-30">Confirmar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
