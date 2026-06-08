'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useWeather } from '@/lib/context/WeatherContext'
import { SliderControl } from './components/SliderControl'
import { MetricCard } from './components/MetricCard'
import { ForageGauge } from './components/ForageGauge'
import { ScenarioComparison } from './components/ScenarioComparison'
import { FormulasTab } from './components/FormulasTab'
import { MiCampoTab } from './components/MiCampoTab'
import { EvTab }        from './components/EvTab'
import { HidricoTab }   from './components/HidricoTab'
import {
  runCalculator, getScenarioOverrides,
  type CalculatorInput, type CategoriaAnimal,
} from './calculatorEngine'
import clsx from 'clsx'

// ─── Defaults si no hay datos reales ────────────────────────────────────────

const DEFAULT_INPUT: CalculatorInput = {
  totalAreaHa: 500,
  headCount: 200,
  avgWeightKg: 450,
  categoria: 'VACAS',
  msKgHa: 2200,
  remnantMsKgHa: 900,
  dailyRationKgEv: 12,
  temperaturaC: 18,
  humidityPct: 65,
  rainfall7dMm: 20,
  forecastRainfall14dMm: 30,
  radiacionSolar: 18,
  windKmh: 15,
  ndvi: 0.50,
  droughtIndex: 'NONE',
  currentMonth: new Date().getMonth() + 1,
}

const CATEGORIAS: CategoriaAnimal[] = [
  'VACAS', 'NOVILLOS', 'NOVILLITOS', 'VAQUILLONAS',
  'TERNEROS', 'TERNERAS', 'TOROS', 'BUBALINOS',
]

const CATEGORIA_LABELS: Record<CategoriaAnimal, string> = {
  VACAS:       'Vacas',
  NOVILLOS:    'Novillos',
  NOVILLITOS:  'Novillitos',
  VAQUILLONAS: 'Vaquillonas',
  TERNEROS:    'Terneros',
  TERNERAS:    'Terneras',
  TOROS:       'Toros',
  BUBALINOS:   'Bubalinos',
}

const DROUGHT_LABELS: Record<string, string> = {
  NONE:     'Sin sequía',
  MILD:     'Leve',
  MODERATE: 'Moderada',
  SEVERE:   'Severa',
}

type ScenarioMode = 'base' | 'sequia' | 'optimo'

// ─── Componente principal ────────────────────────────────────────────────────

export default function CalculadoraPage() {
  const { user } = useAuth()
  const { current: weather, isLoading: weatherLoading } = useWeather()

  const [input, setInput] = useState<CalculatorInput>(DEFAULT_INPUT)
  const [realSources, setRealSources] = useState<Partial<Record<keyof CalculatorInput, boolean>>>({})
  const [paddocksData, setPaddocksData] = useState<any[]>([])
  const [herdsData, setHerdsData] = useState<any[]>([])
  const [scenario, setScenario] = useState<ScenarioMode>('base')
  const [showComparison, setShowComparison] = useState(false)
  type MainTab = 'formulas' | 'mi_campo' | 'proyecciones'
  const [activeTab, setActiveTab] = useState<MainTab>('mi_campo')
  const [loadingField, setLoadingField] = useState(true)
  const comparisonRef = useRef<HTMLDivElement>(null)

  // ── Cargar datos reales del campo ──────────────────────────────────────────
  const loadFieldData = useCallback(async () => {
    if (!user) return
    setLoadingField(true)
    try {
      const token = await user.getIdToken()

      // Potreros: área total y MS/ha promedio
      const paddocksRes = await fetch('/api/paddocks', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (paddocksRes.ok) {
        const { paddocks = [] } = await paddocksRes.json()
        const active = paddocks.filter((p: any) => p.is_active !== false)
        setPaddocksData(active)
        if (active.length > 0) {
          const totalArea = active.reduce((s: number, p: any) => s + (Number(p.area_ha) || 0), 0)
          const avgMs = active
            .filter((p: any) => p.dry_matter_kg_ha)
            .reduce((s: number, p: any, _: any, arr: any[]) =>
              s + (Number(p.dry_matter_kg_ha) || 0) / arr.length, 0)
          const avgNdvi = active
            .filter((p: any) => p.current_ndvi)
            .reduce((s: number, p: any, _: any, arr: any[]) =>
              s + (Number(p.current_ndvi) || 0) / arr.length, 0)

          setInput(prev => ({
            ...prev,
            ...(totalArea > 0 ? { totalAreaHa: Math.round(totalArea) } : {}),
            ...(avgMs > 0     ? { msKgHa: Math.round(avgMs) }          : {}),
            ...(avgNdvi > 0   ? { ndvi: parseFloat(avgNdvi.toFixed(2)) }: {}),
          }))
          setRealSources(prev => ({
            ...prev,
            ...(totalArea > 0 ? { totalAreaHa: true } : {}),
            ...(avgMs > 0     ? { msKgHa: true }       : {}),
            ...(avgNdvi > 0   ? { ndvi: true }          : {}),
          }))
        }
      }

      // Rodeos: cabezas totales y peso promedio
      const herdsRes = await fetch('/api/herds', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (herdsRes.ok) {
        const { herds = [] } = await herdsRes.json()
        setHerdsData(herds)
        if (herds.length > 0) {
          const totalHead = herds.reduce((s: number, h: any) => s + (Number(h.head_count) || 0), 0)
          const avgWeight = herds.reduce((s: number, h: any, _: any, arr: any[]) =>
            s + (Number(h.avg_weight_kg) || 450) / arr.length, 0)
          const topCategoria = (herds[0]?.categoria?.toUpperCase() ?? 'VACAS') as CategoriaAnimal

          setInput(prev => ({
            ...prev,
            ...(totalHead > 0 ? { headCount: totalHead }                              : {}),
            ...(avgWeight > 0 ? { avgWeightKg: Math.round(avgWeight) }                : {}),
            ...(CATEGORIAS.includes(topCategoria) ? { categoria: topCategoria }        : {}),
          }))
          setRealSources(prev => ({
            ...prev,
            ...(totalHead > 0 ? { headCount: true, avgWeightKg: true } : {}),
          }))
        }
      }
    } catch (e) {
      // Falla silenciosa — se usan valores por defecto
    } finally {
      setLoadingField(false)
    }
  }, [user])

  // ── Inyectar datos meteorológicos reales ───────────────────────────────────
  useEffect(() => {
    if (weather && !weatherLoading) {
      setInput(prev => ({
        ...prev,
        temperaturaC:  weather.tempC,
        humidityPct:   weather.humidityPct,
        windKmh:       weather.windSpeedKmh,
      }))
      setRealSources(prev => ({
        ...prev,
        temperaturaC: true,
        humidityPct:  true,
        windKmh:      true,
      }))
    }
  }, [weather, weatherLoading])

  useEffect(() => { loadFieldData() }, [loadFieldData])

  useEffect(() => {
    import('@/lib/analytics').then(({ event }) => event({ action: 'calculadora_tab_view', category: 'calculadora', tab: activeTab }))
  }, [activeTab])

  // ── Calcular resultados ────────────────────────────────────────────────────
  const activeInput = useMemo<CalculatorInput>(() => {
    if (scenario === 'base') return input
    return { ...input, ...getScenarioOverrides(scenario, input) }
  }, [input, scenario])

  const result    = useMemo(() => runCalculator(activeInput), [activeInput])
  const resultSeq = useMemo(() => runCalculator({ ...input, ...getScenarioOverrides('sequia', input) }), [input])
  const resultOpt = useMemo(() => runCalculator({ ...input, ...getScenarioOverrides('optimo', input) }), [input])

  const set = <K extends keyof CalculatorInput>(key: K, val: CalculatorInput[K]) => {
    setInput(prev => ({ ...prev, [key]: val }))
    // Al editar manualmente, quita el tag «dato real»
    setRealSources(prev => ({ ...prev, [key]: false }))
    import('@/lib/analytics').then(({ event }) => event({ action: 'calculadora_input_change', category: 'calculadora', field: key as string }))
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 pb-32 lg:pb-12">

      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-950">Calculadora</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-2xl">
          Simulación de carga animal y autonomía forrajera en tiempo real,
          más herramientas de cálculo técnico para EV, balance hídrico y gestión del pastoreo.
        </p>
      </div>

      {/* ── Tabs estilo Clima (pill) ──────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {([
          { id: 'mi_campo',     label: 'Mi Campo' },
          { id: 'proyecciones', label: 'Proyecciones Globales' },
          { id: 'formulas',     label: 'Fórmulas Teóricas' },
        ] as { id: MainTab; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all',
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Fórmulas ─────────────────────────────────────────────────── */}
      {activeTab === 'formulas' && <FormulasTab />}

      {/* ── Tab Mi Campo ─────────────────────────────────────────────────── */}
      {activeTab === 'mi_campo' && <MiCampoTab paddocks={paddocksData} herds={herdsData} input={input} result={result} onChangeInput={set} />}

      {/* ── Tab Proyecciones ─────────────────────────────────────────────── */}
      {activeTab === 'proyecciones' && (
        <>
          {/* ── Selector de escenario — estilo Clima ─────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 font-medium mr-1">Escenario:</span>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
              {(['base', 'sequia', 'optimo'] as ScenarioMode[]).map(s => (
                <button
                  key={s}
                  onClick={() => {
                    import('@/lib/analytics').then(({ event }) => event({ action: 'calculadora_scenario_change', category: 'calculadora', scenario: s }))
                    setScenario(s)
                  }}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    scenario === s
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {s === 'base' ? 'Base (actual)' : s === 'sequia' ? 'Sequía' : 'Óptimo'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const willShow = !showComparison
                import('@/lib/analytics').then(({ event }) => event({ action: 'calculadora_compare_toggle', category: 'calculadora', show: willShow }))
                setShowComparison(willShow)
                if (willShow) {
                  setTimeout(() => {
                    comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 100)
                }
              }}
              className={clsx(
                'ml-auto px-4 py-1.5 rounded-xl text-xs font-bold transition-all border',
                showComparison
                  ? 'bg-green-50 text-green-800 border-green-400'
                  : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
              )}
            >
              {showComparison ? 'Ocultar comparación' : 'Comparar escenarios'}
            </button>
          </div>

          {/* ── Alerta climática ─────────────────────────────────────────── */}
          {result.alertMessage && (
            <div className={clsx(
              'rounded-xl px-4 py-3 border text-xs',
              result.alertLevel === 'critical'
                ? 'bg-red-50 border-red-200 text-red-700'
                : result.alertLevel === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            )}>
              {result.alertMessage}
            </div>
          )}

          {/* ── Layout principal: controles + resultados ──────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">

            {/* ── Panel de controles ──────────────────────────────────── */}
            <div className="space-y-5 order-2 lg:order-1">

              <Section title="Campo y superficie">
                <SliderControl
                  id="totalAreaHa"
                  label="Superficie total"
                  value={input.totalAreaHa}
                  min={10} max={5000} step={10}
                  unit="ha"
                  source={realSources.totalAreaHa ? 'real' : undefined}
                  tooltip="Superficie total grazable del establecimiento. Se usa para calcular carga por ha y stock total de MS."
                  onChange={v => set('totalAreaHa', v)}
                />
              </Section>

              <Section title="Rodeo">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SliderControl
                    id="headCount"
                    label="Cabezas"
                    value={input.headCount}
                    min={1} max={5000} step={1}
                    unit="cab."
                    source={realSources.headCount ? 'real' : undefined}
                    tooltip="Total de animales del rodeo. Junto con el peso y la categoría determina los equivalentes vaca totales."
                    onChange={v => set('headCount', v)}
                  />
                  <SliderControl
                    id="avgWeightKg"
                    label="Peso promedio"
                    value={input.avgWeightKg}
                    min={100} max={800} step={5}
                    unit="kg"
                    source={realSources.avgWeightKg ? 'real' : undefined}
                    tooltip="Peso vivo promedio del rodeo. Afecta el factor EV mediante la fórmula (peso/450)^0.75."
                    onChange={v => set('avgWeightKg', v)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500 font-medium">Categoría del rodeo</label>
                    <select
                      id="categoria"
                      value={input.categoria}
                      onChange={e => set('categoria', e.target.value as CategoriaAnimal)}
                      className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 transition-colors"
                    >
                      {CATEGORIAS.map(c => (
                        <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400">Factor EV base: Vacas=1,0 · Novillos=1,0 · Toros=1,25 · Terneros=0,45</p>
                  </div>
                  <SliderControl
                    id="dailyRationKgEv"
                    label="Ración diaria"
                    value={input.dailyRationKgEv}
                    min={6} max={20} step={0.5} decimals={1}
                    unit="kg MS/EV"
                    tooltip="Kilogramos de materia seca asignados por día a cada equivalente vaca. Rango típico: 10–14 kg MS/EV."
                    hint="Asignación diaria por equivalente vaca"
                    onChange={v => set('dailyRationKgEv', v)}
                  />
                </div>
              </Section>

              <Section title="Disponibilidad forrajera">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SliderControl
                    id="msKgHa"
                    label="MS disponible"
                    value={input.msKgHa}
                    min={300} max={6000} step={50}
                    unit="kg MS/ha"
                    source={realSources.msKgHa ? 'real' : undefined}
                    tooltip="Materia seca en pie por hectárea al momento del ingreso al potrero. Valor satelital o medido con disco."
                    onChange={v => set('msKgHa', v)}
                  />
                  <SliderControl
                    id="remnantMsKgHa"
                    label="Remanente objetivo"
                    value={input.remnantMsKgHa}
                    min={500} max={2000} step={50}
                    unit="kg MS/ha"
                    tooltip="Piso biológico mínimo que debe quedar al salir del potrero. Protege el punto de crecimiento de la planta. Valor recomendado: 900–1200 kg MS/ha."
                    hint="Piso biológico mínimo al salir del potrero"
                    onChange={v => set('remnantMsKgHa', v)}
                  />
                </div>
                <SliderControl
                  id="ndvi"
                  label="NDVI actual"
                  value={input.ndvi}
                  min={0} max={1} step={0.01} decimals={2}
                  source={realSources.ndvi ? 'real' : undefined}
                  tooltip="Índice de diferencia de vegetación normalizada (satélite). 0 = suelo desnudo, 1 = vegetación densa. Afecta el escurrimiento y el multiplicador de crecimiento."
                  hint={`Cobertura vegetal — ${input.ndvi < 0.25 ? 'suelo crítico' : input.ndvi < 0.45 ? 'cobertura baja' : input.ndvi < 0.65 ? 'cobertura media' : 'cobertura alta'}`}
                  onChange={v => set('ndvi', v)}
                />
              </Section>

              <Section title="Variables climáticas">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SliderControl
                    id="temperaturaC"
                    label="Temperatura media"
                    value={input.temperaturaC}
                    min={-5} max={45} step={0.5} decimals={1}
                    unit="°C"
                    source={realSources.temperaturaC ? 'real' : undefined}
                    tooltip="Temperatura diaria media. El rango óptimo de crecimiento para gramíneas de la Pampa es 15–22 °C."
                    onChange={v => set('temperaturaC', v)}
                  />
                  <SliderControl
                    id="humidityPct"
                    label="Humedad relativa"
                    value={input.humidityPct}
                    min={10} max={100} step={1}
                    unit="%"
                    source={realSources.humidityPct ? 'real' : undefined}
                    tooltip="Humedad relativa del aire. Influye en la evapotranspiración: a mayor humedad, menor ET y menor pérdida de agua del suelo."
                    onChange={v => set('humidityPct', v)}
                  />
                  <SliderControl
                    id="rainfall7dMm"
                    label="Lluvia acumulada 7 días"
                    value={input.rainfall7dMm}
                    min={0} max={150} step={1}
                    unit="mm"
                    tooltip="Precipitación total de los últimos 7 días. Se usa para calcular el balance hídrico y la precipitación efectiva según el NDVI del potrero."
                    onChange={v => set('rainfall7dMm', v)}
                  />
                  <SliderControl
                    id="forecastRainfall14dMm"
                    label="Pronóstico 14 días"
                    value={input.forecastRainfall14dMm}
                    min={0} max={200} step={5}
                    unit="mm"
                    tooltip="Lluvia esperada en los próximos 14 días según pronóstico. Influye en la proyección de autonomía forrajera futura."
                    onChange={v => set('forecastRainfall14dMm', v)}
                  />
                  <SliderControl
                    id="radiacionSolar"
                    label="Radiación solar"
                    value={input.radiacionSolar}
                    min={5} max={35} step={0.5} decimals={1}
                    unit="MJ/m²/día"
                    tooltip="Energía solar incidente por día. Junto con la temperatura determina la evapotranspiración potencial (método Hargreaves)."
                    onChange={v => set('radiacionSolar', v)}
                  />
                  <SliderControl
                    id="windKmh"
                    label="Velocidad del viento"
                    value={input.windKmh}
                    min={0} max={80} step={1}
                    unit="km/h"
                    source={realSources.windKmh ? 'real' : undefined}
                    tooltip="Velocidad media del viento. El viento acelera la evapotranspiración, reduciendo el agua disponible para el pasto."
                    onChange={v => set('windKmh', v)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 font-medium">Índice de sequía</label>
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
                    {(['NONE', 'MILD', 'MODERATE', 'SEVERE'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => set('droughtIndex', d)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                          input.droughtIndex === d
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                      >
                        {DROUGHT_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
            </div>

            {/* ── Panel de resultados ──────────────────────────────────── */}
            <div className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-4">

              {/* Medidor principal */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm">
                <ForageGauge result={result} />
                <div className="w-full grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs border-t border-gray-50 pt-3">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Estación</p>
                    <p className="font-semibold text-gray-700 capitalize">{result.season.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Multiplicador climático</p>
                    <p className="font-semibold text-gray-700">×{result.climateMultiplier}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">ET estimada</p>
                    <p className="font-semibold text-gray-700">{result.et} mm/día</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Balance hídrico 7 d</p>
                    <p className={clsx('font-semibold', result.balanceHidricoMm >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {result.balanceHidricoMm >= 0 ? '+' : ''}{result.balanceHidricoMm} mm
                    </p>
                  </div>
                </div>
              </div>

              {/* Equivalentes vaca — destacado */}
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
                <p className="text-[11px] text-gray-400 font-medium mb-1">Equivalentes vaca totales</p>
                <p className="text-3xl font-black text-gray-900 tabular-nums leading-none">
                  {result.totalEv.toFixed(1)}
                  <span className="text-base font-semibold text-gray-400 ml-2">EV</span>
                </p>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 pt-3 mt-3 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Crecimiento total</p>
                    <p className="text-xs font-semibold text-gray-700">{result.crecimientoDiarioTotal.toFixed(0)} kg MS/día</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Precip. efectiva</p>
                    <p className="text-xs font-semibold text-gray-700">{result.precipEfectivaMm.toFixed(1)} mm</p>
                  </div>
                </div>
              </div>

              {/* Métricas — grid 2 col con más espacio */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Carga diaria"
                  value={result.cargaDiariaEvHa.toFixed(2)}
                  unit="EV/ha"
                  alert={result.cargaDiariaEvHa > 3 ? 'warning' : 'ok'}
                  tooltip="Equivalentes vaca por hectárea. Valores típicos: 0,8–1,5 EV/ha en sistemas extensivos, hasta 3 EV/ha en intensivos."
                />
                <MetricCard
                  label="Día animal"
                  value={result.diaAnimalKg.toFixed(1)}
                  unit="kg MS/cab."
                  tooltip="Materia seca consumida por cabeza por día, corregida por el peso y la categoría real del rodeo."
                />
                <MetricCard
                  label="Consumo diario"
                  value={result.consumoDiarioKg.toFixed(0)}
                  unit="kg MS/día"
                  tooltip="Total de materia seca que demanda el rodeo completo en un día. Es la suma de EV × ración diaria."
                />
                <MetricCard
                  label="Tasa de crecimiento"
                  value={result.tasaCrecimientoKgHaDia.toFixed(1)}
                  unit="kg MS/ha/día"
                  tooltip="Velocidad de rebrote del pastizal según estación del año, temperatura, balance hídrico y cobertura NDVI."
                />
                <MetricCard
                  label="Balance neto"
                  value={(result.balanceNetoKgHaDia >= 0 ? '+' : '') + result.balanceNetoKgHaDia.toFixed(1)}
                  unit="kg MS/ha/día"
                  alert={result.balanceNetoKgHaDia < -3 ? 'warning' : 'ok'}
                  tooltip="Crecimiento diario menos consumo por ha. Positivo: el pasto se regenera más rápido de lo que se consume. Negativo: el stock se agota."
                  sub={result.balanceNetoTotal >= 0
                    ? `+${result.balanceNetoTotal.toFixed(0)} kg/día en todo el campo`
                    : `${result.balanceNetoTotal.toFixed(0)} kg/día en todo el campo`}
                />
                <MetricCard
                  label="Stock aprovechable"
                  value={result.stockAprovechableKg.toFixed(0)}
                  unit="kg MS"
                  tooltip="MS disponible por encima del remanente mínimo, con eficiencia de cosecha del 60 %. Es la reserva real que puede consumir el rodeo."
                  sub={`${result.stockTotalKg.toFixed(0)} kg total en campo`}
                />
              </div>
            </div>
          </div>

          {/* ── Comparación de escenarios ───────────────────────────────── */}
          {showComparison && (
            <div ref={comparisonRef} className="bg-white border border-gray-100 rounded-2xl overflow-hidden mt-6 scroll-mt-6 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-800">Comparación de escenarios</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Sequía vs. condiciones óptimas, calculadas sobre la base actual del campo.
                  Los valores de lluvia, NDVI, temperatura y sequía se ajustan automáticamente.
                </p>
              </div>
              <div className="p-5">
                <ScenarioComparison
                  scenarioA={{ label: 'Sequía', result: resultSeq }}
                  scenarioB={{ label: 'Óptimo', result: resultOpt }}
                />
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}

// ─── Componente auxiliar Section ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-5 shadow-sm">
      <h3 className="text-[20px] font-black text-gray-900 border-b border-gray-100 pb-3">{title}</h3>
      {children}
    </div>
  )
}
