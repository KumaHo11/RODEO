'use client'

/**
 * ConfirmModal — Modal de confirmación reutilizable para acciones destructivas.
 *
 * Reemplaza window.confirm() con un componente React que:
 * - Es visualmente consistente con el design system
 * - Soporta contenido enriquecido (descripción del impacto)
 * - No bloquea el thread principal
 * - Es testeable automáticamente
 *
 * Uso:
 *   const { confirm, ConfirmModal } = useConfirm()
 *   // En render: <ConfirmModal />
 *   // En handler: const ok = await confirm({ title: '...', description: '...' })
 */
import { useState, useCallback, useRef } from 'react'
import { AlertTriangle, Trash2, X, Plus } from 'lucide-react'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info' | 'primary'
}

type ResolveCallback = (value: boolean) => void

export function useConfirm() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '¿Estás seguro?',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    variant: 'danger',
  })
  const resolveRef = useRef<ResolveCallback | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
      ...opts,
    })
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setOpen(false)
    resolveRef.current?.(true)
  }, [])

  const handleCancel = useCallback(() => {
    setOpen(false)
    resolveRef.current?.(false)
  }, [])

  const ConfirmModal = useCallback(() => {
    if (!open) return null

    const isWarning = options.variant === 'warning'
    const isInfo = options.variant === 'info'
    const isPrimary = options.variant === 'primary'

    const iconBg = isPrimary ? 'bg-purple-100' : isInfo ? 'bg-blue-100' : isWarning ? 'bg-amber-100' : 'bg-red-100'
    const iconColor = isPrimary ? 'text-purple-600' : isInfo ? 'text-blue-600' : isWarning ? 'text-amber-600' : 'text-red-600'
    const btnClass = isPrimary
      ? 'bg-purple-600 hover:bg-purple-700'
      : isInfo
      ? 'bg-blue-600 hover:bg-blue-700'
      : isWarning
      ? 'bg-amber-600 hover:bg-amber-700'
      : 'bg-red-600 hover:bg-red-700'

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pb-20 md:pb-4"
        style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel() }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              {isPrimary ? (
                <Plus className={`w-5 h-5 ${iconColor}`} />
              ) : isInfo ? (
                <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
              ) : (
                <Trash2 className={`w-5 h-5 ${iconColor}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-gray-900 leading-snug">{options.title}</h3>
              {options.description && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{options.description}</p>
              )}
            </div>
            <button
              onClick={handleCancel}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-2.5">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
            >
              {options.cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm ${btnClass}`}
            >
              {options.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }, [open, options, handleConfirm, handleCancel])

  return { confirm, ConfirmModal }
}
