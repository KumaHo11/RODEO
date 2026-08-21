'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { MonthlyPoint } from '../hooks/useTimeMachine'

interface TimeChartProps {
  data: MonthlyPoint[]
  baseline: number | null
  metricType: string
}

export function TimeChart({ data, baseline, metricType }: TimeChartProps) {
  const isNDVI = metricType === 'NDVI'
  const isEVI = metricType === 'EVI'
  
  return (
    <div className="w-full h-[300px] overflow-x-auto overflow-y-hidden">
      <div style={{ minWidth: Math.max(800, data.length * 20), height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            axisLine={false} 
            tickLine={false} 
            dy={10}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            axisLine={false} 
            tickLine={false} 
            dx={-10}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
          />
          {baseline !== null && (
            <ReferenceLine 
              y={baseline} 
              stroke="#ef4444" 
              strokeDasharray="3 3" 
              label={{ position: 'top', value: 'Baseline EUDR 2020', fill: '#ef4444', fontSize: 12 }} 
            />
          )}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={isEVI ? '#86efac' : '#22c55e'} 
            strokeWidth={2} 
            dot={{ r: 4, strokeWidth: 2 }} 
            activeDot={{ r: 6 }} 
            strokeDasharray={isEVI ? '5 5' : undefined}
            name={metricType}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
