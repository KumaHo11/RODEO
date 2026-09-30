'use client'
import { dbDelete } from '@/lib/offline/db'

/**
 * HerdDeleteDialog — Modal de confirmación full-screen para eliminar un rodeo.
 *
 * Usa ReactDOM.createPortal → se monta en document.body.
 * Esto garantiza que el overlay cubre TODO: nav lateral, header principal,
 * sidebar de rodeos. El backdrop usa backdrop-blur para el efecto de blur total.
 *
 * UX:
 *  - Foco por defecto en "No" (acción segura)
 *  - Escape cierra (= "No")
 *  - Click en backdrop cierra (= "No")
 *  - "Sí" → DELETE /api/herds/:id → limpia IDB → redirect
 */

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

interface HerdDeleteDialogProps {
  herdId:    string
  herdName:  string
  open:      boolean
  onClose:   () => void
  onDeleted: () => void
}

export function HerdDeleteDialog({
  herdId,
  herdName,
  open,
  onClose,
  onDeleted,
}: HerdDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [mounted,  setMounted]  = useState(false)
  const noButtonRef = useRef<HTMLButtonElement>(null)

  // Solo montar en cliente (SSR safety para createPortal)
  useEffect(() => { setMounted(true) }, [])

  // Auto-focus en "No" cuando se abre
  useEffect(() => {
    if (open) {
      setError(null)
      setTimeout(() => noButtonRef.current?.focus(), 60)
    }
  }, [open])

  // Escape → cerrar (acción segura)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/herds/${herdId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Error ${res.status}`)
      }
      await dbDelete('herds', herdId).catch(() => {})
      window.dispatchEvent(new Event('herd_saved'))
      onDeleted()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo eliminar el rodeo')
      setDeleting(false)
    }
  }

  if (!mounted || !open) return null

  const dialog = (
    /*
     * fixed inset-0 z-[99999]: cubre absolutamente todo, incluyendo el nav
     * lateral (z-index ~40 en DashboardLayout) y el header (~50).
     * createPortal lo coloca como hijo directo de <body>, escapando cualquier
     * stacking context del árbol de React.
     */
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="herd-delete-title"
    >
      {/* ── Backdrop con blur total ──────────────────────────────────── */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Panel del diálogo ─────────────────────────────────────────── */}
      <div className="
        relative z-10 w-full max-w-sm mx-4
        bg-white rounded-2xl
        shadow-[0_24px_64px_rgba(0,0,0,0.18)]
        border border-gray-100
        p-6
        animate-[fadeInUp_150ms_ease-out_both]
      ">

        {/* Ícono + título */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2
              id="herd-delete-title"
              className="text-base font-black text-gray-900 leading-snug"
            >
              ¿Desea borrar el rodeo?
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              <span className="font-bold text-gray-700">&ldquo;{herdName}&rdquo;</span>{' '}
              será eliminado permanentemente.
            </p>
          </div>
        </div>

        {/* Error inline */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-bold text-red-700">{error}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center gap-3 justify-end">
          {/* No — foco por defecto */}
          <button
            ref={noButtonRef}
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="
              px-5 py-2.5 rounded-xl text-sm font-bold
              text-gray-700 bg-gray-100
              hover:bg-gray-200 transition-all
              disabled:opacity-50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
            "
          >
            No
          </button>

          {/* Sí — destructivo */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="
              flex items-center gap-2 px-5 py-2.5 rounded-xl
              text-sm font-bold text-white
              bg-red-600 hover:bg-red-700
              transition-all shadow-sm shadow-red-200
              disabled:opacity-60 disabled:cursor-not-allowed
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500
            "
          >
            {deleting
              ? <><Loader2 className="w-4 h-4 animate-spin" />Eliminando…</>
              : <><Trash2 className="w-4 h-4" />Sí</>
            }
          </button>
        </div>
      </div>
    </div>
  )

  // createPortal → se monta en <body>, fuera de cualquier stacking context
  return createPortal(dialog, document.body)
}
