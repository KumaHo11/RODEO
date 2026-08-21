'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Edit2, Plus } from 'lucide-react'
import { useAnimal } from '../hooks/useAnimal'
import { AnimalTimeline } from './components/AnimalTimeline'
import { AddEventModal } from './components/AddEventModal'
import { EditAnimalModal } from './components/EditAnimalModal'

function AnimalAvatar({ tag, sex }: { tag: string | null; sex: string | null }) {
  const initials = tag
    ? tag.slice(0, 2).toUpperCase()
    : sex === 'MACHO' ? '♂' : '♀'
  const bgColor = sex === 'MACHO'
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : 'bg-green-50 border-green-200 text-green-700'

  return (
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border text-xl font-black ${bgColor}`}>
      {initials}
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  VIVO:    'bg-green-50 text-green-700 border border-green-200',
  VENDIDO: 'bg-blue-50 text-blue-700 border border-blue-200',
  FAENADO: 'bg-red-50 text-red-700 border border-red-200',
  MUERTO:  'bg-gray-100 text-gray-500 border border-gray-200',
}

export default function AnimalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { animal, events, loading, addEvent, refetch } = useAnimal(params.id as string)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen]   = useState(false)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!animal) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="text-red-600 font-bold">Animal no encontrado</div>
        <button
          onClick={() => router.push('/dashboard/animals')}
          className="text-green-600 hover:underline text-sm font-semibold"
        >
          Volver al registro
        </button>
      </div>
    )
  }

  const age = animal.birth_date
    ? Math.floor((new Date().getTime() - new Date(animal.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/animals"
        className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Volver a animales
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Ficha del animal ─────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
            {/* Avatar + identificación */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
              <AnimalAvatar tag={animal.visual_tag} sex={animal.sex} />
              <div>
                <h1 className="text-2xl font-black text-gray-950">
                  {animal.visual_tag || animal.name || 'Sin Tag'}
                </h1>
                <p className="text-sm font-mono text-gray-400">{animal.rfid_code || 'Sin RFID'}</p>
              </div>
            </div>

            {/* Datos */}
            <div className="space-y-3 mb-8">
              <DataRow label="Sexo"       value={animal.sex === 'MACHO' ? 'Macho' : 'Hembra'} />
              <DataRow label="Raza"       value={animal.breed} />
              <DataRow label="Nacimiento" value={
                animal.birth_date
                  ? `${new Date(animal.birth_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}${age !== null ? ` (${age} años)` : ''}`
                  : null
              } />
              <DataRow label="Madre"      value={animal.mother_tag ? `→ ${animal.mother_tag}` : null} link />
              <DataRow label="Padre"      value={animal.father_tag ? `→ ${animal.father_tag}` : null} link />
              <DataRow label="Potrero"    value={animal.paddock_name ? `→ ${animal.paddock_name}` : null} link />
              <DataRow label="Rodeo"      value={animal.herd_name ? `→ ${animal.herd_name}` : null} link />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Estado</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_STYLES[animal.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {animal.status}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsEventModalOpen(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm shadow-green-200"
              >
                <Plus className="w-4 h-4" />
                Agregar evento
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="w-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar ficha
              </button>
            </div>
          </div>
        </div>

        {/* ── Bitácora de vida ─────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-h-full">
            <h2 className="text-base font-black text-gray-950 mb-6">
              Bitácora de vida
              <span className="ml-2 text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full align-middle">
                {events.length} eventos
              </span>
            </h2>
            <AnimalTimeline events={events} />
          </div>
        </div>
      </div>

      {/* Modales */}
      <AddEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onAdd={addEvent}
      />
      <EditAnimalModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        animal={animal}
        onSaved={() => refetch()}
      />
    </div>
  )
}

function DataRow({ label, value, link = false }: { label: string; value: string | null | undefined; link?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${link && value ? 'text-green-600 hover:text-green-700 cursor-pointer' : 'text-gray-900'}`}>
        {value || '—'}
      </span>
    </div>
  )
}
