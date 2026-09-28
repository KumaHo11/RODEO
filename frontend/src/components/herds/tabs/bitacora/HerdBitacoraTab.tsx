'use client'

/**
 * HerdBitacoraTab — Tab 5: Timeline unificado del rodeo.
 *
 * Mezcla:
 *  - farm-events filtrados por herd_id (eventos de stock, agenda)
 *  - historial-rodeo (pesadas, BCS)
 * en un único feed cronológico descendente.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import clsx from 'clsx'
import {
  BookOpen, Loader2, RefreshCw, Plus, ChevronDown,
  Camera, Scale, ShoppingCart, TrendingDown, Baby, Scissors,
  Stethoscope, ClipboardList, FileText
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import type { HerdData } from '@/components/HerdModal'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string
  date: string          // ISO string
  title: string
  description?: string
  event_type: string
  source: 'farm_event' | 'bcs_record'
  status?: string
  icon_key: string
}

// ── Iconos por tipo de evento ─────────────────────────────────────────────────

const ICONS: Record<string, { Icon: React.ComponentType<any>; color: string; bg: string }> = {
  paricion:              { Icon: Baby,        color: 'text-green-700',  bg: 'bg-green-100'  },
  destete:               { Icon: Scissors,    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  venta:                 { Icon: TrendingDown, color: 'text-red-600',   bg: 'bg-red-100'    },
  compra:                { Icon: ShoppingCart, color: 'text-blue-600',  bg: 'bg-blue-100'   },
  mortandad:             { Icon: TrendingDown, color: 'text-gray-600',  bg: 'bg-gray-100'   },
  tratamiento_sanitario: { Icon: Stethoscope,  color: 'text-purple-600', bg: 'bg-purple-100' },
  servicio:              { Icon: ClipboardList, color: 'text-teal-600', bg: 'bg-teal-100'   },
  csv_upload:            { Icon: FileText,     color: 'text-indigo-600', bg: 'bg-indigo-100' },
  pesada:                { Icon: Scale,        color: 'text-amber-600', bg: 'bg-amber-100'  },
  bcs_record:            { Icon: Camera,       color: 'text-pink-600',  bg: 'bg-pink-100'   },
  default:               { Icon: BookOpen,     color: 'text-gray-500',  bg: 'bg-gray-100'   },
}

function getIconConfig(key: string) {
  return ICONS[key] ?? ICONS.default
}

const PAGE_SIZE = 20

interface Props { herd: HerdData; onRefresh: () => void }

// ── Component ─────────────────────────────────────────────────────────────────

export default function HerdBitacoraTab({ herd }: Props) {
  const herdId = herd.id!
  const [entries,  setEntries]  = useState<TimelineEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [hasMore,  setHasMore]  = useState(false)
  const [offset,   setOffset]   = useState(0)
  const [error,    setError]    = useState<string | null>(null)

  const load = useCallback(async (reset = false) => {
    if (!reset && loading && offset > 0) return
    setLoading(true); setError(null)
    const currentOffset = reset ? 0 : offset

    try {
      const [evRes, bcsRes] = await Promise.allSettled([
        apiFetch(`/api/farm-events?herd_id=${herdId}&limit=${PAGE_SIZE}&offset=${currentOffset}&sort=desc`),
        apiFetch(`/api/historial-rodeo?rodeo_id=${herdId}&days=365`),
      ])

      const evEntries: TimelineEntry[] = []
      if (evRes.status === 'fulfilled' && evRes.value.ok) {
        const data = await evRes.value.json()
        const events = data.events ?? data ?? []
        events.forEach((ev: any) => {
          evEntries.push({
            id:          ev.id,
            date:        ev.event_date || ev.created_at,
            title:       ev.title,
            description: ev.description,
            event_type:  ev.event_type,
            source:      'farm_event',
            status:      ev.status,
            icon_key:    ev.event_type,
          })
        })
        setHasMore(events.length >= PAGE_SIZE)
      }

      // BCS records — solo en primer load (todos, no paginados)
      const bcsEntries: TimelineEntry[] = []
      if (reset && bcsRes.status === 'fulfilled' && bcsRes.value.ok) {
        const data = await bcsRes.value.json()
        const rows = data.historial ?? data ?? []
        rows.forEach((r: any) => {
          bcsEntries.push({
            id:          r.id ?? `bcs-${r.recorded_at}`,
            date:        r.recorded_at || r.created_at,
            title:       `Condición corporal: ${r.bcs_score}/5`,
            description: [
              r.bcs_label ? `Estado: ${r.bcs_label}` : null,
              r.estimated_weight_kg ? `Peso estimado: ${r.estimated_weight_kg} kg` : null,
              r.source === 'ai' ? '📷 Estimado por IA' : null,
            ].filter(Boolean).join(' · '),
            event_type:  'bcs_record',
            source:      'bcs_record',
            icon_key:    'bcs_record',
          })
        })
      }

      // Merge y ordenar descendente
      const merged = [...evEntries, ...(reset ? bcsEntries : [])]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setEntries(prev => reset ? merged : [...prev, ...evEntries])
      setOffset(currentOffset + PAGE_SIZE)
    } catch (e: any) {
      setError('Error al cargar la bitácora')
    } finally {
      setLoading(false)
    }
  }, [herdId, offset, loading])

  useEffect(() => { load(true) }, [herdId])

  // ── Render ────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'Hoy'
      if (diffDays === 1) return 'Ayer'
      if (diffDays < 7) return `Hace ${diffDays} días`
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
    } catch { return iso }
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl">

      {/* Header con acciones */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          Bitácora unificada
        </h3>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-green-600 bg-white border border-gray-200 rounded-xl transition-all hover:border-green-300"
        >
          <RefreshCw className={clsx('w-3 h-3', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs font-bold text-red-700">{error}</p>
        </div>
      )}

      {/* Timeline */}
      {loading && entries.length === 0 ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3.5 w-2/3 bg-gray-100 rounded" />
                <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6 text-blue-300" />
          </div>
          <p className="text-sm font-bold text-gray-500">Sin eventos registrados</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Los movimientos de stock, pesadas y eventos de agenda aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Línea vertical del timeline */}
          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-100" />

          <div className="space-y-1">
            {entries.map((entry, i) => {
              const cfg = getIconConfig(entry.icon_key)
              const Icon = cfg.Icon
              return (
                <div key={entry.id ?? i} className="flex gap-4 group">
                  {/* Icono */}
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative z-10 ring-2 ring-white transition-all group-hover:scale-105',
                    cfg.bg
                  )}>
                    <Icon className={clsx('w-4 h-4', cfg.color)} />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 pb-4 pt-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-gray-800 leading-snug">{entry.title}</p>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{entry.description}</p>
                    )}
                    {entry.status && (
                      <span className={clsx(
                        'inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase',
                        entry.status === 'completado' ? 'bg-green-50 text-green-700' :
                        entry.status === 'pendiente'  ? 'bg-amber-50 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      )}>
                        {entry.status}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => load(false)}
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-gray-500 hover:text-green-600 bg-white border border-gray-200 rounded-xl transition-all hover:border-green-300"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ChevronDown className="w-3.5 h-3.5" />
              }
              Cargar más eventos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
