'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Edit2, Plus, Beef, ClipboardList } from 'lucide-react'
import { useAnimal } from '../hooks/useAnimal'
import { AnimalTimeline } from './components/AnimalTimeline'
import { AddEventModal } from './components/AddEventModal'

export default function AnimalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { animal, events, loading, addEvent } = useAnimal(params.id as string)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-400">Cargando perfil...</p>
      </div>
    )
  }

  if (!animal) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-600 font-bold mb-4">Animal no encontrado</div>
        <button onClick={() => router.push('/dashboard/animals')} className="text-emerald-600 hover:underline">
          Volver al registro
        </button>
      </div>
    )
  }

  const age = animal.birth_date ? Math.floor((new Date().getTime() - new Date(animal.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
        
        <Link href="/dashboard/animals" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-6 text-sm font-semibold transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver a animales
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ficha del Animal */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-200">
                  <Beef className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{animal.visual_tag || 'Sin Tag'}</h1>
                  <p className="text-sm font-mono text-gray-400">{animal.rfid_code || 'Sin RFID'}</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Sexo</span>
                  <span className="text-sm font-semibold text-gray-900">{animal.sex === 'MACHO' ? '♂ Macho' : '♀ Hembra'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Raza</span>
                  <span className="text-sm font-semibold text-gray-900">{animal.breed || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nacimiento</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {animal.birth_date ? `${new Date(animal.birth_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} (${age} años)` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Madre</span>
                  <span className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer">
                    {animal.mother_tag ? `→ ${animal.mother_tag}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Padre</span>
                  <span className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer">
                    {animal.father_tag ? `→ ${animal.father_tag}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Potrero actual</span>
                  <span className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer">
                    {animal.paddock_name ? `→ ${animal.paddock_name}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Rodeo</span>
                  <span className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer">
                    {animal.herd_name ? `→ ${animal.herd_name}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Estado</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    animal.status === 'VIVO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    animal.status === 'VENDIDO' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {animal.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setIsEventModalOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar evento
                </button>
                <button className="w-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                  <Edit2 className="w-4 h-4" /> Editar ficha
                </button>
              </div>
            </div>
          </div>

          {/* Bitácora de Vida */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-h-full">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
                <ClipboardList className="w-5 h-5 text-emerald-600" />
                Bitácora de Vida
              </h2>
              
              <AnimalTimeline events={events} />
            </div>
          </div>
        </div>
      </div>

      <AddEventModal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        onAdd={addEvent} 
      />
    </div>
  )
}
