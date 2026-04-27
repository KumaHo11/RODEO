'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '../components/PageShell'

interface AuditEntry {
  id: string; action: string; entity_type: string; entity_id: string
  actor_email: string; actor_name: string; old_value: any; new_value: any
  ip_address: string; created_at: string
}

const ACTION_STYLES: Record<string, string> = {
  USER_IMPERSONATED:   'bg-amber-50  text-amber-700  border-amber-200',
  PLAN_CREATED:        'bg-green-50  text-green-700  border-green-200',
  PLAN_UPDATED:        'bg-blue-50   text-blue-700   border-blue-200',
  PLAN_DEACTIVATED:    'bg-red-50    text-red-700    border-red-200',
  USER_UPDATED:        'bg-blue-50   text-blue-700   border-blue-200',
  CONFIG_UPDATED:      'bg-purple-50 text-purple-700 border-purple-200',
  SUPER_ADMIN_CREATED: 'bg-gray-50   text-gray-600   border-gray-200',
}

const ACTIONS = ['USER_IMPERSONATED','PLAN_CREATED','PLAN_UPDATED','PLAN_DEACTIVATED','USER_UPDATED','CONFIG_UPDATED']

// Separate component to avoid fragment-key issues
function LogRow({ log, expanded, onToggle }: {
  log: AuditEntry; expanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr onClick={onToggle}
        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer">
        <td className="px-4 py-3.5 text-gray-400 text-xs font-mono whitespace-nowrap">
          {new Date(log.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })}
        </td>
        <td className="px-4 py-3.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${ACTION_STYLES[log.action] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {log.action.replace(/_/g, ' ')}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <div className="text-gray-700 text-xs font-medium">{log.actor_name || '—'}</div>
          <div className="text-gray-400 text-[10px]">{log.actor_email}</div>
        </td>
        <td className="px-4 py-3.5 text-gray-500 text-xs">
          {log.entity_type && <span>{log.entity_type}</span>}
          {log.entity_id && <div className="font-mono text-[10px] text-gray-300 truncate max-w-[100px]">{log.entity_id}</div>}
        </td>
        <td className="px-4 py-3.5 text-gray-300 text-[10px] font-mono">{log.ip_address || '—'}</td>
        <td className="px-4 py-3.5 text-gray-400 text-[10px] whitespace-nowrap">
          {(log.old_value || log.new_value) ? (expanded ? '▲ Cerrar' : '▼ Detalles') : ''}
        </td>
      </tr>

      {expanded && (log.old_value || log.new_value) && (
        <tr>
          <td colSpan={6} className="px-4 pb-4 pt-2 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              {log.old_value && (
                <div>
                  <p className="text-[10px] font-bold text-red-500 mb-2">VALOR ANTERIOR</p>
                  <pre className="text-[10px] text-gray-500 bg-white rounded-xl p-3 overflow-auto max-h-32 border border-gray-100">
                    {JSON.stringify(log.old_value, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_value && (
                <div>
                  <p className="text-[10px] font-bold text-green-600 mb-2">NUEVO VALOR</p>
                  <pre className="text-[10px] text-gray-500 bg-white rounded-xl p-3 overflow-auto max-h-32 border border-gray-100">
                    {JSON.stringify(log.new_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const limit = 30

  const fetchLogs = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const params = new URLSearchParams({
        page: String(page), limit: String(limit),
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(actorFilter  ? { actor: actorFilter   } : {}),
      })
      const res = await fetch(`/api/admin/audit-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } finally { setLoading(false) }
  }, [user, page, actionFilter, actorFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / limit)
  const selectCls = 'border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-500'

  return (
    <PageShell count={total} countLabel="entradas en el registro">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="text" value={actorFilter} placeholder="Filtrar por email del actor…"
          onChange={e => { setActorFilter(e.target.value); setPage(1) }}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500 placeholder-gray-400 bg-white" />
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">Todas las acciones</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={fetchLogs}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 text-sm transition-colors">
          {loading ? '…' : 'Actualizar'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Fecha/Hora', 'Acción', 'Actor', 'Entidad', 'IP', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Cargando…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay registros de auditoría</td></tr>
              ) : logs.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  expanded={expanded === log.id}
                  onToggle={() => setExpanded(prev => prev === log.id ? null : log.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-gray-400 text-xs">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors">
                ← Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
