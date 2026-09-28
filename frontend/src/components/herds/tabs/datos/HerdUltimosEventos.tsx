'use client'

/**
 * HerdUltimosEventos — Mini-widget de los últimos 5 eventos del rodeo.
 * Spec 3.4: Diseño sobrio sin puntos de color ni badges de estado.
 * Solo tipografía en escala de grises + dividers.
 */

import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { Calendar, ArrowRight } from 'lucide-react'

interface FarmEvent {
  id: string
  title: string
  event_type: string
  event_date: string
  status?: string
  description?: string
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
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
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
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="py-2 space-y-1.5">
              <div className="h-3 w-3/4 bg-gray-100 rounded" />
              <div className="h-2 w-1/3 bg-gray-100 rounded" />
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
        <div className="divide-y divide-gray-50">
          {events.map(ev => (
            <div key={ev.id} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-xs font-bold text-gray-800 leading-tight truncate">{ev.title}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                {formatDate(ev.event_date)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
