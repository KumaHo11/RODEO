'use client'

/**
 * Step2Panel2 — Paso 2: Delimitación de potreros (v2)
 *
 * Cambios respecto al original:
 *  - Si el usuario cargó un KML en el paso 1, muestra un estado de éxito
 *    y los polígonos ya están instanciados en el mapa (el singleton los recibe)
 *  - Botón "Siguiente" SIEMPRE habilitado (no bloquea)
 *  - Botón "Saltar este paso" siempre visible en el footer como acción secundaria
 *  - Aviso inline sobre NDVI cuando no hay potreros (no modal)
 *  - Si el KML tiene errores de superposición, muestra el error con opción de dibujar
 */

import React, { useState } from 'react'
import { useOnboarding2 } from '../OnboardingContext2'
import { useAuth } from '@/components/AuthProvider'
import {
  ArrowRight, ArrowLeft, Trash2, Ruler, MapPin,
  AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, PenLine, Plus, Upload, Map, Info,
  Satellite, CloudSun,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PADDOCK_COLORS } from '@/app/onboarding/components/paddockColors'
import * as XLSX from 'xlsx'
import { parseKmlFile } from '@/lib/kmlParser'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

interface Props {
  midDrawArea: number | null
  onKmlParsed?: (features: ParsedKmlFeature[]) => void
}

export default function Step2Panel2({ midDrawArea, onKmlParsed }: Props) {
  const { data, updateData, nextStep, prevStep } = useOnboarding2()
  const { user } = useAuth()

  const draftShape = (data as any)._draftShape ?? null
  const [draftName, setDraftName] = useState(data.fieldName || '')
  const fileRef    = React.useRef<HTMLInputElement>(null)
  const kmlFileRef = React.useRef<HTMLInputElement>(null)
  const [kmlLoading, setKmlLoading] = useState(false)
  const [kmlError, setKmlError]     = useState<string | null>(null)
  const [kmlCount, setKmlCount]     = useState(0)

  const hasField  = !!data.fieldBoundary
  const hasDraft  = !!draftShape && !hasField
  const hasPaddocks = data.paddocks.length > 0
  const kmlFromStep1 = data.kmlLoadedInStep1

  // ── Excel upload ────────────────────────────────────────────────────────
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const excelData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' })
        if (excelData.length < 2) throw new Error('Sin datos')

        const rawHeaders = excelData[0].map((h: any) => String(h ?? '').trim().toLowerCase())
        const idxName    = rawHeaders.findIndex((h: string) => h.includes('nombre') || h.includes('potrero') || h.includes('lote'))
        const idxArea    = rawHeaders.findIndex((h: string) => h.includes('ha') || h.includes('hectarea') || h.includes('area'))
        const idxForraje = rawHeaders.findIndex((h: string) => h.includes('forraje') || h.includes('ms') || h.includes('materia seca'))

        if (idxName === -1 || idxArea === -1) {
          alert('El Excel debe tener columnas de Nombre y Hectáreas.')
          return
        }

        const newPaddocks = excelData.slice(1)
          .filter((row: any) => row[idxName] && row[idxArea])
          .map((row: any) => ({
            name: String(row[idxName]).trim(),
            area_ha: Number(row[idxArea]) || 0,
            dry_matter_kg_ha: idxForraje !== -1 ? (Number(row[idxForraje]) || undefined) : undefined,
            geojson: null,
          }))
          .filter((p: any) => p.name && p.area_ha > 0)

        if (newPaddocks.length > 0) {
          const combined = [...data.paddocks, ...newPaddocks] as any[]
          updateData({
            paddocks: combined,
            totalArea: parseFloat(combined.reduce((s: number, p: any) => s + p.area_ha, 0).toFixed(2)),
          } as any)
        }
      } catch (err: any) {
        alert('Error al leer el archivo: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── KML upload (adicional, en el paso 2 se puede cargar otro KML) ────────
  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setKmlLoading(true)
    setKmlError(null)
    const result = await parseKmlFile(file)
    setKmlLoading(false)
    if (kmlFileRef.current) kmlFileRef.current.value = ''
    if (result.error) {
      setKmlError(result.error)
      setKmlCount(0)
      return
    }
    setKmlCount(result.features.length)
    onKmlParsed?.(result.features)
  }

  // ── Field boundary handlers ──────────────────────────────────────────────
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
    const updated = data.paddocks.map((p, i) => i === idx ? { ...p, name } : p)
    updateData({ paddocks: updated })
  }

  // ── Persist step + navigate ──────────────────────────────────────────────
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
    updateData({ skippedMap: !hasField && !hasPaddocks })
    await persistStep(2)
    nextStep()
  }

  const handleSkip = async () => {
    updateData({ skippedMap: true })
    await persistStep(2)
    nextStep()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
              Paso 2 de 3 · Delimitación
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

      {/* Scrollable content */}
      <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto min-h-0">

        {/* ── KML cargado desde paso 1 ──────────────────────────────────── */}
        {kmlFromStep1 && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-green-800">
                KML cargado — {data.kmlFeaturesFromStep1?.length ?? 0} polígono{(data.kmlFeaturesFromStep1?.length ?? 0) !== 1 ? 's' : ''} en el mapa
              </p>
              <p className="text-[10px] text-green-600 font-normal mt-0.5 leading-relaxed">
                Hacé clic en cada polígono del mapa para confirmar el nombre de cada potrero.
              </p>
            </div>
          </div>
        )}

        {/* ── Estado de dibujo del perímetro ───────────────────────────── */}
        {!kmlFromStep1 && (
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
                  <p className="text-[10px] text-green-600 font-normal mt-0.5">
                    {data.fieldBoundaryHa.toFixed(1)} ha · {data.fieldName}
                  </p>
                  <button
                    onClick={resetField}
                    className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Redibujar perímetro
                  </button>
                </>
              ) : hasDraft ? (
                <>
                  <p className="text-xs font-black text-amber-700">Perímetro dibujado</p>
                  <p className="text-[10px] text-amber-600 font-normal mt-0.5">
                    {draftShape.area_ha.toFixed(1)} ha · Confirmá para guardar
                  </p>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      placeholder="Nombre del campo"
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 outline-none font-medium placeholder:text-gray-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={confirmField}
                        disabled={!draftName.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 text-white text-[10px] font-black rounded-lg hover:bg-green-700 transition-all disabled:opacity-30"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Confirmar perímetro
                      </button>
                      <button
                        onClick={cancelField}
                        className="px-3 py-1.5 border border-gray-200 text-gray-500 text-[10px] font-bold rounded-lg hover:bg-gray-50 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-black text-blue-700">Dibujá el perímetro exterior (opcional)</p>
                  <p className="text-[10px] text-blue-500 font-normal mt-0.5 leading-relaxed">
                    Hacé clic en el mapa para marcar los vértices y cerrar el polígono.
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
        )}

        {/* ── Potreros agregados ───────────────────────────────────────── */}
        {data.paddocks.length > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1.5"
            >
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                Potreros ({data.paddocks.length})
              </p>
              {data.paddocks.map((p, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white border border-gray-100 rounded-xl hover:border-green-100 overflow-hidden transition-all"
                >
                  <div className="flex items-center gap-2 p-2.5">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] }}
                    />
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => renamePaddock(idx, e.target.value)}
                      className="flex-1 text-xs font-bold text-gray-700 bg-transparent outline-none focus:bg-gray-50 rounded px-1 py-0.5 min-w-0"
                    />
                    <span className="text-[10px] font-black text-gray-400 shrink-0">
                      {p.area_ha.toFixed(1)} ha
                    </span>
                    <button
                      onClick={() => removePaddock(idx)}
                      className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Estado vacío: acciones alternativas ─────────────────────── */}
        {!hasField && !hasDraft && data.paddocks.length === 0 && !kmlFromStep1 && (
          <div className="border-2 border-dashed border-gray-100 rounded-2xl py-6 flex flex-col items-center gap-2 text-center">
            <PenLine className="w-7 h-7 text-gray-200" />
            <p className="text-xs font-bold text-gray-400">Dibujá en el mapa o importá</p>
            <div className="mt-2 flex flex-col items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold rounded-lg hover:bg-green-100 transition-colors"
              >
                <Upload className="w-3 h-3" /> Importar desde Excel
              </button>
              <button
                onClick={() => kmlFileRef.current?.click()}
                disabled={kmlLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-bold rounded-lg hover:bg-cyan-100 transition-colors disabled:opacity-50"
              >
                {kmlLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Procesando...</>
                  : <><Map className="w-3 h-3" /> Importar desde KML</>
                }
              </button>
              {kmlError && (
                <div className="max-w-[240px] text-left">
                  <p className="text-[10px] text-red-600 font-bold flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    {kmlError}
                  </p>
                  <p className="text-[10px] text-gray-400 font-normal mt-1">
                    Podés dibujar los potreros manualmente en el mapa.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Aviso NDVI cuando no hay potreros ───────────────────────── */}
        {!hasPaddocks && !kmlFromStep1 && (
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="shrink-0 mt-0.5">
              <Info className="w-4 h-4 text-amber-500" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-amber-800">Sin potreros, algunas métricas no estarán disponibles</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Satellite className="w-3 h-3 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-700 font-normal">
                    <strong className="font-black">No disponible:</strong> NDVI, vigor de fotosíntesis, métricas satelitales por potrero
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CloudSun className="w-3 h-3 text-green-500 shrink-0" />
                  <p className="text-[10px] text-green-700 font-normal">
                    <strong className="font-black">Sí disponible:</strong> Datos climáticos de tu zona, temperatura, precipitaciones
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-amber-600 font-normal leading-relaxed">
                Podés delimitar los potreros después desde el panel de gestión de tu campo.
              </p>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
        <input type="file" ref={kmlFileRef} accept=".kml" className="hidden" onChange={handleKmlUpload} />

        {/* KML status desde el paso 2 */}
        {kmlCount > 0 && (
          <p className="text-[10px] text-cyan-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {kmlCount} polígono{kmlCount !== 1 ? 's' : ''} cargado{kmlCount !== 1 ? 's' : ''} — hacé clic en el mapa para confirmarlos
          </p>
        )}
      </div>

      {/* ── Footer CTAs ───────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
        <button
          onClick={handleNext}
          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
        >
          Continuar — Registrar hacienda <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={handleSkip}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 text-[11px] font-bold rounded-xl transition-all"
        >
          Saltar este paso por ahora
        </button>
      </div>
    </div>
  )
}
