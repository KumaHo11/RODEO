'use client'

/**
 * HerdUltimosEventos — Mini-widget de los últimos 5 eventos del rodeo.
 * Muestra farm-events filtrados por herd_id.
 */

import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import { apiFetch } from '@/lib/apiFetch'
import { Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface FarmEvent {
  id: string
  title: string
  event_type: string
  event_date: string
  status?: string
  description?: string
}

const EVENT_COLORS: Record<string, string> = {
  paricion:           'bg-green-500',
  destete:            'bg-emerald-500',
  venta:              'bg-red-400',
  compra:             'bg-blue-500',
  mortandad:          'bg-gray-500',
  tratamiento_sanitario: 'bg-purple-500',
  servicio:           'bg-teal-500',
  pesada:             'bg-amber-500',
  default:            'bg-gray-300',
}

interface Props {
  herdId: string
  onViewBitacora: () => void
}

export function HerdUltimosEventos({ herdId, onViewBitacora }: Props) {
  const [events, setEvents] = useState<FarmEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/api/farm-events?herd_id=${herdId}&limit=5&sort=desc`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events ?? data ?? [])
        }
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [herdId])

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
    } catch { return iso }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-green-500" />
          Últimos eventos
        </h3>
        <button
          onClick={onViewBitacora}
          className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 transition-colors"
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-gray-200 mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-3/4 bg-gray-100 rounded" />
                <div className="h-2 w-1/3 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-4">
          Sin eventos registrados
        </p>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="flex items-start gap-3">
              <div className={clsx(
                'w-2 h-2 rounded-full shrink-0 mt-1.5',
                EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.default
              )} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate leading-tight">{ev.title}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  {formatDate(ev.event_date)}
                  {ev.status && (
                    <span className={clsx(
                      'ml-2 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase',
                      ev.status === 'completado' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {ev.status}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
