'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Calendar as CalendarIcon, Plus, CheckCircle2, Clock, MapPin, PawPrint, Search, Filter, AlignJustify, CalendarDays, Lightbulb, CloudRain, Sun, Thermometer, Wind } from 'lucide-react'
import { getPaddockWeather, WeatherData } from '@/lib/services/weather'

export default function GrazingPlanner() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [plans, setPlans] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'gantt'>('cards')
  const [listMonths, setListMonths] = useState<number>(3)
  
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    id: '',
    paddock_id: '',
    herd_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    exit_date: '',
    planned_recovery_days: 60,
    status: 'PLANNED'
  })
  
  const [suggestion, setSuggestion] = useState({ days: 0, recovery: 60 })

  useEffect(() => {
    loadData()
    fetchWeather()
  }, [user, supabase])

  async function fetchWeather() {
    setWeatherLoading(true)
    // Default to a central location in Argentina (Tandil area) if no coordinates yet managed per org
    const data = await getPaddockWeather(-37.32, -59.13)
    setWeather(data)
    setWeatherLoading(false)
  }

  useEffect(() => {
    if (formData.paddock_id && formData.herd_id) {
       const paddock = paddocks.find(p => p.id === formData.paddock_id)
       const herd = herds.find(h => h.id === formData.herd_id)
       if (paddock && herd) {
          const area = Number(paddock.area_ha) || 0
          const ev = Number(herd.total_ev) || 0
          
          const paddockAdh = Number(paddock.estimated_adh) || 0
          const effectiveAdh = paddockAdh > 0 ? paddockAdh : 66
          
          const totalDa = effectiveAdh * area
          const suggestedDays = ev > 0 ? Math.floor(totalDa / ev) : 0
          
          // Lógica de Temporada para el Descanso
          let recovery = 60
          if (weather?.currentSeason === 'SUMMER') recovery = 40
          if (weather?.currentSeason === 'SPRING') recovery = 45
          if (weather?.currentSeason === 'AUTUMN') recovery = 65
          if (weather?.currentSeason === 'WINTER') recovery = 95

          setSuggestion({ days: suggestedDays, recovery })
          
          // Auto-set recovery in form if it's a new plan
          if (!formData.id) {
             setFormData(prev => {
               if (prev.planned_recovery_days === recovery) return prev
               return { ...prev, planned_recovery_days: recovery }
             })
          }
       }
    }
  }, [formData.paddock_id, formData.herd_id, paddocks, herds, weather])

  // Autocompletar la Fecha de Salida base a la carga animal sugerida
  useEffect(() => {
    if (suggestion.days > 0 && formData.entry_date && !formData.id) {
       const eDate = new Date(formData.entry_date)
       eDate.setDate(eDate.getDate() + suggestion.days)
       const autoExit = eDate.toISOString().split('T')[0]
       
       setFormData(prev => {
          if (prev.exit_date === autoExit) return prev
          return { ...prev, exit_date: autoExit }
       })
    }
  }, [suggestion.days, formData.entry_date, formData.id])

  // Cálculo en tiempo real del consumo para alertas de sobrepastoreo en el Modal
  const currentPlanMetrics = useMemo(() => {
    if (!formData.entry_date || !formData.exit_date || !formData.paddock_id || !formData.herd_id) return null
    const paddock = paddocks.find(p => p.id === formData.paddock_id)
    const herd = herds.find(h => h.id === formData.herd_id)
    if (!paddock || !herd) return null

    const area = Number(paddock.area_ha) || 0
    const ev = Number(herd.total_ev) || 0
    const paddockAdh = Number(paddock.estimated_adh) || 0
    const effectiveAdh = paddockAdh > 0 ? paddockAdh : 66

    const eDate = new Date(formData.entry_date)
    const xDate = new Date(formData.exit_date)
    const days = Math.max(1, (xDate.getTime() - eDate.getTime()) / (1000 * 3600 * 24))
    
    const consumedDa = ev * days
    const consumedAdh = area > 0 ? (consumedDa / area) : 0
    
    return {
      days,
      consumedAdh,
      effectiveAdh,
      isOvergrazing: consumedAdh > effectiveAdh
    }
  }, [formData, paddocks, herds])

  async function loadData() {
    if (!user) return
    setLoading(true)
    
    const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!orgData?.organization_id) return setLoading(false)

    const { data: paddocksData } = await supabase.from('paddocks').select('id, name, area_ha, current_status, estimated_adh').eq('org_id', orgData.organization_id)
    if (paddocksData) setPaddocks(paddocksData)

    const { data: herdsData } = await supabase.from('herds').select('id, name, head_count, total_ev').eq('org_id', orgData.organization_id)
    if (herdsData) setHerds(herdsData)

    const paddockIds = paddocksData?.map(p => p.id) || []
    if (paddockIds.length > 0) {
      const { data: plansData } = await supabase
        .from('grazing_plans')
        .select(`
          *,
          paddocks (name, area_ha),
          herds (name, head_count, total_ev)
        `)
        .in('paddock_id', paddockIds)
        .order('entry_date', { ascending: true })
      
      if (plansData) setPlans(plansData)
    }

    setLoading(false)
  }

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchSearch = p.paddocks?.name?.toLowerCase().includes(search.toLowerCase()) || 
                          p.herds?.name?.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filterStatus === 'all' || p.status === filterStatus
      
      // Add date filter for list view if necessary
      if (viewMode === 'list') {
        const entryDate = new Date(p.entry_date)
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() + listMonths)
        return matchSearch && matchFilter && entryDate <= cutoff
      }

      return matchSearch && matchFilter
    })
  }, [plans, search, filterStatus, viewMode, listMonths])

  const handleOpenModal = (plan: any = null) => {
    if (plan) {
      setFormData({
        id: plan.id,
        paddock_id: plan.paddock_id,
        herd_id: plan.herd_id,
        entry_date: plan.entry_date,
        exit_date: plan.exit_date || '',
        planned_recovery_days: plan.planned_recovery_days,
        status: plan.status
      })
    } else {
      setFormData({
        id: '',
        paddock_id: paddocks[0]?.id || '',
        herd_id: herds[0]?.id || '',
        entry_date: new Date().toISOString().split('T')[0],
        exit_date: '',
        planned_recovery_days: 60,
        status: 'PLANNED'
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      paddock_id: formData.paddock_id,
      herd_id: formData.herd_id,
      entry_date: formData.entry_date,
      exit_date: formData.exit_date || null,
      planned_recovery_days: formData.planned_recovery_days,
      status: formData.status
    }

    if (formData.id) {
      await supabase.from('grazing_plans').update(payload).eq('id', formData.id)
    } else {
      await supabase.from('grazing_plans').insert([payload])
    }

    if (formData.status === 'ACTIVE') {
      await supabase.from('paddocks').update({ current_status: 'GRAZING' }).eq('id', formData.paddock_id)
    } else if (formData.status === 'COMPLETED') {
      await supabase.from('paddocks').update({ current_status: 'RESTING' }).eq('id', formData.paddock_id)
    }

    setIsModalOpen(false)
    setSaving(false)
    loadData()
  }

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Activo (Pastando)</span>
    if (status === 'COMPLETED') return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 flex items-center">Completado</span>
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center"><Clock className="w-3 h-3 mr-1" /> Planificado</span>
  }

  const calculateDaysDiff = (start: string, end: string) => {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 3600 * 24))
  }

  // --- Gantt View Logic ---
  const today = new Date()
  const d30 = new Date()
  d30.setDate(today.getDate() + 30) // Show next 30 days

  const GanttView = () => (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto p-4">
      <div className="min-w-[800px]">
        <h3 className="font-semibold text-gray-800 mb-4">Línea de tiempo (Próximos 30 días)</h3>
        <div className="space-y-4">
          {paddocks.map(paddock => {
            const paddockPlans = filteredPlans.filter(p => p.paddock_id === paddock.id && ['ACTIVE', 'PLANNED'].includes(p.status))
            
            return (
              <div key={paddock.id} className="relative flex items-center border-b border-gray-100 pb-2">
                <div className="w-48 flex-shrink-0 font-medium text-sm text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" /> {paddock.name}
                </div>
                <div className="flex-1 relative h-8 bg-gray-50 rounded">
                  {paddockPlans.map(plan => {
                    const eDate = new Date(plan.entry_date)
                    const xDate = plan.exit_date ? new Date(plan.exit_date) : new Date(eDate.getTime() + (plan.planned_recovery_days * 24*60*60*1000))
                    
                    // Simplistic horizontal offset/width logic for 30-day window
                    const startDiff = (eDate.getTime() - today.getTime()) / (1000*3600*24)
                    const duration = (xDate.getTime() - eDate.getTime()) / (1000*3600*24)
                    
                    if (startDiff > 30 || startDiff + duration < 0) return null // Out of bounds

                    const leftPct = Math.max(0, (startDiff / 30) * 100)
                    const widthPct = Math.min(100 - leftPct, (duration / 30) * 100)

                    // Calcular Holistic Alert para el Gantt
                    let bgColor = plan.status === 'ACTIVE' ? 'bg-green-500' : 'bg-blue-400'
                    const pArea = Number(paddock.area_ha) || 0
                    const pEv = Number(plan.herds?.total_ev) || 0
                    if (pArea > 0 && pEv > 0 && duration > 0) {
                       const pAdh = Number(paddock.estimated_adh) || 66
                       const cAdh = (pEv * duration) / pArea
                       if (cAdh > pAdh) bgColor = 'bg-red-500' // Alerta Sobrepastoreo
                    }

                    return (
                      <div 
                        key={plan.id}
                        onClick={() => handleOpenModal(plan)}
                        className={`absolute top-1 bottom-1 rounded shadow-sm text-xs text-white overflow-hidden whitespace-nowrap px-2 flex items-center cursor-pointer ${bgColor}`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`${plan.herds?.name} ${bgColor === 'bg-red-500' ? '(Alerta Sobrepastoreo)' : ''}`}
                      >
                        {widthPct > 10 && <PawPrint className="h-3 w-3 mr-1 inline-block" />}
                        {widthPct > 20 && plan.herds?.name}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const WeatherWidget = () => (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-2xl shadow-sm p-6 text-gray-800 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 border border-blue-200/50">
      <div className="flex items-center gap-4">
    <div className="bg-white/50 p-3 rounded-full backdrop-blur-sm border border-white">
           {weather?.droughtRisk === 'HIGH' ? <Sun className="w-8 h-8 text-orange-400" /> : <CloudRain className="w-8 h-8 text-blue-500" />}
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            {weatherLoading ? 'Cargando clima...' : `Estado del Clima: ${weather?.currentSeason === 'SUMMER' ? 'Verano' : weather?.currentSeason === 'WINTER' ? 'Invierno' : weather?.currentSeason === 'SPRING' ? 'Primavera' : 'Otoño'}`}
          </h2>
          <p className="text-blue-600/70 text-sm font-medium">Pronóstico local inteligente</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 flex-1">
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider mb-1">Lluvias (Últ. 30 días)</span>
          <span className="text-2xl font-black text-gray-900">{weather ? weather.past30DaysRain : 0} <small className="text-xs font-normal text-gray-400">mm</small></span>
        </div>
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider mb-1">Pronóstico (Prox. 15 días)</span>
          <span className="text-2xl font-black text-gray-900">{weather ? weather.next15DaysRain : 0} <small className="text-xs font-normal text-gray-400">mm</small></span>
        </div>
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider mb-1">Riesgo de Sequía</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-black mt-1 ${weather?.droughtRisk === 'HIGH' ? 'bg-red-100 text-red-600 border border-red-200' : weather?.droughtRisk === 'MODERATE' ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-green-100 text-green-600 border border-green-200'}`}>
            {weather?.droughtRisk === 'HIGH' ? 'CRÍTICO' : weather?.droughtRisk === 'MODERATE' ? 'MODERADO' : 'BAJO'}
          </span>
        </div>
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider mb-1">Descanso Sugerido</span>
          <span className="text-2xl font-black text-green-600">{suggestion.recovery} <small className="text-xs font-normal text-green-400">días</small></span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 relative pb-10">
      <WeatherWidget />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Planificador de pastoreo</h1>
        <div className="flex items-center gap-3">
          <div className="bg-white border rounded-lg p-1 flex items-center shadow-sm">
            <button 
              onClick={() => setViewMode('cards')} 
              className={`p-1.5 rounded transition-all ${viewMode === 'cards' ? 'bg-gray-100 text-green-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              title="Tarjetas"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-gray-100 text-green-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              title="Lista"
            >
              <AlignJustify className="h-4.5 w-4.5" />
            </button>
            <button 
              onClick={() => setViewMode('gantt')} 
              className={`p-1.5 rounded transition-all ${viewMode === 'gantt' ? 'bg-gray-100 text-green-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
              title="Cronograma"
            >
              <CalendarDays className="h-4.5 w-4.5" />
            </button>
          </div>
          <button 
            onClick={() => handleOpenModal()} 
            disabled={paddocks.length === 0 || herds.length === 0}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm font-medium text-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-2" /> Nueva Planificación
          </button>
        </div>
      </div>

      {(paddocks.length === 0 || herds.length === 0) && (
        <div className="bg-orange-50 p-4 rounded-md border border-orange-200 text-orange-800">
          Para crear un planificador necesitas al menos <strong>1 Lote mapeado ({paddocks.length})</strong> y <strong>1 Rebaño registrado ({herds.length})</strong>.
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 rounded-md border-gray-300 py-2 text-gray-900 bg-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border"
            placeholder="Buscar por lote o rebaño..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-4 w-4 text-gray-400" />
          </div>
          <select
            className="block w-full pl-10 rounded-md border-gray-300 py-2 text-gray-900 bg-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="PLANNED">Planificados</option>
            <option value="COMPLETED">Completados</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-10">Cargando planificación...</p>
      ) : plans.length === 0 ? (
        <div className="bg-white p-10 rounded-lg shadow text-center text-gray-500 border border-gray-200">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No hay planes de pastoreo</h3>
          <p className="mt-1 text-sm text-gray-500">Crea uno asignando un rebaño a un potrero para comenzar a rotar.</p>
        </div>
      ) : viewMode === 'gantt' ? (
        <GanttView />
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 w-fit">
            <span className="text-xs font-bold text-gray-400 uppercase ml-2">Filtrar por periodo:</span>
            {[1, 3, 6, 9, 12].map(m => (
              <button
                key={m}
                onClick={() => setListMonths(m)}
                className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${listMonths === m ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                {m === 12 ? '1 AÑO' : `${m} MESES`}
              </button>
            ))}
          </div>
          <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Potrero / Rebaño</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fechas</th>
                  <th scope="col" className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Duración</th>
                  <th scope="col" className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Recup.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleOpenModal(plan)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{plan.paddocks?.name}</span>
                        <span className="text-xs text-gray-500 flex items-center mt-0.5"><PawPrint className="w-3 h-3 mr-1"/> {plan.herds?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(plan.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 tabular-nums">
                      {plan.entry_date} <br/> 
                      <span className="opacity-50">→ {plan.exit_date}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900">
                         {plan.exit_date ? calculateDaysDiff(plan.entry_date, plan.exit_date) : '--'}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-1">días</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-green-600">{plan.planned_recovery_days}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
          <ul role="list" className="divide-y divide-gray-200">
            {filteredPlans.map((plan) => (
              <li key={plan.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleOpenModal(plan)}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-600 truncate flex items-center">
                      <MapPin className="h-4 w-4 mr-1" /> {plan.paddocks?.name}
                    </p>
                    <div className="ml-2 flex flex-shrink-0">
                      {getStatusBadge(plan.status)}
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex flex-col gap-1">
                      <p className="flex items-center text-sm text-gray-500">
                        <PawPrint className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                        {plan.herds?.name} ({plan.herds?.head_count} cabezas)
                      </p>
                      <p className="flex items-center text-sm text-gray-500">
                        <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                        Ingreso: {plan.entry_date} {plan.exit_date && `→ Salida: ${plan.exit_date}`}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 gap-4">
                      {plan.exit_date && (
                        <div className="text-right">
                          <p className="text-gray-900 font-medium">{calculateDaysDiff(plan.entry_date, plan.exit_date)} días</p>
                          <p className="text-xs">de pastoreo</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-green-600 font-medium">{plan.planned_recovery_days} días</p>
                        <p className="text-xs">de recuperación</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
              {formData.id ? 'Modificar Planificación' : 'Nueva Planificación'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Potrero (Lote)</label>
                <select required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.paddock_id} onChange={e => setFormData({ ...formData, paddock_id: e.target.value })}>
                  <option value="" disabled>Selecciona un potrero...</option>
                  {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Rebaño</label>
                <select required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.herd_id} onChange={e => setFormData({ ...formData, herd_id: e.target.value })}>
                  <option value="" disabled>Selecciona un rebaño...</option>
                  {herds.map(h => <option key={h.id} value={h.id}>{h.name} ({h.head_count} cbz)</option>)}
                </select>
              </div>

              {/* Holistic Calculation Box */}
              {suggestion.days > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-900">
                  <h4 className="font-bold text-sm mb-1 flex items-center"><Lightbulb className="w-4 h-4 mr-1 text-green-600"/> Sugerencia de Manejo Holístico</h4>
                  <ul className="text-sm space-y-1 mt-2 text-green-800">
                    <li>Ocupación óptima calculada (Volumen Forraje): <strong>{suggestion.days}</strong> días</li>
                    <li>Período de Descanso sugerido: <strong>{suggestion.recovery}</strong> días</li>
                  </ul>
                  <p className="text-xs text-green-700 mt-2 opacity-80">Cálculo en base a Ración ({paddocks.find(p => p.id === formData.paddock_id)?.estimated_adh || 66} DAH) y carga ({herds.find(h => h.id === formData.herd_id)?.total_ev || 0} UG).</p>
                </div>
              )}

              {currentPlanMetrics?.isOvergrazing && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-900 animate-pulse">
                  <h4 className="font-bold text-sm mb-1">⚠️ Riesgo de Sobrepastoreo</h4>
                  <p className="text-sm text-red-800">
                    Este plan requiere que el lote rinda <strong>{currentPlanMetrics.consumedAdh.toFixed(1)} DAH</strong>, pero su ración estimada es de sólo <strong>{currentPlanMetrics.effectiveAdh.toFixed(1)} DAH</strong>.
                    <br/>Considera reducir los días de ocupación.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Ingreso</label>
                  <input required type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.entry_date} onChange={e => setFormData({ ...formData, entry_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Salida</label>
                  <input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.exit_date} onChange={e => setFormData({ ...formData, exit_date: e.target.value })} />
                  {!formData.id && formData.exit_date && suggestion.days > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ Autocompletado (Cálculo Holístico)</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Días Recuperación (Descanso)</label>
                  <input required type="number" min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.planned_recovery_days} onChange={e => setFormData({ ...formData, planned_recovery_days: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado del Plan</label>
                  <select required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="PLANNED">Planificado</option>
                    <option value="ACTIVE">Activo (Pastando)</option>
                    <option value="COMPLETED">Completado</option>
                  </select>
                </div>
              </div>

              {formData.status === 'ACTIVE' && <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">El potrero cambiará su estado automáticamente a "En Pastoreo".</p>}
              {formData.status === 'COMPLETED' && <p className="text-xs text-green-600 bg-green-50 p-2 rounded">El potrero entrará en estado de "Descanso" para iniciar su recuperación.</p>}
              
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
