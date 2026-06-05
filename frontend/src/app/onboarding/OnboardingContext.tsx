import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react'

interface OnboardingPaddock {
  name: string
  geojson: any   // GeoJSON Feature (Polygon)
  area_ha: number
  dry_matter_kg_ha?: number  // Forraje declarado por el usuario (kg MS/ha)
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

  // Internal: shape drawn by singleton map, pending confirmation in Step2Panel
  _draftShape: { geojson: any; area_ha: number; layer: any } | null

  // Step 3: Herds
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
    // v8 physiological fields
    physiologicalCategory?: string | null
    lastWeighDate?: string | null
    dailyGainKg?: number | null
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
  isCompleting: boolean
  setIsCompleting: (v: boolean) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1)
  const [isCompleting, setIsCompleting] = useState(false)
  const isCompletingRef = React.useRef(isCompleting)
  const stepRef = React.useRef(step)
  const dataRef = React.useRef<OnboardingData | null>(null)

  const [data, setData] = useState<OnboardingData>({
    fieldName: '',
    location: null,
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

  useEffect(() => {
    isCompletingRef.current = isCompleting
    stepRef.current = step
    dataRef.current = data
  }, [isCompleting, step, data])

  useEffect(() => {
    // Dynamically import event to avoid circular dependencies or SSR issues
    import('@/lib/analytics').then(({ event }) => {
      event({ action: 'onboarding_start', category: 'onboarding' })
    })

    return () => {
      if (!isCompletingRef.current) {
        import('@/lib/analytics').then(({ event }) => {
          let fieldsCompleted = 0
          if (dataRef.current?.fieldName) fieldsCompleted++
          if (dataRef.current?.location) fieldsCompleted++
          if (dataRef.current?.paddocks.length) fieldsCompleted++
          if (dataRef.current?.herds.length) fieldsCompleted++
          
          event({ 
            action: 'onboarding_abandon', 
            category: 'onboarding',
            step_number: stepRef.current,
            fields_completed: fieldsCompleted
          })
        })
      }
    }
  }, [])

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  // 3 steps (Step 4 / Confirm is now the SuccessModal, not a page step)
  const nextStep = useCallback(() => {
    setStep(s => {
      const next = Math.min(s + 1, 3)
      if (s !== next) {
        import('@/lib/analytics').then(({ event }) => {
          const stepNames = ['Location', 'Paddocks', 'Herds']
          event({ 
            action: 'onboarding_step_complete', 
            category: 'onboarding',
            step_number: s,
            step_name: stepNames[s - 1]
          })
        })
      }
      return next
    })
  }, [])
  const prevStep = useCallback(() => setStep(s => Math.max(s - 1, 1)), [])
  const goToStep = useCallback((n: number) => setStep(Math.max(1, Math.min(n, 3))), [])

  return (
    <OnboardingContext.Provider value={{ data, updateData, step, nextStep, prevStep, goToStep, isCompleting, setIsCompleting }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider')
  return context
}
