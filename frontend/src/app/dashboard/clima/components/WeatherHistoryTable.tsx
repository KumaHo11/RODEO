'use client'

import { useState, useMemo } from 'react'
import {
  CloudRain, Snowflake, Droplets, Download, Trash2, Leaf,
  BarChart3, Info, ChevronDown, ChevronUp, Zap
} from 'lucide-react'
import type { WeatherEvent } from '@/lib/types/weather'
import { useClimateAnalytics } from '@/lib/context/ClimateAnalyticsContext'
import clsx from 'clsx'

function formatDate(isoDate: string) {
  return new Date(isoDate + (isoDate.includes('T') ? '' : 'T00:00:00'))
    .toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MANUAL_TYPE_CONFIG = {
  RAIN:  { Icon: CloudRain, label: 'Lluvia',  badge: 'bg-blue-50 text-blue-700 border-blue-100',  iconCls: 'text-blue-500'  },
  FROST: { Icon: Snowflake, label: 'Helada',  badge: 'bg-sky-50 text-sky-700 border-sky-100',     iconCls: 'text-sky-400'   },
}

function exportToCSV(events: WeatherEvent[], snapshots: any[]) {
  const header = ['Fecha', 'Tipo', 'Fuente', 'Valor', 'Crecimiento (kg/ha/d)', 'NDVI', 'Lluvia 7d (mm)', 'Potreros']
  const manualRows = events.map(ev => [
    formatDate(ev.date),
    ev.type === 'RAIN' ? 'Lluvia' : 'Helada',
    'MANUAL',
    `${Number(ev.value).toFixed(1)} ${ev.type === 'RAIN' ? 'mm' : '°C'}`,
    '', '', '',
    ev.paddocks.map(ep => ep.paddock?.name ?? '').filter(Boolean).join(', '),
  ])
  const snapRows = snapshots.map(s => [
    formatDate(s.calculated_at),
    'Ajuste climático',
    'AUTO',
    `x${Number(s.climate_multiplier).toFixed(2)}`,
    Number(s.grass_growth_rate).toFixed(1),
    Number(s.ndvi).toFixed(3),
    Number(s.rainfall_7d_mm).toFixed(0),
    s.paddock_name,
  ])
  const csv = [header, ...manualRows, ...snapRows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `historial-clima-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Row types ─────────────────────────────────────────────────────────────────

type RowType = 'manual' | 'snapshot'

interface ManualRow { kind: 'manual'; date: string; ev: WeatherEvent }
interface SnapshotRow { kind: 'snapshot'; date: string; snap: any; paddockName: string }
type TableRow = ManualRow | SnapshotRow

interface WeatherHistoryTableProps {
  events: WeatherEvent[]
  isLoading: boolean
  onDelete?: (id: string) => Promise<boolean>
}

export function WeatherHistoryTable({ events, isLoading, onDelete }: WeatherHistoryTableProps) {
  const { snapshots } = useClimateAnalytics()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'manual' | 'auto'>('all')
  const [expandedSnap, setExpandedSnap] = useState<string | null>(null)

  // Take one latest snapshot per paddock per day
  const latestSnaps = useMemo(() => {
    const byKey = new Map<string, any>()
    for (const s of snapshots) {
      const day = s.calculated_at.slice(0, 10)
      const key = `${s.paddock_id}__${day}`
      const existing = byKey.get(key)
      if (!existing || s.calculated_at > existing.calculated_at) byKey.set(key, s)
    }
    return Array.from(byKey.values())
  }, [snapshots])

  // Build combined timeline
  const rows = useMemo<TableRow[]>(() => {
    const manualRows: ManualRow[] = events.map(ev => ({
      kind: 'manual',
      date: ev.date,
      ev,
    }))
    const snapRows: SnapshotRow[] = latestSnaps.map(s => ({
      kind: 'snapshot',
      date: s.calculated_at.slice(0, 10),
      snap: s,
      paddockName: s.paddock_name,
    }))
    const all = [...manualRows, ...snapRows].sort((a, b) => b.date.localeCompare(a.date))
    if (filter === 'manual') return all.filter(r => r.kind === 'manual')
    if (filter === 'auto')   return all.filter(r => r.kind === 'snapshot')
    return all
  }, [events, latestSnaps, filter])

  const handleDelete = async (id: string) => {
    if (!onDelete) return
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-4">Historial climático</p>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-black text-gray-900">Historial climático</h2>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
            Registros manuales (lluvia, helada) y análisis automáticos por potrero
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([
              { id: 'all',    label: 'Todo' },
              { id: 'manual', label: 'Manual' },
              { id: 'auto',   label: 'Auto'   },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all ${
                  filter === f.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {rows.length} registros
          </span>
          <button
            onClick={() => exportToCSV(events, latestSnaps)}
            disabled={rows.length === 0}
            title="Exportar a CSV"
            className={clsx(
              'flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition-all',
              rows.length > 0
                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-100'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-gray-400 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-black border border-amber-100">MANUAL</span>
          Ingresado por el usuario · editable
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-black border border-emerald-100">AUTO</span>
          Calculado por el sistema
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10">
          <Droplets className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-400">Sin registros aún</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Registrá lluvias o heladas, o calculá el ajuste climático por potrero
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[100px_80px_120px_1fr_100px] gap-3 px-3 mb-1">
            {['Fecha', 'Fuente', 'Tipo / Potrero', 'Datos', 'Acciones'].map(h => (
              <p key={h} className="text-[9px] font-black tracking-widest text-gray-400 uppercase">{h}</p>
            ))}
          </div>

          {rows.map((row, idx) => {
            if (row.kind === 'manual') {
              const { ev } = row
              const cfg = MANUAL_TYPE_CONFIG[ev.type as 'RAIN' | 'FROST'] ?? MANUAL_TYPE_CONFIG.RAIN
              const paddockNames = ev.paddocks.map(ep => ep.paddock?.name ?? '').filter(Boolean)
              return (
                <div
                  key={ev.id}
                  className={clsx(
                    'grid grid-cols-1 md:grid-cols-[100px_80px_120px_1fr_100px] gap-2 md:gap-3 px-3 py-3 rounded-xl items-center transition-colors hover:bg-amber-50/30 border border-transparent hover:border-amber-100',
                    idx % 2 === 0 ? 'bg-gray-50/30' : ''
                  )}
                >
                  <p className="text-xs font-bold text-gray-700">{formatDate(ev.date)}</p>

                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-black w-fit">
                    MANUAL
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border',
                      cfg.badge
                    )}>
                      <cfg.Icon className={clsx('w-2.5 h-2.5', cfg.iconCls)} />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Valor</p>
                      <p className="text-sm font-black text-gray-900">
                        {ev.type === 'RAIN' ? `${Number(ev.value).toFixed(1)} mm` : `${Number(ev.value).toFixed(1)} °C`}
                      </p>
                    </div>
                    {paddockNames.length > 0 && (
                      <div>
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Potreros</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {paddockNames.map(name => (
                            <span key={name} className="inline-flex px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-black">{name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onDelete && (
                      <button
                        onClick={() => handleDelete(ev.id)}
                        disabled={deletingId === ev.id}
                        title="Eliminar registro"
                        className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg transition-all disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            }

            // Snapshot row
            const { snap, paddockName } = row
            const growth = Number(snap.grass_growth_rate)
            const ndvi   = Number(snap.ndvi)
            const mult   = Number(snap.climate_multiplier)
            const rain   = Number(snap.rainfall_7d_mm)
            const snapKey = `${snap.paddock_id ?? paddockName}__${snap.calculated_at}`
            const isExpanded = expandedSnap === snapKey

            return (
              <div key={snapKey} className={clsx(
                'rounded-xl border transition-all',
                idx % 2 === 0 ? 'bg-gray-50/20' : 'bg-white',
                isExpanded ? 'border-emerald-200 bg-emerald-50/10' : 'border-transparent hover:border-gray-100'
              )}>
                <button
                  onClick={() => setExpandedSnap(isExpanded ? null : snapKey)}
                  className="w-full grid grid-cols-1 md:grid-cols-[100px_80px_120px_1fr_100px] gap-2 md:gap-3 px-3 py-3 items-center text-left"
                >
                  <p className="text-xs font-bold text-gray-700">{formatDate(snap.calculated_at)}</p>

                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black w-fit">
                    <Zap className="w-2.5 h-2.5" />
                    AUTO
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Leaf className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="text-[10px] font-black text-gray-600 truncate">{paddockName}</span>
                  </div>

                  {/* Key metrics */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Crecimiento</p>
                      <p className={`text-sm font-black ${growth > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {growth > 0 ? `${growth.toFixed(1)} kg/ha/d` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">NDVI</p>
                      <p className={`text-sm font-black ${ndvi > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                        {ndvi > 0 ? ndvi.toFixed(3) : <span title="Sin datos satelitales">—</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Lluvia 7d</p>
                      <p className="text-sm font-black text-gray-700">{rain.toFixed(0)} mm</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Mult. clim.</p>
                      <p className={`text-sm font-black ${mult >= 1.05 ? 'text-emerald-600' : mult <= 0.95 ? 'text-orange-600' : 'text-gray-600'}`}>
                        ×{mult.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-emerald-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px]">
                    {[
                      { label: 'MS disponible', value: `${Number(snap.forage_ms_ha).toLocaleString('es-AR')} kg/ha` },
                      { label: 'Días base',      value: `${snap.base_remaining_days} d` },
                      { label: 'Días ajustado',  value: `${snap.adjusted_remaining_days} d` },
                      { label: 'Alerta',         value: snap.alert_level === 'ok' ? '✓ Sin alerta' : snap.alert_level === 'warning' ? '⚠ Alerta' : '🔴 Crítico' },
                      { label: 'EV total',       value: snap.total_ev ? `${Number(snap.total_ev).toFixed(1)} EV` : '—' },
                      { label: 'Humedad',        value: snap.humidity_pct ? `${Number(snap.humidity_pct).toFixed(0)}%` : '—' },
                      { label: 'Sup. potrero',   value: snap.area_ha ? `${snap.area_ha} ha` : '—' },
                      { label: 'Fecha cálculo',  value: new Date(snap.calculated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-gray-400 font-black uppercase tracking-widest mb-0.5">{item.label}</p>
                        <p className="text-gray-800 font-bold">{item.value}</p>
                      </div>
                    ))}
                    {ndvi === 0 && (
                      <div className="col-span-2 sm:col-span-4 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-amber-700">
                          <strong>NDVI = 0:</strong> Este potrero no tiene georreferenciación satelital activa. El crecimiento se calcula usando el pasto declarado manualmente. Para activar NDVI, georreferenciá el potrero en <em>Mi Campo → Editar potrero</em>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[9px] text-gray-300 text-center pt-2">
        Las filas AUTO son recalculadas automáticamente con cada análisis climático.
        Los registros MANUAL son permanentes hasta que los eliminés.
      </p>
    </div>
  )
}
