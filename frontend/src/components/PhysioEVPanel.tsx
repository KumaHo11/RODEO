'use client'

/**
 * PhysioEVPanel — Panel unificado de Categoría Fisiológica + Cálculo EV Cocimano
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente reactivo que:
 *  1. Muestra un select de categoría fisiológica
 *  2. Renderiza inputs condicionales según la categoría elegida
 *  3. Calcula EV exacto usando las tablas Cocimano (evMatrix.ts)
 *  4. Muestra tarjeta de resultados con ración editable
 *
 * Reutilizado en: HerdModal, Step3Herds, EvTab (Calculadora).
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Info, Activity, Scale, Leaf, TrendingUp, Calendar } from 'lucide-react'
import { Tooltip } from '@/design-system/atoms/Tooltip'
import {
  PHYSIOLOGICAL_CATEGORIES,
  PHYSIO_LABEL,
  PHYSIO_EV_BASE,
  GROWTH_PHYSIO_CATEGORIES,
  type PhysiologicalCategory,
} from '@/lib/grazing/evProjection'
import {
  calcularEVRodeo,
  LACTANCIA_RANGES,
  ESTADIOS_GESTACION,
  RATION_SUGERIDA_POR_CATEGORIA,
  type LactanciaRange,
  type EstadioGestacion,
} from '@/lib/grazing/evMatrix'

// ── Constantes de estilo ────────────────────────────────────────────────────
const LABEL = 'text-[10px] font-black text-gray-700 tracking-widest uppercase'
const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-base md:text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all'
const SELECT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-base md:text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all'

// ── Tooltip ADPV ─────────────────────────────────────────────────────────────
const ADPV_TOOLTIP = `ADPV = Aumento Diario de Peso Vivo. Es cuántos kilogramos gana cada animal por día. 
Ejemplo: 0.500 kg/día significa que el animal aumenta 500 gramos diarios. 
Este valor se usa para determinar los requerimientos energéticos exactos del rodeo según las tablas Cocimano.`

// ── Categorías que usan tabla de peso × ADPV ─────────────────────────────────
const ADPV_CATEGORIES = new Set<PhysiologicalCategory>([
  'TERNERO', 'RECRIA_NOVILLO', 'RECRIA_VAQUILLONA', 'TORO_DESCANSO', 'TORO_SERVICIO',
])

// ── Categorías de vacas con estado especial ──────────────────────────────────
const VACA_LACTANCIA_CATS = new Set<PhysiologicalCategory>(['VACA_CON_TERNERO'])
const VACA_GESTACION_CATS  = new Set<PhysiologicalCategory>(['VACA_PRENADA'])
const VACA_MANTENIMIENTO   = new Set<PhysiologicalCategory>(['VACA_VACIA', 'VACA_SECA'])

// ── Grupos para el select ────────────────────────────────────────────────────
const PHYSIO_GROUPS: { label: string; cats: PhysiologicalCategory[] }[] = [
  {
    label: 'Vacas',
    cats: ['VACA_CON_TERNERO', 'VACA_PRENADA', 'VACA_VACIA'],
  },
  {
    label: 'Recría / crecimiento',
    cats: ['TERNERO', 'RECRIA_NOVILLO', 'RECRIA_VAQUILLONA'],
  },
  {
    label: 'Toros',
    cats: ['TORO_DESCANSO', 'TORO_SERVICIO'],
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PhysioEVPanelValue {
  physioCategory: PhysiologicalCategory | ''
  pesoKg: number | ''
  adpvKgDay: number | ''
  lactanciaRange: LactanciaRange | ''
  estadioGestacion: EstadioGestacion | ''
  lastWeighDate: string
  /** Ración customizada por el usuario (null = usar sugerida) */
  customRacionKgDia: number | null
}

export interface PhysioEVPanelResult {
  evUnitario: number
  evTotal: number
  racionKgDia: number
  consumoTotalKgDia: number
}

interface PhysioEVPanelProps {
  /** Valores actuales del panel */
  value: PhysioEVPanelValue
  /** Número de cabezas del rodeo */
  cabezas: number
  /** Callback al cambiar cualquier campo del panel */
  onChange: (next: Partial<PhysioEVPanelValue>) => void
  /** Variante visual: 'modal' (formulario completo) | 'compact' (calculadora) */
  variant?: 'modal' | 'compact'
  /** Si true, muestra el campo de fecha de último pesaje */
  showLastWeighDate?: boolean
  /** Clases adicionales para el contenedor */
  className?: string
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PhysioEVPanel({
  value,
  cabezas,
  onChange,
  variant = 'modal',
  showLastWeighDate = true,
  className = '',
}: PhysioEVPanelProps) {
  const {
    physioCategory,
    pesoKg,
    adpvKgDay,
    lactanciaRange,
    estadioGestacion,
    lastWeighDate,
    customRacionKgDia,
  } = value

  // ── Defaults de ADPV por categoría ─────────────────────────────────────────
  useEffect(() => {
    if (!physioCategory) return
    if (GROWTH_PHYSIO_CATEGORIES.has(physioCategory as PhysiologicalCategory)) {
      if (adpvKgDay === '' || adpvKgDay === 0) {
        onChange({ adpvKgDay: 0.5 })
      }
    } else if (physioCategory === 'VACA_CON_TERNERO') {
      onChange({ adpvKgDay: 0 })
    }
  }, [physioCategory])  

  // ── Calcular EV usando tablas Cocimano ──────────────────────────────────────
  const evResult = useMemo(() => {
    if (!physioCategory || !pesoKg || Number(pesoKg) <= 0 || cabezas <= 0) return null

    return calcularEVRodeo(
      {
        categoria: physioCategory,
        pesoKg: Number(pesoKg),
        adpvKgDay: Number(adpvKgDay) || 0,
        lactanciaRange: (lactanciaRange as LactanciaRange) || null,
        estadioGestacion: (estadioGestacion as EstadioGestacion) || null,
      },
      cabezas,
      customRacionKgDia,
    )
  }, [physioCategory, pesoKg, adpvKgDay, lactanciaRange, estadioGestacion, cabezas, customRacionKgDia])

  // Ración sugerida por categoría (sin custom)
  const racionSugeridaDefault = physioCategory
    ? (RATION_SUGERIDA_POR_CATEGORIA[physioCategory] ?? 12)
    : 12

  // ── Handler para reset de ración customizada ────────────────────────────────
  const handleRacionChange = useCallback((val: string) => {
    const n = val === '' ? null : Number(val)
    onChange({ customRacionKgDia: n })
  }, [onChange])

  const handleResetRacion = useCallback(() => {
    onChange({ customRacionKgDia: null })
  }, [onChange])

  // ── Determinar qué inputs mostrar ──────────────────────────────────────────
  const showLactancia   = physioCategory && VACA_LACTANCIA_CATS.has(physioCategory as PhysiologicalCategory)
  const showGestacion   = physioCategory && VACA_GESTACION_CATS.has(physioCategory as PhysiologicalCategory)
  const showADPV        = physioCategory && ADPV_CATEGORIES.has(physioCategory as PhysiologicalCategory)
  const showMantenimiento = physioCategory && VACA_MANTENIMIENTO.has(physioCategory as PhysiologicalCategory)
  const showPeso        = !!physioCategory

  const isCompact = variant === 'compact'

  return (
    <div className={`rounded-2xl border border-green-100 bg-gradient-to-br from-green-50/50 to-teal-50/30 p-4 space-y-4 ${className}`}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
          <Activity className="w-3.5 h-3.5 text-green-600" />
        </div>
        <p className="text-[10px] font-black text-green-700 tracking-widest uppercase">
          Estado fisiológico
        </p>
        <Tooltip text="La categoría fisiológica determina los requerimientos reales de materia seca. Es independiente de la categoría comercial usada para valuación de mercado." />
      </div>

      {/* ── Select de Categoría Fisiológica ── */}
      <div className="space-y-1.5">
        <label className={LABEL}>Categoría fisiológica</label>
        <select
          id="physio-category-select"
          className={SELECT}
          value={physioCategory}
          onChange={e => {
            const cat = e.target.value as PhysiologicalCategory | ''
            onChange({
              physioCategory: cat,
              // Reset condicionales al cambiar categoría
              lactanciaRange: '',
              estadioGestacion: '',
              customRacionKgDia: null,
            })
          }}
        >
          <option value="">— Seleccionar estado fisiológico —</option>
          {PHYSIO_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.cats.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'RECRIA_VAQUILLONA' ? 'Vaquillona'
                    : cat === 'RECRIA_NOVILLO' ? 'Novillo'
                    : PHYSIO_LABEL[cat]}
                  {' · EV ref. '}{PHYSIO_EV_BASE[cat].toFixed(2)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* ── Inputs condicionales ── */}
      {physioCategory && (
        <div className="space-y-3">

          {/* PESO — Siempre visible cuando hay categoría */}
          {showPeso && (
            <div className="space-y-1.5">
              <label className={`${LABEL} flex items-center gap-1.5`}>
                <Scale className="w-3 h-3 text-gray-400" />
                {showLactancia ? 'Peso de la madre (kg)' : 'Peso promedio (kg)'}
              </label>
              <input
                type="number"
                min="50"
                max="900"
                step="5"
                inputMode="numeric"
                className={INPUT}
                value={pesoKg}
                onChange={e => onChange({ pesoKg: e.target.value === '' ? '' : Number(e.target.value) })}
                onFocus={e => e.target.select()}
                placeholder="Ej: 400"
              />
              {showMantenimiento && (
                <p className="text-[10px] text-green-700/70 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  ADPV asumido 0 — mantenimiento (sin crecimiento)
                </p>
              )}
            </div>
          )}

          {/* LACTANCIA — Solo para VACA_CON_TERNERO */}
          {showLactancia && (
            <div className="space-y-1.5">
              <label className={LABEL}>Meses de lactancia</label>
              <select
                className={SELECT}
                value={lactanciaRange}
                onChange={e => onChange({ lactanciaRange: e.target.value as LactanciaRange })}
              >
                <option value="">— Seleccionar período —</option>
                {LACTANCIA_RANGES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* GESTACIÓN — Solo para VACA_PRENADA */}
          {showGestacion && (
            <div className="space-y-1.5">
              <label className={LABEL}>Estadio de gestación</label>
              <select
                className={SELECT}
                value={estadioGestacion}
                onChange={e => onChange({ estadioGestacion: e.target.value as EstadioGestacion })}
              >
                <option value="">— Seleccionar mes —</option>
                {ESTADIOS_GESTACION.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* ADPV — Para recría, novillos, toros */}
          {showADPV && (
            <div className="space-y-1.5">
              <label className={`${LABEL} flex items-center gap-1.5`}>
                <TrendingUp className="w-3 h-3 text-teal-500" />
                ADPV (kg/día)
                <Tooltip text={ADPV_TOOLTIP} />
              </label>
              <input
                type="number"
                step="0.05"
                min="-0.2"
                max="1.5"
                inputMode="decimal"
                className={INPUT}
                value={adpvKgDay}
                onChange={e => onChange({ adpvKgDay: e.target.value === '' ? '' : Number(e.target.value) })}
                onFocus={e => e.target.select()}
                placeholder="ej: 0.500"
              />
              <p className="text-[10px] text-gray-500">
                Aumento Diario de Peso Vivo · Rango típico: 0.300–0.800 kg/día
              </p>
            </div>
          )}

          {/* Fecha último pesaje — opcional */}
          {showLastWeighDate && (
            <div className="space-y-1.5">
              <label className={`${LABEL} flex items-center gap-1.5`}>
                <Calendar className="w-3 h-3 text-gray-400" />
                Último pesaje real
              </label>
              <input
                type="date"
                className={INPUT}
                value={lastWeighDate}
                onChange={e => onChange({ lastWeighDate: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Tarjeta de Resultados (reactiva) ── */}
      {evResult && physioCategory && (
        <div className="rounded-xl border border-green-200 bg-white shadow-sm overflow-hidden">
          {/* Header de la tarjeta */}
          <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <p className="text-[10px] font-black text-green-700 tracking-widest uppercase">
                Resultado EV Cocimano
              </p>
            </div>
            <span className="text-[9px] bg-teal-100 text-teal-700 font-black px-2 py-0.5 rounded-full tracking-wide uppercase">
              {evResult.descripcion.split('·')[0].trim()}
            </span>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* EV Unitario + Total */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">EV unitario</p>
                <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                  {evResult.evUnitario.toFixed(2)}
                  <span className="text-xs font-normal text-gray-400 ml-1">EV/cab</span>
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">EV total lote</p>
                <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                  {evResult.evTotal.toFixed(1)}
                  <span className="text-xs font-normal text-gray-400 ml-1">EV</span>
                </p>
              </div>
            </div>

            {/* Fórmula visual */}
            <p className="text-[10px] text-gray-500 font-mono">
              {evResult.evUnitario.toFixed(2)} EV × {cabezas} cab = <strong>{evResult.evTotal.toFixed(1)} EV</strong>
            </p>

            {/* ── Ración Diaria Editable ── */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">
                  Ración ideal / día
                </p>
                <Tooltip text="Kilogramos de Materia Seca por cabeza por día. El valor sugerido varía según el estado fisiológico y la energía metabolizable requerida. Podés ajustarlo según tu planificación." />
                {customRacionKgDia !== null && (
                  <button
                    type="button"
                    onClick={handleResetRacion}
                    className="ml-auto text-[9px] text-amber-600 font-bold hover:text-amber-700 underline transition-colors"
                  >
                    Restablecer sugerida ({racionSugeridaDefault} kg)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="30"
                    inputMode="decimal"
                    className="w-full bg-white border-2 border-emerald-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                    value={customRacionKgDia ?? racionSugeridaDefault}
                    onChange={e => handleRacionChange(e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">
                    kg MS/día/cab
                  </span>
                </div>
                {customRacionKgDia === null && (
                  <span className="text-[9px] text-emerald-600 font-bold shrink-0 bg-emerald-50 px-2 py-1 rounded-lg">
                    Sugerida
                  </span>
                )}
              </div>

              {/* Consumo Total del Rodeo */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  Consumo total del rodeo
                </p>
                <p className="text-sm font-black text-emerald-800 tabular-nums">
                  {evResult.consumoTotalKgDia.toLocaleString('es-AR')}
                  <span className="text-[10px] font-normal text-emerald-600 ml-1">kg MS/día</span>
                </p>
              </div>
              <p className="text-[9px] text-gray-400">
                {(customRacionKgDia ?? racionSugeridaDefault).toFixed(1)} kg × {cabezas} cab = {evResult.consumoTotalKgDia.toLocaleString('es-AR')} kg MS/día
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder cuando aún no hay datos suficientes */}
      {physioCategory && (!pesoKg || Number(pesoKg) <= 0) && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 font-medium">
            Ingresá el peso para calcular el EV exacto según las tablas Cocimano
          </p>
        </div>
      )}
    </div>
  )
}
