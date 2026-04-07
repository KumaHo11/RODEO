'use client'

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import { Search, Loader2, ArrowRight, MapPin, Building2, Navigation, Upload, LocateFixed, X, Crosshair } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Step1LiveMapProps = {
  location: { lat: number; lng: number } | null
  onMapClick?: (lat: number, lng: number) => void
}

const Step1LiveMap = dynamic<Step1LiveMapProps>(() => import('./Step1LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-7 h-7 text-green-500 animate-spin" />
      <p className="text-[10px] font-bold text-gray-400 tracking-widest">Cargando mapa...</p>
    </div>
  ),
})

// ─────────────────────────────────────────────────────────────────
// KML/GeoJSON parser — returns { lat, lng, address }
// ─────────────────────────────────────────────────────────────────
async function parseSpatialFile(file: File): Promise<{ lat: number; lng: number; address: string } | null> {
  const text = await file.text()
  const name = file.name.toLowerCase()

  try {
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      const gj = JSON.parse(text)
      const coords = gj.features?.[0]?.geometry?.coordinates?.[0]?.[0]
        ?? gj.geometry?.coordinates?.[0]?.[0]
        ?? null
      if (coords && coords.length >= 2) {
        const lng = coords[0], lat = coords[1]
        return { lat, lng, address: `Importado desde ${file.name}` }
      }
    }

    if (name.endsWith('.kml')) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/xml')
      const coords = doc.querySelector('coordinates')?.textContent?.trim().split(/\s+/)[0]
      if (coords) {
        const [lng, lat] = coords.split(',').map(Number)
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, address: `Importado desde ${file.name}` }
        }
      }
    }
  } catch {}

  return null
}

export default function Step1Location() {
  const { data, updateData, nextStep } = useOnboarding()
  const { user } = useAuth()

  // ── Location states ────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(data.location?.address || '')
  const [searching,   setSearching]   = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg,    setShowSugg]    = useState(false)

  // Input mode: 'search' | 'coords' | 'file'
  const [inputMode, setInputMode] = useState<'search' | 'coords' | 'file'>('search')
  const [latInput, setLatInput]   = useState(data.location?.lat?.toString() || '')
  const [lngInput, setLngInput]   = useState(data.location?.lng?.toString() || '')
  const [fileError, setFileError] = useState('')
  const [geolocating, setGeolocating] = useState(false)

  // ── Nominatim autocomplete ─────────────────────────────────────
  React.useEffect(() => {
    if (inputMode !== 'search') return
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
  }, [searchQuery, inputMode])

  const selectSuggestion = (s: any) => {
    const lat = parseFloat(s.lat)
    const lng = parseFloat(s.lon)
    setSearchQuery(s.display_name)
    setShowSugg(false)
    updateData({ location: { lat, lng, address: s.display_name } })
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

  // ── GPS geolocation ────────────────────────────────────────────
  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        // Reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          )
          const r = await res.json()
          const address = r.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          updateData({ location: { lat, lng, address } })
          setSearchQuery(address)
          setInputMode('search')
        } catch {
          updateData({ location: { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` } })
        }
        setGeolocating(false)
      },
      () => setGeolocating(false),
      { timeout: 8000 }
    )
  }

  // ── Map click handler ──────────────────────────────────────────
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    // Reverse geocode the click
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      )
      const r = await res.json()
      const address = r.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      updateData({ location: { lat, lng, address } })
      setSearchQuery(address)
      setInputMode('search')
    } catch {
      updateData({ location: { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` } })
    }
  }, [updateData])

  // ── Coordinate mode ────────────────────────────────────────────
  const applyCoords = () => {
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (isNaN(lat) || isNaN(lng)) return
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    updateData({ location: { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` } })
  }

  // ── File upload (KML / GeoJSON) ────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) return
    const result = await parseSpatialFile(file)
    if (result) {
      updateData({ location: result })
      setInputMode('search')
      setSearchQuery(result.address)
    } else {
      setFileError('No se pudo leer el archivo. Asegurate de que es un .kml o .geojson válido.')
    }
    e.target.value = ''
  }

  const isValid = !!(data.fieldName.trim() && data.location)

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden">

      {/* ══ LEFT PANEL — Form ═══════════════════════════════════════ */}
      <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col bg-white border-r border-gray-100 overflow-y-auto">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Paso 1 de 3</p>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Identificá tu establecimiento</h2>
          <p className="text-sm text-gray-500 mt-1">Nombre y ubicación de tu campo en el mapa</p>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1">

          {/* ── Field name ──────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
              <Building2 className="w-3 h-3" /> Nombre del establecimiento
            </label>
            <input
              type="text"
              placeholder="Ej: La Posta, Estancia El Ombú..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all placeholder:text-gray-300"
              value={data.fieldName}
              onChange={e => updateData({ fieldName: e.target.value })}
              autoFocus
            />
          </div>

          {/* ── Location mode tabs ──────────────────────────────── */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
              <MapPin className="w-3 h-3" /> Ubicación
            </label>

            {/* Mode selector */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 divide-x divide-gray-200">
              {[
                { id: 'search', icon: Search,     label: 'Buscar'      },
                { id: 'coords', icon: Crosshair,  label: 'Coordenadas' },
                { id: 'file',   icon: Upload,     label: 'KML/GeoJSON' },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setInputMode(m.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black transition-all ${
                    inputMode === m.id
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                  }`}
                >
                  <m.icon className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>

            {/* ── SEARCH MODE ─────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {inputMode === 'search' && (
                <motion.div key="search" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                  <div className="relative">
                    <form onSubmit={handleSearch}>
                      <input
                        type="text"
                        placeholder="Ciudad, partido, provincia..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all placeholder:text-gray-300"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); if (data.location) updateData({ location: null }) }}
                        onFocus={() => searchQuery.length >= 3 && setShowSugg(true)}
                        onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                      />
                      <button
                        type="submit"
                        disabled={searching}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg transition-all ${
                          searchQuery ? 'bg-green-600 text-white hover:bg-green-700' : 'text-gray-300'
                        }`}
                      >
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </form>

                    {/* Suggestions */}
                    <AnimatePresence>
                      {showSugg && suggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
                        >
                          {suggestions.map((s, i) => (
                            <button
                              key={i} type="button" onMouseDown={() => selectSuggestion(s)}
                              className="w-full text-left px-4 py-3 text-xs text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors border-b border-gray-50 last:border-0 font-normal"
                            >
                              <span className="flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-gray-300 shrink-0" />
                                <span className="line-clamp-1">{s.display_name}</span>
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* GPS button */}
                  <button
                    type="button" onClick={handleGeolocate} disabled={geolocating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-green-300 rounded-xl text-xs font-bold text-green-600 hover:bg-green-50 hover:border-green-400 transition-all disabled:opacity-50"
                  >
                    {geolocating
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Obteniendo ubicación...</>
                      : <><LocateFixed className="w-3.5 h-3.5" /> Usar mi ubicación actual</>}
                  </button>
                </motion.div>
              )}

              {/* ── COORDS MODE ──────────────────────────────── */}
              {inputMode === 'coords' && (
                <motion.div key="coords" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Latitud</label>
                      <input
                        type="number" step="any" placeholder="-34.6037"
                        value={latInput} onChange={e => setLatInput(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none placeholder:text-gray-300 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Longitud</label>
                      <input
                        type="number" step="any" placeholder="-60.5"
                        value={lngInput} onChange={e => setLngInput(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none placeholder:text-gray-300 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button" onClick={applyCoords}
                    disabled={!latInput || !lngInput}
                    className="w-full py-2.5 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Fijar punto central
                  </button>
                  <p className="text-[10px] text-gray-400 font-normal text-center">
                    También podés hacer click directo en el mapa →
                  </p>
                </motion.div>
              )}

              {/* ── FILE MODE ────────────────────────────────── */}
              {inputMode === 'file' && (
                <motion.div key="file" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <label className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-all group">
                    <Upload className="w-6 h-6 text-gray-300 group-hover:text-green-500 transition-colors" />
                    <div className="text-center">
                      <p className="text-xs font-black text-gray-500 group-hover:text-green-700 transition-colors">Subir archivo .kml o .geojson</p>
                      <p className="text-[10px] text-gray-400 font-normal mt-0.5">El sistema extrae la ubicación central automáticamente</p>
                    </div>
                    <input type="file" accept=".kml,.geojson,.json" className="hidden" onChange={handleFile} />
                  </label>
                  {fileError && (
                    <p className="text-[10px] text-red-500 font-bold flex items-center gap-1.5">
                      <X className="w-3 h-3 shrink-0" /> {fileError}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 font-normal text-center">
                    KML es el formato estándar de Google Earth y muchos GPS agrícolas.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Location confirmation chip */}
            <AnimatePresence>
              {data.location && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl"
                >
                  <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <p className="text-[10px] font-bold text-green-700 leading-snug line-clamp-2 flex-1">
                    {data.location.address}
                  </p>
                  <button
                    type="button"
                    onClick={() => { updateData({ location: null }); setSearchQuery('') }}
                    className="w-4 h-4 flex items-center justify-center text-green-400 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <div className="px-6 py-5 border-t border-gray-100 shrink-0 space-y-2">
          <button
            onClick={() => { if (isValid) nextStep() }}
            disabled={!isValid}
            className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-30 disabled:grayscale text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
          {!isValid && (
            <p className="text-center text-[10px] text-gray-400 font-normal">
              Completá el nombre y la ubicación para continuar
            </p>
          )}
        </div>
      </div>

      {/* ══ RIGHT PANEL — Live Map ══════════════════════════════════ */}
      <div className="flex-1 relative min-h-[300px] lg:min-h-0 bg-gray-900">
        <Step1LiveMap
          location={data.location}
          onMapClick={handleMapClick}
        />

        {/* Map instructions overlay — top right */}
        <div className="absolute top-3 right-3 z-[1000] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl px-3 py-2 shadow-md">
            <p className="text-[10px] font-black text-gray-600 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-green-500" />
              Vista satelital en tiempo real
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
