'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useWeatherEvents } from './hooks/useWeatherEvents'
import { WeatherWidget }          from './components/WeatherWidget'
import { ClimateGrowthChart }     from './components/ClimateGrowthChart'
import { ClimateAdjustmentPanel } from './components/ClimateAdjustmentPanel'
import { WeatherHistoryTable }    from './components/WeatherHistoryTable'
import { FeatureGate } from '@/components/FeatureGate'
import { apiFetch } from '@/lib/apiFetch'
import { useWeather } from '@/lib/context/WeatherContext'
import WeatherConditionChip from '@/components/WeatherConditionChip'
import {
  Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer, Droplets,
  Leaf, TrendingUp, TrendingDown, Minus, BarChart3, Users, Clock,
  AlertTriangle, CheckCircle2, ArrowRight,
} from 'lucide-react'

// ── Tab definition ─────────────────────────────────────────────────────────────
type Tab = 'resumen' | 'potreros' | 'rodeos' | 'historial'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'resumen',   label: 'Resumen',   icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'potreros',  label: 'Potreros',  icon: <Leaf className="w-3.5 h-3.5" /> },
  { id: 'rodeos',    label: 'Rodeos',    icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'historial', label: 'Historial', icon: <Clock className="w-3.5 h-3.5" /> },
]

// ── Matriz de impacto: variable × entidad ─────────────────────────────────────

const MATRIX_ROWS = [
  {
    variable: 'Temperatura alta',
    icon: <Thermometer className="w-4 h-4 text-orange-500" />,
    pastoImpact: 'Crecimiento lento',
    pastoDir: 'down' as const,
    animalImpact: 'Estrés calórico',
    animalDir: 'down' as const,
    note: 'THI > 72 reduce consumo animal',
  },
  {
    variable: 'Temperatura baja',
    icon: <CloudSnow className="w-4 h-4 text-sky-500" />,
    pastoImpact: 'Crecimiento detenido',
    pastoDir: 'down' as const,
    animalImpact: 'Gasto energético ↑',
    animalDir: 'down' as const,
    note: 'Helada < 2°C: pasto congelado',
  },
  {
    variable: 'Lluvia',
    icon: <CloudRain className="w-4 h-4 text-blue-500" />,
    pastoImpact: 'Crecimiento activo',
    pastoDir: 'up' as const,
    animalImpact: 'Estrés por barro',
    animalDir: 'neutral' as const,
    note: '>10mm activa el rebrote en 3–5d',
  },
  {
    variable: 'Humedad alta',
    icon: <Droplets className="w-4 h-4 text-blue-400" />,
    pastoImpact: 'Mejora el rebrote',
    pastoDir: 'up' as const,
    animalImpact: 'Amplifica estrés calórico',
    animalDir: 'down' as const,
    note: 'THI depende de temp + humedad',
  },
  {
    variable: 'Viento fuerte',
    icon: <Wind className="w-4 h-4 text-gray-500" />,
    pastoImpact: 'Aumenta ET: estrés hídrico',
    pastoDir: 'down' as const,
    animalImpact: 'Estrés por frío/costo E.',
    animalDir: 'down' as const,
    note: '>50 km/h: gran impacto en gasto',
  },
  {
    variable: 'Radiación solar',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
    pastoImpact: 'Fotosíntesis óptima',
    pastoDir: 'up' as const,
    animalImpact: 'Amplifica estrés calórico',
    animalDir: 'neutral' as const,
    note: 'Alta radiación + calor = estrés',
  },
]

function DirIcon({ dir }: { dir: 'up' | 'down' | 'neutral' }) {
  if (dir === 'up')   return <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />
  if (dir !== 'down') return <Minus         className="w-3.5 h-3.5 text-amber-500" />
  return                     <TrendingDown  className="w-3.5 h-3.5 text-red-500" />
}

// ── Current conditions KPI bar ────────────────────────────────────────────────

function CurrentConditionsBar() {
  const { current, locationName, isLoading } = useWeather()
  if (isLoading) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
    </div>
  )
  if (!current) return null

  const thi = (() => {
    const dp = current.tempC - (100 - current.humidityPct) / 5
    return parseFloat((current.tempC + 0.36 * dp + 41.5).toFixed(1))
  })()

  const kpis = [
    { label: 'Temperatura', value: `${Math.round(current.tempC)}°C`,          sub: `Sensación ${Math.round(current.feelsLikeC)}°C`, Icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Humedad',     value: `${Math.round(current.humidityPct)}%`,      sub: current.conditionLabel,                           Icon: Droplets,    color: 'text-blue-500',   bg: 'bg-blue-50'   },
    { label: 'Viento',      value: `${Math.round(current.windSpeedKmh)} km/h`, sub: current.windDirection,                            Icon: Wind,        color: 'text-gray-500',   bg: 'bg-gray-50'   },
    { label: 'Índice THI',  value: `${thi}`,                                   sub: thi > 80 ? 'Estrés severo' : thi > 72 ? 'Estrés moderado' : 'Zona confort', Icon: BarChart3, color: thi > 80 ? 'text-red-500' : thi > 72 ? 'text-orange-500' : 'text-emerald-500', bg: thi > 72 ? 'bg-orange-50' : 'bg-emerald-50' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map(({ label, value, sub, Icon, color, bg }) => (
        <div key={label} className={`rounded-2xl border border-gray-100 p-4 ${bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
          </div>
          <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────────────────────

function TabResumen({ orgName }: { orgName: string | null }) {
  const { current } = useWeather()

  return (
    <div className="space-y-6">
      {/* Widget actual + gráfico de crecimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <WeatherWidget />
        <ClimateGrowthChart baseGrowthRate={20} />
      </div>

      {/* KPIs actuales */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Condiciones en tiempo real</p>
        <CurrentConditionsBar />
      </div>

      {/* Matriz de impacto climático */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">Matriz de Impacto Climático</h2>
            <p className="text-[10px] text-gray-400 font-medium">Cómo afectan las variables climáticas al pasto y a los animales</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Variable climática</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5"><Leaf className="w-3 h-3" />Impacto en Pasto</div>
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-orange-600 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5"><Users className="w-3 h-3" />Impacto en Animal</div>
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Nota</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {row.icon}
                      <span className="font-bold text-gray-800 text-xs">{row.variable}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <DirIcon dir={row.pastoDir} />
                      <span className={`text-xs font-bold ${row.pastoDir === 'up' ? 'text-emerald-700' : row.pastoDir === 'down' ? 'text-red-700' : 'text-amber-700'}`}>
                        {row.pastoImpact}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <DirIcon dir={row.animalDir} />
                      <span className={`text-xs font-bold ${row.animalDir === 'up' ? 'text-emerald-700' : row.animalDir === 'down' ? 'text-red-700' : 'text-amber-700'}`}>
                        {row.animalImpact}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] text-gray-400 font-medium">{row.note}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-gray-500 font-medium">
            Los efectos se combinan: calor + humedad + viento pueden triplicar el impacto sobre el rodeo.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Potreros ─────────────────────────────────────────────────────────────

function TabPotreros({ onSaveWeatherEvent, orgName }: { onSaveWeatherEvent: any; orgName: string | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
        <Leaf className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-xs font-black text-emerald-800">Ajuste Climático por Potrero</p>
          <p className="text-[10px] text-emerald-700 font-medium">
            Crecimiento en kg MS/ha/d ajustado por NDVI, lluvia, humedad y temperatura. Expandí cada potrero para ver el historial y registrar lluvia o helada.
          </p>
        </div>
      </div>
      <ClimateAdjustmentPanel
        showGlobalSummary
        orgName={orgName}
        onSaveWeatherEvent={onSaveWeatherEvent}
      />
    </div>
  )
}

// ── Tab: Rodeos ───────────────────────────────────────────────────────────────

function TabRodeos() {
  const { current, isLoading } = useWeather()
  const [herds, setHerds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/herds')
      .then(r => r.ok ? r.json() : { herds: [] })
      .then(d => setHerds(d.herds ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const thi = useMemo(() => {
    if (!current) return null
    const dp = current.tempC - (100 - current.humidityPct) / 5
    return parseFloat((current.tempC + 0.36 * dp + 41.5).toFixed(1))
  }, [current])

  const thiLabel = !thi ? '—' : thi > 80 ? 'Estrés severo' : thi > 72 ? 'Estrés moderado' : 'Confort'
  const thiColor = !thi ? 'text-gray-400' : thi > 80 ? 'text-red-600' : thi > 72 ? 'text-orange-600' : 'text-emerald-600'
  const consumptionAdj = thi && thi > 72 ? Math.round(Math.min(25, (thi - 72) * 1.2) * -1) : 0
  const coldStress = current && (current.tempC < 8 || (current.tempC < 12 && current.windSpeedKmh > 20))
  const energyAdj = current && coldStress ? Math.round((Math.min(0.12, current.windSpeedKmh / 300) + (current.tempC! < 5 ? 0.15 : 0.08)) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Banner de bienestar actual */}
      {current && (
        <div className={`rounded-2xl border p-5 ${consumptionAdj < 0 ? 'bg-orange-50 border-orange-200' : energyAdj > 0 ? 'bg-sky-50 border-sky-200' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${consumptionAdj < 0 ? 'bg-orange-100' : energyAdj > 0 ? 'bg-sky-100' : 'bg-emerald-100'}`}>
              {consumptionAdj < 0 ? <Thermometer className="w-6 h-6 text-orange-600" /> : energyAdj > 0 ? <CloudSnow className="w-6 h-6 text-sky-600" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Estado de bienestar animal · Ahora</p>
              <p className={`text-lg font-black leading-tight ${thiColor}`}>{thiLabel}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {consumptionAdj < 0
                  ? `Consumo reducido estimado: ${consumptionAdj}% · Índice THI: ${thi}`
                  : energyAdj > 0
                  ? `Gasto energético adicional: +${energyAdj}% · Temp ${Math.round(current.tempC)}°C`
                  : `Sin ajustes de consumo. Condiciones óptimas para el rodeo.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grilla de rodeos con chip de clima */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Estado por rodeo</p>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : herds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">Sin rodeos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {herds.map(herd => (
              <div key={herd.id} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-gray-900">{herd.name}</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    {Math.round(herd.head_count ?? 0).toLocaleString('es-AR')} cab. · {Number(herd.total_ev ?? 0).toFixed(1)} EV
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <WeatherConditionChip mode="herd" entityName={herd.name} />
                  {consumptionAdj < 0 && (
                    <div className="text-right">
                      <p className="text-[10px] font-black text-red-600">{consumptionAdj}%</p>
                      <p className="text-[9px] text-gray-400">consumo</p>
                    </div>
                  )}
                  {energyAdj > 0 && (
                    <div className="text-right">
                      <p className="text-[10px] font-black text-sky-600">+{energyAdj}%</p>
                      <p className="text-[9px] text-gray-400">energía</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla THI de referencia */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-black text-gray-700">Referencia índice THI (Temperature-Humidity Index)</p>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">Cuándo actuar según las condiciones climáticas</p>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { range: 'THI < 72', label: 'Zona de confort', action: 'Sin acción requerida', color: 'bg-emerald-50', text: 'text-emerald-700' },
            { range: 'THI 72–79', label: 'Estrés moderado', action: 'Revisar sombra y agua fresca', color: 'bg-yellow-50', text: 'text-yellow-700' },
            { range: 'THI 80–89', label: 'Estrés severo', action: 'Limitar actividad y reducir carga', color: 'bg-orange-50', text: 'text-orange-700' },
            { range: 'THI ≥ 90', label: 'Estrés crítico', action: 'Riesgo de mortalidad. Acción inmediata.', color: 'bg-red-50', text: 'text-red-700' },
          ].map(r => (
            <div key={r.range} className={`px-5 py-3 flex items-center justify-between ${r.color}`}>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-black ${r.text}`}>{r.range}</span>
                <span className={`text-[10px] font-bold ${r.text} opacity-80`}>{r.label}</span>
              </div>
              <p className={`text-[10px] font-medium ${r.text} opacity-70`}>{r.action}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClimaPage() {
  const { events, isLoading, createEvent } = useWeatherEvents()
  const [orgName, setOrgName] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('resumen')

  useEffect(() => {
    apiFetch('/api/organizations')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.organization?.name) setOrgName(d.organization.name) })
      .catch(() => {})
  }, [])

  return (
    <FeatureGate
      feature="clima"
      title="Módulo de clima y alertas"
      description="Registrá lluvias, heladas y consultá el pronóstico integrado. Disponible desde el plan Brote."
      requiredPlan="Brote"
    >
      <div className="flex flex-col gap-5 pb-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Clima</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">
            {orgName ? `${orgName} · ` : ''}Condiciones actuales · Ajuste por potrero y rodeo · Historial
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'resumen' && <TabResumen orgName={orgName} />}
        {activeTab === 'potreros' && <TabPotreros onSaveWeatherEvent={createEvent} orgName={orgName} />}
        {activeTab === 'rodeos' && <TabRodeos />}
        {activeTab === 'historial' && (
          <section aria-label="Historial de registros">
            <WeatherHistoryTable events={events} isLoading={isLoading} />
          </section>
        )}

      </div>
    </FeatureGate>
  )
}
