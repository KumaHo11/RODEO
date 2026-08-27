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
  LocateFixed, X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import OnboardingTour from '@/components/OnboardingTour'
import { Step } from 'react-joyride'

export default function Step1Panel() {
  const { data, updateData, nextStep } = useOnboarding()

  const [searchQuery, setSearchQuery] = useState(data.location?.address || '')
  const [searching,   setSearching]   = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg,    setShowSugg]    = useState(false)
  const [geolocating, setGeolocating] = useState(false)

  // Nominatim autocomplete
  React.useEffect(() => {
    if (searchQuery.length < 3) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`)
        setSuggestions(await res.json())
        setShowSugg(true)
      } catch {}
    }, 450)
    return () => clearTimeout(t)
  }, [searchQuery])

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
        setSearchQuery(address); setGeolocating(false)
      },
      () => setGeolocating(false),
      { timeout: 8000 }
    )
  }


  const isValid = !!(data.fieldName.trim() && data.location)

  const tourSteps: Step[] = [
    {
      target: '.tour-nombre-campo',
      title: 'Nombre de tu campo',
      content: 'Escribí el nombre de tu establecimiento o campo. Este será el nombre visible de tu organización.',
      skipBeacon: true,
      placement: 'bottom' as const,
    },
    {
      target: '.tour-ubicacion',
      title: 'Ubicación exacta',
      content: 'Buscá la ciudad o provincia más cercana. Después podés mover el pin en el mapa para ubicar tu campo con precisión.',
      placement: 'bottom' as const,
    }
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <OnboardingTour tourId="onboarding-step1-v1" steps={tourSteps} />

      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b md:border-b border-gray-100 shrink-0">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Paso 1 de 3 · Identificación</p>
        <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Ubicá tu campo</h2>
        <p className="text-xs md:text-sm text-gray-500 mt-1">El mapa se va a centrar en la ubicación que elijas</p>
      </div>

      <div className="px-4 md:px-6 py-4 md:py-5 flex-1">

        {/* ── Card wrapper for form fields ── */}
        <div className="rounded-2xl border-2 border-green-100 md:border-gray-200 bg-white shadow-sm p-4 md:p-5 space-y-4 md:space-y-5">

          {/* Field name */}
          <div className="tour-nombre-campo space-y-2">
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
          <div className="tour-ubicacion space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
              <MapPin className="w-3 h-3" /> Ubicación
            </label>

            <div className="space-y-2">
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
            </div>

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

        </div>{/* end card */}
      </div>

      {/* CTA */}
      <div className="px-4 md:px-6 py-4 md:py-5 border-t border-gray-100 shrink-0 space-y-2">
        <button onClick={() => { if (isValid) nextStep() }} disabled={!isValid}
          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-30 text-white font-black py-3.5 md:py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20">
          Siguiente — Marcar potreros <ArrowRight className="w-4 h-4" />
        </button>
        {!isValid && (
          <p className="text-center text-[10px] text-gray-400 font-normal">
            Completá el nombre y fijá la ubicación para continuar
          </p>
        )}
      </div>
    </div>
  )
}
