'use client'

import React, { useState } from 'react'
import clsx from 'clsx'

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function Num({ label, value, onChange, unit, step = 1, min }: {
  label: string; value: number; onChange: (v: number) => void
  unit?: string; step?: number; min?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-500 font-medium block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={isNaN(value) ? '' : value}
          step={step}
          min={min}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all pr-10"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

function ReadOnly({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-400 block">{label}</label>
      <div className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-500 font-mono">{value} <span className="text-[10px] text-gray-400">{unit}</span></div>
    </div>
  )
}

function Card({ num, title, desc, formula, result, unit, resultLabel, children }: {
  num: string; title: string; desc: string; formula: string
  result: string; unit: string; resultLabel: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-[10px] font-black text-gray-400 bg-gray-100 rounded-md px-1.5 py-0.5 mt-0.5">{num}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800 leading-tight">{title}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
          </div>
        </div>
        <div className="mt-3 bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg font-mono text-[10px] text-gray-600 overflow-x-auto whitespace-nowrap">
          {formula}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">{children}</div>
        <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{resultLabel}</span>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900 tabular-nums">{result}</span>
            <span className="text-xs text-gray-400 ml-1.5">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModuleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
      <p className="text-xs font-bold text-gray-800 tracking-widest uppercase border-b border-gray-100 pb-3">{title}</p>
      <p className="text-xs text-gray-500 pt-3">{subtitle}</p>
    </div>
  )
}

// ─── Módulo 1: Holístico ─────────────────────────────────────────────────────

function ModuloHolistico() {
  const [forraje, setForraje] = useState(110000)
  const [consumoDiario, setConsumoDiario] = useState(12)
  const [dias, setDias] = useState(30)
  const [animales, setAnimales] = useState(200)
  const [superficiePotrero, setSuperficiePotrero] = useState(20)
  const [periodoRecuperacion, setPeriodoRecuperacion] = useState(90)
  const [numPotreros, setNumPotreros] = useState(10)
  const [diasPastoreo, setDiasPastoreo] = useState(60)
  const [superficieTotal, setSuperficieTotal] = useState(500)
  const [biomasa, setBiomasa] = useState(2500)
  const [factorUtil, setFactorUtil] = useState(50)
  const [consumoRacion, setConsumoRacion] = useState(12)

  const cap = forraje / (consumoDiario * dias)
  const dens = animales / superficiePotrero
  const permDias = periodoRecuperacion / (numPotreros - 1 || 1)
  const recDias = permDias * (numPotreros - 1)
  const raciones = (diasPastoreo * animales) / superficieTotal
  const racionesDisp = (biomasa * (factorUtil / 100)) / consumoRacion

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Módulo 1 — Manejo Holístico"
        subtitle="Protocolo Allan Savory · Planificación temporal y recuperación vegetal"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card num="01" title="Capacidad de Carga (Stocking Rate)"
          desc="Cantidad de animales que el sistema puede sostener en un período definido."
          formula="Capacidad = Forraje Disponible ÷ (Consumo Diario × Días)"
          result={isNaN(cap) ? '—' : cap.toFixed(2)} unit="animales" resultLabel="Capacidad de carga">
          <Num label="Forraje disponible" value={forraje} onChange={setForraje} unit="kg MS" step={1000} />
          <Num label="Consumo diario/animal" value={consumoDiario} onChange={setConsumoDiario} unit="kg MS/día" step={0.5} />
          <Num label="Días del período" value={dias} onChange={setDias} unit="días" />
        </Card>

        <Card num="02" title="Densidad de Carga (Stocking Density)"
          desc="Concentración instantánea para generar efecto manada (Impacto Animal)."
          formula="Densidad = N° Animales ÷ Superficie del potrero en uso"
          result={isNaN(dens) ? '—' : dens.toFixed(2)} unit="anim/Ha" resultLabel="Densidad instantánea">
          <Num label="N° de animales" value={animales} onChange={setAnimales} unit="cab" />
          <Num label="Superficie potrero" value={superficiePotrero} onChange={setSuperficiePotrero} unit="Ha" step={0.5} />
        </Card>

        <Card num="03" title="Período de Permanencia (Grazing Period)"
          desc="Tiempo máximo en un potrero para evitar el consumo del rebrote."
          formula="Permanencia = Período de recuperación ÷ (N° potreros − 1)"
          result={isNaN(permDias) ? '—' : permDias.toFixed(2)} unit="días" resultLabel="Días de permanencia">
          <Num label="Período recuperación" value={periodoRecuperacion} onChange={setPeriodoRecuperacion} unit="días" />
          <Num label="N° de potreros" value={numPotreros} onChange={setNumPotreros} unit="uds" min={2} />
        </Card>

        <Card num="04" title="Período de Recuperación"
          desc="Tiempo de descanso absoluto para la recuperación radicular y foliar."
          formula="Recuperación = Permanencia × (N° potreros − 1)"
          result={isNaN(recDias) ? '—' : recDias.toFixed(2)} unit="días" resultLabel="Días de recuperación">
          <ReadOnly label="Permanencia (arrastrada)" value={permDias.toFixed(2)} unit="días" />
          <ReadOnly label="N° potreros − 1" value={String(numPotreros - 1)} unit="uds" />
        </Card>

        <Card num="05" title="Raciones por Hectárea (ADA / DAH)"
          desc="Métrica universal para medir la productividad del potrero cosechada por animales."
          formula="Raciones/Ha = (Días pastoreo × N° animales) ÷ Superficie total"
          result={isNaN(raciones) ? '—' : raciones.toFixed(2)} unit="Rac/Ha" resultLabel="Raciones por hectárea">
          <Num label="Días de pastoreo" value={diasPastoreo} onChange={setDiasPastoreo} unit="días" />
          <Num label="N° animales" value={animales} onChange={setAnimales} unit="cab" />
          <Num label="Superficie total" value={superficieTotal} onChange={setSuperficieTotal} unit="Ha" step={10} />
        </Card>

        <Card num="06" title="Estimación de Raciones Disponibles"
          desc="Cálculo predictivo antes de ingresar al lote."
          formula="Rac. Disponibles = (Biomasa × Factor Utilización) ÷ Consumo por Ración"
          result={isNaN(racionesDisp) ? '—' : racionesDisp.toFixed(2)} unit="Raciones" resultLabel="Raciones disponibles">
          <Num label="Biomasa total" value={biomasa} onChange={setBiomasa} unit="kg MS/Ha" step={100} />
          <Num label="Factor utilización" value={factorUtil} onChange={setFactorUtil} unit="%" step={5} />
          <Num label="Consumo por ración" value={consumoRacion} onChange={setConsumoRacion} unit="kg MS" step={0.5} />
        </Card>

      </div>
    </div>
  )
}

// ─── Módulo 2: PRV ───────────────────────────────────────────────────────────

function ModuloPRV() {
  const [descMaxDias, setDescMaxDias] = useState(90)
  const [ocupDias, setOcupDias] = useState(3)
  const [demandaMS, setDemandaMS] = useState(2400)
  const [ofertaMS, setOfertaMS] = useState(3000)
  const [pesoVerde, setPesoVerde] = useState(8000)
  const [pctMS, setPctMS] = useState(18)

  const numParcelas = Math.ceil(descMaxDias / ocupDias) + 1
  const presion = (demandaMS / (ofertaMS || 1)) * 100
  const disponHa = (pesoVerde * (pctMS / 100)) * 10000 / 10000

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Módulo 2 — Pastoreo Racional Voisin (PRV)"
        subtitle="Leyes de la Biocenosis · Curva sigmoidea de crecimiento y eficiencia de cosecha"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card num="07" title="Ley de Reposo — Diseño de Parcelas"
          desc="Infraestructura necesaria para cumplir los tiempos biológicos de descanso."
          formula="N° Parcelas = (Descanso Máximo ÷ Ocupación) + 1"
          result={isNaN(numParcelas) ? '—' : numParcelas.toFixed(0)} unit="parcelas" resultLabel="Número de parcelas">
          <Num label="Descanso máximo" value={descMaxDias} onChange={setDescMaxDias} unit="días" />
          <Num label="Período ocupación" value={ocupDias} onChange={setOcupDias} unit="días" min={1} />
        </Card>

        <Card num="08" title="Ley de Ocupación — Presión de Pastoreo"
          desc="Equilibrio entre la oferta del parche y la demanda instantánea del lote."
          formula="Presión = (Demanda MS del Lote ÷ Oferta MS Parcela) × 100"
          result={isNaN(presion) ? '—' : presion.toFixed(2)} unit="%" resultLabel="Presión de pastoreo">
          <Num label="Demanda MS del lote" value={demandaMS} onChange={setDemandaMS} unit="kg MS" step={100} />
          <Num label="Oferta MS parcela" value={ofertaMS} onChange={setOfertaMS} unit="kg MS" step={100} />
        </Card>

        <Card num="09" title="Disponibilidad Forrajera (Aforo)"
          desc="Método cuadrante para estimar la materia seca disponible por hectárea."
          formula="Disp. (kg MS/Ha) = (Peso Verde × % MS) × 10.000"
          result={isNaN(disponHa) ? '—' : (pesoVerde * (pctMS / 100)).toFixed(2)} unit="kg MS/Ha" resultLabel="Disponibilidad">
          <Num label="Peso verde (muestra)" value={pesoVerde} onChange={setPesoVerde} unit="kg" step={100} />
          <Num label="% Materia Seca" value={pctMS} onChange={setPctMS} unit="%" step={0.5} />
        </Card>

      </div>
    </div>
  )
}

// ─── Módulo 3: Tradicional ───────────────────────────────────────────────────

function ModuloTradicional() {
  const [cabezasTotal, setCabezasTotal] = useState(300)
  const [superfTotal, setSuperfTotal] = useState(500)
  const [pesoFinal, setPesoFinal] = useState(480)
  const [pesoInicial, setPesoInicial] = useState(380)
  const [diasPesaje, setDiasPesaje] = useState(90)

  // EV multi-categoría simplificado
  const [vacas, setVacas] = useState(100)
  const [novillos, setNovillos] = useState(80)
  const [terneros, setTerneros] = useState(60)
  const [toros, setToros] = useState(10)

  const CA = cabezasTotal / (superfTotal || 1)
  const evTotal = vacas * 1.0 + novillos * 1.0 + terneros * 0.45 + toros * 1.25
  const evHa = evTotal / (superfTotal || 1)
  const GDP = (pesoFinal - pesoInicial) / (diasPesaje || 1)

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Módulo 3 — Ganadería Tradicional y Extensiva"
        subtitle="Métricas estándar · Control de stock, equivalencias y rendimientos físicos"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card num="10" title="Carga Animal Estática"
          desc="Relación entre el total de cabezas y la superficie total del establecimiento."
          formula="CA = Total de Cabezas ÷ Superficie Total (Ha)"
          result={isNaN(CA) ? '—' : CA.toFixed(2)} unit="cab/Ha" resultLabel="Carga animal">
          <Num label="Total cabezas" value={cabezasTotal} onChange={setCabezasTotal} unit="cab" />
          <Num label="Superficie total" value={superfTotal} onChange={setSuperfTotal} unit="Ha" step={10} />
        </Card>

        <Card num="11" title="Equivalente Vaca (EV)"
          desc="Normalización del rebaño según requerimientos de mantenimiento. Coef: Vacas=1.0, Novillos=1.0, Terneros=0.45, Toros=1.25"
          formula="EV/Ha = Σ(Categoría × Coeficiente) ÷ Superficie Total"
          result={isNaN(evHa) ? '—' : evHa.toFixed(2)} unit="EV/Ha" resultLabel="Carga en EV/Ha">
          <Num label="Vacas (×1.00)" value={vacas} onChange={setVacas} unit="cab" />
          <Num label="Novillos (×1.00)" value={novillos} onChange={setNovillos} unit="cab" />
          <Num label="Terneros (×0.45)" value={terneros} onChange={setTerneros} unit="cab" />
          <Num label="Toros (×1.25)" value={toros} onChange={setToros} unit="cab" />
        </Card>

        <Card num="12" title="Ganancia Diaria de Peso (GDP)"
          desc="Mide el desempeño individual del animal entre dos pesajes consecutivos."
          formula="GDP = (Peso Final − Peso Inicial) ÷ Días entre pesajes"
          result={isNaN(GDP) ? '—' : GDP.toFixed(2)} unit="kg/día" resultLabel="GDP">
          <Num label="Peso final" value={pesoFinal} onChange={setPesoFinal} unit="kg" step={5} />
          <Num label="Peso inicial" value={pesoInicial} onChange={setPesoInicial} unit="kg" step={5} />
          <Num label="Días entre pesajes" value={diasPesaje} onChange={setDiasPesaje} unit="días" />
        </Card>

      </div>
    </div>
  )
}

// ─── Módulo 4: Suplementación y Reservas ────────────────────────────────────

function ModuloSupl() {
  const [alimentoConsumido, setAlimentoConsumido] = useState(8)
  const [pvGanado, setPvGanado] = useState(1)
  const [prodCarne, setProdCarne] = useState(12000)
  const [cargaPromEV, setCargaPromEV] = useState(1.2)
  const [ofertaPastoreo, setOfertaPastoreo] = useState(80000)
  const [reservas, setReservas] = useState(40000)
  const [demandaRodeo, setDemandaRodeo] = useState(2400)
  const [stockSilo, setStockSilo] = useState(150000)
  const [consumoDiarioRodeo, setConsumoDiarioRodeo] = useState(2400)

  const ICA = alimentoConsumido / (pvGanado || 1)
  const eficiencia = prodCarne / (cargaPromEV || 1)
  const balance = (ofertaPastoreo + reservas) - demandaRodeo
  const diasAut = stockSilo / (consumoDiarioRodeo || 1)

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Módulo 4 — Suplementación, Feedlot y Reservas Forrajeras"
        subtitle="Alta precisión · Control de costos, insumos y balance estacional"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card num="13" title="Índice de Conversión Alimenticia (ICA)"
          desc="Eficiencia de transformación de alimento en carne viva."
          formula="ICA = Alimento Consumido (kg MS) ÷ Peso Vivo Ganado (kg)"
          result={isNaN(ICA) ? '—' : ICA.toFixed(2)} unit="kg MS/kg PV" resultLabel="Conversión">
          <Num label="Alimento consumido" value={alimentoConsumido} onChange={setAlimentoConsumido} unit="kg MS" step={0.5} />
          <Num label="Peso vivo ganado" value={pvGanado} onChange={setPvGanado} unit="kg" step={0.1} />
        </Card>

        <Card num="14" title="Eficiencia de Stock (Stocking Efficiency)"
          desc="Productividad global del sistema ganadero."
          formula="Eficiencia = Producción de Carne (kg) ÷ Carga Animal Promedio (EV/Ha)"
          result={isNaN(eficiencia) ? '—' : eficiencia.toFixed(2)} unit="kg/EV" resultLabel="Eficiencia">
          <Num label="Producción de carne" value={prodCarne} onChange={setProdCarne} unit="kg" step={500} />
          <Num label="Carga promedio" value={cargaPromEV} onChange={setCargaPromEV} unit="EV/Ha" step={0.1} />
        </Card>

        <Card num="15" title="Balance Forrajero Estacional"
          desc="Comparación entre la oferta total (pastoreo + reservas) y la demanda del rodeo."
          formula="Balance = (Oferta Pastoreo + Reservas) − Demanda del Rodeo"
          result={isNaN(balance) ? '—' : (balance >= 0 ? '+' : '') + balance.toFixed(0)} unit="kg MS" resultLabel="Balance estacional">
          <Num label="Oferta pastoreo" value={ofertaPastoreo} onChange={setOfertaPastoreo} unit="kg MS" step={1000} />
          <Num label="Reservas (silo/heno)" value={reservas} onChange={setReservas} unit="kg MS" step={1000} />
          <Num label="Demanda del rodeo" value={demandaRodeo} onChange={setDemandaRodeo} unit="kg MS" step={100} />
        </Card>

        <Card num="16" title="Días de Autonomía de Reservas"
          desc="Cuántos días puede subsistir el rodeo exclusivamente con el stock de silo o heno."
          formula="Días = Stock Silo o Heno (kg MS) ÷ Consumo Diario del Rodeo (kg MS)"
          result={isNaN(diasAut) ? '—' : diasAut.toFixed(2)} unit="días" resultLabel="Autonomía">
          <Num label="Stock silo/heno" value={stockSilo} onChange={setStockSilo} unit="kg MS" step={5000} />
          <Num label="Consumo diario rodeo" value={consumoDiarioRodeo} onChange={setConsumoDiarioRodeo} unit="kg MS/día" step={100} />
        </Card>

      </div>
    </div>
  )
}

// ─── Tab principal ───────────────────────────────────────────────────────────

type ModuleKey = 'holistico' | 'prv' | 'tradicional' | 'supl'

const MODULE_TABS: { key: ModuleKey; label: string }[] = [
  { key: 'holistico',    label: 'Holístico' },
  { key: 'prv',          label: 'PRV Voisin' },
  { key: 'tradicional',  label: 'Tradicional' },
  { key: 'supl',         label: 'Suplementación' },
]

export function FormulasTab() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('holistico')

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Banner */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-xs font-bold text-gray-800 tracking-widest uppercase border-b border-gray-100 pb-3">Calculadora Agrotecnológica — Motor de Precisión</p>
        <p className="text-xs text-gray-500 mt-3 max-w-3xl leading-relaxed">
          16 fórmulas organizadas en 4 paradigmas de manejo. Ingresá valores de prueba en cada campo para ver el resultado en tiempo real. Resultados redondeados a 2 decimales con unidades de medida explícitas.
        </p>
      </div>

      {/* Selector de módulo */}
      <div className="flex gap-2 flex-wrap">
        {MODULE_TABS.map(m => (
          <button
            key={m.key}
            onClick={() => setActiveModule(m.key)}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-bold transition-colors border',
              activeModule === m.key
                ? 'bg-gray-100 text-gray-900 border-gray-200'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Módulo activo */}
      {activeModule === 'holistico'   && <ModuloHolistico />}
      {activeModule === 'prv'         && <ModuloPRV />}
      {activeModule === 'tradicional' && <ModuloTradicional />}
      {activeModule === 'supl'        && <ModuloSupl />}

    </div>
  )
}
