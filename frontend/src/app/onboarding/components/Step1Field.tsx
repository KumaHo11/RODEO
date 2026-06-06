'use client'

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useOnboarding } from '../OnboardingContext'
import { Loader2, ArrowRight, Search, MapPin, Trash2, Ruler, Map } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import turfArea from '@turf/area'
import { PADDOCK_COLORS } from './paddockColors'

type PaddockDrawMapProps = {
  center: [number, number]
  mode: 'field' | 'paddock'
  paddockCount: number
  onShapeDrawn: (geojson: any, layer: any) => void
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

export default function Step1Field() {
  const { data, updateData, nextStep } = useOnboarding()

  // ── Location search ─────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searching,   setSearching]   = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg,    setShowSugg]    = useState(false)
  const [mapCenter,   setMapCenter]   = useState<[number, number]>([-34.6037, -58.3816])

  // ── Auto-geolocation on mount ────────────────────────
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          setMapCenter(c)
          // Pre-fill location in context if not already set
          if (!data.location) {
            updateData({ location: { lat: c[0], lng: c[1], address: '' } })
          }
        },
        () => { /* Geolocation denied — keep Buenos Aires default */ },
        { timeout: 6000, enableHighAccuracy: false }
      )
    }
   
  }, [])

  // ── Drawing state ────────────────────────────────────
  // Phase: 'field' = draw the full property boundary first
  //        'paddock' = draw paddocks inside
  const phase = data.fieldBoundary ? 'paddock' : 'field'
  const [draft,      setDraft]     = useState<DraftShape | null>(null)
  const [draftName,  setDraftName] = useState('')

  // ── Location autocomplete ────────────────────────────
  React.useEffect(() => {
    if (searchQuery.length < 3) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
        )
        setSuggestions(await res.json())
        setShowSugg(true)
      } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  const selectSuggestion = (s: any) => {
    const c: [number, number] = [parseFloat(s.lat), parseFloat(s.lon)]
    setMapCenter(c)
    setSearchQuery(s.display_name)
    setShowSugg(false)
    updateData({ location: { lat: c[0], lng: c[1], address: s.display_name } })
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      )
      const r = await res.json()
      if (r?.length > 0) selectSuggestion(r[0])
    } catch {} finally { setSearching(false) }
  }

  // ── Map callbacks ─────────────────────────────────────
  const handleShapeDrawn = useCallback((geojson: any, layer: any) => {
    const area_ha = parseFloat((turfArea(geojson) / 10000).toFixed(2))
    setDraft({ geojson, area_ha, layer })
    setDraftName('')
  }, [])

  // Confirm drawn FIELD BOUNDARY
  const confirmField = () => {
    if (!draft) return
    updateData({
      fieldBoundary:   draft.geojson,
      fieldBoundaryHa: draft.area_ha,
      totalArea:       draft.area_ha, // used as fallback area
    })
    setDraft(null)
    setDraftName('')
  }

  const cancelDraft = () => { draft?.layer?.remove(); setDraft(null) }

  // Confirm drawn PADDOCK
  const confirmPaddock = () => {
    if (!draft || !draftName.trim()) return
    const updated = [...data.paddocks, {
      name:    draftName.trim(),
      geojson: draft.geojson,
      area_ha: draft.area_ha,
    }]
    updateData({
      paddocks:  updated,
      totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)),
    })
    setDraft(null)
    setDraftName('')
  }

  const removePaddock = (idx: number) => {
    const updated = data.paddocks.filter((_, i) => i !== idx)
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
  }

  // Reset field boundary (and its paddocks)
  const resetField = () => {
    updateData({ fieldBoundary: null, fieldBoundaryHa: 0, paddocks: [], totalArea: 0 })
    setDraft(null)
  }

  const isStep1Valid = data.paddocks.length > 0

  return (
    <div className="flex-1 flex flex-col py-6 px-8 bg-white overflow-hidden min-h-0">
      <div className="flex flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white min-h-0">

        {/* ══ COL 1 — Field form ══ */}
        <div className="w-[280px] shrink-0 p-8 flex flex-col border-r border-gray-100 bg-white">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1.5 tracking-tight">Registro del campo</h2>
            <p className="text-gray-400 text-xs leading-relaxed font-normal">
              Define nombre y ubicación. Luego delimitá el campo y sus potreros en el mapa.
            </p>
          </div>

          <div className="space-y-5 flex-grow">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Nombre del establecimiento</label>
              <input
                type="text"
                placeholder="Ej: La Posta"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300 font-normal"
                value={data.fieldName}
                onChange={e => updateData({ fieldName: e.target.value })}
              />
            </div>

            {/* Ubicación */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Ubicación</label>
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Ciudad, provincia o país..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-11 py-3 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300 font-normal"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 3 && setShowSugg(true)}
                />
                <button type="submit" disabled={searching}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${searchQuery ? 'bg-green-600 text-white' : 'text-gray-300'}`}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </form>
              <AnimatePresence>
                {showSugg && suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-4 py-3 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                        {s.display_name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Phase indicator */}
            <div className="space-y-2 pt-2">
              {/* Step A */}
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                phase === 'field'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  phase === 'paddock' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {phase === 'paddock' ? '✓' : '1'}
                </div>
                <div>
                  <p className={`text-[10px] font-bold tracking-wide uppercase ${
                    phase === 'field' ? 'text-blue-700' : 'text-gray-400'
                  }`}>Delimitá tu campo</p>
                  <p className="text-[10px] text-gray-400 font-normal mt-0.5">Dibujá el perímetro total</p>
                </div>
              </div>

              {/* Step B */}
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                phase === 'paddock'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-100 bg-gray-50 opacity-40'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  phase === 'paddock' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  2
                </div>
                <div>
                  <p className={`text-[10px] font-bold tracking-wide uppercase ${
                    phase === 'paddock' ? 'text-green-700' : 'text-gray-400'
                  }`}>Agregá los potreros</p>
                  <p className="text-[10px] text-gray-400 font-normal mt-0.5">Dibujá cada lote dentro</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ COL 2 — Map ══ */}
        <div className="flex-grow relative z-0 bg-gray-100">
          <PaddockDrawMap
            center={mapCenter}
            mode={phase}
            paddockCount={data.paddocks.length}
            onShapeDrawn={handleShapeDrawn}
          />

          {/* Tooltip — Phase 1: delimit field */}
          {phase === 'field' && !draft && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              className="absolute z-[1000] pointer-events-none"
              style={{ top: '73px', left: '46px' }}
            >
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

          {/* Tooltip — Phase 2: add paddocks */}
          {phase === 'paddock' && !draft && data.paddocks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="absolute z-[1000] pointer-events-none"
              style={{ top: '73px', left: '46px' }}
            >
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
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                className="absolute top-4 right-4 z-[1000] bg-white rounded-2xl shadow-xl border border-gray-100 w-64 p-5"
              >
                <h3 className="text-sm font-bold text-gray-900 mb-1 tracking-tight">Perímetro del campo</h3>
                <p className="text-[10px] text-gray-400 mb-5 font-normal">
                  Superficie total: <strong className="text-gray-700 font-bold">{draft.area_ha} ha</strong>
                </p>
                <div className="flex gap-2">
                  <button onClick={cancelDraft}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">
                    Cancelar
                  </button>
                  <button onClick={confirmField}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all">
                    Confirmar campo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal — name PADDOCK */}
          <AnimatePresence>
            {phase === 'paddock' && draft && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                className="absolute top-4 right-4 z-[1000] bg-white rounded-2xl shadow-xl border border-gray-100 w-64 p-5"
              >
                {/* Color swatch of this paddock */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: PADDOCK_COLORS[data.paddocks.length % PADDOCK_COLORS.length] }}
                  />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Nuevo potrero</h3>
                </div>
                <p className="text-[10px] text-gray-400 mb-4 font-normal">
                  Área calculada: <strong className="text-gray-700 font-bold">{draft.area_ha} ha</strong>
                </p>
                <div className="space-y-1.5 mb-4">
                  <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Nombre del potrero</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ej: Lote Norte"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none placeholder:text-gray-300 font-normal"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmPaddock()}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelDraft}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">
                    Cancelar
                  </button>
                  <button onClick={confirmPaddock} disabled={!draftName.trim()}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all disabled:opacity-30">
                    Confirmar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══ COL 3 — Right panel ══ */}
        <div className="w-[280px] shrink-0 flex flex-col border-l border-gray-100 bg-white">

          {/* ── CAMPO card ── */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-[10px] font-bold text-blue-700 tracking-widest uppercase">Campo total</p>
                </div>
                {data.fieldBoundary && (
                  <button onClick={resetField}
                    className="text-[9px] font-bold text-red-400 hover:text-red-600 transition-colors uppercase tracking-wide">
                    Redibujar
                  </button>
                )}
              </div>

              {data.fieldBoundary ? (
                <div>
                  <p className="text-2xl font-bold text-blue-700 leading-none">{data.fieldBoundaryHa.toFixed(1)}</p>
                  <p className="text-[10px] text-blue-400 font-normal mt-0.5">hectáreas delimitadas</p>
                  {data.fieldName && (
                    <p className="text-xs font-bold text-blue-900 mt-2">{data.fieldName}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                    <Map className="w-4 h-4 text-blue-300" />
                  </div>
                  <p className="text-[10px] font-bold text-blue-400">Sin delimitar</p>
                  <p className="text-[9px] text-blue-300 font-normal mt-0.5">Dibujá el perímetro en el mapa</p>
                </div>
              )}
            </div>
          </div>

          {/* ── POTREROS section ── */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-green-600" />
            <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
              Potreros — {data.paddocks.length} registrado{data.paddocks.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Paddock cards — scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            <AnimatePresence>
              {data.paddocks.map((p, idx) => (
                <motion.div key={idx}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all"
                  style={{
                    borderLeftColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length],
                    borderLeftWidth: 3,
                    backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] + '10',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: PADDOCK_COLORS[idx % PADDOCK_COLORS.length] }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-normal">{p.area_ha} ha</p>
                    </div>
                  </div>
                  <button onClick={() => removePaddock(idx)}
                    className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {data.paddocks.length === 0 && data.fieldBoundary && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                  <MapPin className="w-4 h-4 text-gray-200" />
                </div>
                <p className="text-xs font-bold text-gray-400">Sin potreros aún</p>
                <p className="text-[10px] text-gray-300 font-normal mt-0.5">Dibujá uno dentro del campo</p>
              </div>
            )}

            {!data.fieldBoundary && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-[10px] text-gray-300 font-normal">
                  Primero delimitá el campo para agregar potreros
                </p>
              </div>
            )}
          </div>

          {/* ── Totals + Next ── */}
          <div className="px-5 pt-4 pb-5 border-t border-gray-100 space-y-3 bg-white">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Área en potreros</p>
                <p className="text-[10px] text-gray-400 font-normal mt-0.5">{data.paddocks.length} potrero{data.paddocks.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-green-600 leading-none">
                  {data.paddocks.reduce((s, p) => s + p.area_ha, 0).toFixed(1)}
                </p>
                <p className="text-[10px] text-gray-400 font-normal">ha</p>
              </div>
            </div>

            <button
              onClick={nextStep}
              disabled={!isStep1Valid}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-25 flex items-center justify-center gap-2 text-sm"
            >
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
