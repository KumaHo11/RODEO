'use client'

/**
 * /onboarding2/page.tsx — Wizard de configuración inicial (v2)
 *
 * Diferencias respecto a /onboarding/page.tsx:
 *  - Stepper visual mejorado: líneas de progreso animadas, etiquetas descriptivas
 *  - Paso 1 usa Step1Panel2 (nombre obligatorio; ubicación y KML opcionales)
 *  - Paso 2 usa Step2Panel2 (Siguiente siempre habilitado; aviso NDVI inline)
 *  - Paso 3 usa Step3Herds2 (tarjetas fisiológicas; Finalizar siempre habilitado)
 *  - El KML cargado en el paso 1 se pasa al singleton como kmlFeaturesFromStep1
 *  - NO modifica /onboarding — convive en paralelo hasta ser aprobado
 */

import React, { useCallback, useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { OnboardingProvider2, useOnboarding2 } from './OnboardingContext2'
import Step3Herds2 from './components/Step3Herds2'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'
import type { OnboardingMapSingletonProps, DrawnShape } from '@/app/onboarding/components/OnboardingMapSingleton'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

// Reusar el singleton de mapa del onboarding original (sin modificarlo)
const OnboardingMapSingleton = dynamic<OnboardingMapSingletonProps>(
  () => import('@/app/onboarding/components/OnboardingMapSingleton'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-green-500 animate-spin" />
        <p className="text-[10px] font-bold text-gray-400 tracking-widest">Cargando mapa satelital...</p>
      </div>
    ),
  }
)

import Step1Panel2 from './components/Step1Panel2'
import Step2Panel2 from './components/Step2Panel2'

// ── Stepper config ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: 'Ubicación',  subtitle: 'Nombre y mapa'   },
  { id: 2, title: 'Potreros',   subtitle: 'Delimitar campo'  },
  { id: 3, title: 'Hacienda',   subtitle: 'Inventario'       },
]

// ── Wizard principal ───────────────────────────────────────────────────────────
function OnboardingWizard2() {
  const { data, updateData, step } = useOnboarding2()
  const { user, isLoading, profile } = useAuth()
  const router = useRouter()

  // Guard: si ya completó el onboarding, redirigir
  useEffect(() => {
    if (!isLoading && user && profile && (profile.onboarding_step ?? 0) >= 4) {
      router.push('/dashboard')
    }
  }, [user, isLoading, profile, router])

  // ── Location callback ──────────────────────────────────────────────────────
  const handleLocationChange = useCallback(async (lat: number, lng: number) => {
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const j = await r.json()
      if (j?.display_name) address = j.display_name
    } catch {}
    updateData({ location: { lat, lng, address } })
  }, [updateData])

  // ── Field boundary ref ─────────────────────────────────────────────────────
  const fieldBoundaryRef = useRef(data.fieldBoundary)
  useEffect(() => { fieldBoundaryRef.current = data.fieldBoundary }, [data.fieldBoundary])

  const paddocksLenRef = useRef(data.paddocks.length)
  useEffect(() => { paddocksLenRef.current = data.paddocks.length }, [data.paddocks.length])

  // ── Paddock naming modal ───────────────────────────────────────────────────
  const [pendingShape, setPendingShape]         = useState<{ id?: number; geojson: any; area_ha: number; layer: any } | null>(null)
  const [paddockModalName, setPaddockModalName] = useState('')
  const [pendingKmlIndex, setPendingKmlIndex]   = useState<number | null>(null)

  const handleShapeDrawn = useCallback((shape: DrawnShape) => {
    if (fieldBoundaryRef.current) {
      setPendingShape(shape)
      setPaddockModalName(`Potrero ${paddocksLenRef.current + 1}`)
    } else {
      updateData({ _draftShape: shape } as any)
    }
  }, [updateData])

  // ── KML state ─────────────────────────────────────────────────────────────
  // En el paso 2, pueden cargar un KML adicional distinto al del paso 1
  const [kmlFeatures, setKmlFeatures]             = useState<ParsedKmlFeature[]>([])
  const [acceptedKmlIndices, setAcceptedKmlIndices] = useState<Set<number>>(new Set())

  // Cuando el KML del paso 1 está disponible, usarlo en el mapa
  const effectiveKmlFeatures = data.kmlLoadedInStep1 && data.kmlFeaturesFromStep1?.length
    ? data.kmlFeaturesFromStep1
    : kmlFeatures

  const commitPaddock = useCallback(() => {
    if (!pendingShape || !paddockModalName.trim()) return
    const updated = [...data.paddocks, {
      layerId:  pendingShape.id,
      name:     paddockModalName.trim(),
      geojson:  pendingShape.geojson,
      area_ha:  pendingShape.area_ha,
    }]
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
    setPendingShape(null)
    setPaddockModalName('')
    if (pendingKmlIndex !== null) {
      setAcceptedKmlIndices(prev => new Set([...prev, pendingKmlIndex]))
      setPendingKmlIndex(null)
    }
  }, [pendingShape, paddockModalName, data.paddocks, updateData, pendingKmlIndex])

  const cancelPaddock = useCallback(() => {
    if (pendingKmlIndex === null) {
      try { pendingShape?.layer?.remove?.() } catch {}
    }
    setPendingShape(null)
    setPaddockModalName('')
    setPendingKmlIndex(null)
  }, [pendingShape, pendingKmlIndex])

  const [midDrawArea, setMidDrawArea] = useState<number | null>(null)

  const handleKmlParsed = useCallback((features: ParsedKmlFeature[]) => {
    setKmlFeatures(features)
    setAcceptedKmlIndices(new Set())
  }, [])

  const handleKmlPolygonClick = useCallback((index: number, feature: ParsedKmlFeature) => {
    setPendingKmlIndex(index)
    const nextName = feature.name || `Potrero ${paddocksLenRef.current + 1}`
    setPendingShape({ geojson: feature.geojson, area_ha: feature.area_ha, layer: null as any })
    setPaddockModalName(nextName)
  }, [])

  const handleShapeEdited = useCallback((layerId: number, geojson: any, area_ha: number) => {
    if ((data as any).fieldLayerId === layerId) {
      updateData({ fieldBoundary: geojson, fieldBoundaryHa: area_ha } as any)
    } else {
      const updated = data.paddocks.map((p: any) =>
        p.layerId === layerId ? { ...p, geojson, area_ha } : p
      )
      updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s: any, p: any) => s + p.area_ha, 0).toFixed(2)) })
    }
  }, [data, updateData])

  const handleShapeRemoved = useCallback((layerId: number) => {
    if ((data as any).fieldLayerId === layerId) {
      updateData({ fieldBoundary: null, fieldBoundaryHa: 0, fieldLayerId: null, paddocks: [], totalArea: 0 } as any)
    } else {
      const updated = data.paddocks.filter((p: any) => p.layerId !== layerId)
      updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s: any, p: any) => s + p.area_ha, 0).toFixed(2)) })
    }
  }, [data, updateData])

  const mapMode   = step === 1 ? 'locate' : 'draw'
  const drawPhase = data.fieldBoundary ? 'paddock' : 'field'
  const showMap   = step === 1 || step === 2

  if (isLoading) return null

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm z-30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <RodeoLogo variant="light" size="md" showTagline={false} />
          {/* Badge de preview */}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-black rounded-full tracking-widest uppercase">
            Preview v2
          </span>
        </div>
        <div className="hidden sm:block">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
            Configuración inicial
          </p>
        </div>
      </header>

      {/* ── Stepper mejorado ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex justify-center z-20 shrink-0">
        <div className="flex items-center w-full max-w-md">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.id
            const isActive    = step === s.id
            const isLast      = idx === STEPS.length - 1

            return (
              <React.Fragment key={s.id}>
                {/* Step node */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={`
                    w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-sm transition-all duration-500
                    ${isCompleted
                      ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
                      : isActive
                      ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20 ring-4 ring-gray-900/10'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }
                  `}>
                    {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : s.id}
                  </div>
                  <div className="mt-1.5 text-center hidden sm:block">
                    <p className={`text-xs font-black leading-tight transition-colors ${
                      isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {s.title}
                    </p>
                    <p className={`text-[10px] font-medium transition-colors ${
                      isActive ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {s.subtitle}
                    </p>
                  </div>
                  {/* Mobile: solo el paso activo muestra label */}
                  <div className="mt-1 sm:hidden">
                    <p className={`text-[10px] font-black ${isActive ? 'text-gray-900' : 'text-transparent'}`}>
                      {s.title}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className="flex-1 mx-2 sm:mx-3 relative h-0.5 mb-6">
                    {/* Background line */}
                    <div className="absolute inset-0 bg-gray-200 rounded-full" />
                    {/* Progress line */}
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: isCompleted ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* ── Contenido principal ─────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* Pasos 1 + 2: [Panel izquierdo | Mapa persistente] */}
        {showMap && (
          <div className="flex-1 flex h-full overflow-hidden">

            {/* Panel izquierdo */}
            <div className="w-[400px] xl:w-[440px] shrink-0 flex flex-col bg-white border-r border-gray-100 overflow-hidden relative z-10">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="absolute inset-0 flex flex-col overflow-y-auto"
                  >
                    <Step1Panel2 />
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="absolute inset-0 flex flex-col overflow-hidden"
                  >
                    <Step2Panel2
                      midDrawArea={midDrawArea}
                      onKmlParsed={handleKmlParsed}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mapa (singleton — nunca desmonta mientras step 1 o 2 está activo) */}
            <div className="flex-1 relative">
              <OnboardingMapSingleton
                mode={mapMode}
                location={data.location}
                onLocationChange={handleLocationChange}
                drawPhase={drawPhase}
                paddockCount={data.paddocks.length}
                onShapeDrawn={handleShapeDrawn}
                onMidDraw={setMidDrawArea}
                onShapeEdited={handleShapeEdited}
                onShapeRemoved={handleShapeRemoved}
                kmlFeatures={effectiveKmlFeatures}
                acceptedKmlIndices={acceptedKmlIndices}
                onKmlPolygonClick={handleKmlPolygonClick}
              />

              {/* Badge de área en progreso */}
              {step === 2 && midDrawArea !== null && !pendingShape && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg backdrop-blur-sm border ${
                    drawPhase === 'field'
                      ? 'bg-blue-600/90 border-blue-400/50 text-white'
                      : 'bg-green-600/90 border-green-400/50 text-white'
                  }`}>
                    <p className="text-sm font-black">{midDrawArea.toFixed(1)} <span className="text-xs font-bold opacity-80">ha</span></p>
                    <p className="text-[10px] font-normal opacity-70">
                      {drawPhase === 'field' ? '· perímetro campo' : '· potrero'}
                    </p>
                  </div>
                </div>
              )}

              {/* Modal de nombramiento de potrero */}
              <AnimatePresence>
                {pendingShape && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[1500] flex items-end justify-center pb-6 px-4"
                    style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
                  >
                    <motion.div
                      initial={{ y: 40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 40, opacity: 0 }}
                      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                      className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                            Nuevo potrero
                          </p>
                          <p className="text-xs font-bold text-gray-700">
                            {pendingShape.area_ha.toFixed(2)} ha dibujadas
                          </p>
                        </div>
                        <button
                          onClick={cancelPaddock}
                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-400 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="px-5 py-4">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase block mb-1.5">
                          Nombre del potrero
                        </label>
                        <input
                          autoFocus
                          type="text"
                          value={paddockModalName}
                          onChange={e => setPaddockModalName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitPaddock() }}
                          placeholder="Ej: Potrero Norte, Bajo, Cañada..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div className="px-5 pb-5">
                        <button
                          onClick={commitPaddock}
                          disabled={!paddockModalName.trim()}
                          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-3 rounded-2xl transition-all text-sm shadow-lg shadow-green-600/20 disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" strokeWidth={3} /> Guardar potrero
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Paso 3: pantalla completa sin mapa */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Step3Herds2 />
          </motion.div>
        )}
      </main>
    </div>
  )
}

export default function OnboardingPage2() {
  return (
    <OnboardingProvider2>
      <OnboardingWizard2 />
    </OnboardingProvider2>
  )
}
