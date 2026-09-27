/**
 * PlanDropdown.tsx — Selector multi-plan para el Gantt
 * ─────────────────────────────────────────────────────
 * Renderiza un dropdown con checkboxes para tildar uno o varios planes.
 * Solo debe mostrarse cuando hay ≥2 planes guardados.
 *
 * Features:
 *  - Dots de color para identificar cada plan visualmente
 *  - Checkbox estilizado con el color del plan
 *  - Footer con acciones "Todos" / "Ninguno"
 *  - Cierre al hacer click fuera
 *  - Animación de apertura con Tailwind animate-in
 *
 * Regla de negocio: si allowEmpty=false (default), no se puede deseleccionar
 * el último plan activo (siempre queda al menos 1 seleccionado).
 */
'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PlanOption {
  id: string
  name: string
  color: string
  status?: 'active' | 'completed'
  dateRange?: string
}

export interface PlanDropdownProps {
  plans: PlanOption[]
  selectedIds: string[]
  onToggle: (planId: string) => void
  /** Si true, permite dejar 0 planes seleccionados. Default: false. */
  allowEmpty?: boolean
  className?: string
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PlanDropdown({
  plans,
  selectedIds,
  onToggle,
  allowEmpty = false,
  className = '',
}: PlanDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // ── Cierre al hacer click fuera ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Handler con regla "mínimo 1" ─────────────────────────────────────────
  const handleToggle = useCallback((id: string) => {
    const isSelected = selectedIds.includes(id)
    if (isSelected && !allowEmpty && selectedIds.length === 1) return
    onToggle(id)
  }, [selectedIds, allowEmpty, onToggle])

  // ── Seleccionar todos ────────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    plans.forEach(p => {
      if (!selectedIds.includes(p.id)) onToggle(p.id)
    })
  }, [plans, selectedIds, onToggle])

  // ── Deseleccionar todos ──────────────────────────────────────────────────
  const deselectAll = useCallback(() => {
    plans.forEach(p => {
      if (selectedIds.includes(p.id)) onToggle(p.id)
    })
  }, [plans, selectedIds, onToggle])

  // ── Labels del trigger ───────────────────────────────────────────────────
  const selectedPlans = plans.filter(p => selectedIds.includes(p.id))
  const triggerLabel =
    selectedPlans.length === 0
      ? 'Ningún plan'
      : selectedPlans.length === 1
      ? selectedPlans[0].name
      : `${selectedPlans.length} planes`

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      {/* ── Trigger ───────────────────────────────────────────────────────── */}
      <button
        id="plan-dropdown-trigger"
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 h-8 px-3 bg-white border border-gray-200 rounded-xl
                   text-xs font-bold text-gray-700 hover:border-gray-300 transition-all shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400"
      >
        {/* Color dots de los planes seleccionados */}
        <span className="flex -space-x-1" aria-hidden>
          {selectedPlans.slice(0, 3).map(p => (
            <span
              key={p.id}
              className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </span>

        <span className="max-w-[128px] truncate">{triggerLabel}</span>

        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Seleccionar planes"
          className="absolute top-[calc(100%+6px)] left-0 z-[300] bg-white border border-gray-200
                     rounded-2xl shadow-xl w-64 overflow-hidden
                     animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Encabezado */}
          <div className="px-3 pt-3 pb-1.5 border-b border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
              {plans.length} plan{plans.length !== 1 ? 'es' : ''} disponibles
            </p>
          </div>

          {/* Lista de planes */}
          <ul className="py-1 max-h-56 overflow-y-auto overscroll-contain">
            {plans.map(plan => {
              const isSelected = selectedIds.includes(plan.id)
              const isOnlySelected = isSelected && selectedIds.length === 1 && !allowEmpty

              return (
                <li key={plan.id} role="option" aria-selected={isSelected}>
                  <button
                    id={`plan-dropdown-item-${plan.id}`}
                    type="button"
                    onClick={() => handleToggle(plan.id)}
                    disabled={isOnlySelected}
                    title={isOnlySelected ? 'Debe quedar al menos 1 plan seleccionado' : undefined}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left
                               hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {/* Checkbox estilizado */}
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded border-2 transition-all
                                  flex items-center justify-center ${
                        isSelected
                          ? 'border-transparent'
                          : 'border-gray-300 bg-white'
                      }`}
                      style={isSelected ? { backgroundColor: plan.color } : {}}
                    >
                      {isSelected && (
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      )}
                    </span>

                    {/* Dot de color del plan */}
                    <span
                      className="flex-shrink-0 w-2 h-2 rounded-full"
                      style={{ backgroundColor: plan.color }}
                    />

                    {/* Nombre + rango de fechas */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {plan.name}
                      </p>
                      {plan.dateRange && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {plan.dateRange}
                        </p>
                      )}
                    </div>

                    {/* Badge de estado */}
                    {plan.status === 'completed' && (
                      <span className="flex-shrink-0 text-[9px] font-black text-gray-400
                                       bg-gray-100 px-1.5 py-0.5 rounded-full">
                        CERRADO
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Footer: acciones masivas */}
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] font-bold text-green-600 hover:text-green-700 transition-colors"
            >
              Todos
            </button>
            {allowEmpty && (
              <button
                type="button"
                onClick={deselectAll}
                className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Ninguno
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
