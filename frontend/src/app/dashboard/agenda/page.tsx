'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { Plus, X, Check, Calendar, Trash2, ChevronDown, Edit2 } from 'lucide-react'

const EVENT_TYPES = [
  { id: 'servicio',             label: 'Servicio',                 color: '#ef4444', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  { id: 'paricion',             label: 'Parición',                 color: '#3b82f6', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  { id: 'destete',              label: 'Destete',                  color: '#eab308', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  { id: 'diagnostico_prenez',   label: 'Diagnóstico de Preñez',    color: '#f97316', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  { id: 'tratamiento_sanitario',label: 'Tratamiento Sanitario',    color: '#78350f', bg: 'bg-amber-100',  text: 'text-amber-900',  dot: 'bg-amber-800' },
  { id: 'esquila',              label: 'Esquila',                  color: '#7c3aed', bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  { id: 'vacaciones',           label: 'Vacaciones',               color: '#ec4899', bg: 'bg-pink-100',   text: 'text-pink-700',   dot: 'bg-pink-500' },
]

const getEventType = (id: string) => EVENT_TYPES.find(e => e.id === id) || EVENT_TYPES[0]

const STATUS_OPTIONS = [
  { id: 'pendiente',   label: 'Pendiente',   color: 'bg-gray-100 text-gray-600' },
  { id: 'completado',  label: 'Completado',  color: 'bg-green-100 text-green-700' },
  { id: 'cancelado',   label: 'Cancelado',   color: 'bg-red-100 text-red-700' },
]

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Safe date parser — handles both '2026-03-15' and '2026-03-15T00:00:00.000Z'
function safeDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  // date-only string → append time to avoid UTC shift
  const s = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00' : raw
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const EMPTY_FORM = {
  title: '',
  event_type: 'servicio',
  event_date: '',
  end_date: '',
  description: '',
  status: 'pendiente',
  herd_id: '',
}

export default function AgendaPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<any | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    const [eventsRes, herdsRes] = await Promise.all([
      apiFetch('/api/farm-events'),
      apiFetch('/api/herds'),
    ])
    setEvents(eventsRes.ok ? (await eventsRes.json()).events || [] : [])
    setHerds(herdsRes.ok ? (await herdsRes.json()).herds || [] : [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user])

  const openCreate = () => {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (event: any) => {
    setEditingEvent(event)
    setForm({
      title: event.title,
      event_type: event.event_type,
      event_date: event.event_date,
      end_date: event.end_date || '',
      description: event.description || '',
      status: event.status,
      herd_id: event.herd_id || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title || !form.event_date) return
    setSaving(true)
    const payload = {
      title: form.title,
      event_type: form.event_type,
      event_date: form.event_date,
      end_date: form.end_date || null,
      description: form.description || null,
      status: form.status,
      herd_id: form.herd_id || null,
    }

    if (editingEvent) {
      await apiFetch(`/api/farm-events/${editingEvent.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    } else {
      await apiFetch('/api/farm-events', { method: 'POST', body: JSON.stringify(payload) })
    }

    setSaving(false)
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditingEvent(null)
    loadData()
  }

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/farm-events/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const filtered = events.filter(e => {
    const matchType = filterType === 'all' || e.event_type === filterType
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    return matchType && matchStatus
  })

  // Group by month — skip events with invalid dates
  const grouped = filtered.reduce((acc: Record<string, any[]>, event) => {
    const d = safeDate(event.event_date)
    if (!d) return acc
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  const upcoming = events.filter(e => { const d = safeDate(e.event_date); return d && d >= new Date() && e.status === 'pendiente' }).length
  const completed = events.filter(e => e.status === 'completado').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Agenda Sanitaria</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gestión de eventos ganaderos: servicios, pariciones, sanidad y más
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200"
        >
          <Plus className="w-4 h-4" /> Nuevo Evento
        </button>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Total Eventos</p>
          <p className="text-3xl font-black text-gray-950">{events.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Próximos</p>
          <p className="text-3xl font-black text-blue-600">{upcoming}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Completados</p>
          <p className="text-3xl font-black text-green-600">{completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Tasa Completitud</p>
          <p className="text-3xl font-black text-gray-950">{events.length > 0 ? Math.round((completed / events.length) * 100) : 0}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-1 focus:ring-green-600 outline-none"
        >
          <option value="all">Todos los tipos</option>
          {EVENT_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-1 focus:ring-green-600 outline-none"
        >
          <option value="all">Todos los estados</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Event Legend */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">Tipos de Evento</p>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterType(filterType === t.id ? 'all' : t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${filterType === t.id ? `${t.bg} ${t.text} border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <span className={`w-2 h-2 rounded-full ${t.dot}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">No hay eventos para mostrar</p>
          <p className="text-[10px] text-gray-300 mt-1">Crea tu primer evento con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, groupEvents]) => {
            const [year, month] = key.split('-')
            return (
              <div key={key}>
                <h3 className="text-xs font-black text-gray-400 tracking-widest uppercase mb-3 ml-1">
                  {MONTH_NAMES[parseInt(month)]} {year}
                </h3>
                <div className="space-y-2">
                  {(groupEvents as any[]).map((event: any) => {
                    const et = getEventType(event.event_type)
                    const stat = STATUS_OPTIONS.find(s => s.id === event.status) || STATUS_OPTIONS[0]
                    const d = safeDate(event.event_date)

                    return (
                      <div
                        key={event.id}
                        className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group"
                      >
                        {/* Date badge */}
                        <div className="shrink-0 w-14 text-center">
                          <p className="text-xl font-black text-gray-900 leading-none">
                            {d ? d.getDate() : '—'}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">
                            {d ? MONTH_NAMES[d.getMonth()] : ''}
                          </p>
                        </div>

                        {/* Color dot */}
                        <div className="shrink-0 w-3 h-3 rounded-full" style={{ backgroundColor: et.color }} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{event.title}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${et.bg} ${et.text}`}>
                              {et.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stat.color}`}>
                              {stat.label}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{event.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => openEdit(event)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-950">
                {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Título del Evento *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Vacunación rodeo principal"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                />
              </div>

              {/* Event Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Tipo de Evento *</label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setForm({ ...form, event_type: t.id })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border text-left ${form.event_type === t.id ? `${t.bg} ${t.text} border-transparent shadow-sm` : 'border-gray-100 text-gray-600 hover:border-gray-200 bg-gray-50'}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Fecha *</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm({ ...form, event_date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Fecha Fin</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                  />
                </div>
              </div>

              {/* Herd */}
              {herds.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Rebaño</label>
                  <select
                    value={form.herd_id}
                    onChange={e => setForm({ ...form, herd_id: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                  >
                    <option value="">Sin rebaño específico</option>
                    {herds.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Estado</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setForm({ ...form, status: s.id })}
                      className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${form.status === s.id ? `${s.color} border-transparent` : 'border-gray-100 text-gray-500 bg-gray-50'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Notas</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Observaciones, veterinario, dosis..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.event_date}
                className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {editingEvent ? 'Actualizar' : 'Crear Evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
