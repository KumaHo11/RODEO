/**
 * AsimetriaBanner.tsx — Banner de Alerta de Asimetría de Tamaños
 * ──────────────────────────────────────────────────────────────
 * Colapsable por defecto: muestra solo el título + caret para expandir.
 * Color muy tenue (amarillo pastel) para indicar sugerencia, no error.
 * El botón X descarta el banner definitivamente.
 */
'use client'

import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, X } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import ManejoModal from './ManejoModal'

export default function AsimetriaBanner() {
  const result  = useSandboxStore(s => s.result)
  const heterog = result?.heterogeneidadExtrema

  const [dismissed, setDismissed] = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Solo se muestra cuando hay advertencia activa y el usuario no la descartó
  if (!heterog || dismissed) return null

  return (
    <>
      <div
        role="alert"
        aria-expanded={expanded}
        className="mx-0 mb-2 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 shrink-0 overflow-hidden animate-[fadeSlideDown_0.25s_ease]"
      >
        {/* ── Cabecera siempre visible (click para colapsar/expandir) ── */}
        <div className="flex items-center gap-2 px-3 py-2">
          <AlertTriangle
            size={13}
            className="text-yellow-500 shrink-0"
            aria-hidden
          />

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center gap-1.5 text-left text-[11px] font-semibold leading-snug text-yellow-800 hover:text-yellow-900 transition-colors"
            aria-controls="asimetria-body"
          >
            Detectamos asimetría en los tamaños de los potreros
            <ChevronDown
              size={13}
              className={`shrink-0 text-yellow-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-yellow-400 hover:text-yellow-700 transition-colors p-0.5"
            aria-label="Descartar aviso"
            title="Descartar"
          >
            <X size={12} />
          </button>
        </div>

        {/* ── Cuerpo expandible ── */}
        {expanded && (
          <div
            id="asimetria-body"
            className="px-3 pb-2.5 border-t border-yellow-100"
          >
            <p className="text-[11px] text-yellow-700 leading-relaxed mt-2">
              <span className="font-semibold">{heterog.potreroMax}</span> es{' '}
              <span className="font-semibold">{heterog.ratio}×</span> el promedio.
              Esto puede provocar sobrepastoreo en lotes grandes y pérdida de
              calidad en los chicos.
            </p>
            <button
              id="asimetria-banner-cta"
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-2 text-[11px] font-black text-yellow-700 underline underline-offset-2
                         decoration-yellow-400 hover:text-yellow-900 hover:decoration-yellow-600
                         transition-colors"
            >
              👉 Analizar alternativas de manejo
            </button>
          </div>
        )}
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
