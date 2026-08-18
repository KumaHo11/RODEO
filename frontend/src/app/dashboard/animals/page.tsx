'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Beef, Plus, Upload, Search, ChevronRight } from 'lucide-react'
import { useAnimals } from './hooks/useAnimals'
import { usePlan } from '@/hooks/usePlan'

export default function AnimalsPage() {
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const { hasFeature } = usePlan()
  
  const { animals, loading } = useAnimals({
    status: filterStatus,
    search: searchTerm,
  })

  if (!hasFeature('animal_registry')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Beef className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registro Individual de Animales</h2>
        <p className="text-gray-500 max-w-md">
          Esta función requiere el plan LATIFUNDIO. Mejora tu plan para habilitar el seguimiento individual y la lectura RFID.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Beef className="w-6 h-6 text-emerald-600" />
              Animales <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full ml-2">{animals.length} cabezas</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4" /> Importar CSV
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Agregar animal
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
              {['Todos', 'VIVO', 'VENDIDO', 'FAENADO'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterStatus === status 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'text-gray-500 border border-transparent hover:bg-gray-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por caravana, RFID o nombre..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full md:w-80 bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-gray-500 py-10 text-center">Cargando animales...</div>
            ) : animals.length === 0 ? (
              <div className="text-gray-500 py-10 text-center">No se encontraron animales.</div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Tag</th>
                    <th className="pb-3 font-semibold">RFID</th>
                    <th className="pb-3 font-semibold">Sexo</th>
                    <th className="pb-3 font-semibold">Raza</th>
                    <th className="pb-3 font-semibold">Nacimiento</th>
                    <th className="pb-3 font-semibold">Rodeo</th>
                    <th className="pb-3 font-semibold">Potrero</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {animals.map((a: any) => (
                    <tr key={a.id} className="group hover:bg-gray-50">
                      <td className="py-3 text-sm font-bold text-gray-900">{a.visual_tag || '-'}</td>
                      <td className="py-3 text-sm font-mono text-gray-400">{a.rfid_code || '-'}</td>
                      <td className="py-3 text-sm text-gray-600">{a.sex === 'MACHO' ? 'M' : 'H'}</td>
                      <td className="py-3 text-sm text-gray-600">{a.breed || '-'}</td>
                      <td className="py-3 text-sm text-gray-600">
                        {a.birth_date ? new Date(a.birth_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                      </td>
                      <td className="py-3 text-sm text-gray-600">{a.herd_name || '-'}</td>
                      <td className="py-3 text-sm text-gray-600">{a.paddock_name || '-'}</td>
                      <td className="py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          a.status === 'VIVO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          a.status === 'VENDIDO' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link 
                          href={`/dashboard/animals/${a.id}`}
                          className="inline-flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          Ver <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span>Mostrando {animals.length} animales</span>
            <div className="flex gap-2">
              <button disabled className="px-3 py-1 border border-gray-200 rounded-lg bg-white text-gray-600 disabled:opacity-40">Anterior</button>
              <button disabled className="px-3 py-1 border border-gray-200 rounded-lg bg-white text-gray-600 disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
