'use client'

/**
 * Step1Panel2 — Paso 1: Identificación del establecimiento
 *
 * Cambios respecto al original:
 *  - Solo el NOMBRE es obligatorio para avanzar (ubicación es opcional)
 *  - Dos opciones de ubicación en lugar de tres pestañas:
 *      1. Buscar / GPS (tab por defecto)
 *      2. Subir KML (también alimenta los polígonos del paso 2)
 *  - Botón "Saltar este paso" siempre visible
 *  - El KML cargado aquí activa kmlLoadedInStep1 en el contexto
 */

import React, { useState, useCallback } from 'react'
import { useOnboarding2 } from '../OnboardingContext2'
import {
  Search, Loader2, ArrowRight, MapPin, Building2,
  LocateFixed, Upload, X, FileText, CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseKmlFile } from '@/lib/kmlParser'

export default function Step1Panel2() {
  const { data, updateData, nextStep } = useOnboarding2()

  const [tab, setTab]               = useState<'search' | 'kml'>('search')
  const [searchQuery, setSearchQuery] = useState(data.location?.address || '')
  const [searching, setSearching]    = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSugg, setShowSugg]      = useState(false)
  const [geolocating, setGeolocating] = useState(false)

  // KML state
  const [kmlLoading, setKmlLoading]   = useState(false)
  const [kmlError, setKmlError]       = useState('')
  const [kmlFileName, setKmlFileName] = useState('')

  const fileRef = React.useRef<HTMLInputElement>(null)

  // ── Nominatim autocomplete ────────────────────────────────────────────────
  React.useEffect(() => {
    if (tab !== 'search' || searchQuery.length < 3) {
      setSuggestions([]); setShowSugg(false); return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
        )
        setSuggestions(await res.json())
        setShowSugg(true)
      } catch {}
    }, 450)
    return () => clearTimeout(t)
  }, [searchQuery, tab])

  const selectSuggestion = (s: any) => {
    const lat = parseFloat(s.lat), lng = parseFloat(s.lon)
    setSearchQuery(s.display_name); setShowSugg(false)
    updateData({ location: { lat, lng, address: s.display_name } })
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      )
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
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          )
          const j = await r.json()
          if (j.display_name) address = j.display_name
        } catch {}
        updateData({ location: { lat, lng, address } })
        setSearchQuery(address)
        setGeolocating(false)
      },
      () => setGeolocating(false),
      { timeout: 8000 }
    )
  }

  // ── KML upload (unificado: ubicación + polígonos para paso 2) ────────────
  const handleKmlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setKmlLoading(true)
    setKmlError('')
    e.target.value = ''

    try {
      const result = await parseKmlFile(file)
      if (result.error) {
        setKmlError(result.error)
        setKmlLoading(false)
        return
      }

      setKmlFileName(file.name)

      // Extraer ubicación central del KML (primer vértice del primer polígono)
      let location = data.location
      if (!location && result.features.length > 0) {
        const coords = result.features[0].geojson?.geometry?.coordinates?.[0]
        if (coords?.length > 0) {
          const [lng, lat] = coords[0]
          location = { lat, lng, address: `Importado desde ${file.name}` }
        }
      }

      updateData({
        location: location ?? undefined,
        kmlLoadedInStep1: true,
        kmlFeaturesFromStep1: result.features,
      } as any)
    } catch {
      setKmlError('No se pudo procesar el archivo KML.')
    } finally {
      setKmlLoading(false)
    }
  }

  const clearKml = () => {
    updateData({ kmlLoadedInStep1: false, kmlFeaturesFromStep1: [] } as any)
    setKmlFileName('')
    setKmlError('')
    if (!data.location?.address.includes('Importado desde')) return
    updateData({ location: null } as any)
  }

  // ── Validación: solo el nombre es obligatorio ─────────────────────────────
  const isValid = data.fieldName.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-gray-100 shrink-0">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">
          Paso 1 de 3 · Identificación
        </p>
        <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight">
          Nombrá tu establecimiento
        </h2>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Agregá un nombre y, si querés, fijá la ubicación para obtener datos del clima de tu zona.
        </p>
      </div>

      <div className="px-6 py-5 space-y-6 flex-1">

        {/* ── Campo: Nombre del establecimiento ────────────────────────────── */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
            <Building2 className="w-3 h-3" />
            Nombre del establecimiento <span className="text-green-600 font-black">*</span>
          </label>
          <input
            type="text"
            autoFocus
            placeholder="Ej: La Posta, Estancia El Ombú..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all"
            value={data.fieldName}
            onChange={e => updateData({ fieldName: e.target.value })}
          />
        </div>

        {/* ── Ubicación ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-widest uppercase">
              <MapPin className="w-3 h-3" />
              Ubicación <span className="font-normal normal-case text-[10px] text-gray-300">(opcional)</span>
            </label>
          </div>

          {/* Tab selector */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 divide-x divide-gray-200">
            {[
              { id: 'search' as const, label: 'Buscar en el mapa' },
              { id: 'kml'    as const, label: 'Subir archivo KML' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-[11px] font-black transition-all ${
                  tab === t.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── TAB: Buscar ─────────────────────────────────────────────── */}
            {tab === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="space-y-2.5"
              >
                {/* Search input */}
                <div className="relative">
                  <form onSubmit={handleSearch}>
                    <input
                      type="text"
                      placeholder="Buscar ciudad, partido, provincia..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-12 py-3.5 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        if (data.location) updateData({ location: null })
                      }}
                      onFocus={() => searchQuery.length >= 3 && setShowSugg(true)}
                      onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                    />
                    <button
                      type="submit"
                      disabled={searching || !searchQuery}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg transition-all ${
                        searchQuery
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'text-gray-300'
                      }`}
                    >
                      {searching
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Search className="w-4 h-4" />
                      }
                    </button>
                  </form>

                  {/* Suggestions dropdown */}
                  <AnimatePresence>
                    {showSugg && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => selectSuggestion(s)}
                            className="w-full text-left px-4 py-3 text-xs text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors border-b border-gray-50 last:border-0"
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
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geolocating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-green-300 rounded-xl text-xs font-bold text-green-600 hover:bg-green-50 hover:border-green-400 transition-all disabled:opacity-50"
                >
                  {geolocating
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Obteniendo ubicación...</>
                    : <><LocateFixed className="w-3.5 h-3.5" /> Usar mi ubicación actual</>
                  }
                </button>
              </motion.div>
            )}

            {/* ── TAB: KML ─────────────────────────────────────────────────── */}
            {tab === 'kml' && (
              <motion.div
                key="kml"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="space-y-3"
              >
                {/* KML cargado exitosamente */}
                {data.kmlLoadedInStep1 && kmlFileName ? (
                  <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-green-800">KML cargado correctamente</p>
                      <p className="text-[10px] text-green-600 font-normal mt-0.5 line-clamp-1">{kmlFileName}</p>
                      <p className="text-[10px] text-green-500 font-normal mt-1">
                        {data.kmlFeaturesFromStep1?.length ?? 0} polígono{(data.kmlFeaturesFromStep1?.length ?? 0) !== 1 ? 's' : ''} detectado{(data.kmlFeaturesFromStep1?.length ?? 0) !== 1 ? 's' : ''} · Se cargarán automáticamente en el paso 2
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearKml}
                      className="w-7 h-7 flex items-center justify-center rounded-xl bg-green-100 hover:bg-green-200 text-green-500 transition-all shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-all group">
                    {kmlLoading ? (
                      <>
                        <Loader2 className="w-7 h-7 text-green-500 animate-spin" />
                        <p className="text-xs font-bold text-gray-500">Procesando archivo KML...</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-green-50 group-hover:border-green-200 transition-all">
                          <Upload className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-xs font-black text-gray-600 group-hover:text-green-700 transition-colors">
                            Subir archivo .kml
                          </p>
                          <p className="text-[10px] text-gray-400 font-normal mt-1 leading-relaxed">
                            El sistema extrae la ubicación y los polígonos de los potreros automáticamente
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 group-hover:bg-green-100 group-hover:text-green-700 transition-all">
                          Tocar para elegir archivo
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".kml"
                      className="hidden"
                      onChange={handleKmlFile}
                      disabled={kmlLoading}
                    />
                  </label>
                )}

                {/* KML error */}
                {kmlError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <X className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-600 leading-relaxed">{kmlError}</p>
                  </div>
                )}

                {/* Info sobre el KML */}
                {!data.kmlLoadedInStep1 && !kmlError && (
                  <div className="flex items-start gap-2 px-1">
                    <FileText className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-400 font-normal leading-relaxed">
                      Exportá el KML desde Google Earth, Google Maps o tu GPS. Podés subir el mismo archivo que usás para los potreros.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Location confirmation chip */}
          <AnimatePresence>
            {data.location && tab === 'search' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
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

      {/* ── CTA footer ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-t border-gray-100 shrink-0 space-y-2.5">
        {/* Hint si no hay ubicación */}
        {!data.location && !data.kmlLoadedInStep1 && isValid && (
          <p className="text-center text-[10px] text-amber-500 font-medium leading-relaxed">
            Sin ubicación no tendrás datos del clima de tu zona. Podés agregarla después.
          </p>
        )}

        <button
          onClick={() => { if (isValid) nextStep() }}
          disabled={!isValid}
          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:opacity-30 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
        >
          Continuar — Delimitar potreros
          <ChevronRight className="w-4 h-4" />
        </button>

        {!isValid && (
          <p className="text-center text-[10px] text-gray-400 font-normal">
            Escribí el nombre del establecimiento para continuar
          </p>
        )}

        {isValid && (
          <button
            onClick={nextStep}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Saltar configuración y entrar al dashboard
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
