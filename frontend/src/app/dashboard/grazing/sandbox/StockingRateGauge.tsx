/**
 * StockingRateGauge.tsx — Mini gauge de carga animal y métricas forrajeras
 * ─────────────────────────────────────────────────────────────────────────
 * SVG circular arc sobrio que muestra EV/ha actual vs. límite óptimo (1.5).
 * Diseño: tokens verdes de RODEO, tipografía Inter, sin glassmorphism.
 */
'use client'

import React, { useMemo } from 'react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'

// ── SVG Arc helper ────────────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polarToXY(cx, cy, r, startDeg)
  const e = polarToXY(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

// ── Constantes del gauge ──────────────────────────────────────────────────────

const CX = 56
const CY = 56
const R  = 42
const START_DEG  = -150   // izquierda del arco
const END_DEG    =  150   // derecha del arco
const RANGE_DEG  = END_DEG - START_DEG   // 300°
const MAX_CARGA  = 4      // EV/ha donde el gauge se llena al 100%
const OPTIMO_CARGA = 1.5  // límite verde

// ── Componente ────────────────────────────────────────────────────────────────

export default function StockingRateGauge() {
  const balance = useSandboxStore(s => s.result?.balance)

  const cargaEvHa   = balance?.cargaEvHa   ?? 0
  const cargaStatus = balance?.cargaStatus ?? 'optimo'
  const totalAreaHa = balance?.totalAreaHa ?? 0
  const totalEV     = balance?.totalEV     ?? 0
  const diasCobertura    = balance?.diasCoberturaForrajera ?? 0
  const balanceStatus    = balance?.balanceStatus ?? 'ajustado'
  const ofertaKgMs       = balance?.ofertaKgMs ?? 0

  const { fillColor, textColor, statusLabel, badgeBg } = useMemo(() => {
    switch (cargaStatus) {
      case 'optimo':
        return { fillColor: '#008234', textColor: '#15803d', statusLabel: 'Óptimo', badgeBg: 'bg-green-100 text-green-800' }
      case 'moderado':
        return { fillColor: '#ca8a04', textColor: '#92400e', statusLabel: 'Moderado', badgeBg: 'bg-amber-100 text-amber-800' }
      case 'sobrepastoreo':
        return { fillColor: '#dc2626', textColor: '#991b1b', statusLabel: 'Sobrepastoreo', badgeBg: 'bg-red-100 text-red-800' }
    }
  }, [cargaStatus])

  const { balanceColor, balanceLabel } = useMemo(() => {
    switch (balanceStatus) {
      case 'superavit':  return { balanceColor: 'text-green-700',  balanceLabel: 'Superávit' }
      case 'ajustado':   return { balanceColor: 'text-amber-600',  balanceLabel: 'Ajustado'  }
      case 'deficit':    return { balanceColor: 'text-red-600',    balanceLabel: 'Déficit'    }
    }
  }, [balanceStatus])

  // Ángulo del fill del gauge
  const fillPct    = Math.min(1, cargaEvHa / MAX_CARGA)
  const fillEndDeg = START_DEG + RANGE_DEG * fillPct

  // Arco del límite óptimo (marca verde)
  const optimalPct    = Math.min(1, OPTIMO_CARGA / MAX_CARGA)
  const optimalDeg    = START_DEG + RANGE_DEG * optimalPct

  const trackPath = arcPath(CX, CY, R, START_DEG, END_DEG)
  const fillPath  = cargaEvHa > 0 ? arcPath(CX, CY, R, START_DEG, fillEndDeg) : null
  const optDot    = polarToXY(CX, CY, R, optimalDeg)

  return (
    <div className="flex items-start gap-4">

      {/* ── Gauge SVG ── */}
      <div className="flex flex-col items-center shrink-0">
        <svg width={112} height={90} viewBox="0 0 112 90" aria-label={`Carga animal: ${cargaEvHa} EV/ha`}>
          {/* Track (fondo gris) */}
          <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={8} strokeLinecap="round" />

          {/* Fill (carga actual) */}
          {fillPath && (
            <path d={fillPath} fill="none" stroke={fillColor} strokeWidth={8} strokeLinecap="round" />
          )}

          {/* Marca del límite óptimo */}
          <circle cx={optDot.x} cy={optDot.y} r={4} fill="#16a34a" stroke="white" strokeWidth={1.5} />

          {/* Valor central */}
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize={16} fontWeight="800" fill={textColor} fontFamily="Inter, sans-serif">
            {cargaEvHa > 0 ? cargaEvHa.toFixed(1) : '—'}
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize={8} fontWeight="600" fill="#9ca3af" fontFamily="Inter, sans-serif">
            EV / ha
          </text>

          {/* Labels MIN / MAX */}
          <text x={14} y={82} textAnchor="middle" fontSize={7} fill="#d1d5db" fontFamily="Inter, sans-serif">0</text>
          <text x={98} y={82} textAnchor="middle" fontSize={7} fill="#d1d5db" fontFamily="Inter, sans-serif">{MAX_CARGA}</text>
        </svg>

        {/* Badge de status */}
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeBg} -mt-2`}>
          {statusLabel}
        </span>
        <span className="text-[9px] text-gray-400 mt-1">Límite óptimo: {OPTIMO_CARGA} EV/ha</span>

        {/* Alerta sobrepastoreo */}
        {cargaStatus === 'sobrepastoreo' && (
          <p className="text-[9px] text-red-500 font-medium mt-1 text-center max-w-[110px] leading-tight">
            ⚠ Carga por encima del nivel regenerativo ideal.
          </p>
        )}
      </div>

      {/* ── Métricas ── */}
      <div className="flex flex-col gap-2 justify-center pt-1">

        <MetricRow label="Superficie activa" value={totalAreaHa > 0 ? `${totalAreaHa.toFixed(1)} ha` : '—'} />
        <MetricRow label="EV totales" value={totalEV > 0 ? `${totalEV.toFixed(1)} EV` : '—'} />

        <div className="h-px bg-gray-100 my-0.5" />

        {/* Forraje utilizable */}
        <MetricRow
          label="Forraje utilizable"
          value={ofertaKgMs > 0 ? `${(ofertaKgMs / 1000).toFixed(1)} t MS` : '—'}
        />

        {/* Cobertura del plan: fracción X / Y días */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-medium w-[90px] leading-tight">Cobertura del plan</span>
          <span className="text-[11px] font-black text-gray-700">
            {diasCobertura > 0
              ? <><span className={balanceColor}>{diasCobertura}</span><span className="text-gray-400 font-semibold"> / {balance?.diasPeriodo ?? 365} días</span></>
              : '—'
            }
          </span>
        </div>

        {/* Balance forrajero: diferencia real en toneladas */}
        {ofertaKgMs > 0 && balance?.demandaKgMs != null && balance.demandaKgMs > 0 && (() => {
          const diffT = (ofertaKgMs - balance.demandaKgMs) / 1000
          const isPositive = diffT >= 0
          return (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-medium w-[90px] leading-tight">Balance</span>
              <span className={`text-[11px] font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '🟢' : '🔴'}
                {' '}
                {isPositive ? 'Superávit' : 'Déficit'} de {Math.abs(diffT).toFixed(1)} t MS
              </span>
            </div>
          )
        })()}

      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 font-medium w-[90px] leading-tight">{label}</span>
      <span className="text-[11px] font-black text-gray-700">{value}</span>
    </div>
  )
}
