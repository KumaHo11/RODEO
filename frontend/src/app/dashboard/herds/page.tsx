'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Plus, Search, Edit2, Trash2, X, Check, Camera, Sparkles, Loader2, HeartPulse, Beef } from 'lucide-react'


const ANIMAL_TYPES = [
  { id: 'vacas',       label: 'Vacas',       demandFactor: 1.0,  color: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  { id: 'vaquillonas', label: 'Vaquillonas', demandFactor: 1.0,  color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
  { id: 'terneros',    label: 'Terneros',    demandFactor: 0.6,  color: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500' },
  { id: 'ovejas',      label: 'Ovejas',      demandFactor: 0.15, color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  { id: 'cabras',      label: 'Cabras',      demandFactor: 0.15, color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  { id: 'caballos',    label: 'Caballos',    demandFactor: 1.27, color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  { id: 'toros',       label: 'Toros',       demandFactor: 1.25, color: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
]

const BREED_OPTIONS: Record<string, string[]> = {
  vacas:       ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  vaquillonas: ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  terneros:    ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  ovejas:      ['Merino', 'Corriedale', 'Texel', 'Hampshire Down', 'Dorper', 'Otra'],
  cabras:      ['Boer', 'Anglo-Nubian', 'Saanen', 'Criolla', 'Otra'],
  caballos:    ['Criollo', 'Cuarto de Milla', 'Polo Argentino', 'Árabe', 'Percherón', 'Otra'],
  toros:       ['Angus', 'Hereford', 'Braford', 'Brangus', 'Otra'],
}

const EMPTY_FORM = {
  id: '', name: '', species: 'vacas', breed: '', head_count: 0, avg_weight_kg: 0, age_years: 0
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve({ base64: dataUrl.split(',')[1], mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function calculateEV(weight: number, headCount: number, speciesId: string): number {
  if (!weight || !headCount) return 0
  const species = ANIMAL_TYPES.find(t => t.id === speciesId)
  const factor = species?.demandFactor || 1.0
  return Math.pow(weight / 400, 0.75) * factor * headCount
}

export default function HerdsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [herds, setHerds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSpecies, setFilterSpecies] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [modalBcsFile, setModalBcsFile] = useState<File | null>(null)
  const [modalBcsPreview, setModalBcsPreview] = useState<string | null>(null)
  const [modalBcsResult, setModalBcsResult] = useState<any | null>(null)
  const [modalBcsError, setModalBcsError] = useState<string | null>(null)
  const [analyzingBcs, setAnalyzingBcs] = useState(false)
  const modalCameraRef = useRef<HTMLInputElement>(null)
  const modalGalleryRef = useRef<HTMLInputElement>(null)

  const loadHerds = async () => {
    if (!user) return
    setLoading(true)
    const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (orgData?.organization_id) {
      const { data } = await supabase
        .from('herds').select('*')
        .eq('org_id', orgData.organization_id)
        .order('created_at', { ascending: false })
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
  // Consumo ms diario total del campo (3% del PV)
  const totalDailyMS = herds.reduce((s, h) => s + (Number(h.head_count) || 0) * (Number(h.avg_weight_kg) || 0) * 0.03, 0)

  const openCreate = () => { setForm(EMPTY_FORM); setModalBcsFile(null); setModalBcsPreview(null); setModalBcsResult(null); setModalBcsError(null); setModalOpen(true) }
  const openEdit = (herd: any) => {
    setForm({
      id: herd.id, name: herd.name, species: herd.species, breed: herd.breed || '',
      head_count: herd.head_count, avg_weight_kg: herd.avg_weight_kg || 0, age_years: herd.age_years || 0
    })
    setModalBcsFile(null)
    setModalBcsPreview(herd.photo_url || null)
    setModalBcsResult(herd.bcs_data || null)
    setModalBcsError(null)
    setModalOpen(true)
  }

  const handleHerdBcs = async () => {
    if (!modalBcsFile) return
    setAnalyzingBcs(true)
    setModalBcsResult(null)
    setModalBcsError(null)
    try {
      const { base64, mimeType } = await fileToBase64(modalBcsFile)
      const res = await fetch('/api/analyze-body-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, species: form.species }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setModalBcsResult(json.data)
    } catch (err: any) {
      setModalBcsError(err.message || 'Error en análisis')
    }
    setAnalyzingBcs(false)
  }

  const handleSave = async () => {
    if (!form.name || !form.head_count) return
    setSaving(true)
    const { data: orgData } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    if (!orgData) { setSaving(false); return }
    let photo_url = null
    if (modalBcsFile) {
      const { data: orgData2 } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
      if (orgData2?.organization_id) {
        const ext = modalBcsFile.name.split('.').pop()
        const path = `herds/${orgData2.organization_id}/${Date.now()}.${ext}`
        const { data: uploaded } = await supabase.storage.from('field-photos').upload(path, modalBcsFile, { upsert: true })
        if (uploaded) {
          const { data: pub } = supabase.storage.from('field-photos').getPublicUrl(path)
          photo_url = pub.publicUrl
        }
      }
    }
    const payload = {
      org_id: orgData.organization_id,
      name: form.name,
      species: form.species,
      breed: form.breed,
      head_count: form.head_count,
      avg_weight_kg: form.avg_weight_kg,
      age_years: form.age_years,
      total_ev: calculateEV(form.avg_weight_kg, form.head_count, form.species),
      ...(photo_url ? { photo_url } : {}),
      ...(modalBcsResult ? { bcs_data: modalBcsResult, bcs_score: modalBcsResult.bcs_score, bcs_label: modalBcsResult.condition_label } : {}),
    }
    if (form.id) {
      await supabase.from('herds').update(payload).eq('id', form.id)
    } else {
      await supabase.from('herds').insert([payload])
    }
    setSaving(false)
    setModalOpen(false)
    loadHerds()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este rebaño?')) return
    await supabase.from('herds').delete().eq('id', id)
    loadHerds()
  }

  const getAnimalType = (id: string) => ANIMAL_TYPES.find(t => t.id === id) || ANIMAL_TYPES[0]
  const liveEV = calculateEV(form.avg_weight_kg, form.head_count, form.species)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Rebaños</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gestión de lotes de animales por especie, categoría y carga animal.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200"
        >
          <Plus className="w-4 h-4" /> Nuevo Rebaño
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Total Rebaños</p>
          <p className="text-4xl font-black text-gray-950">{herds.length}</p>
          <p className="text-[9px] text-gray-400 mt-1">{totalAnimals.toLocaleString()} animales</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-amber-500 tracking-widest uppercase mb-2">Consumo Diario</p>
          <p className="text-4xl font-black text-amber-700">{totalDailyMS >= 1000 ? `${(totalDailyMS/1000).toFixed(1)}k` : Math.round(totalDailyMS).toLocaleString()}</p>
          <p className="text-[9px] text-amber-500 mt-1">kg MS/día · {totalEV.toFixed(1)} EV</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Carga (EV)</p>
          <p className="text-4xl font-black text-orange-600">{totalEV.toFixed(1)}</p>
          <p className="text-[9px] text-gray-400 mt-1">Equivalente Vaca total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar rebaño o raza..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterSpecies('all')}
            className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${filterSpecies === 'all' ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            Todos
          </button>
          {ANIMAL_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterSpecies(filterSpecies === t.id ? 'all' : t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${filterSpecies === t.id ? `${t.color} border-transparent` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
            >
              <span className={`w-2 h-2 rounded-full ${t.dot}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
          <Beef className="w-12 h-12 text-gray-200 mx-auto mb-3" />
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
                {/* Card Header */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${at.color}`}>
                <Beef className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-950 tracking-tight leading-tight">{herd.name}</h3>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${at.color} mt-0.5 inline-block`}>
                        {at.label}
                      </span>
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
                  {/* Primary: Consumo diario */}
                  <div className="mb-3">
                    <p className="text-[9px] font-black text-amber-500 tracking-widest uppercase mb-0.5">Consumo Diario</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-gray-950 tracking-tighter">
                        {Math.round((Number(herd.head_count) || 0) * (Number(herd.avg_weight_kg) || 0) * 0.03).toLocaleString()}
                      </p>
                      <span className="text-xs font-bold text-gray-400">kg MS/día</span>
                    </div>
                  </div>
                  {/* Secondary: Cabezas + EV */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-0.5">Cabezas</p>
                      <p className="text-lg font-black text-gray-700">{herd.head_count}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-0.5">EV Total</p>
                      <p className="text-lg font-black text-orange-500">{Number(herd.total_ev).toFixed(1)}</p>
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

                {/* Photo + BCS Badge */}
                {(herd.photo_url || herd.bcs_score) && (
                  <div className="px-5 pb-3 flex items-center gap-2">
                    {herd.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={herd.photo_url} alt="Foto rebaño" className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                    )}
                    {herd.bcs_score && (
                      <div className="flex-1 bg-amber-50 rounded-xl px-3 py-1.5 border border-amber-100">
                        <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Condición Corporal</p>
                        <p className="text-sm font-black text-amber-800">CC {herd.bcs_score} &mdash; {herd.bcs_label || ''}</p>
                      </div>
                    )}
                  </div>
                )}

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
                <h3 className="text-base font-black text-gray-950">{form.id ? 'Editar Rebaño' : 'Nuevo Rebaño'}</h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Datos del lote de animales</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nombre del Lote *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Vacas preñadas - Lote A"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all"
                />
              </div>

              {/* Especie / Categoría */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Especie / Categoría *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ANIMAL_TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setForm({ ...form, species: t.id, breed: '' })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border text-left ${form.species === t.id ? `${t.color} border-transparent shadow-sm` : 'border-gray-100 text-gray-600 hover:border-gray-200 bg-gray-50'}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Raza */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Raza</label>
                <div className="flex flex-wrap gap-1.5">
                  {(BREED_OPTIONS[form.species] || ['Otra']).map(b => (
                    <button
                      key={b}
                      onClick={() => setForm({ ...form, breed: b })}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${form.breed === b ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-gray-50'}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
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

              {/* BCS Photo Section */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Foto del Rebaño + Condición Corporal IA</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => modalCameraRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 transition-all active:scale-95"
                  >
                    <Camera className="w-5 h-5 text-violet-600" />
                    <span className="text-[10px] font-black text-violet-700">Cámara</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => modalGalleryRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 border-sky-200 bg-sky-50 hover:border-sky-400 transition-all active:scale-95"
                  >
                    <span className="text-lg">🖼</span>
                    <span className="text-[10px] font-black text-sky-700">Galería</span>
                  </button>
                </div>
                <input ref={modalCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f){ setModalBcsFile(f); setModalBcsPreview(URL.createObjectURL(f)); setModalBcsResult(null) }}} />
                <input ref={modalGalleryRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f){ setModalBcsFile(f); setModalBcsPreview(URL.createObjectURL(f)); setModalBcsResult(null) }}} />

                {modalBcsPreview && (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={modalBcsPreview} alt="Preview" className="w-full h-40 object-cover rounded-2xl" />
                    {!analyzingBcs && !modalBcsResult && (
                      <button
                        type="button"
                        onClick={handleHerdBcs}
                        className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-xs font-black hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                      >
                        <HeartPulse className="w-4 h-4" /> Analizar Condición Corporal
                      </button>
                    )}
                    {analyzingBcs && (
                      <div className="flex items-center justify-center gap-2 py-3 text-amber-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-bold">Analizando con Gemini...</span>
                      </div>
                    )}
                    {modalBcsResult && (
                      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 text-white">
                        <div className="flex items-center gap-2 mb-2">
                          <HeartPulse className="w-3.5 h-3.5 text-amber-200" />
                          <p className="text-[9px] font-black uppercase tracking-wider text-amber-100">Condición Corporal</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-2xl font-black">{modalBcsResult.bcs_score}</p>
                            <p className="text-[9px] text-amber-300">/ {modalBcsResult.bcs_scale}</p>
                          </div>
                          <div>
                            <p className="text-sm font-black">{modalBcsResult.condition_label}</p>
                            <p className="text-[10px] text-amber-200">{modalBcsResult.nutritional_status}</p>
                          </div>
                        </div>
                        {modalBcsResult.recommendation && (
                          <p className="text-[10px] text-amber-100 mt-2 leading-relaxed bg-white/10 rounded-lg px-2 py-1.5">{modalBcsResult.recommendation}</p>
                        )}
                      </div>
                    )}
                    {modalBcsError && <p className="text-xs text-red-600 font-bold">{modalBcsError}</p>}
                  </div>
                )}
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
              <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.head_count}
                className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {form.id ? 'Actualizar' : 'Crear Rebaño'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
