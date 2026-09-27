/**
 * ManejoModal.tsx — Modal de Análisis de Manejo
 * ───────────────────────────────────────────────
 * Wide (max-w-5xl), horizontal 3-col layout.
 * Opciones 1 & 2 apply an anchorMode to the store (functional).
 * Opción 3 triggers subdivideRow (recommended, green).
 */
'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Scissors, ShieldCheck, TrendingUp, Check } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeterogeneidadWarning {
  potreroMax: string
  potreroMin: string
  ratio: number
  suggestion: string
}

interface Props {
  open:    boolean
  onClose: () => void
  heterog: HeterogeneidadWarning
}

// ── Strategy Card ─────────────────────────────────────────────────────────────

interface StrategyCardProps {
  icon:        React.ReactNode
  title:       string
  trade:       string   // one-liner tradeoff
  description: string
  badge?:      string
  badgeColor?: string
  action:      React.ReactNode
  highlight?:  boolean
  applied?:    boolean
}

function StrategyCard({
  icon, title, trade, description, badge,
  badgeColor = 'bg-gray-100 text-gray-500',
  action, highlight, applied,
}: StrategyCardProps) {
  return (
    <div className={`relative flex flex-col gap-3 rounded-xl border p-4 transition-all h-full ${
      highlight
        ? 'border-green-300 bg-green-50/60 shadow-sm shadow-green-100'
        : applied
          ? 'border-blue-200 bg-blue-50/40'
          : 'border-gray-200 bg-white'
    }`}>
      {/* Applied check */}
      {applied && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase tracking-wider">
          <Check size={10} strokeWidth={3} /> Aplicado
        </span>
      )}

      {/* Icon — monochromatic, small */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
        highlight ? 'bg-green-100' : 'bg-gray-100'
      }`}>
        {icon}
      </div>

      {/* Title + badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-black text-gray-800 leading-tight">{title}</h3>
        {badge && (
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Tradeoff one-liner */}
      <p className={`text-[11px] font-semibold leading-snug ${
        highlight ? 'text-green-700' : 'text-gray-500'
      }`}>
        {trade}
      </p>

      {/* Full description */}
      <p className="text-[11px] text-gray-400 leading-relaxed flex-1">{description}</p>

      {/* Action button */}
      <div className="mt-auto pt-1">{action}</div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ManejoModal({ open, onClose, heterog }: Props) {
  const subdivideRow   = useSandboxStore(s => s.subdivideRow)
  const setAnchorMode  = useSandboxStore(s => s.setAnchorMode)
  const anchorMode     = useSandboxStore(s => s.anchorMode)
  const paddockRows    = useSandboxStore(s => s.paddockRows)

  const oversizedPaddock = paddockRows.find(p => p.name === heterog.potreroMax)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const handleSubdivide = () => {
    if (oversizedPaddock) subdivideRow(oversizedPaddock.id, 3)
    onClose()
  }

  const applyAnchor = (mode: 'min' | 'max') => {
    setAnchorMode(mode)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backdropFilter: 'blur(8px) saturate(0.8)',
        WebkitBackdropFilter: 'blur(8px) saturate(0.8)',
        backgroundColor: 'rgba(0,0,0,0.45)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-gray-900 leading-tight">
              Análisis de Manejo · Asimetría de Célula
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-2xl">
              <strong className="text-gray-700">{heterog.potreroMax}</strong> tiene un coeficiente{' '}
              <strong className="text-gray-700">{heterog.ratio}×</strong> mayor que{' '}
              <strong className="text-gray-700">{heterog.potreroMin}</strong>.
              {' '}Elegí cómo manejar esta asimetría — los cambios son solo un borrador hasta que presiones{' '}
              <strong className="text-gray-600">Generar Plan</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
                       hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Cards horizontales ── */}
        <div className="px-6 py-5 grid grid-cols-3 gap-4 items-stretch">

          {/* 1 — Proteger Chicos */}
          <StrategyCard
            icon={<ShieldCheck size={15} className="text-gray-500" />}
            title="Proteger Chicos"
            badge="Anclaje al mínimo"
            badgeColor="bg-gray-100 text-gray-600"
            trade="El ciclo se acorta. Los lotes chicos descansan perfecto, pero el grande sufre sobrepastoreo."
            description="El sistema prioriza el descanso de los potreros chicos, evitando encañamiento. Genera presión extra en el potrero grande y puede derivar en sobrepastoreo en lotes de mucha superficie."
            applied={anchorMode === 'min'}
            action={
              <button
                id="manejo-modal-apply-min"
                type="button"
                onClick={() => applyAnchor('min')}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2
                           text-sm font-bold rounded-xl border transition-all ${
                  anchorMode === 'min'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {anchorMode === 'min' ? <><Check size={13} strokeWidth={3} /> Aplicado</> : 'Aplicar'}
              </button>
            }
          />

          {/* 2 — Proteger Grandes */}
          <StrategyCard
            icon={<TrendingUp size={15} className="text-gray-500" />}
            title="Proteger Grandes"
            badge="Anclaje al máximo"
            badgeColor="bg-orange-50 text-orange-600"
            trade="El ciclo se estira. El lote grande descansa bien, pero los chicos se encañan."
            description="El lote grande descansa el tiempo completo y el animal se alimenta bien. Los potreros chicos salen con menor calidad forrajera por encañamiento o subpastoreo excesivo."
            applied={anchorMode === 'max'}
            action={
              <button
                id="manejo-modal-apply-max"
                type="button"
                onClick={() => applyAnchor('max')}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2
                           text-sm font-bold rounded-xl border transition-all ${
                  anchorMode === 'max'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {anchorMode === 'max' ? <><Check size={13} strokeWidth={3} /> Aplicado</> : 'Aplicar'}
              </button>
            }
          />

          {/* 3 — Subdivisión Óptima ← RECOMENDADO */}
          <StrategyCard
            highlight
            icon={<Scissors size={15} className="text-green-700" />}
            title="Subdivisión con Boyero"
            badge="Recomendado"
            badgeColor="bg-green-100 text-green-700"
            trade="Iguala los coeficientes. Todos los potreros descansan y se pastorean con la misma eficiencia."
            description={`Divide "${heterog.potreroMax}" en 3 parcelas iguales con boyero eléctrico. Maximiza la eficiencia de cosecha, iguala los coeficientes de la célula y asegura el descanso óptimo en cada parcela.`}
            action={
              <button
                id="manejo-modal-subdivide-btn"
                type="button"
                onClick={handleSubdivide}
                disabled={!oversizedPaddock}
                className="w-full flex items-center justify-center gap-2 px-4 py-2
                           text-sm font-black text-white bg-[#008234] hover:bg-[#006026]
                           rounded-xl transition-all shadow-sm
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Scissors size={13} />
                Probar Subdivisión
              </button>
            }
          />
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5">
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            Opciones 1 y 2 ajustan el criterio del motor de simulación · Opción 3 divide el potrero en parcelas de prueba en el borrador.
            Nada se guarda hasta que presiones <span className="font-bold text-gray-500">Generar Plan</span>.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
