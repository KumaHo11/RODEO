'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera, Upload, X, Sparkles, Loader2, Trash2, CheckCircle2,
  Eye, Leaf, Scale, Droplets, Activity, Target, AlertTriangle, FlaskConical, Info,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'


// ─── Guías por modo y slot index ──────────────────────────────────────────────
const SLOT_GUIDES_BIOMASS = [
  { label: 'Foto a 45°, testigo métrico visible' },
  { label: 'Fuera del sol directo' },
  { label: 'Zona representativa del potrero' },
]

const SLOT_GUIDES_BODY = [
  { label: 'Vista trasero-lateral a 45°' },
  { label: 'Flanco izquierdo, ijar visible' },
  { label: 'Vista posterior, grupa completa' },
]

// ─── Cálculo de error estimado ────────────────────────────────────────────────
// Solo depende de la cantidad de fotos (sin toggle para el usuario).
// 1 foto: ± 20%, 2 fotos: ± 15%, 3 fotos: ± 10%
function calcEstimatedError(photoCount: number): number {
  if (photoCount >= 3) return 10
  if (photoCount === 2) return 15
  return 20
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AICameraModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  mode: 'biomass' | 'body-condition'
  onApply: (data: any, uploadedUrls?: string[]) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function AICameraModal({ isOpen, onClose, title, mode, onApply }: AICameraModalProps) {
  const [photos, setPhotos]         = useState<{ url: string; base64: string; mimeType: string }[]>([])
  const [analyzing, setAnalyzing]   = useState(false)
  const [result, setResult]         = useState<any>(null)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [error, setError]           = useState<string | null>(null)

  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const MAX_PHOTOS = 3
  const slotGuides = mode === 'biomass' ? SLOT_GUIDES_BIOMASS : SLOT_GUIDES_BODY

  useEffect(() => {
    if (isOpen) {
      setPhotos([])
      setResult(null)
      setError(null)
      setAnalyzing(false)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ── Manejo de archivos ──────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const newFiles = Array.from(e.target.files)

    if (photos.length + newFiles.length > MAX_PHOTOS) {
      setError(`Podés subir hasta ${MAX_PHOTOS} fotos como máximo.`)
      return
    }

    setError(null)
    const processed = await Promise.all(
      newFiles.map(file => new Promise<{ url: string; base64: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string
          resolve({ url: URL.createObjectURL(file), base64: dataUrl.split(',')[1], mimeType: file.type })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      }))
    )
    setPhotos(prev => [...prev, ...processed])
    e.target.value = ''
  }

  const removePhoto = (index: number) => setPhotos(prev => prev.filter((_, i) => i !== index))

  // ── Análisis ────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (photos.length === 0) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setUploadedUrls([])

    try {
      const endpoint = mode === 'biomass' ? '/api/analyze-biomass' : '/api/analyze-body-condition'
      const imagesBase64 = photos.map(p => ({ base64: p.base64, mimeType: p.mimeType }))

      const uploadPromise = Promise.all(
        photos.map(async (p) => {
          try {
            const blob = await fetch(`data:${p.mimeType};base64,${p.base64}`).then(r => r.blob())
            const formData = new FormData()
            formData.append('file', blob, 'ai_camera.jpg')
            formData.append('folder', 'ai_analysis')
            const res = await apiFetch('/api/upload', { method: 'POST', body: formData })
            if (res.ok) { const data = await res.json(); return data.url }
          } catch (e) { console.warn('Error al subir foto', e) }
          return null
        })
      )

      const analyzePromise = apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ imagesBase64 }),
        timeout: 60000,
      })

      const [uploadResults, res] = await Promise.all([uploadPromise, analyzePromise])
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en el análisis de IA')

      const errorPct = calcEstimatedError(photos.length)
      setResult({ ...data.data, estimated_error_pct: errorPct })
      setUploadedUrls(uploadResults.filter((url): url is string => url !== null))
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al analizar las imágenes.')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Renderizado de resultados ────────────────────────────────────────────────
  const renderResult = () => {
    if (!result) return null

    return (
      <div className="space-y-3 mt-4 animate-in fade-in zoom-in-95">
        {/* Tarjeta de resultados */}
        <div className="bg-green-50 rounded-xl border border-green-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-green-100">
            <Sparkles className="w-4 h-4 text-green-600 shrink-0" />
            <h4 className="modal-subtitle text-green-900">Resultados del análisis</h4>
            {(result.condition || result.condition_label) && (
              <span className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                result.condition === 'OPTIMO' ? 'bg-green-200 text-green-800'
                : result.condition === 'BUENO' ? 'bg-lime-200 text-lime-800'
                : result.condition === 'REGULAR' ? 'bg-amber-200 text-amber-800'
                : 'bg-red-200 text-red-800'
              }`}>
                {result.condition || result.condition_label}
              </span>
            )}
          </div>

          <div className="p-4">
            {mode === 'biomass' ? (
              <div className="grid grid-cols-2 gap-2">
                <ResultRow icon={<Leaf className="w-3.5 h-3.5 text-green-600" />} label="Especie dominante" value={result.dominant_species || result.pasture_type || '—'} fullWidth />
                <ResultRow icon={<Activity className="w-3.5 h-3.5 text-green-600" />} label="Altura media" value={result.grass_height_cm != null ? `${result.grass_height_cm} cm` : '—'} />
                <ResultRow icon={<Eye className="w-3.5 h-3.5 text-green-600" />} label="Cobertura de suelo" value={result.coverage_pct != null ? `${result.coverage_pct}%` : '—'} />
                <ResultRow icon={<Info className="w-3.5 h-3.5 text-green-600" />} label="Estado fenológico" value={result.phenological_stage || '—'} />
                <ResultRow icon={<Droplets className="w-3.5 h-3.5 text-green-600" />} label="Material verde" value={result.green_ratio_pct != null ? `${result.green_ratio_pct}%` : '—'} />
                <ResultRow icon={<Scale className="w-3.5 h-3.5 text-green-600" />} label="Disponibilidad forrajera" value={result.dry_matter_kg_ha != null ? `${result.dry_matter_kg_ha.toLocaleString('es')} kg MS/ha` : '—'} highlight />
                <ResultRow icon={<FlaskConical className="w-3.5 h-3.5 text-green-600" />} label="Proteína cruda (% PC)" value={result.protein_content_pct != null ? `${result.protein_content_pct}%` : '—'} />
                <ResultRow icon={<Target className="w-3.5 h-3.5 text-green-600" />} label="Remanente sugerido" value={result.suggested_remnant_pct != null ? `${result.suggested_remnant_pct}%` : '—'} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <ResultRow icon={<Info className="w-3.5 h-3.5 text-green-600" />} label="Categoría y biotipo" value={result.category_biotype || '—'} fullWidth />
                <ResultRow icon={<Scale className="w-3.5 h-3.5 text-green-600" />} label="Peso vivo estimado" value={result.estimated_weight_kg != null ? `${result.estimated_weight_kg} kg` : '—'} highlight />
                <ResultRow icon={<Activity className="w-3.5 h-3.5 text-green-600" />} label="Condición corporal" value={result.bcs_score != null ? `${result.bcs_score} / 5 — ${result.condition_label || ''}` : '—'} />
                <ResultRow icon={<Droplets className="w-3.5 h-3.5 text-green-600" />} label="Llenado ruminal (ijar)" value={result.ruminal_fill_score != null ? `${result.ruminal_fill_score} / 5` : '—'} />
                <ResultRow icon={<Leaf className="w-3.5 h-3.5 text-green-600" />} label="Demanda diaria individual" value={result.daily_dry_matter_demand_kg != null ? `${result.daily_dry_matter_demand_kg} kg MS/día` : '—'} />
                {result.fecal_score != null && (
                  <ResultRow icon={<FlaskConical className="w-3.5 h-3.5 text-green-600" />} label="Score fecal" value={`${result.fecal_score} / 5`} />
                )}
              </div>
            )}

            {result.recommendation && (
              <div className="mt-3 pt-3 border-t border-green-100">
                <p className="modal-body-text font-black text-green-700 uppercase tracking-widest mb-1">Recomendación</p>
                <p className="modal-body-text text-green-800 leading-relaxed">{result.recommendation}</p>
              </div>
            )}

            {result.alert_level && result.alert_level !== 'NINGUNA' && result.alert_reason && (
              <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-lg border ${
                result.alert_level === 'URGENTE' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p className="modal-body-text font-bold">{result.alert_reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Error estimado — texto gris pequeño debajo del resultado */}
        {result.estimated_error_pct != null && (
          <p className="text-center text-gray-400 font-medium" style={{ fontSize: '10px' }}>
            Error estimado de la lectura: ± {result.estimated_error_pct}%
            {result.estimated_error_pct <= 12
              ? ' · Buena precisión (varias fotos)'
              : ' · Mayor precisión: agregá más fotos la próxima vez'}
          </p>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={() => onApply(result, uploadedUrls)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            style={{ fontSize: '14px' }}
          >
            <CheckCircle2 className="w-4 h-4" /> Confirmar y aplicar
          </button>
          <button
            onClick={() => setResult(null)}
            className="flex-1 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center transition-colors"
            style={{ fontSize: '14px' }}
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
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="modal-title leading-tight">{title}</h2>
              <p className="modal-body-text font-bold text-gray-400 mt-0.5">IA Gemini · hasta {MAX_PHOTOS} fotos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto">
          {!result ? (
            <>
              {/* Grid de slots con guía en el empty state */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
                  const photo = photos[idx]
                  const guide = slotGuides[idx]

                  return photo ? (
                    /* Foto cargada */
                    <div key={idx} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden group shadow-sm">
                      <img src={photo.url} alt={`foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        {idx + 1}
                      </span>
                    </div>
                  ) : (
                    /* Empty state limpio — gris, cámara + sugerencia */
                    <button
                      key={idx}
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="aspect-square rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all flex flex-col items-center justify-center gap-2 p-3 group"
                    >
                      <Camera className="w-6 h-6 text-gray-300 group-hover:text-gray-400 transition-colors" />
                      <p
                        style={{ fontSize: '9px' }}
                        className="font-semibold text-gray-400 text-center leading-snug"
                      >
                        {guide.label}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Botones de captura adicionales */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="flex-1 py-2.5 px-4 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 border border-gray-200 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Camera className="w-4 h-4 text-gray-500" />
                  <span style={{ fontSize: '12px' }} className="font-bold text-gray-600">Cámara</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="flex-1 py-2.5 px-4 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 border border-gray-200 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span style={{ fontSize: '12px' }} className="font-bold text-gray-600">Galería</span>
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFileChange} />
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              </div>

              {/* Contador */}
              {photos.length > 0 && (
                <p className="text-center mb-3 text-gray-400 font-bold" style={{ fontSize: '10px' }}>
                  {photos.length}/{MAX_PHOTOS} foto{photos.length !== 1 ? 's' : ''} cargada{photos.length !== 1 ? 's' : ''}
                </p>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl font-medium text-red-700" style={{ fontSize: '10px' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={photos.length === 0 || analyzing}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors"
                style={{ fontSize: '14px' }}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando imágenes…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Analizar por IA
                  </>
                )}
              </button>

              {analyzing && (
                <p className="text-center text-gray-400 font-bold mt-3" style={{ fontSize: '10px' }}>
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

// ─── Componente auxiliar: fila de resultado ───────────────────────────────────
function ResultRow({
  icon, label, value, highlight = false, fullWidth = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  fullWidth?: boolean
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-1 text-green-600">
        {icon}
        <span style={{ fontSize: '10px' }} className="font-black text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <p
        style={{ fontSize: highlight ? '14px' : '12px' }}
        className={`font-black leading-tight ${highlight ? 'text-gray-900' : 'text-gray-700'}`}
      >
        {value}
      </p>
    </div>
  )
}
