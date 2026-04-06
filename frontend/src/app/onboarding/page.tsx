'use client'

import React from 'react'
import { OnboardingProvider, useOnboarding } from './OnboardingContext'
import Step1Location from './components/Step1Location'
import Step2Map     from './components/Step2Map'
import Step3Herds   from './components/Step3Herds'
import Step4Confirm from './components/Step4Confirm'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Check } from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'

const STEPS = [
  { id: 1, title: 'Nombre y ubicación', subtitle: 'Tu establecimiento' },
  { id: 2, title: 'Delimitación',        subtitle: 'Campo y potreros' },
  { id: 3, title: 'Hacienda',            subtitle: 'Inventario de rebaños' },
  { id: 4, title: 'Confirmación',        subtitle: 'Resumen y lanzar' },
]

function OnboardingWizard() {
  const { step } = useOnboarding()
  const { user, isLoading, profile } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && profile) {
      // Only redirect to dashboard if onboarding is fully complete (step 4)
      if ((profile.onboarding_step ?? 0) >= 4) {
        router.push('/dashboard')
      }
    }
  }, [user, isLoading, profile, router])

  if (isLoading) return null

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm z-30 flex items-center justify-between">
        <RodeoLogo variant="light" size="md" showTagline={false} />
        <div className="hidden sm:block">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Configuración inicial</p>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100 px-3 sm:px-6 py-3 sm:py-4 flex justify-center z-20 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-0">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.id
            const isActive    = step === s.id
            const isLast      = idx === STEPS.length - 1

            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-500
                    ${isCompleted
                      ? 'bg-green-600 text-white shadow-md shadow-green-600/20'
                      : isActive
                      ? 'bg-green-700 text-white shadow-lg shadow-green-700/30 ring-4 ring-green-50'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'}
                  `}>
                    {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : s.id}
                  </div>
                  <div className="mt-1 text-center hidden sm:block">
                    <p className={`text-xs font-semibold tracking-tight leading-tight ${isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                      {s.title}
                    </p>
                    <p className={`text-[9px] font-medium tracking-tight ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                      {s.subtitle}
                    </p>
                  </div>
                  {/* Mobile: show only step title if active */}
                  <div className="mt-1 text-center sm:hidden">
                    <p className={`text-[8px] font-bold tracking-tight ${isActive ? 'text-green-700' : 'text-gray-300'}`}>
                      {isActive ? s.title : ''}
                    </p>
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

      {/* Main content */}
      <main className="flex-1 flex items-stretch overflow-hidden bg-gray-50 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.35, ease: 'circOut' }}
            className="w-full flex flex-col h-full min-h-0 overflow-hidden"
          >
            {step === 1 && <Step1Location />}
            {step === 2 && <Step2Map />}
            {step === 3 && <Step3Herds />}
            {step === 4 && <Step4Confirm />}
          </motion.div>
        </AnimatePresence>
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
