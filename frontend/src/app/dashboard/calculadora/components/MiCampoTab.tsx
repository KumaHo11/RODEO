'use client'

import React, { useMemo, useState } from 'react'
import { Card } from './FormulasTab'
import { CalculatorInput, CategoriaAnimal, CalculatorResult } from '../calculatorEngine'

interface Props {
  paddocks: any[]
  herds: any[]
  input: CalculatorInput
  result: CalculatorResult
  onChangeInput?: (key: keyof CalculatorInput, val: any) => void
}

function getCategoriaFactor(categoria: string): number {
  const cat = categoria.toUpperCase()
  if (cat === 'TERNEROS' || cat === 'TERNERAS') return 0.45
  if (cat === 'TOROS' || cat === 'BUBALINOS') return 1.25
  return 1.0 // Vacas, novillos, vaquillonas
}

function SimpleInput({ label, value, onChange, unit, min, max, step }: any) {
  const [localStr, setLocalStr] = useState<string | null>(null)
  
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">{label}</label>
      <div className="relative">
        <input 
          type="number"
          min={min} max={max} step={step}
          value={localStr !== null ? localStr : value}
          onChange={e => {
            setLocalStr(e.target.value)
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min && v <= max) {
              onChange(v)
            }
          }}
          onBlur={() => {
            let v = parseFloat(localStr ?? '')
            if (isNaN(v)) v = min
            v = Math.max(min, Math.min(max, v))
            setLocalStr(null)
            onChange(v)
          }}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-black text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-all pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">{unit}</span>}
      </div>
    </div>
  )
}

export function MiCampoTab({ paddocks, herds, input, result, onChangeInput }: Props) {
  // Estados locales para métricas que solo aplican a la vista Savory / Potreros y no a toda la calculadora global
  const [seasonDays, setSeasonDays] = useState(90)
  const [recoveryDays, setRecoveryDays] = useState(60)

  // ── Cálculos a nivel de rodeos (EV) ──
  const herdsMath = useMemo(() => {
    return herds.map(h => {
      const cat = h.categoria || 'VACAS'
      const factorCat = getCategoriaFactor(cat)
      const peso = Number(h.avg_weight_kg) || 450
      const cabezas = Number(h.head_count) || 0
      const evHead = Math.pow(peso / 450, 0.75) * factorCat
      const evTotal = evHead * cabezas
      const diaAnimal = evHead * input.dailyRationKgEv
      const demandaTotalDiaria = evTotal * input.dailyRationKgEv

      return {
        ...h, cat, factorCat, peso, cabezas, evHead, evTotal, diaAnimal, demandaTotalDiaria
      }
    })
  }, [herds, input.dailyRationKgEv])

  const globalEv = herdsMath.reduce((sum, h) => sum + h.evTotal, 0)
  const globalDemand = herdsMath.reduce((sum, h) => sum + h.demandaTotalDiaria, 0)

  // ── Cálculos a nivel de potreros ──
  const totalArea = paddocks.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0)
  const paddocksMath = useMemo(() => {
    return paddocks.map(p => {
      const area = Number(p.area_ha) || 0
      // Usar dato del potrero si existe, sino el global de input
      const msHa = Number(p.dry_matter_kg_ha) || input.msKgHa
      const remnant = input.remnantMsKgHa
      
      const ofertaTotal = area * msHa
      const msAprovechable = Math.max(0, msHa - remnant) * area
      
      const racPot = msAprovechable / input.dailyRationKgEv // Raciones totales del potrero
      const diasSugeridosRodeoTotal = globalDemand > 0 ? (msAprovechable / globalDemand) : 0
      const usoPct = ofertaTotal > 0 ? (msAprovechable / ofertaTotal) * 100 : 0

      // Días mínimos (proporcional al área)
      const minDays = totalArea > 0 ? (area / totalArea) * (seasonDays / (paddocks.length || 1)) : 0

      // Ley de permanencia de Savory
      const maxDaysPermanencia = paddocks.length > 1 ? recoveryDays / (paddocks.length - 1) : 0

      return {
        ...p, area, msHa, ofertaTotal, msAprovechable, racPot, diasSugeridosRodeoTotal, usoPct, minDays, maxDaysPermanencia
      }
    }).sort((a, b) => b.racPot - a.racPot)
  }, [paddocks, input.msKgHa, input.remnantMsKgHa, input.dailyRationKgEv, globalDemand, totalArea, seasonDays, recoveryDays])

  return (
    <div className="space-y-8 animate-in fade-in duration-200 relative">
      
      {/* ── CONTROLES INTERACTIVOS (Sticky) ── */}
      <div className="sticky top-4 z-20 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl p-4 shadow-md">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SimpleInput
            label="Ración diaria"
            value={input.dailyRationKgEv}
            min={6} max={20} step={0.5} unit="kg MS/EV"
            onChange={(v: number) => onChangeInput?.('dailyRationKgEv', v)}
          />
          <SimpleInput
            label="Remanente obj."
            value={input.remnantMsKgHa}
            min={0} max={2000} step={50} unit="kg MS/ha"
            onChange={(v: number) => onChangeInput?.('remnantMsKgHa', v)}
          />
          <SimpleInput
            label="Días Temporada"
            value={seasonDays}
            min={10} max={365} step={5} unit="días"
            onChange={(v: number) => setSeasonDays(v)}
          />
          <SimpleInput
            label="Recuperación"
            value={recoveryDays}
            min={20} max={120} step={5} unit="días"
            onChange={(v: number) => setRecoveryDays(v)}
          />
        </div>
      </div>

      {/* ── SECCIÓN RODEOS Y DEMANDA ── */}
      <div>
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Demanda y Rodeos</h3>
        {herdsMath.length === 0 ? (
          <p className="text-xs text-gray-500 bg-white p-4 rounded-xl border border-gray-100">No hay rodeos cargados en la cuenta.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {herdsMath.map(h => (
              <div key={h.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="border-b border-gray-50 pb-2">
                  <h4 className="text-sm font-black text-gray-900">{h.name || 'Rodeo sin nombre'}</h4>
                  <p className="text-[10px] text-gray-500 font-medium">{h.cabezas} cabezas • {h.cat} ({h.peso} kg)</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">EV por cabeza</p>
                    <p className="font-black text-gray-800">{h.evHead.toFixed(2)} EV</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">({h.peso}/450)^0.75 × {h.factorCat}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Total EV</p>
                    <p className="font-black text-gray-800">{h.evTotal.toFixed(1)} EV</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Día Animal</p>
                    <p className="font-black text-gray-800">{h.diaAnimal.toFixed(1)} kg MS</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">Demanda Lote</p>
                    <p className="font-black text-gray-800 text-red-600">{h.demandaTotalDiaria.toFixed(0)} kg/día</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECCIÓN POTREROS Y OFERTA ── */}
      <div>
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 mt-8">Oferta y Potreros (Ordenados por RAC)</h3>
        {paddocksMath.length === 0 ? (
          <p className="text-xs text-gray-500 bg-white p-4 rounded-xl border border-gray-100">No hay potreros cargados en la cuenta.</p>
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 font-bold border-b border-gray-100">Potrero</th>
                  <th className="px-4 py-3 font-bold border-b border-gray-100">Área</th>
                  <th className="px-4 py-3 font-bold border-b border-gray-100">Disponibilidad</th>
                  <th className="px-4 py-3 font-bold border-b border-gray-100">Oferta MS</th>
                  <th className="px-4 py-3 font-bold border-b border-gray-100 text-blue-600">RAC/POT</th>
                  <th className="px-4 py-3 font-bold border-b border-gray-100">Días al Rodeo</th>
                  <th className="px-4 py-3 font-bold border-b border-gray-100 text-right">% Uso</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {paddocksMath.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900">{p.name || 'Sin nombre'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.area.toFixed(1)} ha</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.msHa.toFixed(0)} kg/ha
                      <span className="block text-[9px] text-gray-400">Remanente: {input.remnantMsKgHa}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.ofertaTotal.toFixed(0)} kg</td>
                    <td className="px-4 py-3 font-black text-blue-700">{p.racPot.toFixed(0)} rac</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-800">{p.diasSugeridosRodeoTotal.toFixed(1)} días</span>
                      <span className="block text-[9px] text-gray-400">Mín: {p.minDays.toFixed(1)} • Máx Savory: {p.maxDaysPermanencia.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-1 rounded-md font-bold text-[10px] ${
                        p.usoPct > 80 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.usoPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 border-t border-gray-100 pt-6">
         <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Días Totales con el Rodeo Actual</p>
           <p className="text-2xl font-black text-gray-900 mt-1">
             {globalDemand > 0 ? (paddocksMath.reduce((s, p) => s + p.msAprovechable, 0) / globalDemand).toFixed(1) : 0} <span className="text-sm font-medium text-gray-500">días</span>
           </p>
         </div>
         <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Raciones Totales del Campo</p>
           <p className="text-2xl font-black text-gray-900 mt-1">
             {paddocksMath.reduce((s, p) => s + p.racPot, 0).toFixed(0)} <span className="text-sm font-medium text-gray-500">rac</span>
           </p>
         </div>
      </div>
    </div>
  )
}
