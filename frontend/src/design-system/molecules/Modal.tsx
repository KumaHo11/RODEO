/**
 * RODEO Design System — Modal Molecule
 * ─────────────────────────────────────
 * Contenedor modal estándar con overlay, header y footer.
 * Usa createPortal para evitar problemas de z-index y stacking context.
 */
'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface ModalProps {
  /** Controla la visibilidad */
  open: boolean;
  /** Callback para cerrar */
  onClose: () => void;
  /** Título en el header */
  title: string;
  /** Subtítulo opcional en el header */
  subtitle?: string;
  /** Ancho máximo del modal */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  /** Contenido del modal */
  children: React.ReactNode;
  /** Footer (normalmente los botones de acción) */
  footer?: React.ReactNode;
}

const MAX_WIDTHS: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'md',
  children,
  footer,
}: ModalProps) {
  // Lock scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={twMerge(
          'relative bg-white rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]',
          'w-full flex flex-col max-h-[92vh]',
          'animate-in zoom-in-95 fade-in duration-200',
          MAX_WIDTHS[maxWidth]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2
              id="modal-title"
              className="text-base font-black text-gray-950 tracking-tight"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
