'use client'

/**
 * SubHerdCard — Sub-Tarjeta Fisiológica
 * ──────────────────────────────────────
 * Versión compacta de la tarjeta de rodeo para mostrarse dentro de un LoteCard.
 * Muestra: categoría fisiológica, cabezas parciales, EV parcial, consumo.
 * El botón "Gestionar" vive EXCLUSIVAMENTE en este nivel (no en la macro-tarjeta).
 *
 * Design System: tokens.css, Card organism, Badge atom.
 */
import React from 'react'
import { motion } from 'framer-motion'
import { Trash2, Calendar } from 'lucide-react'
import {
  CATEGORIA_COLORS, CATEGORIA_LABEL_RAE, type CategoriaComercial,
} from '@/lib/categorias'
import { PHYSIO_LABEL } from '@/lib/grazing/evProjection'
import { calculateBaseEV } from '@/lib/grazing/evProjection'
import { fmtDate } from '@/lib/utils/dates'
import type { HerdData } from '@/components/HerdModal'
import WeatherConditionChip from '@/components/WeatherConditionChip'

// Colores semánticos por categoría fisiológica
const PHYSIO_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  VACA_CON_TERNERO:  { dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700'   },
  VACA_PRENADA:      { dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700'  },
  VACA_VACIA:        { dot: 'bg-gray-400',   bg: 'bg-gray-50',   text: 'text-gray-600'   },
  VACA_SECA:         { dot: 'bg-gray-400',   bg: 'bg-gray-50',   text: 'text-gray-600'   },
  TERNERO:           { dot: 'bg-lime-500',   bg: 'bg-lime-50',   text: 'text-lime-700'   },
  RECRIA_NOVILLO:    { dot: 'bg-emerald-500',bg: 'bg-emerald-50',text: 'text-emerald-700'},
  RECRIA_VAQUILLONA: { dot: 'bg-teal-500',   bg: 'bg-teal-50',   text: 'text-teal-700'   },
  TORO_DESCANSO:     { dot: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700' },
  TORO_SERVICIO:     { dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700'    },
}

interface SubHerdCardProps {
  herd: HerdData
  onManage: () => void
  onDelete: () => void
}

export default function SubHerdCard({ herd, onManage, onDelete }: SubHerdCardProps) {
  const catKey   = herd.categoria as CategoriaComercial | null
  const colors   = catKey ? CATEGORIA_COLORS[catKey] : null
  const catDisp  = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
  const ev       = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)
  const msDay    = Math.round(ev * 11)
  const physio   = herd.physiological_category as string | null
  const physioColors = physio ? PHYSIO_COLORS[physio] : null
  const physioLabel  = physio ? (PHYSIO_LABEL[physio as keyof typeof PHYSIO_LABEL] ?? physio) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="group bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
      onClick={onManage}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Dot indicador fisiológico */}
        <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 border border-gray-100">
          <span
            className={`w-2.5 h-2.5 rounded-full ${physioColors?.dot ?? colors?.dot ?? 'bg-gray-300'}`}
          />
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Categoría fisiológica (primaria) */}
            {physioLabel ? (
              <span className={`text-xs font-bold ${physioColors?.text ?? 'text-gray-700'}`}>
                {physioLabel}
              </span>
            ) : (
              <span className="text-xs font-bold text-gray-700 truncate">{herd.name}</span>
            )}
            {/* Categoría comercial (secundaria) */}
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${physioColors?.bg ?? 'bg-gray-50'} ${physioColors?.text ?? 'text-gray-400'}`}>
              {catDisp}
            </span>
            {herd.exit_date && (
              <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md tracking-wider">TEMP</span>
            )}
          </div>
          {/* Fecha y nombre del rodeo (si es diferente) */}
          {physioLabel && herd.name !== physioLabel && (
            <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">{herd.name}</p>
          )}
        </div>

        {/* Métricas compactas */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-gray-900 tabular-nums leading-none">
              {Math.round(herd.head_count).toLocaleString('es-AR')}
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">cab.</p>
          </div>

          <div className="w-px h-8 bg-gray-100 hidden sm:block" />

          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-gray-700 tabular-nums leading-none">
              {Math.round(ev).toLocaleString('es-AR')}
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">EV</p>
          </div>

          <div className="w-px h-8 bg-gray-100 hidden md:block" />

          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-gray-600 tabular-nums leading-none">
              {msDay.toLocaleString('es-AR')}
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">kg MS/d</p>
          </div>

          {/* Visible solo en mobile */}
          <div className="text-right sm:hidden">
            <p className="text-sm font-black text-gray-900 tabular-nums">{Math.round(herd.head_count)}</p>
            <p className="text-[9px] text-gray-400 font-bold">{Math.round(ev)} EV</p>
          </div>

          {/* Divider + Actions */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-gray-100">
            <div onClick={e => e.stopPropagation()}>
              <WeatherConditionChip mode="herd" entityName={herd.name} />
            </div>

            <button
              onClick={e => { e.stopPropagation(); onManage() }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-lg transition-all shrink-0 whitespace-nowrap"
            >
              Gestionar
            </button>

            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer compacto con fecha de ingreso */}
      {herd.admission_date && (
        <div className="px-4 pb-2 flex items-center gap-1 text-gray-300">
          <Calendar className="w-3 h-3 shrink-0" />
          <p className="text-[9px] font-bold text-gray-400">{fmtDate(herd.admission_date)}</p>
        </div>
      )}
    </motion.div>
  )
}
