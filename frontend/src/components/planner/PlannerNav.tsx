/**
 * PlannerNav.tsx — Navegación unificada del Planificador
 * ───────────────────────────────────────────────────────
 * Modo Gantt (isSandbox=false):
 *   [ Gantt | Lista | Historial ] segmented control
 *   Sin "Ir a Planificar" — ese Link vive en grazing/page.tsx separado.
 *
 * Modo Sandbox (isSandbox=true):
 *   [ Gantt | Lista | Historial ] — disabled si no hay planes (hasPlans=false)
 *   [ Ir al Gantt ↗ ] — green pill, disabled si no hay plan válido generado
 *
 * Uso desde el Gantt (grazing/page.tsx):
 *   <PlannerNav viewMode={viewMode} onChangeView={setViewMode} />
 *
 * Uso desde el Sandbox (sandbox/page.tsx):
 *   <PlannerNav
 *     viewMode="gantt"
 *     onChangeView={v => router.push(`/dashboard/grazing?view=${v}`)}
 *     isSandbox
 *     canGoToGantt={canGoToGantt}
 *     hasPlans={savedPlans.length > 0}
 *   />
 */
'use client'
import React from 'react'
import Link from 'next/link'
import { CalendarDays, AlignJustify, History } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PlannerViewMode = 'gantt' | 'list' | 'history'

export interface PlannerNavProps {
  /** Vista activa en el Gantt. Ignorado cuando isSandbox=true. */
  viewMode: PlannerViewMode
  /** Callback al cambiar de vista (solo relevante desde el Gantt). */
  onChangeView: (view: PlannerViewMode) => void
  /** true cuando se usa desde el Sandbox */
  isSandbox?: boolean
  /**
   * true cuando existen planes guardados.
   * Cuando false, los tabs Gantt/Lista/Historial quedan disabled en ambos modos.
   */
  hasPlans?: boolean
}

// ── Constantes ────────────────────────────────────────────────────────────────

const VIEW_TABS: Array<{
  id: PlannerViewMode
  Icon: React.ComponentType<{ className?: string }>
  label: string
}> = [
  { id: 'gantt',   Icon: CalendarDays, label: 'Gantt'     },
  { id: 'list',    Icon: AlignJustify,  label: 'Lista'     },
  { id: 'history', Icon: History,       label: 'Historial' },
]

// ── Componente ────────────────────────────────────────────────────────────────

export function PlannerNav({
  viewMode,
  onChangeView,
  isSandbox = false,
  hasPlans = true,
}: PlannerNavProps) {

  // ── Modo SANDBOX ───────────────────────────────────────────────────────────
  if (isSandbox) {
    return (
      <div
        role="navigation"
        aria-label="Navegación del Planificador"
        className="flex items-center gap-1"
      >
        {/* Segmented control — [ Gantt | Lista | Historial ] */}
        <div
          role="tablist"
          aria-label="Vistas del planificador"
          className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm gap-0.5"
        >
          {VIEW_TABS.map(({ id, Icon, label }) => {
            const isDisabled = !hasPlans
            return (
              <Link
                key={id}
                id={`sandbox-nav-view-${id}`}
                href={`/dashboard/grazing?view=${id}`}
                role="tab"
                aria-selected={false}
                aria-disabled={isDisabled}
                onClick={e => { if (isDisabled) e.preventDefault() }}
                title={
                  isDisabled
                    ? 'Generá un plan primero para acceder a esta vista'
                    : `Ver ${label}`
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isDisabled
                    ? 'text-gray-300 cursor-not-allowed pointer-events-none'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Modo GANTT — segmented control: Gantt / Lista / Historial ─────────────
  return (
    <div
      role="tablist"
      aria-label="Vistas del planificador"
      className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm gap-0.5"
    >
      {VIEW_TABS.map(({ id, Icon, label }) => {
        const isDisabled = !hasPlans
        return (
          <button
            key={id}
            id={`planner-nav-${id}`}
            role="tab"
            disabled={isDisabled}
            onClick={() => !isDisabled && onChangeView(id)}
            aria-selected={!isDisabled && viewMode === id}
            title={
              isDisabled
                ? 'No hay planes creados aún'
                : `Ver ${label}`
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isDisabled
                ? 'text-gray-300 cursor-not-allowed'
                : !isDisabled && viewMode === id
                  ? 'bg-green-50 text-green-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
