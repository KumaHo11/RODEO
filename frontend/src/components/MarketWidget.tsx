'use client'

import React, { useEffect, useState } from 'react'
import { DollarSign, MapPin, Loader2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

function fmt(n: number, digits = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// Build a normalized SVG polyline path from an array of values
function buildSparkPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = w / (values.length - 1)
  return values.map((v, i) => {
    const x = (i * step).toFixed(1)
    const y = (h - ((v - min) / range) * (h - 4) - 2).toFixed(1)
    return `${x},${y}`
  }).join(' ')
}

export function MarketWidget() {
  const [mercado, setMercado] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/mercado')
        if (res.ok) setMercado(await res.json())
      } catch (err) {
        console.error('[MarketWidget] fetch error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const arg = mercado?.argentina
  const global = mercado?.global
  const hasArgData = arg?.insc_kg_vivo && arg.insc_kg_vivo > 0
  const currentPrice = hasArgData ? arg.insc_kg_vivo : null

  // ── Sparkline selection (prefer real Argentine history) ──────────────────────
  // argentina.history → real INMAG prices fetched from MAG Cañuelas, accumulated daily
  // global.leHistory   → real CME Live Cattle closes (USD/cwt) — shape only
  const argHistory: Array<{ date: string; price: number }> = arg?.history ?? []
  const leHistory: number[] = global?.leHistory ?? []

  const useArgHistory = argHistory.length >= 2
  const useLeHistory = !useArgHistory && leHistory.length >= 2

  const sparkValues = useArgHistory
    ? argHistory.map(h => h.price)
    : useLeHistory
      ? leHistory
      : []

  // Variation: first vs last point
  const variation = sparkValues.length >= 2
    ? ((sparkValues[sparkValues.length - 1] - sparkValues[0]) / sparkValues[0]) * 100
    : null

  const isUp = variation !== null && variation > 0.05
  const isDown = variation !== null && variation < -0.05
  const trendColor = isUp ? '#16a34a' : isDown ? '#dc2626' : '#6b7280'

  // Source label
  const sparkLabel = useArgHistory
    ? `${argHistory.length}d real INMAG`
    : useLeHistory
      ? `${leHistory.length}d CME LE`
      : null

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-center items-center h-40">
        <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
        <p className="text-xs text-gray-400 mt-2 font-bold">Consultando mercado...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mercado ganadero</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {arg?.error && (
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Est.</span>
          )}
          <div className="flex items-center gap-1 text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
            <MapPin className="w-2.5 h-2.5" /> MAG Cañuelas
          </div>
        </div>
      </div>

      {/* Main price + sparkline row */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mb-1.5">INMAG — Índice novillo</p>
          {hasArgData ? (
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <p className="text-2xl font-black text-gray-900 leading-none">
                ${fmt(currentPrice!)}
                <span className="text-xs font-bold text-gray-400 ml-1">/kg vivo</span>
              </p>
              {/* Variation badge */}
              {variation !== null && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isUp ? 'bg-green-50 text-green-700' :
                  isDown ? 'bg-red-50 text-red-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> :
                   isDown ? <TrendingDown className="w-3 h-3" /> :
                   <Minus className="w-3 h-3" />}
                  {isUp ? '+' : ''}{variation.toFixed(1)}%
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-gray-400">No disponible</p>
          )}

          <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
            {arg?.fuente || ''}
            {arg?.fecha && <span className="ml-1 opacity-60">· {arg.fecha}</span>}
          </p>
        </div>

        {/* Sparkline SVG */}
        {sparkValues.length >= 2 && (
          <div className="shrink-0 flex flex-col items-end">
            <svg width="80" height="32" className="overflow-visible">
              <polyline
                points={buildSparkPath(sparkValues, 78, 30)}
                fill="none"
                stroke={trendColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              />
              {/* Dot at latest value */}
              {(() => {
                const v = sparkValues[sparkValues.length - 1]
                const min = Math.min(...sparkValues), max = Math.max(...sparkValues)
                const range = max - min || 1
                const y = 30 - ((v - min) / range) * 26 - 2
                return <circle cx="78" cy={y} r="2.5" fill={trendColor} />
              })()}
            </svg>
            {sparkLabel && (
              <p className="text-[8px] text-gray-400 font-medium mt-0.5">{sparkLabel}</p>
            )}
          </div>
        )}
      </div>

      {/* Global markets strip */}
      {(global?.LE_usd_cwt || global?.usd_ars) && (
        <div className="pt-3 border-t border-gray-50 flex items-center gap-4 flex-wrap">
          {global.LE_usd_cwt && (
            <div>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">CME Live Cattle</p>
              <p className="text-xs font-black text-gray-700">
                ${fmt(global.LE_usd_cwt, 2)} <span className="text-gray-400 font-normal">USD/cwt</span>
              </p>
            </div>
          )}
          {global.usd_ars && (
            <div>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">USD/ARS</p>
              <p className="text-xs font-black text-gray-700">${fmt(global.usd_ars, 0)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
