'use client'

import React, { useState, useCallback } from 'react'
import { Sparkles, Loader2, X, MapPin, Beef, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { AICameraModal } from '@/components/AICameraModal'
import { apiFetch } from '@/lib/apiFetch'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AiAnalysisActionsProps {
  note: BitacoraEntry
  paddocks?: { id: string; name: string }[]
  herds?: { id: string; name: string }[]
  /** Synced from parent BitacoraCard when selector changes */
  externalPaddockId?: string | null
  externalHerdId?: string | null
  onAiResultSaved?: (noteId: string, result: BitacoraAiResult) => void
  onAssignPaddock?: (noteId: string, paddockId: string) => void
  onAssignHerd?: (noteId: string, herdId: string) => void
}

// ─── AI Badge (compact pill for existing result) ──────────────────────────────
function AiBadge({ result }: { result: BitacoraAiResult }) {
  const label = result.type === 'materia_seca'
    ? `MS: ${result.value.toLocaleString('es')} ${result.unit}`
    : `CC: ${result.value} / 5`

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-full">
      <Sparkles className="w-3 h-3 text-purple-600" />
      <span className="text-[10px] font-black text-purple-700">{label}</span>
      {result.confidence != null && (
        <span className="text-[9px] text-purple-400 font-semibold">
          ({result.confidence}%)
        </span>
      )}
    </div>
  )
}

// ─── Inline Result Card ────────────────────────────────────────────────────────
function InlineResult({ data, mode }: { data: any; mode: 'biomass' | 'body-condition' }) {
  const [expanded, setExpanded] = useState(false)

  if (mode === 'biomass') {
    return (
      <div className="mt-2 rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Main metric row */}
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">MS disponible</span>
            <span className="text-xl font-black text-purple-800 tabular-nums leading-tight">
              {data.dry_matter_kg_ha?.toLocaleString('es') ?? '—'} <span className="text-[11px] font-semibold text-purple-500">kg/ha</span>
            </span>
          </div>

          {data.grass_height_cm != null && (
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Altura</span>
              <span className="text-sm font-black text-purple-700">{data.grass_height_cm} cm</span>
            </div>
          )}

          {data.protein_content_pct != null && (
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">PC%</span>
              <span className="text-sm font-black text-purple-700">{data.protein_content_pct}%</span>
            </div>
          )}

          {data.condition && (
            <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
              data.condition === 'OPTIMO'  ? 'bg-green-200 text-green-800'
              : data.condition === 'BUENO'   ? 'bg-lime-200 text-lime-800'
              : data.condition === 'REGULAR' ? 'bg-amber-200 text-amber-800'
              : 'bg-red-200 text-red-800'
            }`}>
              {data.condition}
            </span>
          )}
        </div>

        {/* Secondary metrics */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {data.dominant_species && (
            <p className="text-[10px] text-purple-700 col-span-2">
              <span className="font-black">Especie:</span> {data.dominant_species}
            </p>
          )}
          {data.phenological_stage && (
            <p className="text-[10px] text-purple-700">
              <span className="font-black">Fenología:</span> {data.phenological_stage}
            </p>
          )}
          {data.coverage_pct != null && (
            <p className="text-[10px] text-purple-700">
              <span className="font-black">Cobertura:</span> {data.coverage_pct}%
            </p>
          )}
          {data.suggested_remnant_pct != null && (
            <p className="text-[10px] text-purple-700">
              <span className="font-black">Remanente:</span> {data.suggested_remnant_pct}%
            </p>
          )}
          {data.estimated_grazing_days != null && (
            <p className="text-[10px] text-purple-700">
              <span className="font-black">Días pastoreo:</span> {data.estimated_grazing_days}d
            </p>
          )}
        </div>

        {/* Recommendation — collapsible */}
        {data.recommendation && (
          <div className="border-t border-purple-200">
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-black text-purple-600 uppercase tracking-widest hover:bg-purple-100 transition-colors"
            >
              Recomendación agronómica
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {expanded && (
              <p className="px-4 pb-3 text-[11px] text-purple-800 leading-relaxed">
                {data.recommendation}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // body-condition result
  return (
    <div className="mt-2 rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">CC (BCS)</span>
          <span className="text-xl font-black text-purple-800 tabular-nums leading-tight">
            {data.bcs_score ?? '—'} <span className="text-[11px] font-semibold text-purple-500">/ 5</span>
          </span>
        </div>
        {data.estimated_weight_kg != null && (
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Peso est.</span>
            <span className="text-sm font-black text-purple-700">{data.estimated_weight_kg} kg</span>
          </div>
        )}
        {data.condition_label && (
          <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            data.nutritional_status === 'OPTIMO' ? 'bg-green-200 text-green-800'
            : data.nutritional_status === 'BAJO' ? 'bg-amber-200 text-amber-800'
            : data.nutritional_status === 'DEFICIENTE' ? 'bg-red-200 text-red-800'
            : 'bg-gray-200 text-gray-700'
          }`}>
            {data.condition_label}
          </span>
        )}
      </div>
      {data.recommendation && (
        <div className="border-t border-purple-200">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-black text-purple-600 uppercase tracking-widest hover:bg-purple-100 transition-colors"
          >
            Recomendación
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <p className="px-4 pb-3 text-[11px] text-purple-800 leading-relaxed">{data.recommendation}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Quick Assignment Picker ──────────────────────────────────────────────────
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
          Asigná el {label} para analizar
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
  externalPaddockId,
  externalHerdId,
  onAiResultSaved,
  onAssignPaddock,
  onAssignHerd,
}: AiAnalysisActionsProps) {
  const [modalOpen, setModalOpen]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerType, setPickerType] = useState<'paddock' | 'herd'>('paddock')

  // Inline result state (for direct analysis)
  const [inlineResult, setInlineResult] = useState<any | null>(null)
  const [inlineMode, setInlineMode]     = useState<'biomass' | 'body-condition'>('biomass')

  // Priority: external (from selector) > local from picker > note field
  const [localPaddockId, setLocalPaddockId] = useState(note.paddock_id ?? null)
  const [localHerdId, setLocalHerdId]       = useState(note.rodeo_id ?? null)

  const [localResult, setLocalResult] = useState<BitacoraAiResult | null>(
    note.aiResult ?? null
  )

  // Merge external with local (external wins when set)
  const activePaddockId = externalPaddockId !== undefined ? externalPaddockId : localPaddockId
  const activeHerdId    = externalHerdId    !== undefined ? externalHerdId    : localHerdId

  // Only show AI actions for image entries.
  // Videos need still photos for Gemini biomass/CC analysis — not yet supported from video frames.
  if (note.mediaType !== 'image') return null

  const hasPotrero = !!activePaddockId
  const hasRodeo   = !!activeHerdId

  // Mode logic: rodeo → CC, potrero → MS
  const mode: 'biomass' | 'body-condition' = hasRodeo ? 'body-condition' : 'biomass'

  // Label logic
  const buttonLabel = hasPotrero || hasRodeo
    ? hasRodeo
      ? '✦ Evaluar CC (IA)'
      : '✦ Estimar MS (IA)'
    : '✦ Analizar con IA'

  // ── Direct inline analysis (when card has a photo) ────────────────────────
  const handleDirectAnalyze = useCallback(async (paddockId: string | null, herdId: string | null) => {
    const photoUrl = note.photo_url
    if (!photoUrl) {
      // Fallback to modal if no URL (shouldn't happen since mediaType === 'image')
      setModalOpen(true)
      return
    }

    setAnalyzing(true)
    setInlineResult(null)

    const resolvedMode: 'biomass' | 'body-condition' = herdId ? 'body-condition' : 'biomass'
    const endpoint = resolvedMode === 'biomass' ? '/api/analyze-biomass' : '/api/analyze-body-condition'

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ imageUrl: photoUrl }),
        timeout: 65000,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error en análisis de IA')

      const raw = json.data
      setInlineMode(resolvedMode)
      setInlineResult(raw)

      // Build aiResult for persistence
      let aiResult: BitacoraAiResult
      if (resolvedMode === 'biomass') {
        aiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'materia_seca',
          value: raw.dry_matter_kg_ha ?? 0,
          unit: 'kg MS/ha',
          targetId: paddockId ?? '',
          confidence: raw.confidence,
        }
        if (paddockId) {
          await apiFetch(`/api/paddocks/${paddockId}`, {
            method: 'PATCH',
            body: JSON.stringify({ dry_matter_kg_ha: raw.dry_matter_kg_ha }),
          }).catch(() => {})
          toast.success(`✅ ${(raw.dry_matter_kg_ha ?? 0).toLocaleString('es')} kg MS/ha guardados en el potrero`)
        }
      } else {
        aiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'condicion_corporal',
          value: raw.bcs_score ?? 0,
          unit: '/5',
          label: raw.condition_label,
          targetId: herdId ?? '',
        }
        if (herdId) {
          await apiFetch(`/api/herds/${herdId}`, {
            method: 'PATCH',
            body: JSON.stringify({ bcs_score: raw.bcs_score, bcs_label: raw.condition_label, bcs_data: raw }),
          }).catch(() => {})
          toast.success(`✅ CC ${raw.bcs_score}/5 guardado en el rodeo`)
        }
      }

      // Persist to field_note
      await apiFetch(`/api/field-notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ analysis_result: { ...aiResult, source: 'bitacora_direct' } }),
      }).catch(() => {})

      setLocalResult(aiResult)
      onAiResultSaved?.(note.id, aiResult)
    } catch (err: any) {
      toast.error(`Error al analizar: ${err?.message || 'Error desconocido'}`)
    } finally {
      setAnalyzing(false)
    }
  }, [note.photo_url, note.id, onAiResultSaved])

  // ─── Picker: user selects paddock / herd before analysis ─────────────────
  const handlePickerSelect = async (id: string) => {
    setShowPicker(false)
    setSaving(true)
    let newPaddockId = activePaddockId
    let newHerdId    = activeHerdId
    try {
      if (pickerType === 'paddock') {
        await apiFetch(`/api/field-notes/${note.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ paddock_id: id }),
        })
        setLocalPaddockId(id)
        newPaddockId = id
        onAssignPaddock?.(note.id, id)
      } else {
        await apiFetch(`/api/field-notes/${note.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ rodeo_id: id }),
        })
        setLocalHerdId(id)
        newHerdId = id
        onAssignHerd?.(note.id, id)
      }
    } catch {
      toast.error('Error al asignar. Intentalo de nuevo.')
    } finally {
      setSaving(false)
    }
    // Go directly to inline analysis
    handleDirectAnalyze(newPaddockId, newHerdId)
  }

  // ─── Button click: direct or picker first ────────────────────────────────
  const handleButtonClick = () => {
    if (hasPotrero || hasRodeo) {
      handleDirectAnalyze(activePaddockId, activeHerdId)
      return
    }
    // No IDs → show picker
    setPickerType('paddock')
    setShowPicker(true)
  }

  // ─── Modal apply (fallback for no-URL case) ───────────────────────────────
  const handleModalApply = useCallback(async (data: any, uploadedUrls?: string[]) => {
    setModalOpen(false)
    setAnalyzing(true)
    try {
      let aiResult: BitacoraAiResult
      if (mode === 'biomass') {
        const value = data.dry_matter_kg_ha ?? 0
        aiResult = { analyzedAt: new Date().toISOString(), type: 'materia_seca', value, unit: 'kg MS/ha', targetId: activePaddockId! }
        if (activePaddockId) {
          await apiFetch(`/api/paddocks/${activePaddockId}`, { method: 'PATCH', body: JSON.stringify({ dry_matter_kg_ha: value }) })
          toast.success(`✅ ${value.toLocaleString('es')} kg MS/ha guardados en el potrero`)
        }
      } else {
        const value = data.bcs_score ?? 0
        aiResult = { analyzedAt: new Date().toISOString(), type: 'condicion_corporal', value, unit: '/5', label: data.condition_label, targetId: activeHerdId! }
        if (activeHerdId) {
          await apiFetch(`/api/herds/${activeHerdId}`, { method: 'PATCH', body: JSON.stringify({ bcs_score: value, bcs_label: data.condition_label, bcs_data: data }) })
          toast.success(`✅ CC ${value}/5 guardado en el rodeo`)
        }
      }
      await apiFetch(`/api/field-notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ analysis_result: { ...aiResult, source: 'bitacora_ai', uploadedUrls } }),
      })
      setLocalResult(aiResult)
      onAiResultSaved?.(note.id, aiResult)
    } catch (err: any) {
      toast.error(`Error al guardar el análisis: ${err?.message}`)
    } finally {
      setAnalyzing(false)
    }
  }, [mode, note.id, activePaddockId, activeHerdId, onAiResultSaved])

  // ─── Existing result badge ────────────────────────────────────────────────
  if (localResult && !inlineResult) {
    return (
      <div className="pt-2 border-t border-gray-50 flex items-center gap-2 flex-wrap">
        <AiBadge result={localResult} />
        <span className="text-[9px] text-gray-400">
          {new Date(localResult.analyzedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    )
  }

  // ─── Trigger button + picker + inline result ─────────────────────────────
  return (
    <>
      <div className="pt-2 border-t border-gray-50 space-y-1">
        {(saving || analyzing) ? (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
            <span className="font-semibold">
              {saving ? 'Asignando...' : 'Calculando con Gemini…'}
            </span>
          </div>
        ) : !inlineResult ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleButtonClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-full text-[11px] font-black transition-all hover:scale-[1.02]"
              title={buttonLabel}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {buttonLabel}
            </button>

            {!hasPotrero && !hasRodeo && (
              <span className="text-[9px] text-gray-400 italic">
                Seleccioná potrero o rodeo
              </span>
            )}
          </div>
        ) : (
          /* Result shown — show re-analyze option */
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-purple-700 font-black">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
              Análisis guardado
            </div>
            <button
              onClick={() => { setInlineResult(null); setLocalResult(null) }}
              className="text-[9px] text-gray-400 hover:text-gray-600 underline"
            >
              Re-analizar
            </button>
          </div>
        )}

        {/* Quick assignment picker */}
        {showPicker && !saving && (
          <QuickAssignPicker
            type={pickerType}
            options={pickerType === 'paddock' ? paddocks : herds}
            onSelect={handlePickerSelect}
            onCancel={() => setShowPicker(false)}
          />
        )}

        {/* Inline result card */}
        {inlineResult && (
          <InlineResult data={inlineResult} mode={inlineMode} />
        )}
      </div>

      {/* Fallback modal (for notes without photo_url) */}
      <AICameraModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === 'biomass' ? 'Estimar Materia Seca (MS)' : 'Evaluar Condición Corporal (CC)'}
        mode={mode}
        onApply={handleModalApply}
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
