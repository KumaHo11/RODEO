import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

interface OnboardingPaddock {
  name: string
  geojson: any
  area_ha: number
  dry_matter_kg_ha?: number
}

interface OnboardingData {
  // Paso 1: Nombre + Ubicación
  fieldName: string
  location: { lat: number; lng: number; address: string } | null

  // KML cargado en paso 1 → alimenta también el paso 2
  kmlLoadedInStep1: boolean
  kmlFeaturesFromStep1: ParsedKmlFeature[]

  // Paso 2: Perímetro + potreros
  fieldBoundary: any | null
  fieldBoundaryHa: number
  totalArea: number
  geometry: any | null
  paddocks: OnboardingPaddock[]
  skippedMap: boolean

  // Forma dibujada pendiente de confirmación
  _draftShape: { geojson: any; area_ha: number; layer: any } | null

  // Paso 3: Hacienda
  herds: Array<{
    name: string
    species: string
    categoria?: string | null
    breed: string | null
    headCount: number
    avgWeight: number
    age: number
    ageMonths?: number | null
    admissionDate?: string | null
    totalEV: number
    physiologicalCategory?: string | null
    lastWeighDate?: string | null
    dailyGainKg?: number | null
  }>
  skippedHerds: boolean
}

interface OnboardingContextType {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  step: number
  nextStep: () => void
  prevStep: () => void
  goToStep: (n: number) => void
}

const OnboardingContext2 = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider2({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    fieldName: '',
    location: null,
    kmlLoadedInStep1: false,
    kmlFeaturesFromStep1: [],
    fieldBoundary: null,
    fieldBoundaryHa: 0,
    totalArea: 0,
    geometry: null,
    paddocks: [],
    skippedMap: false,
    _draftShape: null,
    herds: [],
    skippedHerds: false,
  })

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const nextStep = useCallback(() => setStep(s => Math.min(s + 1, 3)), [])
  const prevStep = useCallback(() => setStep(s => Math.max(s - 1, 1)), [])
  const goToStep = useCallback((n: number) => setStep(Math.max(1, Math.min(n, 3))), [])

  return (
    <OnboardingContext2.Provider value={{ data, updateData, step, nextStep, prevStep, goToStep }}>
      {children}
    </OnboardingContext2.Provider>
  )
}

export function useOnboarding2() {
  const context = useContext(OnboardingContext2)
  if (!context) throw new Error('useOnboarding2 must be used within OnboardingProvider2')
  return context
}
