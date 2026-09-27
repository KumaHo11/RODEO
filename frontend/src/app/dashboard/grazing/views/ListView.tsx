'use client'

/**
 * ListView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista de Lista — Componente Presentacional Puro.
 *
 * RESPONSABILIDAD: Renderizar. Cero lógica de negocio.
 * Recibe datos ya filtrados y agrupados del hook usePlanViewFilters.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react'
import { PlanToolbar } from '../components/PlanToolbar'
import { PlanAccordion } from '../components/PlanAccordion'
import type { UsePlanViewFiltersReturn } from '@/hooks/usePlanViewFilters'
import type { GrazingPlanRow, HerdRow, PaddockRow, SeasonPlanRow } from '@/lib/grazing/planFormatters'
import { buildPlanCsvRows, buildCsvString, downloadCsv } from '@/lib/grazing/planFormatters'

interface ListViewProps {
  // Datos
  filteredPlans: GrazingPlanRow[]
  accordionGroups: ReturnType<UsePlanViewFiltersReturn['accordionGroups']['filter']> extends never
    ? never
    : UsePlanViewFiltersReturn['accordionGroups']
  herds: HerdRow[]
  paddocks: PaddockRow[]
  seasonPlans: SeasonPlanRow[]

  // Filtros (desde el hook SSOT)
  search: UsePlanViewFiltersReturn['search']
  filterStatus: UsePlanViewFiltersReturn['filterStatus']
  dateFrom: UsePlanViewFiltersReturn['dateRangeFrom']
  dateTo: UsePlanViewFiltersReturn['dateRangeTo']
  hasActiveFilters: UsePlanViewFiltersReturn['hasActiveFilters']
  seasonPlanColorMap: UsePlanViewFiltersReturn['seasonPlanColorMap']
  herdColorMap: UsePlanViewFiltersReturn['herdColorMap']

  // Acciones (desde el hook SSOT)
  onSearchChange: UsePlanViewFiltersReturn['setSearch']
  onFilterStatusChange: UsePlanViewFiltersReturn['setFilterStatus']
  onDateRangeChange: UsePlanViewFiltersReturn['setDateRange']
  onClearFilters: UsePlanViewFiltersReturn['clearFilters']

  // Acciones de negocio (desde page.tsx)
  onPlanClick: (plan: GrazingPlanRow) => void
  onSeasonPlanViewInGantt?: (sp: SeasonPlanRow) => void
}

export function ListView({
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
  seasonPlanColorMap,
  herdColorMap,
  onSearchChange,
  onFilterStatusChange,
  onDateRangeChange,
  onClearFilters,
  onPlanClick,
  onSeasonPlanViewInGantt,
}: ListViewProps) {

  const handleExport = () => {
    const rows = buildPlanCsvRows(filteredPlans, herds, paddocks)
    const csv = buildCsvString(rows)
    downloadCsv(csv, `lista-pastoreo-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
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
      />

      <PlanAccordion
        groups={accordionGroups}
        herds={herds}
        paddocks={paddocks}
        variant="list"
        seasonPlanColorMap={seasonPlanColorMap}
        herdColorMap={herdColorMap}
        onPlanClick={onPlanClick}
        onSeasonPlanViewInGantt={onSeasonPlanViewInGantt}
      />
    </div>
  )
}
