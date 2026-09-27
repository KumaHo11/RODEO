/**
 * RODEO Design System — ConfirmDialog Molecule
 * ─────────────────────────────────────────────
 * Modal de confirmación con estilo premium.
 * Soporta:  título, descripción, items (lista), variante de peligro
 */
'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { Button } from '../atoms/Button'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** Título del modal */
  title: string
  /** Descripción/subtítulo */
  description?: string
  /** Lista de items a mostrar (e.g. advertencias) */
  items?: string[]
  /** Texto del botón de confirmar */
  confirmLabel?: string
  /** Texto del botón de cancelar */
  cancelLabel?: string
  /** Variante visual */
  variant?: 'default' | 'warning' | 'danger'
  /** Loading state del botón confirm */
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  items,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const iconMap = {
    default: <CheckCircle className="w-6 h-6 text-green-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    danger: <AlertTriangle className="w-6 h-6 text-red-500" />,
  }

  const iconBgMap = {
    default: 'bg-green-50',
    warning: 'bg-amber-50',
    danger: 'bg-red-50',
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        style={{ backdropFilter: 'blur(8px) saturate(0.8)', WebkitBackdropFilter: 'blur(8px) saturate(0.8)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md animate-in zoom-in-95 fade-in duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors z-10"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="px-6 pt-6 pb-4">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl ${iconBgMap[variant]} flex items-center justify-center mb-4`}>
            {iconMap[variant]}
          </div>

          {/* Title */}
          <h3
            id="confirm-dialog-title"
            className="text-lg font-black text-gray-900 leading-tight"
          >
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {description}
            </p>
          )}

          {/* Items list */}
          {items && items.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto space-y-1.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 text-xs font-medium px-3 py-2 rounded-lg ${
                    variant === 'danger'
                      ? 'bg-red-50 text-red-700'
                      : variant === 'warning'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
