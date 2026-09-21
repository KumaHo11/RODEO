'use client'

import React from 'react'
import { Mic2 } from 'lucide-react'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'
import { BitacoraCard } from './BitacoraCard'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

function groupByDate(entries: BitacoraEntry[]): Map<string, BitacoraEntry[]> {
  const map = new Map<string, BitacoraEntry[]>()
  for (const e of entries) {
    const key = fmtDate(e.createdAt)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BitacoraGridProps {
  entries: BitacoraEntry[]
  loading: boolean
  searchQuery: string
  paddocks?: { id: string; name: string }[]
  herds?: { id: string; name: string }[]
  onDelete: (id: string, isPending: boolean) => void
  onEdit?: (note: BitacoraEntry) => void
  onApplyWA?: (note: BitacoraEntry) => void
  onDismissWA?: (note: BitacoraEntry) => void
  onAiResultSaved?: (noteId: string, result: BitacoraAiResult) => void
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
export function BitacoraGrid({
  entries,
  loading,
  searchQuery,
  paddocks,
  herds,
  onDelete,
  onEdit,
  onApplyWA,
  onDismissWA,
  onAiResultSaved,
}: BitacoraGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-2.5 bg-gray-100 rounded w-1/4" />
              </div>
            </div>
            <div className="aspect-video bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-24 text-gray-400">
        <Mic2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
        <p className="text-sm font-bold text-gray-300 italic">
          {searchQuery ? 'Sin resultados para esa búsqueda' : 'Presioná el círculo rojo para grabar'}
        </p>
      </div>
    )
  }

  const grouped = groupByDate(entries)

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([dateLabel, dayEntries]) => (
        <section key={dateLabel}>
          {/* Sticky date header */}
          <div className="py-2 sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {dateLabel}
            </span>
          </div>

          {/* 2-column responsive grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {dayEntries.map(entry => (
              <BitacoraCard
                key={entry.id}
                note={entry}
                paddocks={paddocks}
                herds={herds}
                onDelete={onDelete}
                onEdit={onEdit}
                onApplyWA={onApplyWA}
                onDismissWA={onDismissWA}
                onAiResultSaved={onAiResultSaved}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
