'use client'

import React, { useState, useCallback } from 'react'
import { MessageCircle, WifiOff, AlertTriangle, Pencil, Trash2, Check, X, ArrowRight, Sparkles } from 'lucide-react'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'
import { BitacoraMediaPreview } from './BitacoraMediaPreview'
import { AiAnalysisActions } from './AiAnalysisActions'
import { PotreroRodeoSelector } from './PotreroRodeoSelector'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

// ─── Operator Avatar ──────────────────────────────────────────────────────────
function OperatorAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('')

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
      />
    )
  }

  // Color based on first letter
  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-teal-500',
  ]
  const colorIdx = name.charCodeAt(0) % colors.length

  return (
    <div className={`w-8 h-8 rounded-full ${colors[colorIdx]} flex items-center justify-center text-white text-[11px] font-black ring-2 ring-white shadow-sm shrink-0`}>
      {initials || '?'}
    </div>
  )
}

// ─── WhatsApp AI Banner ───────────────────────────────────────────────────────
const INTENT_META: Record<string, { label: string; color: string; bg: string }> = {
  HERD_MOVE:   { label: 'Movimiento',  color: 'text-blue-700',   bg: 'bg-blue-50' },
  BIRTH:       { label: 'Nacimiento',  color: 'text-green-700',  bg: 'bg-green-50' },
  DEATH:       { label: 'Mortandad',   color: 'text-red-700',    bg: 'bg-red-50' },
  RAINFALL:    { label: 'Lluvia',      color: 'text-sky-700',    bg: 'bg-sky-50' },
  OBSERVATION: { label: 'Observación', color: 'text-gray-700',   bg: 'bg-gray-100' },
  TASK:        { label: 'Tarea',       color: 'text-amber-700',  bg: 'bg-amber-50' },
  UNKNOWN:     { label: 'Sin intent',  color: 'text-gray-500',   bg: 'bg-gray-50' },
}

function WhatsAppBanner({
  note,
  onApply,
  onDismiss,
}: {
  note: BitacoraEntry
  onApply: () => void
  onDismiss: () => void
}) {
  const ar = note.analysis_result
  if (!ar) return null

  const intent = ar.intent ?? 'UNKNOWN'
  const conf = ar.confidence ?? 0
  const needsReview = ar.needsReview ?? conf < 85
  const meta = INTENT_META[intent] ?? INTENT_META.UNKNOWN
  const entities = ar.entities ?? {}

  return (
    <div className={`mt-3 rounded-xl border p-3 ${needsReview ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Sparkles className={`w-3.5 h-3.5 ${needsReview ? 'text-amber-500' : 'text-green-600'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">IA</span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {needsReview
            ? <AlertTriangle className="w-3 h-3 text-amber-500" />
            : <Check className="w-3 h-3 text-green-600" />}
          <span className={`text-[10px] font-black ${needsReview ? 'text-amber-600' : 'text-green-700'}`}>
            {conf}% confianza
          </span>
        </div>
      </div>

      {(entities.to_paddock_name || entities.from_paddock_name || entities.herd_name ||
        entities.head_count != null || entities.rainfall_mm != null ||
        entities.birth_count != null || entities.death_count != null) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entities.herd_name && (
            <span className="text-[10px] bg-white border border-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-lg">
              🐄 {entities.herd_name}
            </span>
          )}
          {entities.from_paddock_name && (
            <span className="text-[10px] bg-white border border-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-lg">
              {entities.from_paddock_name}
            </span>
          )}
          {entities.from_paddock_name && entities.to_paddock_name && (
            <ArrowRight className="w-3 h-3 text-gray-400 self-center" />
          )}
          {entities.to_paddock_name && (
            <span className="text-[10px] bg-white border border-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-lg">
              {entities.to_paddock_name}
            </span>
          )}
          {entities.head_count != null && (
            <span className="text-[10px] bg-white border border-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-lg">
              {entities.head_count} cabezas
            </span>
          )}
          {entities.rainfall_mm != null && (
            <span className="text-[10px] bg-sky-100 border border-sky-200 text-sky-700 font-bold px-2 py-0.5 rounded-lg">
              🌧 {entities.rainfall_mm} mm
            </span>
          )}
          {entities.birth_count != null && (
            <span className="text-[10px] bg-green-100 border border-green-200 text-green-700 font-bold px-2 py-0.5 rounded-lg">
              +{entities.birth_count} nacimientos
            </span>
          )}
          {entities.death_count != null && (
            <span className="text-[10px] bg-red-100 border border-red-200 text-red-700 font-bold px-2 py-0.5 rounded-lg">
              -{entities.death_count} bajas
            </span>
          )}
        </div>
      )}

      {ar.suggestion && (
        <p className="mt-2 text-[11px] text-gray-600 italic">"{ar.suggestion}"</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-black text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 transition-all"
        >
          <X className="w-3 h-3" /> Descartar
        </button>
        <button
          onClick={onApply}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-black text-white transition-all ${
            needsReview ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          <Check className="w-3 h-3" />
          {needsReview ? 'Validar y Aplicar' : 'Aplicar al Planificador'}
        </button>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BitacoraCardProps {
  note: BitacoraEntry
  paddocks?: { id: string; name: string }[]
  herds?: { id: string; name: string }[]
  onDelete: (id: string, isPending: boolean) => void
  onEdit?: (note: BitacoraEntry) => void
  onApplyWA?: (note: BitacoraEntry) => void
  onDismissWA?: (note: BitacoraEntry) => void
  onAiResultSaved?: (noteId: string, result: BitacoraAiResult) => void
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function BitacoraCard({
  note,
  paddocks = [],
  herds = [],
  onDelete,
  onEdit,
  onApplyWA,
  onDismissWA,
  onAiResultSaved,
}: BitacoraCardProps) {
  const isWhatsApp = note.source === 'WHATSAPP' || note.source === 'whatsapp'
  const hasAI = isWhatsApp && !!note.analysis_result && note.status !== 'APPROVED' && note.status !== 'DISMISSED'
  const needsReview = hasAI && (note.analysis_result?.needsReview ?? false)
  const operatorName = note.operator?.name || note.user_display_name
  const hasMedia = note.mediaType !== 'text' || !!(note.content || note.text)

  // Bidirectional state: selector updates propagate to AI button
  const [localPaddockId, setLocalPaddockId] = useState(note.paddock_id ?? null)
  const [localPaddockName, setLocalPaddockName] = useState(note.paddock_name ?? undefined)
  const [localHerdId, setLocalHerdId] = useState(note.rodeo_id ?? null)

  const handlePotreroChange = useCallback((id: string | null) => {
    setLocalPaddockId(id)
    const name = paddocks.find(p => p.id === id)?.name
    setLocalPaddockName(name)
  }, [paddocks])

  const handleRodeoChange = useCallback((id: string | null) => {
    setLocalHerdId(id)
  }, [])

  return (
    <div className={`group bg-white rounded-2xl border shadow-sm transition-shadow hover:shadow-md flex flex-col ${
      needsReview ? 'border-amber-200' : 'border-gray-150'
    }`}>

      {/* ── A. Header ───────────────────────────────────────────────────── */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {operatorName ? (
            <OperatorAvatar name={operatorName} avatarUrl={note.operator?.avatarUrl} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-gray-400 text-[11px] font-black">?</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Name + role */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-gray-900 truncate">
                {operatorName || 'Rodeo'}
              </span>
              {note.operator?.role && (
                <span className="text-[9px] font-semibold text-gray-400">
                  · {note.operator.role}
                </span>
              )}
            </div>

            {/* Meta row: time + source badge + paddock + pending */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400">{fmtTime(note.createdAt)}</span>

              {isWhatsApp && (
                <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                  <MessageCircle className="w-2.5 h-2.5" /> WA
                </span>
              )}

              {note.paddock_name && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-200" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                    {note.paddock_name}
                  </span>
                </>
              )}

              {needsReview && (
                <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                  <AlertTriangle className="w-2.5 h-2.5" /> Revisar
                </span>
              )}

              {note.is_pending && (
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                  <WifiOff className="w-2.5 h-2.5" /> Pendiente
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Potrero / Rodeo selectors */}
        {(paddocks.length > 0 || herds.length > 0) && !note.is_pending && (
          <div className="mt-3">
            <PotreroRodeoSelector
              noteId={note.id}
              potreroId={localPaddockId ?? undefined}
              potreroName={localPaddockName}
              rodeoId={localHerdId ?? undefined}
              paddocks={paddocks}
              herds={herds}
              onPotreroChange={handlePotreroChange}
              onRodeoChange={handleRodeoChange}
            />
          </div>
        )}
      </div>

      {/* ── B. Media Body ───────────────────────────────────────────────── */}
      {hasMedia && (
        <div className="px-4 pb-3">
          <BitacoraMediaPreview note={note} />
        </div>
      )}

      {/* WhatsApp AI Banner */}
      {hasAI && onApplyWA && onDismissWA && (
        <div className="px-4 pb-3">
          <WhatsAppBanner
            note={note}
            onApply={() => onApplyWA(note)}
            onDismiss={() => onDismissWA(note)}
          />
        </div>
      )}

      {/* ── C. Footer Actions ──────────────────────────────────────────── */}
      <div className="px-4 pb-4 mt-auto">
        {/* AI Analysis (violet) */}
        <AiAnalysisActions
          note={note}
          paddocks={paddocks}
          herds={herds}
          externalPaddockId={localPaddockId}
          externalHerdId={localHerdId}
          onAiResultSaved={onAiResultSaved}
        />

        {/* Edit/Delete */}
        <div className="flex items-center justify-end gap-1 mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
          {note.mediaType === 'text' && !note.is_pending && onEdit && (
            <button
              onClick={() => onEdit(note)}
              className="flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(note.id, !!note.is_pending)}
            className="flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
