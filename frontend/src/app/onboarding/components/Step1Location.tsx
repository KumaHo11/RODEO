'use client'

import React, { useState } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { useAuth } from '@/components/AuthProvider'
import { Search, Loader2, ArrowRight, MapPin, Building2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Step1Location() {
  const { data, updateData, nextStep } = useOnboarding()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery]  = useState(data.location?.address || '')
  const [searching,   setSearching]    = useState(false)
  const [suggestions, setSuggestions]  = useState<any[]>([])
  const [showSugg,    setShowSugg]     = useState(false)

  // Autocomplete
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

  // Auto-geolocation
  React.useEffect(() => {
    if (data.location) return // already set
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {}, // just centre the map later — don't fill address with coords
        () => {},
        { timeout: 6000 }
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isValid = !!(data.fieldName.trim() && data.location)

  const handleNext = () => {
    if (!isValid) return
    // No API call here — all DB writes happen in finishOnboarding (Step4)
    // This prevents partial writes that conflict with the complete Step4 write
    nextStep()
  }

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'circOut' }}
        className="w-full max-w-lg"
      >
        {/* Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/60 overflow-hidden">


          {/* Simple white header — no green */}
          <div className="px-8 pt-8 pb-2">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Paso 1 de 4</p>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Identificá tu establecimiento</h2>
            <p className="text-sm text-gray-500 mt-1">Nombre y ubicación de tu campo</p>
          </div>

          <div className="px-8 py-8 space-y-6">

            {/* Field name */}
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

            {/* Location search */}
            <div className="space-y-2 relative">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
                <MapPin className="w-3 h-3" /> Ubicación
              </label>
              <form onSubmit={handleSearch} className="relative">
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

              {/* Confirmation of selected location */}
              <AnimatePresence>
                {data.location && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-xl"
                  >
                    <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <p className="text-[10px] font-bold text-green-700 leading-snug line-clamp-2">
                      {data.location.address}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSugg && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => selectSuggestion(s)}
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

            {/* Info hint */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-800">En el siguiente paso delimitás tu campo</p>
                <p className="text-[10px] text-blue-500 font-normal mt-0.5 leading-relaxed">
                  Podrás dibujar el perímetro de tu campo y tus potreros en el mapa satelital. Este paso es opcional y puede completarse después.
                </p>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleNext}
              disabled={!isValid || saving}
              className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-30 disabled:grayscale text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <>Siguiente <ArrowRight className="w-4 h-4" /></>}
            </button>

            {!isValid && (
              <p className="text-center text-[10px] text-gray-400 font-normal -mt-2">
                Completá el nombre y la ubicación para continuar
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
