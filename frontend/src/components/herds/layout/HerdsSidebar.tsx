'use client'

/**
 * HerdsSidebar — Lista de rodeos en el panel izquierdo.
 *
 * v3: items con más respiro vertical, buscador integrado, sin toggle.
 */

import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import { Plus, Search, X } from 'lucide-react'
import { IconoRodeos } from '@/components/icons/IconoRodeos'
import { CATEGORIA_COLORS, CATEGORIA_LABEL_RAE, type CategoriaComercial } from '@/lib/categorias'
import { calculateBaseEV } from '@/lib/grazing/evProjection'
import type { HerdData } from '@/components/HerdModal'
import type { LoteData } from '@/components/LoteCard'

interface HerdsSidebarProps {
  herds:          HerdData[]
  lotes:          LoteData[]
  ungrouped:      HerdData[]
  loading?:       boolean
  selectedHerdId: string | null
  onSelectHerd:   (id: string, tab?: string) => void
  onNewHerd:      () => void
}

export function HerdsSidebar({ herds, lotes, ungrouped, loading, selectedHerdId, onSelectHerd, onNewHerd }: HerdsSidebarProps) {
  const [search, setSearch] = useState('')

  const filteredUngrouped = useMemo(() => {
    if (!search.trim()) return ungrouped
    const q = search.toLowerCase()
    return ungrouped.filter(h =>
      h.name.toLowerCase().includes(q) ||
      (h.grupo_manejo_nombre ?? '').toLowerCase().includes(q) ||
      (h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? '').toLowerCase().includes(q) : false)
    )
  }, [ungrouped, search])

  const filteredLotes = useMemo(() => {
    if (!search.trim()) return lotes
    const q = search.toLowerCase()
    return lotes
      .map(lote => ({
        ...lote,
        hijos: lote.hijos.filter(h =>
          h.name.toLowerCase().includes(q) ||
          (lote.nombre ?? '').toLowerCase().includes(q) ||
          (h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? '').toLowerCase().includes(q) : false)
        ),
      }))
      .filter(l => l.hijos.length > 0)
  }, [lotes, search])

  const totalResults = filteredUngrouped.length + filteredLotes.reduce((s, l) => s + l.hijos.length, 0)

  return (
    <div className="flex flex-col h-full w-full bg-white">

      {/* ── Header del sidebar ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconoRodeos className="w-4 h-4 text-green-600 shrink-0" />
            <h2 className="text-xs font-black text-gray-700 tracking-widest uppercase">Rodeos</h2>
          </div>
          <span className="text-[10px] font-bold text-gray-400 tabular-nums bg-gray-50 px-2 py-0.5 rounded-full">
            {herds.length} total
          </span>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar rodeo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-[10px] text-gray-400 font-bold mt-2">
            {totalResults > 0 ? `${totalResults} resultado${totalResults !== 1 ? 's' : ''}` : 'Sin resultados'}
          </p>
        )}
      </div>

      {/* ── Lista scrollable ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">

        {loading && (
          <div className="flex flex-col gap-3 px-1 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && herds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <IconoRodeos className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-bold text-gray-400">Sin rodeos</p>
            <p className="text-[11px] text-gray-300 mt-1">
              Creá tu primer rodeo para comenzar
            </p>
          </div>
        )}

        {/* Lotes de manejo */}
        {!loading && filteredLotes.map(lote => (
          <div key={lote.grupo_manejo_id ?? lote.nombre} className="mb-2">
            <p className="px-2 pt-3 pb-1.5 text-[9px] font-black tracking-widest text-gray-400 uppercase select-none truncate">
              📂 {lote.nombre}
            </p>
            {lote.hijos.map(herd => (
              <HerdSidebarItem
                key={herd.id}
                herd={herd}
                isSelected={selectedHerdId === herd.id}
                onSelect={onSelectHerd}
                indent
              />
            ))}
          </div>
        ))}

        {/* Rodeos individuales */}
        {!loading && filteredUngrouped.length > 0 && (
          <div>
            {filteredLotes.length > 0 && (
              <p className="px-2 pt-3 pb-1.5 text-[9px] font-black tracking-widest text-gray-400 uppercase select-none">
                Sin lote
              </p>
            )}
            {filteredUngrouped.map(herd => (
              <HerdSidebarItem
                key={herd.id}
                herd={herd}
                isSelected={selectedHerdId === herd.id}
                onSelect={onSelectHerd}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer: Nuevo rodeo ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-4 border-t border-gray-100 bg-white">
        <button
          onClick={onNewHerd}
          className={clsx(
            'w-full flex items-center justify-center gap-2',
            'bg-green-600 hover:bg-green-700 active:bg-green-800',
            'text-white text-sm font-bold',
            'py-3 rounded-xl',
            'transition-all shadow-sm shadow-green-200',
            'hover:shadow-md hover:shadow-green-200'
          )}
        >
          <Plus className="w-4 h-4" />
          Nuevo rodeo
        </button>
      </div>
    </div>
  )
}

// ── Item individual del sidebar ───────────────────────────────────────────────

interface HerdSidebarItemProps {
  herd:       HerdData
  isSelected: boolean
  onSelect:   (id: string, tab?: string) => void
  indent?:    boolean
}

function HerdSidebarItem({ herd, isSelected, onSelect, indent = false }: HerdSidebarItemProps) {
  const catKey   = herd.categoria as CategoriaComercial | null
  const colors   = catKey ? CATEGORIA_COLORS[catKey] : null
  const catLabel = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
  const ev       = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)

  return (
    <button
      type="button"
      onClick={() => herd.id && onSelect(herd.id)}
      className={clsx(
        'w-full flex items-center gap-3 rounded-2xl px-3 py-3.5 transition-all group mb-0.5 text-left',
        indent && 'ml-2',
        isSelected
          ? 'bg-green-50 border border-green-200/80 shadow-sm'
          : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'
      )}
    >
      {/* Dot de categoría */}
      <div className={clsx(
        'w-2.5 h-2.5 rounded-full shrink-0',
        colors?.dot ?? 'bg-gray-300'
      )} />

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-sm font-bold truncate leading-tight',
          isSelected ? 'text-green-800' : 'text-gray-800'
        )}>
          {herd.name}
          {herd.exit_date && (
            <span className="ml-1 text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full align-middle">
              TEMP
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] text-gray-400 font-medium truncate">
            {catLabel}
          </span>
          <span className="text-[9px] text-gray-300">·</span>
          <span className="text-[11px] font-bold text-gray-500 tabular-nums whitespace-nowrap">
            {herd.head_count.toLocaleString('es-AR')} cab
          </span>
        </div>
      </div>

      {/* EV badge */}
      <div className={clsx(
        'shrink-0 text-right transition-opacity',
        isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'
      )}>
        <p className={clsx(
          'text-sm font-black tabular-nums',
          isSelected ? 'text-green-700' : 'text-gray-600'
        )}>
          {Math.round(ev).toLocaleString('es-AR')}
        </p>
        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-bold">EV</p>
      </div>
    </button>
  )
}
