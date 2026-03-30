'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Plus, Search, Filter, Edit, Trash2 } from 'lucide-react'

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

const ANIMAL_TYPES = [
  { id: 'vacas', label: 'Vacas' },
  { id: 'vaquillonas', label: 'Vaquillonas' },
  { id: 'terneros', label: 'Terneros' },
  { id: 'ovejas', label: 'Ovejas' },
  { id: 'cabras', label: 'Cabras' },
  { id: 'caballos', label: 'Caballos' },
]

const BREED_OPTIONS: Record<string, string[]> = {
  vacas: ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  vaquillonas: ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  terneros: ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  ovejas: ['Merino', 'Corriedale', 'Texel', 'Hampshire Down', 'Dorper', 'Otra'],
  cabras: ['Boer', 'Anglo-Nubian', 'Saanen', 'Criolla', 'Otra'],
  caballos: ['Criollo', 'Cuarto de Milla', 'Polo Argentino', 'Árabe', 'Percherón', 'Otra'],
}

export default function HerdsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [herds, setHerds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSpecies, setFilterSpecies] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    species: 'vacas',
    breed: '',
    head_count: 0,
    avg_weight_kg: 0,
    avg_age_years: 0
  })

  useEffect(() => {
    loadHerds()
  }, [user, supabase])

  async function loadHerds() {
    if (!user) return
    setLoading(true)
    const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (orgData?.organization_id) {
      const { data, error } = await supabase
        .from('herds')
        .select('*')
        .eq('org_id', orgData.organization_id)
        .order('created_at', { ascending: false })
      if (!error && data) {
        setHerds(data)
      }
    }
    setLoading(false)
  }

  const filteredHerds = useMemo(() => {
    return herds.filter(h => {
      const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) || 
                          (h.breed && h.breed.toLowerCase().includes(search.toLowerCase()))
      const matchFilter = filterSpecies === 'all' || h.species === filterSpecies
      return matchSearch && matchFilter
    })
  }, [herds, search, filterSpecies])

  const calculateEV = (weight: number, head_count: number) => {
    if (!weight || !head_count) return 0
    return ((weight / 400) * head_count).toFixed(2)
  }

  const handleOpenModal = (herd: any = null) => {
    if (herd) {
      setFormData({
        id: herd.id,
        name: herd.name,
        species: herd.species,
        breed: herd.breed || '',
        head_count: herd.head_count,
        avg_weight_kg: herd.avg_weight_kg || 0,
        avg_age_years: herd.avg_age_years || 0
      })
    } else {
      setFormData({
        id: '',
        name: '',
        species: 'vacas',
        breed: '',
        head_count: 0,
        avg_weight_kg: 0,
        avg_age_years: 0
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    if (!orgData) return setSaving(false)

    const payload = {
      org_id: orgData.organization_id,
      name: formData.name || formData.species,
      species: formData.species,
      breed: formData.breed,
      head_count: formData.head_count,
      avg_weight_kg: formData.avg_weight_kg,
      avg_age_years: formData.avg_age_years,
      total_ev: calculateEV(formData.avg_weight_kg, formData.head_count)
    }

    if (formData.id) {
      await supabase.from('herds').update(payload).eq('id', formData.id)
    } else {
      await supabase.from('herds').insert([payload])
    }
    
    setIsModalOpen(false)
    setSaving(false)
    loadHerds()
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este rodeo?")) {
      await supabase.from('herds').delete().eq('id', id)
      loadHerds()
    }
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Rebaños</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Gestiona la distribución de tus animales por especie y categoría. <br/>
            monitorea la carga animal (EV) por rodeo para una planificación precisa.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm font-medium text-sm w-fit"
        >
          <Plus className="h-4 w-4 mr-2" /> Agregar Rebaño
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 rounded-md border-gray-300 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border"
            placeholder="Buscar por nombre o raza..."
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
              className="block w-full pl-10 rounded-md border-gray-300 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border"
              value={filterSpecies}
              onChange={(e) => setFilterSpecies(e.target.value)}
            >
              <option value="all">Todas las especies</option>
              {ANIMAL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
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

      {/* Grid */}
      {loading ? (
        <p className="text-gray-500">Cargando rebaños...</p>
      ) : filteredHerds.length === 0 ? (
        <div className="bg-white p-10 rounded-lg shadow text-center text-gray-500 border border-gray-200">
          <CowIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No se encontraron rebaños</h3>
          <p className="mt-1 text-sm text-gray-500">Crea uno nuevo o ajusta los filtros de búsqueda.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredHerds.map(herd => (
            <div key={herd.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4 border-b pb-4">
                  <div className="flex items-center">
                    <CowIcon className="h-5 w-5 mr-2 text-green-600" />
                    <h3 className="text-lg leading-6 font-bold text-gray-900 capitalize">
                      {herd.name}
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                    {herd.species}
                  </span>
                </div>
                
                <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cabezas</dt>
                    <dd className="mt-1 text-xl font-semibold text-gray-900">{herd.head_count}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Equivalente Vaca (EV)</dt>
                    <dd className="mt-1 text-xl font-bold text-orange-600">{Number(herd.total_ev).toFixed(2) || '0.00'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Raza</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-medium">{herd.breed || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Peso / Edad</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-medium">
                      {herd.avg_weight_kg ? `${herd.avg_weight_kg} kg` : '-'} / {herd.avg_age_years ? `${herd.avg_age_years} a` : '-'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-2 border-t border-gray-100">
                <button onClick={() => handleOpenModal(herd)} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center px-2 py-1">
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </button>
                <button onClick={() => handleDelete(herd.id)} className="text-sm font-medium text-red-600 hover:text-red-800 flex items-center px-2 py-1">
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rebaño</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Especie</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cabezas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">EV Total</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Raza</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHerds.map(herd => (
                <tr key={herd.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CowIcon className="h-4 w-4 mr-2 text-green-600" />
                      <div className="text-sm font-bold text-gray-900 capitalize">{herd.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 capitalize">
                      {herd.species}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{herd.head_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-bold">{Number(herd.total_ev).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{herd.breed || 'Sin definir'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleOpenModal(herd)} className="text-blue-600 hover:text-blue-900 mr-3"><Edit className="h-4 w-4"/></button>
                    <button onClick={() => handleDelete(herd.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
              {formData.id ? 'Editar Rebaño' : 'Nuevo Rebaño'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre del rodeo</label>
                <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Vaquillonas Preñadas" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Especie</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" 
                    value={formData.species} 
                    onChange={e => setFormData({ ...formData, species: e.target.value, breed: '' })}
                  >
                    {ANIMAL_TYPES.map(t => <option key={t.id} value={t.id} className="text-gray-900">{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Raza / Tipo</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" 
                    value={formData.breed} 
                    onChange={e => setFormData({ ...formData, breed: e.target.value })}
                  >
                    <option value="">Seleccione raza...</option>
                    {(BREED_OPTIONS[formData.species] || ['Otra']).map(b => (
                      <option key={b} value={b} className="text-gray-900">{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cabezas *</label>
                  <input required type="number" min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.head_count || ''} onChange={e => setFormData({ ...formData, head_count: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Peso (kg)</label>
                  <input type="number" min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.avg_weight_kg || ''} onChange={e => setFormData({ ...formData, avg_weight_kg: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Edad (años)</label>
                  <input type="number" min="0" step="0.5" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.avg_age_years || ''} onChange={e => setFormData({ ...formData, avg_age_years: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="bg-orange-50 p-3 rounded-md text-sm text-orange-800 border border-orange-200">
                <strong>Equivalente Vaca Estimado (EV):</strong> {calculateEV(formData.avg_weight_kg, formData.head_count)}
                <div className="text-xs mt-1 text-orange-600">Calculado bajo el estándar (Peso / 400kg) * Cabezas.</div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar Rebaño'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
