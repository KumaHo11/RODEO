import React, { useState, useEffect } from 'react'

interface PromptModalProps {
  isOpen: boolean
  title: string
  message: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function PromptModal({
  isOpen,
  title,
  message,
  placeholder = '',
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (isOpen) {
      setValue('')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-lg font-black text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 mb-4">{message}</p>
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-24 p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
            placeholder={placeholder}
          />
        </div>
        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(value)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
