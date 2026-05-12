'use client'

import React, { useState } from 'react'
import clsx from 'clsx'
import type { CalculatorResult } from '../calculatorEngine'

interface ScenarioComparisonProps {
  scenarioA: { label: string; result: CalculatorResult }
  scenarioB: { label: string; result: CalculatorResult }
}

interface MetricRow {
  label: string
  key: keyof CalculatorResult
  unit: string
  decimals: number
  higherIsBetter: boolean
  tooltip: string
  group: string
}

const ROWS: MetricRow[] = [
  // Productividad
  {
    label: 'Autonomía forrajera',
    key: 'autonomiaDias',
    unit: 'días',
    decimals: 0,
    higherIsBetter: true,
    group: 'Productividad',
    tooltip: 'Días estimados hasta agotar el stock aprovechable al ritmo de consumo actual.',
  },
  {
    label: 'Carga diaria',
    key: 'cargaDiariaEvHa',
    unit: 'EV/ha',
    decimals: 2,
    higherIsBetter: false,
    group: 'Productividad',
    tooltip: 'Equivalentes vaca por hectárea. Mayor carga = mayor presión sobre el pastizal.',
  },
  {
    label: 'Día animal',
    key: 'diaAnimalKg',
    unit: 'kg MS/cab',
    decimals: 1,
    higherIsBetter: false,
    group: 'Productividad',
    tooltip: 'Materia seca consumida por cabeza por día, ajustada por la categoría y peso del rodeo.',
  },
  {
    label: 'Consumo diario total',
    key: 'consumoDiarioKg',
    unit: 'kg MS/día',
    decimals: 0,
    higherIsBetter: false,
    group: 'Productividad',
    tooltip: 'Total de materia seca que consume el rodeo completo en un día.',
  },
  // Forraje
  {
    label: 'Tasa de crecimiento',
    key: 'tasaCrecimientoKgHaDia',
    unit: 'kg MS/ha/día',
    decimals: 1,
    higherIsBetter: true,
    group: 'Forraje',
    tooltip: 'Velocidad de rebrote del pastizal según estación, clima y cobertura NDVI.',
  },
  {
    label: 'Balance neto',
    key: 'balanceNetoKgHaDia',
    unit: 'kg MS/ha/día',
    decimals: 1,
    higherIsBetter: true,
    group: 'Forraje',
    tooltip: 'Diferencia entre crecimiento y consumo por hectárea. Positivo = acumula forraje.',
  },
  {
    label: 'Stock aprovechable',
    key: 'stockAprovechableKg',
    unit: 'kg MS',
    decimals: 0,
    higherIsBetter: true,
    group: 'Forraje',
    tooltip: 'Materia seca disponible sobre el remanente mínimo, con eficiencia de cosecha del 60 %.',
  },
  // Clima
  {
    label: 'Precip. efectiva',
    key: 'precipEfectivaMm',
    unit: 'mm',
    decimals: 1,
    higherIsBetter: true,
    group: 'Clima',
    tooltip: 'Lluvia infiltrada en el suelo luego de descontar la escorrentía superficial según NDVI.',
  },
  {
    label: 'Balance hídrico',
    key: 'balanceHidricoMm',
    unit: 'mm',
    decimals: 1,
    higherIsBetter: true,
    group: 'Clima',
    tooltip: 'Precipitación efectiva menos evapotranspiración en el período de 7 días. Negativo = déficit.',
  },
  {
    label: 'Multiplicador climático',
    key: 'climateMultiplier',
    unit: '×',
    decimals: 3,
    higherIsBetter: true,
    group: 'Clima',
    tooltip: 'Coeficiente C_adj que ajusta la tasa de crecimiento base según NDVI, BH, temperatura y sequía.',
  },
]

function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative inline-flex ml-1"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 text-[9px] flex items-center justify-center cursor-help leading-none select-none">?</span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 bg-gray-800 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 z-50 pointer-events-none shadow-lg">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </span>
      )}
    </span>
  )
}

export function ScenarioComparison({ scenarioA, scenarioB }: ScenarioComparisonProps) {
  const groups = Array.from(new Set(ROWS.map(r => r.group)))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 w-48">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Métrica</span>
            </th>
            <th className="text-right py-2 px-4 min-w-[110px]">
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Escenario A</span>
                <span className="text-sm text-gray-700">{scenarioA.label}</span>
              </div>
            </th>
            <th className="text-right py-2 px-4 min-w-[110px]">
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Escenario B</span>
                <span className="text-sm text-gray-700">{scenarioB.label}</span>
              </div>
            </th>
            <th className="text-right py-2 pl-4 min-w-[80px]">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Diferencia</span>
            </th>
          </tr>
          <tr>
            <td colSpan={4} className="pb-2">
              <div className="h-px bg-gray-100" />
            </td>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupRows = ROWS.filter(r => r.group === group)
            return (
              <React.Fragment key={group}>
                {/* Group header */}
                <tr>
                  <td colSpan={4} className="pt-4 pb-1">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">{group}</span>
                  </td>
                </tr>
                {groupRows.map((row) => {
                  const valA = scenarioA.result[row.key] as number
                  const valB = scenarioB.result[row.key] as number
                  const delta = valA - valB
                  const better = row.higherIsBetter ? delta > 0 : delta < 0
                  const worse  = row.higherIsBetter ? delta < 0 : delta > 0

                  return (
                    <tr
                      key={row.key}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-gray-600 text-xs">
                        {row.label}
                        <TooltipIcon text={row.tooltip} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="text-gray-800 tabular-nums">{valA.toFixed(row.decimals)}</span>
                        <span className="text-gray-400 ml-1 text-[10px]">{row.unit}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="text-gray-800 tabular-nums">{valB.toFixed(row.decimals)}</span>
                        <span className="text-gray-400 ml-1 text-[10px]">{row.unit}</span>
                      </td>
                      <td className={clsx(
                        'py-2.5 pl-4 text-right tabular-nums text-xs',
                        better ? 'text-green-600' : worse ? 'text-red-500' : 'text-gray-400'
                      )}>
                        <span className={clsx(
                          'inline-block px-2 py-0.5 rounded-md text-[10px]',
                          better ? 'bg-green-50' : worse ? 'bg-red-50' : 'bg-gray-50'
                        )}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(row.decimals)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
