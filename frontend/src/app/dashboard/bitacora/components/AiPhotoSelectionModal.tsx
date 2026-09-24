import React, { useState } from 'react'
import { X, Check } from 'lucide-react'
import { toast } from 'sonner'

interface AiPhotoSelectionModalProps {
  photos: string[]
  onContinue: (selectedPhotos: string[]) => void
  onCancel: () => void
}

export function AiPhotoSelectionModal({ photos, onContinue, onCancel }: AiPhotoSelectionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(photos.slice(0, 5)))

  const togglePhoto = (url: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(url)) {
      if (newSelected.size === 1) {
        toast.warning('Debe seleccionar al menos 1 foto.')
        return
      }
      newSelected.delete(url)
    } else {
      if (newSelected.size >= 5) {
        toast.warning('Puede seleccionar un máximo de 5 fotos.')
        return
      }
      newSelected.add(url)
    }
    setSelected(newSelected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Seleccionar fotos para analizar</h3>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Seleccioná entre 1 y 5 fotos para el análisis con IA.
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto p-1">
            {photos.map((url, i) => {
              const isSelected = selected.has(url)
              return (
                <div
                  key={i}
                  onClick={() => togglePhoto(url)}
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    isSelected ? 'border-purple-500 scale-95' : 'border-transparent hover:opacity-80'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i+1}`} className="w-full h-full object-cover" />
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 bg-purple-500 text-white p-1 rounded-full shadow-sm">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={() => onContinue(Array.from(selected))}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            disabled={selected.size === 0 || selected.size > 5}
          >
            Continuar con el análisis ({selected.size} seleccionadas)
          </button>
        </div>
      </div>
    </div>
  )
}
