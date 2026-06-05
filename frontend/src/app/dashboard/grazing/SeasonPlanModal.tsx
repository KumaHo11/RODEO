'use client'

/**
 * SeasonPlanModal — Wizard de Planificación Forrajera (3 pasos)
 * ─────────────────────────────────────────────────────────────
 * Paso 1 · El Plan     → nombre, período, tipo de temporada, menor crecimiento
 * Paso 2 · El Rodeo    → selección de rodeos + ración diaria
 * Paso 3 · Los Potreros → selección + indicadores + remanente + descanso + balance
 *
 * Guarda en /api/season-plans con recovery_days incluido.
 * Design system: Inter · verde institucional · violeta para modo sugerido.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  X, Check, Loader2,
  AlertTriangle, ArrowRight, ChevronRight, ChevronLeft,
  Droplets, Star, Leaf, TrendingDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import centroid from '@turf/centroid'
import distance from '@turf/distance'
import { apiFetch } from '@/lib/apiFetch'
import { projectEVDemand, calculateBaseEV, type ParitionSeason, type BioMilestone } from '@/lib/grazing/evProjection'
import {
  paddockForageOffer,
  calculateUsableForage, calculateGrazingDays,
  BASE_GROWTH_RATE_KG_HA_DAY,
} from '@/lib/grazing/forageCurves'

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
  physiological_category?: string | null
  daily_gain_kg?: number | null
  last_weigh_date?: string | null
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
  bioMilestones?: BioMilestone[]
  initialDailyAllocationKg?: number
  initialTargetRemnant?: number
  onClose: () => void
  onSaved: (plan: SeasonPlan) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LABEL = 'text-[10px] font-black text-gray-400 uppercase tracking-widest'
const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 outline-none transition-all placeholder:text-gray-300 placeholder:font-normal'
const todayISO = () => new Date().toISOString().split('T')[0]
const currentYear = new Date().getFullYear()

const balanceColor = (pct: number) =>
  pct >= 110 ? { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Superávit forrajero' }
  : pct >= 80  ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Balance ajustado' }
  : { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Déficit forrajero' }

// Crecimiento estimado por mes (índice 0=Enero) — Hemisferio Sur, Pampa Húmeda
const MONTH_NAMES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function growthLabel(rate: number): { text: string; color: string } {
  if (rate >= 20) return { text: 'alto', color: 'text-green-600' }
  if (rate >= 8)  return { text: 'moderado', color: 'text-amber-600' }
  if (rate >= 3)  return { text: 'bajo', color: 'text-orange-500' }
  return { text: 'mínimo', color: 'text-red-500' }
}

// ─── Stepper header ──────────────────────────────────────────────────────────
const STEP_LABELS = ['El Plan', 'El Rodeo', 'Los Potreros']

function WizardStepper({ step, isSuggested }: { step: number; isSuggested: boolean }) {
  const accent = isSuggested ? 'bg-violet-600' : 'bg-gray-900'
  const accentBorder = isSuggested ? 'border-violet-600' : 'border-gray-900'
  const accentText = isSuggested ? 'text-violet-600' : 'text-gray-900'
  return (
    <div className="flex items-center gap-0 justify-center py-1">
      {STEP_LABELS.map((label, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${
                done ? `${accent} border-transparent text-white`
                : active ? `bg-white ${accentBorder} ${accentText}`
                : 'bg-white border-gray-200 text-gray-300'
              }`}>
                {done ? <Check className="w-3 h-3" strokeWidth={3} /> : idx}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider ${active ? accentText : done ? 'text-gray-400' : 'text-gray-200'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-12 h-px mb-4 mx-1 transition-all ${done ? (isSuggested ? 'bg-violet-400' : 'bg-gray-400') : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Stepper counter row for a single value ────────────────────────────────
function Stepper({
  value, onChange, min, max, step = 1, unit,
}: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-black text-base transition-all shrink-0">−</button>
      <div className="flex-1 text-center">
        <p className="text-lg font-black text-gray-900">{value}</p>
        {unit && <p className="text-[9px] text-gray-400 leading-none">{unit}</p>}
      </div>
      <button type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-black text-base transition-all shrink-0">+</button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SeasonPlanModal({
  paddocks, herds, existingPlan, isSuggestedMode, bioMilestones,
  initialDailyAllocationKg, initialTargetRemnant,
  onClose, onSaved,
}: Props) {
  const router = useRouter()
  const isEditing = !!existingPlan?.id

  // ── Wizard step ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    import('@/lib/analytics').then(({ event }) => event({ action: 'plan_wizard_start', category: 'planner', mode: isSuggestedMode ? 'sugerido' : 'manual' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Paso 1: El Plan ─────────────────────────────────────────────────────────
  const [name, setName] = useState(existingPlan?.name ?? `Plan ${currentYear}`)
  const [seasonType, setSeasonType] = useState<'cerrado' | 'abierto' | 'ambos'>(
    existingPlan?.season_type ?? 'cerrado'
  )
  const [startDate, setStartDate] = useState(existingPlan?.start_date ?? '')
  const [endDate, setEndDate] = useState(existingPlan?.end_date ?? '')
  const [noGrowthFrom, setNoGrowthFrom] = useState(existingPlan?.no_growth_from ?? '')
  const [noGrowthTo, setNoGrowthTo] = useState(existingPlan?.no_growth_to ?? '')
  const [notes, setNotes] = useState(existingPlan?.notes ?? '')

  // ── Paso 2: El Rodeo ────────────────────────────────────────────────────────
  const [selectedHerdIds, setSelectedHerdIds] = useState<string[]>(() => herds.map(h => h.id))
  const toggleHerd = (id: string) =>
    setSelectedHerdIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const selectedHerds = herds.filter(h => selectedHerdIds.includes(h.id))

  const [dailyAllocationKg, setDailyAllocationKg] = useState<number>(
    existingPlan?.daily_allocation_kg ?? initialDailyAllocationKg ?? 12
  )

  // ── Paso 3: Los Potreros ────────────────────────────────────────────────────
  const [startPaddockId, setStartPaddockId] = useState<string>('')
  const [dismissedPaddockIds, setDismissedPaddockIds] = useState<string[]>([])
  const toggleDismissPaddock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissedPaddockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    if (id === startPaddockId) setStartPaddockId('')
  }
  const [selectedPaddockIds, setSelectedPaddockIds] = useState<string[]>(() => paddocks.map(p => p.id))
  const togglePaddock = (id: string) =>
    setSelectedPaddockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const effectivePaddockIds = isSuggestedMode
    ? paddocks.map(p => p.id).filter(id => !dismissedPaddockIds.includes(id))
    : selectedPaddockIds
  const selectedPaddocks = paddocks.filter(p => effectivePaddockIds.includes(p.id))

  // Remanente
  const [targetRemnant, setTargetRemnant] = useState<number>(
    existingPlan ? ((existingPlan as any).target_remnant_kg_ha ?? initialTargetRemnant ?? 600) : (initialTargetRemnant ?? 600)
  )

  // Días de descanso regenerativo
  const [recoverySpringSum, setRecoverySpringSum] = useState<number>(
    (existingPlan as any)?.recovery_days?.spring_summer ?? 40
  )
  const [recoveryAutumn, setRecoveryAutumn] = useState<number>(
    (existingPlan as any)?.recovery_days?.autumn ?? 65
  )
  const [recoveryWinter, setRecoveryWinter] = useState<number>(
    (existingPlan as any)?.recovery_days?.winter ?? 110
  )

  // Reserva de sequía
  const [droughtReserveDays, setDroughtReserveDays] = useState<number>(
    existingPlan?.drought_reserve_days ?? 0
  )
  const [droughtReserveMode, setDroughtReserveMode] = useState<'days' | 'pct' | 'kg'>('days')

  // Parición
  const [paritionSeason] = useState<ParitionSeason>('otono')

  // ── Auto-fill fechas ─────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (isEditing) return
    if (initialDailyAllocationKg != null && initialTargetRemnant != null) return
    apiFetch('/api/organizations')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.organization) return
        const org = data.organization
        if (org.default_daily_allocation_kg != null) setDailyAllocationKg(Number(org.default_daily_allocation_kg))
        if (org.default_target_remnant_kg_ha != null) setTargetRemnant(Number(org.default_target_remnant_kg_ha))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const seasonDays = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : 180

  const projectedEVByMonth = useMemo(() =>
    projectEVDemand(selectedHerds, dailyAllocationKg, paritionSeason, 6),
    [selectedHerds, dailyAllocationKg, paritionSeason]
  )

  const currentTotalEV = projectedEVByMonth.length > 0 ? projectedEVByMonth[0].totalEV : 0

  const sortedPaddocks = useMemo(() =>
    [...paddocks].sort((a, b) => {
      const numA = parseInt(a.name, 10)
      const numB = parseInt(b.name, 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      if (!isNaN(numA)) return -1
      if (!isNaN(numB)) return 1
      return a.name.localeCompare(b.name)
    }), [paddocks])

  const supplyData = useMemo(() => {
    const startMonthIndex = startDate ? new Date(startDate + 'T12:00:00').getMonth() : new Date().getMonth()
    const startYear = startDate ? new Date(startDate + 'T12:00:00').getFullYear() : new Date().getFullYear()
    const durationDays = Math.max(1, seasonDays)
    const directTotalEV = selectedHerds.reduce((sum, h) => sum + (Number(h.total_ev) || 0), 0)
    const baseTotalEV = directTotalEV > 0 ? directTotalEV : (projectedEVByMonth[0]?.totalEV ?? 0)

    return sortedPaddocks.map(p => {
      const isSelected = isSuggestedMode ? !dismissedPaddockIds.includes(p.id) : selectedPaddockIds.includes(p.id)
      const msHa = Number(p.dry_matter_kg_ha) || 0
      const areaHa = Number(p.area_ha) || 0
      const { growthKgMs, stockKgMs, totalKgMs } = paddockForageOffer({
        initialMsKgHa: msHa, areaHa, startMonthIndex, durationDays,
        targetRemnantKgHa: targetRemnant, startYear,
      })
      const projectedUsableKgMs = Math.max(0, totalKgMs - (targetRemnant * areaHa))
      const usableKgMs = calculateUsableForage(msHa, targetRemnant, areaHa)
      const dailyDemand = baseTotalEV * dailyAllocationKg
      const availDays = calculateGrazingDays(usableKgMs, dailyDemand)
      return {
        paddock: p, msHa, areaHa, totalMs: totalKgMs,
        usableMs: isSelected ? usableKgMs : 0,
        projectedUsableMs: isSelected ? projectedUsableKgMs : 0,
        growthKgMs, stockKgMs, availDays, isSelected,
      }
    })
  }, [sortedPaddocks, selectedPaddockIds, dismissedPaddockIds, projectedEVByMonth, dailyAllocationKg, targetRemnant, startDate, seasonDays, isSuggestedMode, selectedHerds])

  const totalOfertaKgMs = supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.projectedUsableMs, 0)
  const demandaTotalKgMs = currentTotalEV * dailyAllocationKg * Math.max(1, seasonDays)
  const reservaSequiaKgMs = currentTotalEV * dailyAllocationKg * droughtReserveDays
  const ofertaEfectivaKgMs = Math.max(0, totalOfertaKgMs - reservaSequiaKgMs)
  const balancePct = demandaTotalKgMs > 0 ? Math.round((ofertaEfectivaKgMs / demandaTotalKgMs) * 100) : 0
  const balance = balanceColor(balancePct)
  const dailyDemandGlobal = currentTotalEV * dailyAllocationKg
  const totalAvailableDays = dailyDemandGlobal > 0 ? Math.floor(ofertaEfectivaKgMs / dailyDemandGlobal) : 0
  const daysWithoutForage = Math.max(0, seasonDays - totalAvailableDays)

  // ── Indicador climático de menor crecimiento ─────────────────────────────────
  const growthIndicator = useMemo(() => {
    if (!noGrowthFrom || !noGrowthTo) return null
    const from = new Date(noGrowthFrom + 'T12:00:00')
    const to = new Date(noGrowthTo + 'T12:00:00')
    const months: { month: number; rate: number }[] = []
    const cur = new Date(from)
    while (cur <= to) {
      const m = cur.getMonth()
      if (!months.find(x => x.month === m)) months.push({ month: m, rate: BASE_GROWTH_RATE_KG_HA_DAY[m] ?? 0 })
      cur.setMonth(cur.getMonth() + 1)
    }
    return months
  }, [noGrowthFrom, noGrowthTo])

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!name.trim()) { setError('El nombre del plan es requerido'); return }
    setSaving(true); setError(null)

    const demand_snapshot = {
      total_ev: currentTotalEV,
      daily_allocation_kg: dailyAllocationKg,
      by_month: projectedEVByMonth.map(m => ({ label: m.monthLabel, total_ev: m.totalEV, daily_demand_kg: m.dailyDemandKg })),
      by_category: herds.map(h => ({
        id: h.id, name: h.name, categoria: h.categoria, head_count: h.head_count,
        ev: Number(h.total_ev || 0),
      })),
    }

    const supply_snapshot = {
      total_ha: supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.areaHa, 0),
      total_kg_ms: supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.totalMs, 0),
      usable_kg_ms: totalOfertaKgMs,
      by_paddock: supplyData.filter(d => d.isSelected).map(d => ({
        id: d.paddock.id, name: d.paddock.name,
        area_ha: d.areaHa, ms_ha: d.msHa,
        total_ms: d.totalMs, usable_ms: d.usableMs, avail_days: d.availDays,
      })),
    }

    const metrics: any = {
      balance_pct: balancePct,
      oferta_kg_ms: ofertaEfectivaKgMs,
      oferta_bruta_kg_ms: totalOfertaKgMs,
      reserva_kg_ms: reservaSequiaKgMs,
      demanda_kg_ms: demandaTotalKgMs,
      season_days: seasonDays,
      balance_label: balance.label,
    }

    if (isSuggestedMode && startPaddockId) {
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
                  if (dist < minDistance) { minDistance = dist; nearestId = candidate.id; nearestIdx = i }
                }
              }
              currentPaddock = unvisited[nearestIdx]
              unvisited.splice(nearestIdx, 1)
            } catch {
              nearestId = unvisited[0].id; currentPaddock = unvisited[0]; unvisited.shift()
            }
          } else {
            nearestId = unvisited[0].id; currentPaddock = unvisited[0]; unvisited.shift()
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
      recovery_days: { spring_summer: recoverySpringSum, autumn: recoveryAutumn, winter: recoveryWinter },
      cell_name: null,
      source: isSuggestedMode ? 'suggested' : 'manual', status: 'draft',
      notes: notes.trim() || null,
      demand_snapshot, supply_snapshot, metrics,
      herd_ids: selectedHerdIds,
    }

    try {
      let res: Response
      if (isEditing && existingPlan?.id) {
        res = await apiFetch(`/api/season-plans/${existingPlan.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        res = await apiFetch('/api/season-plans', { method: 'POST', body: JSON.stringify(payload) })
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `Error ${res.status}`)
        return
      }
      const data = await res.json()
      apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ default_daily_allocation_kg: dailyAllocationKg, default_target_remnant_kg_ha: targetRemnant }),
      }).catch(() => {})
      const fullPlan = { ...payload, ...data } as SeasonPlan
      import('@/lib/analytics').then(({ event }) => event({ action: 'plan_wizard_complete', category: 'planner', mode: isSuggestedMode ? 'sugerido' : 'manual', season_days: seasonDays, herds_count: selectedHerdIds.length }))
      onSaved(fullPlan)
      onClose()
    } catch (e: any) {
      setError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [
    name, seasonType, startDate, endDate, noGrowthFrom, noGrowthTo,
    droughtReserveDays, droughtReserveMode, dailyAllocationKg, targetRemnant,
    recoverySpringSum, recoveryAutumn, recoveryWinter, notes, isEditing, existingPlan,
    onSaved, onClose, currentTotalEV, projectedEVByMonth, supplyData,
    totalOfertaKgMs, ofertaEfectivaKgMs, reservaSequiaKgMs, demandaTotalKgMs,
    balancePct, seasonDays, balance, dismissedPaddockIds, startPaddockId,
    isSuggestedMode, selectedHerdIds, herds, sortedPaddocks,
  ])

  // ── Accent según modo ────────────────────────────────────────────────────────
  const accent = isSuggestedMode
    ? { btn: 'bg-violet-600 hover:bg-violet-700', ring: 'ring-violet-500/20', border: 'border-violet-500', text: 'text-violet-600', chip: 'bg-violet-600 border-violet-600', chipBg: 'bg-violet-50 border-violet-500' }
    : { btn: 'bg-gray-900 hover:bg-gray-800', ring: 'ring-gray-900/20', border: 'border-gray-900', text: 'text-gray-900', chip: 'bg-gray-900 border-gray-900', chipBg: 'bg-gray-50 border-gray-900' }

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* ── Header fijo ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-gray-950">
                {isSuggestedMode ? 'Planificación sugerida' : (isEditing ? 'Editar plan' : 'Nuevo plan forrajero')}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Wizrd de planificación · Paso {step} de 3
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <WizardStepper step={step} isSuggested={!!isSuggestedMode} />
        </div>

        {/* ── Scroll body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* ════════════════════════════════════════════════════════════
               PASO 1 — EL PLAN
          ════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <>
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className={LABEL}>Nombre del plan</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Plan Otoño-Invierno 2026"
                  className={INPUT}
                />
              </div>

              {/* Tipo de temporada */}
              <div className="space-y-2">
                <label className={LABEL}>Tipo de temporada</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cerrado', 'abierto'] as const).map(t => {
                    const sel = seasonType === 'ambos' || seasonType === t
                    return (
                      <button key={t} type="button"
                        onClick={() => {
                          if (seasonType === 'ambos') setSeasonType(t === 'cerrado' ? 'abierto' : 'cerrado')
                          else if (seasonType !== t) setSeasonType('ambos')
                        }}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-left transition-all ${sel ? `${accent.chipBg} ${accent.border}` : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border-2 ${sel ? `${accent.chip} text-white` : 'border-gray-300'}`}>
                          {sel && <Check className="w-2.5 h-2.5" strokeWidth={4} />}
                        </div>
                        <div>
                          <p className={`text-xs font-black ${sel ? accent.text : 'text-gray-700'}`}>
                            {t === 'cerrado' ? 'Otoño / Invierno' : 'Primavera / Verano'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium">
                            {t === 'cerrado' ? 'May–Sep — plan cerrado' : 'Sep–May — plan abierto'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Fechas del plan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={LABEL}>Fecha inicio</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT} />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>Fecha fin</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT} />
                </div>
              </div>

              {/* Días del plan */}
              {startDate && endDate && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                  <Leaf className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-black text-gray-700">{seasonDays} días de temporada</p>
                  <span className="text-xs text-gray-400 font-medium">
                    ({new Date(startDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} → {new Date(endDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })})
                  </span>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
               PASO 2 — EL RODEO
          ════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              {/* Lista de rodeos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={LABEL}>Rodeos incluidos</label>
                  <span className="text-[10px] text-gray-400 font-bold">{selectedHerdIds.length} de {herds.length}</span>
                </div>
                <div className="space-y-2">
                  {herds.map(h => {
                    const sel = selectedHerdIds.includes(h.id)
                    const displayEV = Number(h.total_ev || 0)
                    return (
                      <div key={h.id} onClick={() => toggleHerd(h.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${sel ? `${accent.chipBg} ${accent.border}` : 'border-gray-100 bg-white hover:border-gray-200'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${sel ? `${accent.chip} text-white` : 'border-gray-300'}`}>
                            {sel && <Check className="w-3 h-3" strokeWidth={3} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{h.name}</p>
                            <p className="text-[10px] text-gray-400">
                              {h.head_count} cab. · <span className="font-black text-green-700">{displayEV.toFixed(1)} EV</span>
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{h.categoria || '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* EV total */}
              {selectedHerdIds.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-gray-900">{Number(currentTotalEV).toFixed(0)}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">EV Total</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-gray-900">{(currentTotalEV * dailyAllocationKg).toFixed(0)}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">kg MS/día</p>
                  </div>
                </div>
              )}

              {/* Ración diaria */}
              <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
                <div>
                  <p className={LABEL}>Ración diaria por EV</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Cuánto consume cada equivalente vaca por día</p>
                </div>
                <Stepper value={dailyAllocationKg} onChange={setDailyAllocationKg} min={6} max={20} step={0.5} unit="kg MS/EV/día" />
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
               PASO 3 — LOS POTREROS
          ════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <>
              {/* Lista de potreros */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className={LABEL}>
                      {isSuggestedMode ? 'Seleccioná el potrero de inicio' : 'Potreros disponibles'}
                    </label>
                    {isSuggestedMode && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Tocá para marcar como inicio. Usá el switch para incluir/excluir.
                      </p>
                    )}
                  </div>
                  {dismissedPaddockIds.length > 0 && (
                    <span className="text-[10px] font-bold text-gray-400">{dismissedPaddockIds.length} excluido{dismissedPaddockIds.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  {supplyData.map(({ paddock, msHa, areaHa, usableMs, availDays, isSelected }) => {
                    const isActive = paddock.is_active !== false && msHa > 0
                    const isDismissed = dismissedPaddockIds.includes(paddock.id)
                    const isStart = startPaddockId === paddock.id
                    const isChecked = isSuggestedMode ? !isDismissed : isSelected

                    // Indicadores de calidad
                    const relQuality = paddock.technical_data?.relative_quality as number | undefined
                    const hasWaterRisk = paddock.technical_data?.has_water_risk as boolean | undefined
                    const forageQuality = paddock.technical_data?.forage_quality as number | undefined

                    const handleClick = () => {
                      if (!isActive) return
                      if (isSuggestedMode) {
                        if (!isDismissed) setStartPaddockId(p => p === paddock.id ? '' : paddock.id)
                      } else {
                        togglePaddock(paddock.id)
                      }
                    }

                    return (
                      <div key={paddock.id} onClick={handleClick}
                        className={`rounded-xl border transition-all ${
                          !isActive ? 'opacity-40 grayscale pointer-events-none bg-gray-50 border-gray-100' :
                          isDismissed ? 'opacity-50 bg-gray-50 border-dashed border-gray-200' :
                          isSuggestedMode
                            ? (isStart ? 'border-violet-500 bg-violet-50 cursor-pointer shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 cursor-pointer')
                            : (isChecked ? `${accent.chipBg} ${accent.border} cursor-pointer` : 'border-gray-100 bg-white hover:border-gray-200 cursor-pointer')
                        }`}
                      >
                        <div className="flex items-center justify-between px-3 py-2.5">
                          {/* Left */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isSuggestedMode ? (
                              isStart
                                ? <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="white" stroke="white"/></svg>
                                  </div>
                                : <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shrink-0" />
                            ) : (
                              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${isChecked ? `${accent.chip} text-white` : 'border-gray-300'}`}>
                                {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`text-sm font-bold truncate ${isStart || isChecked ? 'text-gray-900' : 'text-gray-500'}`}>{paddock.name}</p>
                                {isSuggestedMode && isStart && <span className="text-[9px] font-black text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-md">Inicio</span>}
                                {isDismissed && <span className="text-[9px] font-bold text-gray-400">Excluido</span>}
                                {hasWaterRisk && (
                                  <span className="flex items-center gap-0.5 text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md">
                                    <Droplets className="w-2.5 h-2.5" />Riesgo hídrico
                                  </span>
                                )}
                                {msHa === 0 && (
                                  <div className="group relative">
                                    <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md cursor-help">
                                      <AlertTriangle className="w-2.5 h-2.5" />Sin MS
                                    </span>
                                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-gray-900 text-white text-[10px] font-medium rounded-lg p-2 shadow-xl z-20">
                                      Sin materia seca declarada no es posible planificar. Actualizá este valor.
                                    </div>
                                  </div>
                                )}
                                {msHa > 0 && availDays <= 0 && (
                                  <div className="group relative">
                                    <span className="flex items-center gap-0.5 text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md cursor-help">
                                      <AlertTriangle className="w-2.5 h-2.5" />Riesgo sobrepastoreo
                                    </span>
                                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-gray-900 text-white text-[10px] font-medium rounded-lg p-2 shadow-xl z-20">
                                      El forraje actual está por debajo del remanente objetivo. No es posible planificar pastoreos.
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">{areaHa.toFixed(1)} ha · {msHa > 0 ? `${msHa.toLocaleString('es')} kg MS/ha` : 'Sin datos MS'}</span>
                                {availDays > 0 && <span className="text-[9px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md">{availDays}d</span>}
                              </div>
                            </div>
                          </div>
                          {/* Right: quality + toggle */}
                          <div className="flex items-center gap-2 shrink-0">
                            {relQuality != null && relQuality > 0 && (
                              <div className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="text-[10px] font-black text-gray-600">{relQuality}/10</span>
                              </div>
                            )}
                            {isActive && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); toggleDismissPaddock(paddock.id, e) }}
                                className={`relative shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none ${isDismissed ? 'bg-gray-200' : 'bg-green-500'}`}
                                title={isDismissed ? 'Habilitar' : 'Deshabilitar'}
                              >
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDismissed ? 'left-0.5' : 'left-[17px]'}`} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {isSuggestedMode && !startPaddockId && (
                  <p className="text-[10px] text-violet-600 font-semibold text-center py-1">
                    Tocá un potrero habilitado para marcarlo como inicio del recorrido.
                  </p>
                )}
              </div>

              {/* Remanente */}
              <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
                <div>
                  <p className={LABEL}>Remanente objetivo</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Biomasa mínima que dejás en el potrero al salir</p>
                </div>
                <Stepper value={targetRemnant} onChange={setTargetRemnant} min={100} max={2000} step={50} unit="kg MS/ha" />
              </div>

              {/* Días de descanso */}
              <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
                <div>
                  <p className={LABEL}>Días de descanso regenerativo</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Tiempo que el potrero descansa entre pastoreos. Ajustá según tu sistema y zona.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Primavera / Verano', value: recoverySpringSum, set: setRecoverySpringSum, min: 20, max: 80, rate: '20–38', months: 'Sep–Feb' },
                    { label: 'Otoño', value: recoveryAutumn, set: setRecoveryAutumn, min: 50, max: 100, rate: '5–18', months: 'Mar–May' },
                    { label: 'Invierno', value: recoveryWinter, set: setRecoveryWinter, min: 80, max: 160, rate: '2–5', months: 'Jun–Ago' },
                  ].map(({ label, value, set, min, max, rate, months }) => (
                    <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                      <div>
                        <p className="text-[10px] font-black text-gray-700 leading-tight">{label}</p>
                        <p className="text-[9px] text-gray-400">{months}</p>
                        <p className="text-[9px] text-green-600 font-bold">~{rate} kg MS/ha/d</p>
                      </div>
                      <Stepper value={value} onChange={set} min={min} max={max} step={5} unit="días" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Reserva de sequía */}
              {(seasonType === 'cerrado' || seasonType === 'ambos') && (() => {
                const suggestedReserveDays = Math.round(seasonDays * 0.15)
                return (
                  <div className="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={LABEL}>Reserva de sequía</p>
                          <div className="group relative">
                            <button type="button" className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-[10px] font-black flex items-center justify-center hover:bg-gray-200 transition-all">?</button>
                            <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-56 bg-gray-900 text-white text-[10px] font-medium rounded-xl p-3 shadow-xl leading-relaxed">
                              Forraje que reservás como colchón ante una sequía u otro evento climático. No se cuenta en la oferta efectiva del plan. Recomendado: 10–20% de los días de temporada.
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">Colchón ante sequía u eventos climáticos adversos</p>
                      </div>
                    </div>
                    {droughtReserveDays === 0 && suggestedReserveDays > 0 && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-blue-700 font-medium flex-1">
                          Sugerido: <span className="font-black">{suggestedReserveDays} días</span> (~15% de los {seasonDays} días del plan)
                        </span>
                        <button type="button"
                          onClick={() => setDroughtReserveDays(suggestedReserveDays)}
                          className="text-[10px] font-black text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded-lg transition-all whitespace-nowrap">
                          Aplicar
                        </button>
                      </div>
                    )}
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
                        placeholder={`Ej: ${suggestedReserveDays}`}
                        className={INPUT}
                      />
                      <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                        {droughtReserveMode === 'days' ? 'días' : droughtReserveMode === 'pct' ? '% del campo' : 'kg MS'}
                      </span>
                      {droughtReserveDays > 0 && <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">≈ {droughtReserveDays} días</span>}
                    </div>
                  </div>
                )
              })()}


              {/* Balance forrajero */}
              {selectedHerdIds.length > 0 && (
                <div className={`border rounded-xl p-4 ${balance.bg} ${balance.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-sm font-black ${balance.text}`}>{balance.label}</p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${balancePct >= 110 ? 'bg-green-500' : balancePct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} />
                      <span className={`text-sm font-black ${balance.text}`}>{balancePct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-4">
                    <div className={`h-full rounded-full transition-all ${balancePct >= 110 ? 'bg-green-500' : balancePct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(balancePct, 100)}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className={`text-sm font-black ${balance.text}`}>{Math.round(ofertaEfectivaKgMs).toLocaleString('es')}</p>
                      <p className="text-[9px] text-gray-500 font-bold">kg MS oferta efectiva</p>
                      <p className="text-[9px] text-gray-400">(stock + crecimiento {seasonDays}d)</p>
                    </div>
                    <div>
                      <p className={`text-sm font-black ${balance.text}`}>{Math.round(demandaTotalKgMs).toLocaleString('es')}</p>
                      <p className="text-[9px] text-gray-500 font-bold">kg MS demanda</p>
                      <p className="text-[9px] text-gray-400">{seasonDays}d · {(currentTotalEV * dailyAllocationKg).toFixed(0)} kg/día</p>
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
            </>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          {/* Error / left */}
          <div>
            {error && (
              <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />{error}
              </p>
            )}
            {!error && step > 1 && (
              <button type="button" onClick={() => {
                import('@/lib/analytics').then(({ event }) => event({ action: 'plan_wizard_step_change', category: 'planner', mode: isSuggestedMode ? 'sugerido' : 'manual', from_step: step, to_step: step - 1 }))
                setStep(s => (s - 1) as any)
              }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
                <ChevronLeft className="w-4 h-4" />Anterior
              </button>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {step === 1 && (
              <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
                Cancelar
              </button>
            )}
            {step < 3 ? (
              <button type="button"
                onClick={() => {
                  import('@/lib/analytics').then(({ event }) => event({ action: 'plan_wizard_step_change', category: 'planner', mode: isSuggestedMode ? 'sugerido' : 'manual', from_step: step, to_step: step + 1 }))
                  setError(null); setStep(s => (s + 1) as any)
                }}
                disabled={step === 1 && !name.trim()}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-black text-white rounded-xl transition-all disabled:opacity-40 ${accent.btn}`}
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSave}
                disabled={saving || !name.trim() || (isSuggestedMode && !startPaddockId)}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-black text-white rounded-xl transition-all disabled:opacity-40 ${accent.btn}`}
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : <><Check className="w-4 h-4" />{isEditing ? 'Actualizar plan' : 'Guardar plan'}</>}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}
