import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'

interface OnboardingPaddock {
  name: string
  geojson: any   // GeoJSON Feature (Polygon)
  area_ha: number
}

interface OnboardingData {
  // Step 1: Name + Location
  fieldName: string
  location: { lat: number; lng: number; address: string } | null

  // Step 2: Field boundary + paddocks
  fieldBoundary: any | null     // GeoJSON Feature (Polygon)
  fieldBoundaryHa: number       // ha of the full property perimeter
  totalArea: number             // fallback (sum of paddocks if no boundary)
  geometry: any | null
  paddocks: OnboardingPaddock[]
  skippedMap: boolean           // user skipped step 2

  // Step 3: Herds
  herds: Array<{
    name: string
    species: string
    breed: string
    headCount: number
    avgWeight: number
    age: number
    totalEV: number
  }>
  skippedHerds: boolean         // user skipped step 3
}

interface OnboardingContextType {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  step: number
  nextStep: () => void
  prevStep: () => void
  goToStep: (n: number) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    fieldName: '',
    location: null,
    fieldBoundary: null,
    fieldBoundaryHa: 0,
    totalArea: 0,
    geometry: null,
    paddocks: [],
    skippedMap: false,
    herds: [],
    skippedHerds: false,
  })

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const nextStep = useCallback(() => setStep(s => Math.min(s + 1, 4)), [])
  const prevStep = useCallback(() => setStep(s => Math.max(s - 1, 1)), [])
  const goToStep = useCallback((n: number) => setStep(Math.max(1, Math.min(n, 4))), [])

  return (
    <OnboardingContext.Provider value={{ data, updateData, step, nextStep, prevStep, goToStep }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider')
  return context
}
