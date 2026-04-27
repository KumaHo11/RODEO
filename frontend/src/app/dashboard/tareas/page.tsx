'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FeatureGate } from '@/components/FeatureGate'
import {
  Plus, CheckSquare, Clock, AlertTriangle, X, Check,
  ChevronDown, Loader2, User, Calendar, MapPin,
  Wrench, Stethoscope, Tractor, TextCursor, Flag,
  Filter, List, Kanban, ArrowRight, RotateCcw, ChevronRight
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
type Priority = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'
type Status   = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA'
type TaskType = 'GENERAL' | 'VETERINARIA' | 'INFRAESTRUCTURA' | 'RECORRIDA' | 'CAMPO'

interface Task {
  id: string
  title: string
  description?: string
  task_type: TaskType
  paddock_id?: string
  due_date?: string
  priority: Priority
  status: Status
  assigned_to?: string
  created_at: string
  paddock?: { name: string }
  assignee?: { first_name?: string; last_name?: string }
}

// ── Config ─────────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  BAJA:    { label: 'Baja',    color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  NORMAL:  { label: 'Normal',  color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  ALTA:    { label: 'Alta',    color: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  URGENTE: { label: 'Urgente', color: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; headerBg: string; headerText: string }> = {
  PENDIENTE:   { label: 'Pendiente',   color: 'bg-amber-50 border-amber-200',  headerBg: 'bg-amber-50',  headerText: 'text-amber-700' },
  EN_PROCESO:  { label: 'En proceso',  color: 'bg-blue-50 border-blue-200',    headerBg: 'bg-blue-50',   headerText: 'text-blue-700' },
  COMPLETADA:  { label: 'Completada',  color: 'bg-green-50 border-green-200',  headerBg: 'bg-green-50',  headerText: 'text-green-700' },
  CANCELADA:   { label: 'Cancelada',   color: 'bg-gray-50 border-gray-200',    headerBg: 'bg-gray-50',   headerText: 'text-gray-500' },
}

const TYPE_ICONS: Record<TaskType, React.ComponentType<any>> = {
  GENERAL:        TextCursor,
  VETERINARIA:    Stethoscope,
  INFRAESTRUCTURA:Wrench,
  RECORRIDA:      Tractor,
  CAMPO:          MapPin,
}

const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: 'GENERAL',        label: 'General' },
  { id: 'VETERINARIA',    label: 'Veterinaria' },
  { id: 'INFRAESTRUCTURA',label: 'Infraestructura' },
  { id: 'RECORRIDA',      label: 'Recorrida' },
  { id: 'CAMPO',          label: 'Campo' },
]

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : null
const isOverdue = (d?: string) => d && new Date(d) < new Date() ? true : false

const KANBAN_STATUSES: Status[] = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA']

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onStatusChange, isOwner }: {
  task: Task
  onStatusChange: (id: string, status: Status) => void
  isOwner: boolean
}) {
  const pCfg = PRIORITY_CONFIG[task.priority]
  const Icon = TYPE_ICONS[task.task_type] || TextCursor
  const overdue = isOverdue(task.due_date) && task.status !== 'COMPLETADA'
  const assigneeName = task.assignee
    ? [task.assignee.first_name, task.assignee.last_name].filter(Boolean).join(' ') || 'Sin nombre'
    : 'Sin asignar'

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all group">
      {/* Priority + type row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
            {TASK_TYPES.find(t => t.id === task.task_type)?.label}
          </span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${pCfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
          {pCfg.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-black text-gray-900 leading-snug mb-2">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-gray-500 leading-relaxed mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {task.paddock && (
          <span className="flex items-center gap-1 text-[9px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">
            <MapPin className="w-2.5 h-2.5" /> {task.paddock.name}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg ${overdue ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
            <Calendar className="w-2.5 h-2.5" />
            {overdue ? '⚠ ' : ''}{fmtDate(task.due_date)}
          </span>
        )}
        <span className="flex items-center gap-1 text-[9px] font-bold bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg">
          <User className="w-2.5 h-2.5" /> {assigneeName}
        </span>
      </div>

      {/* Status controls — clearly interactive action buttons */}
      {task.status !== 'CANCELADA' && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Mover a</p>
          <div className="flex gap-1.5 flex-wrap">
            {task.status !== 'PENDIENTE' && (
              <button onClick={() => onStatusChange(task.id, 'PENDIENTE')}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 active:scale-95 transition-all">
                <RotateCcw className="w-3 h-3" /> Pendiente
              </button>
            )}
            {task.status !== 'EN_PROCESO' && (
              <button onClick={() => onStatusChange(task.id, 'EN_PROCESO')}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 active:scale-95 transition-all">
                <ChevronRight className="w-3 h-3" /> En proceso
              </button>
            )}
            {task.status !== 'COMPLETADA' && (
              <button onClick={() => onStatusChange(task.id, 'COMPLETADA')}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 active:scale-95 transition-all">
                <Check className="w-3 h-3" /> Completar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TareasPage() {
  const { user } = useAuth()
  return (
    <FeatureGate
      feature="tareas"
      title="Módulo de Tareas"
      description="Assigná tareas al equipo, hacelos seguimiento y organizalos en Kanban. Disponible desde el plan Planificador."
      requiredPlan="Planificador"
    >
      <TareasContent user={user} />
    </FeatureGate>
  )
}

function TareasContent({ user }: { user: any }) {

  const [tasks, setTasks]         = useState<Task[]>([])
  const [members, setMembers]     = useState<any[]>([])
  const [paddocks, setPaddocks]   = useState<any[]>([])
  const [isOwner, setIsOwner]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'kanban' | 'list'>('kanban')
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL'>('ALL')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({
    title: '', description: '', task_type: 'GENERAL' as TaskType,
    paddock_id: '', assigned_to: '', due_date: '', priority: 'NORMAL' as Priority,
  })

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [tasksRes, teamRes, paddocksRes, orgRes] = await Promise.all([
      apiFetch('/api/tasks'),
      apiFetch('/api/team'),
      apiFetch('/api/paddocks'),
      apiFetch('/api/organizations'),
    ])

    const tasksData   = tasksRes.ok   ? (await tasksRes.json()).tasks : []
    const teamData    = teamRes.ok    ? (await teamRes.json()).members : []
    const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks : []
    const orgData     = orgRes.ok     ? (await orgRes.json()).org : null

    if (orgData) setIsOwner(orgData.owner_id === user.uid)

    // Tasks already come enriched with paddock + assignee from the API
    setTasks(tasksData || [])
    setMembers(teamData || [])
    setPaddocks(paddocksData || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Change task status ──────────────────────────────────────────────────
  const changeStatus = async (taskId: string, status: Status) => {
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  // ── Create task ─────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    setSaving(true)

    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        task_type: form.task_type,
        paddock_id: form.paddock_id || null,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        priority: form.priority,
        status: 'PENDIENTE',
      }),
    })

    setSaving(false)
    setModalOpen(false)
    setForm({ title: '', description: '', task_type: 'GENERAL', paddock_id: '', assigned_to: '', due_date: '', priority: 'NORMAL' })
    load()
  }

  // ── Filtered/grouped tasks ─────────────────────────────────────────────
  const filteredTasks = filterStatus === 'ALL' ? tasks : tasks.filter(t => t.status === filterStatus)
  const grouped = KANBAN_STATUSES.reduce((acc, s) => ({
    ...acc,
    [s]: filteredTasks.filter(t => t.status === s),
  }), {} as Record<Status, Task[]>)

  const pendingCount = tasks.filter(t => t.status === 'PENDIENTE').length
  const inProgressCount = tasks.filter(t => t.status === 'EN_PROCESO').length
  const doneCount = tasks.filter(t => t.status === 'COMPLETADA').length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Tareas</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {[
              { label: 'Pendientes', count: pendingCount, color: 'bg-amber-100 text-amber-700' },
              { label: 'En proceso', count: inProgressCount, color: 'bg-blue-100 text-blue-700' },
              { label: 'Completadas', count: doneCount, color: 'bg-green-100 text-green-700' },
            ].map(s => (
              <span key={s.label} className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${s.color}`}>
                {s.count} {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button onClick={() => setView('kanban')} className={`p-1.5 rounded-lg transition-colors ${view === 'kanban' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400'}`}>
              <Kanban className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 shadow-sm shadow-green-200 transition-all"
          >
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <CheckSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <h3 className="font-black text-gray-800 mb-1">Sin tareas todavía</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto mb-5">
            Creá tareas para asignar al equipo y hacer seguimiento del trabajo en el campo.
          </p>
          <button onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700">
            Crear primera tarea
          </button>
        </div>
      ) : view === 'kanban' ? (
        /* ── Kanban view ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status]
            const cols = grouped[status] || []
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${cfg.headerBg}`}>
                  <h3 className={`text-xs font-black uppercase tracking-widest ${cfg.headerText}`}>{cfg.label}</h3>
                  <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ${cfg.headerBg} ${cfg.headerText} border`}>
                    {cols.length}
                  </span>
                </div>
                <div className="space-y-3 min-h-[100px]">
                  {cols.map(task => (
                    <TaskCard key={task.id} task={task} onStatusChange={changeStatus} isOwner={isOwner} />
                  ))}
                  {cols.length === 0 && (
                    <div className="h-20 rounded-xl border-2 border-dashed border-gray-100 flex items-center justify-center">
                      <p className="text-[10px] font-bold text-gray-300">Sin tareas</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Filter bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 overflow-x-auto">
            {(['ALL', ...KANBAN_STATUSES] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s as any)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  filterStatus === s ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {s === 'ALL' ? 'Todas' : STATUS_CONFIG[s as Status].label}
                {s !== 'ALL' && ` (${tasks.filter(t => t.status === s).length})`}
              </button>
            ))}
          </div>
          <div className="divide-y divide-gray-50">
            {filteredTasks.map(task => {
              const pCfg = PRIORITY_CONFIG[task.priority]
              const Icon = TYPE_ICONS[task.task_type]
              const overdue = isOverdue(task.due_date) && task.status !== 'COMPLETADA'
              const sc = STATUS_CONFIG[task.status]
              return (
                <div key={task.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${sc.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-900">{task.title}</p>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${pCfg.color}`}>{pCfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-gray-400 font-bold">
                      {task.due_date && (
                        <span className={overdue ? 'text-red-500' : ''}>{fmtDate(task.due_date)}</span>
                      )}
                      {task.paddock && <span><MapPin className="inline w-2.5 h-2.5 mr-0.5" />{task.paddock.name}</span>}
                      {task.assignee && <span><User className="inline w-2.5 h-2.5 mr-0.5" />{[task.assignee.first_name, task.assignee.last_name].filter(Boolean).join(' ') || 'Sin nombre'}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {task.status !== 'COMPLETADA' && (
                      <button onClick={() => changeStatus(task.id, 'COMPLETADA')}
                        className="text-[9px] font-bold px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1 transition-colors">
                        <Check className="w-3 h-3" /> Completar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Create Task Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="font-black text-gray-900 text-base">Nueva tarea</h2>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Título *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: Vaccionar rodeo 1" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Detalles adicionales..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Tipo</label>
                  <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value as TaskType }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500">
                    {TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500">
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Potrero</label>
                  <select value={form.paddock_id} onChange={e => setForm(p => ({ ...p, paddock_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500">
                    <option value="">Sin potrero</option>
                    {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Asignar a</label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500">
                    <option value="">Sin asignar</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Fecha de vencimiento</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !form.title}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                  Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
