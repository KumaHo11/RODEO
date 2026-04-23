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
  X, Check, Loader2, ChevronDown, ChevronUp,
  Calendar, Leaf, BarChart3, AlertTriangle, TrendingUp,
  Upload, BookOpen, CloudRain, Archive, ArrowRight,
} from 'lucide-react'
import { Plus, Minus, Info, HelpCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/design-system/molecules/Modal'
import { Tooltip } from '@/design-system/atoms/Tooltip'
import { apiFetch } from '@/lib/apiFetch'
import { projectEVDemand, calculateBaseEV, type ParitionSeason } from '@/lib/grazing/evProjection'
import { paddockForageOffer, HARVEST_EFFICIENCY, type HarvestEfficiency, calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'
import { HOLISTIC_TOOLTIPS, UsageRing, HoverTooltip } from '@/components/ui/atoms/UsageRing'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Paddock {
  id: string
  name: string
  area_ha: number
  is_active?: boolean
  dry_matter_kg_ha?: number
  technical_data?: Record<string, any>
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
  season_type: 'cerrado' | 'abierto'
  year: number
  start_date: string
  end_date: string
  no_growth_from: string
  no_growth_to: string
  drought_reserve_days: number
  daily_allocation_kg: number
  cell_name: string
  notes: string
  status: 'draft' | 'active' | 'closed'
  source: 'manual' | 'excel_import'
}

interface Props {
  paddocks: Paddock[]
  herds: Herd[]
  existingPlan?: SeasonPlan | null
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
}: { value: 'cerrado' | 'abierto'; onChange: (v: 'cerrado' | 'abierto') => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['cerrado', 'abierto'] as const).map(type => {
        const sel = value === type
        const label  = type === 'cerrado' ? 'Plan cerrado' : 'Plan abierto'
        const desc   = type === 'cerrado'
          ? 'Otoño/Invierno — el pasto no crece, racionás lo que hay guardado'
          : 'Primavera/Verano — el pasto crece mientras el rodeo pasta'
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border-2 text-left transition-all ${
              sel
                ? 'border-green-500 bg-green-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <p className={`text-xs font-black ${sel ? 'text-green-700' : 'text-gray-700'}`}>{label}</p>
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
  paddocks, herds, existingPlan, onClose, onSaved,
}: Props) {
  const router = useRouter()
  const isEditing = !!existingPlan?.id

  // ── Tab state ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'temporada' | 'rodeo' | 'potreros'>('temporada')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // ── Tab 1: La Temporada ───────────────────────────────────────────
  const [name,               setName]               = useState(existingPlan?.name ?? `Plan ${currentYear}`)
  const [seasonType,         setSeasonType]         = useState<'cerrado' | 'abierto'>(existingPlan?.season_type ?? 'cerrado')
  const [year,               setYear]               = useState<number>(existingPlan?.year ?? currentYear)
  const [startDate,          setStartDate]          = useState(existingPlan?.start_date ?? '')
  const [endDate,            setEndDate]            = useState(existingPlan?.end_date ?? '')
  const [noGrowthFrom,       setNoGrowthFrom]       = useState(existingPlan?.no_growth_from ?? '')
  const [noGrowthTo,         setNoGrowthTo]         = useState(existingPlan?.no_growth_to ?? '')
  const [droughtReserveDays, setDroughtReserveDays] = useState<number>(existingPlan?.drought_reserve_days ?? 0)
  const [dailyAllocationKg,  setDailyAllocationKg]  = useState<number>(existingPlan?.daily_allocation_kg ?? 12)
  const [cellName,           setCellName]           = useState(existingPlan?.cell_name ?? '')
  const [notes,              setNotes]              = useState(existingPlan?.notes ?? '')

  // ── Tab 2: parámetros biológicos ──────────────────────────────────────────
  const [paritionSeason, setParitionSeason] = useState<ParitionSeason>('otono')
  const [targetRemnant, setTargetRemnant]   = useState<number>(existingPlan ? (existingPlan as any).target_remnant_kg_ha ?? 600 : 600)
  // Per-paddock remnant overrides (paddock.id -> kg MS/ha)
  const [paddockRemnants, setPaddockRemnants] = useState<Record<string, number>>(() => ({}))
  const getPaddockRemnant = (paddockId: string) =>
    paddockRemnants[paddockId] !== undefined ? paddockRemnants[paddockId] : targetRemnant
  // Paddock multi-selection — inicializa con todos los potreros activos
  const [selectedPaddockIds, setSelectedPaddockIds] = useState<string[]>(() => 
    paddocks.map(p => p.id) // Select all paddocks by default
  )
  const togglePaddock = (id: string) =>
    setSelectedPaddockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const selectedPaddocks = paddocks.filter(p => selectedPaddockIds.includes(p.id))

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
      setStartDate(`${year}-05-15`)
      setEndDate(`${year}-09-15`)
      setNoGrowthFrom(`${year}-06-01`)
      setNoGrowthTo(`${year}-08-31`)
    } else {
      setStartDate(`${year}-09-16`)
      setEndDate(`${year + 1}-05-14`)
      setNoGrowthFrom('')
      setNoGrowthTo('')
    }
  }, [seasonType, year, isEditing])

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
    
    // Garantizamos la lectura correcta de la demanda EV usando la proyección real (evita problemas de EV null en base de datos)
    const baseTotalEV = projectedEVByMonth.length > 0 ? projectedEVByMonth[0].totalEV : 0

    // Filtramos para cálculos globales pero mostramos todos en la lista
    return sortedPaddocks.map(p => {
      const isSelected = selectedPaddockIds.includes(p.id)
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

      // We calculate usableMs as a static photograph (Initial MS - Remnant) * Area
      const usableKgMs = calculateUsableForage(msHa, remnant, areaHa)
      const dailyDemand = baseTotalEV * dailyAllocationKg
      const availDays = calculateGrazingDays(usableKgMs, dailyDemand)

      return { paddock: p, msHa, areaHa, totalMs: totalKgMs, usableMs: isSelected ? usableKgMs : 0, growthKgMs, stockKgMs, availDays, remnant, isSelected }
    })
  }, [sortedPaddocks, selectedPaddockIds, projectedEVByMonth, dailyAllocationKg, targetRemnant, paddockRemnants, startDate, seasonDays])

  // Balance global
  const totalOfertaKgMs  = supplyData.filter(d => d.isSelected).reduce((s, d) => s + d.usableMs, 0)
  const currentTotalEV   = projectedEVByMonth.length > 0 ? projectedEVByMonth[0].totalEV : 0
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

    const metrics = {
      balance_pct: balancePct,
      oferta_kg_ms: totalOfertaKgMs,
      demanda_kg_ms: demandaTotalKgMs,
      season_days: seasonDays,
      balance_label: balance.label,
    }

    const payload = {
      name: name.trim(), season_type: seasonType,
      year, start_date: startDate || null, end_date: endDate || null,
      no_growth_from: noGrowthFrom || null, no_growth_to: noGrowthTo || null,
      drought_reserve_days: droughtReserveDays,
      daily_allocation_kg: dailyAllocationKg,
      target_remnant_kg_ha: targetRemnant,
      cell_name: cellName.trim() || null,
      source: 'manual', status: 'draft',
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
      onSaved({ ...payload, id: data.id } as SeasonPlan)
      onClose()
    } catch (e: any) {
      setError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [
    name, seasonType, year, startDate, endDate,
    noGrowthFrom, noGrowthTo, droughtReserveDays, dailyAllocationKg,
    cellName, notes,
    isEditing, existingPlan, onSaved, onClose,
    currentTotalEV, projectedEVByMonth, supplyData,
    totalOfertaKgMs, demandaTotalKgMs, balancePct, seasonDays, balance,
  ])

  const TABS = [
    { id: 'temporada', label: 'La Temporada', icon: Calendar },
    { id: 'rodeo',     label: 'El Rodeo',     icon: TrendingUp },
    { id: 'potreros',  label: 'Los Potreros', icon: BarChart3  },
  ] as const

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-black text-gray-950">
                {isEditing ? name : 'Planificación sugerida'}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                {isEditing ? `Editando · Temporada ${year}` : 'Plan forrajero por temporada'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 shrink-0 px-2 pt-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center py-2.5 text-[11px] font-black tracking-wide rounded-t-lg transition-all border-b-2 uppercase ${
                tab === id
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════ TAB 1 — LA TEMPORADA ════ */}
          {tab === 'temporada' && (
            <div className="px-6 py-5 space-y-5">

              {/* 1. Tipo de plan — primero */}
              <FieldRow
                label="Tipo de temporada"
                tooltip="Cerrado = invierno, racionás pasto guardado. Abierto = primavera/verano, el pasto crece mientras el rodeo come."
              >
                <SeasonTypeSelector value={seasonType} onChange={setSeasonType} />
              </FieldRow>

              {/* 2. Nombre del plan */}
              <FieldRow label="Nombre del plan *" tooltip="Dale un nombre descriptivo: año, tipo y módulo. Ej: Plan Cerrado 2025 · El Solito">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Plan Cerrado 2025 · El Solito"
                  className={INPUT}
                  autoFocus
                />
              </FieldRow>

              {/* 3. Año */}
              <FieldRow label="Año" tooltip="El año de referencia del plan. Queda guardado en el histórico para comparar temporadas.">
                <input
                  type="number"
                  value={year}
                  min={2000}
                  max={2100}
                  onChange={e => setYear(Number(e.target.value))}
                  className={INPUT}
                />
              </FieldRow>

              {/* Fechas de temporada */}
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Inicio de temporada" tooltip="¿Cuándo empezás a aplicar este plan? Ej: 1 de abril.">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT} />
                </FieldRow>
                <FieldRow label="Fin de temporada" tooltip="¿Hasta cuándo corre este plan? Ej: 30 de septiembre.">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT} />
                </FieldRow>
              </div>

              {/* Estación sin crecimiento */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Estación sin crecimiento</p>
                  <Tooltip text="Los meses de invierno donde el pasto deja de crecer. Como cuando la cocina cierra: el pasto que hay es todo el que habrá hasta la primavera." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Desde">
                    <input type="date" value={noGrowthFrom} onChange={e => setNoGrowthFrom(e.target.value)} className={INPUT} />
                  </FieldRow>
                  <FieldRow label="Hasta">
                    <input type="date" value={noGrowthTo} onChange={e => setNoGrowthTo(e.target.value)} className={INPUT} />
                  </FieldRow>
                </div>
              </div>

              {/* Reserva de sequía */}
              <FieldRow
                label="Reserva de sequía (días)"
                tooltip="Pasto intocable de emergencia, como un fondo de ahorro. Si no llueve en verano, tenés estos días de respaldo. Valor típico: 15–30 días."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={droughtReserveDays}
                    min={0}
                    max={180}
                    onChange={e => setDroughtReserveDays(Number(e.target.value))}
                    className={`${INPUT} w-28`}
                  />
                  <p className="text-xs text-gray-400 font-medium">
                    {droughtReserveDays === 0 ? 'Sin reserva definida' : `${droughtReserveDays} días de forraje de emergencia`}
                  </p>
                </div>
              </FieldRow>

              {/* Célula / módulo */}
              <FieldRow
                label="Nombre del módulo / célula"
                tooltip="Grupo específico de potreros que se planifican juntos. Útil si tu campo tiene distintas unidades de manejo. Ej: 'El Solito', 'Módulo Norte'."
              >
                <input
                  type="text"
                  value={cellName}
                  onChange={e => setCellName(e.target.value)}
                  placeholder="Ej: Módulo Norte, El Solito…"
                  className={INPUT}
                />
              </FieldRow>

              {/* Notas */}
              <FieldRow label="Observaciones del plan">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas generales de la temporada, condiciones iniciales, objetivos…"
                  className={`${INPUT} resize-none`}
                />
              </FieldRow>

            </div>
          )}

          {/* ════ TAB 2 — EL RODEO ════ */}
          {tab === 'rodeo' && (
            <div className="px-6 py-5 space-y-5">

              {/* Selección de Rodeos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className={LABEL}>Rodeos incluidos en el plan</label>
                    <Tooltip text="Seleccioná qué rodeos querés planificar. El plan calculará la demanda solo de los rodeos tildados." />
                  </div>
                  {selectedHerdIds.length > 0 && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      {selectedHerdIds.length} seleccionado{selectedHerdIds.length > 1 ? 's' : ''} · {currentTotalEV.toFixed(0)} EV
                    </span>
                  )}
                </div>
                {herds.length === 0 ? (
                  <div className="py-8 text-center bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-sm font-bold text-gray-400">No hay rodeos cargados.</p>
                    <p className="text-xs text-gray-500 mt-1">Cargá tus rodeos en la sección <Link href="/dashboard/herds" className="text-gray-600 hover:text-green-600 underline underline-offset-2">Rodeos</Link> primero.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {herds.map(h => {
                      const isSelected = selectedHerdIds.includes(h.id)
                      const hevBase = Number(h.total_ev) > 0 ? Number(h.total_ev)
                        : calculateBaseEV(h.categoria, Number(h.avg_weight_kg) || 450, Number(h.head_count))
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => toggleHerd(h.id)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isSelected
                              ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                              : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                            }
                            <div>
                              <p className="text-sm font-bold text-gray-900">{h.name}</p>
                              <p className="text-[10px] text-gray-400">{h.head_count} cab · {h.categoria ?? 'N/D'}</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-gray-600 shrink-0">{hevBase.toFixed(0)} EV</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

               {/* Estación de parición — oculta hasta validar su impacto en el cálculo
              <FieldRow
                label="Estación de parición"
                tooltip="El estado fenológico (lactancia, gestación, seca) cambia el requerimiento energético de cada animal mes a mes. Una vaca en lactancia temprana consume hasta un 40% más."
              >
                <div className="grid grid-cols-2 gap-2">
                  {PARITION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setParitionSeason(opt.value)}
                      className={`flex flex-col items-start px-3 py-2 rounded-xl border-2 text-left transition-all ${
                        paritionSeason === opt.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-xs font-black ${paritionSeason === opt.value ? 'text-green-700' : 'text-gray-700'}`}>{opt.label}</p>
                      <p className="text-[9px] text-gray-400 font-medium leading-snug mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </FieldRow>
              */}


              {/* Ración diaria — Motor Holístico (pertenece al Rodeo) */}
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Ración diaria por EV</p>
                  <Tooltip text="Cuánta comida seca le das a cada Equivalente Vaca por día. 10–11: déficit. 12–13: normal. 14–15: abundante. Este valor afecta la demanda diaria y los días disponibles por potrero." />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={dailyAllocationKg}
                    min={6}
                    max={25}
                    step={0.5}
                    onChange={e => setDailyAllocationKg(Number(e.target.value))}
                    className={`${INPUT} w-28`}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">kg MS / EV / día</span>
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                      dailyAllocationKg <= 11 ? 'bg-red-50 text-red-600'
                      : dailyAllocationKg <= 13 ? 'bg-green-100 text-green-700'
                      : 'bg-blue-50 text-blue-600'
                    }`}>
                      {dailyAllocationKg <= 11 ? 'Déficit' : dailyAllocationKg <= 13 ? 'Normal' : 'Abundante'}
                    </div>
                  </div>
                </div>
              </div>

              {/* EV + Demanda diaria — resumen */}
              {/* EV + Demanda diaria — resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3.5">
                  <p className={LABEL + ' mb-1'}>Animales</p>
                  <p className="text-xl font-black text-gray-900">
                    {selectedHerds.reduce((s, h) => s + (h.head_count || 0), 0)}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">cabezas</span>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3.5">
                  <div className="flex items-center gap-1 mb-1">
                    <p className={LABEL}>Carga (EV)</p>
                    <HoverTooltip text="Equivalente Vaca. Ajustado por categoría biológica y peso. (Ej. 350 cabezas pueden ser 372 EV).">
                      <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                    </HoverTooltip>
                  </div>
                  <p className="text-xl font-black text-gray-900">
                    {currentTotalEV.toFixed(0)}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">EV</span>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3.5">
                  <p className={LABEL + ' mb-1'}>Demanda diaria</p>
                  <p className="text-xl font-black text-gray-900">
                    {(currentTotalEV * dailyAllocationKg).toFixed(0)}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">kg MS/día</span>
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ════ TAB 3 — LOS POTREROS ════ */}
          {tab === 'potreros' && (
            <div className="px-6 py-5 space-y-5">

              {/* Balance global */}
              <div className={`p-4 rounded-xl border ${balance.bg} ${balance.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className={`text-xs font-black ${balance.text}`}>{balance.label}</p>
                      <p className="text-[10px] text-gray-500 font-medium">
                        Oferta vs Demanda — {seasonDays} días de temporada
                      </p>
                    </div>
                  </div>
                  <div className={`text-2xl font-black ${balance.text}`}>
                    {balancePct}%
                    <Tooltip text="Porcentaje de uso: cuánto del pasto disponible va a consumir tu hacienda. Ideal: 80–110%. Más alto = peligro de quedarte sin pasto. Más bajo = estás sobreestimando." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white/60 rounded-lg px-3 py-2">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${balance.text}`}>Oferta total</p>
                    <p className="text-sm font-black text-gray-900">
                      {(totalOfertaKgMs / 1000).toFixed(1)} t MS
                    </p>
                  </div>
                  <div className="bg-white/60 rounded-lg px-3 py-2">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${balance.text}`}>Demanda total</p>
                    <p className="text-sm font-black text-gray-900">
                      {(demandaTotalKgMs / 1000).toFixed(1)} t MS
                    </p>
                  </div>
                </div>
                {/* Link a Insights cuando hay déficit */}
                {balancePct < 80 && (
                  <button
                    onClick={() => { onClose(); router.push('/dashboard/insights') }}
                    className="mt-3 text-xs font-bold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
                  >
                    Ver sugerencias
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>


              {/* Lista de potreros */}
                {paddocks.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-gray-400">No hay potreros con datos de biomasa.</p>
                  <p className="text-xs text-gray-300 mt-1">Completá el campo "MS disponible" en cada potrero.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Remanente global + por potrero */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Remanente objetivo</p>
                      <Tooltip text="Piso mínimo de pasto que dejás en el potrero al salir. Protege el suelo y asegura el rebrote. Podés fijarlo igual para todos o variarlo potrero a potrero." />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step={50}
                        min={0}
                        value={targetRemnant}
                        onChange={e => {
                          setTargetRemnant(Number(e.target.value))
                          // Limpiar overrides para que hereden el nuevo default
                          setPaddockRemnants({})
                        }}
                        className={`${INPUT} w-28`}
                      />
                      <span className="text-xs text-gray-500 font-medium">kg MS/ha para todos los potreros</span>
                      {Object.keys(paddockRemnants).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaddockRemnants({})}
                          className="text-[10px] text-blue-600 font-bold hover:underline ml-auto"
                        >
                          Resetear todos
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className={LABEL}>Oferta por potrero</label>
                    <Tooltip text={`Pasto aprovechable = (kg MS/ha − remanente) × ha. El remanente por defecto es ${targetRemnant} kg/ha pero podés cambiarlo potrero a potrero.`} />
                  </div>
                  {supplyData.map(({ paddock, msHa, areaHa, usableMs, availDays, remnant, isSelected }) => {
                    const hasData = msHa > 0
                    const isRisky = hasData && msHa <= remnant
                    const paddockRemnantVal = paddockRemnants[paddock.id] !== undefined ? paddockRemnants[paddock.id] : targetRemnant
                    const isActive = paddock.is_active !== false

                    // ── Holistic Metrics ──
                    const moduleAvg = supplyData.filter(d => d.msHa > 0).length > 0
                      ? supplyData.filter(d => d.msHa > 0).reduce((s, d) => s + d.msHa, 0)
                        / supplyData.filter(d => d.msHa > 0).length
                      : 0
                    const yieldCoef = moduleAvg > 0 && msHa > 0 ? msHa / moduleAvg : null
                    const usagePct = seasonDays > 0 && availDays >= 0
                      ? Math.round((availDays / Math.max(1, seasonDays)) * 100)
                      : null

                    return (
                      <div 
                        key={paddock.id} 
                        onClick={() => isActive && togglePaddock(paddock.id)}
                        className={`rounded-xl border px-4 py-3 transition-all ${
                          !isActive ? 'opacity-40 grayscale pointer-events-none bg-gray-50 border-gray-100' :
                          isSelected ? (isRisky ? 'bg-red-50 border-red-300 ring-1 ring-red-100 cursor-pointer' : 'bg-white border-green-500 shadow-sm ring-1 ring-green-100 cursor-pointer') :
                          'bg-gray-50 border-gray-100 hover:border-gray-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {isSelected
                              ? <div className="w-4 h-4 bg-green-600 rounded-md flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" strokeWidth={4} /></div>
                              : <div className="w-4 h-4 rounded-md border-2 border-gray-300 bg-white shrink-0" />
                            }
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-black ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>{paddock.name}</p>
                              {!isActive && <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">Inhabilitado</span>}
                              {isRisky && (
                                <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Sin pasto aprovechable</span>
                              )}
                              {yieldCoef !== null && !isRisky && (
                                  <HoverTooltip text={HOLISTIC_TOOLTIPS.yieldCoef}>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border cursor-help ${
                                      yieldCoef >= 1.05 ? 'text-green-700 bg-green-50 border-green-100'
                                      : yieldCoef >= 0.95 ? 'text-gray-600 bg-white border-gray-200'
                                      : 'text-amber-700 bg-amber-50 border-amber-100'
                                    }`}>×{yieldCoef.toFixed(2)}</span>
                                  </HoverTooltip>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2" title="Superficie del potrero (hectáreas)">
                            <span className="text-[10px] font-bold text-gray-400">{areaHa.toFixed(1)} ha</span>
                          </div>
                        </div>
                        {hasData ? (
                          <>
                            <div className="grid grid-cols-4 gap-2 mb-2 items-stretch">
                              <HoverTooltip text="Biomasa disponible actual por hectárea" className="w-full">
                                <div className="bg-white rounded-lg border border-gray-200 px-1.5 py-1.5 text-center h-full flex flex-col justify-center">
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest cursor-help mb-0.5">Disponible</p>
                                  <p className="text-xs font-black text-gray-800">
                                    {msHa.toLocaleString('es')} <span className="text-[9px] font-semibold text-gray-500">kg/ha</span>
                                  </p>
                                </div>
                              </HoverTooltip>
                              
                              <HoverTooltip text="Stock de materia seca total (Disponible - Remanente) x Hectáreas" className="w-full">
                                <div className="bg-white rounded-lg border border-gray-200 px-1.5 py-1.5 text-center h-full flex flex-col justify-center">
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-dashed border-gray-300 inline-block mb-0.5 cursor-help">Aprovechable</p>
                                  <p className="text-xs font-black text-gray-800">
                                    {(Math.max(0, msHa - remnant) * areaHa) > 0 ? (
                                      <>
                                        {Math.round(Math.max(0, msHa - remnant) * areaHa).toLocaleString('es')} <span className="text-[9px] font-semibold text-gray-500">kg</span>
                                      </>
                                    ) : <span className="text-red-500">—</span>}
                                  </p>
                                </div>
                              </HoverTooltip>
                              
                              <HoverTooltip text={HOLISTIC_TOOLTIPS.estimatedDah} className="w-full">
                                <div className={`bg-white rounded-lg border px-1.5 py-1.5 text-center h-full flex flex-col justify-center ${
                                  !hasData || isRisky ? 'border-red-200 bg-red-50' : 'border-gray-200'
                                }`}>
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest cursor-help mb-0.5">Días DAH</p>
                                  <p className={`text-xs font-black ${
                                    isRisky ? 'text-red-600' : 'text-gray-800'
                                  }`}>{availDays > 0 ? availDays : '0'}</p>
                                </div>
                              </HoverTooltip>
                              
                              <HoverTooltip text={HOLISTIC_TOOLTIPS.usagePct} className="w-full">
                                <div className={`bg-white rounded-lg border px-1.5 py-1.5 flex flex-col items-center justify-center h-full ${
                                  !hasData || isRisky ? 'border-red-200 bg-red-50' : 'border-gray-200'
                                }`}>
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest cursor-help mb-0.5">% Uso</p>
                                  {usagePct !== null ? <UsageRing usagePct={usagePct} size="sm" showLabel={false} /> : <span className="text-red-500">—</span>}
                                </div>
                              </HoverTooltip>
                            </div>
                            {/* Remanente por potrero */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-gray-400 font-bold shrink-0">Remanente específico:</span>
                              <input
                                type="number"
                                step={50}
                                min={0}
                                value={paddockRemnantVal}
                                onChange={e => {
                                  e.stopPropagation()
                                  setPaddockRemnants(prev => ({ ...prev, [paddock.id]: Number(e.target.value) }))
                                }}
                                onClick={e => e.stopPropagation()}
                                className="w-20 text-xs font-bold bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-700 text-center outline-none focus:border-green-400"
                              />
                              <span className="text-[9px] text-gray-400">kg MS/ha</span>
                              {paddockRemnants[paddock.id] !== undefined && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPaddockRemnants(prev => { const n = { ...prev }; delete n[paddock.id]; return n })
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-gray-600 font-bold"
                                >
                                  ↺ usar global
                                </button>
                              )}
                            </div>
                            {isRisky && (
                              <p className="text-[9px] text-red-600 font-bold mt-1">
                                ⚠️ El pasto disponible ({msHa} kg/ha) no supera el remanente ({remnant} kg/ha). Agregar animales en este potrero es riesgoso.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-gray-300 italic">Sin datos de biomasa — completá en el potrero</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Nota sobre histórico */}
              <div className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <Archive className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                  Al guardar, este plan queda registrado en el <strong>histórico de temporadas</strong> de tu campo.
                  En el futuro, usaremos estos datos para ayudarte a comparar años y tomar mejores decisiones.
                </p>
              </div>

            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {error && (
            <p className="text-xs font-bold text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />{error}
            </p>
          )}
          {!error && <span />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-black text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all disabled:opacity-40"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                : <><Check className="w-4 h-4" /> {isEditing ? 'Actualizar plan' : 'Guardar plan'}</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
