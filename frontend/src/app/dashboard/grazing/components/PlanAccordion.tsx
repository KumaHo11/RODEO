'use client'

/**
 * PlanAccordion.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Acordeón reutilizable para las vistas de Lista e Historial.
 *
 * PRINCIPIO: UN SOLO componente, DOS contextos de uso (variant="list" | "history").
 * La única diferencia es el conjunto de columnas visibles y algunas acciones
 * en el header del acordeón.
 *
 * DISEÑO UX:
 *  - Cada ítem del acordeón representa una Temporada (SeasonPlan)
 *  - Al desplegar: tabla limpia, enfocada en el usuario
 *  - Columnas reducidas — SIN coeficientes, máximos ni mínimos
 *  - El grupo "Sin temporada" se muestra al final con estilo diferenciado
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, Calendar, Download, BarChart3,
  Trash2, ExternalLink, Leaf
} from 'lucide-react'
import {
  fmtDate,
  daysBetween,
  getPlanHerdIds,
  getPlanDays,
  getActualDays,
  UNASSIGNED_SEASON_ID,
  type GrazingPlanRow,
  type HerdRow,
  type PaddockRow,
  type SeasonPlanRow,
  type AccordionGroup,
} from '@/lib/grazing/planFormatters'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AccordionVariant = 'list' | 'history'

export interface PlanAccordionProps {
  groups: AccordionGroup[]
  herds: HerdRow[]
  paddocks: PaddockRow[]
  variant: AccordionVariant
  seasonPlanColorMap: Record<string, string>
  herdColorMap: Record<string, string>
  onPlanClick: (plan: GrazingPlanRow) => void
  onSeasonPlanViewInGantt?: (sp: SeasonPlanRow) => void
  onSeasonPlanExport?: (sp: SeasonPlanRow) => void
  onSeasonPlanDelete?: (sp: SeasonPlanRow) => void
}

// ─── Configuración de columnas por variante ───────────────────────────────────

interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

const LIST_COLUMNS: Column[] = [
  { key: 'paddock', label: 'Potrero' },
  { key: 'herds', label: 'Rodeo(s)' },
  { key: 'area', label: 'Ha', align: 'right' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'entry', label: 'Entrada', align: 'center' },
  { key: 'exit', label: 'Salida', align: 'center' },
  { key: 'days', label: 'Días plan', align: 'right' },
]

const HISTORY_COLUMNS: Column[] = [
  { key: 'paddock', label: 'Potrero' },
  { key: 'herds', label: 'Rodeo(s)' },
  { key: 'area', label: 'Ha', align: 'right' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'entry', label: 'Entrada', align: 'center' },
  { key: 'exit', label: 'Salida', align: 'center' },
  { key: 'days', label: 'Días plan', align: 'right' },
  { key: 'actual_days', label: 'Días reales', align: 'right' },
  { key: 'deviation', label: 'Desvío', align: 'center' },
  { key: 'remnant', label: 'Remanente', align: 'right' },
]

const STATUS_STYLE: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Pastando', dot: 'bg-green-500', bg: 'bg-green-100', text: 'text-green-700' },
  PLANNED: { label: 'Planificado', dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  COMPLETED: { label: 'Completado', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' },
}

// ─── Sub-componente: Header del acordeón ──────────────────────────────────────

interface AccordionHeaderProps {
  group: AccordionGroup
  color: string
  isOpen: boolean
  onToggle: () => void
  variant: AccordionVariant
  onViewInGantt?: (sp: SeasonPlanRow) => void
  onExport?: (sp: SeasonPlanRow) => void
  onDelete?: (sp: SeasonPlanRow) => void
}

function AccordionHeader({
  group,
  color,
  isOpen,
  onToggle,
  variant,
  onViewInGantt,
  onExport,
  onDelete,
}: AccordionHeaderProps) {
  const { seasonPlan, plans } = group
  const isUnassigned = group.seasonPlanId === UNASSIGNED_SEASON_ID

  const totalHa = plans.reduce((sum, p) => {
    return sum + (Number((p as any).paddocks?.area_ha) || 0)
  }, 0)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Space') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors group
        ${isUnassigned
          ? 'bg-gray-50/80 hover:bg-gray-100/60'
          : 'bg-white hover:bg-gray-50/80'
        }
        ${isOpen ? 'border-b border-gray-100' : ''}
      `}
      aria-expanded={isOpen}
    >
      {/* Color indicator */}
      <span
        className="w-1 h-8 rounded-full shrink-0 transition-all"
        style={{ backgroundColor: isUnassigned ? '#d1d5db' : color }}
        aria-hidden
      />

      {/* Chevron */}
      <span className="text-gray-400 shrink-0 transition-transform duration-200">
        {isOpen
          ? <ChevronDown className="w-4 h-4" />
          : <ChevronRight className="w-4 h-4" />
        }
      </span>

      {/* Título */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-black truncate ${isUnassigned ? 'text-gray-500 italic' : 'text-gray-950'}`}>
            {isUnassigned
              ? 'Sin temporada asignada'
              : (seasonPlan?.name ?? 'Temporada')
            }
          </span>
          {!isUnassigned && seasonPlan?.season_type && (
            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${
              seasonPlan.season_type === 'cerrado'
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {seasonPlan.season_type === 'cerrado' ? 'Cerrada' : 'Abierta'}
            </span>
          )}

        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-medium">
          <span>{plans.length} bloque{plans.length !== 1 ? 's' : ''}</span>
          {totalHa > 0 && (
            <>
              <span>·</span>
              <span>{totalHa.toFixed(0)} ha totales</span>
            </>
          )}
          {!isUnassigned && seasonPlan?.start_date && (
            <>
              <span>·</span>
              <span>{fmtDate(seasonPlan.start_date)} → {fmtDate(seasonPlan.end_date)}</span>
            </>
          )}
        </div>
      </div>

      {/* Acciones (solo en historial y solo para planes con seasonPlan) */}
      {variant === 'history' && !isUnassigned && seasonPlan && (
        <div
          className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {onViewInGantt && seasonPlan.start_date && (
            <button
              onClick={() => onViewInGantt(seasonPlan)}
              className="px-2.5 py-1.5 text-[10px] font-bold text-gray-600 hover:text-green-700
                         bg-white border border-gray-200 hover:border-green-300 rounded-lg transition-all"
              title="Ver en Gantt"
            >
              <ExternalLink className="w-3 h-3 inline-block mr-1" />
              Gantt
            </button>
          )}
          {onExport && (
            <button
              onClick={() => onExport(seasonPlan)}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50
                         rounded-lg border border-transparent hover:border-green-200 transition-all"
              title="Exportar CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(seasonPlan)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50
                         rounded-lg border border-transparent hover:border-red-200 transition-all"
              title="Eliminar temporada"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-componente: Fila de plan ─────────────────────────────────────────────

interface PlanRowProps {
  plan: GrazingPlanRow
  herds: HerdRow[]
  paddocks: PaddockRow[]
  herdColorMap: Record<string, string>
  variant: AccordionVariant
  onClick: (plan: GrazingPlanRow) => void
}

function PlanRow({ plan, herds, paddocks, herdColorMap, variant, onClick }: PlanRowProps) {
  const herdIds = getPlanHerdIds(plan)
  const planHerds = herds.filter((h) => herdIds.includes(h.id))
  const herdNames = planHerds.map((h) => h.name).join(', ') || '—'
  const paddock = paddocks.find((p) => p.id === plan.paddock_id)
  const areaHa = Number(paddock?.area_ha ?? (plan.paddocks as any)?.area_ha ?? 0)
  const st = STATUS_STYLE[plan.status] || STATUS_STYLE.PLANNED
  const primaryColor = herdColorMap[herdIds[0]] || '#9ca3af'

  const plannedDays = getPlanDays(plan)
  const actualDays = getActualDays(plan)
  const deviation = actualDays !== null && plannedDays !== null && plannedDays > 0
    ? actualDays - plannedDays
    : null

  const todayStr = new Date().toISOString().split('T')[0]
  const isRowActive = plan.status === 'ACTIVE' || (plan.entry_date <= todayStr && plan.status !== 'COMPLETED')

  return (
    <tr
      onClick={() => onClick(plan)}
      className="cursor-pointer hover:bg-green-50/40 transition-colors group"
      style={isRowActive ? { borderLeft: '3px solid #10b981' } : { borderLeft: '3px solid transparent' }}
    >
      {/* Potrero */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: primaryColor }}
            aria-hidden
          />
          <span className="text-sm font-bold text-gray-900">
            {paddock?.name ?? (plan.paddocks as any)?.name ?? '—'}
          </span>
        </div>
      </td>

      {/* Rodeo(s) */}
      <td className="px-5 py-3">
        <span className="text-xs text-gray-500 font-medium truncate max-w-[140px] block" title={herdNames}>
          {herdNames}
        </span>
      </td>

      {/* Hectáreas */}
      <td className="px-5 py-3 text-right">
        {areaHa > 0 ? (
          <span className="text-xs font-bold text-gray-700 tabular-nums">
            {areaHa.toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">ha</span>
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Estado */}
      <td className="px-5 py-3 text-center">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} aria-hidden />
          {st.label}
        </span>
      </td>

      {/* Fecha entrada */}
      <td className="px-5 py-3 text-center text-xs font-medium text-gray-700 tabular-nums">
        {fmtDate(plan.entry_date)}
      </td>

      {/* Fecha salida */}
      <td className="px-5 py-3 text-center text-xs font-medium text-gray-700 tabular-nums">
        {plan.exit_date ? fmtDate(plan.exit_date) : <span className="text-gray-300">—</span>}
      </td>

      {/* Días planificados */}
      <td className="px-5 py-3 text-right tabular-nums">
        {plannedDays !== null ? (
          <span className="text-sm font-black text-gray-900">
            {plannedDays}<span className="text-[10px] font-normal text-gray-400 ml-0.5">d</span>
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Columnas solo para 'history' */}
      {variant === 'history' && (
        <>
          {/* Días reales */}
          <td className="px-5 py-3 text-right tabular-nums">
            {actualDays !== null ? (
              <span className="text-sm font-black text-gray-900">
                {actualDays}<span className="text-[10px] font-normal text-gray-400 ml-0.5">d</span>
              </span>
            ) : (
              <span className="text-gray-300 text-[10px]">No reg.</span>
            )}
          </td>

          {/* Desvío */}
          <td className="px-5 py-3 text-center tabular-nums">
            {deviation !== null ? (
              deviation === 0 ? (
                <span className="text-xs font-bold text-green-600">= plan</span>
              ) : (
                <span className={`text-xs font-bold ${deviation > 2 ? 'text-amber-700' : deviation < -1 ? 'text-green-700' : 'text-gray-600'}`}>
                  {deviation > 0 ? '+' : ''}{deviation}d
                </span>
              )
            ) : (
              <span className="text-gray-300 text-xs">—</span>
            )}
          </td>

          {/* Remanente */}
          <td className="px-5 py-3 text-right">
            {plan.exit_dry_matter_kg_ha != null ? (
              <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                {plan.exit_dry_matter_kg_ha}
                <span className="text-[9px] text-green-600 font-medium ml-0.5">kg/ha</span>
              </span>
            ) : (
              <span className="text-gray-300 text-[10px]">—</span>
            )}
          </td>
        </>
      )}
    </tr>
  )
}

// ─── Sub-componente: Ítem de acordeón completo ────────────────────────────────

interface AccordionItemProps {
  group: AccordionGroup
  herds: HerdRow[]
  paddocks: PaddockRow[]
  variant: AccordionVariant
  color: string
  herdColorMap: Record<string, string>
  onPlanClick: (plan: GrazingPlanRow) => void
  onViewInGantt?: (sp: SeasonPlanRow) => void
  onExport?: (sp: SeasonPlanRow) => void
  onDelete?: (sp: SeasonPlanRow) => void
  defaultOpen?: boolean
}

function AccordionItem({
  group,
  herds,
  paddocks,
  variant,
  color,
  herdColorMap,
  onPlanClick,
  onViewInGantt,
  onExport,
  onDelete,
  defaultOpen = false,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  const columns = variant === 'list' ? LIST_COLUMNS : HISTORY_COLUMNS

  // Ordenar planes dentro del grupo por fecha de entrada
  const sortedPlans = [...group.plans].sort((a, b) =>
    (a.entry_date ?? '').localeCompare(b.entry_date ?? '')
  )

  return (
    <div className={`border border-gray-100 rounded-2xl overflow-hidden transition-shadow ${isOpen ? 'shadow-sm' : ''}`}>
      <AccordionHeader
        group={group}
        color={color}
        isOpen={isOpen}
        onToggle={toggle}
        variant={variant}
        onViewInGantt={onViewInGantt}
        onExport={onExport}
        onDelete={onDelete}
      />

      {/* Panel expandible */}
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-2.5 text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' :
                      col.align === 'center' ? 'text-center' :
                      'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedPlans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  herds={herds}
                  paddocks={paddocks}
                  herdColorMap={herdColorMap}
                  variant={variant}
                  onClick={onPlanClick}
                />
              ))}
              {sortedPlans.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-6 text-center text-xs text-gray-400 font-medium"
                  >
                    Sin planificaciones en este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function PlanAccordion({
  groups,
  herds,
  paddocks,
  variant,
  seasonPlanColorMap,
  herdColorMap,
  onPlanClick,
  onSeasonPlanViewInGantt,
  onSeasonPlanExport,
  onSeasonPlanDelete,
}: PlanAccordionProps) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Leaf className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-bold text-gray-400">Sin planificaciones que mostrar</p>
        <p className="text-xs text-gray-400">Ajustá los filtros o creá una nueva planificación.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5 p-4">
      {groups.map((group, index) => {
        const color = seasonPlanColorMap[group.seasonPlanId] || '#9ca3af'
        // Abrir automáticamente el primer grupo (más reciente)
        const defaultOpen = index === 0

        return (
          <AccordionItem
            key={group.seasonPlanId}
            group={group}
            herds={herds}
            paddocks={paddocks}
            variant={variant}
            color={color}
            herdColorMap={herdColorMap}
            onPlanClick={onPlanClick}
            onViewInGantt={onSeasonPlanViewInGantt}
            onExport={onSeasonPlanExport}
            onDelete={onSeasonPlanDelete}
            defaultOpen={defaultOpen}
          />
        )
      })}
    </div>
  )
}
