'use client'

/**
 * HerdDetailHeader — Cabecera del panel derecho del rodeo.
 *
 * v5: Trash icon sutil en el header (gris → rojo on hover).
 *     Modal de eliminación con createPortal (cubre TODO: nav + sidebar).
 */

import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Thermometer } from 'lucide-react'
import { CATEGORIA_COLORS, CATEGORIA_LABEL_RAE, type CategoriaComercial } from '@/lib/categorias'
import { PHYSIO_LABEL, calculateBaseEV } from '@/lib/grazing/evProjection'
import { HERD_TABS, HERD_TAB_LABELS, type HerdTab } from '@/types/herds'
import type { HerdData } from '@/components/HerdModal'
import { HerdDeleteDialog } from '@/components/herds/HerdDeleteDialog'
import { useWeather } from '@/lib/context/WeatherContext'

interface HerdDetailHeaderProps {
  herd: HerdData
  activeTab: HerdTab
}

export function HerdDetailHeader({ herd, activeTab }: HerdDetailHeaderProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const { current } = useWeather()

  const catKey   = herd.categoria as CategoriaComercial | null
  const colors   = catKey ? CATEGORIA_COLORS[catKey] : null
  const catLabel = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
  const ev       = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)
  const msDay    = Math.round(ev * 11)

  // ── Chip de bienestar THI ────────────────────────────────────────────
  const thiChip = useMemo(() => {
    if (!current) return null
    const Td  = current.tempC - ((100 - current.humidityPct) / 5)
    const thi = current.tempC + 0.36 * Td + 41.5
    if (thi < 68) return { label: 'Confort',  color: 'text-green-700 bg-green-50 border-green-200', Icon: Thermometer }
    if (thi < 72) return { label: 'Alerta',   color: 'text-amber-700 bg-amber-50 border-amber-200', Icon: Thermometer }
    return              { label: 'Peligro',   color: 'text-red-700   bg-red-50   border-red-200',   Icon: Thermometer }
  }, [current])

  const herdSlug = pathname.match(/\/herds\/([^/]+)\//)?.[1] ?? ''

  return (
    <div className="shrink-0 bg-white border-b border-gray-100">

      {/* ── Fila de título + chips + trash ────────────────────────────── */}
      <div className="px-8 pt-6 pb-0 flex items-center gap-4 min-w-0">

        {/* Back mobile */}
        <Link
          href="/dashboard/herds"
          className="md:hidden inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-green-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3 h-3" />
        </Link>

        {/* ── Nombre + categoría ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex items-center gap-2.5 overflow-hidden">
          {colors && (
            <div className={clsx('w-3 h-3 rounded-full shrink-0', colors.dot)} />
          )}
          <h1 className="text-xl font-black text-gray-950 truncate leading-tight">
            {herd.name}
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 min-w-0 shrink overflow-hidden">
            <span className="text-xs font-semibold text-gray-400 truncate">{catLabel}</span>
            {herd.physiological_category && (
              <>
                <span className="text-gray-300 text-xs shrink-0">·</span>
                <span className="text-[10px] font-bold text-green-700/80 uppercase tracking-wide truncate">
                  {PHYSIO_LABEL[herd.physiological_category as keyof typeof PHYSIO_LABEL] ?? herd.physiological_category}
                </span>
              </>
            )}
            {herd.exit_date && (
              <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
                TEMP
              </span>
            )}
          </div>
        </div>

        {/* ── KPI chips ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <KpiChip value={herd.head_count.toLocaleString('es-AR')} label="Cab"  color="blue"  />
          <KpiChip value={herd.avg_weight_kg ? `${Math.round(Number(herd.avg_weight_kg))} kg` : '—'} label="Peso" color="gray"  />
          <KpiChip value={Math.round(ev).toLocaleString('es-AR')}  label="EV"   color="green" />
          <KpiChip value={msDay.toLocaleString('es-AR')}           label="MS/d" color="amber" />
          {/* THI bienestar chip */}
          {thiChip && (
            <div className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black whitespace-nowrap',
              thiChip.color
            )}>
              <Thermometer className="w-3 h-3" />
              {thiChip.label}
            </div>
          )}
        </div>

        {/*
          ── Trash button — sutil, solo icono.
          Default: gris translúcido. Hover: rojo.
          Separado de los chips con un divisor visual.
        */}
        <div className="shrink-0 flex items-center pl-2 border-l border-gray-100">
          <button
            type="button"
            aria-label="Eliminar rodeo"
            title="Eliminar rodeo"
            onClick={() => setShowDelete(true)}
            className="
              p-2 rounded-xl transition-all duration-150
              text-gray-300
              hover:text-red-500 hover:bg-red-50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400
            "
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="mt-4 px-8 flex items-center overflow-x-auto scrollbar-none border-t border-gray-100">
        {HERD_TABS.map(tab => (
          <Link
            key={tab}
            href={`/dashboard/herds/${herdSlug}/${tab}`}
            className={clsx(
              'shrink-0 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap -mb-px',
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
            )}
          >
            {HERD_TAB_LABELS[tab]}
          </Link>
        ))}
      </div>

      {/* ── Delete dialog — Portal, cubre TODO (nav + sidebar) ──────── */}
      <HerdDeleteDialog
        herdId={herd.id!}
        herdName={herd.name}
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onDeleted={() => router.replace('/dashboard/herds')}
      />
    </div>
  )
}

// ── KPI Chip ─────────────────────────────────────────────────────────────────

const CHIP_COLORS = {
  blue:  'bg-blue-50  text-blue-700  border-blue-100',
  gray:  'bg-gray-50  text-gray-600  border-gray-200',
  green: 'bg-green-50 text-green-700 border-green-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
} as const

function KpiChip({ value, label, color }: {
  value: string
  label: string
  color: keyof typeof CHIP_COLORS
}) {
  return (
    <div className={clsx(
      'flex items-baseline gap-1 px-2.5 py-1.5 rounded-xl border whitespace-nowrap',
      CHIP_COLORS[color]
    )}>
      <span className="text-sm font-black tabular-nums leading-none">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide opacity-50">{label}</span>
    </div>
  )
}
