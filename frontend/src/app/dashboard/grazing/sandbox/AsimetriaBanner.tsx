/**
 * AsimetriaBanner.tsx — Banner de Alerta de Asimetría de Tamaños
 * ──────────────────────────────────────────────────────────────
 * Non-blocking alert shown above SandboxTable when the simulation
 * engine detects extreme size heterogeneity (Calidad Relativa > 1.8).
 *
 * Clicking "Analizar alternativas de manejo" opens ManejoModal.
 */
'use client'

import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import ManejoModal from './ManejoModal'

export default function AsimetriaBanner() {
  const result       = useSandboxStore(s => s.result)
  const heterog      = result?.heterogeneidadExtrema

  const [dismissed, setDismissed] = useState(false)
  const [modalOpen,  setModalOpen] = useState(false)

  // Only show when there is an active heterogeneity warning AND the user hasn't dismissed it
  if (!heterog || dismissed) return null

  return (
    <>
      <div
        role="alert"
        className="flex items-start gap-2.5 px-3 py-2.5 mx-0 mb-2 rounded-xl
                   border border-amber-200 bg-amber-50 text-amber-800 shrink-0
                   animate-[fadeSlideDown_0.25s_ease]"
      >
        {/* Icon */}
        <AlertTriangle
          size={14}
          className="text-amber-500 mt-0.5 shrink-0"
          aria-hidden
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold leading-snug">
            Detectamos asimetría en los tamaños de los potreros
            <span className="font-normal text-amber-700">
              {' '}({heterog.potreroMax} es {heterog.ratio}× el promedio).
              Esto puede provocar sobrepastoreo en lotes grandes y pérdida de calidad en los chicos.
            </span>
          </p>

          <button
            id="asimetria-banner-cta"
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-1 text-[11px] font-black text-amber-700 underline
                       underline-offset-2 decoration-amber-400 hover:text-amber-900
                       hover:decoration-amber-600 transition-colors"
          >
            👉 Analizar alternativas de manejo
          </button>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-400 hover:text-amber-700 transition-colors p-0.5 -mt-0.5"
          aria-label="Descartar aviso"
          title="Descartar"
        >
          <X size={13} />
        </button>
      </div>

      {/* Modal */}
      <ManejoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        heterog={heterog}
      />
    </>
  )
}
