'use client'

/**
 * HerdFormFields — Formulario unificado de alta de rodeos (v1)
 * ─────────────────────────────────────────────────────────────────────────
 * Single Source of Truth para el formulario de alta de rodeos en:
 *   1. Onboarding (Step3Herds)
 *   2. Sección Rodeos (HerdModal — Tab Datos Operativos)
 *   3. Planificador (animales temporarios)
 *
 * Lógica de EV: calcularEVRodeo() — tablas Cocimano/INTA (evMatrix.ts)
 * Peso precargado: PHYSIO_PESO_DEFAULT por categoría fisiológica
 * Categoría comercial: derivada automáticamente con physioToComercial()
 */

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scale, Hash, ChevronDown, ChevronRight, Calendar, Info, Leaf } from 'lucide-react'
import {
  PHYSIO_PESO_DEFAULT,
  physioToComercial,
  PHYSIOLOGICAL_CATEGORIES,
  PHYSIO_LABEL,
  PHYSIO_EV_BASE,
  type PhysiologicalCategory,
} from '@/lib/grazing/evProjection'
import { calcularEVRodeo } from '@/lib/grazing/evMatrix'
import { RAZAS_POR_CATEGORIA } from '@/lib/categorias'

// ── Tipos públicos ───────────────────────────────────────────────────────────────────

export interface HerdFormValue {
  name: string
  physioCategory: PhysiologicalCategory | ''
  weightKg: number | ''
  count: number | ''
  breed: string
  ageMonths: number | ''
  entryDate?: string
  exitDate?: string
}

export interface HerdFormFieldsProps {
  value: HerdFormValue
  onChange: (v: HerdFormValue) => void
  /** Modo compacto: menos padding, texto más pequeño (para el Planificador) */
  compact?: boolean
  /** Mostrar campo Nombre (false en contextos donde el nombre va aparte) */
  showName?: boolean
  /** Mostrar fechas de entrada/salida (para animales temporarios del Planificador) */
  showDates?: boolean
}

// ── Configuración visual de categorías ────────────────────────────────────────────

const PHYSIO_GROUP: { label: string; cats: PhysiologicalCategory[] }[] = [
  {
    label: 'Vacas',
    cats: ['VACA_CON_TERNERO', 'VACA_PRENADA', 'VACA_VACIA'],
  },
  {
    label: 'Recría / Crecimiento',
    cats: ['TERNERO', 'NOVILLITO', 'RECRIA_NOVILLO', 'RECRIA_VAQUILLONA'],
  },
  {
    label: 'Toros',
    cats: ['TORO_DESCANSO', 'TORO_SERVICIO'],
  },
]

const PHYSIO_SHORT: Record<PhysiologicalCategory, string> = {
  VACA_CON_TERNERO:  'Con ternero al pie',
  VACA_PRENADA:      'Vaca preñada',
  VACA_VACIA:        'Vaca vacía',
  VACA_SECA:         'Vaca seca',   // mantenido por compatibilidad tipado
  TERNERO:           'Ternero/a',
  NOVILLITO:         'Novillito',
  RECRIA_NOVILLO:    'Novillo',
  RECRIA_VAQUILLONA: 'Vaquillona',
  TORO_DESCANSO:     'Toro en descanso',
  TORO_SERVICIO:     'Toro en servicio',
}

const LABEL = 'text-[10px] font-black text-gray-600 tracking-wider uppercase'

// ── Componente principal ────────────────────────────────────────────────────────────────

export default function HerdFormFields({
  value,
  onChange,
  compact = false,
  showName = true,
  showDates = false,
}: HerdFormFieldsProps) {
  const [showOptional, setShowOptional] = useState(false)

  // Actualiza un campo y emite onChange
  const set = <K extends keyof HerdFormValue>(key: K, val: HerdFormValue[K]) =>
    onChange({ ...value, [key]: val })

  // Al cambiar la categoría fisiológica, precargar el peso
  const handlePhysioChange = (cat: PhysiologicalCategory) => {
    const defaultWeight = PHYSIO_PESO_DEFAULT[cat] ?? 400
    onChange({
      ...value,
      physioCategory: cat,
      // Solo precargar si está vacío o es la primera selección
      weightKg: value.physioCategory === '' || value.physioCategory !== cat
        ? defaultWeight
        : value.weightKg,
    })
  }

  // Razas disponibles según la categoría comercial derivada
  const availableBreeds = useMemo(() => {
    if (!value.physioCategory) return ['Otra']
    const comercial = physioToComercial(value.physioCategory)
    return RAZAS_POR_CATEGORIA[comercial] ?? ['Otra']
  }, [value.physioCategory])

  // Cálculo EV en tiempo real — tablas Cocimano
  const evResult = useMemo(() => {
    const count = Number(value.count) || 0
    const weight = Number(value.weightKg) || 0
    if (!value.physioCategory || count <= 0 || weight <= 0) return null
    return calcularEVRodeo(
      {
        categoria: value.physioCategory,
        pesoKg: weight,
        adpvKgDay: 0,
        lactanciaRange: null,
        estadioGestacion: null,
      },
      count,
    )
  }, [value.physioCategory, value.count, value.weightKg])

  const px = compact ? 'px-3 py-2.5' : 'px-3.5 py-3'
  const inputCls = `w-full bg-white border-2 border-gray-200 rounded-xl ${px} text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`

  return (
    <div className={`space-y-${compact ? '3' : '4'}`}>

      {/* ── Nombre ── */}
      {showName && (
        <div className="space-y-1.5">
          <label className={LABEL}>Nombre del Rodeo</label>
          <input
            type="text"
            id="herd-name"
            value={value.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ej: Recría Norte, Vientres 1..."
            className={inputCls}
          />
        </div>
      )}

      {/* ── Categoría fisiológica (selector en grupos) ── */}
      <div className="space-y-2">
        <label className={LABEL}>Categoría</label>
        <div className="space-y-2.5">
          {PHYSIO_GROUP.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.cats.map(cat => {
                  const selected = value.physioCategory === cat
                  const evBase = PHYSIO_EV_BASE[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      id={`herd-cat-${cat.toLowerCase()}`}
                      onClick={() => handlePhysioChange(cat)}
                      className={`w-full text-left rounded-xl border-2 transition-all ${
                        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
                      } ${
                        selected
                          ? 'border-green-500 bg-green-50 shadow-sm shadow-green-500/10'
                          : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-bold leading-tight ${
                          selected ? 'text-green-800' : 'text-gray-700'
                        }`}>
                          {PHYSIO_SHORT[cat]}
                        </span>
                        {selected && (
                          <span className="text-[9px] font-black text-green-600 shrink-0">
                            {evBase.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {selected && (
                        <p className={`text-[9px] font-normal mt-0.5 ${
                          selected ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {PHYSIO_LABEL[cat]}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Peso + Cantidad (aparecen tras elegir categoría) ── */}
      <AnimatePresence>
        {value.physioCategory && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              {/* Peso */}
              <div className="space-y-1.5">
                <label className={`${LABEL} flex items-center gap-1`}>
                  <Scale className="w-3 h-3 text-gray-400" />
                  Peso prom. (kg)
                </label>
                <input
                  id="herd-weight"
                  type="number"
                  min="1"
                  value={value.weightKg}
                  onChange={e => set('weightKg', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={String(PHYSIO_PESO_DEFAULT[value.physioCategory] ?? 400)}
                  className={inputCls}
                />
                <p className="text-[9px] text-gray-400">
                  Ref: {PHYSIO_PESO_DEFAULT[value.physioCategory]} kg
                </p>
              </div>

              {/* Cantidad */}
              <div className="space-y-1.5">
                <label className={`${LABEL} flex items-center gap-1`}>
                  <Hash className="w-3 h-3 text-gray-400" />
                  Cabezas
                </label>
                <input
                  id="herd-count"
                  type="number"
                  min="1"
                  value={value.count}
                  onChange={e => set('count', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Cant."
                  className={inputCls}
                />
              </div>
            </div>

            {/* ── EV en tiempo real ── */}
            {evResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-2 gap-2"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
                  <Scale className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">EV Total</p>
                    <p className="text-base font-black text-green-700 leading-none">
                      {evResult.evTotal.toFixed(1)}
                      <span className="text-[9px] font-normal ml-1">EV</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">MS/día</p>
                    <p className="text-base font-black text-emerald-700 leading-none">
                      {evResult.consumoTotalKgDia.toFixed(0)}
                      <span className="text-[9px] font-normal ml-1">kg</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Fechas (solo para temporarios) ── */}
            {showDates && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`${LABEL} flex items-center gap-1`}>
                    <Calendar className="w-3 h-3 text-gray-400" />
                    Fecha ingreso
                  </label>
                  <input
                    id="herd-entry-date"
                    type="date"
                    value={value.entryDate ?? ''}
                    onChange={e => set('entryDate', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`${LABEL} flex items-center gap-1`}>
                    <Calendar className="w-3 h-3 text-gray-400" />
                    Fecha egreso
                  </label>
                  <input
                    id="herd-exit-date"
                    type="date"
                    value={value.exitDate ?? ''}
                    onChange={e => set('exitDate', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* ── Campos opcionales (Raza + Edad) ── */}
            <div>
              <button
                type="button"
                onClick={() => setShowOptional(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showOptional
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />}
                {showOptional ? 'Ocultar' : 'Raza y edad (opcional)'}
              </button>

              <AnimatePresence>
                {showOptional && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {/* Raza */}
                      <div className="space-y-1.5">
                        <label className={LABEL}>Raza</label>
                        <select
                          id="herd-breed"
                          value={value.breed}
                          onChange={e => set('breed', e.target.value)}
                          className={inputCls}
                        >
                          <option value="">Sin especificar</option>
                          {availableBreeds.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          {value.breed && !availableBreeds.includes(value.breed) && (
                            <option value={value.breed}>{value.breed}</option>
                          )}
                        </select>
                      </div>

                      {/* Edad en meses */}
                      <div className="space-y-1.5">
                        <label className={`${LABEL} flex items-center gap-1`}>
                          Edad (meses)
                          <span className="font-normal normal-case text-gray-300">opt.</span>
                        </label>
                        <input
                          id="herd-age-months"
                          type="number"
                          min="0"
                          value={value.ageMonths}
                          onChange={e => set('ageMonths', e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ej: 12"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint cuando no se seleccionó categoría */}
      {!value.physioCategory && (
        <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-400 font-normal leading-relaxed">
            Selecioná la categoría para ver el peso de referencia y el EV calculado automáticamente.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Calcula el EV total de un lote usando las tablas Cocimano.
 * Exportado para uso en addHerd() de onboarding y en el Planificador.
 */
export function calcHerdEV(
  physioCategory: PhysiologicalCategory | '',
  weightKg: number | '',
  count: number | '',
): number {
  if (!physioCategory || !count || Number(count) <= 0) return 0
  const weight = Number(weightKg) || PHYSIO_PESO_DEFAULT[physioCategory] || 400
  const result = calcularEVRodeo(
    { categoria: physioCategory, pesoKg: weight, adpvKgDay: 0, lactanciaRange: null, estadioGestacion: null },
    Number(count),
  )
  return result.evTotal
}
