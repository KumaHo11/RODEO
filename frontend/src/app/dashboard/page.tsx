'use client'

import { Map, LayoutDashboard, CloudRain, Users, TrendingUp, PawPrint, AlertTriangle, Calendar, Info, Navigation } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/AuthProvider"
import Link from "next/link"
import { getPaddockWeather, WeatherData } from "@/lib/services/weather"

const CowIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 11c0 2.209-1.791 4-4 4s-4-1.791-4-4V9c0-2.209 1.791-4 4-4s4 1.791 4 4v2z" />
    <path d="M8 10c-2 0-3-1-3-3s1-3 3-3" />
    <path d="M16 10c2 0 3-1 3-3s-1-3-3-3" />
    <path d="M7 15c-1 3-1 5 0 7" />
    <path d="M17 15c1 3 1 5 0 7" />
    <path d="M12 15v3" />
  </svg>
)

export default function DashboardOverview() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  
  const [herds, setHerds] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [org, setOrg] = useState<any>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  
  const [metrics, setMetrics] = useState({
    totalArea: 0,
    grazableArea: 0,
    totalAnimals: 0,
    totalEV: 0,
    avgPaddockRest: 0,
    nextMovesCount: 0,
    overgrazingCount: 0
  })

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return
      setLoading(true)
      
      // 1. Fetch Org & Location
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile?.organization_id) {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
        setOrg(orgData)
        
        // 2. Fetch Weather if we have coordinates (or mock)
        const lat = -34.6; // Fallback to Argentina Pampas coords if null
        const lon = -58.4;
        const wData = await getPaddockWeather(lat, lon)
        setWeather(wData)
      }

      // 3. Fetch Paddocks
      const { data: paddocksData } = await supabase.from('paddocks').select('*')
      if (paddocksData) {
        setPaddocks(paddocksData)
        const totalArea = paddocksData.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0)
        const totalGrazable = paddocksData.reduce((sum, p) => sum + (Number(p.grazable_area_ha) || (Number(p.area_ha) * 0.9)), 0)
        
        // 4. Fetch Herds
        const { data: herdsData } = await supabase.from('herds').select('*')
        if (herdsData) {
          setHerds(herdsData)
          const totalAnimals = herdsData.reduce((sum, h) => sum + (Number(h.head_count) || 0), 0)
          const totalEV = herdsData.reduce((sum, h) => sum + (Number(h.total_ev) || 0), 0)
          
          // 5. Fetch Grazing Plans for alerts
          const { data: plansData } = await supabase.from('grazing_plans').select('*, paddock_id(name)')
          if (plansData) {
            setPlans(plansData)
            const activePlans = plansData.filter(p => p.status === 'ACTIVE')
            const overgrazing = activePlans.filter(p => p.exit_date && new Date(p.exit_date) < new Date()).length
            
            // Calculate avg occupancy from COMPLETED plans if any
            const completed = plansData.filter(p => p.status === 'COMPLETED' && p.exit_date && p.entry_date)
            const avgOcc = completed.length > 0 
              ? completed.reduce((sum, p) => {
                  const days = (new Date(p.exit_date!).getTime() - new Date(p.entry_date).getTime()) / (1000 * 60 * 60 * 24)
                  return sum + days
                }, 0) / completed.length
              : 5; // Default 5 days if no history
            
            setMetrics({
              totalArea,
              grazableArea: totalGrazable,
              totalAnimals,
              totalEV,
              avgPaddockRest: Math.round(avgOcc),
              nextMovesCount: activePlans.length,
              overgrazingCount: overgrazing
            })
          }
        }
      }
      
      setLoading(false)
    }
    
    loadDashboardData()
  }, [user, supabase])

  const speciesDistribution = useMemo(() => {
    const dist: Record<string, number> = {}
    herds.forEach(h => {
      dist[h.species] = (dist[h.species] || 0) + (Number(h.head_count) || 0)
    })
    return dist
  }, [herds])

  const breedDistribution = useMemo(() => {
    const dist: Record<string, number> = {}
    herds.forEach(h => {
      const b = h.breed || 'Otros'
      dist[b] = (dist[b] || 0) + (Number(h.head_count) || 0)
    })
    return dist
  }, [herds])

  const stats = [
    { name: 'Área Total', value: `${metrics.totalArea.toFixed(1)} ha`, subValue: `${metrics.grazableArea.toFixed(1)} ha pastoreables`, icon: Map, color: 'bg-green-500' },
    { name: 'Potreros', value: paddocks.length.toString(), subValue: `${metrics.avgPaddockRest} días ocupación avg`, icon: LayoutDashboard, color: 'bg-indigo-500' },
    { name: 'Carga Total', value: `${metrics.totalEV.toFixed(1)} EV`, subValue: `${metrics.totalAnimals} animales totales`, icon: CowIcon, color: 'bg-orange-500' },
    { name: 'Estado Pastura', value: '75%', subValue: 'Vigor Bueno (NDVI 0.6)', icon: TrendingUp, color: 'bg-emerald-500' },
  ]

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.name} className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <dt className="flex items-center gap-3">
              <div className={`rounded-lg ${item.color} p-2.5`}>
                <item.icon className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-gray-500">{item.name}</p>
            </dt>
            <dd className="mt-4 flex flex-col gap-1">
              {loading ? (
                <div className="h-8 w-24 bg-gray-100 animate-pulse rounded"></div>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                  <p className="text-xs text-gray-500 font-medium">{item.subValue}</p>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Weather & Field Info */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 text-gray-800 text-center sm:text-left border-b border-blue-200/50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                  <Navigation className="h-4 w-4 text-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{org?.name || 'Mi Establecimiento'}</p>
                </div>
                <h2 className="text-2xl font-black text-gray-900">Resumen de Temporada</h2>
                <p className="text-sm text-blue-600/70 font-medium mt-1 uppercase tracking-wide">
                  {weather?.currentSeason === 'SUMMER' ? '☀️ Verano' : weather?.currentSeason === 'WINTER' ? '❄️ Invierno' : weather?.currentSeason === 'AUTUMN' ? '🍂 Otoño' : '🌱 Primavera'}
                </p>
              </div>
              <div className="flex gap-8 text-center bg-white/50 p-4 rounded-xl backdrop-blur-sm border border-white">
                <div>
                  <p className="text-[10px] text-blue-400 mb-1 uppercase font-black tracking-tight">Lluvia 30d</p>
                  <p className="text-2xl font-black text-gray-900">{weather?.past30DaysRain || 0} <span className="text-xs font-normal text-gray-400">mm</span></p>
                </div>
                <div className="w-px h-10 bg-blue-200/50"></div>
                <div>
                  <p className="text-[10px] text-blue-400 mb-1 uppercase font-black tracking-tight">Pronóstico</p>
                  <p className="text-2xl font-black text-gray-900">{weather?.next15DaysRain || 0} <span className="text-xs font-normal text-gray-400">mm</span></p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <CloudRain className="h-5 w-5 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">Humedad</p>
              <p className="text-sm font-bold text-gray-900">65%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">Riesgo Sequía</p>
              <p className="text-sm font-bold text-gray-900">{weather?.droughtRisk === 'LOW' ? 'Bajo' : weather?.droughtRisk === 'MODERATE' ? 'Medio' : 'Alto'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <Map className="h-5 w-5 text-indigo-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">Ubicación</p>
              <p className="text-sm font-bold text-gray-900 overflow-hidden text-ellipsis">-34.6, -58.4</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-center">
              <Calendar className="h-5 w-5 text-orange-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">Días Críticos</p>
              <p className="text-sm font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>

        {/* Alerts & Movements */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" /> Alertas de Manejo
            </h3>
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{metrics.overgrazingCount + (metrics.nextMovesCount > 0 ? 1 : 0)} Activas</span>
          </div>
          <div className="space-y-4 flex-grow">
            {metrics.overgrazingCount > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 animate-pulse">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-900">SOBREPASTOREO DETECTADO</p>
                  <p className="text-xs text-red-700">{metrics.overgrazingCount} rodeo(s) deben salir hoy.</p>
                </div>
              </div>
            )}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">Próximos Movimientos</p>
                <p className="text-xs text-blue-700">{metrics.nextMovesCount} lotes activos esta semana.</p>
              </div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900">Salud de Potreros</p>
                <p className="text-xs text-emerald-700">NDVI estable en el 85% del campo.</p>
              </div>
            </div>
          </div>
          <Link href="/dashboard/grazing" className="mt-6 w-full py-3 bg-gray-900 text-white rounded-xl text-center text-sm font-bold hover:bg-gray-800 transition-colors">
            Ver Planificador
          </Link>
        </div>

        {/* Herds Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <CowIcon className="h-5 w-5 text-green-600" /> Distribución de Rodeos
            </h3>
            <Link href="/dashboard/herds" className="text-xs font-bold text-green-600 hover:text-green-500">Administrar Rodeos &rarr;</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {herds.map(herd => (
              <div key={herd.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <CowIcon className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{herd.name}</h4>
                    <p className="text-xs text-gray-500 capitalize">{herd.species} - {herd.breed || 'Sin raza'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{herd.head_count} <span className="text-[10px] text-gray-400 font-normal">Animales</span></p>
                  <p className="text-xs font-bold text-orange-600">{Number(herd.total_ev).toFixed(1)} <span className="text-[10px] text-orange-400 font-normal">EV</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Small Data distribution info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-6">
            <Info className="h-5 w-5 text-blue-500" /> Resumen de Hacienda
          </h3>
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-500 mb-1 font-bold">RAZAS PREDOMINANTES</p>
                <p className="text-sm font-medium text-gray-900">
                  {Object.entries(breedDistribution).sort((a,b) => b[1] - a[1]).slice(0, 2).map(([name, count]) => `${name} (${((count/metrics.totalAnimals)*100).toFixed(0)}%)`).join(', ') || 'Sin datos'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-100" />
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
               <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (Object.values(breedDistribution)[0] / metrics.totalAnimals) * 100 || 0)}%` }}></div>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
               <p className="text-xs text-gray-500 mb-2 font-bold uppercase">Distribución por Especie</p>
               <div className="flex flex-wrap gap-2">
                  {Object.entries(speciesDistribution).map(([name, count]) => (
                    <span key={name} className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-600 capitalize">
                      {name}: {count}
                    </span>
                  ))}
                  {Object.keys(speciesDistribution).length === 0 && <span className="text-[10px] text-gray-400">Sin animales</span>}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
