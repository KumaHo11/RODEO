'use client'

import React, { useState, useCallback } from 'react'
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { AICameraModal } from '@/components/AICameraModal'
import { apiFetch } from '@/lib/apiFetch'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AiAnalysisActionsProps {
  note: BitacoraEntry
  onAiResultSaved?: (noteId: string, result: BitacoraAiResult) => void
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

// ─── Main Component ───────────────────────────────────────────────────────────
export function AiAnalysisActions({ note, onAiResultSaved }: AiAnalysisActionsProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localResult, setLocalResult] = useState<BitacoraAiResult | null>(
    note.aiResult ?? null
  )

  // Only show AI actions for image or video entries
  if (note.mediaType !== 'image' && note.mediaType !== 'video') return null

  // Determine analysis mode based on available IDs
  // If paddock_id → biomass (pastures); if rodeo_id → body condition (livestock)
  const hasPotrero = !!note.paddock_id
  const hasRodeo = !!note.rodeo_id
  const mode: 'biomass' | 'body-condition' = hasRodeo ? 'body-condition' : 'biomass'
  const title = mode === 'biomass'
    ? 'Estimar Materia Seca (MS)'
    : 'Evaluar Condición Corporal (CC)'

  const handleApply = useCallback(async (data: any, uploadedUrls?: string[]) => {
    setModalOpen(false)
    setSaving(true)

    try {
      let aiResult: BitacoraAiResult

      if (mode === 'biomass') {
        const value = data.dry_matter_kg_ha ?? 0
        aiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'materia_seca',
          value,
          unit: 'kg MS/ha',
          targetId: note.paddock_id!,
          confidence: data.estimated_error_pct ? Math.round(100 - data.estimated_error_pct) : undefined,
        }

        // Persist to paddock
        if (note.paddock_id) {
          await apiFetch(`/api/paddocks/${note.paddock_id}`, {
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
          targetId: note.rodeo_id!,
          confidence: undefined,
        }

        // Persist to herd
        if (note.rodeo_id) {
          await apiFetch(`/api/herds/${note.rodeo_id}`, {
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

      // Save AI result reference back to field_note
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
      setSaving(false)
    }
  }, [mode, note, onAiResultSaved])

  // Show existing result badge
  if (localResult) {
    return (
      <div className="pt-2 border-t border-gray-50 flex items-center gap-2">
        <AiBadge result={localResult} />
        <span className="text-[9px] text-gray-400">
          {new Date(localResult.analyzedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    )
  }

  // Show trigger button
  return (
    <>
      <div className="pt-2 border-t border-gray-50">
        {saving ? (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
            <span className="font-semibold">Guardando análisis...</span>
          </div>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            disabled={!hasPotrero && !hasRodeo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-full text-[11px] font-black transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasPotrero && !hasRodeo ? 'Asigná un potrero o rodeo primero' : title}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {title}
          </button>
        )}
      </div>

      <AICameraModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title}
        mode={mode}
        onApply={handleApply}
      />
    </>
  )
}
