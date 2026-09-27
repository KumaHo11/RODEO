/**
 * HerdPlanTabs.tsx — Selector de Planes / Rodeos (Tabs)
 * ──────────────────────────────────────────────────────
 * Componente reutilizable compartido entre:
 *   - Gantt/Lista/Historial: navega entre sub-planes (rodeos) del plan maestro
 *   - Mesa de Arena (Sandbox): lista planes activos generados, permite cargarlos
 *
 * Props:
 *   plans       — Lista de planes/season_plans a mostrar
 *   activeId    — ID del plan actualmente seleccionado
 *   onSelect    — Callback al seleccionar un plan
 *   onDelete    — Callback al confirmar eliminación (opcional)
 *   showDelete  — Si mostrar el botón de papelera (default: true)
 *   variant     — 'tabs' (horizontal) o 'list' (vertical compacto)
 *
 * Tarea 4: Gantt usa variant="tabs" con onDelete para planificaciones sugeridas
 * Tarea 5: Mesa de Arena usa variant="list" para cargar planes guardados
 */
'use client'

import React, { useState, useCallback } from 'react'
import { Trash2, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { createPortal } from 'react-dom'

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface PlanTabItem {
  id: string
  /** Nombre del plan o rodeo */
  name: string
  /** Subtítulo opcional: p.ej. "Rodeo Vacas · 45 EV" */
  subtitle?: string
  /** Color de la pestaña (hex o clase tailwind) */
  color?: string
  /** Estado del plan */
  status?: 'active' | 'completed' | 'planned' | 'suggested'
  /** Número de bloques / registros dentro del plan */
  blockCount?: number
  /** Herd IDs incluidos en este plan */
  herdIds?: string[]
  /** Si se puede eliminar el plan (default: true) */
  deletable?: boolean
  /** Datos originales del plan para recarga en la sandbox */
  raw?: Record<string, any>
}

export interface HerdPlanTabsProps {
  plans: PlanTabItem[]
  activeId: string | null
  onSelect: (plan: PlanTabItem) => void
  onDelete?: (plan: PlanTabItem) => void
  showDelete?: boolean
  variant?: 'tabs' | 'list'
  className?: string
  emptyMessage?: string
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Activo',    icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50'  },
  completed: { label: 'Completado', icon: CheckCircle2, color: 'text-gray-400',   bg: 'bg-gray-50'   },
  planned:   { label: 'Planificado', icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
  suggested: { label: 'Sugerido',  icon: AlertCircle,  color: 'text-amber-600',  bg: 'bg-amber-50'  },
}

// ── Delete confirm mini-modal ──────────────────────────────────────────────────

function DeleteConfirmPortal({
  plan,
  onConfirm,
  onCancel,
}: {
  plan: PlanTabItem
  onConfirm: () => void
  onCancel: () => void
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{
        backdropFilter: 'blur(8px) saturate(0.8)',
        WebkitBackdropFilter: 'blur(8px) saturate(0.8)',
        backgroundColor: 'rgba(0,0,0,0.55)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-base font-black text-gray-900 leading-none">
              Eliminar plan
            </h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              ¿Eliminar <strong>"{plan.name}"</strong>? Esta acción no se puede deshacer.
              Se eliminarán todos los bloques asociados.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export function HerdPlanTabs({
  plans,
  activeId,
  onSelect,
  onDelete,
  showDelete = true,
  variant = 'tabs',
  className = '',
  emptyMessage = 'No hay planes disponibles',
}: HerdPlanTabsProps) {
  const [pendingDelete, setPendingDelete] = useState<PlanTabItem | null>(null)

  const handleDeleteClick = useCallback((e: React.MouseEvent, plan: PlanTabItem) => {
    e.stopPropagation()
    setPendingDelete(plan)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (pendingDelete && onDelete) {
      onDelete(pendingDelete)
    }
    setPendingDelete(null)
  }, [pendingDelete, onDelete])

  if (plans.length === 0) {
    return (
      <div className={`flex items-center justify-center py-4 text-xs text-gray-400 font-medium ${className}`}>
        {emptyMessage}
      </div>
    )
  }

  // ── Variant: tabs (horizontal) ─────────────────────────────────────────────
  if (variant === 'tabs') {
    return (
      <>
        <div
          role="tablist"
          className={`flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide ${className}`}
          aria-label="Planes de rodeo"
        >
          {plans.map((plan) => {
            const isActive = plan.id === activeId
            const statusConf = plan.status ? STATUS_CONFIG[plan.status] : null
            const StatusIcon = statusConf?.icon

            return (
              <div key={plan.id} className="relative group shrink-0">
                <button
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelect(plan)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl
                    transition-all whitespace-nowrap border
                    ${isActive
                      ? 'bg-white text-green-700 border-green-200 shadow-sm'
                      : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-700'
                    }
                  `}
                >
                  {/* Color dot */}
                  {plan.color && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: plan.color }}
                    />
                  )}

                  <span>{plan.name}</span>

                  {/* Status icon */}
                  {StatusIcon && (
                    <StatusIcon className={`w-3.5 h-3.5 ${statusConf!.color}`} />
                  )}

                  {/* Block count badge */}
                  {plan.blockCount !== undefined && (
                    <span className={`
                      w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center
                      ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}
                    `}>
                      {plan.blockCount}
                    </span>
                  )}

                  {/* Delete button — only on hover and if deletable */}
                  {showDelete && onDelete && plan.deletable !== false && (
                    <span
                      onClick={(e) => handleDeleteClick(e, plan)}
                      className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                      title="Eliminar plan"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteClick(e as any, plan) }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Delete confirmation portal */}
        {pendingDelete && (
          <DeleteConfirmPortal
            plan={pendingDelete}
            onConfirm={handleConfirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </>
    )
  }

  // ── Variant: list (vertical — Sandbox plan selector) ───────────────────────
  return (
    <>
      <div
        className={`flex flex-col gap-1 ${className}`}
        role="listbox"
        aria-label="Planes guardados"
      >
        {plans.map((plan) => {
          const isActive = plan.id === activeId
          const statusConf = plan.status ? STATUS_CONFIG[plan.status] : null
          const StatusIcon = statusConf?.icon

          return (
            <div key={plan.id} className="relative group">
              <button
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(plan)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                  transition-all border
                  ${isActive
                    ? 'bg-green-50 border-green-200 shadow-sm'
                    : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }
                `}
              >
                {/* Color strip */}
                {plan.color && (
                  <div
                    className="w-1 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: plan.color }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-bold truncate ${isActive ? 'text-green-800' : 'text-gray-800'}`}>
                    {plan.name}
                  </p>
                  {plan.subtitle && (
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">
                      {plan.subtitle}
                    </p>
                  )}
                </div>

                {/* Status chip */}
                {statusConf && StatusIcon && (
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.color} shrink-0`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConf.label}
                  </span>
                )}

                <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-green-500' : 'text-gray-300'}`} />

                {/* Delete button */}
                {showDelete && onDelete && plan.deletable !== false && (
                  <span
                    onClick={(e) => handleDeleteClick(e, plan)}
                    className="opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                    title="Eliminar plan"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteClick(e as any, plan) }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Delete confirmation portal */}
      {pendingDelete && (
        <DeleteConfirmPortal
          plan={pendingDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
