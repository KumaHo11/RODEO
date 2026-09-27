'use client'

/**
 * GanttView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista Gantt — Componente Presentacional.
 *
 * RESPONSABILIDADES:
 *  1. Header con selector multi-plan y chips de colores
 *  2. Alertas de movimiento inminente
 *  3. Tabs Manual / Sugerido
 *  4. Renderizar el InteractiveGantt con los colores del SSOT
 *
 * CERO lógica de negocio — los handlers vienen de page.tsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react'
import { Check, ChevronDown, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { createPortal } from 'react-dom'
import InteractiveGantt from '../InteractiveGantt'
import { fmtDate, type GrazingPlanRow, type SeasonPlanRow } from '@/lib/grazing/planFormatters'
import type { UsePlanViewFiltersReturn, GanttTab } from '@/hooks/usePlanViewFilters'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GanttViewProps {
  // Datos filtrados (ya desde el hook SSOT)
  filteredPlans: GrazingPlanRow[]
  paddocks: any[]
  herds: any[]
  farmEvents: any[]
  movements: any[]
  seasonPlans: SeasonPlanRow[]
  weatherEvents: any[]

  // Selección y colores (SSOT)
  selectedSeasonPlanIds: string[]
  activeSeasonPlanId: string | null
  activeGanttTab: GanttTab
  seasonPlanColorMap: Record<string, string>

  // Acciones del hook SSOT
  onToggleSeasonPlan: UsePlanViewFiltersReturn['toggleSeasonPlan']
  onSetActiveSeasonPlanId: UsePlanViewFiltersReturn['setActiveSeasonPlanId']
  onSetActiveGanttTab: UsePlanViewFiltersReturn['setActiveGanttTab']

  // Configuración del Gantt
  windowStart: string
  windowDays: number
  rainfallData: Record<string, number>
  droughtThresholdMm: number
  targetRemnant: number
  dailyAllocationKg: number
  climateViewEnabled: boolean
  paddockCAdj: Record<string, number>
  paddockAAdj: Record<string, number>
  ganttLayers: {
    showOriginal: boolean
    showPlanned: boolean
    showReal: boolean
    showEvents: boolean
    showAgenda: boolean
    showRemnant: boolean
    showAnimals: boolean
  }
  bioMilestones: any[]
  paddockOrder: string[]

  // Handlers de negocio (desde page.tsx)
  onBlockClick: (plan: any, evt?: React.MouseEvent) => void
  onBlockMove: (planId: string, newEntry: string, newExit: string, ctx?: any) => void
  onRainfallChange: (key: string, mm: number) => void
  onDroughtThresholdChange: (mm: number) => void
  onDeleteEvent: (evt: any) => void
  onEditEvent: (evt: any) => void
  onHerdClick: (herd: any) => void
  onHerdUpdate: (herdId: string, updates: any) => void
  onPaddockClick: (paddockId: string) => void
  onPaddockToggle: (paddockId: string, isActive: boolean) => void
  onPaddockReorder?: (paddockId: string, dir: 'up' | 'down') => void

  // Alertas de movimiento inminente
  urgentPlans: GrazingPlanRow[]
  onUrgentPlanClick: (plan: GrazingPlanRow) => void
}

// ─── Sub-componente: Multi-Plan Selector Header ───────────────────────────────

interface PlanSelectorHeaderProps {
  seasonPlans: SeasonPlanRow[]
  selectedSeasonPlanIds: string[]
  activeSeasonPlanId: string | null
  seasonPlanColorMap: Record<string, string>
  onToggle: (id: string) => void
  onSetActive: (id: string | null) => void
}

function PlanSelectorHeader({
  seasonPlans,
  selectedSeasonPlanIds,
  activeSeasonPlanId,
  seasonPlanColorMap,
  onToggle,
  onSetActive,
}: PlanSelectorHeaderProps) {
  const [open, setOpen] = React.useState(false)

  const selectedPlans = seasonPlans.filter((sp) => selectedSeasonPlanIds.includes(sp.id))

  return (
    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
      {/* Chips de planes seleccionados */}
      {selectedPlans.map((sp) => {
        const color = seasonPlanColorMap[sp.id] || '#9ca3af'
        const isActive = sp.id === activeSeasonPlanId
        return (
          <button
            key={sp.id}
            onClick={() => {
              // Click en el chip: alternar selección
              onToggle(sp.id)
            }}
            title={`${isActive ? 'Plan activo del Gantt' : 'Haz clic para desactivar'}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold
                         border transition-all hover:scale-[1.02] active:scale-95 ${
                           isActive
                             ? 'shadow-sm scale-[1.01]'
                             : 'opacity-80 hover:opacity-100'
                         }`}
            style={{
              backgroundColor: color + '18',
              borderColor: color + '55',
              color: color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="truncate max-w-[120px]">{sp.name}</span>
            {isActive && (
              <span
                className="w-1 h-1 rounded-full shrink-0 animate-pulse"
                style={{ backgroundColor: color }}
                title="Activo"
                aria-hidden
              />
            )}
          </button>
        )
      })}

      {/* Botón para abrir el selector de planes */}
      {seasonPlans.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen((p) => !p)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-500
                       hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200
                       rounded-lg transition-all"
            title="Seleccionar planes"
          >
            <ChevronDown className="w-3 h-3" />
            {seasonPlans.length} plan{seasonPlans.length !== 1 ? 'es' : ''}
          </button>

          {open &&
            typeof document !== 'undefined' &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[8999]"
                  onClick={() => setOpen(false)}
                />
                <div
                  className="fixed z-[9000] bg-white border border-gray-100 shadow-2xl rounded-2xl w-72 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  style={{ top: 60, left: 16 }}
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">
                      Seleccionar planes
                    </span>
                    <span className="text-[9px] text-gray-400 font-medium">
                      {selectedSeasonPlanIds.length} seleccionado{selectedSeasonPlanIds.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {[...seasonPlans]
                      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
                      .map((sp) => {
                        const selected = selectedSeasonPlanIds.includes(sp.id)
                        const color = seasonPlanColorMap[sp.id] || '#9ca3af'
                        return (
                          <button
                            key={sp.id}
                            onClick={() => {
                              onToggle(sp.id)
                              if (!activeSeasonPlanId && !selected) {
                                onSetActive(sp.id)
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            {/* Checkbox visual */}
                            <span
                              className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                selected ? 'border-0' : 'border-gray-300'
                              }`}
                              style={selected ? { backgroundColor: color } : {}}
                            >
                              {selected && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>

                            {/* Color dot */}
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />

                            {/* Info del plan */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                                {sp.name}
                              </p>
                              <p className="text-[9px] text-gray-400 font-medium">
                                {sp.year}
                                {sp.season_type === 'cerrado' ? ' · Cerrada' : ' · Abierta'}
                                {sp.source === 'suggested' ? ' · IA' : ''}
                              </p>
                            </div>

                            {/* Indicador de plan activo del viewport */}
                            {sp.id === activeSeasonPlanId && (
                              <span className="text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md shrink-0">
                                Activo
                              </span>
                            )}
                          </button>
                        )
                      })}
                  </div>

                  {/* Acción: marcar como activo del viewport */}
                  {selectedSeasonPlanIds.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80">
                      <p className="text-[9px] text-gray-400 font-medium">
                        El plan "activo" posiciona la ventana del Gantt. Tildá múltiples para verlos en simultáneo.
                      </p>
                    </div>
                  )}
                </div>
              </>,
              document.body
            )}
        </div>
      )}

      {/* Si no hay ningún plan seleccionado */}
      {selectedSeasonPlanIds.length === 0 && seasonPlans.length > 0 && (
        <span className="text-[10px] text-gray-400 font-medium italic">
          Seleccioná uno o más planes para visualizar
        </span>
      )}
    </div>
  )
}

// ─── Sub-componente: Alerta de movimiento inminente ───────────────────────────

interface UrgentAlertProps {
  plans: GrazingPlanRow[]
  paddocks: any[]
  onClick: (plan: GrazingPlanRow) => void
}

function UrgentAlerts({ plans, paddocks, onClick }: UrgentAlertProps) {
  if (plans.length === 0) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-1.5 mb-3">
      {plans.map((p) => {
        const paddock = paddocks.find((pd: any) => pd.id === p.paddock_id)
        const exitDate = p.exit_date ? new Date(p.exit_date + 'T00:00:00') : null
        const diff = exitDate
          ? Math.ceil((exitDate.getTime() - today.getTime()) / 86400000)
          : null
        const isOverdue = diff !== null && diff < 0
        const isToday = diff === 0

        return (
          <div
            key={p.id}
            onClick={() => onClick(p)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer
                         transition-all hover:shadow-sm ${
                           isOverdue
                             ? 'bg-red-50 border-red-200 text-red-700'
                             : 'bg-amber-50 border-amber-200 text-amber-800'
                         }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}
            />
            <span>
              {isOverdue
                ? `¡Potrero ${paddock?.name || '?'} — los animales debieron salir hace ${Math.abs(diff!)} día(s)!`
                : isToday
                ? `Potrero ${paddock?.name || '?'} — los animales salen HOY`
                : `Potrero ${paddock?.name || '?'} — mañana hay que mover los animales`}
            </span>
            <span className="ml-auto shrink-0 underline">Finalizar →</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function GanttView({
  filteredPlans,
  paddocks,
  herds,
  farmEvents,
  movements,
  seasonPlans,
  weatherEvents,
  selectedSeasonPlanIds,
  activeSeasonPlanId,
  activeGanttTab,
  seasonPlanColorMap,
  onToggleSeasonPlan,
  onSetActiveSeasonPlanId,
  onSetActiveGanttTab,
  windowStart,
  windowDays,
  rainfallData,
  droughtThresholdMm,
  targetRemnant,
  dailyAllocationKg,
  climateViewEnabled,
  paddockCAdj,
  paddockAAdj,
  ganttLayers,
  bioMilestones,
  paddockOrder,
  onBlockClick,
  onBlockMove,
  onRainfallChange,
  onDroughtThresholdChange,
  onDeleteEvent,
  onEditEvent,
  onHerdClick,
  onHerdUpdate,
  onPaddockClick,
  onPaddockToggle,
  onPaddockReorder,
  urgentPlans,
  onUrgentPlanClick,
}: GanttViewProps) {
  const activeSeasonPlan =
    seasonPlans.find((sp) => sp.id === activeSeasonPlanId) || null

  // Tabs Manual / Sugerido
  const tabOptions: { id: GanttTab; label: string }[] = [
    { id: 'manual', label: 'Manual' },
    { id: 'suggested', label: 'Sugerido IA' },
  ]

  return (
    <div className="space-y-3">
      {/* Header del Gantt: selector multi-plan + tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Multi-plan selector */}
        <PlanSelectorHeader
          seasonPlans={seasonPlans}
          selectedSeasonPlanIds={selectedSeasonPlanIds}
          activeSeasonPlanId={activeSeasonPlanId}
          seasonPlanColorMap={seasonPlanColorMap}
          onToggle={onToggleSeasonPlan}
          onSetActive={onSetActiveSeasonPlanId}
        />

        {/* Tab Manual / Sugerido */}
        <div
          className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 gap-0.5 shrink-0"
          role="tablist"
        >
          {tabOptions.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeGanttTab === id}
              onClick={() => onSetActiveGanttTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeGanttTab === id
                  ? 'bg-green-50 text-green-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas de movimiento inminente */}
      <UrgentAlerts
        plans={urgentPlans}
        paddocks={paddocks}
        onClick={onUrgentPlanClick}
      />

      {/* Gantt — ERROR 2 FIX: filtrado estricto antes de pasar props */}
      {(() => {
        // "Potrero o rodeo que no esté planificado, NO se muestra"
        const activePaddockIds = new Set(filteredPlans.map((p) => p.paddock_id))
        const activeHerdIds = new Set<string>(
          filteredPlans.flatMap((p) =>
            Array.isArray(p.herd_ids) && p.herd_ids.length > 0
              ? p.herd_ids
              : p.herd_id
              ? [p.herd_id]
              : []
          )
        )

        // Mantener todos cuando no hay planes (estado cargando / sin planes)
        const ganttPaddocks =
          activePaddockIds.size > 0
            ? paddocks.filter((p: any) => activePaddockIds.has(p.id))
            : paddocks
        const ganttHerds =
          activeHerdIds.size > 0
            ? herds.filter((h: any) => activeHerdIds.has(h.id))
            : herds

        return (
          <InteractiveGantt
            plans={filteredPlans}
            paddocks={ganttPaddocks}
            herds={ganttHerds}
            activeSeasonPlan={activeSeasonPlan}
            farmEvents={farmEvents}
            movements={movements}
            windowStart={windowStart}
            windowDays={windowDays}
            onDeleteEvent={onDeleteEvent}
            onBlockClick={(plan, evt) => {
              if (evt) {
                const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect()
                onBlockClick(plan, { ...evt, currentTarget: evt.currentTarget } as React.MouseEvent)
              } else {
                onBlockClick(plan)
              }
            }}
            onBlockMove={onBlockMove}
            rainfallData={rainfallData}
            onRainfallChange={onRainfallChange}
            weatherEvents={weatherEvents}
            onPaddockClick={onPaddockClick}
            droughtThresholdMm={droughtThresholdMm}
            onDroughtThresholdChange={onDroughtThresholdChange}
            targetRemnant={targetRemnant}
            dailyAllocationKg={dailyAllocationKg}
            climateViewEnabled={climateViewEnabled}
            paddockCAdj={paddockCAdj}
            paddockAAdj={paddockAAdj}
            onHerdUpdate={onHerdUpdate}
            onEditEvent={onEditEvent}
            onHerdClick={onHerdClick}
            paddockOrder={paddockOrder}
            onPaddockReorder={onPaddockReorder}
            seasonPlanColorMap={seasonPlanColorMap}
            seasonPlanNames={Object.fromEntries(seasonPlans.map((sp) => [sp.id, sp.name]))}
            ganttLayers={ganttLayers}
            onPaddockToggle={onPaddockToggle}
            bioMilestones={bioMilestones}
          />
        )
      })()}
    </div>
  )
}
