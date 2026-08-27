'use client'

import React from 'react'
import { MonthlyPoint } from '../hooks/useTimeMachine'

interface TimeSliderProps {
  data: MonthlyPoint[]
  selectedIndex: number
  onChange: (index: number) => void
  metricType: string
}

export function TimeSlider({ data, selectedIndex, onChange, metricType }: TimeSliderProps) {
  if (data.length === 0) return null

  const currentPoint = data[selectedIndex]
  const previousPoint = selectedIndex > 0 ? data[selectedIndex - 1] : null
  
  let trend = null
  if (previousPoint && previousPoint.value !== 0) {
    const change = ((currentPoint.value - previousPoint.value) / Math.abs(previousPoint.value)) * 100
    trend = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
  }

  return (
    <div className="flex flex-col gap-4 mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div className="flex justify-between items-center text-sm font-medium text-gray-700">
        <span>{data[0].month}</span>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{currentPoint.month}</p>
          <p className="text-emerald-600">
            {metricType}: {currentPoint.value.toFixed(2)}
            {trend && <span className="ml-2 text-xs text-gray-500">({trend})</span>}
          </p>
        </div>
        <span>{data[data.length - 1].month}</span>
      </div>
      <input
        type="range"
        min={0}
        max={data.length - 1}
        value={selectedIndex}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
      />
    </div>
  )
}
