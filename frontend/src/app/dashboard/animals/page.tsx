'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PawPrint, Plus, Upload, Search, ChevronRight } from 'lucide-react'
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

  const STATUS_FILTERS = [
    { value: 'Todos',   label: 'Todos' },
    { value: 'VIVO',    label: 'Vivo'  },
    { value: 'VENDIDO', label: 'Vendido' },
    { value: 'FAENADO', label: 'Faenado' },
  ]

  const STATUS_STYLES: Record<string, string> = {
    VIVO:    'bg-green-50 text-green-700 border border-green-200',
    VENDIDO: 'bg-blue-50 text-blue-700 border border-blue-200',
    FAENADO: 'bg-red-50 text-red-700 border border-red-200',
  }

  const STATUS_LABELS: Record<string, string> = {
    VIVO:    'Vivo',
    VENDIDO: 'Vendido',
    FAENADO: 'Faenado',
  }

  if (!hasFeature('animal_registry')) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
          <PawPrint className="w-8 h-8 text-gray-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-950 mb-2">Registro individual de animales</h2>
          <p className="text-sm text-gray-500 max-w-md">
            Esta función requiere el plan Latifundio. Mejorá tu plan para habilitar el seguimiento individual y la lectura RFID.
          </p>
        </div>
        <Link
          href="/dashboard/planes"
          className="mt-2 bg-green-600 hover:bg-green-700 text-white font-black px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Ver planes
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 md:p-8">

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-950">
              Animales
              <span className="ml-3 text-sm font-bold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full align-middle">
                {animals.length} cabezas
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Registro individual con trazabilidad RFID por animal.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4" />
              Importar CSV
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shadow-green-200 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuevo animal
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterStatus(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                    filterStatus === value
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'text-gray-500 border border-transparent hover:bg-gray-50'
                  }`}
                >
                  {label}
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
                className="w-full md:w-80 bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
              />
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-gray-400 py-12 text-center text-sm">Cargando animales…</div>
            ) : animals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PawPrint className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-bold text-gray-400">No se encontraron animales</p>
                <p className="text-xs text-gray-300">
                  Usá el botón «Importar CSV» o «Agregar animal» para comenzar.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Caravana</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">RFID</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sexo</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Raza</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nacimiento</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rodeo</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Potrero</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                    <th className="pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {animals.map((a: any) => (
                    <tr key={a.id} className="group hover:bg-gray-50 transition-colors">
                      <td className="py-3 text-sm font-black text-gray-900">{a.visual_tag || '—'}</td>
                      <td className="py-3 text-sm font-mono text-gray-400">{a.rfid_code || '—'}</td>
                      <td className="py-3 text-sm text-gray-600">{a.sex === 'MACHO' ? 'Macho' : 'Hembra'}</td>
                      <td className="py-3 text-sm text-gray-600">{a.breed || '—'}</td>
                      <td className="py-3 text-sm text-gray-600">
                        {a.birth_date
                          ? new Date(a.birth_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="py-3 text-sm text-gray-600">{a.herd_name || '—'}</td>
                      <td className="py-3 text-sm text-gray-600">{a.paddock_name || '—'}</td>
                      <td className="py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_STYLES[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/dashboard/animals/${a.id}`}
                          className="inline-flex items-center text-sm font-bold text-green-600 hover:text-green-700 transition-colors"
                        >
                          Ver <ChevronRight className="w-4 h-4 ml-0.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
            <span>Mostrando {animals.length} animales</span>
            <div className="flex gap-2">
              <button disabled className="px-3 py-1 border border-gray-200 rounded-lg bg-white text-gray-500 disabled:opacity-40 text-xs font-bold">Anterior</button>
              <button disabled className="px-3 py-1 border border-gray-200 rounded-lg bg-white text-gray-500 disabled:opacity-40 text-xs font-bold">Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
