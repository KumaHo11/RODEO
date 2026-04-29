'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { Plus, X, Check, Calendar, Trash2, Edit2, ChevronLeft, ChevronRight, AlignJustify } from 'lucide-react'
import { FeatureGate } from '@/components/FeatureGate'

const EVENT_TYPES = [
  { id: 'servicio',             label: 'Servicio',                 color: '#be185d', bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    emoji: '🐄' },
  { id: 'paricion',             label: 'Parición',                 color: '#be185d', bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500',   emoji: '🍼' },
  { id: 'destete',              label: 'Destete',                  color: '#d97706', bg: 'bg-yellow-50',  text: 'text-yellow-700', dot: 'bg-yellow-500', emoji: '🧶' },
  { id: 'diagnostico_prenez',   label: 'Diagnóstico de Preñez',    color: '#be185d', bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', emoji: '🔍' },
  { id: 'tratamiento_sanitario',label: 'Tratamiento Sanitario',    color: '#7c3aed', bg: 'bg-amber-50',   text: 'text-amber-900',  dot: 'bg-amber-800',  emoji: '💉' },
  { id: 'esquila',              label: 'Esquila',                  color: '#7c3aed', bg: 'bg-violet-50',  text: 'text-violet-700', dot: 'bg-violet-500', emoji: '✂️' },
  { id: 'vacaciones',           label: 'Vacaciones',               color: '#ec4899', bg: 'bg-pink-50',    text: 'text-pink-700',   dot: 'bg-pink-500',   emoji: '🏖️' },
]

const getEventType = (id: string) => EVENT_TYPES.find(e => e.id === id) || EVENT_TYPES[0]



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
  herd_ids: [] as string[],
  body_condition: '',
}

export default function AgendaPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [grazingPlans, setGrazingPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'info'>('info')
  const [editingEvent, setEditingEvent] = useState<any | null>(null)
  const [form, setForm] = useState<{
    title: string; event_type: string; event_date: string; end_date: string;
    description: string; status: string; herd_id: string; herd_ids: string[];
    body_condition: string;
  }>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [agendaView, setAgendaView] = useState<'lista' | 'calendario'>('calendario')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayModalOpen, setDayModalOpen] = useState(false)

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    const [eventsRes, herdsRes, plansRes] = await Promise.all([
      apiFetch('/api/farm-events'),
      apiFetch('/api/herds'),
      apiFetch('/api/grazing-plans'),
    ])
    setEvents(eventsRes.ok ? (await eventsRes.json()).events || [] : [])
    setHerds(herdsRes.ok ? (await herdsRes.json()).herds || [] : [])
    setGrazingPlans(plansRes.ok ? (await plansRes.json()).plans || [] : [])
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
    
    // Parse herd_ids safely, handling stringified JSON or plain arrays
    let parsedHerdIds: string[] = []
    try {
      if (typeof event.herd_ids === 'string') parsedHerdIds = JSON.parse(event.herd_ids)
      else if (Array.isArray(event.herd_ids)) parsedHerdIds = event.herd_ids
    } catch { parsedHerdIds = [] }
    // Backwards compatibility with herd_id
    if (parsedHerdIds.length === 0 && event.herd_id) parsedHerdIds = [event.herd_id]

    setForm({
      title: event.title,
      event_type: event.event_type,
      event_date: event.event_date,
      end_date: event.end_date || '',
      description: event.description || '',
      status: event.status,
      herd_id: event.herd_id || '',
      herd_ids: parsedHerdIds,
      body_condition: event.body_condition || '',
    })
    setModalOpen(true)
    setActiveTab('info')
  }

  const handleSave = async (skipConflictCheck = false) => {
    if (!form.title || !form.event_date) return
    setSaving(true)
    const payload = {
      title: form.title,
      event_type: form.event_type,
      event_date: form.event_date,
      end_date: form.end_date || null,
      description: form.description || null,
      status: form.status,
      herd_id: form.herd_ids.length > 0 ? form.herd_ids[0] : null,
      herd_ids: form.herd_ids,
      body_condition: form.body_condition || null,
    }

    if (!skipConflictCheck) {
      const isConflict = grazingPlans.some(p => 
        p.status !== 'COMPLETED' &&
        p.herd_ids?.some((hid: string) => payload.herd_ids.includes(hid)) &&
        payload.event_date <= (p.exit_date || p.entry_date) &&
        (payload.end_date || payload.event_date) >= p.entry_date
      );
      if (isConflict) {
        setPendingPayload(payload);
        setConflictModalOpen(true);
        setSaving(false);
        return;
      }
    }

    await savePayload(payload);
  }

  const savePayload = async (payload: any, adjustPlans = false) => {
    setSaving(true)
    try {
      if (editingEvent) {
        await apiFetch(`/api/farm-events/${editingEvent.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await apiFetch('/api/farm-events', { method: 'POST', body: JSON.stringify(payload) })
      }
      
      if (adjustPlans) {
        // En un caso real, aquí iría la lógica para ajustar las planificaciones automáticamente
        // por ejemplo, dividirlas o cambiarles la fecha.
      }
    } catch(e) {
      console.error(e)
    } finally {
      setSaving(false)
      setConflictModalOpen(false)
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditingEvent(null)
      loadData()
    }
  }

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/farm-events/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const filtered = events.filter(e => {
    const matchSearch = search ? e.title.toLowerCase().includes(search.toLowerCase()) : true
    const matchType = filterType === 'all' || e.event_type === filterType
    return matchSearch && matchType
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

  const upcoming = events.filter(e => { const d = safeDate(e.event_date); return d && d >= new Date() }).length

  const handleToggleHerd = (id: string) => {
    setForm(prev => {
      const isSelected = prev.herd_ids.includes(id)
      return {
        ...prev,
        herd_ids: isSelected ? prev.herd_ids.filter(hid => hid !== id) : [...prev.herd_ids, id]
      }
    })
  }

  return (
    <FeatureGate
      feature="agenda"
      title="Agenda de eventos"
      description="Registrá servicios, pariciones, diagnósticos y tratamientos sanitarios. Disponible desde el plan Brote."
      requiredPlan="Brote"
    >
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Agenda</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gestión de eventos ganaderos: servicios, pariciones, sanidad y más
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="bg-gray-100 rounded-xl p-0.5 flex gap-0.5">
            <button
              onClick={() => setAgendaView('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                agendaView === 'lista' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" /> Lista
            </button>
            <button
              onClick={() => setAgendaView('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                agendaView === 'calendario' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendario
            </button>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200"
          >
            <Plus className="w-4 h-4" /> Nuevo evento
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Total eventos</p>
          <p className="text-3xl font-black text-gray-950">{events.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Próximos</p>
          <p className="text-3xl font-black text-blue-600">{upcoming}</p>
        </div>
      </div>

      {/* Filters (only in list view) */}
      {agendaView === 'lista' && (
        <div className="flex gap-3 flex-wrap items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input
              type="text"
              placeholder="Buscar evento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none cursor-pointer focus:ring-1 focus:ring-green-600"
          >
            <option value="all">Tipo</option>
            {EVENT_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {agendaView === 'calendario' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
          {/* Month navigation — gradient header */}
          <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-gray-950 to-gray-800">
            <button
              onClick={() => setCalMonth(prev => {
                const d = new Date(prev.year, prev.month - 1)
                return { year: d.getFullYear(), month: d.getMonth() }
              })}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <h3 className="text-base font-black text-white capitalize tracking-tight">
              {new Date(calMonth.year, calMonth.month).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCalMonth(prev => {
                const d = new Date(prev.year, prev.month + 1)
                return { year: d.getFullYear(), month: d.getMonth() }
              })}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
              <div key={d} className="text-center py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {(() => {
            const firstDay = new Date(calMonth.year, calMonth.month, 1).getDay()
            const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate()
            const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
            while (cells.length % 7 !== 0) cells.push(null)
            const todayStr = new Date().toISOString().split('T')[0]

            return (
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  if (!day) return <div key={idx} className="border-b border-r border-gray-50 min-h-[80px] bg-gray-50/30" />
                  const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayEvents = events.filter(e => {
                    const ed = safeDate(e.event_date)
                    return ed && ed.toISOString().split('T')[0] === dateStr
                  })
                  const isToday = dateStr === todayStr
                  const hasEvents = dayEvents.length > 0

                  return (
                    <div
                      key={idx}
                      onClick={() => { if (hasEvents || isToday) { setSelectedDay(dateStr); setDayModalOpen(true) } }}
                      className={`border-b border-r border-gray-100 min-h-[80px] p-2 transition-all ${
                        hasEvents ? 'cursor-pointer hover:bg-green-50/40' : 'cursor-default'
                      } ${isToday ? 'bg-green-50/60' : ''}`}
                    >
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black mb-1.5 ${
                        isToday
                          ? 'bg-green-600 text-white shadow-md shadow-green-200'
                          : hasEvents
                            ? 'text-gray-900 font-black'
                            : 'text-gray-400 font-medium'
                      }`}>
                        {day}
                      </div>
                      {/* Event pills */}
                      <div className="flex flex-col gap-0.5">
                        {dayEvents.slice(0, 2).map(e => {
                          const et = getEventType(e.event_type)
                          return (
                            <div
                              key={e.id}
                              className="flex items-center gap-1 rounded-md px-1 py-0.5"
                              style={{ backgroundColor: et.color + '18' }}
                            >
                              <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: et.color }} />
                              <p className="text-[9px] font-bold truncate" style={{ color: et.color }}>{e.title}</p>
                            </div>
                          )
                        })}
                        {dayEvents.length > 2 && (
                          <p className="text-[8px] font-black text-gray-400 pl-1">+{dayEvents.length - 2} más</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── DAY DETAIL MODAL ── */}
      {dayModalOpen && selectedDay && (() => {
        const dayEvents = events.filter(e => {
          const ed = safeDate(e.event_date)
          return ed && ed.toISOString().split('T')[0] === selectedDay
        })
        const dayDate = new Date(selectedDay + 'T00:00:00')
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setDayModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-gray-950 to-gray-800">
                <div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Eventos</p>
                  <h4 className="text-base font-black text-white capitalize">
                    {dayDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h4>
                </div>
                <button onClick={() => setDayModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Event cards */}
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {dayEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-300 font-bold">Sin eventos</p>
                    <button
                      onClick={() => { setDayModalOpen(false); setModalOpen(true); setForm(f => ({ ...f, event_date: selectedDay })) }}
                      className="mt-2 text-xs font-black text-green-600 hover:underline"
                    >+ Agregar evento</button>
                  </div>
                ) : (
                  dayEvents.map(e => {
                    const et = getEventType(e.event_type)
                    return (
                      <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: et.color }} />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-950 leading-snug">{e.title}</p>
                              {e.description && (
                                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{e.description}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => { setDayModalOpen(false); openEdit(e) }}
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
                <button
                  onClick={() => { setDayModalOpen(false); setModalOpen(true); setForm(f => ({ ...f, event_date: selectedDay })) }}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-black text-gray-400 hover:border-green-300 hover:text-green-600 transition-all"
                >
                  + Nuevo evento en este día
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── LIST VIEW ── */}
      {agendaView === 'lista' && (
        loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">No hay eventos para mostrar</p>
            <p className="text-[10px] text-gray-300 mt-1">Creá tu primer evento con el botón de arriba</p>
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
                      const d = safeDate(event.event_date)

                      return (
                        <div
                          key={event.id}
                          className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group"
                        >
                          {/* Date badge */}
                          <div className="shrink-0 w-10 text-center">
                            <p className="text-xl font-black text-gray-900 leading-none tabular-nums">
                              {d ? d.getDate() : '—'}
                            </p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              {d ? MONTH_NAMES[d.getMonth()] : ''}
                            </p>
                          </div>

                          {/* Color dot */}
                          <div className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: et.color }} />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 leading-snug">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{event.description}</p>
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
        )
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-black text-gray-950">
                  {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-gray-500 font-medium">Completá los detalles de la agenda ganadera</p>
                  {form.body_condition && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-900 text-white tracking-wide">
                      CC: {form.body_condition}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-600 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6 bg-gray-50/20">
              <button
                className={`py-3 text-sm font-bold border-b-2 px-2 transition-all ${
                  activeTab === 'info' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('info')}
              >
                Información del Evento
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
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

              {/* Event Type — Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Tipo de Evento *</label>
                <select
                  value={form.event_type}
                  onChange={e => setForm({ ...form, event_type: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:ring-1 focus:ring-green-600 outline-none cursor-pointer appearance-none"
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {/* Visual badge for selected type */}
                {(() => {
                  const sel = EVENT_TYPES.find(t => t.id === form.event_type)
                  if (!sel) return null
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${sel.dot}`} />
                      <span className={`text-[10px] font-bold ${sel.text}`}>{sel.label}</span>
                    </div>
                  )
                })()}
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

              {/* Rodeos Multiple Selection */}
      {herds.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
            Rodeos (Selección Múltiple)
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
            {herds.map((h) => {
              const isSelected = form.herd_ids.includes(h.id);
              return (
                <label key={h.id} onClick={(e) => { e.preventDefault(); handleToggleHerd(h.id); }} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors group">
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors border ${isSelected ? 'bg-green-600 border-transparent text-white' : 'bg-white border-gray-300'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 group-hover:text-green-700 transition-colors">{h.name}</p>
                    <p className="text-[10px] font-medium text-gray-500">{h.head_count} cabezas</p>
                  </div>
                </label>
              );
            })}
            {form.herd_ids.length === 0 && (
              <p className="text-xs text-gray-400 italic px-2">Sin rodeo seleccionado.</p>
            )}
          </div>
        </div>
      )}



              {/* Body Condition */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Condición Corporal (OPCIONAL)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="5"
                  value={form.body_condition}
                  onChange={e => setForm({ ...form, body_condition: e.target.value })}
                  placeholder="Ej: 3.5"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
                />
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

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSave(false)}
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

      {/* Conflict Modal */}
      {conflictModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-5 border-b border-red-100 bg-red-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-900">Alerta de Superposición</h3>
                <p className="text-xs text-red-700 font-medium">Conflicto con el Planificador de Pastoreo</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 font-medium">
                Este evento que estás intentando crear colisiona temporalmente con un movimiento de pastoreo ya planificado para los rodeos seleccionados.
              </p>
              <p className="text-sm text-gray-700 font-medium mt-3">
                ¿Qué deseas hacer?
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-2 bg-gray-50">
              <button
                onClick={() => savePayload(pendingPayload, true)}
                className="w-full py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all text-center"
              >
                Guardar y reajustar planificación automáticamente
              </button>
              <button
                onClick={() => savePayload(pendingPayload, false)}
                className="w-full py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all text-center"
              >
                Guardar evento de todas formas sin modificar pastoreo
              </button>
              <button
                onClick={() => setConflictModalOpen(false)}
                className="w-full py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition-all text-center mt-2"
              >
                Cancelar y revisar fechas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  )
}
