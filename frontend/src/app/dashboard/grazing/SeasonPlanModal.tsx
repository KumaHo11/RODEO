'use client'

/**
 * SeasonPlanModal — Modal de Plan de Temporada
 * ─────────────────────────────────────────────
 * 3 tabs:
 *  1. La Temporada   → parámetros globales (tipo, fechas, reservas)
 *  2. El Rodeo       → demanda proyectada por EV mes a mes
 *  3. Los Potreros   → oferta forrajera + balance final
 *
 * Guarda en /api/season-plans. Cada plan queda en el HISTÓRICO.
 * Diseño: Atomic Design System de RODEO (Inter, verde institucional, 8px radios).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  X, Check, Loader2,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import centroid from '@turf/centroid'
import distance from '@turf/distance'
import { feature } from '@turf/helpers'
import { Modal } from '@/design-system/molecules/Modal'
import { Tooltip } from '@/design-system/atoms/Tooltip'
import { apiFetch } from '@/lib/apiFetch'
import { projectEVDemand, calculateBaseEV, type ParitionSeason } from '@/lib/grazing/evProjection'
import { paddockForageOffer, HARVEST_EFFICIENCY, type HarvestEfficiency, calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Paddock {
  id: string
  name: string
  area_ha: number
  is_active?: boolean
  dry_matter_kg_ha?: number
  technical_data?: Record<string, any>
  boundary?: any
}

interface Herd {
  id: string
  name: string
  head_count: number
  avg_weight_kg: number | null
  categoria: string | null
  total_ev: number | null
}

interface SeasonPlan {
  id?: string
  name: string
  season_type: 'cerrado' | 'abierto' | 'ambos'
  year: number
  start_date: string
  end_date: string
  no_growth_from: string
  no_growth_to: string
  drought_reserve_days: number
  daily_allocation_kg: number
  cell_name?: string | null
  notes: string
  status: 'draft' | 'active' | 'closed'
  source: 'manual' | 'excel_import'
}

interface Props {
  paddocks: Paddock[]
  herds: Herd[]
  existingPlan?: SeasonPlan | null
  isSuggestedMode?: boolean
  onClose: () => void
  onSaved: (plan: SeasonPlan) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LABEL = 'text-[10px] font-black text-gray-400 uppercase tracking-widest'
const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 outline-none transition-all placeholder:text-gray-300 placeholder:font-normal'
const todayISO = () => new Date().toISOString().split('T')[0]
const currentYear = new Date().getFullYear()


// Semáforo de balance
const balanceColor = (pct: number) =>
  pct >= 110 ? { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Superávit forrajero' }
  : pct >= 80  ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Balance ajustado' }
  : { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Déficit forrajero' }

// Selector de paríción
const PARITION_OPTIONS: { value: ParitionSeason; label: string; sub: string }[] = [
  { value: 'otono',       label: 'Otoño',         sub: 'Parto en Abr–May — zona templada tradicional' },
  { value: 'primavera',   label: 'Primavera',      sub: 'Parto en Sep–Oct — mayor crecimiento forraje' },
  { value: 'todo_el_año', label: 'Todo el año',    sub: 'Servicio continuo — demanda promedio constante' },
]

// ─── SubComponent: FieldRow ────────────────────────────────────────────────────
function FieldRow({
  label, tooltip, children,
}: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className={LABEL}>{label}</label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      {children}
    </div>
  )
}

// ─── SubComponent: SeasonTypeSelector ──────────────────────────────────────────
function SeasonTypeSelector({
  value, onChange,
}: { value: 'cerrado' | 'abierto' | 'ambos'; onChange: (v: 'cerrado' | 'abierto' | 'ambos') => void }) {
  
  const toggle = (type: 'cerrado' | 'abierto') => {
    if (value === 'ambos') {
      onChange(type === 'cerrado' ? 'abierto' : 'cerrado')
    } else if (value === type) {
      // Avoid unselecting the only active option
    } else {
      onChange('ambos')
    }
  }

  const isSelected = (type: 'cerrado' | 'abierto') => value === 'ambos' || value === type

  return (
    <div className="grid grid-cols-2 gap-2">
      {(['cerrado', 'abierto'] as const).map(type => {
        const sel = isSelected(type)
        const label  = type === 'cerrado' ? 'Plan cerrado' : 'Plan abierto'
        const desc   = type === 'cerrado'
          ? 'Otoño/Invierno'
          : 'Primavera/Verano'
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 text-left transition-all ${
              sel
                ? 'border-green-500 bg-green-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <p className={`text-xs font-black ${sel ? 'text-green-700' : 'text-gray-700'}`}>{label}</p>
              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                 sel ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
              }`}>
                 {sel && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
              </div>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed font-medium">{desc}</p>
          </button>
        )
      })}
    </div>
  )
}

// ─── SubComponent: EVBar ───────────────────────────────────────────────────────
function EVBar({ label, ev, maxEV }: { label: string; ev: number; maxEV: number }) {
  const pct = maxEV > 0 ? Math.min((ev / maxEV) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500">{label}</span>
        <span className="text-[10px] font-black text-gray-700">{ev.toFixed(1)} EV</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function SeasonPlanModal({
  paddocks, herds, existingPlan, isSuggestedMode, onClose, onSaved,
}: Props) {
  const router = useRouter()
  const isEditing = !!existingPlan?.id

  // ── Tab state ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'temporada' | 'rodeo' | 'potreros'>('temporada')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // ── Tab 1: La Temporada ───────────────────────────────────────────
  const [name,               setName]               = useState(existingPlan?.name ?? `Plan ${currentYear}`)
  const [seasonType,         setSeasonType]         = useState<'cerrado' | 'abierto' | 'ambos'>(existingPlan?.season_type ?? 'cerrado')
  const [startDate,          setStartDate]          = useState(existingPlan?.start_date ?? '')
  const [endDate,            setEndDate]            = useState(existingPlan?.end_date ?? '')
  const [noGrowthFrom,       setNoGrowthFrom]       = useState(existingPlan?.no_growth_from ?? '')
  const [noGrowthTo,         setNoGrowthTo]         = useState(existingPlan?.no_growth_to ?? '')
  const [droughtReserveDays, setDroughtReserveDays] = useState<number>(existingPlan?.drought_reserve_days ?? 0)
  const [dailyAllocationKg,  setDailyAllocationKg]  = useState<number>(existingPlan?.daily_allocation_kg ?? 12)
  const [notes,              setNotes]              = useState(existingPlan?.notes ?? '')
  const [startPaddockId,     setStartPaddockId]     = useState<string>('')
  // IDs of paddocks the user chose to dismiss (exclude from calculation)
  const [dismissedPaddockIds, setDismissedPaddockIds] = useState<string[]>([])
  const toggleDismissPaddock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissedPaddockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    // If dismissing the start paddock, clear it
    if (id === startPaddockId) setStartPaddockId('')
  }
  
  const [selectedPaddockIds, setSelectedPaddockIds] = useState<string[]>(() =>
    paddocks.map(p => p.id) // Select all paddocks by default
  )
  const togglePaddock = (id: string) =>
    setSelectedPaddockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  
  // In suggested mode: all paddocks are "selected" unless explicitly dismissed
  const effectivePaddockIds = isSuggestedMode
    ? paddocks.map(p => p.id).filter(id => !dismissedPaddockIds.includes(id))
    : selectedPaddockIds
  const selectedPaddocks = paddocks.filter(p => effectivePaddockIds.includes(p.id))

  // Drought reserve: kg or % of total field MS
  const [droughtReserveMode, setDroughtReserveMode] = useState<'days' | 'pct' | 'kg'>('days')
  // ── Tab 2: parámetros biológicos ──────────────────────────────────────────
  const [paritionSeason, setParitionSeason] = useState<ParitionSeason>('otono')
  const [targetRemnant, setTargetRemnant]   = useState<number>(existingPlan ? (existingPlan as any).target_remnant_kg_ha ?? 600 : 600)
  // Per-paddock remnant overrides (paddock.id -> kg MS/ha)
  const [paddockRemnants, setPaddockRemnants] = useState<Record<string, number>>(() => ({}))
  const getPaddockRemnant = (paddockId: string) =>
    paddockRemnants[paddockId] !== undefined ? paddockRemnants[paddockId] : targetRemnant
  // Herd multi-selection — inicializa con todos los rodeos seleccionados
  const [selectedHerdIds, setSelectedHerdIds] = useState<string[]>(() => herds.map(h => h.id))
  const toggleHerd = (id: string) =>
    setSelectedHerdIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const selectedHerds = herds.filter(h => selectedHerdIds.includes(h.id))

  // ── Cargar defaults de org al montar (solo en creación, no en edición) ───────────────
  useEffect(() => {
    if (isEditing) return  // en edición, los valores del plan existente ya están cargados
    apiFetch('/api/organizations')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.organization) return
        const org = data.organization
        if (org.default_daily_allocation_kg != null)  setDailyAllocationKg(Number(org.default_daily_allocation_kg))
        if (org.default_target_remnant_kg_ha != null) setTargetRemnant(Number(org.default_target_remnant_kg_ha))
      })
      .catch(() => { /* silently ignore — defaults already set */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-fill fechas (H. Sur) ──────────────────────────────────────────
  useEffect(() => {
    if (isEditing) return
    if (seasonType === 'cerrado') {
      setStartDate(`${currentYear}-05-15`)
      setEndDate(`${currentYear}-09-15`)
      setNoGrowthFrom(`${currentYear}-06-01`)
      setNoGrowthTo(`${currentYear}-08-31`)
    } else if (seasonType === 'abierto') {
      setStartDate(`${currentYear}-09-16`)
      setEndDate(`${currentYear + 1}-05-14`)
      setNoGrowthFrom('')
      setNoGrowthTo('')
    } else if (seasonType === 'ambos') {
      setStartDate(`${currentYear}-05-15`)
      setEndDate(`${currentYear + 1}-05-14`)
      setNoGrowthFrom(`${currentYear}-06-01`)
      setNoGrowthTo(`${currentYear}-08-31`)
    }
  }, [seasonType, isEditing])

  // ── seasonDays (necesario antes de supplyData) ─────────────────────────
  const seasonDays = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : 180

  // ── Tab 2: Proyección EV dinámica (motor biológico real) ─────────────────
  const MONTHS_AHEAD = 6

  const projectedEVByMonth = useMemo(() =>
    projectEVDemand(selectedHerds, dailyAllocationKg, paritionSeason, MONTHS_AHEAD),
    [selectedHerds, dailyAllocationKg, paritionSeason]
  )

  const maxEV = useMemo(() =>
    Math.max(...projectedEVByMonth.map(m => m.totalEV), 0.1), [projectedEVByMonth])

  // ── Tab 3: Oferta forrajera real (curvas de crecimiento) ────────────────
  // Sortear potreros numéricamente
  const sortedPaddocks = useMemo(() =>
    [...paddocks].sort((a, b) => {
      const numA = parseInt(a.name, 10)
      const numB = parseInt(b.name, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      if (!isNaN(numA)) return -1
      if (!isNaN(numB)) return 1
      return a.name.localeCompare(b.name)
    })
  , [paddocks])

  const supplyData = useMemo(() => {
    const startMonthIndex = startDate ? new Date(startDate + 'T12:00:00').getMonth() : new Date().getMonth()
    const startYear = startDate ? new Date(startDate + 'T12:00:00').getFullYear() : new Date().getFullYear()
    const durationDays = Math.max(1, seasonDays)
    
    // ── EV de referencia para el cálculo de días por potrero ─────────────────
    // CRITERIO UNIFICADO: usamos la suma directa de total_ev de los rodeos seleccionados,
    // igual que el Motor Holístico del modal manual (totalPlanEV).
    // La proyección biológica (projectedEVByMonth) se usa solo para la demanda mensual,
    // NO para los avail_days por potrero — evita discrepancias entre ambos motores.
    const directTotalEV = selectedHerds.reduce((sum, h) => sum + (Number(h.total_ev) || 0), 0)
    const baseTotalEV = directTotalEV > 0
      ? directTotalEV
      : (projectedEVByMonth.length > 0 ? projectedEVByMonth[0].totalEV : 0)

    // Filtramos para cálculos globales pero mostramos todos en la lista
    return sortedPaddocks.map(p => {
      const isSelected = isSuggestedMode
        ? !dismissedPaddockIds.includes(p.id)
        : selectedPaddockIds.includes(p.id)
      const msHa    = Number(p.dry_matter_kg_ha) || 0
      const areaHa  = Number(p.area_ha) || 0
      const remnant = getPaddockRemnant(p.id)
      const { growthKgMs, stockKgMs, totalKgMs } = paddockForageOffer({
        initialMsKgHa: msHa,
        areaHa,
        startMonthIndex,
        durationDays,
        targetRemnantKgHa: remnant,
        startYear,
      })

      // Oferta proyectada: MS disponible durante TODA la temporada (stock + crecimiento - remanente)
      // Este es el valor agrario correcto para el balance global de la temporada.
      const projectedUsableKgMs = Math.max(0, totalKgMs - (remnant * areaHa))

      // Oferta estática: solo el stock actual - remanente (usado para calcular DAH por potrero)
      const usableKgMs = calculateUsableForage(msHa, remnant, areaHa)

      // Días disponibles del potrero individual (stock estático / demanda diaria)
      const dailyDemand = baseTotalEV * dailyAllocationKg
      const availDays = calculateGrazingDays(usableKgMs, dailyDemand)

      return {
        paddock: p, msHa, areaHa,
        totalMs: totalKgMs,
        usableMs:          isSelected ? usableKgMs : 0,          // estático (para DAH por potrero)
        projectedUsableMs: isSelected ? projectedUsableKgMs : 0, // con crecimiento (para balance global)
        growthKgMs, stockKgMs, availDays, remnant, isSelected
      }
    })
  }, [sortedPaddocks, selectedPaddockIds, dismissedPaddockIds, projectedEVByMonth, dailyAllocationKg, targetRemnant, paddockRemnants, startDate, seasonDays, isSuggestedMode])

  // ── Balance global ────────────────────────────────────────────────────────
  // Oferta: MS proyectada para toda la temporada (stock + crecimiento - remanente)
  // Este es el valor agrario correcto: no comparamos foto estática vs demanda de 6 meses.
  const totalOfertaKgMs  = supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.projectedUsableMs, 0)
  // Para mostrar en detalle también mantenemos el stock estático
  const totalOfertaEstaticaKgMs = supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.usableMs, 0)
  const currentTotalEV   = projectedEVByMonth.length > 0 ? projectedEVByMonth[0].totalEV : 0
  // Demanda = consumo de toda la temporada (descontada reserva sequía)
  const demandaTotalKgMs = currentTotalEV * dailyAllocationKg * Math.max(1, seasonDays - droughtReserveDays)
  const balancePct = demandaTotalKgMs > 0
    ? Math.round((totalOfertaKgMs / demandaTotalKgMs) * 100)
    : 0
  const balance = balanceColor(balancePct)

  const monthLabels = projectedEVByMonth.map(m => m.monthLabel)

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!name.trim()) { setError('El nombre del plan es requerido'); return }
    setSaving(true); setError(null)

    // Build snapshots para el histórico
    const demand_snapshot = {
      total_ev: currentTotalEV,
      daily_allocation_kg: dailyAllocationKg,
      by_month: projectedEVByMonth.map(m => ({
        label: m.monthLabel,
        total_ev: m.totalEV,
        daily_demand_kg: m.dailyDemandKg,
      })),
      by_category: herds.map(h => ({
        id: h.id, name: h.name,
        categoria: h.categoria,
        head_count: h.head_count,
        ev: h.total_ev,
      })),
    }

    const supply_snapshot = {
      total_ha: supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.areaHa, 0),
      total_kg_ms: supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.totalMs, 0),
      usable_kg_ms: totalOfertaKgMs,
      by_paddock: supplyData.filter(d => d.isSelected).map(d => ({
        id: d.paddock.id, name: d.paddock.name,
        area_ha: d.areaHa, ms_ha: d.msHa,
        total_ms: d.totalMs, usable_ms: d.usableMs,
        avail_days: d.availDays,
      })),
    }

    const metrics: any = {
      balance_pct: balancePct,
      oferta_kg_ms: totalOfertaKgMs,
      demanda_kg_ms: demandaTotalKgMs,
      season_days: seasonDays,
      balance_label: balance.label,
    }

    if (isSuggestedMode && startPaddockId) {
      // ── Generar Secuencia Sugerida con Turf (Nearest Neighbor) ──
      const selectedActivePaddocks = sortedPaddocks.filter(p =>
        !dismissedPaddockIds.includes(p.id) && p.is_active !== false
      )
      let currentPaddock = selectedActivePaddocks.find(p => p.id === startPaddockId)
      
      if (currentPaddock) {
        const unvisited = selectedActivePaddocks.filter(p => p.id !== startPaddockId)
        const sequence = [currentPaddock.id]
        
        while (unvisited.length > 0) {
          let nearestId = unvisited[0].id
          let minDistance = Infinity
          
          if (currentPaddock.boundary) {
            try {
              const currentCentroid = centroid(currentPaddock.boundary)
              let nearestIdx = 0
              
              for (let i = 0; i < unvisited.length; i++) {
                const candidate = unvisited[i]
                if (candidate.boundary) {
                  const candidateCentroid = centroid(candidate.boundary)
                  const dist = distance(currentCentroid, candidateCentroid)
                  if (dist < minDistance) {
                    minDistance = dist
                    nearestId = candidate.id
                    nearestIdx = i
                  }
                }
              }
              // Set next current to nearest
              currentPaddock = unvisited[nearestIdx]
              unvisited.splice(nearestIdx, 1)
            } catch (e) {
              // Fallback to sequential if turf fails
              nearestId = unvisited[0].id
              currentPaddock = unvisited[0]
              unvisited.shift()
            }
          } else {
            // Fallback if no boundary
            nearestId = unvisited[0].id
            currentPaddock = unvisited[0]
            unvisited.shift()
          }
          
          sequence.push(nearestId)
        }
        metrics.suggested_sequence = sequence
      }
    }

    const payload = {
      name: name.trim(), season_type: seasonType,
      year: startDate ? parseInt(startDate.split('-')[0]) : new Date().getFullYear(),
      start_date: startDate || null, end_date: endDate || null,
      no_growth_from: noGrowthFrom || null, no_growth_to: noGrowthTo || null,
      drought_reserve_days: droughtReserveDays,
      drought_reserve_mode: droughtReserveMode,
      daily_allocation_kg: dailyAllocationKg,
      target_remnant_kg_ha: targetRemnant,
      cell_name: null,
      source: isSuggestedMode ? 'suggested' : 'manual', status: 'draft',
      notes: notes.trim() || null,
      demand_snapshot, supply_snapshot, metrics,
    }

    try {
      let res: Response
      if (isEditing && existingPlan?.id) {
        res = await apiFetch(`/api/season-plans/${existingPlan.id}`, {
          method: 'PATCH', body: JSON.stringify(payload),
        })
      } else {
        res = await apiFetch('/api/season-plans', {
          method: 'POST', body: JSON.stringify(payload),
        })
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `Error ${res.status}`)
        return
      }
      const data = await res.json()
      // Persistir los defaults de planificación en la org (sin await para no bloquear el flujo)
      apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({
          default_daily_allocation_kg:  dailyAllocationKg,
          default_target_remnant_kg_ha: targetRemnant,
        })
      }).catch(() => { /* ignorar — no es crítico */ })
      // Merge payload with the full server response so metrics.suggested_sequence is preserved
      const fullPlan = { ...payload, ...data } as SeasonPlan
      onSaved(fullPlan)
      onClose()
    } catch (e: any) {
      setError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [
    name, seasonType, startDate, endDate,
    noGrowthFrom, noGrowthTo, droughtReserveDays, dailyAllocationKg,
    notes,
    isEditing, existingPlan, onSaved, onClose,
    currentTotalEV, projectedEVByMonth, supplyData,
    totalOfertaKgMs, demandaTotalKgMs, balancePct, seasonDays, balance,
    droughtReserveMode, dismissedPaddockIds, startPaddockId, isSuggestedMode,
  ])

  // computed balance color
  const bc = balanceColor(balancePct)
  const dailyDemandGlobal = currentTotalEV * dailyAllocationKg
  const totalAvailableDays = dailyDemandGlobal > 0 ? Math.floor(totalOfertaKgMs / dailyDemandGlobal) : 0
  const daysWithoutForage = Math.max(0, seasonDays - totalAvailableDays)

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm font-black text-gray-950">
              {isSuggestedMode ? 'Planificación sugerida' : (isEditing ? 'Editar plan' : 'Nuevo plan')}
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
              Plan forrajero por temporada
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* ── CARD 1: Identidad del plan ── */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-white">
            <p className={LABEL}>Identidad del plan</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className={LABEL}>Nombre del plan</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Otoño-Invierno 2025"
                  className={INPUT}
                />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Inicio</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Fin</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT} />
              </div>
            </div>
            {/* Season type chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['cerrado','abierto'] as const).map(t => {
                const sel = seasonType === 'ambos' || seasonType === t
                return (
                  <button key={t} type="button"
                    onClick={() => {
                      if (seasonType === 'ambos') setSeasonType(t === 'cerrado' ? 'abierto' : 'cerrado')
                      else if (seasonType !== t) setSeasonType('ambos')
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${sel ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                  >
                    {sel && <Check className="w-3 h-3" strokeWidth={3} />}
                    {t === 'cerrado' ? 'Otoño / Invierno' : 'Primavera / Verano'}
                  </button>
                )
              })}
              {(seasonType === 'cerrado' || seasonType === 'ambos') && (
                <div className="w-full grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1.5">
                    <label className={LABEL}>Sin crecimiento desde</label>
                    <input type="date" value={noGrowthFrom} onChange={e => setNoGrowthFrom(e.target.value)} className={INPUT} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL}>Sin crecimiento hasta</label>
                    <input type="date" value={noGrowthTo} onChange={e => setNoGrowthTo(e.target.value)} className={INPUT} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── CARD 2: Rodeos ── */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-2 bg-white">
            <div className="flex items-center justify-between">
              <p className={LABEL}>Rodeos incluidos</p>
              <span className="text-[10px] text-gray-400 font-bold">{selectedHerdIds.length} de {herds.length}</span>
            </div>
            <div className="space-y-1.5">
              {herds.map(h => {
                const sel = selectedHerdIds.includes(h.id)
                return (
                  <div key={h.id}
                    onClick={() => toggleHerd(h.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${sel ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                        {sel && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-800">{h.name}</p>
                        <p className="text-[10px] text-gray-400">{h.head_count} cabezas · {Number(h.total_ev || 0).toFixed(1)} EV</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-gray-500">{h.categoria || '—'}</span>
                  </div>
                )
              })}
            </div>
            {selectedHerdIds.length > 0 && (
              <div className="flex items-center gap-4 pt-1 px-1">
                <div className="flex-1 text-center">
                  <p className="text-lg font-black text-gray-900">{Number(currentTotalEV).toFixed(0)}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase">EV total</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-lg font-black text-gray-900">{(currentTotalEV * dailyAllocationKg).toFixed(0)}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase">kg MS/día</p>
                </div>
              </div>
            )}
          </div>

          {/* ── CARD 3: Potreros ── */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-2 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className={LABEL}>{isSuggestedMode ? 'Seleccioná el potrero de inicio' : 'Potreros disponibles'}</p>
                {isSuggestedMode && <p className="text-[10px] text-gray-400 mt-0.5">Tocá un potrero para marcarlo como inicio del recorrido. Deshabilitá los que no querés incluir.</p>}
              </div>
              {dismissedPaddockIds.length > 0 && (
                <span className="text-[10px] font-bold text-gray-400">{dismissedPaddockIds.length} excluido{dismissedPaddockIds.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {supplyData.map(({ paddock, msHa, areaHa, usableMs, availDays, isSelected }) => {
                const isActive = paddock.is_active !== false
                const isDismissed = dismissedPaddockIds.includes(paddock.id)
                const isStart = startPaddockId === paddock.id
                const isChecked = isSuggestedMode ? !isDismissed : isSelected

                const handleClick = () => {
                  if (!isActive) return
                  if (isSuggestedMode) {
                    if (!isDismissed) setStartPaddockId(p => p === paddock.id ? '' : paddock.id)
                  } else {
                    togglePaddock(paddock.id)
                  }
                }

                return (
                  <div key={paddock.id}
                    onClick={handleClick}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                      !isActive ? 'opacity-40 grayscale pointer-events-none bg-gray-50 border-gray-100' :
                      isDismissed ? 'opacity-40 bg-gray-50 border-dashed border-gray-200' :
                      isSuggestedMode
                        ? (isStart ? 'border-purple-500 bg-purple-50 cursor-pointer shadow-sm' : 'border-gray-100 bg-white hover:border-gray-300 cursor-pointer')
                        : (isChecked ? 'border-gray-900 bg-gray-50 cursor-pointer' : 'border-gray-100 bg-white hover:border-gray-200 cursor-pointer')
                    }`}
                  >
                    {/* Left: indicator + info */}
                    <div className="flex items-center gap-2.5">
                      {isSuggestedMode ? (
                        isStart
                          ? <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="white" stroke="white"/></svg>
                            </div>
                          : <div className="w-4 h-4 rounded-full border-2 border-gray-300 bg-white shrink-0" />
                      ) : (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                          {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-bold ${isStart || isChecked ? 'text-gray-900' : 'text-gray-500'}`}>{paddock.name}</p>
                          {isSuggestedMode && isStart && <span className="text-[9px] font-black text-purple-600 bg-purple-100 px-1 py-0.5 rounded">Inicio</span>}
                          {isDismissed && <span className="text-[9px] font-bold text-gray-400">Excluido</span>}
                        </div>
                        <p className="text-[10px] text-gray-400">{areaHa.toFixed(1)} ha · {msHa > 0 ? `${msHa.toLocaleString('es')} kg MS/ha` : 'Sin datos'}</p>
                      </div>
                    </div>

                    {/* Right: toggle enabled/disabled */}
                    {isActive && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleDismissPaddock(paddock.id, e) }}
                        className={`relative shrink-0 w-8 h-4.5 rounded-full transition-colors focus:outline-none ${isDismissed ? 'bg-gray-200' : 'bg-green-500'}`}
                        title={isDismissed ? 'Habilitar' : 'Deshabilitar'}
                      >
                        <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${isDismissed ? 'left-0.5' : 'left-[14px]'}`} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {isSuggestedMode && !startPaddockId && (
              <p className="text-[10px] text-purple-700 font-semibold text-center py-0.5">
                Tocá un potrero habilitado para marcarlo como inicio.
              </p>
            )}
          </div>

          {/* ── CARD 4: Parámetros ── */}
          <div className="border border-gray-100 rounded-xl p-4 bg-white">
            <p className={LABEL + ' mb-3'}>Parámetros de pastoreo</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={LABEL}>Ración diaria / EV</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setDailyAllocationKg(v => Math.max(6, v - 0.5))} className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-black text-sm transition-all shrink-0">−</button>
                  <div className="flex-1 text-center">
                    <p className="text-base font-black text-gray-900">{dailyAllocationKg}</p>
                    <p className="text-[9px] text-gray-400">kg MS/EV/día</p>
                  </div>
                  <button type="button" onClick={() => setDailyAllocationKg(v => Math.min(20, v + 0.5))} className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-black text-sm transition-all shrink-0">+</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Remanente objetivo</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setTargetRemnant(v => Math.max(100, v - 50))} className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-black text-sm transition-all shrink-0">−</button>
                  <div className="flex-1 text-center">
                    <p className="text-base font-black text-gray-900">{targetRemnant}</p>
                    <p className="text-[9px] text-gray-400">kg MS/ha</p>
                  </div>
                  <button type="button" onClick={() => setTargetRemnant(v => Math.min(2000, v + 50))} className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-black text-sm transition-all shrink-0">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── CARD 5: Reserva de sequía (solo en cerrado/ambos) ── */}
          {(seasonType === 'cerrado' || seasonType === 'ambos') && (
            <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <p className={LABEL}>Reserva de sequía</p>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {(['days','pct','kg'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setDroughtReserveMode(m)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all ${droughtReserveMode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {m === 'days' ? 'Días' : m === 'pct' ? '%' : 'kg MS'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" min="0"
                  value={droughtReserveDays || ''}
                  onChange={e => {
                    const val = Number(e.target.value)
                    if (droughtReserveMode === 'days') { setDroughtReserveDays(val) }
                    else if (droughtReserveMode === 'pct') {
                      const totalMs = supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.usableMs, 0)
                      const dd = currentTotalEV * dailyAllocationKg
                      setDroughtReserveDays(dd > 0 ? Math.round((val / 100) * totalMs / dd) : 0)
                    } else {
                      const dd = currentTotalEV * dailyAllocationKg
                      setDroughtReserveDays(dd > 0 ? Math.round(val / dd) : 0)
                    }
                  }}
                  placeholder="0"
                  className={INPUT}
                />
                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                  {droughtReserveMode === 'days' ? 'días' : droughtReserveMode === 'pct' ? '% del campo' : 'kg MS'}
                </span>
                {droughtReserveDays > 0 && <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">≈ {droughtReserveDays} días</span>}
              </div>
              {droughtReserveDays > 0 && balancePct < 100 && (
                <div className="flex gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 font-medium">Déficit detectado ({balancePct}%). La reserva no es posible con la carga actual. <Link href="/dashboard/insights" className="font-bold underline" onClick={onClose}>Ver Insights</Link>.</p>
                </div>
              )}
            </div>
          )}

          {/* ── CARD 6: Balance ── */}
          {selectedHerdIds.length > 0 && (
            <div className={`border rounded-xl p-4 ${bc.bg} ${bc.border}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-black ${bc.text}`}>{bc.label}</p>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${balancePct >= 110 ? 'bg-green-500' : balancePct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className={`text-xs font-black ${bc.text}`}>{balancePct}%</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${balancePct >= 110 ? 'bg-green-500' : balancePct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(balancePct, 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className={`text-sm font-black ${bc.text}`}>{Math.round(totalOfertaKgMs).toLocaleString('es')}</p>
                  <p className="text-[9px] text-gray-500 font-bold">kg MS oferta</p>
                  <p className="text-[9px] text-gray-400">(stock + crecimiento {seasonDays}d)</p>
                </div>
                <div>
                  <p className={`text-sm font-black ${bc.text}`}>{Math.round(demandaTotalKgMs).toLocaleString('es')}</p>
                  <p className="text-[9px] text-gray-500 font-bold">kg MS demanda</p>
                  <p className="text-[9px] text-gray-400">{seasonDays} días · {(currentTotalEV * dailyAllocationKg).toFixed(0)} kg/día</p>
                </div>
                <div>
                  <p className={`text-sm font-black ${totalAvailableDays >= seasonDays ? 'text-green-700' : 'text-red-700'}`}>
                    {totalAvailableDays >= seasonDays ? `+${totalAvailableDays - seasonDays}d` : `-${daysWithoutForage}d`}
                  </p>
                  <p className="text-[9px] text-gray-500 font-bold">{totalAvailableDays >= seasonDays ? 'excedente' : 'sin forraje'}</p>
                </div>
              </div>
              {balancePct < 80 && (
                <button onClick={() => { onClose(); router.push('/dashboard/insights') }}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition-colors">
                  Ver sugerencias en Insights <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 shrink-0">
          {error && <p className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
          {!error && <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-black text-white rounded-xl transition-all disabled:opacity-40 ${isSuggestedMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-900 hover:bg-gray-800'}`}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Check className="w-4 h-4" /> {isEditing ? 'Actualizar' : 'Guardar plan'}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

