/**
 * OverdueAlertBanner.tsx — Banner consolidado de pastoreos vencidos
 * ─────────────────────────────────────────────────────────────────
 * Performance:
 *  - React.memo con comparación por referencia (las props vienen de useBatchAlerts)
 *  - Estado de checkboxes local (Set<string>) — no sube al store padre
 *  - Llamada batch única en lugar de N requests secuenciales
 *
 * UX:
 *  - Banner colapsado con count + severity badge
 *  - Expandir → lista con checkboxes individuales
 *  - "Seleccionar todos" / "Ninguno" para batch rápido
 *  - Botón único "Finalizar seleccionados (N)"
 */
'use client'
import React, { useState, useCallback, useMemo } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronUp,
  CheckSquare, Square, X, Loader2
} from 'lucide-react'
import type { OverduePlan } from '@/lib/grazing/useBatchAlerts'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CloseFormData {
  actual_entry_date: string
  actual_exit_date: string
  exit_dry_matter_kg_ha: string
  exit_notes: string
  closing_stock: Array<{ herd_id: string; name: string; initial: number; final: number }>
}

export interface OverdueAlertBannerProps {
  urgentPlans: OverduePlan[]
  overdueCount: number
  herds: Array<{ id: string; name: string; animal_count?: number; head_count?: number }>
  /** Abrir el modal de cierre para un plan individual */
  onOpenCloseModal: (planId: string, closeForm: CloseFormData) => void
  /** Cerrar múltiples planes en batch */
  onBatchClose: (planIds: string[]) => Promise<void>
}

// ── Helper de urgency ─────────────────────────────────────────────────────────

function urgencyLabel(plan: OverduePlan): string {
  if (plan.urgency === 'overdue') {
    const abs = Math.abs(plan.daysRemaining)
    return `Venció hace ${abs} día${abs !== 1 ? 's' : ''}`
  }
  if (plan.urgency === 'today') return 'Sale HOY'
  return 'Sale mañana'
}

function urgencyColor(urgency: OverduePlan['urgency']): string {
  if (urgency === 'overdue') return 'text-red-600'
  if (urgency === 'today')   return 'text-amber-600'
  return 'text-yellow-600'
}

// ── Componente ────────────────────────────────────────────────────────────────

function OverdueAlertBannerInner({
  urgentPlans,
  overdueCount,
  herds,
  onOpenCloseModal,
  onBatchClose,
}: OverdueAlertBannerProps) {
  const [expanded, setExpanded]         = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [isBatchClosing, setBatchClosing] = useState(false)

  // Todos los overdue seleccionados por defecto cuando se expande
  const allIds = useMemo(() => urgentPlans.map(p => p.id), [urgentPlans])

  const handleExpand = useCallback(() => {
    setExpanded(v => {
      if (!v) {
        // Auto-seleccionar los vencidos al abrir
        const overdueIds = new Set(
          urgentPlans.filter(p => p.urgency === 'overdue').map(p => p.id)
        )
        setSelected(overdueIds)
      }
      return !v
    })
  }, [urgentPlans])

  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll  = useCallback(() => setSelected(new Set(allIds)), [allIds])
  const selectNone = useCallback(() => setSelected(new Set()), [])

  const handleBatchClose = useCallback(async () => {
    if (selected.size === 0) return
    setBatchClosing(true)
    try {
      await onBatchClose([...selected])
      setSelected(new Set())
      setExpanded(false)
    } finally {
      setBatchClosing(false)
    }
  }, [selected, onBatchClose])

  const handleSingle = useCallback((plan: OverduePlan) => {
    const headCount = (herd: { animal_count?: number; head_count?: number }) =>
      Number(herd.animal_count || herd.head_count) || 0

    const closeForm: CloseFormData = {
      actual_entry_date:      plan.actual_entry_date || plan.entry_date,
      actual_exit_date:       new Date().toISOString().split('T')[0],
      exit_dry_matter_kg_ha:  '',
      exit_notes:             '',
      closing_stock: herds
        .filter(h => plan.herd_ids.includes(h.id))
        .map(h => ({
          herd_id: h.id,
          name:    h.name,
          initial: headCount(h),
          final:   headCount(h),
        })),
    }
    onOpenCloseModal(plan.id, closeForm)
  }, [herds, onOpenCloseModal])

  // ── Banner header ──────────────────────────────────────────────────────────
  const hasCritical = overdueCount > 0
  const bannerBg = hasCritical
    ? 'bg-red-50 border-red-200'
    : 'bg-amber-50 border-amber-200'
  const iconColor = hasCritical ? 'text-red-500' : 'text-amber-500'
  const textColor = hasCritical ? 'text-red-800' : 'text-amber-800'

  return (
    <div
      id="overdue-alert-banner"
      className={`rounded-xl border shadow-sm overflow-hidden transition-all ${bannerBg}`}
      role="alert"
      aria-live="polite"
    >
      {/* ── Header (siempre visible) ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleExpand}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/5 ${textColor}`}
        aria-expanded={expanded}
        aria-controls="overdue-alert-list"
      >
        <AlertTriangle className={`w-4 h-4 shrink-0 ${iconColor}`} />

        <span className="flex-1 text-xs font-bold">
          {overdueCount > 0
            ? `⚠️ ${overdueCount} potrero${overdueCount !== 1 ? 's' : ''} con pastoreo vencido`
            : null}
          {overdueCount > 0 && urgentPlans.length > overdueCount
            ? ` + ${urgentPlans.length - overdueCount} que salen hoy/mañana`
            : null}
          {overdueCount === 0
            ? `${urgentPlans.length} potrero${urgentPlans.length !== 1 ? 's' : ''} que salen hoy o mañana`
            : null}
        </span>

        {/* Badge count crítico */}
        {overdueCount > 0 && (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
            {overdueCount} vencido{overdueCount !== 1 ? 's' : ''}
          </span>
        )}

        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>

      {/* ── Lista expandida con checkboxes ────────────────────────────────── */}
      {expanded && (
        <div id="overdue-alert-list">
          {/* Toolbar de selección */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-black/10 bg-black/5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectAll}
                className={`text-[10px] font-bold transition-colors ${textColor} hover:underline`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:underline transition-colors"
              >
                Ninguno
              </button>
              <span className="text-[10px] text-gray-400">
                {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Botón batch */}
            <button
              type="button"
              id="overdue-batch-close-btn"
              onClick={handleBatchClose}
              disabled={selected.size === 0 || isBatchClosing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black
                         bg-red-600 text-white hover:bg-red-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all shadow-sm"
            >
              {isBatchClosing
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Finalizando…</>
                : <>Finalizar seleccionados ({selected.size})</>
              }
            </button>
          </div>

          {/* Items */}
          <ul className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-black/5">
            {urgentPlans.map(plan => {
              const isSelected = selected.has(plan.id)
              const isOverdue  = plan.urgency === 'overdue'

              return (
                <li key={plan.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 transition-colors">
                  {/* Checkbox */}
                  <button
                    type="button"
                    id={`overdue-check-${plan.id}`}
                    onClick={() => toggleItem(plan.id)}
                    aria-label={`${isSelected ? 'Deseleccionar' : 'Seleccionar'} potrero ${plan.paddockName}`}
                    className="shrink-0"
                  >
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-red-600" />
                      : <Square className="w-4 h-4 text-gray-300" />}
                  </button>

                  {/* Info del potrero */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${textColor}`}>
                      {plan.paddockName}
                    </p>
                    <p className={`text-[10px] font-bold ${urgencyColor(plan.urgency)}`}>
                      {urgencyLabel(plan)}
                    </p>
                  </div>

                  {/* Acción individual */}
                  <button
                    type="button"
                    id={`overdue-finalize-${plan.id}`}
                    onClick={() => handleSingle(plan)}
                    className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all
                      ${isOverdue
                        ? 'border-red-200 text-red-700 hover:bg-red-100'
                        : 'border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                  >
                    Finalizar →
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export const OverdueAlertBanner = React.memo(OverdueAlertBannerInner)
