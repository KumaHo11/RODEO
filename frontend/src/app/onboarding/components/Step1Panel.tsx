'use client'

/**
 * Step1Panel — Left panel content for Step 1 (Ubicación).
 * The map is the singleton in page.tsx. This panel only handles:
 *  - Field name input
 *  - Search / GPS / Coordinates / KML-file location input
 *  - Passes location back via OnboardingContext
 * 
 * The map reacts because page.tsx reads data.location from context.
 */

import React, { useState, useCallback } from 'react'
import { useOnboarding } from '../OnboardingContext'
import {
  Search, Loader2, ArrowRight, MapPin, Building2,
  Upload, LocateFixed, X, CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseKmlFile } from '@/lib/kmlParser'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

// ─── KML / GeoJSON file extractor ─────────────────────────────────────────────
async function parseSpatialFile(file: File): Promise<{ lat: number; lng: number; address: string } | null> {
  const text = await file.text()
  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      const gj = JSON.parse(text)
      const c = gj.features?.[0]?.geometry?.coordinates?.[0]?.[0] ?? gj.geometry?.coordinates?.[0]?.[0] ?? null
      if (c?.length >= 2) return { lat: c[1], lng: c[0], address: `Importado desde ${file.name}` }
    }
    if (name.endsWith('.kml')) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/xml')
      const raw = doc.querySelector('coordinates')?.textContent?.trim().split(/\s+/)[0]
      if (raw) {
        const [lng, lat] = raw.split(',').map(Number)
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, address: `Importado desde ${file.name}` }
      }
    }
  } catch {}
  return null
}

interface Step1PanelProps {
  /** Called when a KML file is uploaded and successfully parsed (so Step 2 can pre-load paddocks) */
  onKmlFeaturesLoaded?: (features: ParsedKmlFeature[]) => void
}

export default function Step1Panel({ onKmlFeaturesLoaded }: Step1PanelProps) {
  const { data, updateData, nextStep } = useOnboarding()

  const [searchQuery, setSearchQuery] = useState(data.location?.address || '')
  const [searching,   setSearching]   = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg,    setShowSugg]    = useState(false)
  const [inputMode,   setInputMode]   = useState<'search' | 'file'>('search')
  const [fileError,   setFileError]   = useState('')
  const [kmlLoaded,   setKmlLoaded]   = useState<{ count: number; name: string } | null>(null)
  const [geolocating, setGeolocating] = useState(false)

  // Nominatim autocomplete
  React.useEffect(() => {
    if (inputMode !== 'search' || searchQuery.length < 3) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`)
        setSuggestions(await res.json())
        setShowSugg(true)
      } catch {}
    }, 450)
    return () => clearTimeout(t)
  }, [searchQuery, inputMode])

  const selectSuggestion = (s: any) => {
    const lat = parseFloat(s.lat), lng = parseFloat(s.lon)
    setSearchQuery(s.display_name); setShowSugg(false)
    updateData({ location: { lat, lng, address: s.display_name } })
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`)
      const r = await res.json()
      if (r?.length > 0) selectSuggestion(r[0])
    } catch {} finally { setSearching(false) }
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          const j = await r.json()
          if (j.display_name) address = j.display_name
        } catch {}
        updateData({ location: { lat, lng, address } })
        setSearchQuery(address); setInputMode('search'); setGeolocating(false)
      },
      () => setGeolocating(false),
      { timeout: 8000 }
    )
  }


  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    setKmlLoaded(null)
    const file = e.target.files?.[0]; if (!file) return
    // 1. Extract location centroid
    const result = await parseSpatialFile(file)
    if (result) { updateData({ location: result }); setSearchQuery(result.address) }
    else { setFileError('No se pudo leer el archivo. Asegurate de que es un .kml o .geojson válido.') }
    // 2. If KML, also parse full features so Step 2 can pre-load paddocks
    if (file.name.toLowerCase().endsWith('.kml')) {
      const parsed = await parseKmlFile(file)
      if (!parsed.error && parsed.features.length > 0) {
        onKmlFeaturesLoaded?.(parsed.features)
        setKmlLoaded({ count: parsed.features.length, name: file.name })
        setInputMode('search') // switch back to search view showing the location
      }
    }
    e.target.value = ''
  }

  const isValid = !!(data.fieldName.trim() && data.location)

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Paso 1 de 3 · Identificación</p>
        <h2 className="text-xl font-black text-gray-900 tracking-tight">Ubicá tu campo</h2>
        <p className="text-sm text-gray-500 mt-1">El mapa se va a centrar en la ubicación que elijas</p>
      </div>

      <div className="px-6 py-5 space-y-5 flex-1">

        {/* Field name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
            <Building2 className="w-3 h-3" /> Nombre del establecimiento
          </label>
          <input
            type="text" autoFocus
            placeholder="Ej: La Posta, Estancia El Ombú..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all placeholder:text-gray-300"
            value={data.fieldName}
            onChange={e => updateData({ fieldName: e.target.value })}
          />
        </div>

        {/* Mode tabs */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
            <MapPin className="w-3 h-3" /> Ubicación
          </label>

          <div className="flex rounded-xl overflow-hidden border border-gray-200 divide-x divide-gray-200">
            {([
              { id: 'search', icon: Search, label: 'Buscar en el mapa' },
              { id: 'file',   icon: Upload, label: 'Subir archivo KML' },
            ] as const).map(m => (
              <button key={m.id} type="button" onClick={() => setInputMode(m.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black transition-all ${
                  inputMode === m.id ? 'bg-green-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}>
                <m.icon className="w-3 h-3 shrink-0" /><span>{m.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* SEARCH */}
            {inputMode === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                <div className="relative">
                  <form onSubmit={handleSearch}>
                    <input type="text" placeholder="Ciudad, partido, provincia..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all placeholder:text-gray-300"
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); if (data.location) updateData({ location: null }) }}
                      onFocus={() => searchQuery.length >= 3 && setShowSugg(true)}
                      onBlur={() => setTimeout(() => setShowSugg(false), 200)} />
                    <button type="submit" disabled={searching}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg transition-all ${searchQuery ? 'bg-green-600 text-white hover:bg-green-700' : 'text-gray-300'}`}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </form>
                  <AnimatePresence>
                    {showSugg && suggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button key={i} type="button" onMouseDown={() => selectSuggestion(s)}
                            className="w-full text-left px-4 py-3 text-xs text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors border-b border-gray-50 last:border-0">
                            <span className="flex items-center gap-2"><MapPin className="w-3 h-3 text-gray-300 shrink-0" /><span className="line-clamp-1">{s.display_name}</span></span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button type="button" onClick={handleGeolocate} disabled={geolocating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-green-300 rounded-xl text-xs font-bold text-green-600 hover:bg-green-50 hover:border-green-400 transition-all disabled:opacity-50">
                  {geolocating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Obteniendo ubicación...</> : <><LocateFixed className="w-3.5 h-3.5" /> Usar mi ubicación actual</>}
                </button>
              </motion.div>
            )}


            {/* FILE */}
            {inputMode === 'file' && (
              <motion.div key="file" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <label className="flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-all group">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-green-50 border border-gray-100 group-hover:border-green-200 flex items-center justify-center transition-all">
                    <Upload className="w-7 h-7 text-gray-300 group-hover:text-green-500 transition-colors" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-black text-gray-600 group-hover:text-green-700 transition-colors">Subir archivo KML</p>
                    <p className="text-xs text-gray-400 font-normal">Arrastrá o hacé clic para seleccionar</p>
                    <p className="text-[10px] text-gray-300 font-normal">Soporta .kml y .geojson — la ubicación se extrae automáticamente</p>
                  </div>
                  <input type="file" accept=".kml,.geojson,.json" className="hidden" onChange={handleFile} />
                </label>
                {fileError && <p className="text-[10px] text-red-500 font-bold flex items-center gap-1.5"><X className="w-3 h-3 shrink-0" />{fileError}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* KML loaded badge */}
          <AnimatePresence>
            {kmlLoaded && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-green-700">
                    {kmlLoaded.count} potrero{kmlLoaded.count !== 1 ? 's' : ''} detectado{kmlLoaded.count !== 1 ? 's' : ''} en el KML
                  </p>
                  <p className="text-[10px] text-green-600 font-normal mt-0.5">
                    En el paso 2 van a aparecer marcados en el mapa automáticamente.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Location confirmation chip */}
          <AnimatePresence>
            {data.location && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <p className="text-[10px] font-bold text-green-700 leading-snug line-clamp-2 flex-1">{data.location.address}</p>
                <button type="button" onClick={() => { updateData({ location: null }); setSearchQuery('') }}
                  className="w-4 h-4 flex items-center justify-center text-green-400 hover:text-red-400 transition-colors shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 py-5 border-t border-gray-100 shrink-0 space-y-2">
        <button onClick={() => { if (isValid) nextStep() }} disabled={!isValid}
          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-30 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20">
          Siguiente — Delimitar el campo <ArrowRight className="w-4 h-4" />
        </button>
        {!isValid && (
          <p className="text-center text-[10px] text-gray-400 font-normal">
            Completá el nombre y fijá la ubicación en el mapa para continuar
          </p>
        )}
      </div>
    </div>
  )
}
