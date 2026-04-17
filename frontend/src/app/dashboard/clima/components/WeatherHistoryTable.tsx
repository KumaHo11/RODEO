'use client'

import { useMemo } from 'react'
import { CloudRain, Snowflake, Droplets, Download } from 'lucide-react'
import type { WeatherEvent } from '@/lib/types/weather'
import clsx from 'clsx'

function formatDate(isoDate: string) {
  return new Date(isoDate + (isoDate.includes('T') ? '' : 'T00:00:00'))
    .toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TYPE_CONFIG = {
  RAIN:  { Icon: CloudRain, label: 'Lluvia', badge: 'bg-blue-50 text-blue-600',  iconCls: 'text-blue-500' },
  FROST: { Icon: Snowflake,  label: 'Helada', badge: 'bg-sky-50 text-sky-600',   iconCls: 'text-sky-400'  },
}

function exportToCSV(events: WeatherEvent[]) {
  const header = ['Fecha', 'Tipo', 'Valor', 'Unidad', 'Potreros', 'Observaciones']
  const lines = events.map(ev => {
    const paddocks = ev.paddocks.map(ep => ep.paddock?.name ?? '').filter(Boolean).join(', ')
    return [
      formatDate(ev.date),
      ev.type === 'RAIN' ? 'Lluvia' : 'Helada',
      Number(ev.value).toFixed(1),
      ev.type === 'RAIN' ? 'mm' : '°C',
      paddocks,
      (ev as any).notes ?? '',
    ]
  })

  const csv = [header, ...lines]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `registros-clima-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

interface WeatherHistoryTableProps {
  events: WeatherEvent[]
  isLoading: boolean
}

export function WeatherHistoryTable({ events, isLoading }: WeatherHistoryTableProps) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => b.date.localeCompare(a.date)),
    [events]
  )

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-5">
        <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-4">Historial de registros</p>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
            Historial de registros
          </p>
          <p className="text-[10px] text-gray-300 font-semibold mt-0.5">
            Eventos ingresados manualmente
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sorted.length > 0 && (
            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {sorted.length} registros
            </span>
          )}
          <button
            onClick={() => exportToCSV(sorted)}
            disabled={sorted.length === 0}
            title="Exportar a Excel/CSV"
            className={clsx(
              'flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all',
              sorted.length > 0
                ? 'bg-green-50 text-green-700 hover:bg-green-100 active:scale-95'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-10">
          <Droplets className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-400">Sin registros aún</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Usá los formularios de arriba para registrar eventos climáticos
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[110px_120px_80px_1fr] gap-3 mb-2 px-2">
            {['Fecha', 'Tipo', 'Valor', 'Potreros'].map(h => (
              <p key={h} className="text-[9px] font-black tracking-widest text-gray-400 uppercase">{h}</p>
            ))}
          </div>

          <div className="space-y-0.5">
            {sorted.map((ev, idx) => {
              const cfg = TYPE_CONFIG[ev.type as 'RAIN' | 'FROST'] ?? TYPE_CONFIG.RAIN
              const paddockNames = ev.paddocks
                .map(ep => ep.paddock?.name ?? '')
                .filter(Boolean)

              return (
                <div
                  key={ev.id}
                  className={clsx(
                    'grid sm:grid-cols-[110px_120px_80px_1fr] gap-3 px-3 py-2.5 rounded-xl items-center transition-colors hover:bg-gray-50',
                    idx % 2 === 0 ? '' : 'bg-gray-50/50'
                  )}
                >
                  {/* Date */}
                  <p className="text-xs font-bold text-gray-800">{formatDate(ev.date)}</p>

                  {/* Type badge */}
                  <span className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black w-fit',
                    cfg.badge
                  )}>
                    <cfg.Icon className={clsx('w-3 h-3', cfg.iconCls)} />
                    {cfg.label}
                  </span>

                  {/* Value */}
                  <p className="text-sm font-black text-gray-900">
                    {ev.type === 'RAIN'
                      ? `${Number(ev.value).toFixed(1)} mm`
                      : `${Number(ev.value).toFixed(1)} °C`}
                  </p>

                  {/* Paddock tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {paddockNames.length === 0 ? (
                      <span className="text-[10px] text-gray-300 font-semibold">—</span>
                    ) : (
                      paddockNames.map(name => (
                        <span
                          key={name}
                          className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black"
                        >
                          {name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
