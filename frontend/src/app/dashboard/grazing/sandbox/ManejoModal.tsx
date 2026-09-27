/**
 * ManejoModal.tsx — Modal de Análisis de Manejo
 * ───────────────────────────────────────────────
 * Presents 3 management strategy cards when paddock size asymmetry is detected.
 * "Probar Subdivisión" divides the oversized paddock into temporary sub-rows
 * in the Zustand store draft state — no DB write occurs.
 */
'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Scissors, ShieldCheck, Zap } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeterogeneidadWarning {
  potreroMax: string
  potreroMin: string
  ratio: number
  suggestion: string
}

interface Props {
  open:     boolean
  onClose:  () => void
  heterog:  HeterogeneidadWarning
}

// ── Strategy Card ─────────────────────────────────────────────────────────────

interface StrategyCardProps {
  icon:        React.ReactNode
  title:       string
  description: string
  badge?:      string
  badgeColor?: string
  action?:     React.ReactNode
  highlight?:  boolean
}

function StrategyCard({
  icon, title, description, badge, badgeColor = 'bg-gray-100 text-gray-600',
  action, highlight,
}: StrategyCardProps) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
      highlight
        ? 'border-green-300 bg-green-50/60 shadow-sm shadow-green-100'
        : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          highlight ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black text-gray-800 leading-tight">{title}</h3>
            {badge && (
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{description}</p>
        </div>
      </div>

      {/* Action */}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ManejoModal({ open, onClose, heterog }: Props) {
  const subdivideRow = useSandboxStore(s => s.subdivideRow)
  const paddockRows  = useSandboxStore(s => s.paddockRows)

  // Find the oversized paddock by name
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
    if (oversizedPaddock) {
      subdivideRow(oversizedPaddock.id, 3)
    }
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pb-20 md:pb-4"
      style={{
        backdropFilter: 'blur(8px) saturate(0.8)',
        WebkitBackdropFilter: 'blur(8px) saturate(0.8)',
        backgroundColor: 'rgba(0,0,0,0.45)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-gray-900 leading-tight">
              Análisis de Manejo
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              El lote <strong className="text-gray-700">{heterog.potreroMax}</strong> es {heterog.ratio}× el promedio.
              Elegí cómo manejar esta asimetría:
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

        {/* ── Cards ── */}
        <div className="px-5 py-4 flex flex-col gap-3">

          {/* 1 — Proteger Chicos */}
          <StrategyCard
            icon={<ShieldCheck size={16} className="text-blue-600" />}
            title="Proteger Chicos (Prioridad Pasto)"
            badge="Sin cambios"
            badgeColor="bg-blue-100 text-blue-700"
            description="El sistema prioriza el descanso de los potreros chicos, evitando encañamiento. Generará presión extra en los potreros grandes y puede provocar sobrepastoreo en lotes con mucha superficie."
          />

          {/* 2 — Proteger Grandes */}
          <StrategyCard
            icon={<Zap size={16} className="text-orange-500" />}
            title="Proteger Grandes (Prioridad Animal)"
            badge="Sin cambios"
            badgeColor="bg-orange-100 text-orange-700"
            description="El lote grande descansa el tiempo completo y el animal se alimenta bien, pero los potreros chicos salen con menos calidad forrajera por encañamiento o subpastoreo."
          />

          {/* 3 — Subdivisión Óptima ← RECOMMENDED */}
          <StrategyCard
            highlight
            icon={<Scissors size={16} className="text-green-700" />}
            title="El Plan Óptimo (Subdivisión)"
            badge="Recomendado"
            badgeColor="bg-green-100 text-green-700"
            description={`Sugerimos dividir "${heterog.potreroMax}" en 3 parcelas con boyero eléctrico. Esto iguala los coeficientes de la célula, maximiza la eficiencia de cosecha y asegura el descanso en cada parcela.`}
            action={
              <button
                id="manejo-modal-subdivide-btn"
                type="button"
                onClick={handleSubdivide}
                disabled={!oversizedPaddock}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                           text-sm font-black text-white bg-[#008234] hover:bg-[#006026]
                           rounded-xl transition-all shadow-sm
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Scissors size={14} />
                Probar Subdivisión
              </button>
            }
          />
        </div>

        {/* ── Footer note ── */}
        <div className="px-5 pb-5">
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            Los cambios son solo un borrador. Nada se guarda hasta que presiones{' '}
            <span className="font-bold text-gray-500">Generar Plan</span>.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
