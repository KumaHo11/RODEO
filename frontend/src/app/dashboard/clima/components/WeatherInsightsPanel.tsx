'use client'

import { Droplets, Snowflake, AlertTriangle, Trophy, Loader2 } from 'lucide-react'
import type { WeatherInsights } from '@/lib/types/weather'
import clsx from 'clsx'

interface WeatherInsightsPanelProps {
  insights: WeatherInsights | null
  isLoading: boolean
}

export function WeatherInsightsPanel({ insights, isLoading }: WeatherInsightsPanelProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Card 1: Top rainfall */}
      <InsightCard
        icon={<Droplets className="w-5 h-5 text-blue-500" />}
        iconBg="bg-blue-50"
        title="Mayor acumulación de agua"
        subtitle="Totales históricos (mm)"
        isLoading={isLoading}
      >
        {insights?.topRainfallPaddocks.length === 0 ? (
          <EmptyInsight text="Sin datos de lluvia aún" />
        ) : (
          <ol className="space-y-2 mt-1">
            {insights?.topRainfallPaddocks.slice(0, 4).map((p, i) => (
              <li key={p.paddockId} className="flex items-center gap-2.5">
                <span className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                  i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-700/70 text-white' : 'bg-gray-100 text-gray-500'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs font-bold text-gray-700 truncate">{p.paddockName}</span>
                <span className="text-xs font-black text-blue-600 shrink-0">{p.totalMm.toFixed(0)} mm</span>
              </li>
            ))}
          </ol>
        )}
      </InsightCard>

      {/* Card 2: Top frost */}
      <InsightCard
        icon={<Snowflake className="w-5 h-5 text-sky-400" />}
        iconBg="bg-sky-50"
        title="Más afectados por heladas"
        subtitle="Cantidad de eventos"
        isLoading={isLoading}
      >
        {insights?.topFrostPaddocks.length === 0 ? (
          <EmptyInsight text="Sin heladas registradas" />
        ) : (
          <ol className="space-y-2 mt-1">
            {insights?.topFrostPaddocks.slice(0, 4).map((p, i) => (
              <li key={p.paddockId} className="flex items-center gap-2.5">
                <span className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                  i === 0 ? 'bg-sky-400 text-white' : i === 1 ? 'bg-sky-200 text-sky-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs font-bold text-gray-700 truncate">{p.paddockName}</span>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-sky-600">{p.frostEventCount} eventos</p>
                  <p className="text-[10px] text-gray-400 font-semibold">mín. {p.minTempC}°C</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </InsightCard>

      {/* Card 3: Blind paddocks */}
      <InsightCard
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        iconBg="bg-amber-50"
        title='Potreros "ciegos"'
        subtitle="Sin registros en +90 días"
        isLoading={isLoading}
        alert={insights?.blindPaddocks && insights.blindPaddocks.length > 0}
      >
        {insights?.blindPaddocks.length === 0 ? (
          <div className="flex items-center gap-2 mt-2 bg-green-50 rounded-xl px-3 py-2">
            <Trophy className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-[11px] font-bold text-green-700">¡Todos los potreros tienen registros recientes!</p>
          </div>
        ) : (
          <ul className="space-y-2 mt-1">
            {insights?.blindPaddocks.slice(0, 4).map(p => (
              <li key={p.paddockId} className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="flex-1 text-xs font-bold text-gray-700 truncate">{p.paddockName}</span>
                <span className="text-[10px] font-bold text-amber-600 shrink-0 whitespace-nowrap">
                  {p.daysSinceLastEvent === null
                    ? 'Nunca registrado'
                    : `${p.daysSinceLastEvent}d sin datos`}
                </span>
              </li>
            ))}
            {(insights?.blindPaddocks.length ?? 0) > 4 && (
              <li className="text-[10px] text-gray-400 font-semibold text-center pt-1">
                +{(insights?.blindPaddocks.length ?? 0) - 4} más sin datos
              </li>
            )}
          </ul>
        )}
      </InsightCard>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightCard({
  icon,
  iconBg,
  title,
  subtitle,
  isLoading,
  alert,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  isLoading: boolean
  alert?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={clsx(
      'bg-white rounded-2xl p-4 flex flex-col gap-3',
      alert && 'ring-1 ring-amber-200'
    )}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-black text-gray-900 leading-tight">{title}</p>
          <p className="text-[10px] text-gray-400 font-semibold">{subtitle}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : children}
    </div>
  )
}

function EmptyInsight({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-gray-300 font-semibold text-center py-3">{text}</p>
  )
}
