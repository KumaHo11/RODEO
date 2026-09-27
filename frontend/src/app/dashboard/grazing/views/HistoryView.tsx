'use client'

/**
 * HistoryView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista de Historial — Componente Presentacional Puro.
 *
 * RESPONSABILIDAD: Renderizar. Cero lógica de negocio.
 * Usa el mismo PlanAccordion que ListView (variant="history"),
 * agrega las acciones específicas del historial: ver en Gantt, exportar, eliminar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react'
import { PlanToolbar } from '../components/PlanToolbar'
import { PlanAccordion } from '../components/PlanAccordion'
import type { UsePlanViewFiltersReturn, HistoryTab } from '@/hooks/usePlanViewFilters'
import type { GrazingPlanRow, HerdRow, PaddockRow, SeasonPlanRow } from '@/lib/grazing/planFormatters'
import { buildPlanCsvRows, buildCsvString, downloadCsv } from '@/lib/grazing/planFormatters'

interface HistoryViewProps {
  // Datos
  filteredPlans: GrazingPlanRow[]
  accordionGroups: UsePlanViewFiltersReturn['accordionGroups']
  herds: HerdRow[]
  paddocks: PaddockRow[]
  seasonPlans: SeasonPlanRow[]

  // Filtros (desde el hook SSOT)
  search: UsePlanViewFiltersReturn['search']
  filterStatus: UsePlanViewFiltersReturn['filterStatus']
  dateFrom: UsePlanViewFiltersReturn['dateRangeFrom']
  dateTo: UsePlanViewFiltersReturn['dateRangeTo']
  hasActiveFilters: UsePlanViewFiltersReturn['hasActiveFilters']
  historyTab: HistoryTab
  seasonPlanColorMap: UsePlanViewFiltersReturn['seasonPlanColorMap']
  herdColorMap: UsePlanViewFiltersReturn['herdColorMap']

  // Acciones (desde el hook SSOT)
  onSearchChange: UsePlanViewFiltersReturn['setSearch']
  onFilterStatusChange: UsePlanViewFiltersReturn['setFilterStatus']
  onDateRangeChange: UsePlanViewFiltersReturn['setDateRange']
  onClearFilters: UsePlanViewFiltersReturn['clearFilters']
  onHistoryTabChange: UsePlanViewFiltersReturn['setHistoryTab']

  // Acciones de negocio (desde page.tsx)
  onPlanClick: (plan: GrazingPlanRow) => void
  onSeasonPlanViewInGantt: (sp: SeasonPlanRow) => void
  onSeasonPlanExport: (sp: SeasonPlanRow) => void
  onSeasonPlanDelete: (sp: SeasonPlanRow) => void
}

const HISTORY_TABS: { value: HistoryTab; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'manual', label: 'Manuales' },
  { value: 'suggested', label: 'Sugeridos IA' },
]

export function HistoryView({
  filteredPlans,
  accordionGroups,
  herds,
  paddocks,
  seasonPlans,
  search,
  filterStatus,
  dateFrom,
  dateTo,
  hasActiveFilters,
  historyTab,
  seasonPlanColorMap,
  herdColorMap,
  onSearchChange,
  onFilterStatusChange,
  onDateRangeChange,
  onClearFilters,
  onHistoryTabChange,
  onPlanClick,
  onSeasonPlanViewInGantt,
  onSeasonPlanExport,
  onSeasonPlanDelete,
}: HistoryViewProps) {

  const handleExport = () => {
    const rows = buildPlanCsvRows(filteredPlans, herds, paddocks)
    const csv = buildCsvString(rows)
    downloadCsv(csv, `historial-pastoreo-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // Slot de acciones extra para el toolbar: tabs manual/sugerido
  const historyTabsSlot = (
    <div
      className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5"
      role="tablist"
      aria-label="Filtrar por tipo de planificación"
    >
      {HISTORY_TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={historyTab === tab.value}
          onClick={() => onHistoryTabChange(tab.value)}
          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${
            historyTab === tab.value
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header informativo */}
        <div className="px-5 py-4 border-b border-gray-100 bg-amber-50/30 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-950">Historial de pastoreo</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Trazabilidad real vs. planificada ·{' '}
              {seasonPlans.length} temporada{seasonPlans.length !== 1 ? 's' : ''} registradas
            </p>
          </div>
          <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
            {filteredPlans.length} registros
          </span>
        </div>

        <PlanToolbar
          search={search}
          onSearchChange={onSearchChange}
          filterStatus={filterStatus}
          onFilterStatusChange={onFilterStatusChange}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={onDateRangeChange}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          totalCount={filteredPlans.length}
          onExport={handleExport}
          extraActions={historyTabsSlot}
        />

        <PlanAccordion
          groups={accordionGroups}
          herds={herds}
          paddocks={paddocks}
          variant="history"
          seasonPlanColorMap={seasonPlanColorMap}
          herdColorMap={herdColorMap}
          onPlanClick={onPlanClick}
          onSeasonPlanViewInGantt={onSeasonPlanViewInGantt}
          onSeasonPlanExport={onSeasonPlanExport}
          onSeasonPlanDelete={onSeasonPlanDelete}
        />
      </div>
    </div>
  )
}
