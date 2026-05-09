'use client'
/**
 * ForageVigorMonitor — Gráfico de líneas (Crecimiento histórico)
 * Estilo "bolsa de valores": indicador de tendencia en kg MS/ha/día.
 * Tema claro, utiliza recharts para visualización interactiva.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Lock, Info } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'

interface SnapshotPoint {
  paddock_id: string
  paddock_name?: string
  calculated_at: string
  grass_growth_rate?: number
}

// Datos simulados para javi.osorio.1@gmail.com
const MOCK_GROWTH_DATA: SnapshotPoint[] = []
const PADDOCKS = [
  { id: '1', name: 'Potrero 1' },
  { id: '2', name: 'Potrero 2' },
  { id: '3', name: 'Potrero 3' },
]
const dates = ['2026-04-10', '2026-04-15', '2026-04-20', '2026-04-25', '2026-04-30']
PADDOCKS.forEach((p, pIdx) => {
  let baseGrowth = 12 + pIdx * 2
  dates.forEach((d, dIdx) => {
    MOCK_GROWTH_DATA.push({
      paddock_id: p.id,
      paddock_name: p.name,
      calculated_at: d,
      // Simulando crecimiento que aumenta hacia abril 30
      grass_growth_rate: baseGrowth + dIdx * 1.5 + Math.random() * 2
    })
  })
})

const COLORS = [
  '#10b981','#3b82f6','#f59e0b','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1',
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

interface Props {
  hasPlanAccess?: boolean
  className?: string
}

export default function ForageVigorMonitor({ hasPlanAccess = true, className = '' }: Props) {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [paddockLines, setPaddockLines] = useState<{ id: string; name: string; color: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trend, setTrend] = useState<{ value: number; diff: number; direction: 'up' | 'down' | 'flat'; pct: number }>({ value: 0, diff: 0, direction: 'flat', pct: 0 })

  const load = useCallback(async () => {
    if (!user) return  // guard: wait for Firebase auth to be ready
    setLoading(true); setError(null)
    try {
      let raw: SnapshotPoint[] = []
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/climate-adjustment', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          raw = json.snapshots ?? []
        }
      } catch (e) {
        // Ignorar error para permitir cargar mock data en demo
      }
      
      // Inyección de mock data si no hay historial y el usuario es Javi
      const isDemo = raw.length === 0 && user?.email === 'javi.osorio.1@gmail.com'
      if (isDemo) raw = MOCK_GROWTH_DATA

      if (raw.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      // Procesar datos para Recharts
      // Agrupar por fecha
      const datesMap = new Map<string, any>()
      const paddocksMap = new Map<string, { name: string; color: string }>()
      
      let pIdx = 0
      raw.forEach(s => {
        if (s.grass_growth_rate == null) return
        
        if (!paddocksMap.has(s.paddock_id)) {
          paddocksMap.set(s.paddock_id, {
            name: s.paddock_name || `Potrero ${s.paddock_id}`,
            color: COLORS[pIdx % COLORS.length]
          })
          pIdx++
        }
        
        const d = s.calculated_at.split('T')[0]
        const entry = datesMap.get(d) || { date: d, formattedDate: formatDate(d) }
        entry[s.paddock_id] = Number(s.grass_growth_rate)
        datesMap.set(d, entry)
      })

      const sortedData = Array.from(datesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      setData(sortedData)
      setPaddockLines(Array.from(paddocksMap.entries()).map(([id, val]) => ({ id, ...val })))

      // Calcular tendencia global (promedio de la última fecha vs la anterior)
      if (sortedData.length >= 2) {
        const last = sortedData[sortedData.length - 1]
        const prev = sortedData[sortedData.length - 2]
        
        let lastSum = 0, lastCount = 0
        let prevSum = 0, prevCount = 0
        
        paddocksMap.forEach((_, pId) => {
          if (last[pId] != null) { lastSum += last[pId]; lastCount++ }
          if (prev[pId] != null) { prevSum += prev[pId]; prevCount++ }
        })
        
        const lastAvg = lastCount > 0 ? lastSum / lastCount : 0
        const prevAvg = prevCount > 0 ? prevSum / prevCount : 0
        const diff = lastAvg - prevAvg
        const direction = Math.abs(diff) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down'
        const pct = prevAvg > 0 ? Math.round((diff / prevAvg) * 100) : 0
        
        setTrend({ value: lastAvg, diff, direction, pct })
      } else if (sortedData.length === 1) {
        const last = sortedData[0]
        let sum = 0, count = 0
        paddocksMap.forEach((_, pId) => {
          if (last[pId] != null) { sum += last[pId]; count++ }
        })
        setTrend({ value: count > 0 ? sum / count : 0, diff: 0, direction: 'flat', pct: 0 })
      }

    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  if (!hasPlanAccess) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-gray-50 p-6 flex items-center gap-4 ${className}`}>
        <div className="p-3 rounded-xl bg-gray-100 border border-gray-200">
          <Lock className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Monitor de Crecimiento</p>
          <p className="text-xs text-gray-500 mt-0.5">Disponible en plan Planificador o superior.</p>
        </div>
      </div>
    )
  }

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const trendColor = trend.direction === 'up' ? 'text-emerald-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col ${className}`}>
      {/* Header Bolsa de Valores */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              Crecimiento Promedio
              <span title="Crecimiento diario de materia seca promedio ponderado de los potreros en la última medición" className="cursor-pointer text-gray-300 hover:text-gray-500">
                <Info className="w-3 h-3" />
              </span>
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-gray-900 leading-none">{trend.value.toFixed(1)}</span>
              <span className="text-xs font-semibold text-gray-500">kg MS/ha/d</span>
            </div>
          </div>
          {data.length >= 2 && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold mt-3 ${
              trend.direction === 'up' ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : trend.direction === 'down' ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(1)} ({trend.pct > 0 ? '+' : ''}{trend.pct}%)
            </div>
          )}
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body Gráfico */}
      <div className="px-5 py-4 flex-1 min-h-[180px]">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-gray-400 text-sm font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando datos…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500 text-sm font-medium bg-red-50 rounded-xl">{error}</div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
            <p className="text-sm font-bold text-gray-500">Sin datos de crecimiento</p>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Ejecutá el cálculo desde Clima</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="formattedDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                domain={['auto', 'auto']}
              />
              <RechartsTooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}
                formatter={(value: any) => [`${Number(value).toFixed(1)} kg/ha/d`, 'Crecimiento']}
              />
              {paddockLines.map(p => (
                <Line 
                  key={p.id}
                  type="monotone" 
                  dataKey={p.id} 
                  name={p.name}
                  stroke={p.color} 
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
