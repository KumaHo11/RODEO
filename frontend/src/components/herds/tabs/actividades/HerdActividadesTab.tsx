'use client'

/**
 * HerdActividadesTab v2 — Actividades con lógica condicional por categoría fenológica.
 *
 * Regla de negocio implementada:
 *  - physio === 'PRENADA' (o PRENADA_*) → habilita 'paricion' en Entradas
 *  - physio === 'CON_TERNERO' → habilita 'destete' en Salidas
 *  - TOROS / SERVICIO → habilita 'servicio'
 *  - catKey TERNEROS / NOVILLITOS / NOVILLOS → habilita 'pesada' por defecto
 */

import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import {
  Plus, Minus, Loader2, CheckCircle2, AlertTriangle, Scale, Calendar, Baby, Scissors, ClipboardList,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { enqueue } from '@/lib/offline/outbox'
import { useOfflineStatus } from '@/components/OfflineManager'
import { calculateBaseEV } from '@/lib/grazing/evProjection'
import { todayISO } from '@/lib/utils/dates'
import type { HerdData } from '@/components/HerdModal'
import type { CategoriaComercial } from '@/lib/categorias'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ActivityDef {
  id:    string
  label: string
  desc:  string
  type:  'entrada' | 'salida'
  icon:  React.ComponentType<any>
}

// ── Actividades base (siempre presentes) ─────────────────────────────────────

const ACTIVITIES_BASE: ActivityDef[] = [
  { id: 'compra',    label: 'Compra',    desc: 'Ingreso de animales',          type: 'entrada', icon: Plus  },
  { id: 'mortandad', label: 'Mortandad', desc: 'Bajas por muerte o descarte',  type: 'salida',  icon: Minus },
  { id: 'venta',     label: 'Venta',     desc: 'Egreso por venta o faena',     type: 'salida',  icon: Minus },
]

// ── Actividades condicionales (por categoría fenológica) ─────────────────────

const ACTIVITY_CONDITIONAL: Record<string, ActivityDef> = {
  paricion: { id: 'paricion', label: 'Parición', desc: 'Nacimiento de terneros', type: 'entrada', icon: Baby },
  destete:  { id: 'destete',  label: 'Destete',  desc: 'Separación del ternero', type: 'salida',  icon: Scissors },
  servicio: { id: 'servicio', label: 'Servicio', desc: 'Registro de servicio',   type: 'entrada', icon: ClipboardList },
}

/**
 * getAvailableActivities — lógica condicional que determina las actividades
 * disponibles según el estado fenológico (physio) y la categoría comercial.
 *
 * @param catKey   CategoriaComercial del rodeo ('VACAS' | 'TOROS' | …)
 * @param physio   physiological_category del rodeo ('PRENADA' | 'CON_TERNERO' | …)
 * @returns        Array ordenado: entradas primero, salidas después
 */
function getAvailableActivities(catKey: CategoriaComercial | null, physio: string | null | undefined): ActivityDef[] {
  const acts: ActivityDef[] = [...ACTIVITIES_BASE]

  if (!physio && !catKey) return acts

  const ph = (physio ?? '').toUpperCase()
  const ck = (catKey  ?? '').toUpperCase()

  // 📌 Regla: VACA PREÑADA → habilitar Parición en Entradas
  if (ph.includes('PRENADA') || ph === 'VACIA_PRENADA') {
    acts.push(ACTIVITY_CONDITIONAL.paricion)
  }

  // 📌 Regla: VACA CON TERNERO → habilitar Destete en Salidas
  if (ph.includes('CON_TERNERO') || ph === 'PARICION') {
    acts.push(ACTIVITY_CONDITIONAL.destete)
  }

  // 📌 Regla: TOROS en SERVICIO → habilitar Servicio
  if (ck === 'TOROS' || ph.includes('SERVICIO')) {
    acts.push(ACTIVITY_CONDITIONAL.servicio)
  }

  // Ordenar: entradas primero, salidas después
  return acts.sort((a, b) => {
    if (a.type === b.type) return 0
    return a.type === 'entrada' ? -1 : 1
  })
}

// ── Colores por actividad ─────────────────────────────────────────────────────

// Spec 1.2: Verde = entradas (interactivas). Gris = salidas.
const ACTIVITY_COLORS: Record<string, { sel: string; icon: string }> = {
  compra:    { sel: 'border-green-500 bg-green-50',  icon: 'bg-green-100 text-green-600' },
  paricion:  { sel: 'border-green-500 bg-green-50',  icon: 'bg-green-100 text-green-600' },
  servicio:  { sel: 'border-green-500 bg-green-50',  icon: 'bg-green-100 text-green-600' },
  mortandad: { sel: 'border-gray-300  bg-gray-50',   icon: 'bg-gray-100  text-gray-500'  },
  venta:     { sel: 'border-gray-300  bg-gray-50',   icon: 'bg-gray-100  text-gray-500'  },
  destete:   { sel: 'border-gray-300  bg-gray-50',   icon: 'bg-gray-100  text-gray-500'  },
}
const DEFAULT_ACT_COLOR = { sel: 'border-gray-300 bg-gray-50', icon: 'bg-gray-100 text-gray-500' }

const FIELD = 'w-full border-2 border-gray-200 rounded-xl px-3.5 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white'
const LABEL = 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block'

interface Props { herd: HerdData; onRefresh: () => void }

// ── Component ─────────────────────────────────────────────────────────────────

export default function HerdActividadesTab({ herd, onRefresh }: Props) {
  const { isOffline } = useOfflineStatus()
  const herdId = herd.id!
  const catKey = herd.categoria as CategoriaComercial | null
  const physio = herd.physiological_category ?? null

  // Actividades disponibles según categoría fenológica
  const activities = useMemo(
    () => getAvailableActivities(catKey, physio),
    [catKey, physio]
  )

  // Lista de IDs que representan entradas (para calcular stock)
  const ADDS_SET = useMemo(
    () => new Set(activities.filter(a => a.type === 'entrada').map(a => a.id)),
    [activities]
  )

  const [actId,     setActId]     = useState<string | null>(null)
  const [actCount,  setActCount]  = useState<number | ''>(1)
  const [actWeight, setActWeight] = useState<number | ''>('')
  const [actDate,   setActDate]   = useState(todayISO())
  const [actNote,   setActNote]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const isAdd     = actId ? ADDS_SET.has(actId) : false
  const canSubmit = !!actId && !!actCount && Number(actCount) > 0

  const currentCount = herd.head_count
  const previewCount = actId
    ? (isAdd
        ? currentCount + Number(actCount || 0)
        : Math.max(0, currentCount - Number(actCount || 0)))
    : currentCount

  const previewEV = useMemo(
    () => calculateBaseEV(catKey, Number(herd.avg_weight_kg) || 400, previewCount),
    [catKey, herd.avg_weight_kg, previewCount]
  )

  // Actividades agrupadas
  const entradas = activities.filter(a => a.type === 'entrada')
  const salidas  = activities.filter(a => a.type === 'salida')

  const handleSubmit = async () => {
    if (!canSubmit || !actId) return
    setSaving(true); setError(null)

    const n        = Number(actCount)
    const newCount = isAdd ? currentCount + n : Math.max(0, currentCount - n)
    const currentW = Number(herd.avg_weight_kg || 400)
    let newWeight  = currentW
    let newEV: number

    if (isAdd && actWeight !== '' && Number(actWeight) > 0) {
      const nW = Number(actWeight)
      const totalKg = currentCount * currentW + n * nW
      newWeight = newCount > 0 ? Math.round(totalKg / newCount) : nW
      newEV = parseFloat(((Number(herd.total_ev) || 0) + calculateBaseEV(catKey, nW, n)).toFixed(2))
    } else {
      newEV = calculateBaseEV(catKey, currentW, newCount)
    }

    const patchPayload: Record<string, any> = { head_count: newCount, total_ev: newEV }
    if (isAdd && actWeight !== '' && Number(actWeight) > 0) patchPayload.avg_weight_kg = newWeight

    const actLabel = activities.find(a => a.id === actId)?.label ?? actId
    const evTitle  = `${actLabel}: ${n} cab. · ${herd.name}`
    const evDesc   = [
      actNote || null,
      isAdd && actWeight !== '' ? `Peso ingresado: ${Number(actWeight)} kg/cab · Nuevo promedio: ${newWeight} kg` : null,
      `EV resultante: ${Math.round(newEV)}`,
    ].filter(Boolean).join(' · ')

    try {
      if (isOffline) {
        await enqueue({ type: 'herd_update', url: `/api/herds/${herdId}`, method: 'PATCH', body: patchPayload, idempotency_key: `herd-activity-${actId}-${herdId}-${Date.now()}`, localData: { store: 'herds', data: { ...(herd as any), ...patchPayload, id: herdId } } })
        await enqueue({ type: 'farm_event', url: '/api/farm-events', method: 'POST', body: { title: evTitle, event_type: actId, event_date: actDate, herd_id: herdId, herd_ids: [herdId], description: evDesc, status: 'completado', source: 'rodeo' }, idempotency_key: `farm-event-${actId}-${herdId}-${Date.now()}` })
        import('sonner').then(({ toast }) => toast.success('Guardado offline. Se sincronizará al reconectar.'))
      } else {
        const patchRes = await apiFetch(`/api/herds/${herdId}`, { method: 'PATCH', body: JSON.stringify(patchPayload) })
        if (!patchRes.ok) throw new Error('No se pudo actualizar el stock')
        await apiFetch('/api/farm-events', { method: 'POST', body: JSON.stringify({ title: evTitle, event_type: actId, event_date: actDate, herd_id: herdId, herd_ids: [herdId], description: evDesc, status: 'completado', source: 'rodeo' }) })
      }

      setSuccess(`✓ ${evTitle}`)
      setActId(null); setActCount(1); setActWeight(''); setActNote(''); setActDate(todayISO())
      setTimeout(() => setSuccess(null), 4000)
      onRefresh()
    } catch (e: any) {
      setError('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const renderGroup = (label: string, group: ActivityDef[]) => {
    if (group.length === 0) return null
    return (
      <div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
        {/* Spec 1.1: grid uniforme + gap consistente */}
        <div className={clsx('grid gap-2', group.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {group.map(act => {
            const Icon   = act.icon
            const sel    = actId === act.id
            const colors = ACTIVITY_COLORS[act.id] ?? DEFAULT_ACT_COLOR
            return (
              <button
                key={act.id}
                onClick={() => setActId(sel ? null : act.id)}
                className={clsx(
                  // Spec 1.1: altura y padding unificados — h-[72px] fuerza consistencia
                  'flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all text-center bg-white',
                  'h-[76px]', // Altura fija para todos los cards
                  sel
                    ? colors.sel + ' shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className={clsx(
                  'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
                  sel ? colors.icon : 'bg-gray-100 text-gray-500'
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-800 leading-tight">{act.label}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-2xl">

      {/* Indicador de categoría activa */}
      {physio && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-green-50 border border-green-100 rounded-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <p className="text-[10px] font-bold text-green-700">
            Actividades disponibles para <span className="font-black">{physio.replace(/_/g, ' ').toLowerCase()}</span>
          </p>
        </div>
      )}

      {/* ── Selección de actividad agrupada ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
          ¿Qué movimiento querés registrar?
        </h3>
        {renderGroup('Entradas', entradas)}
        {renderGroup('Salidas',  salidas)}
      </div>

      {/* ── Formulario ──────────────────────────────────────────────────── */}
      {actId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
            Detalles — {activities.find(a => a.id === actId)?.label}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Cantidad *</label>
              <input
                type="number" min={1}
                value={actCount}
                onChange={e => setActCount(e.target.value === '' ? '' : Number(e.target.value))}
                className={FIELD}
                placeholder="ej: 25"
              />
            </div>
            <div>
              <label className={LABEL}><Calendar className="inline w-3 h-3 mr-1" />Fecha</label>
              <input
                type="date" value={actDate}
                onChange={e => setActDate(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          {isAdd && (
            <div>
              <label className={LABEL}><Scale className="inline w-3 h-3 mr-1" />Peso de los animales ingresados (kg/cab)</label>
              <input
                type="number" min={1}
                value={actWeight}
                onChange={e => setActWeight(e.target.value === '' ? '' : Number(e.target.value))}
                className={FIELD}
                placeholder="opcional — para recalcular EV y peso promedio"
              />
            </div>
          )}

          <div>
            <label className={LABEL}>Nota (opcional)</label>
            <textarea
              rows={2}
              value={actNote}
              onChange={e => setActNote(e.target.value)}
              className={FIELD + ' resize-none'}
              placeholder="ej: Lote adquirido en remate Rosario"
            />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="text-center">
              <p className="text-xl font-black text-gray-900 tabular-nums">{currentCount}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase">Actual</p>
            </div>
            <div className="text-gray-300 text-lg">→</div>
            <div className="text-center">
              <p className={clsx('text-xl font-black tabular-nums', previewCount > currentCount ? 'text-blue-600' : previewCount < currentCount ? 'text-red-500' : 'text-gray-900')}>
                {previewCount}
              </p>
              <p className="text-[9px] font-bold text-gray-400 uppercase">Nuevo stock</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-black text-green-700 tabular-nums">{Math.round(previewEV).toLocaleString('es-AR')}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase">EV proy.</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all',
              canSubmit && !saving
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <>Registrar {activities.find(a => a.id === actId)?.label}</>}
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-xs font-bold text-green-800">{success}</p>
        </div>
      )}
    </div>
  )
}
