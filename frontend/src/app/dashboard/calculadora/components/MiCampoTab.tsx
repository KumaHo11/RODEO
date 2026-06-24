'use client'

import React, { useMemo, useState } from 'react'
import { CalculatorInput, CalculatorResult } from '../calculatorEngine'

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

// ── COMPONENTES DE UI ──

function SimpleInput({ label, value, onChange, unit, min, max, step }: any) {
  const [localStr, setLocalStr] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{label}</label>
      <div className="relative">
        <input 
          type="number" min={min} max={max} step={step}
          value={localStr !== null ? localStr : value}
          onChange={e => setLocalStr(e.target.value)}
          onBlur={() => {
            let v = parseFloat(localStr ?? '')
            if (isNaN(v)) v = value
            else {
              v = Math.max(min, Math.min(max, v))
              onChange(v)
            }
            setLocalStr(null)
          }}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">{unit}</span>}
      </div>
    </div>
  )
}

function InlineInput({ value, onChange, min, max, unit, step = 1 }: any) {
  const [local, setLocal] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded md:px-1.5 py-0.5 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all w-24 mx-auto md:mx-0">
      <input
        type="number" min={min} max={max} step={step}
        value={local !== null ? local : value}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => {
          let v = parseFloat(local ?? '')
          if (isNaN(v)) v = value
          else {
            v = Math.max(min, Math.min(max, v))
            onChange(v)
          }
          setLocal(null)
        }}
        className="w-full text-right bg-transparent text-xs font-bold text-gray-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit && <span className="text-[9px] text-gray-400 font-medium select-none">{unit}</span>}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 ${checked ? 'bg-green-500' : 'bg-gray-200'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

// ── COMPONENTE PRINCIPAL ──

export function MiCampoTab({ paddocks, herds, input, result, onChangeInput }: Props) {
  const [seasonType, setSeasonType] = useState<'abierta' | 'cerrada' | 'personalizada'>('abierta')
  const [seasonStart, setSeasonStart] = useState<string>(() => {
    const y = new Date().getFullYear()
    return `${y}-10-01`
  })
  const [seasonEnd, setSeasonEnd] = useState<string>(() => {
    const y = new Date().getFullYear()
    return `${y+1}-04-30`
  })
  
  const [minRecoveryDays, setMinRecoveryDays] = useState(30)
  const [maxRecoveryDays, setMaxRecoveryDays] = useState(90)

  const handleSeasonTypeChange = (type: string) => {
    setSeasonType(type as any)
    const y = new Date().getFullYear()
    if (type === 'abierta') {
      setSeasonStart(`${y}-10-01`)
      setSeasonEnd(`${y+1}-04-30`)
    } else if (type === 'cerrada') {
      setSeasonStart(`${y}-04-01`)
      setSeasonEnd(`${y}-10-31`)
    }
  }

  const seasonDays = useMemo(() => {
    const d1 = new Date(seasonStart)
    const d2 = new Date(seasonEnd)
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff)
  }, [seasonStart, seasonEnd])

  const [activeHerds, setActiveHerds] = useState<Record<string, boolean>>({})
  const [customRations, setCustomRations] = useState<Record<string, number>>({})
  const [customRemnants, setCustomRemnants] = useState<Record<string, number>>({})
  const [customDiasPlan, setCustomDiasPlan] = useState<Record<string, number>>({})

  const totalArea = useMemo(() => paddocks.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0), [paddocks])

  // ── Cálculos a nivel de rodeos (EV) ──
  const herdsMath = useMemo(() => {
    return herds.map(h => {
      const cat = h.categoria || 'VACAS'
      const factorCat = getCategoriaFactor(cat)
      const peso = Number(h.avg_weight_kg) || 450
      const cabezas = Number(h.head_count) || 0
      
      const isActive = activeHerds[h.id] ?? true
      const ration = customRations[h.id] ?? input.dailyRationKgEv

      const evHeadBase = Math.pow(peso / 450, 0.75) * factorCat
      const evTotalFallback = evHeadBase * cabezas
      const evTotal = Number(h.total_ev) || evTotalFallback
      const evHead = cabezas > 0 ? evTotal / cabezas : evHeadBase
      
      const diaAnimal = evHead * ration
      const demandaTotalDiaria = evTotal * ration

      return {
        ...h, cat, factorCat, peso, cabezas, evHead, evTotal, diaAnimal, demandaTotalDiaria, isActive, ration
      }
    })
  }, [herds, input.dailyRationKgEv, activeHerds, customRations])

  const globalDemand = herdsMath.filter(h => h.isActive).reduce((sum, h) => sum + h.demandaTotalDiaria, 0)
  const totalActiveEV = herdsMath.filter(h => h.isActive).reduce((sum, h) => sum + h.evTotal, 0)

  const paddocksMath = useMemo(() => {
    return paddocks.map(p => {
      const area = Number(p.area_ha) || 0
      const msHa = Number(p.dry_matter_kg_ha) || input.msKgHa
      const remnant = customRemnants[p.id] ?? input.remnantMsKgHa
      
      const ofertaTotal = area * msHa
      const msAprovechable = Math.max(0, msHa - remnant) * area
      const racPot = msAprovechable / input.dailyRationKgEv
      const diasSugeridosRodeoTotal = globalDemand > 0 ? (msAprovechable / globalDemand) : 0
      const N = paddocks.length || 1
      // Coeficiente Agronómico: Oferta Total (Área x MS) vs Oferta Promedio
      const totalOfertaGlobal = paddocks.reduce((sum, pk) => sum + ((Number(pk.area_ha) || 0) * (Number(pk.dry_matter_kg_ha) || input.msKgHa)), 0)
      const avgOferta = totalOfertaGlobal / N
      const coef = avgOferta > 0 ? ofertaTotal / avgOferta : 1

      // Fórmulas de Leyes Universales del Pastoreo
      const tpMinimo = minRecoveryDays / (N > 1 ? N - 1 : 1)
      const tpMaximo = maxRecoveryDays / (N > 1 ? N - 1 : 1)

      const minDays = coef * tpMinimo
      const maxDaysPermanencia = coef * tpMaximo

      // Días planificados por el usuario en esta pestaña de simulación
      const diasPlan = customDiasPlan[p.id] !== undefined ? customDiasPlan[p.id] : Math.max(1, Math.round(minDays))
      
      // Ración por potrero = días planificados * demanda diaria de todos los EV
      const racionPotreroKg = diasPlan * globalDemand
      
      // Nueva fórmula % Uso = (Ración por Potrero / MS Disponible) * 100
      const usoPct = msAprovechable > 0 ? (racionPotreroKg / msAprovechable) * 100 : 0

      return {
        ...p, area, msHa, remnant, ofertaTotal, msAprovechable, racPot, diasSugeridosRodeoTotal, usoPct, minDays, maxDaysPermanencia, diasPlan, racionPotreroKg
      }
    }).sort((a, b) => b.racPot - a.racPot)
  }, [paddocks, input.msKgHa, input.remnantMsKgHa, input.dailyRationKgEv, globalDemand, totalArea, seasonDays, minRecoveryDays, maxRecoveryDays, customRemnants, customDiasPlan])

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      
      {/* ── CONTROLES INTERACTIVOS (Sticky Header) ── */}
      <div className="sticky top-4 z-20 bg-gray-50/95 backdrop-blur-md border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-black text-gray-900">Parámetros globales</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          <SimpleInput
            label="Ración base" value={input.dailyRationKgEv}
            min={6} max={20} step={0.5} unit="kg MS/EV"
            onChange={(v: number) => onChangeInput?.('dailyRationKgEv', v)}
            title="Ración diaria base por Equivalente Vaca"
          />
          <SimpleInput
            label="Remanente base" value={input.remnantMsKgHa}
            min={0} max={2000} step={50} unit="kg MS/ha"
            onChange={(v: number) => onChangeInput?.('remnantMsKgHa', v)}
            title="Materia seca base a dejar como residuo"
          />
          <div className="flex flex-col flex-1 min-w-[120px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Temporada</label>
            <select 
              value={seasonType}
              onChange={(e) => handleSeasonTypeChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:border-green-500 focus:ring-1 outline-none transition-all"
            >
              <option value="abierta">Abierta (Oct-Abr)</option>
              <option value="cerrada">Cerrada (Abr-Oct)</option>
              <option value="personalizada">Personalizada</option>
            </select>
          </div>
          <div className="flex flex-col flex-1 min-w-[120px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inicio Temp.</label>
            <input 
              type="date" value={seasonStart} 
              onChange={(e) => { setSeasonStart(e.target.value); setSeasonType('personalizada') }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:border-green-500 focus:ring-1 outline-none transition-all"
              title="Fecha de inicio de la temporada"
            />
          </div>
          <div className="flex flex-col flex-1 min-w-[120px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fin Temp.</label>
            <input 
              type="date" value={seasonEnd} 
              onChange={(e) => { setSeasonEnd(e.target.value); setSeasonType('personalizada') }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 focus:border-green-500 focus:ring-1 outline-none transition-all"
              title="Fecha de fin de la temporada"
            />
          </div>
          <SimpleInput
            label="Recup. Mín" value={minRecoveryDays}
            min={10} max={365} step={1} unit="días"
            onChange={(v: number) => setMinRecoveryDays(v)}
            title="Días mínimos de descanso necesarios para la recuperación del pasto."
          />
          <SimpleInput
            label="Recup. Máx" value={maxRecoveryDays}
            min={10} max={365} step={1} unit="días"
            onChange={(v: number) => setMaxRecoveryDays(v)}
            title="Días máximos de descanso necesarios para la recuperación del pasto."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <h3 className="text-sm font-black text-gray-900">Rodeos de simulación</h3>
            <span className="text-[10px] text-gray-500 font-medium">{herdsMath.filter(h => h.isActive).length} Activos</span>
          </div>
          
          {herdsMath.length === 0 ? (
            <p className="text-xs text-gray-500">No hay rodeos cargados.</p>
          ) : (
            <div className="space-y-3">
              {herdsMath.map(h => (
                <div key={h.id} className={`bg-white border rounded-xl p-3 shadow-sm transition-all ${h.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">{h.name || 'Sin nombre'}</h4>
                      <p className="text-[10px] text-gray-500 font-medium">{h.cabezas} cab. • {h.cat}</p>
                    </div>
                    <Toggle 
                      checked={h.isActive} 
                      onChange={(c) => setActiveHerds(prev => ({ ...prev, [h.id]: c }))}
                    />
                  </div>
                  
                  {h.isActive && (
                    <div className="pt-2 mt-2 border-t border-gray-50 grid grid-cols-2 gap-y-2 gap-x-2">
                      <div className="col-span-2 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Ración (kg MS)</span>
                        <InlineInput 
                          value={h.ration} 
                          min={6} max={25} step={0.5} 
                          onChange={(v: number) => setCustomRations(prev => ({ ...prev, [h.id]: v }))}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total EV</p>
                        <p className="font-black text-black text-sm">{h.evTotal.toFixed(1)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Demanda</p>
                        <p className="font-black text-red-600 text-sm">{h.demandaTotalDiaria.toFixed(0)} <span className="text-[9px] text-red-400 font-normal">kg/d</span></p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-4 shadow-sm">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total demanda activa</p>
                <p className="text-xl font-black text-gray-900">{globalDemand.toFixed(0)} <span className="text-xs text-gray-500 font-medium">kg MS/día</span></p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <h3 className="text-sm font-black text-gray-900">Oferta forrajera</h3>
            <span className="text-[10px] text-gray-500 font-medium">Ordenado por RAC/POT</span>
          </div>

          {paddocksMath.length === 0 ? (
            <p className="text-xs text-gray-500">No hay potreros cargados.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100">
                      <th className="px-4 py-3 font-bold" title="Nombre del lote">Potrero</th>
                      <th className="px-4 py-3 font-bold">Área</th>
                      <th className="px-4 py-3 font-bold" title="Materia seca base a dejar">Remanente (kg MS/ha)</th>
                      <th className="px-4 py-3 font-bold">Oferta MS</th>
                      <th className="px-4 py-3 font-bold" title="Días que el rodeo puede permanecer">Días Permitidos</th>
                      <th className="px-4 py-3 font-bold text-blue-600" title="Días a asignar en el plan de simulación">Días Plan</th>
                      <th className="px-4 py-3 font-bold text-purple-600" title="Ración total calculada para los días planificados">Ración Potrero</th>
                      <th className="px-4 py-3 font-bold text-right">% Uso</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-gray-100">
                    {paddocksMath.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900">{p.name || 'Sin nombre'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.area.toFixed(1)} ha</td>
                        <td className="px-4 py-3">
                          <InlineInput 
                            value={p.remnant} 
                            min={0} max={2500} step={50}
                            onChange={(v: number) => setCustomRemnants(prev => ({ ...prev, [p.id]: v }))}
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-medium">{p.ofertaTotal.toFixed(0)} kg</td>
                        <td className="px-4 py-3">
                          {globalDemand > 0 ? (
                            <>
                              <span className="font-bold text-gray-800 block">{p.diasSugeridosRodeoTotal.toFixed(1)} días</span>
                              <span className="text-[9px] text-gray-400">Mín: {p.minDays.toFixed(1)} • Máx: {p.maxDaysPermanencia.toFixed(1)}</span>
                            </>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <InlineInput 
                            value={p.diasPlan} 
                            min={0} max={365} step={0.5}
                            onChange={(v: number) => setCustomDiasPlan(prev => ({ ...prev, [p.id]: v }))}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-purple-700">{p.racionPotreroKg.toFixed(0)} kg</span>
                        </td>
                        <td className="px-4 py-3 text-right w-24">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-bold text-[10px] ${p.usoPct > 100 ? 'text-red-600' : p.usoPct < 90 ? 'text-amber-500' : 'text-green-600'}`}>
                              {p.usoPct.toFixed(1)}%
                            </span>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${p.usoPct > 100 ? 'bg-red-500' : p.usoPct < 90 ? 'bg-amber-400' : 'bg-green-500'}`} 
                                style={{ width: `${Math.min(100, p.usoPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-6 mt-4 justify-around items-center">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Días totales planificados</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {paddocksMath.reduce((s, p) => s + p.diasPlan, 0).toFixed(1)} <span className="text-sm font-medium text-gray-500">días</span>
              </p>
            </div>
            <div className="h-10 w-px bg-gray-200 hidden sm:block"></div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Ración total planificada</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {paddocksMath.reduce((s, p) => s + p.racionPotreroKg, 0).toFixed(0)} <span className="text-sm font-medium text-gray-500">kg MS</span>
              </p>
            </div>
            <div className="h-10 w-px bg-gray-200 hidden sm:block"></div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Oferta total aprovechable</p>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {paddocksMath.reduce((s, p) => s + p.msAprovechable, 0).toFixed(0)} <span className="text-sm font-medium text-gray-500">kg MS</span>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
