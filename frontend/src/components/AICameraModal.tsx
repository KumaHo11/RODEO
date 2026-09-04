'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Upload, X, Sparkles, Loader2, Trash2, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

interface AICameraModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  mode: 'biomass' | 'body-condition'
  onApply: (data: any, uploadedUrls?: string[]) => void
}

export function AICameraModal({ isOpen, onClose, title, mode, onApply }: AICameraModalProps) {
  const [photos, setPhotos] = useState<{ url: string; base64: string; mimeType: string }[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setPhotos([])
      setResult(null)
      setError(null)
      setAnalyzing(false)
    }
  }, [isOpen])

  // Cierra modal con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)
    
    // limit max 5
    if (photos.length + newFiles.length > 5) {
      setError('Podés subir hasta 5 fotos como máximo.')
      return
    }
    
    setError(null)

    const processed = await Promise.all(
      newFiles.map(file => {
        return new Promise<{ url: string; base64: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            const base64 = dataUrl.split(',')[1]
            resolve({
              url: URL.createObjectURL(file),
              base64,
              mimeType: file.type
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })
    )
    
    setPhotos(prev => [...prev, ...processed])
    // clear input
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (photos.length === 0) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setUploadedUrls([])

    try {
      const endpoint = mode === 'biomass' ? '/api/analyze-biomass' : '/api/analyze-body-condition'
      const imagesBase64 = photos.map(p => ({ base64: p.base64, mimeType: p.mimeType }))
      
      // Lanzar subida de imágenes y análisis en paralelo
      const uploadPromise = Promise.all(
        photos.map(async (p) => {
          try {
            const blob = await fetch(`data:${p.mimeType};base64,${p.base64}`).then(r => r.blob())
            const formData = new FormData()
            formData.append('file', blob, 'ai_camera.jpg')
            formData.append('folder', 'ai_analysis')
            const res = await apiFetch('/api/upload', {
              method: 'POST',
              body: formData
            })
            if (res.ok) {
              const data = await res.json()
              return data.url
            }
          } catch (e) {
            console.warn('Error uploading photo', e)
          }
          return null
        })
      )

      const analyzePromise = apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ imagesBase64 }),
        timeout: 60000
      })
      
      const [uploadResults, res] = await Promise.all([uploadPromise, analyzePromise])
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en el análisis de IA')
      
      setResult(data.data)
      setUploadedUrls(uploadResults.filter(url => url !== null) as string[])
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al analizar las imágenes.')
    } finally {
      setAnalyzing(false)
    }
  }

  const renderResult = () => {
    if (!result) return null

    return (
      <div className="bg-green-50 rounded-xl p-4 border border-green-200 mt-4 animate-in fade-in zoom-in-95">
        <h4 className="text-sm font-black text-green-900 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-600" /> Resultados del Análisis
        </h4>
        
        {mode === 'biomass' ? (
          <div className="space-y-2 text-sm text-green-800">
            <p><strong>Materia Seca (kg/ha):</strong> {result.dry_matter_kg_ha}</p>
            <p><strong>Altura Estimada (cm):</strong> {result.grass_height_cm}</p>
            <p><strong>Estado:</strong> {result.condition_label}</p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-green-800">
            <p><strong>Condición Corporal:</strong> {result.bcs_score} ({result.bcs_scale})</p>
            {result.estimated_weight_kg && (
              <p><strong>Peso Estimado:</strong> {result.estimated_weight_kg} kg</p>
            )}
            <p><strong>Estado:</strong> {result.condition_label}</p>
            <p><strong>Recomendación:</strong> {result.recommendation}</p>
          </div>
        )}
        
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => onApply(result, uploadedUrls)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Aplicar valor
          </button>
          <button
            onClick={() => setResult(null)}
            className="flex-1 bg-white hover:bg-green-100 text-green-800 border border-green-200 py-2 px-4 rounded-xl text-sm font-bold flex items-center justify-center transition-colors"
          >
            Descartar
          </button>
        </div>
      </div>
    )
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-950 leading-tight">{title}</h2>
              <p className="text-xs font-bold text-gray-400 mt-0.5">IA Gemini (1 a 5 fotos)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {!result ? (
            <>
              {/* Photo Actions */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors group"
                >
                  <Camera className="w-6 h-6 text-gray-400 group-hover:text-gray-700" />
                  <span className="text-xs font-bold text-gray-600">Tomar foto</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors group"
                >
                  <Upload className="w-6 h-6 text-gray-400 group-hover:text-gray-700" />
                  <span className="text-xs font-bold text-gray-600">Galería</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Photos List */}
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden group">
                      <img src={photo.url} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {/* Empty slots */}
                  {Array.from({ length: 5 - photos.length }).map((_, idx) => (
                    <div key={idx} className="aspect-square rounded-lg border border-gray-100 bg-gray-50 border-dashed flex items-center justify-center">
                      <Camera className="w-4 h-4 text-gray-300" />
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={photos.length === 0 || analyzing}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {analyzing ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Analizando imágenes...
                    </div>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Analizar por AI
                  </>
                )}
              </button>
              
              {analyzing && (
                <p className="text-center text-xs font-bold text-gray-500 mt-3">
                  Puede tardar hasta un minuto, por favor esperá.
                </p>
              )}
            </>
          ) : (
            renderResult()
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
