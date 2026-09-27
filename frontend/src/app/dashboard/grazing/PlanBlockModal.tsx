/**
 * PlanBlockModal.tsx
 * ─────────────────────────────────────────────────────────────────
 * Modal unificado con dos modos:
 *
 *  mode="edit"     → Ajuste de fechas únicamente (sin rodeos, sin ración)
 *  mode="finalize" → Registro de cierre de pastoreo (compacto, sin scroll)
 *
 * El modo se infiere desde la prop `mode` que el invocador debe pasar.
 * Cuando no se pasa, el componente mantiene retrocompatibilidad ("edit").
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Camera, Mic, FileText, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

// ── Utilidades ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00')
  const db = new Date(b + 'T00:00')
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000))
}

// ── Shared input class ────────────────────────────────────────────────────────
const INPUT_CLS =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-gray-300'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanBlockModalMode = 'edit' | 'finalize'

interface CloseForm {
  actual_entry_date: string
  actual_exit_date: string
  exit_dry_matter_kg_ha: string
  closing_stock: { herd_id: string; name: string; initial: number; final: number }[]
  exit_notes: string
}

interface Props {
  plan: any
  paddocks: any[]
  herds: any[]
  mode?: PlanBlockModalMode
  /** Solo para mode="finalize": estado inicial del formulario */
  closeForm?: CloseForm
  onClose: () => void
  onSaved: (updatedPlan: any) => void
  /** Solo para mode="finalize": callback cuando se guarda el cierre */
  onCloseSaved?: (closeForm: CloseForm) => Promise<void>
  savingClose?: boolean
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO EDIT — Solo ajuste de fechas
// ══════════════════════════════════════════════════════════════════════════════

function EditMode({ plan, paddocks, herds, onClose, onSaved }: Props) {
  const paddock = paddocks.find((p) => p.id === plan.paddock_id)
  const planHerdIds: string[] =
    Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0
      ? plan.herd_ids
      : plan.herd_id
      ? [plan.herd_id]
      : []
  const planHerds = herds.filter((h) => planHerdIds.includes(h.id))
  const herdLabel =
    planHerds.length > 1
      ? `${planHerds.length} rodeos`
      : planHerds[0]?.name || 'Sin rodeo'

  // Fechas ajustadas (si is_locked, usar adjusted_*; si no, usar las originales)
  const baseEntry = plan.is_locked && plan.adjusted_entry_date
    ? plan.adjusted_entry_date
    : plan.entry_date || ''
  const baseExit = plan.is_locked && plan.adjusted_exit_date
    ? plan.adjusted_exit_date
    : plan.exit_date || ''

  const [adjEntry, setAdjEntry] = useState(baseEntry)
  const [adjExit, setAdjExit]   = useState(baseExit)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Estadía resultante dinámica
  const newDays = adjEntry && adjExit ? daysBetween(adjEntry, adjExit) : null
  const origDays = plan.entry_date && plan.exit_date
    ? daysBetween(plan.entry_date, plan.exit_date)
    : null

  const handleSave = async () => {
    if (!adjEntry) { setError('Ingresá la fecha de entrada.'); return }
    if (!adjExit)  { setError('Ingresá la fecha de salida.'); return }
    if (adjExit < adjEntry) { setError('La salida no puede ser antes que la entrada.'); return }

    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, any> = {
        entry_date: adjEntry,
        exit_date: adjExit,
      }
      // Si el plan tiene is_locked, actualizar los campos adjusted_*
      if (plan.is_locked) {
        payload.adjusted_entry_date = adjEntry
        payload.adjusted_exit_date  = adjExit
      }

      const res = await apiFetch(`/api/grazing-plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `Error ${res.status}`)
        return
      }
      const data = await res.json()
      onSaved({ ...plan, ...data })
      onClose()
    } catch (e: any) {
      setError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between shrink-0">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
            Ajustar bloque
          </p>
          <h3 className="text-base font-black text-gray-950 leading-tight">
            {paddock?.name || '—'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {Number(paddock?.area_ha || 0).toFixed(1)} ha · <span className="font-bold">{herdLabel}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary pill: fechas originales */}
      <div className="mx-5 mt-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
          Fechas originales del plan
        </p>
        <div className="flex items-center gap-3 text-sm font-bold text-gray-700">
          <span>{fmtDate(plan.entry_date)}</span>
          <span className="text-gray-300">→</span>
          <span>{fmtDate(plan.exit_date)}</span>
          {origDays !== null && (
            <span className="ml-auto text-[10px] font-black text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
              {origDays}d
            </span>
          )}
        </div>
      </div>

      {/* Date inputs */}
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
              Entrada ajustada
            </label>
            <input
              type="date"
              value={adjEntry}
              onChange={(e) => setAdjEntry(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
              Salida ajustada
            </label>
            <input
              type="date"
              value={adjExit}
              min={adjEntry || undefined}
              onChange={(e) => setAdjExit(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>

        {/* Live duration feedback */}
        {newDays !== null && (
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-bold ${
            origDays !== null && newDays !== origDays
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-gray-100 border-gray-200 text-gray-600'
          }`}>
            <span>Nueva estadía</span>
            <span className="font-black">{newDays} días</span>
            {origDays !== null && newDays !== origDays && (
              <span className="text-[10px] font-black">
                {newDays > origDays ? `+${newDays - origDays}d` : `${newDays - origDays}d`} vs plan
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-1 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || !adjEntry || !adjExit}
          className="w-full flex justify-center items-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black transition-all disabled:opacity-40"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar fechas'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO FINALIZE — Registro compacto de cierre (sin scroll)
// ══════════════════════════════════════════════════════════════════════════════

function FinalizeMode({
  plan,
  paddocks,
  herds,
  closeForm: externalForm,
  onClose,
  onSaved,
  onCloseSaved,
  savingClose,
}: Props) {
  const paddock = paddocks.find((p) => p.id === plan.paddock_id)
  const planHerdIds: string[] =
    Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0
      ? plan.herd_ids
      : plan.herd_id
      ? [plan.herd_id]
      : []
  const planHerds = herds.filter((h) => planHerdIds.includes(h.id))
  const planDays = plan.entry_date && plan.exit_date
    ? daysBetween(plan.entry_date, plan.exit_date)
    : null
  const isAlreadyCompleted = plan.status === 'COMPLETED'

  // Form state — init from externalForm if provided
  const initStock = externalForm?.closing_stock.length
    ? externalForm.closing_stock
    : planHerds.map((h) => ({
        herd_id: h.id,
        name: h.name,
        initial: Number(h.head_count || h.animal_count || 0),
        final: Number(h.head_count || h.animal_count || 0),
      }))

  const [form, setForm] = useState<CloseForm>({
    actual_entry_date: externalForm?.actual_entry_date ?? plan.actual_entry_date ?? plan.entry_date ?? '',
    actual_exit_date:  externalForm?.actual_exit_date  ?? plan.actual_exit_date  ?? '',
    exit_dry_matter_kg_ha: externalForm?.exit_dry_matter_kg_ha ?? String(plan.exit_dry_matter_kg_ha ?? ''),
    closing_stock: initStock,
    exit_notes: externalForm?.exit_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleSave = async () => {
    if (!form.actual_entry_date) { setError('Ingresá la entrada real.'); return }
    if (!form.actual_exit_date)  { setError('Ingresá la salida real.'); return }
    if (form.actual_exit_date < form.actual_entry_date) {
      setError('La salida real no puede ser antes que la entrada real.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (onCloseSaved) {
        await onCloseSaved(form)
      } else {
        const body: any = {
          status: 'COMPLETED',
          actual_entry_date: form.actual_entry_date,
          actual_exit_date:  form.actual_exit_date,
          exit_dry_matter_kg_ha: form.exit_dry_matter_kg_ha ? Number(form.exit_dry_matter_kg_ha) : undefined,
          exit_notes: form.exit_notes || undefined,
          ai_analysis: {
            ...(plan.ai_analysis || {}),
            closing_stock: form.closing_stock,
          },
        }
        const res = await apiFetch(`/api/grazing-plans/${plan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError(j.error ?? `Error ${res.status}`)
          return
        }
        const data = await res.json()
        onSaved({ ...plan, ...data })
        onClose()
      }
    } catch (e: any) {
      setError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const isSaving = saving || savingClose

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-3.5 border-b border-gray-100 flex items-start justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isAlreadyCompleted ? 'bg-amber-500' : 'bg-green-500'}`} />
            <h3 className="text-base font-black text-gray-950">
              {isAlreadyCompleted ? 'Corregir cierre' : 'Finalizar pastoreo'}
            </h3>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {paddock?.name || '—'} · {Number(paddock?.area_ha || 0).toFixed(1)} ha
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── RESUMEN del plan original — compacto, una línea ─── */}
      <div className="mx-4 mt-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">Plan:</span>
        <span className="text-xs font-bold text-gray-700">
          {fmtDate(plan.entry_date)} → {fmtDate(plan.exit_date)}{planDays !== null ? ` · ${planDays}d` : ''}
        </span>
        {planHerds.length > 0 && (
          <>
            <span className="text-gray-300 text-xs">·</span>
            {planHerds.map((h: any) => (
              <span key={h.id} className="text-[10px] font-bold px-1.5 py-0.5 bg-white rounded-md border border-gray-200 text-gray-600">
                {h.name} · {h.animal_count || h.head_count || '?'} cab.
              </span>
            ))}
          </>
        )}
      </div>

      {/* ── Body compacto — sin overflow ─── */}
      <div className="px-4 pt-2 pb-4 space-y-2">

        {/* Fechas reales — 2 columnas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
              Entrada real *
            </label>
            <input
              type="date"
              value={form.actual_entry_date}
              onChange={(e) => setForm((p) => ({ ...p, actual_entry_date: e.target.value }))}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
              Salida real *
            </label>
            <input
              type="date"
              value={form.actual_exit_date}
              min={form.actual_entry_date || undefined}
              onChange={(e) => setForm((p) => ({ ...p, actual_exit_date: e.target.value }))}
              className={INPUT_CLS}
            />
          </div>
        </div>

        {/* Remanente + Stock de cierre — 2 columnas cuando hay 1 rodeo */}
        <div className={`grid gap-3 ${initStock.length === 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Remanente */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
              Remanente <span className="font-normal text-gray-400 normal-case">(kg MS/ha)</span>
            </label>
            <input
              type="number"
              step={50}
              min={0}
              value={form.exit_dry_matter_kg_ha}
              onChange={(e) => setForm((p) => ({ ...p, exit_dry_matter_kg_ha: e.target.value }))}
              placeholder="Ej: 800"
              className={INPUT_CLS}
            />
          </div>

          {/* Stock de cierre — solo si hay exactamente 1 rodeo cabe en la grilla */}
          {initStock.length === 1 && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
                Stock cierre <span className="font-normal text-gray-400 normal-case">(cab.)</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.closing_stock[0]?.final ?? ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    closing_stock: p.closing_stock.map((r, i) =>
                      i === 0 ? { ...r, final: Number(e.target.value) } : r
                    ),
                  }))
                }
                placeholder={String(initStock[0]?.initial ?? 0)}
                className={INPUT_CLS}
              />
            </div>
          )}
        </div>

        {/* Stock de cierre — multi-rodeo */}
        {initStock.length > 1 && (
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
              Stock de cierre <span className="font-normal text-gray-400 normal-case">(cab. finales)</span>
            </label>
            <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
              {form.closing_stock.map((row, idx) => (
                <div key={row.herd_id} className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                  <p className="text-xs font-bold text-gray-800 flex-1 truncate">{row.name}</p>
                  <span className="text-[10px] text-gray-400">{row.initial}→</span>
                  <input
                    type="number"
                    min={0}
                    value={row.final}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        closing_stock: p.closing_stock.map((r, i) =>
                          i === idx ? { ...r, final: Number(e.target.value) } : r
                        ),
                      }))
                    }
                    className="w-20 text-sm font-bold text-center bg-white border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                  />
                  <span className="text-[10px] text-gray-400 shrink-0">cab.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observaciones + placeholder multimedia */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest block">
            Observaciones <span className="font-normal text-gray-400 normal-case">(opcional)</span>
          </label>
          <textarea
            value={form.exit_notes}
            onChange={(e) => setForm((p) => ({ ...p, exit_notes: e.target.value }))}
            placeholder="Registrá cualquier eventualidad del pastoreo..."
            rows={2}
            className={`${INPUT_CLS} resize-none leading-relaxed`}
          />
          {/* Placeholder adjuntos multimedia */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Adjuntar</span>
            {[
              { icon: Camera, label: 'Foto' },
              { icon: Mic,    label: 'Audio' },
              { icon: FileText, label: 'Texto' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                disabled
                title={`${label} — próximamente`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-gray-200 text-[10px] font-bold text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors disabled:cursor-not-allowed"
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
            <span className="text-[9px] text-gray-300 italic">Próximamente</span>
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Footer — sin botón Cancelar (usar la X del header) */}
      <div className="px-4 pb-4 pt-0 shrink-0">
        <button
          disabled={!form.actual_exit_date || !form.actual_entry_date || !!isSaving}
          onClick={handleSave}
          className="w-full flex justify-center items-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black transition-all disabled:opacity-40"
        >
          {isSaving
            ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
            : <><CheckCircle2 className="w-4 h-4" />Confirmar salida</>
          }
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Export principal — selector de modo
// ══════════════════════════════════════════════════════════════════════════════

export default function PlanBlockModal(props: Props) {
  if (typeof document === 'undefined') return null

  const mode = props.mode ?? 'edit'

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      {mode === 'finalize'
        ? <FinalizeMode {...props} />
        : <EditMode {...props} />
      }
    </div>,
    document.body
  )
}
