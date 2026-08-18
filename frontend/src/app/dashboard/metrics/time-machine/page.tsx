'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Activity, TrendingUp, AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useTimeMachine } from '../hooks/useTimeMachine'
import { TimeChart } from '../components/TimeChart'
import { TimeSlider } from '../components/TimeSlider'

const METRICS = ['NDVI', 'EVI', 'SAVI', 'NDMI']

export default function TimeMachinePage() {
  const [paddocks, setPaddocks] = useState<{ id: string, name: string }[]>([])
  const [selectedPaddock, setSelectedPaddock] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string>('NDVI')
  const [sliderIndex, setSliderIndex] = useState(0)
  const [isBackfilling, setIsBackfilling] = useState(false)

  const { monthlyData, baseline, loading, error } = useTimeMachine(selectedPaddock, selectedMetric)

  useEffect(() => {
    async function loadPaddocks() {
      try {
        const res = await apiFetch('/api/paddocks')
        if (res.ok) {
          const data = await res.json()
          if (data.paddocks && data.paddocks.length > 0) {
            setPaddocks(data.paddocks)
            setSelectedPaddock(data.paddocks[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load paddocks', err)
      }
    }
    loadPaddocks()
  }, [])

  useEffect(() => {
    if (monthlyData.length > 0) {
      setSliderIndex(monthlyData.length - 1)
    } else {
      setSliderIndex(0)
    }
  }, [monthlyData])

  const handleBackfill = async () => {
    if (!selectedPaddock) return
    setIsBackfilling(true)
    try {
      const res = await fetch('/api/metrics/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paddock_id: selectedPaddock, year_from: 2020 }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al iniciar el backfill.')
      } else if (data.background) {
        alert('⏳ Backfill iniciado en segundo plano. Los datos aparecerán en 1-2 minutos. Recargá la página.')
      } else {
        alert(`✅ Backfill completado: ${data.inserted ?? 0} snapshots nuevos generados.`)
      }
    } catch (err) {
      console.error(err)
      alert('Error al conectar con el servidor')
    } finally {
      setIsBackfilling(false)
    }
  }

  const currentPoint = monthlyData[sliderIndex]
  const currentValue = currentPoint?.value ?? 0
  const pctChange = baseline && baseline !== 0 
    ? ((currentValue - baseline) / baseline) * 100 
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Time Machine · Evolución histórica
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Análisis retrospectivo desde el 2020 para cumplimiento EUDR y evolución de métricas
          </p>
        </div>
        <Link href="/dashboard/metrics" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Potrero</label>
          <select 
            value={selectedPaddock || ''} 
            onChange={(e) => setSelectedPaddock(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none"
          >
            {paddocks.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Métrica</label>
          <select 
            value={selectedMetric} 
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none"
          >
            {METRICS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500">Cargando datos históricos...</div>
      ) : monthlyData.length === 0 && selectedPaddock ? (
        /* Empty State */
        <div className="flex flex-col items-center gap-4 py-16 text-center bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
          <Clock className="w-12 h-12 text-gray-300" />
          <div>
            <p className="font-semibold text-gray-700">No hay historial para este potrero</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              El análisis histórico requiere generar snapshots mes a mes desde el 2020 hasta la fecha.
            </p>
          </div>
          <button 
            onClick={handleBackfill}
            disabled={isBackfilling}
            className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isBackfilling ? 'Generando historial...' : 'Generar Historial (Backfill)'}
          </button>
        </div>
      ) : monthlyData.length > 0 && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Baseline 2020
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {baseline !== null ? baseline.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Valor Actual
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {currentValue.toFixed(2)}
              </span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Δ Mejora %
              </span>
              <span className={`text-2xl font-bold ${pctChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <TimeChart data={monthlyData} baseline={baseline} metricType={selectedMetric} />
            <TimeSlider 
              data={monthlyData} 
              selectedIndex={sliderIndex} 
              onChange={setSliderIndex} 
              metricType={selectedMetric} 
            />
          </div>
        </>
      )}
    </div>
  )
}
