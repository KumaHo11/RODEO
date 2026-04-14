'use client'

import React, { useCallback, useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { OnboardingProvider, useOnboarding } from './OnboardingContext'
import Step3Herds from './components/Step3Herds'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X, Leaf, MapPin, PenLine } from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'

// Lazy-load the singleton map (never unmounts while step 1 or 2 is active)
import type { OnboardingMapSingletonProps, DrawnShape } from './components/OnboardingMapSingleton'
const OnboardingMapSingleton = dynamic<OnboardingMapSingletonProps>(
  () => import('./components/OnboardingMapSingleton'),
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

// Left-panel content — lazy so they don't pull in their deps on step 3
import Step1Panel from './components/Step1Panel'
import Step2Panel from './components/Step2Panel'

// ------------------------------------------------------------------------------
// Stepper config
// ------------------------------------------------------------------------------
const STEPS = [
  { id: 1, title: 'Ubicación', subtitle: 'Nombre y mapa' },
  { id: 2, title: 'Potreros',  subtitle: 'Campo y lotes' },
  { id: 3, title: 'Hacienda',  subtitle: 'Inventario'    },
]

// ------------------------------------------------------------------------------
// Main wizard
// ------------------------------------------------------------------------------
function OnboardingWizard() {
  const { data, updateData, step } = useOnboarding()
  const { user, isLoading, profile } = useAuth()
  const router = useRouter()

  // Guard: if already completed, push to dashboard
  useEffect(() => {
    if (!isLoading && user && profile && (profile.onboarding_step ?? 0) >= 4) {
      router.push('/dashboard')
    }
  }, [user, isLoading, profile, router])

  if (isLoading) return null

  // -- Callbacks for the map singleton --------------------------------------─
  const handleLocationChange = useCallback(async (lat: number, lng: number) => {
    // Reverse geocode silently
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const j = await r.json()
      if (j?.display_name) address = j.display_name
    } catch {}
    updateData({ location: { lat, lng, address } })
  }, [updateData])

  // -- Keep a ref to fieldBoundary to avoid stale closures in handleShapeDrawn
  const fieldBoundaryRef = useRef(data.fieldBoundary)
  useEffect(() => { fieldBoundaryRef.current = data.fieldBoundary }, [data.fieldBoundary])

  const paddocksLenRef = useRef(data.paddocks.length)
  useEffect(() => { paddocksLenRef.current = data.paddocks.length }, [data.paddocks.length])

  const handleShapeDrawn = useCallback((shape: DrawnShape) => {
    if (fieldBoundaryRef.current) {
      // Already has field → open paddock naming modal
      const nextName = `Potrero ${paddocksLenRef.current + 1}`
      setPendingShape(shape)
      setPaddockModalName(nextName)
      setPaddockModalForraje('')
    } else {
      // First shape → field boundary draft
      updateData({ _draftShape: shape } as any)
    }
  }, [updateData])

  // -- Paddock naming modal state --------------------------------------------
  const [pendingShape, setPendingShape] = useState<{ id?: number; geojson: any; area_ha: number; layer: any } | null>(null)
  const [paddockModalName, setPaddockModalName]   = useState('')
  const [paddockModalForraje, setPaddockModalForraje] = useState<string>('')

  const commitPaddock = useCallback(() => {
    if (!pendingShape || !paddockModalName.trim()) return
    const updated = [...data.paddocks, {
      layerId: pendingShape.id,
      name: paddockModalName.trim(),
      geojson: pendingShape.geojson,
      area_ha: pendingShape.area_ha,
      dry_matter_kg_ha: paddockModalForraje !== '' ? Number(paddockModalForraje) : undefined,
    }]
    updateData({ paddocks: updated, totalArea: parseFloat(updated.reduce((s, p) => s + p.area_ha, 0).toFixed(2)) })
    setPendingShape(null)
    setPaddockModalName('')
    setPaddockModalForraje('')
  }, [pendingShape, paddockModalName, paddockModalForraje, data.paddocks, updateData])

  const cancelPaddock = useCallback(() => {
    // Remove the drawn layer from the map
    try { pendingShape?.layer?.remove?.() } catch {}
    setPendingShape(null)
    setPaddockModalName('')
    setPaddockModalForraje('')
  }, [pendingShape])

  const [midDrawArea, setMidDrawArea] = useState<number | null>(null)

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

  // Map mode depends on step
  const mapMode = step === 1 ? 'locate' : 'draw'
  const drawPhase = data.fieldBoundary ? 'paddock' : 'field'

  const showMap = step === 1 || step === 2

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">

      {/* -- Header -- */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm z-30 flex items-center justify-between shrink-0">
        <RodeoLogo variant="light" size="md" showTagline={false} />
        <div className="hidden sm:block">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Configuración inicial</p>
        </div>
      </header>

      {/* -- Stepper -- */}
      <div className="bg-white border-b border-gray-100 px-3 sm:px-6 py-3 sm:py-4 flex justify-center z-20 shrink-0">
        <div className="flex items-center gap-0">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.id
            const isActive    = step === s.id
            const isLast      = idx === STEPS.length - 1
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-500
                    ${isCompleted ? 'bg-green-600 text-white shadow-md shadow-green-600/20'
                      : isActive  ? 'bg-green-700 text-white shadow-lg shadow-green-700/30 ring-4 ring-green-50'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'}
                  `}>
                    {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : s.id}
                  </div>
                  <div className="mt-1 text-center hidden sm:block">
                    <p className={`text-xs font-semibold leading-tight ${isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{s.title}</p>
                    <p className={`text-[9px] font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>{s.subtitle}</p>
                  </div>
                  <div className="mt-1 sm:hidden">
                    <p className={`text-[8px] font-bold ${isActive ? 'text-green-700' : 'text-gray-300'}`}>{isActive ? s.title : ''}</p>
                  </div>
                </div>
                {!isLast && (
                  <div className={`w-8 sm:w-16 h-0.5 mb-4 sm:mb-6 mx-1 sm:mx-2 transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* -- Main content -- */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* Steps 1+2: [Left panel | Persistent map] */}
        {showMap && (
          <div className="flex-1 flex h-full overflow-hidden">

            {/* LEFT PANEL — swaps between Step1Panel and Step2Panel */}
            <div className="w-[400px] xl:w-[440px] shrink-0 flex flex-col bg-white border-r border-gray-100 overflow-hidden relative z-10">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="absolute inset-0 flex flex-col overflow-y-auto"
                  >
                    <Step1Panel />
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="absolute inset-0 flex flex-col overflow-hidden"
                  >
                    <Step2Panel midDrawArea={midDrawArea} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT — singleton map, never unmounts */}
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
              />

              {/* Mid-draw floating badge */}
              {step === 2 && midDrawArea !== null && !pendingShape && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg backdrop-blur-sm border ${
                    drawPhase === 'field'
                      ? 'bg-blue-600/90 border-blue-400/50 text-white'
                      : 'bg-green-600/90 border-green-400/50 text-white'
                  }`}>
                    <p className="text-sm font-black">{midDrawArea.toFixed(1)} <span className="text-xs font-bold opacity-80">ha</span></p>
                    <p className="text-[10px] font-normal opacity-70">{drawPhase === 'field' ? '· perímetro campo' : '· potrero'}</p>
                  </div>
                </div>
              )}

              {/* -- Paddock naming modal — slides up from bottom on draw complete -- */}
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
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                            <Leaf className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nuevo potrero</p>
                            <p className="text-xs font-bold text-gray-700">{pendingShape.area_ha.toFixed(2)} ha dibujadas</p>
                          </div>
                        </div>
                        <button
                          onClick={cancelPaddock}
                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-400 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Form */}
                      <div className="px-5 py-4 space-y-3">
                        {/* Name */}
                        <div>
                          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5 mb-1.5">
                            <MapPin className="w-3 h-3" /> Nombre del potrero
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

                        {/* Forraje disponible */}
                        <div>
                          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5 mb-1.5">
                            <Leaf className="w-3 h-3" /> Forraje disponible <span className="font-normal normal-case text-[9px] text-gray-300">(opcional)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              step="50"
                              value={paddockModalForraje}
                              onChange={e => setPaddockModalForraje(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitPaddock() }}
                              placeholder="Ej: 1200"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all pr-20"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">kg MS/ha</span>
                          </div>
                          {paddockModalForraje !== '' && Number(paddockModalForraje) > 0 && pendingShape.area_ha > 0 && (
                            <p className="text-[10px] text-green-600 font-bold mt-1 ml-1">
                              ≈ {Math.round(Number(paddockModalForraje) * pendingShape.area_ha).toLocaleString()} kg MS totales
                            </p>
                          )}
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="px-5 pb-5">
                        <button
                          onClick={commitPaddock}
                          disabled={!paddockModalName.trim()}
                          className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-3 rounded-2xl transition-all text-sm shadow-lg shadow-green-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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


        {/* Step 3: full width, no map */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Step3Herds />
          </motion.div>
        )}
      </main>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingWizard />
    </OnboardingProvider>
  )
}
