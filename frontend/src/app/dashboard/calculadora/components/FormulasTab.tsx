'use client'
import React, { useState } from 'react'
import clsx from 'clsx'
import { EvTab } from './EvTab'
import { HidricoTab } from './HidricoTab'
// import { TamboTab } from './TamboTab' // TODO: Restaurar cuando se habilite Tambo

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function Num({ label, value, onChange, unit, step = 1, min }: {
  label: string; value: number; onChange: (v: number) => void
  unit?: string; step?: number; min?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-400 font-semibold block tracking-wide">{label}</label>
      <div className="relative">
        <input type="number" value={isNaN(value) ? '' : value} step={step} min={min}
          inputMode="decimal"
          onFocus={e => e.target.select()}
          onChange={e => onChange(e.target.value === '' ? NaN : parseFloat(e.target.value))}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-all pr-10" />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{unit}</span>}
      </div>
    </div>
  )
}

export function RO({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-400 font-semibold block tracking-wide">{label}</label>
      <div className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-400 font-mono">
        {value} <span className="text-[10px] text-gray-300">{unit}</span>
      </div>
    </div>
  )
}

export function RodeoBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-green-100 text-green-700 border border-green-200 ml-2 align-middle">
      ✦ Rodeo
    </span>
  )
}

/**
 * Card — design system unificado con el resto de la app.
 * Título en 20px (text-xl / font-black), igual que en las otras secciones.
 */
export function Card({ num, title, desc, formula, result, unit, resultLabel, rodeo, children }: {
  num: string; title: string; desc: string; formula: string
  result: string; unit: string; resultLabel: string
  rodeo?: boolean; children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden flex flex-col">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-start gap-3">
          {/* Número de fórmula */}
          <span className="shrink-0 text-[10px] font-black text-gray-400 bg-gray-100 rounded-lg px-1.5 py-1 mt-0.5 tabular-nums leading-none">
            {num}
          </span>
          <div className="flex-1 min-w-0">
            {/* Título 20px — igual que el resto del sitio */}
            <h3 className="text-[20px] font-black text-gray-900 leading-tight">
              {title}{rodeo && <RodeoBadge />}
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed font-medium">{desc}</p>
          </div>
        </div>
        {/* Fórmula */}
        <div className="mt-3 bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl font-mono text-[10px] text-gray-600 overflow-x-auto whitespace-nowrap">
          {formula}
        </div>
      </div>

      {/* ── Body: inputs + resultado ── */}
      <div className="p-5 flex-1 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">{children}</div>
        <div className="pt-4 border-t border-gray-50 flex items-end justify-between">
          <span className="text-[10px] text-gray-400 font-semibold tracking-wide uppercase">{resultLabel}</span>
          <div className="text-right">
            <span className="text-3xl font-black text-gray-900 tabular-nums">{result}</span>
            <span className="text-sm text-gray-400 font-medium ml-1.5">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 16 fórmulas técnicas ─────────────────────────────────────────────────────

function TecnicasGrid() {
  const [forraje, setForraje]                 = useState(110000)
  const [consumoDiario, setConsumoDiario]     = useState(12)
  const [dias, setDias]                       = useState(30)
  const [animales, setAnimales]               = useState(200)
  const [superficiePotrero, setSupPotrero]    = useState(20)
  const [periodoRec, setPeriodoRec]           = useState(90)
  const [numPotreros, setNumPotreros]         = useState(10)
  const [diasPastoreo, setDiasPastoreo]       = useState(60)
  const [superficieTotal, setSupTotal]        = useState(500)
  const [biomasa, setBiomasa]                 = useState(2500)
  const [factorUtil, setFactorUtil]           = useState(50)
  const [consumoRacion, setConsumoRacion]     = useState(12)
  const [descMaxDias, setDescMaxDias]         = useState(90)
  const [ocupDias, setOcupDias]               = useState(3)
  const [demandaMS, setDemandaMS]             = useState(2400)
  const [ofertaMS, setOfertaMS]               = useState(3000)
  const [pesoVerde, setPesoVerde]             = useState(8000)
  const [pctMS, setPctMS]                     = useState(18)
  const [cabezasTotal, setCabezasTotal]       = useState(300)
  const [superfTotal, setSuperfTotal]         = useState(500)
  const [pesoFinal, setPesoFinal]             = useState(480)
  const [pesoInicial, setPesoInicial]         = useState(380)
  const [diasPesaje, setDiasPesaje]           = useState(90)
  const [vacas, setVacas]                     = useState(100)
  const [novillos, setNovillos]               = useState(80)
  const [terneros, setTerneros]               = useState(60)
  const [toros, setToros]                     = useState(10)
  const [alimentoConsumido, setAlimento]      = useState(8)
  const [pvGanado, setPvGanado]               = useState(1)
  const [prodCarne, setProdCarne]             = useState(12000)
  const [cargaPromEV, setCargaPromEV]         = useState(1.2)
  const [ofertaPastoreo, setOfertaPastoreo]   = useState(80000)
  const [reservas, setReservas]               = useState(40000)
  const [demandaRodeo, setDemandaRodeo]       = useState(2400)
  const [stockSilo, setStockSilo]             = useState(150000)
  const [consumoDiarioRodeo, setConsRodeo]    = useState(2400)

  const cap         = forraje / (consumoDiario * dias)
  const dens        = animales / superficiePotrero
  const permDias    = periodoRec / (numPotreros - 1 || 1)
  const recDias     = permDias * (numPotreros - 1)
  const raciones    = (diasPastoreo * animales) / superficieTotal
  const racionesDisp = (biomasa * (factorUtil / 100)) / consumoRacion
  const numParcelas = Math.ceil(descMaxDias / ocupDias) + 1
  const presion     = (demandaMS / (ofertaMS || 1)) * 100
  const disponHa    = pesoVerde * (pctMS / 100)
  const CA          = cabezasTotal / (superfTotal || 1)
  const evTotal     = vacas * 1.0 + novillos * 1.0 + terneros * 0.45 + toros * 1.25
  const evHa        = evTotal / (superfTotal || 1)
  const GDP         = (pesoFinal - pesoInicial) / (diasPesaje || 1)
  const ICA         = alimentoConsumido / (pvGanado || 1)
  const eficiencia  = prodCarne / (cargaPromEV || 1)
  const balance     = (ofertaPastoreo + reservas) - demandaRodeo
  const diasAut     = stockSilo / (consumoDiarioRodeo || 1)

  return (
    <div className="space-y-8">
      {/* Manejo holístico */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Manejo holístico — Allan Savory</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="01" title="Capacidad de carga (stocking rate)" rodeo
            desc="Animales que el sistema puede sostener en un período definido."
            formula="Capacidad = Forraje disponible ÷ (Consumo diario × Días)"
            result={isNaN(cap) ? '—' : cap.toFixed(2)} unit="animales" resultLabel="Capacidad de carga">
            <Num label="Forraje disponible" value={forraje} onChange={setForraje} unit="kg MS" step={1000} />
            <Num label="Consumo diario/animal" value={consumoDiario} onChange={setConsumoDiario} unit="kg MS/día" step={0.5} />
            <Num label="Días del período" value={dias} onChange={setDias} unit="días" />
          </Card>

          <Card num="02" title="Densidad de carga (stocking density)" rodeo
            desc="Concentración instantánea para generar efecto manada."
            formula="Densidad = N.º animales ÷ Superficie del potrero"
            result={isNaN(dens) ? '—' : dens.toFixed(2)} unit="anim/ha" resultLabel="Densidad instantánea">
            <Num label="N.º de animales" value={animales} onChange={setAnimales} unit="cab." />
            <Num label="Superficie potrero" value={superficiePotrero} onChange={setSupPotrero} unit="ha" step={0.5} />
          </Card>

          <Card num="03" title="Período de permanencia (grazing period)"
            desc="Tiempo máximo en un potrero para evitar el consumo del rebrote."
            formula="Permanencia = Período de recuperación ÷ (N.º potreros − 1)"
            result={isNaN(permDias) ? '—' : permDias.toFixed(2)} unit="días" resultLabel="Días de permanencia">
            <Num label="Período de recuperación" value={periodoRec} onChange={setPeriodoRec} unit="días" />
            <Num label="N.º de potreros" value={numPotreros} onChange={setNumPotreros} unit="uds." min={2} />
          </Card>

          <Card num="04" title="Período de recuperación"
            desc="Tiempo de descanso absoluto para la recuperación radicular y foliar."
            formula="Recuperación = Permanencia × (N.º potreros − 1)"
            result={isNaN(recDias) ? '—' : recDias.toFixed(2)} unit="días" resultLabel="Días de recuperación">
            <RO label="Permanencia (arrastrada)" value={permDias.toFixed(2)} unit="días" />
            <RO label="N.º potreros − 1" value={String(numPotreros - 1)} unit="uds." />
          </Card>

          <Card num="05" title="Raciones por hectárea (ADA / DAH)" rodeo
            desc="Métrica universal para medir la productividad cosechada por animales."
            formula="Raciones/ha = (Días pastoreo × N.º animales) ÷ Superficie total"
            result={isNaN(raciones) ? '—' : raciones.toFixed(2)} unit="Rac/ha" resultLabel="Raciones por hectárea">
            <Num label="Días de pastoreo" value={diasPastoreo} onChange={setDiasPastoreo} unit="días" />
            <Num label="N.º animales" value={animales} onChange={setAnimales} unit="cab." />
            <Num label="Superficie total" value={superficieTotal} onChange={setSupTotal} unit="ha" step={10} />
          </Card>

          <Card num="06" title="Estimación de raciones disponibles"
            desc="Cálculo predictivo antes de ingresar al lote."
            formula="Rac. disponibles = (Biomasa × Factor utilización) ÷ Consumo por ración"
            result={isNaN(racionesDisp) ? '—' : racionesDisp.toFixed(2)} unit="Raciones" resultLabel="Raciones disponibles">
            <Num label="Biomasa total" value={biomasa} onChange={setBiomasa} unit="kg MS/ha" step={100} />
            <Num label="Factor utilización" value={factorUtil} onChange={setFactorUtil} unit="%" step={5} />
            <Num label="Consumo por ración" value={consumoRacion} onChange={setConsumoRacion} unit="kg MS" step={0.5} />
          </Card>
        </div>
      </div>

      {/* PRV */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Pastoreo racional Voisin (PRV)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="07" title="Ley de reposo — diseño de parcelas"
            desc="Infraestructura necesaria para cumplir los tiempos biológicos de descanso."
            formula="N.º parcelas = (Descanso máximo ÷ Ocupación) + 1"
            result={isNaN(numParcelas) ? '—' : numParcelas.toFixed(0)} unit="parcelas" resultLabel="Número de parcelas">
            <Num label="Descanso máximo" value={descMaxDias} onChange={setDescMaxDias} unit="días" />
            <Num label="Período de ocupación" value={ocupDias} onChange={setOcupDias} unit="días" min={1} />
          </Card>

          <Card num="08" title="Ley de ocupación — presión de pastoreo"
            desc="Equilibrio entre la oferta del parche y la demanda instantánea del lote."
            formula="Presión = (Demanda MS lote ÷ Oferta MS parcela) × 100"
            result={isNaN(presion) ? '—' : presion.toFixed(2)} unit="%" resultLabel="Presión de pastoreo">
            <Num label="Demanda MS del lote" value={demandaMS} onChange={setDemandaMS} unit="kg MS" step={100} />
            <Num label="Oferta MS parcela" value={ofertaMS} onChange={setOfertaMS} unit="kg MS" step={100} />
          </Card>

          <Card num="09" title="Disponibilidad forrajera (aforo)" rodeo
            desc="Método de cuadrante para estimar la materia seca disponible por hectárea."
            formula="Disponibilidad (kg MS/ha) = Peso verde × % MS"
            result={isNaN(disponHa) ? '—' : disponHa.toFixed(2)} unit="kg MS/ha" resultLabel="Disponibilidad">
            <Num label="Peso verde (muestra)" value={pesoVerde} onChange={setPesoVerde} unit="kg" step={100} />
            <Num label="% Materia seca" value={pctMS} onChange={setPctMS} unit="%" step={0.5} />
          </Card>
        </div>
      </div>

      {/* Ganadería tradicional */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Ganadería tradicional y extensiva</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="10" title="Carga animal estática" rodeo
            desc="Relación entre el total de cabezas y la superficie del establecimiento."
            formula="CA = Total de cabezas ÷ Superficie total (ha)"
            result={isNaN(CA) ? '—' : CA.toFixed(2)} unit="cab/ha" resultLabel="Carga animal">
            <Num label="Total de cabezas" value={cabezasTotal} onChange={setCabezasTotal} unit="cab." />
            <Num label="Superficie total" value={superfTotal} onChange={setSuperfTotal} unit="ha" step={10} />
          </Card>

          <Card num="11" title="Equivalente vaca (EV)" rodeo
            desc="Normalización del rodeo según requerimientos de mantenimiento. Vacas = 1,0 · Novillos = 1,0 · Terneros = 0,45 · Toros = 1,25."
            formula="EV/ha = Σ(Categoría × Coeficiente) ÷ Superficie total"
            result={isNaN(evHa) ? '—' : evHa.toFixed(2)} unit="EV/ha" resultLabel="Carga en EV/ha">
            <Num label="Vacas (×1,00)" value={vacas} onChange={setVacas} unit="cab." />
            <Num label="Novillos (×1,00)" value={novillos} onChange={setNovillos} unit="cab." />
            <Num label="Terneros (×0,45)" value={terneros} onChange={setTerneros} unit="cab." />
            <Num label="Toros (×1,25)" value={toros} onChange={setToros} unit="cab." />
          </Card>

          <Card num="12" title="Ganancia diaria de peso (GDP)"
            desc="Desempeño individual entre dos pesajes consecutivos."
            formula="GDP = (Peso final − Peso inicial) ÷ Días entre pesajes"
            result={isNaN(GDP) ? '—' : GDP.toFixed(2)} unit="kg/día" resultLabel="GDP">
            <Num label="Peso final" value={pesoFinal} onChange={setPesoFinal} unit="kg" step={5} />
            <Num label="Peso inicial" value={pesoInicial} onChange={setPesoInicial} unit="kg" step={5} />
            <Num label="Días entre pesajes" value={diasPesaje} onChange={setDiasPesaje} unit="días" />
          </Card>
        </div>
      </div>

      {/* Suplementación y reservas */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Suplementación, feedlot y reservas forrajeras</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="13" title="Índice de conversión alimenticia (ICA)"
            desc="Eficiencia de transformación de alimento en carne viva."
            formula="ICA = Alimento consumido (kg MS) ÷ Peso vivo ganado (kg)"
            result={isNaN(ICA) ? '—' : ICA.toFixed(2)} unit="kg MS/kg PV" resultLabel="Conversión">
            <Num label="Alimento consumido" value={alimentoConsumido} onChange={setAlimento} unit="kg MS" step={0.5} />
            <Num label="Peso vivo ganado" value={pvGanado} onChange={setPvGanado} unit="kg" step={0.1} />
          </Card>

          <Card num="14" title="Eficiencia de stock (stocking efficiency)"
            desc="Productividad global del sistema ganadero."
            formula="Eficiencia = Producción de carne (kg) ÷ Carga animal promedio (EV/ha)"
            result={isNaN(eficiencia) ? '—' : eficiencia.toFixed(2)} unit="kg/EV" resultLabel="Eficiencia">
            <Num label="Producción de carne" value={prodCarne} onChange={setProdCarne} unit="kg" step={500} />
            <Num label="Carga promedio" value={cargaPromEV} onChange={setCargaPromEV} unit="EV/ha" step={0.1} />
          </Card>

          <Card num="15" title="Balance forrajero estacional" rodeo
            desc="Comparación entre la oferta total (pastoreo + reservas) y la demanda del rodeo."
            formula="Balance = (Oferta pastoreo + Reservas) − Demanda del rodeo"
            result={isNaN(balance) ? '—' : (balance >= 0 ? '+' : '') + balance.toFixed(0)} unit="kg MS" resultLabel="Balance estacional">
            <Num label="Oferta de pastoreo" value={ofertaPastoreo} onChange={setOfertaPastoreo} unit="kg MS" step={1000} />
            <Num label="Reservas (silo/heno)" value={reservas} onChange={setReservas} unit="kg MS" step={1000} />
            <Num label="Demanda del rodeo" value={demandaRodeo} onChange={setDemandaRodeo} unit="kg MS" step={100} />
          </Card>

          <Card num="16" title="Días de autonomía de reservas" rodeo
            desc="Días que puede subsistir el rodeo exclusivamente con el stock de silo o heno."
            formula="Días = Stock silo o heno (kg MS) ÷ Consumo diario del rodeo"
            result={isNaN(diasAut) ? '—' : diasAut.toFixed(2)} unit="días" resultLabel="Autonomía">
            <Num label="Stock silo/heno" value={stockSilo} onChange={setStockSilo} unit="kg MS" step={5000} />
            <Num label="Consumo diario rodeo" value={consumoDiarioRodeo} onChange={setConsRodeo} unit="kg MS/día" step={100} />
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Fórmulas ─────────────────────────────────────────────────────────────

type SeccionFormulas = 'tecnicas' | 'ev' | 'agua' // | 'tambo'

const SECCIONES: { key: SeccionFormulas; label: string; desc: string }[] = [
  { key: 'tecnicas', label: '16 fórmulas técnicas', desc: 'Holístico, PRV y ganadería extensiva' },
  { key: 'ev',       label: 'EV por especie',        desc: 'Equivalente vaca con peso real' },
  { key: 'agua',     label: 'Balance hídrico',       desc: 'Demanda y bebederos por categoría' },
  // { key: 'tambo',    label: 'Tambo',                 desc: 'Indicadores lecheros y productivos' }, // Oculto por ahora
]

export function FormulasTab() {
  const [seccion, setSeccion] = useState<SeccionFormulas>('tecnicas')

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Segmented control — estilo Clima */}
      <div className="bg-gray-100 rounded-2xl p-1 flex gap-1 w-fit">
        {SECCIONES.map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => setSeccion(key)}
            className={clsx(
              'flex flex-col items-start px-4 py-2.5 rounded-xl text-left transition-all',
              seccion === key
                ? 'bg-white shadow-sm'
                : 'hover:bg-white/50'
            )}
          >
            <span className={clsx('text-xs font-bold leading-tight', seccion === key ? 'text-gray-900' : 'text-gray-500')}>
              {label}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 leading-tight hidden sm:block">{desc}</span>
          </button>
        ))}
      </div>

      {/* Nota sobre fórmulas propias */}
      <p className="text-xs text-gray-400">
        Las fórmulas marcadas con{' '}
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-green-100 text-green-700 border border-green-200 align-middle">✦ Rodeo</span>
        {' '}son las que utiliza internamente la aplicación para calcular métricas de planificación, EV y balance forrajero.
      </p>

      {/* Contenido según selección */}
      {seccion === 'tecnicas' && <TecnicasGrid />}
      {seccion === 'ev'       && <EvTab />}
      {seccion === 'agua'     && <HidricoTab />}
      {/* {seccion === 'tambo'    && <TamboTab />} */}
    </div>
  )
}
