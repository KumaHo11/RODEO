'use client'

import React, { useState, useCallback } from 'react'
import { Sparkles, Loader2, X, MapPin, Beef } from 'lucide-react'
import { toast } from 'sonner'
import { AICameraModal } from '@/components/AICameraModal'
import { apiFetch } from '@/lib/apiFetch'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AiAnalysisActionsProps {
  note: BitacoraEntry
  paddocks?: { id: string; name: string }[]
  herds?: { id: string; name: string }[]
  onAiResultSaved?: (noteId: string, result: BitacoraAiResult) => void
  onAssignPaddock?: (noteId: string, paddockId: string) => void
  onAssignHerd?: (noteId: string, herdId: string) => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatAiResult(result: BitacoraAiResult): string {
  if (result.type === 'materia_seca') {
    return `MS: ${result.value.toLocaleString('es')} ${result.unit}`
  }
  return `CC: ${result.value} / 5`
}

// ─── AI Badge (result already exists) ────────────────────────────────────────
function AiBadge({ result }: { result: BitacoraAiResult }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-full">
      <Sparkles className="w-3 h-3 text-purple-600" />
      <span className="text-[10px] font-black text-purple-700">
        {formatAiResult(result)}
      </span>
      {result.confidence != null && (
        <span className="text-[9px] text-purple-400 font-semibold">
          ({result.confidence}%)
        </span>
      )}
    </div>
  )
}

// ─── Quick Assignment Picker ──────────────────────────────────────────────────
// Shown inline when the note has no paddock/herd assigned yet
function QuickAssignPicker({
  type,
  options,
  onSelect,
  onCancel,
}: {
  type: 'paddock' | 'herd'
  options: { id: string; name: string }[]
  onSelect: (id: string) => void
  onCancel: () => void
}) {
  const label = type === 'paddock' ? 'potrero' : 'rodeo'
  const Icon = type === 'paddock' ? MapPin : Beef

  return (
    <div className="mt-2 bg-purple-50 border border-purple-200 rounded-2xl p-3 space-y-2 animate-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-1.5">
          <Icon className="w-3 h-3" />
          Asignar {label} para analizar
        </p>
        <button
          onClick={onCancel}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-purple-100 hover:bg-purple-200 text-purple-500 transition-colors"
          aria-label="Cancelar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {options.length === 0 ? (
        <p className="text-[10px] text-purple-500 italic">
          No hay {label}s disponibles. Creá uno primero en el panel.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className="px-2.5 py-1 bg-white border border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-purple-800 text-[10px] font-bold rounded-full transition-all hover:scale-[1.03]"
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AiAnalysisActions({
  note,
  paddocks = [],
  herds = [],
  onAiResultSaved,
  onAssignPaddock,
  onAssignHerd,
}: AiAnalysisActionsProps) {
  const [modalOpen, setModalOpen]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerType, setPickerType] = useState<'paddock' | 'herd'>('paddock')

  // Local copies of the IDs so we can optimistically update after picker selection
  const [localPaddockId, setLocalPaddockId] = useState(note.paddock_id ?? null)
  const [localHerdId, setLocalHerdId]       = useState(note.rodeo_id ?? null)

  const [localResult, setLocalResult] = useState<BitacoraAiResult | null>(
    note.aiResult ?? null
  )

  // Only show AI actions for image entries.
  // Videos need still photos for Gemini biomass/CC analysis — not yet supported from video frames.
  if (note.mediaType !== 'image') return null

  // Determine mode and title
  const hasPotrero = !!localPaddockId
  const hasRodeo   = !!localHerdId
  const hasBoth    = hasPotrero && hasRodeo

  // Show button as enabled even without IDs (will prompt picker first)
  const canAnalyze = note.mediaType === 'image' || note.mediaType === 'video'

  // Preferred mode: rodeo > potrero when both exist (CC is rarer, more explicit)
  const mode: 'biomass' | 'body-condition' = hasRodeo ? 'body-condition' : 'biomass'
  const buttonLabel = hasBoth
    ? 'Analizar con IA'
    : hasRodeo
      ? 'Evaluar CC (IA)'
      : hasPotrero
        ? 'Estimar MS (IA)'
        : 'Analizar con IA ✦'

  const modalTitle = mode === 'biomass'
    ? 'Estimar Materia Seca (MS)'
    : 'Evaluar Condición Corporal (CC)'

  // ─── Picker: user selects paddock / herd before analysis ─────────────────
  const handlePickerSelect = async (id: string) => {
    setShowPicker(false)
    setSaving(true)
    try {
      if (pickerType === 'paddock') {
        await apiFetch(`/api/field-notes/${note.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ paddock_id: id }),
        })
        setLocalPaddockId(id)
        onAssignPaddock?.(note.id, id)
      } else {
        await apiFetch(`/api/field-notes/${note.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ rodeo_id: id }),
        })
        setLocalHerdId(id)
        onAssignHerd?.(note.id, id)
      }
    } catch {
      toast.error('Error al asignar. Intentalo de nuevo.')
    } finally {
      setSaving(false)
    }
    // Open AI camera modal after assignment
    setModalOpen(true)
  }

  // ─── Button click logic ────────────────────────────────────────────────────
  const handleButtonClick = () => {
    if (hasBoth || hasPotrero || hasRodeo) {
      // IDs already present → go directly to camera modal
      setModalOpen(true)
      return
    }
    // No IDs → show picker. Default to paddock (MS) since it's more common
    setPickerType('paddock')
    setShowPicker(true)
  }

  // ─── Apply AI result ──────────────────────────────────────────────────────
  const handleApply = useCallback(async (data: any, uploadedUrls?: string[]) => {
    setModalOpen(false)
    setAnalyzing(true)

    try {
      let aiResult: BitacoraAiResult

      if (mode === 'biomass') {
        const value = data.dry_matter_kg_ha ?? 0
        aiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'materia_seca',
          value,
          unit: 'kg MS/ha',
          targetId: localPaddockId!,
          confidence: data.estimated_error_pct
            ? Math.round(100 - data.estimated_error_pct)
            : undefined,
        }
        if (localPaddockId) {
          await apiFetch(`/api/paddocks/${localPaddockId}`, {
            method: 'PATCH',
            body: JSON.stringify({ dry_matter_kg_ha: value }),
          })
          toast.success(`✅ ${value.toLocaleString('es')} kg MS/ha guardados en el potrero`)
        }
      } else {
        const value = data.bcs_score ?? 0
        aiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'condicion_corporal',
          value,
          unit: '/5',
          label: data.condition_label,
          targetId: localHerdId!,
          confidence: undefined,
        }
        if (localHerdId) {
          await apiFetch(`/api/herds/${localHerdId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              bcs_score: value,
              bcs_label: data.condition_label ?? '',
              bcs_data: data,
            }),
          })
          toast.success(`✅ CC ${value}/5 guardado en el rodeo`)
        }
      }

      // Persist AI result back to the field note
      await apiFetch(`/api/field-notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          analysis_result: { ...aiResult, source: 'bitacora_ai', uploadedUrls },
        }),
      })

      setLocalResult(aiResult)
      onAiResultSaved?.(note.id, aiResult)
    } catch (err: any) {
      toast.error(`Error al guardar el análisis: ${err?.message || 'Error desconocido'}`)
    } finally {
      setAnalyzing(false)
    }
  }, [mode, note.id, localPaddockId, localHerdId, onAiResultSaved])

  // ─── Result badge (already analyzed) ────────────────────────────────────
  if (localResult) {
    return (
      <div className="pt-2 border-t border-gray-50 flex items-center gap-2 flex-wrap">
        <AiBadge result={localResult} />
        <span className="text-[9px] text-gray-400">
          {new Date(localResult.analyzedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    )
  }

  // ─── Trigger button + optional picker ───────────────────────────────────
  return (
    <>
      <div className="pt-2 border-t border-gray-50 space-y-1">
        {/* Loading state */}
        {(saving || analyzing) ? (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
            <span className="font-semibold">
              {saving ? 'Asignando...' : 'Estimando biomasa con IA...'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleButtonClick}
              disabled={!canAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-full text-[11px] font-black transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
              title={!canAnalyze ? 'Solo disponible en registros con foto o video' : buttonLabel}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {buttonLabel}
            </button>

            {/* Quick context: show what mode it'll use */}
            {!hasPotrero && !hasRodeo && (
              <span className="text-[9px] text-gray-400 italic">
                Seleccioná potrero o rodeo
              </span>
            )}
          </div>
        )}

        {/* Quick assignment picker — appears below the button */}
        {showPicker && !saving && (
          <QuickAssignPicker
            type={pickerType}
            options={pickerType === 'paddock' ? paddocks : herds}
            onSelect={handlePickerSelect}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>

      <AICameraModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        mode={mode}
        onApply={handleApply}
        initialPhotoUrls={
          note.groupedPhotos?.length
            ? note.groupedPhotos.slice(0, 3)
            : note.photo_url
              ? [note.photo_url]
              : undefined
        }
      />
    </>
  )
}
