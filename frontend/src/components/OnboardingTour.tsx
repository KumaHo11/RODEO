'use client'

import React, { useState, useEffect } from 'react'
import { Joyride, STATUS, EVENTS, Step, EventData, TooltipRenderProps } from 'react-joyride'
import { auth } from '@/lib/firebase/client'

const STORAGE_KEY = 'rodeo_completed_tours'
function getCompletedTours(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}
function markTourCompleted(tourId: string) {
  const tours = getCompletedTours()
  if (!tours.includes(tourId)) {
    tours.push(tourId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tours))
  }
}

interface OnboardingTourProps {
  tourId: string
  steps: Step[]
}

function CustomTooltip({
  index,
  step,
  size,
  backProps,
  primaryProps,
  tooltipProps,
  skipProps,
  isLastStep,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="bg-white rounded-[24px] p-5 w-[280px] max-w-[calc(100vw-2rem)] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] border border-gray-100 font-sans"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-black text-gray-900 leading-tight">
          {step.title}
        </h3>
        <div className="text-[12px] font-medium text-gray-600 leading-relaxed">
          {step.content}
        </div>
      </div>

      <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              className="px-3 py-2 text-[11px] font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
            >
              Anterior
            </button>
          )}
          <button
            {...primaryProps}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-[11px] font-black rounded-xl hover:bg-green-700 active:scale-95 transition-all shadow-md shadow-green-600/20"
          >
            {isLastStep ? 'Finalizar' : `Siguiente — ${index + 1}/${size}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingTour({ tourId, steps }: OnboardingTourProps) {
  const [run, setRun] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    async function checkStatus() {
      // Check localStorage first
      if (getCompletedTours().includes(tourId)) {
        setHasChecked(true)
        return
      }

      // Esperar a que el usuario esté autenticado
      const user = auth.currentUser
      if (!user) return

      try {
        const token = await user.getIdToken()
        const res = await fetch(`/api/users/onboarding-status?tourId=${encodeURIComponent(tourId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          if (!data.hasCompleted) {
            setRun(true)
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      } finally {
        setHasChecked(true)
      }
    }

    // Usar onAuthStateChanged para asegurarnos de tener el usuario
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (user && !hasChecked) {
        checkStatus()
      }
    })

    return () => unsubscribe()
  }, [tourId, hasChecked])

  const handleJoyrideCallback = async (data: EventData) => {
    const { status, type } = data
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]

    if (finishedStatuses.includes(status) || type === EVENTS.TOUR_END) {
      setRun(false)

      // Save to localStorage immediately (failsafe)
      markTourCompleted(tourId)

      // Also persist to backend
      try {
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()

        await fetch('/api/users/complete-onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tourId }),
        })
      } catch (error) {
        console.error('Error completing onboarding:', error)
      }
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      scrollToFirstStep={true}
      onEvent={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
      options={{
        zIndex: 10000,
        primaryColor: '#10b981',
        arrowColor: '#ffffff',
        overlayColor: 'rgba(0, 0, 0, 0.65)',
      }}
    />
  )
}
