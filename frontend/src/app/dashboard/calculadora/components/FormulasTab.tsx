'use client'

import React, { useState } from 'react'

function FormulaCard({
  title, description, formulaStr, children, resultLabel, resultValue, resultUnit
}: {
  title: string
  description: string
  formulaStr: string
  children: React.ReactNode
  resultLabel: string
  resultValue: string
  resultUnit: string
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
        <div className="mt-3 bg-gray-100 px-3 py-2 rounded-lg font-mono text-[10px] text-gray-600 overflow-x-auto whitespace-nowrap">
          {formulaStr}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between gap-6">
        <div className="grid grid-cols-2 gap-4">
          {children}
        </div>
        <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{resultLabel}</span>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900 tabular-nums">{resultValue}</span>
            <span className="text-sm text-gray-500 ml-1.5">{resultUnit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function InputNum({ label, value, onChange, unit, step = 1 }: { label: string, value: number, onChange: (v: number) => void, unit?: string, step?: number }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-600 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={isNaN(value) ? '' : value}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all pr-8"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

export function FormulasTab() {
  // Estados para Ev / Carga
  const [peso, setPeso] = useState(400)
  const [cabezas, setCabezas] = useState(100)
  const [area, setArea] = useState(50)
  const [racion, setRacion] = useState(12)

  // Estados para Forraje
  const [msDisp, setMsDisp] = useState(2500)
  const [remanente, setRemanente] = useState(1000)
  const [eficiencia, setEficiencia] = useState(60)

  // Estados Crecimiento
  const [tasaBase, setTasaBase] = useState(15)
  const [cAdj, setCAdj] = useState(0.85)

  // Cálculos
  const evUnitario = Math.pow(peso / 450, 0.75)
  const evTotal = cabezas * evUnitario
  const cargaHa = evTotal / area
  const diaAnimal = evUnitario * racion
  const consumoDiario = evTotal * racion

  const stockAprovHa = (msDisp - remanente) * (eficiencia / 100)
  const stockAprovTotal = stockAprovHa * area
  const autonomia = stockAprovTotal / (consumoDiario || 1)

  const crecReal = tasaBase * cAdj

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
        <h2 className="text-sm font-bold text-green-900">Transparencia de cálculos</h2>
        <p className="text-xs text-green-700 mt-1 max-w-3xl leading-relaxed">
          En esta sección podés ver exactamente qué fórmulas matemáticas utiliza el motor de RODEO para calcular los resultados productivos. Podés ingresar valores de prueba en los campos para entender cómo responde cada ecuación.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Equivalente Vaca */}
        <FormulaCard
          title="1. Factor Equivalente Vaca (EV)"
          description="Ajuste metabólico del animal respecto a una vaca estándar de 450kg."
          formulaStr="EV = (Peso Vivo / 450) ^ 0.75"
          resultLabel="Factor EV"
          resultValue={evUnitario.toFixed(2)}
          resultUnit="EV/cab"
        >
          <InputNum label="Peso vivo" value={peso} onChange={setPeso} unit="kg" step={5} />
        </FormulaCard>

        {/* Carga Animal */}
        <FormulaCard
          title="2. Carga Diaria"
          description="Presión de pastoreo instantánea sobre el potrero o campo."
          formulaStr="Carga = (Cabezas × Factor EV) / Superficie"
          resultLabel="Carga"
          resultValue={cargaHa.toFixed(2)}
          resultUnit="EV/ha"
        >
          <InputNum label="Cabezas" value={cabezas} onChange={setCabezas} unit="cab" />
          <InputNum label="Superficie" value={area} onChange={setArea} unit="ha" />
        </FormulaCard>

        {/* Día Animal */}
        <FormulaCard
          title="3. Día Animal (Consumo por cabeza)"
          description="Demanda de materia seca diaria para un animal del rodeo, ajustada por su equivalente vaca."
          formulaStr="Día Animal = Factor EV × Ración Diaria Asignada"
          resultLabel="Consumo"
          resultValue={diaAnimal.toFixed(1)}
          resultUnit="kg MS/cab"
        >
          <InputNum label="Ración asig." value={racion} onChange={setRacion} unit="kg/EV" step={0.5} />
          <div className="space-y-1.5 opacity-60 pointer-events-none">
            <label className="text-xs text-gray-600 block">Factor EV (arrastrado)</label>
            <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900">{evUnitario.toFixed(2)}</div>
          </div>
        </FormulaCard>

        {/* Consumo Total */}
        <FormulaCard
          title="4. Consumo Diario Total"
          description="Demanda agregada de materia seca de todo el rodeo por día."
          formulaStr="Consumo Total = Cabezas × Día Animal"
          resultLabel="Demanda"
          resultValue={consumoDiario.toFixed(0)}
          resultUnit="kg MS/día"
        >
          <div className="space-y-1.5 opacity-60 pointer-events-none">
            <label className="text-xs text-gray-600 block">Cabezas</label>
            <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900">{cabezas}</div>
          </div>
          <div className="space-y-1.5 opacity-60 pointer-events-none">
            <label className="text-xs text-gray-600 block">Día Animal</label>
            <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900">{diaAnimal.toFixed(1)}</div>
          </div>
        </FormulaCard>

        {/* Stock Aprovechable */}
        <FormulaCard
          title="5. Stock Aprovechable"
          description="Cantidad de pasto que realmente se puede comer, respetando el remanente y la ineficiencia de cosecha (pisoteo, bosta, etc)."
          formulaStr="Aprovechable = (MS Disponible - Remanente) × Área × Eficiencia"
          resultLabel="Stock"
          resultValue={stockAprovTotal.toFixed(0)}
          resultUnit="kg MS"
        >
          <InputNum label="MS Disp." value={msDisp} onChange={setMsDisp} unit="kg/ha" step={50} />
          <InputNum label="Remanente" value={remanente} onChange={setRemanente} unit="kg/ha" step={50} />
          <InputNum label="Eficiencia" value={eficiencia} onChange={setEficiencia} unit="%" step={5} />
          <div className="space-y-1.5 opacity-60 pointer-events-none">
            <label className="text-xs text-gray-600 block">Superficie</label>
            <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900">{area}</div>
          </div>
        </FormulaCard>

        {/* Autonomía */}
        <FormulaCard
          title="6. Autonomía Forrajera"
          description="Cuántos días dura el stock aprovechable al ritmo de consumo actual."
          formulaStr="Autonomía = Stock Aprovechable Total / Consumo Diario Total"
          resultLabel="Días libres"
          resultValue={autonomia.toFixed(0)}
          resultUnit="días"
        >
          <div className="space-y-1.5 opacity-60 pointer-events-none">
            <label className="text-xs text-gray-600 block">Stock Aprov.</label>
            <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900">{stockAprovTotal.toFixed(0)}</div>
          </div>
          <div className="space-y-1.5 opacity-60 pointer-events-none">
            <label className="text-xs text-gray-600 block">Consumo Diario</label>
            <div className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900">{consumoDiario.toFixed(0)}</div>
          </div>
        </FormulaCard>

        {/* Tasa de crecimiento ajustada */}
        <FormulaCard
          title="7. Crecimiento Ajustado (C_adj)"
          description="Crecimiento estacional corregido por el multiplicador climático (lluvia, temperatura, sequía, NDVI)."
          formulaStr="Tasa Real = Tasa Base Estacional × Multiplicador C_adj"
          resultLabel="Crecimiento"
          resultValue={crecReal.toFixed(1)}
          resultUnit="kg MS/ha/día"
        >
          <InputNum label="Tasa Base" value={tasaBase} onChange={setTasaBase} unit="kg/ha/d" step={1} />
          <InputNum label="C_adj" value={cAdj} onChange={setCAdj} unit="×" step={0.05} />
        </FormulaCard>

      </div>
    </div>
  )
}
