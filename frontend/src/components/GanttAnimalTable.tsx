'use client'

/**
 * GanttAnimalTable.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tabla inferior del Gantt — composición sintética de rodeos activos.
 *
 * Columnas visibles (reducidas de la versión legacy):
 *   Rodeo | Núm. Cabezas | Peso (kg) | ADG (g/día) | EV/Cab | EV Total
 *
 * Eliminados respecto al código anterior:
 *   – Columnas de topes, Mín/Máx días, coeficientes climáticos
 *   – Botones de "+ Rodeo" / "+ Temporario" (creación delegada a Mesa de Arena)
 *   – Modal de decisión permanente/temporal
 *
 * Dependencias: calcularEvParaMes, calcularPesoParaMes, calculateDynamicHeadcount
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react'
import { Eye, EyeOff, Users, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/apiFetch'
import { toast } from 'sonner'
import {
  calcularEvParaMes,
  calcularPesoParaMes,
  calculateDynamicHeadcount,
  EV_BASE,
} from '@/lib/grazing/evProjection'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface MonthColumn {
  key: string
  startDate: string
  endDate: string
  widthPct: number
  month: number
}

export interface GanttAnimalTableProps {
  /** Rodeos ya filtrados por los planes visibles en el Gantt */
  herds: any[]
  /** Planes activos filtrados (status !== 'DELETED') */
  plans: any[]
  /** Columnas de meses del Gantt (MONTHS_FOOTER) */
  months: MonthColumn[]
  /** Ancho del label sticky izquierdo (en px) */
  labelW: number
  /** Eventos unificados (farmEvents + movements) para headcount dinámico */
  unifiedEvents: any[]
  /** Días de la ventana actual — para minWidth del contenedor */
  windowDays: number
  /** Fecha de referencia para proyecciones (default: hoy) */
  referenceDate?: string
  /** Callback al hacer click en el nombre de un rodeo */
  onHerdClick?: (herd: any) => void
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function GanttAnimalTable({
  herds,
  plans,
  months,
  labelW,
  unifiedEvents,
  windowDays,
  referenceDate,
  onHerdClick,
}: GanttAnimalTableProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [hiddenHerdIds, setHiddenHerdIds] = useState<Set<string>>(new Set())
  const [showAnnualModal, setShowAnnualModal] = useState(false)

  const today = referenceDate ?? new Date().toISOString().split('T')[0]

  if (herds.length === 0) return null

  const toggleHerd = (id: string) => {
    setHiddenHerdIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const getDynamicHeadcount = (herdId: string, base: number, dateStr: string) =>
    calculateDynamicHeadcount(herdId, base, dateStr, unifiedEvents)

  // ─── Tabla sintética compartida (inline Gantt + modal ampliado) ─────────────

  function HerdRows({
    compact = true,
    onlyMonths = months,
  }: { compact?: boolean; onlyMonths?: MonthColumn[] }) {
    return (
      <>
        {herds.map((herd, hi) => {
          if (compact && hiddenHerdIds.has(herd.id)) return null

          const baseHc = Number(herd.head_count) || 0
          const herdEntry = herd.admission_date || '2000-01-01'
          const herdExit = herd.exit_date || '2100-01-01'
          const adgGDay = Math.round((Number(herd.daily_gain_kg) || 0) * 1000)

          return (
            <div
              key={herd.id}
              className={`flex border-t border-gray-200 ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              style={{ minHeight: 28 }}
            >
              {/* Nombre — sticky izquierdo */}
              <div
                style={{ width: labelW, minWidth: labelW }}
                className={`pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0 gap-1 justify-between sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.05)] ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    className="text-[8px] font-black text-gray-700 truncate hover:text-green-700 hover:underline transition-colors text-left"
                    onClick={() => onHerdClick?.(herd)}
                  >
                    {hi + 1}. {herd.name}
                  </button>
                  {herd.exit_date && (
                    <span className="text-[7px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded-md tracking-wider shrink-0">
                      TEMP
                    </span>
                  )}
                  {herd.category && !herd.exit_date && (
                    <span className="text-[7px] text-gray-400 font-medium shrink-0">({herd.category})</span>
                  )}
                </div>
                {compact && (
                  <button
                    onClick={() => toggleHerd(herd.id)}
                    className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
                    title="Ocultar fila"
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Columnas de meses */}
              <div className="flex flex-1">
                {onlyMonths.map(m => {
                  const active = herdEntry <= m.endDate && herdExit >= m.startDate
                  if (!active) {
                    return (
                      <div
                        key={m.key}
                        className="border-r border-gray-200 flex items-center justify-center shrink-0 text-[8px] text-gray-200"
                        style={{ width: `${m.widthPct}%`, minWidth: 72 }}
                      >
                        —
                      </div>
                    )
                  }

                  const headCount = getDynamicHeadcount(herd.id, baseHc, m.startDate)
                  const peso = headCount > 0
                    ? Math.round(calcularPesoParaMes(herd, m.startDate, today))
                    : 0
                  const ev = headCount > 0
                    ? calcularEvParaMes(herd, m.startDate, headCount, 'primavera', today)
                    : 0
                  const evPerHead = headCount > 0 && ev > 0
                    ? ev / headCount
                    : (EV_BASE[(herd.categoria ?? '').toUpperCase()] ?? 1.0)

                  const hasPlansThisMonth = plans.some(p =>
                    (p.herd_ids || []).includes(herd.id) &&
                    (p.exit_date || p.entry_date) >= m.startDate &&
                    p.entry_date <= m.endDate
                  )

                  return (
                    <div
                      key={m.key}
                      className={`border-r border-gray-200 flex items-center justify-around px-1 overflow-hidden shrink-0 ${hasPlansThisMonth ? 'bg-sky-50/40' : ''}`}
                      style={{ width: `${m.widthPct}%`, minWidth: 72 }}
                    >
                      {/* Núm. */}
                      <span className="text-[8px] font-black text-gray-700 flex-[2] text-left pl-1 truncate">
                        {headCount > 0 ? headCount : '—'}
                      </span>
                      {/* Peso */}
                      <span className="text-[8px] font-bold text-gray-500 flex-1 text-left truncate">
                        {peso > 0 ? peso : '—'}
                      </span>
                      {/* ADG g/día */}
                      <span className="text-[8px] font-bold text-gray-400 flex-1 text-left truncate">
                        {adgGDay > 0 ? `${adgGDay}g` : '—'}
                      </span>
                      {/* EV/cab */}
                      <span className="text-[8px] font-bold text-gray-500 flex-1 text-left truncate">
                        {ev > 0 && headCount > 0 ? evPerHead.toFixed(2) : '—'}
                      </span>
                      {/* EV Total */}
                      <span className="text-[8px] font-black text-green-700 flex-1 text-left truncate">
                        {ev > 0 ? ev.toFixed(0) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  // ─── Fila de totales ─────────────────────────────────────────────────────────

  function TotalRow({ onlyMonths = months }: { onlyMonths?: MonthColumn[] }) {
    return (
      <div className="flex border-t border-gray-300 bg-gray-100" style={{ minHeight: 24 }}>
        <div
          style={{ width: labelW, minWidth: labelW }}
          className="px-2.5 flex items-center border-r border-gray-300 shrink-0 sticky left-0 z-20 bg-gray-100"
        >
          <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Total</span>
        </div>
        <div className="flex flex-1">
          {onlyMonths.map(m => {
            let totalHc = 0
            let totalEv = 0
            herds.forEach(h => {
              const entry = h.admission_date || '2000-01-01'
              const exit = h.exit_date || '2100-01-01'
              if (entry <= m.endDate && exit >= m.startDate) {
                const hc = getDynamicHeadcount(h.id, Number(h.head_count) || 0, m.startDate)
                const ev = hc > 0
                  ? calcularEvParaMes(h, m.startDate, hc, 'primavera', today)
                  : 0
                totalHc += hc
                totalEv += ev
              }
            })
            return (
              <div
                key={m.key}
                className="border-r border-gray-300 flex items-center justify-around px-0.5 overflow-hidden shrink-0"
                style={{ width: `${m.widthPct}%`, minWidth: 72 }}
              >
                {totalHc > 0 ? (
                  <>
                    <span className="text-[8px] font-black text-gray-800 flex-[2] text-left pl-1 truncate">{totalHc}</span>
                    <span className="text-[8px] text-gray-300 flex-1 text-left truncate">—</span>
                    <span className="text-[8px] text-gray-300 flex-1 text-left truncate">—</span>
                    <span className="text-[8px] text-gray-300 flex-1 text-left truncate">—</span>
                    <span className="text-[8px] font-black text-green-700 flex-1 text-left truncate">{totalEv.toFixed(0)}</span>
                  </>
                ) : (
                  <span className="text-[8px] text-gray-200 w-full text-center">—</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Header de columna de mes ─────────────────────────────────────────────────

  function MonthHeaders({ onlyMonths = months }: { onlyMonths?: MonthColumn[] }) {
    return (
      <div className="flex flex-1">
        {onlyMonths.map(m => (
          <div
            key={m.key}
            className="border-r border-gray-300 flex flex-col items-start justify-center px-1 shrink-0"
            style={{ width: `${m.widthPct}%`, minWidth: 72 }}
          >
            <div className="flex w-full">
              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-[2] text-left pl-1">Núm.</span>
              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left">kg</span>
              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left">ADG</span>
              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left">EV/c</span>
              <span className="text-[7px] font-black text-gray-500 uppercase tracking-tight flex-1 text-left">EV</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── Chips de rodeos ocultos ─────────────────────────────────────────────────

  const hiddenChips = hiddenHerdIds.size > 0 && (
    <div className="flex items-center px-4 py-1 bg-amber-50 border-t border-amber-100 gap-2">
      <span className="text-[8px] font-bold text-amber-700 uppercase">Ocultos:</span>
      <div className="flex flex-wrap gap-1">
        {Array.from(hiddenHerdIds).map(id => {
          const h = herds.find(x => x.id === id)
          return h && (
            <button
              key={id}
              onClick={() => toggleHerd(id)}
              className="text-[8px] px-1.5 py-0.5 bg-white border border-amber-200 rounded text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {h.name} ×
            </button>
          )
        })}
      </div>
    </div>
  )

  // ─── Modal ampliado ──────────────────────────────────────────────────────────

  const annualModal = showAnnualModal && typeof document !== 'undefined' && createPortal(
    <>
      <div className="fixed inset-0 z-[9999] bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowAnnualModal(false)} />
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-2xl max-w-[95vw] w-full max-h-[90vh] flex flex-col pointer-events-auto">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Detalle de carga animal</h2>
              <p className="text-xs text-gray-500 font-medium mt-1">Composición mensual — Rodeos activos en el Gantt</p>
            </div>
            <button onClick={() => setShowAnnualModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto p-0 m-6 rounded-2xl border border-gray-200">
            <table className="w-full text-left border-collapse" style={{ minWidth: months.length * 80 + 200 }}>
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
                <tr>
                  <th className="py-3 px-4 text-[10px] font-black tracking-widest text-gray-500 uppercase border-r border-gray-200 bg-white sticky left-0 z-30 shadow-[1px_0_0_0_#e5e7eb]">
                    Rodeo
                  </th>
                  {months.map(m => {
                    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                    const label = `${monthNames[m.month]} ${m.key.split('-')[0]}`
                    return (
                      <th
                        key={m.key}
                        colSpan={5}
                        className="py-2 px-2 text-[10px] font-black tracking-widest text-gray-600 uppercase text-center border-r border-gray-200 bg-gray-50"
                      >
                        {label}
                      </th>
                    )
                  })}
                </tr>
                <tr>
                  {months.map(m => (
                    <React.Fragment key={m.key}>
                      <th className="py-2 px-1 text-[9px] font-bold text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">Núm</th>
                      <th className="py-2 px-1 text-[9px] font-bold text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">kg</th>
                      <th className="py-2 px-1 text-[9px] font-bold text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">ADG</th>
                      <th className="py-2 px-1 text-[9px] font-bold text-gray-500 uppercase text-left bg-gray-50 border-t border-gray-200">EV/c</th>
                      <th className="py-2 px-1 text-[9px] font-bold text-green-700 uppercase text-left border-r border-gray-200 bg-gray-50 border-t border-gray-200">EV</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {herds.map((herd, i) => {
                  const herdEntry = herd.admission_date || '2000-01-01'
                  const herdExit = herd.exit_date || '2100-01-01'
                  const baseHc = Number(herd.head_count) || 0
                  const adgGDay = Math.round((Number(herd.daily_gain_kg) || 0) * 1000)
                  return (
                    <tr
                      key={herd.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="py-3 px-4 text-xs font-black text-gray-800 border-r border-gray-200 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb] whitespace-nowrap cursor-pointer hover:text-green-700 transition-colors">
                        {i + 1}. {herd.name}
                        {herd.is_temporary && <span className="ml-1 text-[8px] text-sky-600 font-black">TMP</span>}
                      </td>
                      {months.map(m => {
                        const active = herdEntry <= m.endDate && herdExit >= m.startDate
                        if (!active) {
                          return (
                            <td key={m.key} colSpan={5} className="py-3 px-1 text-xs text-gray-200 text-center border-r border-gray-200">—</td>
                          )
                        }
                        const hc = getDynamicHeadcount(herd.id, baseHc, m.startDate)
                        const peso = hc > 0 ? Math.round(calcularPesoParaMes(herd, m.startDate, today)) : 0
                        const ev = hc > 0 ? calcularEvParaMes(herd, m.startDate, hc, 'primavera', today) : 0
                        const evPerHead = hc > 0 && ev > 0 ? ev / hc : (EV_BASE[(herd.categoria ?? '').toUpperCase()] ?? 1.0)
                        return (
                          <React.Fragment key={m.key}>
                            <td className="py-1 px-1 text-left">
                              <span className="text-[11px] font-black text-gray-800">{hc || '—'}</span>
                            </td>
                            <td className="py-3 px-1 text-xs text-gray-500 font-bold text-left">{peso > 0 ? peso : '—'}</td>
                            <td className="py-3 px-1 text-xs text-gray-400 font-bold text-left">{adgGDay > 0 ? `${adgGDay}g` : '—'}</td>
                            <td className="py-3 px-1 text-xs text-gray-500 font-bold text-left">{ev > 0 && hc > 0 ? evPerHead.toFixed(2) : '—'}</td>
                            <td className="py-3 px-1 text-xs font-black text-green-700 text-left border-r border-gray-200">{ev > 0 ? ev.toFixed(0) : '—'}</td>
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-100">
                  <td className="py-2.5 px-4 text-[10px] font-black text-gray-700 uppercase tracking-widest border-r border-gray-200 sticky left-0 z-10 bg-gray-100">Total</td>
                  {months.map(m => {
                    let totalCab = 0, totalEv = 0
                    herds.forEach(h => {
                      const entry = h.admission_date || '2000-01-01'
                      const exit = h.exit_date || '2100-01-01'
                      if (entry <= m.endDate && exit >= m.startDate) {
                        const hc = getDynamicHeadcount(h.id, Number(h.head_count) || 0, m.startDate)
                        const ev = hc > 0 ? calcularEvParaMes(h, m.startDate, hc, 'primavera', today) : 0
                        totalCab += hc
                        totalEv += ev
                      }
                    })
                    return (
                      <React.Fragment key={m.key}>
                        <td className="py-2.5 px-1 text-xs font-black text-gray-800 text-left bg-gray-100">{totalCab || '—'}</td>
                        <td className="py-2.5 px-1 text-left bg-gray-100 text-gray-300 text-xs">—</td>
                        <td className="py-2.5 px-1 text-left bg-gray-100 text-gray-300 text-xs">—</td>
                        <td className="py-2.5 px-1 text-left bg-gray-100 text-gray-300 text-xs">—</td>
                        <td className="py-2.5 px-1 text-xs font-black text-green-700 text-left border-r border-gray-200 bg-gray-100">{totalEv > 0 ? totalEv.toFixed(0) : '—'}</td>
                      </React.Fragment>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-3xl shrink-0">
            <button
              onClick={() => setShowAnnualModal(false)}
              className="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )

  // ─── Render principal ────────────────────────────────────────────────────────

  return (
    <div className="sticky bottom-0 z-30 bg-white border-t-2 border-gray-300 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div style={{ minWidth: Math.max(1000, windowDays * 6 + labelW) }}>

        {/* Cabecera de sección */}
        <div className="flex bg-gray-100" style={{ minHeight: 26 }}>
          <div
            style={{ width: labelW, minWidth: labelW }}
            className="pl-4 pr-2.5 flex items-center justify-between border-r border-gray-300 shrink-0 sticky left-0 z-20 bg-gray-100 shadow-[4px_0_12px_rgba(0,0,0,0.05)]"
          >
            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Tipo de Animal</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed(s => !s)}
                title={collapsed ? 'Mostrar animales' : 'Ocultar animales'}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                {collapsed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={() => setShowAnnualModal(true)}
                className="flex items-center gap-1 text-[8px] font-bold text-gray-400 hover:text-green-600 transition-colors bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200"
                title="Ver detalle ampliado"
              >
                <Users className="w-3 h-3" /> Ampliar
              </button>
            </div>
          </div>
          <MonthHeaders />
        </div>

        {/* Chips de rodeos ocultos */}
        {hiddenChips}

        {/* Filas de rodeos */}
        {!collapsed && <HerdRows />}

        {/* Fila de totales */}
        {!collapsed && <TotalRow />}

      </div>

      {annualModal}
    </div>
  )
}

export default GanttAnimalTable
