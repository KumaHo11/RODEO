'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, Camera, Search, Filter, Satellite, FileText } from 'lucide-react'
import { getPaddockNDVI, SatelliteData } from '@/lib/services/satellite'

export default function PaddocksList() {
  const { user } = useAuth()
  const supabase = createClient()
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [satelliteCache, setSatelliteCache] = useState<Record<string, SatelliteData>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')

  const [aforoModalOpen, setAforoModalOpen] = useState(false)
  const [selectedPaddockId, setSelectedPaddockId] = useState<string | null>(null)
  const [aforoData, setAforoData] = useState({ green_weight: '', dry_matter: 25 })
  const [savingAforo, setSavingAforo] = useState(false)

  const filteredPaddocks = paddocks.filter((p: any) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.current_status === filterStatus
    return matchSearch && matchStatus
  })

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (orgData?.organization_id) {
        const { data, error } = await supabase
          .from('paddocks')
          .select('id, name, area_ha, current_status, estimated_adh')
          .eq('org_id', orgData.organization_id)
        if (!error && data) {
          setPaddocks(data)
          
          // Fetch satellite metrics in parallel
          const satMap: Record<string, SatelliteData> = {}
          await Promise.all(data.map(async (p) => {
            const satData = await getPaddockNDVI(null, p.area_ha)
            satMap[p.id] = satData
          }))
          setSatelliteCache(satMap)
        }
      }
      setLoading(false)
    }
    load()
  }, [user, supabase])

  const handleSaveAforo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPaddockId) return
    setSavingAforo(true)
    
    const greenWg = parseFloat(aforoData.green_weight) || 0
    const dmPct = (parseFloat(aforoData.dry_matter.toString()) || 25) / 100
    // formula: (gr/m2 * 10) = Kg Verde/ha. * pct_ms = Kg MS/ha
    const kgMsHa = (greenWg * 10) * dmPct
    const calcAdh = kgMsHa / 15 // Assuming 15kg MS per EV day

    await supabase.from('paddock_measurements').insert([{
      paddock_id: selectedPaddockId,
      user_id: user?.id,
      green_weight_kg_m2: greenWg / 1000, 
      dry_matter_pct: dmPct * 100,
      calculated_adh: calcAdh
    }])

    await supabase.from('paddocks').update({ estimated_adh: calcAdh }).eq('id', selectedPaddockId)
    
    // Refresh local
    setPaddocks(prev => prev.map(p => p.id === selectedPaddockId ? { ...p, estimated_adh: calcAdh } : p))
    setAforoModalOpen(false)
    setSavingAforo(false)
  }

  const getNdviColor = (val: number) => {
    if (val >= 0.7) return 'text-green-700 bg-green-100'
    if (val >= 0.4) return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Potreros</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Administra tus lotes de pastoreo y visualiza su productividad en tiempo real. <br/>
          utiliza los aforos físicos para calibrar la biomasa satelital y optimizar la carga animal de tu campo.
        </p>
      </div>

      <div className="bg-green-50 rounded-xl p-6 border border-green-100 shadow-sm">
        <h2 className="text-green-900 font-bold text-lg mb-3 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-green-700" />
          Planificación Holística de Potreros
        </h2>
        <div className="text-sm text-green-800 space-y-3 leading-relaxed">
          <p>La toma de decisiones ya no es subjetiva. RODEO ahora utiliza integraciones con <strong>Sentinel-2 (API Satelital)</strong> combinada con tus mediciones físicas para estimar con precisión matemática los Días Animal (DA):</p>
          <ul className="space-y-2">
            <li className="flex items-start">
              <span className="font-bold mr-2">• Biomasa Satelital (NDVI):</span> Escanea el lote cada 5 días y descarta zonas secas o con agua.
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">• Aforos (Cortes Reales):</span> Calibran el algoritmo satelital cuando mides gramos/m².
            </li>
          </ul>
          <p className="mt-4 text-xs font-semibold bg-green-100/50 p-2 rounded-lg inline-flex items-center text-green-700 border border-green-200/50">
            <Search className="w-3 h-3 mr-1.5" /> Nota: Para editar la forma geográfica (polígono) de un potrero o añadir nuevos, debes dirigirte a la sección de Mapa.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row gap-4 mb-6 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 rounded-md border-gray-300 py-2 text-gray-900 bg-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border"
            placeholder="Buscar por nombre de lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              className="block w-full pl-10 rounded-md border-gray-300 py-2 text-gray-900 bg-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="GRAZING">En Pastoreo</option>
              <option value="RESTING">En Descanso</option>
            </select>
          </div>
          
          <div className="bg-gray-100 p-1 rounded-lg flex gap-1 border border-gray-200">
            <button 
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista en tarjetas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista en lista"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando potreros...</p>
      ) : filteredPaddocks.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
          No hay potreros encontrados. Intenta cambiar tu búsqueda.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPaddocks.map((p: any) => {
            const sat = satelliteCache[p.id]
            const autoAdh = sat ? sat.estimatedAvailableDryMatterHa / 15 : 66
            const activeAdh = p.estimated_adh > 0 ? p.estimated_adh : autoAdh
            const grazableArea = sat ? (p.area_ha * (sat.grazableAreaPct / 100)) : p.area_ha
            
            return (
              <div key={p.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
                <div className="px-4 py-3 sm:p-5">
                  <div className="flex items-center justify-between mb-4 border-b pb-3">
                    <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                      <MapPin className="h-5 w-5 mr-2 text-green-600" />
                      {p.name}
                    </h3>
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${p.current_status === 'GRAZING' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                      {p.current_status === 'GRAZING' ? 'En Pastoreo' : 'En Descanso'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500 text-xs">Área Bruta</p>
                      <p className="font-semibold">{Number(p.area_ha).toFixed(1)} ha</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs text-green-600 flex items-center"><Satellite className="w-3 h-3 mr-1"/>Área Pastoreable</p>
                      <p className="font-semibold text-green-700">{grazableArea.toFixed(1)} ha ({sat?.grazableAreaPct || 100}%)</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs flex items-center"><Satellite className="w-3 h-3 mr-1"/> NDVI Promedio</p>
                      {sat ? (
                        <p className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold ${getNdviColor(sat.averageNdvi)}`}>
                          {sat.averageNdvi}
                        </p>
                      ) : <p className="text-gray-400">Escaneando...</p>}
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs flex items-center"><FileText className="w-3 h-3 mr-1"/> Biomasa (Satélite)</p>
                      <p className="font-semibold">{sat ? `${sat.estimatedAvailableDryMatterHa} kg MS` : '...'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-3 border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-gray-800">Ración Activa (DAH)</span>
                        <span className="text-lg font-bold text-green-700">{activeAdh.toFixed(0)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Volumen total efectivo: <strong>{(activeAdh * grazableArea).toFixed(0)} Días Animal</strong>
                      </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between border-t border-gray-200">
                  <button 
                    onClick={() => { setSelectedPaddockId(p.id); setAforoModalOpen(true); }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Camera className="h-4 w-4 mr-1" /> Medir Aforo (Real)
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Potrero</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Área (G/P)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">NDVI</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ración (DAH)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPaddocks.map((p: any) => {
                const sat = satelliteCache[p.id]
                const autoAdh = sat ? sat.estimatedAvailableDryMatterHa / 15 : 66
                const activeAdh = p.estimated_adh > 0 ? p.estimated_adh : autoAdh
                const grazableArea = sat ? (p.area_ha * (sat.grazableAreaPct / 100)) : p.area_ha
                
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-green-600" />
                        <div className="text-sm font-bold text-gray-900">{p.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] leading-5 font-semibold rounded-full ${p.current_status === 'GRAZING' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                        {p.current_status === 'GRAZING' ? 'Pastando' : 'Descanso'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Number(p.area_ha).toFixed(1)} / <span className="text-green-600 font-medium">{grazableArea.toFixed(1)} ha</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sat ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getNdviColor(sat.averageNdvi)}`}>
                          {sat.averageNdvi}
                        </span>
                      ) : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-green-700 text-sm">
                      {activeAdh.toFixed(0)} <small className="text-[10px] font-normal text-gray-400">DAH</small>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                         onClick={() => { setSelectedPaddockId(p.id); setAforoModalOpen(true); }}
                         className="text-blue-600 hover:text-blue-900 font-bold"
                      >
                        Aforo
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Aforo Modal */}
      {aforoModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2 border-b pb-2">Registrar Aforo Físico</h3>
            <p className="text-sm text-gray-500 mb-4">Ingresa los datos del corte realizado con aro de 1m². Esto recalibrará la ración (DAH) del lote.</p>
            
            <form onSubmit={handleSaveAforo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Peso verde de la muestra (Gramos / m²)</label>
                <input required type="number" min="10" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" placeholder="Ej: 300" value={aforoData.green_weight} onChange={e => setAforoData({ ...aforoData, green_weight: e.target.value })} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">% Seco Estimado: {aforoData.dry_matter}%</label>
                <input type="range" min="10" max="80" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" value={aforoData.dry_matter} onChange={e => setAforoData({ ...aforoData, dry_matter: parseInt(e.target.value) })} />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>10% (Muy tierno/agua)</span><span>80% (Pasto Seco)</span></div>
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mt-2 border border-blue-100">
                La fórmula calculará: <strong>{(((parseFloat(aforoData.green_weight)||0)*10) * (aforoData.dry_matter/100)).toFixed(0)} Kg MS / Ha</strong>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button type="button" onClick={() => setAforoModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={savingAforo} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">{savingAforo ? 'Procesando...' : 'Guardar Aforo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
