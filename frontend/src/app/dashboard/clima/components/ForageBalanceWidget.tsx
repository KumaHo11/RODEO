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

  const currentOffer = chartData.find(d => d.month === new Date().toLocaleString('es-AR', { month: 'short' }).charAt(0).toUpperCase())?.Oferta || chartData[0]?.Oferta || 0;
  const currentDemand = chartData[0]?.Demanda || 0;
  const balance = currentOffer - currentDemand;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm p-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
          <Leaf className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-black text-gray-900 leading-tight">Balance Forrajero Actual</h2>
          <p className="text-[10px] text-gray-500 font-medium">Relación entre el crecimiento del pasto y el consumo animal</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Oferta (Crecimiento)</p>
          <p className="text-2xl font-black text-emerald-900 leading-none">{Math.round(currentOffer).toLocaleString('es-AR')}</p>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">kg MS/ha/d</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-700 mb-1">Demanda (Consumo)</p>
          <p className="text-2xl font-black text-orange-900 leading-none">{Math.round(currentDemand).toLocaleString('es-AR')}</p>
          <p className="text-[10px] font-bold text-orange-600 mt-1">kg MS/ha/d</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${balance >= 0 ? 'bg-sky-50 border-sky-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${balance >= 0 ? 'text-sky-700' : 'text-red-700'}`}>Balance actual</p>
          <p className={`text-2xl font-black leading-none ${balance >= 0 ? 'text-sky-900' : 'text-red-900'}`}>
            {balance > 0 ? '+' : ''}{Math.round(balance).toLocaleString('es-AR')}
          </p>
          <p className={`text-[10px] font-bold mt-1 ${balance >= 0 ? 'text-sky-600' : 'text-red-600'}`}>kg MS/ha/d</p>
        </div>
      </div>

      <div className="h-[220px] w-full mt-4">
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
            
            <Line type="monotone" dataKey="Demanda" stroke="#ea580c" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Oferta" stroke="#10b981" strokeDasharray="5 5" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
