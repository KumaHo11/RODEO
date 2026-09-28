'use client'

/**
 * PlanToolbar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barra de herramientas compartida para las vistas de Lista e Historial.
 * Componente 100% presentacional — recibe handlers desde el hook SSOT.
 *
 * Incluye:
 *  - Buscador por texto (paddock o rodeo)
 *  - Filtro por rango de fechas (entrada)
 *  - Filtro por estado (Todos / Activo / Planificado / Completado)
 *  - Botón de exportar CSV
 *  - Slot para acciones extra (ej. import, filtros de tab)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useId } from 'react'
import { Search, X, Download, CalendarRange, Filter } from 'lucide-react'
import type { FilterStatus } from '@/hooks/usePlanViewFilters'

export interface PlanToolbarProps {
  // Búsqueda y filtros
  search: string
  onSearchChange: (v: string) => void
  filterStatus: FilterStatus
  onFilterStatusChange: (v: FilterStatus) => void
  dateFrom: string | null
  dateTo: string | null
  onDateRangeChange: (from: string | null, to: string | null) => void
  hasActiveFilters: boolean
  onClearFilters: () => void

  // Metadata
  totalCount: number

  // Acciones
  onExport: () => void

  // Slot opcional para acciones adicionales (ej. botón importar, tabs manual/sugerido)
  extraActions?: React.ReactNode
}

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: 'Pastando' },
  { value: 'PLANNED', label: 'Planificado' },
  { value: 'COMPLETED', label: 'Completado' },
]

export function PlanToolbar({
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  hasActiveFilters,
  onClearFilters,
  totalCount,
  onExport,
  extraActions,
}: PlanToolbarProps) {
  const searchId = useId()
  const dateFromId = useId()
  const dateToId = useId()

  return (
    <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-col gap-3">
      {/* Fila superior: búsqueda + estado + export */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            aria-hidden
          />
          <input
            id={searchId}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar potrero o rodeo…"
            className="w-full pl-8 pr-8 py-2 text-xs font-medium border border-gray-200 rounded-xl bg-white
                       placeholder-gray-400 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500/30
                       focus:border-green-400 transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtro de estado */}
        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 gap-0.5" role="group" aria-label="Filtrar por estado">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterStatusChange(opt.value)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                filterStatus === opt.value
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Slot para acciones extra */}
        {extraActions && (
          <div className="flex items-center gap-2">{extraActions}</div>
        )}

        {/* Limpiar filtros */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-gray-500
                       hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 hover:border-red-200
                       transition-all"
            title="Limpiar filtros"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}

        {/* Export CSV */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl
                     text-[10px] font-bold text-gray-600 hover:border-green-300 hover:text-green-700
                     transition-all shadow-sm"
        >
          <Download className="w-3 h-3" />
          Exportar CSV
        </button>
      </div>

      {/* Fila inferior: rango de fechas + contador */}
      {/* Spec 3.1: flex-col en mobile, flex-row en sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden />
          <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">Período:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date From */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={dateFromId} className="text-[10px] font-bold text-gray-500 sr-only">
              Desde
            </label>
            <input
              id={dateFromId}
              type="date"
              value={dateFrom ?? ''}
              onChange={(e) => onDateRangeChange(e.target.value || null, dateTo)}
              className="px-2.5 py-1.5 text-[10px] font-medium border border-gray-200 rounded-lg bg-white
                         text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400
                         transition-all"
              aria-label="Desde"
            />
          </div>

          <span className="text-gray-300 text-xs font-bold">→</span>

          {/* Date To */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={dateToId} className="text-[10px] font-bold text-gray-500 sr-only">
              Hasta
            </label>
            <input
              id={dateToId}
              type="date"
              value={dateTo ?? ''}
              min={dateFrom ?? undefined}
              onChange={(e) => onDateRangeChange(dateFrom, e.target.value || null)}
              className="px-2.5 py-1.5 text-[10px] font-medium border border-gray-200 rounded-lg bg-white
                         text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400
                         transition-all"
              aria-label="Hasta"
            />
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="sm:ml-auto flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-gray-400" aria-hidden />
          <span className="text-[10px] font-bold text-gray-500">
            {totalCount} {totalCount === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
      </div>
    </div>
  )
}
