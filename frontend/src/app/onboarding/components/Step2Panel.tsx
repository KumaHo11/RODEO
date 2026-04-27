'use client'

/**
 * Step2Panel — Left panel content for Step 2 (Delimitación / Potreros).
 * The map drawing is handled by OnboardingMapSingleton (no map here).
 * This panel shows:
 *  - Instructions / guidance
 *  - Draft shape confirmation (field boundary name)
 *  - Paddock list with delete
 *  - Skip / Next CTA
 */

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import {
  ArrowRight, ArrowLeft, Trash2, Ruler, MapPin,
  SkipForward, AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, PenLine, Plus, Upload, FileSpreadsheet
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PADDOCK_COLORS } from './paddockColors'
import * as XLSX from 'xlsx'

interface Props {
  midDrawArea: number | null
}

export default function Step2Panel({ midDrawArea }: Props) {
  const { data, updateData, nextStep, prevStep } = useOnboarding()
  const { user } = useAuth()

  // _draftShape is set by page.tsx via updateData when a shape is drawn
  const draftShape = (data as any)._draftShape ?? null
  const [draftName, setDraftName] = useState(data.fieldName || '')
  const [showSkipWarning, setShowSkipWarning] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const excelData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
        if (excelData.length < 2) throw new Error("Sin datos")
        
        const rawHeaders = excelData[0].map((h: any) => String(h ?? '').trim().toLowerCase())
        const idxName = rawHeaders.findIndex(h => h.includes('nombre') || h.includes('potrero') || h.includes('lote') || h.includes('paddock'))
        const idxArea = rawHeaders.findIndex(h => h.includes('ha') || h.includes('hectarea') || h.includes('superficie') || h.includes('area'))
        const idxForraje = rawHeaders.findIndex(h => h.includes('forraje') || h.includes('ms') || h.includes('materia seca'))
        
        if (idxName === -1 || idxArea === -1) {
           alert("El Excel debe tener al menos una columna para Nombre y otra para Hectáreas (Ha o similar).")
           return
        }

        const newPaddocks = excelData.slice(1)
          .filter(row => row[idxName] && row[idxArea])
          .map(row => ({
            name: String(row[idxName]).trim(),
            area_ha: Number(row[idxArea]) || 0,
            dry_matter_kg_ha: idxForraje !== -1 ? (Number(row[idxForraje]) || undefined) : undefined,
            geojson: null
          }))
          .filter(p => p.name && p.area_ha > 0)

        if (newPaddocks.length > 0) {
           const combined = [...data.paddocks, ...newPaddocks] as any[]
           updateData({ 
              paddocks: combined, 
              totalArea: parseFloat(combined.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) 
           } as any)
        }
      } catch (err: any) {
        alert("Error al leer el archivo: " + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const phase   = data.fieldBoundary ? 'paddock' : 'field'
  const hasField = !!data.fieldBoundary

  // Confirm the field boundary draft
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

  // Cancel field draft → allow redrawing
  const cancelField = () => {
    draftShape?.layer?.remove?.()
    updateData({ _draftShape: null } as any)
  }

  // Remove field → reset everything
  const resetField = () => {
    updateData({ fieldBoundary: null, fieldBoundaryHa: 0, paddocks: [], totalArea: 0, _draftShape: null } as any)
  }

  // Confirm a paddock draft (auto-named by page.tsx, user can rename inline)
  const removeLastPaddock = () => {
    const updated = data.paddocks.slice(0, -1)
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
  }

  const removePaddock = (idx: number) => {
    const updated = data.paddocks.filter((_, i) => i !== idx)
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
  }

  const renamePaddock = (idx: number, name: string) => {
    const updated = data.paddocks.map((p, i) => i === idx ? { ...p, name } : p)
    updateData({ paddocks: updated })
  }

  const setForrajePaddock = (idx: number, val: string) => {
    const updated = data.paddocks.map((p, i) =>
      i === idx ? { ...p, dry_matter_kg_ha: val === '' ? undefined : Number(val) } : p
    )
    updateData({ paddocks: updated })
  }

  // Persist step to DB
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
    updateData({ skippedMap: !hasField })
    await persistStep(2)
    nextStep()
  }

  const handleSkip = async () => {
    updateData({ skippedMap: true })
    await persistStep(2)
    nextStep()
  }

  const canNext  = hasField || data.paddocks.length > 0
  const hasDraft = !!draftShape && !hasField

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
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

      {/* Scrollable content */}
      <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto min-h-0">

        {/* ── INSTRUCTIONS ── */}
        <div className="space-y-2.5">
          {/* Step A: Draw field boundary */}
          <div className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
            !hasField && !hasDraft
              ? 'bg-blue-50 border-blue-200'
              : hasDraft
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200 opacity-60'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-black text-xs ${
              hasField ? 'bg-green-500 text-white' : hasDraft ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
            }`}>
              {hasField ? <CheckCircle2 className="w-3.5 h-3.5" /> : hasDraft ? '!' : '1'}
            </div>
            <div className="flex-1 min-w-0">
              {hasField ? (
                <>
                  <p className="text-xs font-black text-green-700">Perímetro confirmado ✓</p>
                  <p className="text-[10px] text-green-600 font-normal mt-0.5">{data.fieldBoundaryHa.toFixed(1)} ha · {data.fieldName}</p>
                  <button onClick={resetField} className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors">
                    <RefreshCw className="w-2.5 h-2.5" /> Redibujar perímetro
                  </button>
                </>
              ) : hasDraft ? (
                <>
                  <p className="text-xs font-black text-amber-700">Perímetro dibujado</p>
                  <p className="text-[10px] text-amber-600 font-normal mt-0.5">{draftShape.area_ha.toFixed(1)} ha · Confirmá para guardar</p>
                  <div className="mt-2 space-y-2">
                    <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)}
                      placeholder="Nombre del campo"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 outline-none font-medium placeholder:text-gray-300" />
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
                </>
              ) : (
                <>
                  <p className="text-xs font-black text-blue-700">Dibujá el perímetro total</p>
                  <p className="text-[10px] text-blue-500 font-normal mt-0.5 leading-relaxed">
                    Hacé clic en el mapa para marcar los vértices. Cerrá el polígono en el primer punto.
                  </p>
                  {midDrawArea !== null && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
                      <Ruler className="w-3 h-3" /> {midDrawArea.toFixed(1)} ha (en progreso...)
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Step B: Add paddocks */}
          <AnimatePresence>
            {(hasField || data.paddocks.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                data.paddocks.length > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-black text-xs ${
                  data.paddocks.length > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
                }`}>
                  {data.paddocks.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
                </div>
                <div>
                  <p className="text-xs font-black text-gray-700">
                    {data.paddocks.length > 0 ? `${data.paddocks.length} potrero${data.paddocks.length !== 1 ? 's' : ''} agregado${data.paddocks.length !== 1 ? 's' : ''}` : 'Dividí en potreros (opcional)'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-normal mt-0.5">
                    {data.paddocks.length > 0
                      ? `${data.paddocks.reduce((s, p) => s + p.area_ha, 0).toFixed(1)} ha divididas`
                      : 'Seguí dibujando dentro del perímetro para agregar potreros'}
                  </p>
                  <button onClick={() => fileRef.current?.click()} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-50 transition-colors">
                    <Upload className="w-3 h-3"/> Importar potreros (Excel)
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Paddocks list */}
        <AnimatePresence>
          {data.paddocks.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Potreros</p>
              {data.paddocks.map((p, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className="bg-white border border-gray-100 rounded-xl group hover:border-green-100 overflow-hidden"
                >
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
                    <div className="w-3 h-3 shrink-0" />{/* spacer */}
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

        {/* Empty state / guide */}
        {!hasField && !hasDraft && data.paddocks.length === 0 && (
          <div className="border-2 border-dashed border-gray-100 rounded-2xl py-8 flex flex-col items-center gap-2 text-center">
            <PenLine className="w-8 h-8 text-gray-200" />
            <p className="text-xs font-bold text-gray-400">El perímetro aparecerá aquí</p>
            <p className="text-[10px] text-gray-300 font-normal">Dibujá el contorno en el mapa →</p>
            
            <div className="mt-4 flex flex-col items-center">
              <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest mb-2">O si ya lo tenés</span>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold rounded-lg hover:bg-green-100 transition-colors">
                <FileSpreadsheet className="w-3 h-3"/> Cargar potreros desde Excel
              </button>
            </div>
          </div>
        )}

        <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />

        {/* Skip warning */}
        <AnimatePresence>
          {showSkipWarning && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-black text-amber-800">¿Saltar sin dibujar?</p>
                <p className="text-amber-600 font-normal mt-0.5 leading-relaxed">Sin los límites del campo, no podrás ver el NDVI ni calcular la carga ganadera. Podés volver a configurarlo después.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSkip}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-lg hover:bg-amber-600 transition-all">
                    <SkipForward className="w-3 h-3" /> Saltar igual
                  </button>
                  <button onClick={() => setShowSkipWarning(false)}
                    className="px-3 py-1.5 bg-white text-amber-600 border border-amber-200 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-all">
                    Volver a dibujar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTAs */}
      <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
        {canNext ? (
          <button onClick={handleNext}
            className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20">
            Siguiente — Cargar hacienda <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button disabled
              className="w-full bg-gray-100 text-gray-400 font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed">
              Siguiente — Cargar hacienda <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center text-[10px] text-gray-400 font-normal">
              {hasDraft ? 'Confirmá el perímetro antes de continuar' : 'Dibujá al menos el perímetro total para continuar'}
            </p>
          </>
        )}
        {!showSkipWarning && (
          <button onClick={() => setShowSkipWarning(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold text-amber-500 hover:text-amber-600 transition-colors">
            <SkipForward className="w-3 h-3" /> Saltar este paso por ahora
          </button>
        )}
      </div>
    </div>
  )
}
