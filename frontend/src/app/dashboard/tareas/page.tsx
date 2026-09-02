'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { FeatureGate } from '@/components/FeatureGate'
import {
  Plus, CheckSquare, Clock, AlertTriangle, X, Check,
  ChevronDown, Loader2, User, Calendar, MapPin,
  Wrench, Stethoscope, Tractor, TextCursor, Flag,
  Filter, List, Kanban, ArrowRight, RotateCcw, ChevronRight
} from 'lucide-react'
import OnboardingTour from '@/components/OnboardingTour'

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
const PRIORITY_CONFIG: Record<Priority, { label: string }> = {
  BAJA:    { label: 'Baja' },
  NORMAL:  { label: 'Normal' },
  ALTA:    { label: 'Alta' },
  URGENTE: { label: 'Urgente' },
}

const STATUS_CONFIG: Record<Status, { label: string }> = {
  PENDIENTE:   { label: 'Pendiente' },
  EN_PROCESO:  { label: 'En proceso' },
  COMPLETADA:  { label: 'Completada' },
  CANCELADA:   { label: 'Cancelada' },
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
  const overdue = isOverdue(task.due_date) && task.status !== 'COMPLETADA'
  const assigneeName = task.assignee
    ? [task.assignee.first_name, task.assignee.last_name].filter(Boolean).join(' ') || 'Sin nombre'
    : 'Sin asignar'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all group">
      {/* Priority + type row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
          {TASK_TYPES.find(t => t.id === task.task_type)?.label}
        </span>
        {task.priority === 'URGENTE' ? (
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 uppercase tracking-widest">
            Urgente
          </span>
        ) : (
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 uppercase tracking-widest">
            {pCfg.label}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-xl font-black text-gray-950 leading-tight mb-2">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-gray-500 leading-relaxed mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5 mb-3 mt-3">
        {task.paddock && (
          <span className="text-[9px] font-bold bg-gray-50 text-gray-600 border border-gray-100 px-2 py-1 rounded-lg">
            {task.paddock.name}
          </span>
        )}
        {task.due_date && (
          <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${overdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
            {fmtDate(task.due_date)}
          </span>
        )}
        <span className="text-[9px] font-bold bg-gray-50 text-gray-600 border border-gray-100 px-2 py-1 rounded-lg">
          {assigneeName}
        </span>
      </div>

      {/* Status controls */}
      {task.status !== 'CANCELADA' && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Mover a</p>
          <div className="flex gap-1.5 flex-wrap">
            {task.status !== 'PENDIENTE' && (
              <button onClick={() => onStatusChange(task.id, 'PENDIENTE')}
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Pendiente
              </button>
            )}
            {task.status !== 'EN_PROCESO' && (
              <button onClick={() => onStatusChange(task.id, 'EN_PROCESO')}
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                En proceso
              </button>
            )}
            {task.status !== 'COMPLETADA' && (
              <button onClick={() => onStatusChange(task.id, 'COMPLETADA')}
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Completada
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

    // ── Paso 1: IndexedDB inmediata ───────────────────────────────────────
    try {
      const { dbGetAll } = await import('@/lib/offline/db')
      const [localTasks, localPaddocks] = await Promise.all([
        dbGetAll('tasks'),
        dbGetAll('paddocks'),
      ])
      if (localTasks.length > 0) {
        setTasks(localTasks as Task[])
        setPaddocks(localPaddocks)
        setLoading(false)
      }
    } catch { /* ignore */ }

    // ── Paso 2: API en background ───────────────────────────────────────
    const [tasksRes, teamRes, paddocksRes, orgRes] = await Promise.all([
      apiFetch('/api/tasks'),
      apiFetch('/api/team'),
      apiFetch('/api/paddocks'),
      apiFetch('/api/organizations'),
    ])

    const tasksData    = tasksRes.ok    ? (await tasksRes.json()).tasks    : []
    const teamData     = teamRes.ok     ? (await teamRes.json()).members   : []
    const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks : []
    const orgData      = orgRes.ok      ? (await orgRes.json()).org        : null

    if (orgData) setIsOwner(orgData.owner_id === user.uid)

    setTasks(tasksData || [])
    setMembers(teamData || [])
    setPaddocks(paddocksData || [])

    // Actualizar IndexedDB
    if (tasksData.length > 0) {
      const { dbUpsertMany } = await import('@/lib/offline/db')
      await dbUpsertMany('tasks', tasksData).catch(() => {})
    }

    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Change task status ──────────────────────────────────────────────────
  const changeStatus = async (taskId: string, status: Status) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    // Enqueue via outbox (funciona offline)
    const { enqueue } = await import('@/lib/offline/outbox')
    await enqueue({
      type: 'task_status',
      url: `/api/tasks/${taskId}`,
      method: 'PATCH',
      body: { status },
    })
  }

  // ── Create task ─────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    setSaving(true)

    const taskBody = {
      title: form.title,
      description: form.description || null,
      task_type: form.task_type,
      paddock_id: form.paddock_id || null,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      priority: form.priority,
      status: 'PENDIENTE' as Status,
    }

    // Optimistic local task
    const tempId = `pending-${Date.now()}`
    const tempTask: Task = {
      id: tempId,
      title: form.title,
      description: form.description || undefined,
      task_type: form.task_type,
      paddock_id: form.paddock_id || undefined,
      assigned_to: form.assigned_to || undefined,
      due_date: form.due_date || undefined,
      priority: form.priority,
      status: 'PENDIENTE',
      created_at: new Date().toISOString(),
    }
    setTasks(prev => [tempTask, ...prev])

    // Enqueue via outbox
    const { enqueue } = await import('@/lib/offline/outbox')
    await enqueue({
      type: 'task',
      url: '/api/tasks',
      method: 'POST',
      body: taskBody,
      localData: { store: 'tasks', data: { ...taskBody, id: tempId, created_at: new Date().toISOString() } },
    })

    setSaving(false)
    setModalOpen(false)
    setForm({ title: '', description: '', task_type: 'GENERAL', paddock_id: '', assigned_to: '', due_date: '', priority: 'NORMAL' })
    // Si hay red, recargar para obtener ID real
    if (navigator.onLine) setTimeout(() => load(), 1500)
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
      <OnboardingTour
        tourId="tour-tareas-v1"
        steps={[
          {
            target: '.tour-tablero-tareas',
            title: 'Tablero de Tareas',
            content: 'Aquí puedes gestionar tus tareas en columnas según su estado. Puedes cambiar la vista a lista si lo prefieres.'
          },
          {
            target: '.tour-nueva-tarea',
            title: 'Crear Tarea',
            content: 'Haz clic aquí para asignar nuevas tareas a tu equipo, establecer prioridades y fechas límite.'
          }
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Tareas</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Gestión y seguimiento de tareas del equipo</p>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit mt-3">
            {[
              { label: 'Pendientes', count: pendingCount },
              { label: 'En proceso', count: inProgressCount },
              { label: 'Completadas', count: doneCount },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-white text-gray-900 shadow-sm">
                {s.label}
                <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center bg-gray-900 text-white">{s.count}</span>
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
            className="tour-nueva-tarea flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 shadow-sm shadow-green-200 transition-all"
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
        <div className="tour-tablero-tareas grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status]
            const cols = grouped[status] || []
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-800">{cfg.label}</h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
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
                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border ${
                  filterStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {s === 'ALL' ? 'Todas' : STATUS_CONFIG[s as Status].label}
                {s !== 'ALL' && ` (${tasks.filter(t => t.status === s).length})`}
              </button>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {filteredTasks.map(task => {
              const pCfg = PRIORITY_CONFIG[task.priority]
              const overdue = isOverdue(task.due_date) && task.status !== 'COMPLETADA'
              return (
                <div key={task.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{task.title}</p>
                      {task.priority === 'URGENTE' ? (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 uppercase tracking-widest">
                          Urgente
                        </span>
                      ) : (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 uppercase tracking-widest">
                          {pCfg.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-gray-500 font-medium">
                      <span className="uppercase tracking-widest font-black text-gray-400">{TASK_TYPES.find(t => t.id === task.task_type)?.label}</span>
                      {task.due_date && (
                        <span className={overdue ? 'text-red-500 font-bold' : ''}>{fmtDate(task.due_date)}</span>
                      )}
                      {task.paddock && <span>{task.paddock.name}</span>}
                      {task.assignee && <span>{[task.assignee.first_name, task.assignee.last_name].filter(Boolean).join(' ') || 'Sin nombre'}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {task.status !== 'COMPLETADA' && (
                      <button onClick={() => changeStatus(task.id, 'COMPLETADA')}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                        Completar
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
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-black text-gray-900">Nueva tarea</h2>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Título *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: Vaccionar rodeo 1" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Detalles adicionales..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Tipo</label>
                  <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value as TaskType }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500">
                    {TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500">
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Potrero</label>
                  <select value={form.paddock_id} onChange={e => setForm(p => ({ ...p, paddock_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500">
                    <option value="">Sin potrero</option>
                    {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Asignar a</label>
                  <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500">
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
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500" />
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
      , document.body)}
    </div>
  )
}
