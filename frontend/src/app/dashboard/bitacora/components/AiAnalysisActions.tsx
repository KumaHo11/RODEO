'use client'

import React, { useState, useCallback } from 'react'
import {
  Sparkles, Loader2, X, MapPin, Beef, ChevronDown, ChevronUp,
  CheckCircle2, Leaf, Save, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AICameraModal } from '@/components/AICameraModal'
import { apiFetch } from '@/lib/apiFetch'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

/** Máquina de estados explícita del flujo de análisis IA */
type AnalysisState =
  | 'IDLE'            // Sin análisis previo
  | 'ANALYZING'       // Llamada a Gemini en curso
  | 'REVIEW_PENDING'  // Resultado listo — esperando acción del usuario
  | 'COMMITTING'      // Persistiendo en potrero/rodeo
  | 'COMMITTED'       // Guardado en potrero/rodeo
  | 'DISCARDED'       // Usuario descartó sin guardar en potrero/rodeo
  | 'RESULT_ONLY'     // Resultado ya persistido previamente (aiResult del note)

/** Modo de análisis: pastura o condición corporal */
type AnalysisMode = 'biomass' | 'body-condition'

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

// ─── AI Badge (compact pill para resultado ya guardado) ────────────────────────
function AiBadge({ result }: { result: BitacoraAiResult }) {
  const label = result.type === 'materia_seca'
    ? `MS: ${result.value.toLocaleString('es')} ${result.unit}`
    : `CC: ${result.value}/5`

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

// ─── Toggle de modo Biomasa / Condición Corporal ───────────────────────────────
function AnalysisModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: AnalysisMode
  onChange: (m: AnalysisMode) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5" role="group" aria-label="Modo de análisis">
      <button
        id="analysis-mode-biomass"
        type="button"
        disabled={disabled}
        onClick={() => onChange('biomass')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${
          mode === 'biomass'
            ? 'bg-white shadow-sm text-green-700 ring-1 ring-green-200'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Leaf className="w-3 h-3" />
        Pastura
      </button>
      <button
        id="analysis-mode-bodycondition"
        type="button"
        disabled={disabled}
        onClick={() => onChange('body-condition')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${
          mode === 'body-condition'
            ? 'bg-white shadow-sm text-amber-700 ring-1 ring-amber-200'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Beef className="w-3 h-3" />
        Ganado
      </button>
    </div>
  )
}

// ─── Resultado inline — Biomasa ────────────────────────────────────────────────
function BiomassResult({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2 rounded-2xl border border-purple-200 bg-purple-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Métricas principales */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">MS disponible</span>
          <span className="text-xl font-black text-purple-800 tabular-nums leading-tight">
            {data.dry_matter_kg_ha?.toLocaleString('es') ?? '—'}{' '}
            <span className="text-[11px] font-semibold text-purple-500">kg/ha</span>
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

      {/* Métricas secundarias */}
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

      {/* Recomendación — colapsable */}
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

// ─── Resultado inline — Condición Corporal ─────────────────────────────────────
function BodyConditionResult({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">CC (BCS 1–5)</span>
          <span className="text-xl font-black text-amber-800 tabular-nums leading-tight">
            {data.bcs_score ?? '—'}{' '}
            <span className="text-[11px] font-semibold text-amber-500">/ 5</span>
          </span>
        </div>

        {data.estimated_weight_kg != null && (
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Peso est.</span>
            <span className="text-sm font-black text-amber-700">{data.estimated_weight_kg} kg</span>
          </div>
        )}

        {data.animal_count_visible != null && data.animal_count_visible > 1 && (
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Animales</span>
            <span className="text-sm font-black text-amber-700">{data.animal_count_visible} cab.</span>
          </div>
        )}

        {data.condition_label && (
          <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            data.nutritional_status === 'OPTIMO'     ? 'bg-green-200 text-green-800'
            : data.nutritional_status === 'BAJO'     ? 'bg-amber-200 text-amber-800'
            : data.nutritional_status === 'DEFICIENTE' ? 'bg-red-200 text-red-800'
            : 'bg-gray-200 text-gray-700'
          }`}>
            {data.condition_label}
          </span>
        )}
      </div>

      {/* Alertas */}
      {data.alert_level && data.alert_level !== 'NINGUNA' && data.alert_reason && (
        <div className={`mx-4 mb-3 px-3 py-2 rounded-xl text-[10px] font-bold ${
          data.alert_level === 'URGENTE' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
        }`}>
          ⚠️ {data.alert_reason}
        </div>
      )}

      {/* Señales visibles */}
      {data.visible_signs?.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {data.visible_signs.map((sign: string, i: number) => (
            <span key={i} className="text-[9px] bg-white border border-amber-200 text-amber-700 font-semibold px-1.5 py-0.5 rounded-lg">
              {sign}
            </span>
          ))}
        </div>
      )}

      {data.category_biotype && (
        <p className="px-4 pb-2 text-[10px] text-amber-700">
          <span className="font-black">Categoría:</span> {data.category_biotype}
        </p>
      )}

      {/* Recomendación */}
      {data.recommendation && (
        <div className="border-t border-amber-200">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-black text-amber-600 uppercase tracking-widest hover:bg-amber-100 transition-colors"
          >
            Recomendación
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <p className="px-4 pb-3 text-[11px] text-amber-800 leading-relaxed">
              {data.recommendation}
            </p>
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

// ─── Botones de confirmación REVIEW_PENDING ────────────────────────────────────
function ReviewActions({
  mode,
  paddockName,
  herdName,
  onCommit,
  onDiscard,
  isCommitting,
}: {
  mode: AnalysisMode
  paddockName?: string
  herdName?: string
  onCommit: () => void
  onDiscard: () => void
  isCommitting: boolean
}) {
  const targetName = mode === 'biomass'
    ? (paddockName ? `"${paddockName}"` : 'el potrero')
    : (herdName    ? `"${herdName}"`    : 'el rodeo')

  const commitLabel = mode === 'biomass'
    ? `Actualizar en potrero`
    : `Guardar en rodeo`

  return (
    <div className="mt-3 space-y-2">
      {/* Mensaje informativo */}
      <p className="text-[9px] text-gray-400 italic text-center">
        Vista previa · Los datos no han sido guardados en {targetName} todavía
      </p>

      <div className="flex gap-2">
        {/* Descartar */}
        <button
          id="ai-analysis-discard"
          type="button"
          disabled={isCommitting}
          onClick={onDiscard}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Descartar
        </button>

        {/* Confirmar → guardar en potrero/rodeo */}
        <button
          id="ai-analysis-commit"
          type="button"
          disabled={isCommitting}
          onClick={onCommit}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-white transition-all disabled:opacity-60 ${
            mode === 'biomass'
              ? 'bg-green-600 hover:bg-green-700 shadow-sm shadow-green-100'
              : 'bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-100'
          }`}
        >
          {isCommitting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Save className="w-3.5 h-3.5" />
          }
          {isCommitting ? 'Guardando…' : commitLabel}
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
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
  // ── Estado de la máquina de análisis ─────────────────────────────────────
  const [analysisState, setAnalysisState] = useState<AnalysisState>(
    note.aiResult ? 'RESULT_ONLY' : 'IDLE'
  )
  const [inlineResult, setInlineResult] = useState<any | null>(null)
  const [inlineMode, setInlineMode]     = useState<AnalysisMode>('biomass')

  // Picker de asignación rápida
  const [showPicker, setShowPicker]   = useState(false)
  const [pickerType, setPickerType]   = useState<'paddock' | 'herd'>('paddock')
  const [assigning, setAssigning]     = useState(false)

  // aiResult local (para "ya analizado")
  const [localResult, setLocalResult] = useState<BitacoraAiResult | null>(
    note.aiResult ?? null
  )

  // IDs efectivos: external (selector padre) > local picker
  const [localPaddockId, setLocalPaddockId] = useState(note.paddock_id ?? null)
  const [localHerdId, setLocalHerdId]       = useState(note.rodeo_id ?? null)
  const activePaddockId = externalPaddockId !== undefined ? externalPaddockId : localPaddockId
  const activeHerdId    = externalHerdId    !== undefined ? externalHerdId    : localHerdId

  // Toggle de modo: default basado en qué ID está seleccionado
  const defaultMode: AnalysisMode = activeHerdId ? 'body-condition' : 'biomass'
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>(defaultMode)

  // Nombres para el mensaje de confirmación
  const activePaddockName = paddocks.find(p => p.id === activePaddockId)?.name
  const activeHerdName    = herds.find(h => h.id === activeHerdId)?.name

  // Modal fallback (sin photo_url)
  const [modalOpen, setModalOpen] = useState(false)

  // Solo aplica a entradas de tipo imagen
  if (note.mediaType !== 'image') return null

  const hasPotrero = !!activePaddockId
  const hasRodeo   = !!activeHerdId
  const hasTarget  = hasPotrero || hasRodeo
  const showToggle = hasPotrero && hasRodeo  // mostrar toggle solo cuando hay ambos

  // Label del botón principal
  const buttonLabel = hasTarget
    ? selectedMode === 'body-condition' ? '✦ Evaluar CC (IA)' : '✦ Estimar MS (IA)'
    : '✦ Analizar con IA'

  // ── FASE 1: Llamar a Gemini (NO persiste en potrero/rodeo) ───────────────
  const handleDirectAnalyze = useCallback(async (
    paddockId: string | null,
    herdId: string | null,
    mode: AnalysisMode,
  ) => {
    const photoUrl = note.photo_url
    if (!photoUrl) {
      setModalOpen(true)
      return
    }

    setAnalysisState('ANALYZING')
    setInlineResult(null)

    const endpoint = mode === 'biomass' ? '/api/analyze-biomass' : '/api/analyze-body-condition'

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ imageUrl: photoUrl }),
        timeout: 65000,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error en análisis de IA')

      setInlineMode(mode)
      setInlineResult(json.data)
      setAnalysisState('REVIEW_PENDING')

      // Guardar el resultado bruto en field_note (historial), pero SIN tocar potrero/rodeo
      await apiFetch(`/api/field-notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          analysis_result: { ...json.data, _mode: mode, _source: 'bitacora_direct', _savedAt: new Date().toISOString() },
        }),
      }).catch(() => {}) // No crítico si falla — el resultado igual se muestra en UI

    } catch (err: any) {
      toast.error(`Error al analizar: ${err?.message || 'Error desconocido'}`)
      setAnalysisState('IDLE')
    }
  }, [note.photo_url, note.id])

  // ── FASE 2A: Confirmar → persistir en potrero/rodeo ─────────────────────
  const handleCommit = useCallback(async () => {
    if (!inlineResult) return
    setAnalysisState('COMMITTING')

    try {
      if (inlineMode === 'biomass' && activePaddockId) {
        await apiFetch(`/api/paddocks/${activePaddockId}`, {
          method: 'PATCH',
          body: JSON.stringify({ dry_matter_kg_ha: inlineResult.dry_matter_kg_ha }),
        })
        const aiResult: BitacoraAiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'materia_seca',
          value: inlineResult.dry_matter_kg_ha ?? 0,
          unit: 'kg MS/ha',
          targetId: activePaddockId,
          confidence: inlineResult.confidence,
        }
        setLocalResult(aiResult)
        onAiResultSaved?.(note.id, aiResult)
        toast.success(
          `✅ ${(inlineResult.dry_matter_kg_ha ?? 0).toLocaleString('es')} kg MS/ha guardados en ${activePaddockName ?? 'el potrero'}`
        )
      } else if (inlineMode === 'body-condition' && activeHerdId) {
        await apiFetch(`/api/herds/${activeHerdId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            bcs_score: inlineResult.bcs_score,
            bcs_label: inlineResult.condition_label,
            bcs_data:  inlineResult,
          }),
        })
        const aiResult: BitacoraAiResult = {
          analyzedAt: new Date().toISOString(),
          type: 'condicion_corporal',
          value: inlineResult.bcs_score ?? 0,
          unit: '/5',
          label: inlineResult.condition_label,
          targetId: activeHerdId,
        }
        setLocalResult(aiResult)
        onAiResultSaved?.(note.id, aiResult)
        toast.success(
          `✅ CC ${inlineResult.bcs_score}/5 guardado en ${activeHerdName ?? 'el rodeo'}`
        )
      } else {
        // Sin target seleccionado — no hay dónde guardar
        toast.warning('Seleccioná un potrero o rodeo antes de guardar')
        setAnalysisState('REVIEW_PENDING')
        return
      }

      setAnalysisState('COMMITTED')
    } catch (err: any) {
      toast.error(`Error al guardar el análisis: ${err?.message}`)
      setAnalysisState('REVIEW_PENDING')
    }
  }, [inlineResult, inlineMode, activePaddockId, activeHerdId, activePaddockName, activeHerdName, note.id, onAiResultSaved])

  // ── FASE 2B: Descartar → no toca potrero/rodeo, borra analysis_result de la nota ─
  const handleDiscard = useCallback(async () => {
    // Borrar el analysis_result transitorio de la field_note (no debe contaminar historial)
    await apiFetch(`/api/field-notes/${note.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ analysis_result: null }),
    }).catch(() => {})

    setInlineResult(null)
    setLocalResult(null)
    setAnalysisState('DISCARDED')
    toast.info('Análisis descartado. Las imágenes se mantienen en la Bitácora.')
  }, [note.id])

  // ── Picker: asignar potrero/rodeo antes de analizar ──────────────────────
  const handlePickerSelect = async (id: string) => {
    setShowPicker(false)
    setAssigning(true)
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
        setSelectedMode('biomass') // potrero → biomasa por defecto
      } else {
        await apiFetch(`/api/field-notes/${note.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ rodeo_id: id }),
        })
        setLocalHerdId(id)
        newHerdId = id
        onAssignHerd?.(note.id, id)
        setSelectedMode('body-condition') // rodeo → CC por defecto
      }
    } catch {
      toast.error('Error al asignar. Intentalo de nuevo.')
    } finally {
      setAssigning(false)
    }
    handleDirectAnalyze(newPaddockId, newHerdId, selectedMode)
  }

  // ── Click del botón principal ─────────────────────────────────────────────
  const handleButtonClick = () => {
    // Re-analizar desde DISCARDED o COMMITTED
    if (analysisState === 'DISCARDED' || analysisState === 'COMMITTED') {
      setAnalysisState('IDLE')
      return
    }
    if (hasTarget) {
      handleDirectAnalyze(activePaddockId, activeHerdId, selectedMode)
      return
    }
    // Sin target → mostrar picker
    setPickerType('paddock')
    setShowPicker(true)
  }

  // ── Modal apply (fallback para notas sin photo_url) ───────────────────────
  const handleModalApply = useCallback(async (data: any, uploadedUrls?: string[]) => {
    setModalOpen(false)
    setInlineMode(selectedMode)
    setInlineResult(data)
    setAnalysisState('REVIEW_PENDING')

    // Guardar resultado bruto en field_note
    await apiFetch(`/api/field-notes/${note.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        analysis_result: { ...data, _mode: selectedMode, source: 'bitacora_ai', uploadedUrls },
      }),
    }).catch(() => {})
  }, [selectedMode, note.id])

  // ─── RENDER por estado ────────────────────────────────────────────────────

  // Estado: resultado ya guardado previamente (carga desde DB)
  if (analysisState === 'RESULT_ONLY' && localResult) {
    return (
      <div className="pt-2 border-t border-gray-50 flex items-center gap-2 flex-wrap">
        <AiBadge result={localResult} />
        <span className="text-[9px] text-gray-400">
          {new Date(localResult.analyzedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
        </span>
        <button
          onClick={() => { setLocalResult(null); setAnalysisState('IDLE') }}
          className="text-[9px] text-gray-400 hover:text-gray-600 underline ml-auto"
        >
          Re-analizar
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="pt-2 border-t border-gray-50 space-y-1">

        {/* ── Toggle Biomasa / CC (visible solo cuando hay ambos targets) ── */}
        {showToggle && analysisState !== 'ANALYZING' && analysisState !== 'COMMITTING' && (
          <div className="mb-2">
            <AnalysisModeToggle
              mode={selectedMode}
              onChange={setSelectedMode}
              disabled={analysisState === 'REVIEW_PENDING'}
            />
          </div>
        )}

        {/* ── Loading ── */}
        {(analysisState === 'ANALYZING' || assigning) && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
            <span className="font-semibold">
              {assigning ? 'Asignando…' : 'Calculando con Gemini…'}
            </span>
          </div>
        )}

        {/* ── IDLE / DISCARDED / COMMITTED — botón de trigger ── */}
        {(analysisState === 'IDLE' || analysisState === 'DISCARDED' || analysisState === 'COMMITTED') && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="ai-analysis-trigger"
              onClick={handleButtonClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-full text-[11px] font-black transition-all hover:scale-[1.02]"
              title={buttonLabel}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {analysisState === 'COMMITTED' ? '✦ Re-analizar' : buttonLabel}
            </button>

            {!hasTarget && analysisState === 'IDLE' && (
              <span className="text-[9px] text-gray-400 italic">
                Seleccioná potrero o rodeo
              </span>
            )}

            {analysisState === 'DISCARDED' && (
              <span className="text-[9px] text-gray-400 italic">Análisis descartado</span>
            )}

            {analysisState === 'COMMITTED' && localResult && (
              <AiBadge result={localResult} />
            )}
          </div>
        )}

        {/* ── REVIEW_PENDING — resultado + botones de acción ── */}
        {analysisState === 'REVIEW_PENDING' && inlineResult && (
          <>
            {inlineMode === 'biomass'
              ? <BiomassResult data={inlineResult} />
              : <BodyConditionResult data={inlineResult} />
            }
            <ReviewActions
              mode={inlineMode}
              paddockName={activePaddockName}
              herdName={activeHerdName}
              onCommit={handleCommit}
              onDiscard={handleDiscard}
              isCommitting={false}
            />
          </>
        )}

        {/* ── COMMITTING ── */}
        {analysisState === 'COMMITTING' && inlineResult && (
          <>
            {inlineMode === 'biomass'
              ? <BiomassResult data={inlineResult} />
              : <BodyConditionResult data={inlineResult} />
            }
            <ReviewActions
              mode={inlineMode}
              paddockName={activePaddockName}
              herdName={activeHerdName}
              onCommit={handleCommit}
              onDiscard={handleDiscard}
              isCommitting={true}
            />
          </>
        )}

        {/* ── Picker de asignación rápida ── */}
        {showPicker && !assigning && (
          <QuickAssignPicker
            type={pickerType}
            options={pickerType === 'paddock' ? paddocks : herds}
            onSelect={handlePickerSelect}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Modal fallback (para notas sin photo_url) */}
      <AICameraModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedMode === 'biomass' ? 'Estimar Materia Seca (MS)' : 'Evaluar Condición Corporal (CC)'}
        mode={selectedMode}
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
