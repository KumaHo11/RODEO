'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { Plus, Search, Edit2, Trash2, X, Check, Camera, Sparkles, Loader2, HeartPulse, Paperclip } from 'lucide-react'
import { Button, FormField } from '@/design-system'

const ANIMAL_TYPES = [
  { id: 'vacas',       label: 'Vacas',       demandFactor: 1.0 },
  { id: 'toro',        label: 'Toro',        demandFactor: 1.25 },
  { id: 'novillo',     label: 'Novillo',     demandFactor: 1.0 },
  { id: 'vaquillona',  label: 'Vaquillona',  demandFactor: 1.0 },
  { id: 'ternero',     label: 'Ternero',     demandFactor: 0.6 },
  { id: 'ternera',     label: 'Ternera',     demandFactor: 0.6 },
  { id: 'cabras',      label: 'Cabras',      demandFactor: 0.15 },
  { id: 'caballos',    label: 'Caballos',    demandFactor: 1.25 },
  { id: 'ovejas',      label: 'Ovejas',      demandFactor: 0.15 },
  { id: 'otro',        label: 'Otro',        demandFactor: 1.0 },
]

const BREED_OPTIONS: Record<string, string[]> = {
  vacas:       ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  vaquillona:  ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  ternero:     ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  ternera:     ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  novillo:     ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  toro:        ['Angus', 'Hereford', 'Braford', 'Brangus', 'Otra'],
  ovejas:      ['Merino', 'Corriedale', 'Texel', 'Hampshire Down', 'Dorper', 'Otra'],
  cabras:      ['Boer', 'Anglo-Nubian', 'Saanen', 'Criolla', 'Otra'],
  caballos:    ['Criollo', 'Cuarto de Milla', 'Polo Argentino', 'Árabe', 'Percherón', 'Otra'],
}

const EMPTY_FORM = {
  id: '', name: '', species: 'vacas', breed: '', head_count: 0, avg_weight_kg: 0, age_years: 0,
  photo_url: null as string | null,
}

function calculateEV(weight: number, headCount: number, speciesId: string): number {
  if (!weight || !headCount) return 0
  const species = ANIMAL_TYPES.find(t => t.id === speciesId)
  const factor = species?.demandFactor || 1.0
  return Math.pow(weight / 400, 0.75) * factor * headCount
}

export default function HerdsPage() {
  const { user } = useAuth()
  const [herds, setHerds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSpecies, setFilterSpecies] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadHerds = async () => {
    if (!user) return
    setLoading(true)
    const res = await apiFetch('/api/herds')
    if (res.ok) {
      const { herds: data } = await res.json()
      setHerds(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadHerds() }, [user])

  const filtered = useMemo(() =>
    herds.filter(h => {
      const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.breed && h.breed.toLowerCase().includes(search.toLowerCase()))
      const matchFilter = filterSpecies === 'all' || h.species === filterSpecies
      return matchSearch && matchFilter
    }), [herds, search, filterSpecies])

  const totalAnimals = herds.reduce((s, h) => s + (Number(h.head_count) || 0), 0)
  const totalEV      = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
  const totalDailyMS = herds.reduce((s, h) => s + (Number(h.head_count) || 0) * (Number(h.avg_weight_kg) || 0) * 0.03, 0)

  const openCreate = () => { setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (herd: any) => {
    setForm({
      id: herd.id, name: herd.name, species: herd.species, breed: herd.breed || '',
      head_count: herd.head_count, avg_weight_kg: herd.avg_weight_kg || 0, age_years: herd.age_years || 0,
      photo_url: null,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.head_count) return
    setSaving(true)

    const payload = {
      name: form.name,
      species: form.species,
      breed: form.breed,
      head_count: form.head_count,
      avg_weight_kg: form.avg_weight_kg,
      age_years: form.age_years,
      total_ev: calculateEV(form.avg_weight_kg, form.head_count, form.species),
      photo_url: null,
    }

    if (form.id) {
      await apiFetch(`/api/herds/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    } else {
      await apiFetch('/api/herds', { method: 'POST', body: JSON.stringify(payload) })
    }

    setSaving(false)
    setModalOpen(false)
    loadHerds()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este rebaño?')) return
    await apiFetch(`/api/herds/${id}`, { method: 'DELETE' })
    loadHerds()
  }

  const getAnimalType = (id: string) => ANIMAL_TYPES.find(t => t.id === id) || ANIMAL_TYPES[0]
  const liveEV = calculateEV(form.avg_weight_kg, form.head_count, form.species)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Rodeos</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gestión de lotes de animales por especie, categoría y carga animal.
          </p>
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Nuevo Rodeo
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Total Rodeos</p>
          <p className="text-4xl font-black text-gray-950">{herds.length}</p>
          <p className="text-[9px] text-gray-400 mt-1">{totalAnimals.toLocaleString()} animales</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-amber-500 tracking-widest uppercase mb-2">Consumo Diario</p>
          <p className="text-4xl font-bold text-amber-700">{totalDailyMS >= 1000 ? `${(totalDailyMS/1000).toFixed(1)}k` : Math.round(totalDailyMS).toLocaleString()}</p>
          <p className="text-[9px] text-amber-500 mt-1 font-medium">kg MS/día · {totalEV.toFixed(1)} EV</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Carga (EV)</p>
          <p className="text-4xl font-bold text-orange-600">{totalEV.toFixed(1)}</p>
          <p className="text-[9px] text-gray-400 mt-1 font-medium">Equivalente Vaca total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar rebaño o raza..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-gray-200 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 px-2 border-l border-gray-100">
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Especie</label>
          <select
            value={filterSpecies}
            onChange={e => setFilterSpecies(e.target.value)}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
          >
            <option value="all">Todas</option>
            {ANIMAL_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <span className="text-2xl">🐄</span>
          </div>
          <p className="text-sm font-bold text-gray-400">No hay rebaños que mostrar</p>
          <p className="text-[10px] text-gray-300 mt-1">Crea tu primer rebaño o cambia los filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(herd => {
            const at = getAnimalType(herd.species)
            const evPct = totalEV > 0 ? (Number(herd.total_ev) / totalEV) * 100 : 0

            return (
              <div key={herd.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                <div className="h-1 w-full bg-gray-200" />
                {/* Card Header */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                      {at.label.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-950 tracking-tight leading-tight">{herd.name}</h3>
                      <p className="text-[10px] font-medium text-gray-500 mt-0.5">{at.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openEdit(herd)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(herd.id)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="px-5 py-3 border-t border-gray-50">
                  <div className="mb-3">
                    <p className="text-[9px] font-bold text-amber-500 tracking-widest uppercase mb-0.5">Consumo Diario</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold text-gray-950 tracking-tighter">
                        {Math.round((Number(herd.head_count) || 0) * (Number(herd.avg_weight_kg) || 0) * 0.03).toLocaleString()}
                      </p>
                      <span className="text-xs font-bold text-gray-400">kg MS/día</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">Cabezas</p>
                      <p className="text-lg font-bold text-gray-700">{herd.head_count}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">EV Total</p>
                      <p className="text-lg font-bold text-orange-500">{Number(herd.total_ev).toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-0.5">Raza</p>
                      <p className="text-xs font-bold text-gray-700">{herd.breed || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-0.5">Peso / Edad</p>
                      <p className="text-xs font-bold text-gray-700">
                        {herd.avg_weight_kg ? `${herd.avg_weight_kg} kg` : '—'} · {herd.age_years ? `${herd.age_years} a` : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* EV Bar */}
                <div className="px-5 pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-bold text-gray-400">% de la carga total</p>
                    <p className="text-[9px] font-black text-gray-600">{evPct.toFixed(1)}%</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${evPct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-950">{form.id ? 'Editar Rodeo' : 'Nuevo Rodeo'}</h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Datos del lote de animales</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nombre */}
              <FormField
                label="Nombre del Lote *"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Vacas preñadas - Lote A"
              />

              {/* Especie / Categoria Comercial */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Especie / Categoría *</label>
                <select
                  required
                  value={form.species}
                  onChange={e => setForm({ ...form, species: e.target.value, breed: '' })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:ring-1 focus:ring-gray-400 outline-none transition-all"
                >
                  {ANIMAL_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Raza */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Raza</label>
                <select
                  value={form.breed}
                  onChange={e => setForm({ ...form, breed: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:ring-1 focus:ring-gray-400 outline-none transition-all"
                >
                  <option value="">No aplica / Otra</option>
                  {(BREED_OPTIONS[form.species] || BREED_OPTIONS['vacas']).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Cabezas + Peso + Edad */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Cabezas *</label>
                  <input
                    type="number" min="1"
                    value={form.head_count || ''}
                    onChange={e => setForm({ ...form, head_count: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Peso prom. (kg)</label>
                  <input
                    type="number" min="0"
                    value={form.avg_weight_kg || ''}
                    onChange={e => setForm({ ...form, avg_weight_kg: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Edad (años)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={form.age_years || ''}
                    onChange={e => setForm({ ...form, age_years: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                  />
                </div>
              </div>



              {/* EV Calculator */}
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-orange-500 tracking-widest uppercase mb-0.5">Equivalente Vaca (EV)</p>
                    <p className="text-3xl font-black text-gray-950 tracking-tighter">{liveEV.toFixed(2)}</p>
                    <p className="text-[9px] text-orange-400 mt-0.5">
                      {form.head_count} animales × factor {ANIMAL_TYPES.find(t => t.id === form.species)?.demandFactor.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right text-[9px] font-medium text-orange-400 max-w-[120px]">
                    W^0.75 / 400^0.75 × encaje por especie
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                isLoading={saving}
                disabled={!form.name || !form.head_count}
                leftIcon={<Check className="w-4 h-4" />}
              >
                {form.id ? 'Actualizar' : 'Crear Rodeo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
