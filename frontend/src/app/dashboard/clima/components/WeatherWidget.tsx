'use client'

import { CloudRain, Snowflake, Cloud, Wind, Droplets, MapPin, RefreshCw } from 'lucide-react'
import { useWeather, CONDITION_EMOJI } from '@/lib/context/WeatherContext'
import clsx from 'clsx'

const CONDITION_ICON: Record<string, React.ComponentType<any>> = {
  SUNNY:         () => <span className="text-2xl">☀️</span>,
  PARTLY_CLOUDY: () => <span className="text-2xl">⛅</span>,
  CLOUDY:        Cloud,
  RAINY:         CloudRain,
  STORMY:        CloudRain,
  FOGGY:         Cloud,
  WINDY:         Wind,
  SNOWY:         Snowflake,
}

const CONDITION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  SUNNY:         { text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  PARTLY_CLOUDY: { text: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100'   },
  CLOUDY:        { text: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-100'  },
  RAINY:         { text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'  },
  STORMY:        { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100'},
  FOGGY:         { text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-100' },
  WINDY:         { text: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-100'  },
  SNOWY:         { text: 'text-blue-400',   bg: 'bg-blue-50',   border: 'border-blue-100'  },
}

function formatShortDate(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
}

export function WeatherWidget() {
  const { current, forecast, locationName, locationSource, isLoading, error, refetch } = useWeather()
  const condition = current?.condition ?? 'PARTLY_CLOUDY'
  const cfg = CONDITION_COLORS[condition] ?? CONDITION_COLORS.PARTLY_CLOUDY

  if (isLoading) return (
    <div className="bg-white rounded-2xl p-5 animate-pulse border border-gray-100">
      <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
      <div className="h-14 w-24 bg-gray-100 rounded mb-4" />
      <div className="flex gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 flex-1 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  )

  if (error || !current) return (
    <div className="bg-white rounded-2xl p-5 text-center border border-gray-100">
      <CloudRain className="w-8 h-8 text-gray-200 mx-auto mb-2" />
      <p className="text-sm font-bold text-gray-400">No se pudo cargar el clima</p>
      <button onClick={refetch} className="mt-2 text-xs text-green-600 font-bold hover:underline flex items-center gap-1 mx-auto">
        <RefreshCw className="w-3 h-3" /> Reintentar
      </button>
    </div>
  )

  const next5 = forecast.filter(d => !d.isPast).slice(0, 5)

  return (
    <div className={clsx('bg-white rounded-2xl overflow-hidden border flex flex-col h-full', cfg.border)}>
      {/* Current conditions */}
      <div className={clsx('px-5 pt-5 pb-4 flex-1', cfg.bg)}>
        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3">
          <MapPin className="w-3 h-3 text-gray-400" />
          <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase truncate">
            {locationName ?? 'Campo'}
          </p>
        </div>

        {/* Temp + icon */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-end gap-3">
            <span className="text-6xl font-black text-gray-900 leading-none">{current.tempC}°</span>
            <div className="pb-1">
              <p className={clsx('text-sm font-bold', cfg.text)}>{current.conditionLabel}</p>
              <p className="text-xs text-gray-400 font-semibold">Sensación {current.feelsLikeC}°C</p>
            </div>
          </div>
          <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center shrink-0', cfg.bg)}>
            {(() => {
              const IconComp = CONDITION_ICON[condition]
              return IconComp ? <IconComp className={clsx('w-9 h-9', cfg.text)} /> : <span className="text-3xl">{CONDITION_EMOJI[condition] ?? '🌡️'}</span>
            })()}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 flex-wrap">
          <StatPill Icon={Droplets} value={`${current.humidityPct}%`}      label="Humedad" />
          <StatPill Icon={Wind}     value={`${current.windSpeedKmh} km/h`} label={current.windDirection !== '—' ? `Viento ${current.windDirection}` : 'Viento'} />
        </div>
      </div>

      {/* Forecast strip */}
      {next5.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <div className="grid grid-cols-5 gap-1">
            {next5.map((day, i) => (
              <div key={i} className="text-center py-2 rounded-xl hover:bg-gray-50 transition-colors">
                <p className="text-[10px] font-bold text-gray-400 capitalize leading-none">{formatShortDate(day.date)}</p>
                <p className="text-base my-1">{CONDITION_EMOJI[day.condition] ?? '🌡️'}</p>
                <p className="text-[11px] font-black text-gray-800">{day.maxTempC}°</p>
                <p className="text-[10px] text-gray-400 font-semibold">{day.minTempC}°</p>
                {day.precipitationMm > 0 && (
                  <p className="text-[9px] text-blue-500 font-black mt-0.5">{day.precipitationMm}mm</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer — fuente de coordenadas */}
      <div className="px-5 pb-3 space-y-2">
        {locationSource === 'fallback' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="text-amber-500 mt-0.5 shrink-0 text-[10px]">!</span>
            <div>
              <p className="text-[10px] font-black text-amber-700 leading-snug">
                Clima aproximado — ubicación del campo no configurada
              </p>
              <a href="/dashboard/mi-campo" className="text-[9px] text-amber-600 font-bold hover:underline">
                Configurar coordenadas del campo →
              </a>
            </div>
          </div>
        )}
        <p className="flex items-center gap-1 text-[10px] text-gray-300 font-semibold">
          <RefreshCw className="w-2.5 h-2.5 shrink-0" />
          {locationSource === 'org'
            ? 'Datos del campo real · Open-Meteo'
            : 'Open-Meteo'
          } · {new Date(current.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function StatPill({ Icon, value, label }: { Icon: React.ComponentType<any>; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      <div>
        <p className="text-[11px] font-black text-gray-700 leading-none">{value}</p>
        <p className="text-[9px] text-gray-400 font-semibold">{label}</p>
      </div>
    </div>
  )
}
