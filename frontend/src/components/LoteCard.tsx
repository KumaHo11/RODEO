'use client'

/**
 * LoteCard — Macro-Tarjeta de Lote de Manejo
 * ─────────────────────────────────────────────
 * Agrupa sub-rodeos (estados fisiológicos) bajo un "Lote de Manejo" padre.
 * Muestra métricas globales agregadas y una progress bar de distribución
 * de estados fisiológicos.
 *
 * Interacción (Acordeón): inicia colapsada. Click en chevron expande/colapsa.
 * El botón "Gestionar" vive EXCLUSIVAMENTE en los SubHerdCard hijos.
 *
 * Design System: tokens.css, Card organism, motion animations.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Users } from 'lucide-react'
import { IconoRodeos } from '@/components/icons/IconoRodeos'
import { type HerdData } from '@/components/HerdModal'
import SubHerdCard from '@/components/SubHerdCard'
import { PHYSIO_LABEL } from '@/lib/grazing/evProjection'

// Colores para la progress bar de distribución fisiológica
const PHYSIO_BAR_COLORS: Record<string, string> = {
  VACA_CON_TERNERO:  '#3b82f6',   // blue-500
  VACA_PRENADA:      '#22c55e',   // green-500
  VACA_VACIA:        '#9ca3af',   // gray-400
  VACA_SECA:         '#6b7280',   // gray-500
  TERNERO:           '#84cc16',   // lime-500
  RECRIA_NOVILLO:    '#10b981',   // emerald-500
  RECRIA_VAQUILLONA: '#14b8a6',   // teal-500
  TORO_DESCANSO:     '#f97316',   // orange-500
  TORO_SERVICIO:     '#ef4444',   // red-500
}
const FALLBACK_COLOR = '#d1d5db'  // gray-300

export interface LoteData {
  grupo_manejo_id: string
  nombre: string
  hijos: HerdData[]
  totales: {
    head_count: number
    total_ev: number
    consumo_kg_ms_dia: number
  }
}

interface LoteCardProps {
  lote: LoteData
  onManageHerd: (herd: HerdData) => void
  onDeleteHerd: (id: string) => void
  defaultExpanded?: boolean
}

export default function LoteCard({
  lote,
  onManageHerd,
  onDeleteHerd,
  defaultExpanded = false,
}: LoteCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // Safe totales — falls back to computing from hijos if API didn't send them
  const headCount = lote.totales?.head_count ?? lote.hijos.reduce((s, h) => s + (Number(h.head_count) || 0), 0)
  const totalEv = lote.totales?.total_ev ?? lote.hijos.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
  const consumoKgMsDia = lote.totales?.consumo_kg_ms_dia ?? Math.round(totalEv * 11)

  const safeTotales = {
    head_count: headCount,
    total_ev: totalEv,
    consumo_kg_ms_dia: consumoKgMsDia,
  }

  // Calcular distribución fisiológica para la progress bar
  const physioDistribution = React.useMemo(() => {
    const totalCabezas = safeTotales.head_count || 1
    const groups: { key: string; label: string; cabezas: number; pct: number; color: string }[] = []

    // Agrupar por physiological_category
    const byPhysio = new Map<string, number>()
    for (const h of lote.hijos) {
      const key = h.physiological_category || h.categoria || 'OTRO'
      byPhysio.set(key, (byPhysio.get(key) || 0) + (Number(h.head_count) || 0))
    }

    byPhysio.forEach((cabezas, key) => {
      groups.push({
        key,
        label: PHYSIO_LABEL[key as keyof typeof PHYSIO_LABEL] ?? key,
        cabezas,
        pct: (cabezas / totalCabezas) * 100,
        color: PHYSIO_BAR_COLORS[key] ?? FALLBACK_COLOR,
      })
    })

    return groups.sort((a, b) => b.cabezas - a.cabezas)
  }, [lote.hijos, safeTotales.head_count])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* ── Header del Lote (Macro-Tarjeta) ────────────────────────── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 pt-5 pb-4 flex items-start justify-between gap-3 text-left group"
        aria-expanded={expanded}
        aria-label={`Lote ${lote.nombre}: ${expanded ? 'colapsar' : 'expandir'}`}
      >
        {/* Ícono + Nombre del Lote */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 flex items-center justify-center">
            <IconoRodeos className="w-4 h-4 text-green-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-black text-gray-950 leading-tight truncate">
                {lote.nombre}
              </h3>
              <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full tracking-widest uppercase">
                LOTE
              </span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">
              {lote.hijos.length} estado{lote.hijos.length !== 1 ? 's' : ''} fisiológico{lote.hijos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Métricas Globales Agregadas */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-black text-gray-950 tabular-nums leading-none">
              {safeTotales.head_count.toLocaleString('es-AR')}
            </p>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">cabezas</p>
          </div>

          <div className="w-px h-8 bg-gray-100 hidden sm:block" />

          <div className="text-right hidden md:block">
            <p className="text-base font-black text-gray-700 tabular-nums leading-none">
              {Math.round(safeTotales.total_ev).toLocaleString('es-AR')}
            </p>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">EV total</p>
          </div>

          <div className="w-px h-8 bg-gray-100 hidden lg:block" />

          <div className="text-right hidden lg:block">
            <p className="text-base font-black text-gray-600 tabular-nums leading-none">
              {safeTotales.consumo_kg_ms_dia.toLocaleString('es-AR')}
            </p>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">kg MS/día</p>
          </div>

          {/* Chevron */}
          <div className={`ml-2 p-1.5 rounded-lg transition-colors ${expanded ? 'bg-green-50' : 'bg-gray-50 group-hover:bg-gray-100'}`}>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {/* ── Progress Bar de Distribución Fisiológica ─────────────────── */}
      <div className="px-5 pb-3">
        {/* Barra */}
        <div className="flex h-1.5 rounded-full overflow-hidden w-full bg-gray-100 mb-2">
          {physioDistribution.map(seg => (
            <div
              key={seg.key}
              style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${Math.round(seg.pct)}%`}
              className="transition-all duration-500"
            />
          ))}
        </div>
        {/* Leyenda */}
        <div className="flex items-center gap-3 flex-wrap">
          {physioDistribution.map(seg => (
            <div key={seg.key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-[9px] font-bold text-gray-500">
                {Math.round(seg.pct)}% {seg.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sub-Tarjetas (Acordeón) ──────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-50">
              {lote.hijos.length === 0 ? (
                <div className="py-6 text-center">
                  <Users className="w-5 h-5 text-gray-200 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-400">Sin sub-rodeos en este lote</p>
                </div>
              ) : (
                lote.hijos.map(herd => (
                  <SubHerdCard
                    key={herd.id}
                    herd={herd}
                    onManage={() => onManageHerd(herd)}
                    onDelete={() => onDeleteHerd(herd.id!)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
