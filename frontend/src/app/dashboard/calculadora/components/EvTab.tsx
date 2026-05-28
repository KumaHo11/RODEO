'use client'
/**
 * EvTab.tsx — Calculadora de equivalentes vaca
 * ────────────────────────────────────────────
 * • Multi-selección de categorías con inputs inline
 * • Sumatoria de EV por rodeo compuesto
 * • 5 especies: Bovinos, Equinos, Ovinos, Caprinos, Bubalinos
 * • Cálculo exacto Cocimano para bovinos; fórmula alométrica para el resto
 */
import React, { useState, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import { Plus, X, TrendingUp, Info, Leaf } from 'lucide-react'
import {
  calcularEVRodeo,
  LACTANCIA_RANGES,
  ESTADIOS_GESTACION,
  RATION_SUGERIDA_POR_CATEGORIA,
  type LactanciaRange,
  type EstadioGestacion,
} from '@/lib/grazing/evMatrix'

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

type Especie = 'Bovinos' | 'Equinos' | 'Ovinos' | 'Caprinos' | 'Bubalinos'

interface CategoriaDef {
  id: string
  label: string
  /** Texto de referencia que aparece debajo del nombre */
  refDesc: string
  /** EV de referencia para la etiqueta visual */
  evBase: number
  /** Grupo al que pertenece (para agrupar en la lista) */
  grupo: string
  /** Peso por defecto cuando se activa */
  pesoDefault: number
  pesoMin: number
  pesoMax: number
  /** Si requiere ADPV (crecimiento activo) */
  showADPV: boolean
  /** Si requiere meses de edad (terneros/crías jóvenes) */
  showMeses: boolean
  mesesDefault?: number
  mesesMin?: number
  mesesMax?: number
  mesesLabel?: string
  /** Si requiere período de lactancia */
  showLactancia: boolean
  /** Si requiere estadio de gestación */
  showGestacion: boolean
  /**
   * Para bovinos: ID de categoría Cocimano para cálculo exacto.
   * Para otras especies: usar `coefFijo` y `pesoRef`.
   */
  cocimanoId?: string
  /** Para especies sin tabla Cocimano: coef base y peso de referencia */
  coefFijo?: number
  pesoRef?: number
}

interface LoteState {
  enabled: boolean
  cabezas: number
  pesoKg: number
  adpvKgDay: number
  mesesEdad: number
  lactanciaRange: LactanciaRange | ''
  estadioGestacion: EstadioGestacion | ''
}

// ────────────────────────────────────────────────────────────────────────────
// Definición de categorías por especie
// ────────────────────────────────────────────────────────────────────────────

const CATEGORIAS: Record<Especie, CategoriaDef[]> = {
  Bovinos: [
    {
      id: 'VACA_VACIA', label: 'Vaca vacía',
      refDesc: 'Peso de referencia: 350–500 kg · Mantenimiento',
      evBase: 0.73, grupo: 'Vacas',
      pesoDefault: 400, pesoMin: 280, pesoMax: 600,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      cocimanoId: 'VACA_VACIA',
    },
    {
      id: 'VACA_PRENADA', label: 'Vaca preñada',
      refDesc: 'Peso de referencia: 350–500 kg · 6.º al 9.º mes de gestación',
      evBase: 0.91, grupo: 'Vacas',
      pesoDefault: 420, pesoMin: 280, pesoMax: 600,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: true,
      cocimanoId: 'VACA_PRENADA',
    },
    {
      id: 'VACA_CON_TERNERO', label: 'Vaca con ternero al pie',
      refDesc: 'Peso de referencia: 350–500 kg · Lactancia',
      evBase: 1.18, grupo: 'Vacas',
      pesoDefault: 400, pesoMin: 280, pesoMax: 600,
      showADPV: false, showMeses: false, showLactancia: true, showGestacion: false,
      cocimanoId: 'VACA_CON_TERNERO',
    },
    {
      id: 'TERNERO', label: 'Ternero/a',
      refDesc: 'Post destete hasta los 12 meses · 160–220 kg',
      evBase: 0.54, grupo: 'Recría / crecimiento',
      pesoDefault: 180, pesoMin: 80, pesoMax: 230,
      showADPV: true, showMeses: true,
      mesesDefault: 6, mesesMin: 0, mesesMax: 12, mesesLabel: 'Edad en meses',
      showLactancia: false, showGestacion: false,
      cocimanoId: 'TERNERO',
    },
    {
      id: 'NOVILLITO', label: 'Novillito',
      refDesc: 'De 12 a 24 meses · 240–340 kg',
      evBase: 0.60, grupo: 'Recría / crecimiento',
      pesoDefault: 280, pesoMin: 200, pesoMax: 360,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      cocimanoId: 'RECRIA_NOVILLO',
    },
    {
      id: 'NOVILLO', label: 'Novillo',
      refDesc: 'Desde los 24 meses · 400–480 kg',
      evBase: 0.73, grupo: 'Recría / crecimiento',
      pesoDefault: 430, pesoMin: 350, pesoMax: 560,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      cocimanoId: 'RECRIA_NOVILLO',
    },
    {
      id: 'VAQUILLONA', label: 'Vaquillona',
      refDesc: 'De 12 a 24 meses · 260–330 kg',
      evBase: 0.60, grupo: 'Recría / crecimiento',
      pesoDefault: 290, pesoMin: 200, pesoMax: 380,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      cocimanoId: 'RECRIA_VAQUILLONA',
    },
    {
      id: 'TORO_DESCANSO', label: 'Toro en descanso',
      refDesc: 'Peso de referencia: 600–800 kg · Mantenimiento',
      evBase: 0.98, grupo: 'Toros',
      pesoDefault: 650, pesoMin: 500, pesoMax: 900,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      cocimanoId: 'TORO_DESCANSO',
    },
    {
      id: 'TORO_SERVICIO', label: 'Toro en servicio',
      refDesc: 'Peso de referencia: 600–800 kg · Período de entore',
      evBase: 1.32, grupo: 'Toros',
      pesoDefault: 650, pesoMin: 500, pesoMax: 900,
      showADPV: true, showMeses: false, showLactancia: false, showGestacion: false,
      cocimanoId: 'TORO_SERVICIO',
    },
  ],

  Equinos: [
    {
      id: 'YEGUA_VACIA', label: 'Yegua vacía',
      refDesc: 'Peso de referencia: 400–550 kg · Mantenimiento',
      evBase: 1.25, grupo: 'Hembras adultas',
      pesoDefault: 480, pesoMin: 350, pesoMax: 650,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.25, pesoRef: 500,
    },
    {
      id: 'YEGUA_PRENADA', label: 'Yegua preñada',
      refDesc: 'Peso de referencia: 400–550 kg · Gestación tardía',
      evBase: 1.40, grupo: 'Hembras adultas',
      pesoDefault: 480, pesoMin: 350, pesoMax: 650,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.40, pesoRef: 500,
    },
    {
      id: 'YEGUA_CON_POTRILLO', label: 'Yegua con potrillo al pie',
      refDesc: 'Peso de referencia: 400–550 kg · Lactancia',
      evBase: 1.60, grupo: 'Hembras adultas',
      pesoDefault: 460, pesoMin: 350, pesoMax: 650,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.60, pesoRef: 500,
    },
    {
      id: 'POTRILLO', label: 'Potrillo/a',
      refDesc: 'Post destete hasta los 12 meses · 160–280 kg',
      evBase: 0.65, grupo: 'Recría',
      pesoDefault: 200, pesoMin: 80, pesoMax: 300,
      showADPV: true, showMeses: true,
      mesesDefault: 6, mesesMin: 0, mesesMax: 12, mesesLabel: 'Edad en meses',
      showLactancia: false, showGestacion: false,
      coefFijo: 0.65, pesoRef: 220,
    },
    {
      id: 'POTRO_JOVEN', label: 'Potro/a joven',
      refDesc: 'De 12 a 36 meses · 280–420 kg',
      evBase: 0.90, grupo: 'Recría',
      pesoDefault: 340, pesoMin: 250, pesoMax: 450,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      coefFijo: 0.90, pesoRef: 350,
    },
    {
      id: 'PADRILLO_DESCANSO', label: 'Padrillo en descanso',
      refDesc: 'Peso de referencia: 500–700 kg · Mantenimiento',
      evBase: 1.50, grupo: 'Padrillo',
      pesoDefault: 580, pesoMin: 450, pesoMax: 750,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.50, pesoRef: 580,
    },
    {
      id: 'PADRILLO_SERVICIO', label: 'Padrillo en servicio',
      refDesc: 'Peso de referencia: 500–700 kg · Período de cubrición',
      evBase: 1.90, grupo: 'Padrillo',
      pesoDefault: 580, pesoMin: 450, pesoMax: 750,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.90, pesoRef: 580,
    },
  ],

  Ovinos: [
    {
      id: 'OVEJA_VACIA', label: 'Oveja vacía',
      refDesc: 'Peso de referencia: 45–75 kg · Mantenimiento',
      evBase: 0.13, grupo: 'Hembras adultas',
      pesoDefault: 60, pesoMin: 30, pesoMax: 100,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.13, pesoRef: 65,
    },
    {
      id: 'OVEJA_PRENADA', label: 'Oveja preñada',
      refDesc: 'Peso de referencia: 45–75 kg · Gestación tardía',
      evBase: 0.15, grupo: 'Hembras adultas',
      pesoDefault: 62, pesoMin: 30, pesoMax: 100,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.15, pesoRef: 65,
    },
    {
      id: 'OVEJA_CON_CORDERO', label: 'Oveja con cordero al pie',
      refDesc: 'Peso de referencia: 45–75 kg · Lactancia',
      evBase: 0.18, grupo: 'Hembras adultas',
      pesoDefault: 58, pesoMin: 30, pesoMax: 100,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.18, pesoRef: 65,
    },
    {
      id: 'CORDERO', label: 'Cordero/a',
      refDesc: 'Post destete hasta los 6 meses · 15–35 kg',
      evBase: 0.08, grupo: 'Recría',
      pesoDefault: 22, pesoMin: 8, pesoMax: 40,
      showADPV: true, showMeses: true,
      mesesDefault: 3, mesesMin: 0, mesesMax: 6, mesesLabel: 'Edad en meses',
      showLactancia: false, showGestacion: false,
      coefFijo: 0.08, pesoRef: 25,
    },
    {
      id: 'BORREGO', label: 'Borrego/a',
      refDesc: 'De 6 a 18 meses · 35–55 kg',
      evBase: 0.10, grupo: 'Recría',
      pesoDefault: 42, pesoMin: 28, pesoMax: 65,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      coefFijo: 0.10, pesoRef: 45,
    },
    {
      id: 'CARNERO_DESCANSO', label: 'Carnero en descanso',
      refDesc: 'Peso de referencia: 70–100 kg · Mantenimiento',
      evBase: 0.16, grupo: 'Machos',
      pesoDefault: 85, pesoMin: 55, pesoMax: 120,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.16, pesoRef: 85,
    },
    {
      id: 'CARNERO_SERVICIO', label: 'Carnero en servicio',
      refDesc: 'Peso de referencia: 70–100 kg · Período de encarnerada',
      evBase: 0.19, grupo: 'Machos',
      pesoDefault: 85, pesoMin: 55, pesoMax: 120,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.19, pesoRef: 85,
    },
  ],

  Caprinos: [
    {
      id: 'CABRA_VACIA', label: 'Cabra vacía',
      refDesc: 'Peso de referencia: 35–65 kg · Mantenimiento',
      evBase: 0.12, grupo: 'Hembras adultas',
      pesoDefault: 48, pesoMin: 20, pesoMax: 80,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.12, pesoRef: 50,
    },
    {
      id: 'CABRA_PRENADA', label: 'Cabra preñada',
      refDesc: 'Peso de referencia: 35–65 kg · Gestación tardía',
      evBase: 0.14, grupo: 'Hembras adultas',
      pesoDefault: 50, pesoMin: 20, pesoMax: 80,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.14, pesoRef: 50,
    },
    {
      id: 'CABRA_CON_CABRITO', label: 'Cabra con cabrito al pie',
      refDesc: 'Peso de referencia: 35–65 kg · Lactancia',
      evBase: 0.17, grupo: 'Hembras adultas',
      pesoDefault: 46, pesoMin: 20, pesoMax: 80,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.17, pesoRef: 50,
    },
    {
      id: 'CABRITO', label: 'Cabrito/a',
      refDesc: 'Post destete hasta los 6 meses · 8–25 kg',
      evBase: 0.06, grupo: 'Recría',
      pesoDefault: 14, pesoMin: 4, pesoMax: 30,
      showADPV: true, showMeses: true,
      mesesDefault: 3, mesesMin: 0, mesesMax: 6, mesesLabel: 'Edad en meses',
      showLactancia: false, showGestacion: false,
      coefFijo: 0.06, pesoRef: 15,
    },
    {
      id: 'CHIVO_JOVEN', label: 'Chivo/a joven',
      refDesc: 'De 6 a 18 meses · 25–45 kg',
      evBase: 0.09, grupo: 'Recría',
      pesoDefault: 33, pesoMin: 20, pesoMax: 55,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      coefFijo: 0.09, pesoRef: 35,
    },
    {
      id: 'MACHO_CABRIO_DESCANSO', label: 'Macho cabrío en descanso',
      refDesc: 'Peso de referencia: 60–90 kg · Mantenimiento',
      evBase: 0.15, grupo: 'Machos',
      pesoDefault: 70, pesoMin: 45, pesoMax: 100,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.15, pesoRef: 70,
    },
    {
      id: 'MACHO_CABRIO_SERVICIO', label: 'Macho cabrío en servicio',
      refDesc: 'Peso de referencia: 60–90 kg · Período de encaste',
      evBase: 0.18, grupo: 'Machos',
      pesoDefault: 70, pesoMin: 45, pesoMax: 100,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 0.18, pesoRef: 70,
    },
  ],

  Bubalinos: [
    {
      id: 'BUFALA_VACIA', label: 'Búfala vacía',
      refDesc: 'Peso de referencia: 400–600 kg · Mantenimiento',
      evBase: 1.10, grupo: 'Hembras adultas',
      pesoDefault: 490, pesoMin: 350, pesoMax: 700,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.10, pesoRef: 500,
    },
    {
      id: 'BUFALA_PRENADA', label: 'Búfala preñada',
      refDesc: 'Peso de referencia: 400–600 kg · Gestación tardía',
      evBase: 1.25, grupo: 'Hembras adultas',
      pesoDefault: 510, pesoMin: 350, pesoMax: 700,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.25, pesoRef: 500,
    },
    {
      id: 'BUFALA_CON_CRIA', label: 'Búfala con cría al pie',
      refDesc: 'Peso de referencia: 400–600 kg · Lactancia',
      evBase: 1.45, grupo: 'Hembras adultas',
      pesoDefault: 480, pesoMin: 350, pesoMax: 700,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.45, pesoRef: 500,
    },
    {
      id: 'CRIA_BUBALINA', label: 'Cría bubalina',
      refDesc: 'Post destete hasta los 12 meses · 140–280 kg',
      evBase: 0.55, grupo: 'Recría',
      pesoDefault: 180, pesoMin: 80, pesoMax: 300,
      showADPV: true, showMeses: true,
      mesesDefault: 6, mesesMin: 0, mesesMax: 12, mesesLabel: 'Edad en meses',
      showLactancia: false, showGestacion: false,
      coefFijo: 0.55, pesoRef: 200,
    },
    {
      id: 'BUFALO_JOVEN', label: 'Búfalo/a joven',
      refDesc: 'De 12 a 24 meses · 280–430 kg',
      evBase: 0.85, grupo: 'Recría',
      pesoDefault: 340, pesoMin: 250, pesoMax: 460,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      coefFijo: 0.85, pesoRef: 350,
    },
    {
      id: 'BUFALO_ADULTO', label: 'Búfalo adulto',
      refDesc: 'Desde los 24 meses · 430–650 kg',
      evBase: 1.00, grupo: 'Recría',
      pesoDefault: 500, pesoMin: 400, pesoMax: 700,
      showADPV: true, showMeses: false,
      showLactancia: false, showGestacion: false,
      coefFijo: 1.00, pesoRef: 500,
    },
    {
      id: 'TORO_BUFALO_DESCANSO', label: 'Toro búfalo en descanso',
      refDesc: 'Peso de referencia: 600–900 kg · Mantenimiento',
      evBase: 1.35, grupo: 'Machos reproductores',
      pesoDefault: 720, pesoMin: 550, pesoMax: 950,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.35, pesoRef: 700,
    },
    {
      id: 'TORO_BUFALO_SERVICIO', label: 'Toro búfalo en servicio',
      refDesc: 'Peso de referencia: 600–900 kg · Período de cubrición',
      evBase: 1.60, grupo: 'Machos reproductores',
      pesoDefault: 720, pesoMin: 550, pesoMax: 950,
      showADPV: false, showMeses: false, showLactancia: false, showGestacion: false,
      coefFijo: 1.60, pesoRef: 700,
    },
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Cálculo alométrico para especies sin tabla Cocimano */
function calcularEVSimple(
  cat: CategoriaDef,
  pesoKg: number,
  cabezas: number,
): number {
  const coef = cat.coefFijo ?? cat.evBase
  const ref  = cat.pesoRef ?? pesoKg
  const ev   = coef * Math.pow(pesoKg / ref, 0.75)
  return parseFloat((ev * cabezas).toFixed(2))
}

function loteDefault(cat: CategoriaDef): LoteState {
  return {
    enabled: false,
    cabezas: 50,
    pesoKg: cat.pesoDefault,
    adpvKgDay: 0.5,
    mesesEdad: cat.mesesDefault ?? 6,
    lactanciaRange: cat.showLactancia ? '3-4' : '',
    estadioGestacion: cat.showGestacion ? '8' : '',
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponente: input numérico estilizado
// ────────────────────────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, unit, step = 1, min, max, tooltip,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
  step?: number
  min?: number
  max?: number
  tooltip?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-gray-500 font-semibold block tracking-wide">{label}</label>
        {tooltip && (
          <div className="relative group shrink-0">
            <Info className="w-3 h-3 text-gray-300 cursor-help" />
            <div className="absolute bottom-5 left-0 z-50 hidden group-hover:block w-64 bg-gray-800 text-white text-[10px] rounded-xl p-3 leading-relaxed shadow-xl whitespace-pre-wrap">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          value={isNaN(value) ? '' : value}
          step={step}
          min={min}
          max={max}
          inputMode="decimal"
          onFocus={e => e.target.select()}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all pr-10"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponente: tarjeta de categoría (expandible inline)
// ────────────────────────────────────────────────────────────────────────────

interface CatCardProps {
  cat: CategoriaDef
  especie: Especie
  lote: LoteState
  onChange: (patch: Partial<LoteState>) => void
}

function CatCard({ cat, especie, lote, onChange }: CatCardProps) {
  const { enabled } = lote

  // Calcular EV en tiempo real
  const evResult = useMemo(() => {
    if (!enabled || lote.cabezas <= 0 || lote.pesoKg <= 0) return null

    if (especie === 'Bovinos' && cat.cocimanoId) {
      try {
        return calcularEVRodeo(
          {
            categoria: cat.cocimanoId as any,
            pesoKg: lote.pesoKg,
            adpvKgDay: cat.showADPV ? lote.adpvKgDay : 0,
            lactanciaRange: cat.showLactancia ? (lote.lactanciaRange as LactanciaRange || null) : null,
            estadioGestacion: cat.showGestacion ? (lote.estadioGestacion as EstadioGestacion || null) : null,
          },
          lote.cabezas,
          null,
        )
      } catch {
        return null
      }
    }

    const evTotal = calcularEVSimple(cat, lote.pesoKg, lote.cabezas)
    const evUnitario = evTotal / lote.cabezas
    return {
      evUnitario,
      evTotal,
      consumoTotalKgDia: evTotal * 11,
      descripcion: cat.label,
      fuente: 'formula' as const,
    }
  }, [enabled, lote, especie, cat])

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all overflow-hidden',
        enabled
          ? 'border-green-200 bg-green-50/40 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200',
      )}
    >
      {/* ── Header de la tarjeta ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => onChange({ enabled: !enabled })}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onChange({ enabled: !enabled })}
        aria-expanded={enabled}
      >
        {/* Checkbox visual */}
        <div
          className={clsx(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
            enabled
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300',
          )}
        >
          {enabled && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm font-semibold leading-tight', enabled ? 'text-green-800' : 'text-gray-800')}>
            {cat.label}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{cat.refDesc}</p>
        </div>

        {/* EV badge */}
        <div className="text-right shrink-0">
          {evResult && enabled ? (
            <div>
              <p className="text-xs font-black text-green-700 tabular-nums">
                {evResult.evTotal.toFixed(1)} EV
              </p>
              <p className="text-[9px] text-gray-400">×{evResult.evUnitario.toFixed(3)}/cab.</p>
            </div>
          ) : (
            <p className={clsx('text-xs font-bold tabular-nums', enabled ? 'text-green-600' : 'text-gray-400')}>
              ×{cat.evBase.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* ── Inputs inline (solo cuando está activa) ── */}
      {enabled && (
        <div className="px-4 pb-4 pt-1 border-t border-green-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

            {/* Peso */}
            <NumInput
              label={cat.showLactancia ? 'Peso de la madre (kg)' : 'Peso promedio (kg)'}
              value={lote.pesoKg}
              onChange={v => onChange({ pesoKg: v })}
              unit="kg"
              step={5}
              min={cat.pesoMin}
              max={cat.pesoMax}
            />

            {/* Meses de edad (terneros/crías) */}
            {cat.showMeses && (
              <NumInput
                label={cat.mesesLabel ?? 'Edad en meses'}
                value={lote.mesesEdad}
                onChange={v => onChange({ mesesEdad: v })}
                unit="meses"
                step={1}
                min={cat.mesesMin}
                max={cat.mesesMax}
              />
            )}

            {/* Cabezas */}
            <NumInput
              label="Cabezas"
              value={lote.cabezas}
              onChange={v => onChange({ cabezas: v })}
              unit="cab."
              step={1}
              min={1}
            />

            {/* ADPV */}
            {cat.showADPV && (
              <NumInput
                label="ADPV (kg/día)"
                value={lote.adpvKgDay}
                onChange={v => onChange({ adpvKgDay: v })}
                unit="kg/d"
                step={0.05}
                min={-0.2}
                max={1.5}
                tooltip={`ADPV = Aumento Diario de Peso Vivo\nCuántos kg gana el animal por día.\nEjemplo: 0.500 kg/día (500 gramos).\nRango típico: 0.300–0.800 kg/día.`}
              />
            )}

            {/* Período de lactancia */}
            {cat.showLactancia && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold block tracking-wide">
                  Período de lactancia
                </label>
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
                  value={lote.lactanciaRange}
                  onChange={e => onChange({ lactanciaRange: e.target.value as LactanciaRange })}
                >
                  {LACTANCIA_RANGES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Estadio de gestación */}
            {cat.showGestacion && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold block tracking-wide">
                  Estadio de gestación
                </label>
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
                  value={lote.estadioGestacion}
                  onChange={e => onChange({ estadioGestacion: e.target.value as EstadioGestacion })}
                >
                  {ESTADIOS_GESTACION.map(e => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mini resultado por categoría */}
          {evResult && (
            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-green-100">
              <p className="text-[10px] text-gray-500 font-medium">
                {evResult.evUnitario.toFixed(3)} EV × {lote.cabezas} cab.
              </p>
              <p className="text-sm font-black text-green-700 tabular-nums">
                = {evResult.evTotal.toFixed(2)} EV
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────────────

const ESPECIES: Especie[] = ['Bovinos', 'Equinos', 'Ovinos', 'Caprinos', 'Bubalinos']

export function EvTab() {
  const [especie, setEspecie] = useState<Especie>('Bovinos')

  // Estado de lotes: Map de catId → LoteState (per especie)
  const [lotes, setLotes] = useState<Record<string, Record<string, LoteState>>>(() => {
    const init: Record<string, Record<string, LoteState>> = {}
    for (const [esp, cats] of Object.entries(CATEGORIAS)) {
      init[esp] = {}
      for (const cat of cats) {
        init[esp][cat.id] = loteDefault(cat)
      }
    }
    return init
  })

  // Ración global editable
  const [racionCustom, setRacionCustom] = useState<number | null>(null)

  const updateLote = useCallback((catId: string, patch: Partial<LoteState>) => {
    setLotes(prev => ({
      ...prev,
      [especie]: {
        ...prev[especie],
        [catId]: { ...prev[especie][catId], ...patch },
      },
    }))
  }, [especie])

  const lotesActuales = lotes[especie]
  const catsActuales  = CATEGORIAS[especie]

  // Calcular EV por categoría activa
  const lotesConEV = useMemo(() => {
    return catsActuales.map(cat => {
      const lote = lotesActuales[cat.id]
      if (!lote.enabled || lote.cabezas <= 0 || lote.pesoKg <= 0) {
        return { cat, lote, evTotal: 0, evUnitario: 0 }
      }

      let evTotal = 0
      let evUnitario = 0

      if (especie === 'Bovinos' && cat.cocimanoId) {
        try {
          const result = calcularEVRodeo(
            {
              categoria: cat.cocimanoId as any,
              pesoKg: lote.pesoKg,
              adpvKgDay: cat.showADPV ? lote.adpvKgDay : 0,
              lactanciaRange: cat.showLactancia ? (lote.lactanciaRange as LactanciaRange || null) : null,
              estadioGestacion: cat.showGestacion ? (lote.estadioGestacion as EstadioGestacion || null) : null,
            },
            lote.cabezas,
            null,
          )
          evTotal = result.evTotal
          evUnitario = result.evUnitario
        } catch {
          evTotal = calcularEVSimple(cat, lote.pesoKg, lote.cabezas)
          evUnitario = evTotal / lote.cabezas
        }
      } else {
        evTotal = calcularEVSimple(cat, lote.pesoKg, lote.cabezas)
        evUnitario = evTotal / lote.cabezas
      }

      return { cat, lote, evTotal, evUnitario }
    })
  }, [catsActuales, lotesActuales, especie])

  const evTotalRodeo    = lotesConEV.reduce((s, l) => s + l.evTotal, 0)
  const lotesActivos    = lotesConEV.filter(l => l.lote.enabled && l.evTotal > 0)
  const cabezasTotales  = lotesActivos.reduce((s, l) => s + l.lote.cabezas, 0)
  const racionFinal     = racionCustom ?? 12
  const consumoTotal    = parseFloat((evTotalRodeo * racionFinal).toFixed(1))

  // Agrupar categorías
  const grupos = useMemo(() => {
    const map: Record<string, CategoriaDef[]> = {}
    for (const cat of catsActuales) {
      if (!map[cat.grupo]) map[cat.grupo] = []
      map[cat.grupo].push(cat)
    }
    return map
  }, [catsActuales])

  // Limpiar selección al cambiar especie
  const handleEspecieChange = (esp: Especie) => {
    setEspecie(esp)
    setRacionCustom(null)
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* ── Selector de especie ── */}
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {ESPECIES.map(esp => (
          <button
            key={esp}
            onClick={() => handleEspecieChange(esp)}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all',
              especie === esp
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {esp}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5 items-start">

        {/* ── Lista de categorías ── */}
        <div className="space-y-6">

          {/* Indicación multi-selección */}
          <p className="text-[10px] text-gray-400 font-medium">
            Seleccioná una o más categorías para calcular el EV total del rodeo
          </p>

          {Object.entries(grupos).map(([grupo, cats]) => (
            <div key={grupo} className="space-y-2">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">
                {grupo}
              </p>
              {cats.map(cat => (
                <CatCard
                  key={cat.id}
                  cat={cat}
                  especie={especie}
                  lote={lotesActuales[cat.id]}
                  onChange={patch => updateLote(cat.id, patch)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ── Panel de resultados ── */}
        <div className="space-y-3 lg:sticky lg:top-4">

          {/* EV total — outline card (estilo HidricoTab) */}
          <div className="border border-gray-200 bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              EV total del rodeo
            </p>
            <p className="text-5xl font-black tabular-nums text-gray-900">
              {evTotalRodeo > 0 ? evTotalRodeo.toFixed(1) : '—'}
            </p>
            <p className="text-sm text-gray-400 mt-1">Equivalentes vaca</p>
            {cabezasTotales > 0 && (
              <p className="text-[10px] text-gray-400 mt-2">
                {cabezasTotales.toLocaleString('es-AR')} cabezas en total
              </p>
            )}
          </div>

          {/* Desglose por categoría */}
          {lotesActivos.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 pt-3 pb-2 border-b border-gray-50">
                Desglose por categoría
              </p>
              <div className="divide-y divide-gray-50">
                {lotesActivos.map(({ cat, lote, evTotal, evUnitario }) => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{cat.label}</p>
                      <p className="text-[10px] text-gray-400">
                        {lote.cabezas} cab. × ×{evUnitario.toFixed(3)}
                      </p>
                    </div>
                    <p className="text-sm font-black text-gray-900 tabular-nums ml-3 shrink-0">
                      {evTotal.toFixed(2)} EV
                    </p>
                  </div>
                ))}
              </div>
              {lotesActivos.length > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs font-black text-gray-600 uppercase tracking-wide">Total</p>
                  <p className="text-base font-black text-gray-900 tabular-nums">
                    {evTotalRodeo.toFixed(1)} EV
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Ración diaria editable */}
          {evTotalRodeo > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                  Ración / día
                </p>
                {racionCustom !== null && (
                  <button
                    type="button"
                    onClick={() => setRacionCustom(null)}
                    className="ml-auto text-[9px] text-amber-600 font-bold hover:text-amber-700 underline"
                  >
                    Restablecer (12 kg)
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={30}
                  inputMode="decimal"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all pr-20"
                  value={racionFinal}
                  onChange={e => setRacionCustom(parseFloat(e.target.value) || null)}
                  onFocus={e => e.target.select()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium pointer-events-none">
                  kg MS/cab/d
                </span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  Consumo total
                </p>
                <p className="text-sm font-black text-emerald-800 tabular-nums">
                  {consumoTotal.toLocaleString('es-AR')}
                  <span className="text-[10px] font-normal text-emerald-600 ml-1">kg MS/día</span>
                </p>
              </div>

              <p className="text-[9px] text-gray-400">
                {racionFinal} kg × {cabezasTotales} cab. = {consumoTotal.toLocaleString('es-AR')} kg MS/día
              </p>
            </div>
          )}

          {/* Estado vacío */}
          {lotesActivos.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                Sin categorías seleccionadas
              </p>
              <p className="text-[10px] text-gray-300 mt-1">
                Activá una o más categorías para ver el EV total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
