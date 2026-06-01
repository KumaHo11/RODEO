'use client'
import { useState, useEffect } from 'react'
import { Leaf } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useWeather } from '@/lib/context/WeatherContext'

export function ForageBalanceWidget({ avgGrowthRate }: { avgGrowthRate: number | null }) {
  const [herds, setHerds] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const { current } = useWeather()

  useEffect(() => {
    Promise.all([
      apiFetch('/api/herds').then(r => r.ok ? r.json() : { herds: [] }),
      apiFetch('/api/paddocks').then(r => r.ok ? r.json() : { paddocks: [] })
    ]).then(([hData, pData]) => {
      setHerds(hData.herds || [])
      setPaddocks(pData.paddocks || [])
    }).catch(console.error)
  }, [])

  // Calculate real metrics
  const totalArea = paddocks.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0) || 1
  const totalEV = herds.reduce((sum, h) => sum + (Number(h.total_ev) || 0), 0)
  const baseDemandKgDay = totalEV * 12 // 12 kg MS por EV estandar
  const baseDemandPerHa = baseDemandKgDay / totalArea

  // Calculate climate multiplier using THI (heat stress) and cold stress logic
  // Similar to GanttClimatePanel
  let climateMultiplier = 1.0
  if (current) {
    const dp = current.tempC - ((100 - current.humidityPct) / 5)
    const thi = parseFloat((current.tempC + 0.36 * dp + 41.5).toFixed(1))
    
    if (thi > 72) {
      climateMultiplier = 0.9 // Heat stress reduces intake
    } else if (current.tempC < 5) {
      climateMultiplier = 1.15 // Cold stress increases energy demand
    }
  }

  const adjustedDemandPerHa = baseDemandPerHa * climateMultiplier
  const currentOffer = avgGrowthRate && avgGrowthRate > 0 ? avgGrowthRate : 0
  const balance = currentOffer - adjustedDemandPerHa

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm p-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
          <Leaf className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-black text-gray-900 leading-tight">Balance Forrajero Actual</h2>
          <p className="text-[10px] text-gray-500 font-medium">Relación entre el crecimiento del pasto y el consumo animal ajustado por clima</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Oferta */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1 relative group cursor-help">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Oferta (Crecimiento)</p>
            <div className="absolute bottom-full mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-medium">
              Tasa de crecimiento actual del pasto. Depende de humedad, temperatura y radiación.
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-900 leading-none">{currentOffer.toFixed(1)}</p>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">kg MS/ha/d</p>
        </div>
        
        {/* Demanda */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center relative">
          <div className="flex items-center justify-center gap-1 mb-1 relative group cursor-help">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Demanda (Consumo)</p>
            <div className="absolute bottom-full mb-2 w-56 bg-gray-900 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-medium">
              Consumo estimado de los rodeos. Sube con el frío por mayor gasto energético y baja con el calor severo por estrés.
            </div>
          </div>
          <p className="text-3xl font-black text-orange-900 leading-none">{adjustedDemandPerHa.toFixed(1)}</p>
          <p className="text-[10px] font-bold text-orange-600 mt-1">kg MS/ha/d</p>
          {climateMultiplier !== 1.0 && (
            <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm cursor-help" title={`Ajuste climático del consumo debido a ${climateMultiplier > 1 ? 'estrés por frío' : 'estrés calórico'}`}>
              Ajuste Clima: {climateMultiplier > 1 ? '+' : ''}{((climateMultiplier - 1) * 100).toFixed(0)}%
            </div>
          )}
        </div>
        
        {/* Balance */}
        <div className={`border rounded-xl p-4 text-center flex flex-col justify-center ${balance >= 0 ? 'bg-sky-50 border-sky-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center justify-center gap-1 mb-1 relative group cursor-help">
            <p className={`text-[10px] font-black uppercase tracking-widest ${balance >= 0 ? 'text-sky-700' : 'text-red-700'}`}>Balance actual</p>
            <div className="absolute bottom-full mb-2 w-56 bg-gray-900 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-medium text-left">
              Diferencia (Oferta menos Demanda). <br/>
              <b>Positivo (+)</b>: Sobra pasto (crece más de lo que comen).<br/>
              <b>Negativo (-)</b>: Faltante de pasto (comen más de lo que crece).
            </div>
          </div>
          <p className={`text-3xl font-black leading-none ${balance >= 0 ? 'text-sky-900' : 'text-red-900'}`}>
            {balance > 0 ? '+' : ''}{balance.toFixed(1)}
          </p>
          <p className={`text-[10px] font-bold mt-1 ${balance >= 0 ? 'text-sky-600' : 'text-red-600'}`}>kg MS/ha/d</p>
        </div>
      </div>
    </div>
  )
}
