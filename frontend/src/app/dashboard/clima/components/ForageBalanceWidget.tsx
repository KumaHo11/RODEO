'use client'
import { useMemo } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Leaf, Users } from 'lucide-react'

// Curva base estacional aproximada para la zona (Pampeana / Templada)
// Multiplicadores sobre el crecimiento base
const SEASONAL_CURVE = [
  { month: 'E', name: 'Enero',     multiplier: 1.1 },
  { month: 'F', name: 'Febrero',   multiplier: 0.9 },
  { month: 'M', name: 'Marzo',     multiplier: 0.8 },
  { month: 'A', name: 'Abril',     multiplier: 0.6 },
  { month: 'M', name: 'Mayo',      multiplier: 0.4 },
  { month: 'J', name: 'Junio',     multiplier: 0.3 },
  { month: 'J', name: 'Julio',     multiplier: 0.3 },
  { month: 'A', name: 'Agosto',    multiplier: 0.5 },
  { month: 'S', name: 'Septiembre',multiplier: 0.9 },
  { month: 'O', name: 'Octubre',   multiplier: 1.4 },
  { month: 'N', name: 'Noviembre', multiplier: 1.5 },
  { month: 'D', name: 'Diciembre', multiplier: 1.3 },
]

import { apiFetch } from '@/lib/apiFetch'
import { useState, useEffect } from 'react'

export function ForageBalanceWidget({ avgGrowthRate }: { avgGrowthRate: number | null }) {
  const [herds, setHerds] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch('/api/herds').then(r => r.ok ? r.json() : { herds: [] }),
      apiFetch('/api/paddocks').then(r => r.ok ? r.json() : { paddocks: [] })
    ]).then(([hData, pData]) => {
      setHerds(hData.herds || [])
      setPaddocks(pData.paddocks || [])
    }).catch(console.error)
  }, [])

  const chartData = useMemo(() => {
    const baseGrowth = avgGrowthRate && avgGrowthRate > 0 ? avgGrowthRate : 15 // Fallback a 15 kg MS/ha/d
    const totalArea = paddocks.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0) || 100
    
    // Calcular requerimiento animal promedio
    const totalEV = herds.reduce((sum, h) => sum + (Number(h.total_ev) || 0), 0)
    const demandKgDay = totalEV * 12 // 12 kg MS por EV
    const baseDemandPerHa = demandKgDay / totalArea

    return SEASONAL_CURVE.map(m => {
      const offer = baseGrowth * m.multiplier
      // Simular oferta con suplementación (pico en invierno)
      const supp = offer < baseDemandPerHa ? (baseDemandPerHa - offer) * 0.8 : 0 
      
      return {
        month: m.month,
        fullMonth: m.name,
        Demanda: Math.round(baseDemandPerHa),
        Oferta: Math.round(offer),
        'Oferta + Supl.': Math.round(offer + supp)
      }
    })
  }, [avgGrowthRate, herds, paddocks])

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm p-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
          <Leaf className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-black text-gray-900 leading-tight">Balance Forrajero Anual</h2>
          <p className="text-[10px] text-gray-500 font-medium">Proyección de oferta vs demanda según curva estacional</p>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs min-w-[120px]">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{payload[0].payload.fullMonth}</p>
                    {payload.map((entry: any, index: number) => (
                      <div key={index} className="flex justify-between items-center gap-4 mb-1">
                        <span className="font-bold flex items-center gap-1" style={{ color: entry.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                          {entry.name}
                        </span>
                        <span className="font-black text-gray-900">{entry.value} kg/d</span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }} iconType="circle" />
            
            <Line type="monotone" dataKey="Demanda" stroke="#0f172a" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Oferta" stroke="#84cc16" strokeDasharray="5 5" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Oferta + Supl." stroke="#a3e635" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
