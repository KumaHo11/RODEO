'use client'

/**
 * HerdModal — Modal unificado Alta y Edición de Rodeos.
 * Tabs: Datos operativos · Actividades · Registros y agenda.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  X, Check, Loader2, Plus, Minus, ChevronDown, ChevronUp,
  Calendar, Hash, Scale, Clock, ClipboardList,
  TrendingDown, TrendingUp, Baby, ShoppingCart,
  AlertTriangle, BookOpen, CalendarDays, Info, Edit3,
  Camera, Mic, MicOff, MessageSquarePlus, ChevronRight, Users,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '@/lib/apiFetch'
import { CatCombobox, BreedCombobox } from '@/components/HerdComboboxes'
import {
  CATEGORIA_PESO_DEFAULT,
  RAZAS_POR_CATEGORIA, CATEGORIA_COLORS, CATEGORIA_LABEL_RAE,
  CATEGORIA_REF,
  type CategoriaComercial,
} from '@/lib/categorias'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HerdData {
  id?: string
  name: string
  species: string
  categoria: string | null
  breed: string | null
  head_count: number
  avg_weight_kg: number | null
  age_years: number | null
  age_months: number | null
  admission_date: string | null
  total_ev: number | null
  bcs_score: number | null
  parent_herd_id: string | null
  herd_notes: any[]
  created_at?: string
}

interface Props {
  herd?: HerdData | null
  allHerds?: HerdData[]
  onClose: () => void
  onSaved: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split('T')[0] }

function calcEV(catKey: string | null, weight: number, count: number): number {
  const FACTORS: Record<string, number> = {
    NOVILLOS: 1.0, NOVILLITOS: 0.9, VAQUILLONAS: 0.9,
    TERNEROS: 0.6, TERNERAS: 0.55, VACAS: 1.0, TOROS: 1.25, MEJ: 0.9, BUBALINOS: 1.1,
  }
  const f = catKey ? (FACTORS[catKey] ?? 1.0) : 1.0
  return parseFloat((Math.pow((weight || 400) / 400, 0.75) * f * count).toFixed(2))
}

function bcsColorClass(s: number) {
  if (s <= 3) return 'bg-red-500'
  if (s <= 5) return 'bg-amber-400'
  if (s <= 7) return 'bg-lime-500'
  return 'bg-green-600'
}
function bcsLabel(s: number) {
  if (s <= 2) return 'Muy bajo'
  if (s <= 4) return 'Bajo'
  if (s <= 6) return 'Moderado'
  if (s <= 8) return 'Bueno'
  return 'Óptimo'
}

// Event type dots palette
const EVENT_TYPES_QUICK = [
  { id: 'tratamiento_sanitario', label: 'Tratamiento sanitario', color: 'bg-blue-500' },
  { id: 'servicio',              label: 'Servicio',              color: 'bg-purple-500' },
  { id: 'paricion',              label: 'Parición',              color: 'bg-green-500' },
  { id: 'destete',               label: 'Destete',              color: 'bg-violet-500' },
  { id: 'diagnostico_prenez',    label: 'Diagnóstico de preñez', color: 'bg-teal-500' },
]

const LABEL = 'text-[10px] font-black text-gray-500 tracking-widest uppercase'
const INPUT  = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all'
const TEXTAREA = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none transition-all'

// ── Activity options — uniform grid layout ─────────────────────────────────────

const ACTIVITIES = [
  { id: 'paricion',  label: 'Parición',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   icon: Baby },
  { id: 'compra',    label: 'Compra',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  icon: ShoppingCart },
  { id: 'mortandad', label: 'Mortandad', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    icon: TrendingDown },
  { id: 'venta',     label: 'Venta',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  icon: TrendingUp },
  { id: 'destete',   label: 'Destete',   color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', icon: Baby },
]
const ACTIVITY_ADDS   = new Set(['paricion', 'compra'])
type ActivityId = 'paricion' | 'compra' | 'mortandad' | 'venta' | 'destete'

// ── SpeechRecognition hook ────────────────────────────────────────────────────

function useSpeech(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'es-AR'; rec.continuous = false; rec.interimResults = false
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      onResult(t)
    }
    rec.onend = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [listening, onResult])

  return { listening, toggle }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function HerdModal({ herd, allHerds = [], onClose, onSaved }: Props) {
  const isEditing = !!herd?.id

  const [tab, setTab] = useState<'operativo' | 'actividades' | 'registros'>('operativo')

  // ── Tab 1: Datos operativos ───────────────────────────────────────────────
  const initCatKey = useMemo<CategoriaComercial | null>(() => {
    if (!herd?.categoria) return 'TERNEROS'
    return Object.keys(CATEGORIA_LABEL_RAE).includes(herd.categoria)
      ? herd.categoria as CategoriaComercial : null
  }, [herd])

  const [catLabel,      setCatLabel]      = useState(herd?.categoria ? (CATEGORIA_LABEL_RAE[herd.categoria as CategoriaComercial] ?? herd.categoria) : CATEGORIA_LABEL_RAE['TERNEROS']!)
  const [catKey,        setCatKey]        = useState<CategoriaComercial | null>(initCatKey)
  const [name,          setName]          = useState(herd?.name ?? '')
  const [admissionDate, setAdmissionDate] = useState(herd?.admission_date ?? todayISO())
  const [count,         setCount]         = useState<number | ''>(herd?.head_count ?? '')
  const [weight,        setWeight]        = useState<number | ''>(herd?.avg_weight_kg ?? '')
  const [ageValue,      setAgeValue]      = useState<number | ''>('')
  const [ageUnit,       setAgeUnit]       = useState<'months' | 'years'>('months')
  const [breed,         setBreed]         = useState(herd?.breed ?? '')

  useEffect(() => {
    if (herd?.age_months) { setAgeValue(herd.age_months); setAgeUnit('months') }
    else if (herd?.age_years) { setAgeValue(herd.age_years); setAgeUnit('years') }
  }, [herd])

  useEffect(() => {
    if (!isEditing && catKey && !weight) setWeight(CATEGORIA_PESO_DEFAULT[catKey] ?? '')
  }, [catKey, isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  const availableBreeds = useMemo(() => catKey ? (RAZAS_POR_CATEGORIA[catKey] ?? ['Otra']) : ['Otra'], [catKey])
  const currentRef = catKey ? CATEGORIA_REF[catKey] : undefined
  const ageMonths  = ageValue !== '' ? (ageUnit === 'years' ? Number(ageValue) * 12 : Number(ageValue)) : null
  const liveEV     = useMemo(() => count && weight ? calcEV(catKey, Number(weight), Number(count)) : 0, [catKey, weight, count])

  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const canSave = !!name.trim() && Number(count) > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true); setSaveError(null)
    const payload = {
      name: name.trim(), species: catLabel || catKey || 'vacas',
      categoria: catKey, breed: breed.trim() || null,
      head_count: Number(count),
      avg_weight_kg: weight !== '' ? Number(weight) : null,
      age_months: ageMonths,
      age_years: ageUnit === 'years' && ageValue !== '' ? Number(ageValue) : null,
      admission_date: admissionDate || null,
      total_ev: liveEV || null,
    }
    try {
      let res: Response
      if (isEditing) {
        res = await apiFetch(`/api/herds/${herd.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        res = await apiFetch('/api/herds', { method: 'POST', body: JSON.stringify(payload) })
      }
      if (!res.ok) {
        let msg = `Error ${res.status}`
        try { const j = await res.json(); msg = j.error ?? msg } catch {}
        setSaveError(msg); return
      }
      onSaved(); onClose()
    } catch (e: any) {
      setSaveError('Error de red: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Tab 2: Actividades ────────────────────────────────────────────────────
  const [actId,      setActId]      = useState<ActivityId | null>(null)
  const [actCount,   setActCount]   = useState<number | ''>(1)
  const [actNote,    setActNote]    = useState('')
  const [actSaving,  setActSaving]  = useState(false)
  const [actSuccess, setActSuccess] = useState<string | null>(null)
  const [actError,   setActError]   = useState<string | null>(null)
  const [weanLoading, setWeanLoading] = useState(false)
  const [weanSuccess, setWeanSuccess] = useState(false)

  const handleActivity = async () => {
    if (!actId || !actCount || !herd?.id) return
    setActSaving(true); setActError(null)
    const n     = Number(actCount)
    const isAdd = ACTIVITY_ADDS.has(actId)
    try {
      const newCount = isAdd
        ? (herd.head_count || 0) + n
        : Math.max((herd.head_count || 0) - n, 0)

      // Recalculate EV with updated head count
      const newEV = calcEV(catKey, Number(herd.avg_weight_kg || weight || 400), newCount)

      const patchRes = await apiFetch(`/api/herds/${herd.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ head_count: newCount, total_ev: newEV }),
      })
      if (!patchRes.ok) throw new Error('No se pudo actualizar el stock')

      await apiFetch('/api/farm-events', {
        method: 'POST',
        body: JSON.stringify({
          title: `${actId.charAt(0).toUpperCase() + actId.slice(1)}: ${n} cab. · ${herd.name}`,
          event_type: actId === 'paricion' ? 'paricion' : actId === 'destete' ? 'destete' : 'servicio',
          event_date: todayISO(),
          herd_id: herd.id, herd_ids: [herd.id],
          description: actNote || null, status: 'pendiente',
        }),
      })

      // Destete: auto-create child herd
      if (actId === 'destete' && n > 0) {
        setActSaving(false)
        setWeanLoading(true)
        const childEV = calcEV('TERNEROS', 180, n) // peso referencia ternero destetado
        const childRes = await apiFetch('/api/herds', {
          method: 'POST',
          body: JSON.stringify({
            name: `Terneros · ${herd.name}`,
            species: 'terneros',
            categoria: 'TERNEROS',
            breed: herd.breed || null,
            head_count: n,
            avg_weight_kg: 180,
            total_ev: childEV,
            parent_herd_id: herd.id,
          }),
        })
        setWeanLoading(false)
        if (childRes.ok) {
          setWeanSuccess(true)
          setTimeout(() => setWeanSuccess(false), 5000)
        }
      }

      setActSuccess(`${isAdd ? '+' : '-'}${n} cabezas · EV actualizado a ${newEV.toFixed(2)}`)
      setActCount(1); setActNote(''); setActId(null)
      setTimeout(() => setActSuccess(null), 3500)
      onSaved()
    } catch (e: any) {
      setActError('Error: ' + e.message)
    } finally {
      setActSaving(false)
    }
  }

  // ── Tab 3: Registros ──────────────────────────────────────────────────────
  const [bcsScore,      setBcsScore]      = useState(herd?.bcs_score ?? 5)
  const [bcsSaving,     setBcsSaving]     = useState(false)
  const [bcsSaved,      setBcsSaved]      = useState(false)
  const [showNote,      setShowNote]      = useState(false)
  const [quickNote,     setQuickNote]     = useState('')
  const [noteSaving,    setNoteSaving]    = useState(false)
  const [noteSaved,     setNoteSaved]     = useState(false)
  const [agendaEvents,  setAgendaEvents]  = useState<any[]>([])
  const [evLoading,     setEvLoading]     = useState(false)
  const [showAllEvents, setShowAllEvents] = useState(false)

  // Team members for assignee selector
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  // New event form
  const [newEvType,    setNewEvType]    = useState('tratamiento_sanitario')
  const [newEvTitle,   setNewEvTitle]   = useState('')
  const [newEvDate,    setNewEvDate]    = useState(todayISO())
  const [newEvEndDate, setNewEvEndDate] = useState('')
  const [newEvDesc,    setNewEvDesc]    = useState('')
  const [newEvAssignee,setNewEvAssignee]= useState('')
  const [evSaving,     setEvSaving]     = useState(false)
  const [evSaved,      setEvSaved]      = useState(false)

  const { listening: micOn, toggle: toggleMic } = useSpeech(text => {
    setNewEvTitle(prev => (prev ? prev + ' ' + text : text))
  })

  const loadData = useCallback(async () => {
    if (!herd?.id) return
    setEvLoading(true)
    const [evRes, teamRes] = await Promise.all([
      apiFetch('/api/farm-events'),
      apiFetch('/api/team'),
    ])
    if (evRes.ok) {
      const { events } = await evRes.json()
      setAgendaEvents(
        (events || []).filter((e: any) =>
          (Array.isArray(e.herd_ids) ? e.herd_ids : []).includes(herd.id!) || e.herd_id === herd.id
        ).sort((a: any, b: any) => b.event_date?.localeCompare(a.event_date))
      )
    }
    if (teamRes.ok) {
      const { members } = await teamRes.json()
      setTeamMembers(members || [])
    }
    setEvLoading(false)
  }, [herd?.id])

  useEffect(() => { if (tab === 'registros') loadData() }, [tab, loadData])

  const saveBcs = async () => {
    if (!herd?.id) return
    setBcsSaving(true)
    const res = await apiFetch(`/api/herds/${herd.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ bcs_score: bcsScore, bcs_label: bcsLabel(bcsScore) }),
    })
    setBcsSaving(false)
    if (res.ok) { setBcsSaved(true); setTimeout(() => setBcsSaved(false), 3000) }
  }

  const saveNote = async () => {
    if (!quickNote.trim() || !herd?.id) return
    setNoteSaving(true)
    // Store as a herd note event
    await apiFetch('/api/farm-events', {
      method: 'POST',
      body: JSON.stringify({
        title: `Nota: ${quickNote.trim().slice(0, 60)}`,
        event_type: 'servicio',
        event_date: todayISO(),
        herd_id: herd.id, herd_ids: [herd.id],
        description: quickNote.trim(), status: 'completado',
      }),
    })
    setNoteSaving(false); setNoteSaved(true); setQuickNote('')
    setTimeout(() => setNoteSaved(false), 3000)
    loadData()
  }

  const saveEvent = async () => {
    if (!newEvTitle.trim() || !herd?.id) return
    setEvSaving(true)
    await apiFetch('/api/farm-events', {
      method: 'POST',
      body: JSON.stringify({
        title: newEvTitle.trim(),
        event_type: newEvType,
        event_date: newEvDate,
        end_date: newEvEndDate || null,
        description: newEvDesc.trim() || null,
        herd_id: herd.id, herd_ids: [herd.id],
        status: 'pendiente',
        assigned_to: newEvAssignee || null,
      }),
    })
    setEvSaving(false); setEvSaved(true)
    setNewEvTitle(''); setNewEvDate(todayISO()); setNewEvEndDate(''); setNewEvDesc(''); setNewEvAssignee('')
    setTimeout(() => setEvSaved(false), 3000)
    loadData()
  }

  // Visible events
  const visibleEvents = showAllEvents ? agendaEvents.slice(0, 10) : agendaEvents.slice(0, 2)
  const hiddenCount   = agendaEvents.length - 2

  const catColors  = catKey ? CATEGORIA_COLORS[catKey] : null
  const displayCat = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : catLabel

  const TABS = [
    { id: 'operativo',   label: 'Datos operativos' },
    { id: 'actividades', label: 'Actividades' },
    { id: 'registros',   label: 'Registros' },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {catColors && (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${catColors.bg}`}>
                <span className={`text-xs font-black ${catColors.text}`}>{displayCat.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-gray-950">
                {isEditing ? herd.name : 'Nuevo rodeo'}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                {isEditing ? `${herd.head_count} cabezas · ${displayCat}` : 'Alta de rodeo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                <Edit3 className="w-3 h-3" /> Editando
              </span>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0 px-2 pt-2">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-[11px] font-black tracking-wide rounded-t-lg transition-all border-b-2 uppercase ${
                tab === id
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ════ TAB 1 — DATOS OPERATIVOS ════ */}
          {tab === 'operativo' && (
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className={LABEL}>Categoría comercial</label>
                <CatCombobox value={catLabel} onChange={(lbl, key) => { setCatLabel(lbl); setCatKey(key) }} />
                {catKey === null && catLabel.trim() && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" /> Categoría personalizada — sin cotización del Mercado de Cañuelas
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className={LABEL}>Nombre del rodeo *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Recría Norte, Vientres 2024..." className={INPUT} autoFocus={!isEditing} />
              </div>

              <div className="space-y-1.5">
                <label className={`${LABEL} flex items-center gap-1.5`}>
                  <Calendar className="w-3 h-3 text-gray-400" /> Fecha de ingreso
                </label>
                <input type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} className={INPUT} />
                <p className="text-[10px] text-gray-400 italic">Fecha oficial de alta del rodeo</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`${LABEL} flex items-center gap-1.5`}><Hash className="w-3 h-3 text-gray-400" /> Stock</label>
                  <input type="number" min="1" value={count}
                    onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Cabezas" className={INPUT} />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>Raza</label>
                  <BreedCombobox value={breed} onChange={setBreed} breeds={availableBreeds} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`${LABEL} flex items-center gap-1.5`}><Scale className="w-3 h-3 text-gray-400" /> Peso promedio (kg)</label>
                <input type="number" min="0" value={weight}
                  onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={currentRef ? `Ej: ${currentRef.hintPeso}` : 'Ej: 300'} className={INPUT} />
                {currentRef && (
                  <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" /> Referencia: {currentRef.hintPeso}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className={`${LABEL} flex items-center gap-1.5`}><Clock className="w-3 h-3 text-gray-400" /> Edad</label>
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 bg-gray-100 rounded-lg p-0.5">
                    {(['months', 'years'] as const).map(u => (
                      <button key={u} type="button" onClick={() => setAgeUnit(u)}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${ageUnit === u ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {u === 'months' ? 'Meses' : 'Años'}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="0" step={ageUnit === 'years' ? 0.5 : 1}
                    value={ageValue}
                    onChange={e => setAgeValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={ageUnit === 'months' ? 'Ej: 8' : 'Ej: 2'} className={`flex-1 ${INPUT}`} />
                </div>
                {currentRef && (
                  <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" /> Referencia: {currentRef.hintEdad}
                  </p>
                )}
              </div>

              {liveEV > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-100">
                  <ClipboardList className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-green-600 tracking-widest uppercase">Equ. vaca (EV)</p>
                    <p className="text-xl font-black text-gray-900">{liveEV.toFixed(2)} <span className="text-xs font-normal text-gray-400">EV · {Math.round(liveEV * 11)} kg MS/día</span></p>
                  </div>
                </div>
              )}

              {saveError && (
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{saveError}</p>
              )}
            </div>
          )}

          {/* ════ TAB 2 — ACTIVIDADES ════ */}
          {tab === 'actividades' && (
            <div className="px-6 py-5 space-y-5">
              {!isEditing ? (
                <div className="py-10 text-center">
                  <Baby className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-400">Guardá primero el rodeo para registrar actividades</p>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="sync">
                    {actSuccess && (
                      <motion.div key="act-success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-sm font-bold text-green-700">{actSuccess}</p>
                      </motion.div>
                    )}
                    {weanSuccess && (
                      <motion.div key="wean-success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                        <Baby className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-sm font-bold text-green-700">✓ Rodeo de terneros destetados creado automáticamente</p>
                      </motion.div>
                    )}
                    {actError && (
                      <motion.div key="act-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-sm font-bold text-red-600">{actError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Current stock */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Stock actual</p>
                      <p className="text-xl font-black text-gray-900">{herd.head_count} <span className="text-xs font-normal text-gray-400">cabezas</span></p>
                    </div>
                  </div>

                  {/* Uniform 2+3 activity grid */}
                  <div className="space-y-2">
                    <p className={`${LABEL} flex items-center gap-1.5`}><Plus className="w-3 h-3 text-green-600" /> Suma</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ACTIVITIES.filter(a => ACTIVITY_ADDS.has(a.id)).map(a => {
                        const Icon = a.icon
                        const sel  = actId === a.id
                        return (
                          <button key={a.id} type="button" onClick={() => setActId(sel ? null : a.id as ActivityId)}
                            className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border text-xs font-bold transition-all ${sel ? `${a.bg} ${a.color} ${a.border}` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                            <span className={`w-2 h-2 rounded-full ${sel ? a.dot : 'bg-gray-300'}`} />
                            <Icon className="w-5 h-5" />
                            {a.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className={`${LABEL} flex items-center gap-1.5`}><Minus className="w-3 h-3 text-red-500" /> Resta</p>
                    <div className="grid grid-cols-3 gap-2">
                      {ACTIVITIES.filter(a => !ACTIVITY_ADDS.has(a.id)).map(a => {
                        const Icon = a.icon
                        const sel  = actId === a.id
                        return (
                          <button key={a.id} type="button" onClick={() => setActId(sel ? null : a.id as ActivityId)}
                            className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border text-xs font-bold transition-all ${sel ? `${a.bg} ${a.color} ${a.border}` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                            <span className={`w-2 h-2 rounded-full ${sel ? a.dot : 'bg-gray-300'}`} />
                            <Icon className="w-5 h-5" />
                            {a.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Activity detail form */}
                  <AnimatePresence>
                    {actId && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3 border border-gray-200 rounded-xl px-4 py-4">
                        {actId === 'destete' && (
                          <div className="flex items-start gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl">
                            <Info className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-violet-700 font-medium">
                              Se creará automáticamente un rodeo de terneros destetados con los datos heredados.
                            </p>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className={LABEL}>Cantidad de cabezas</label>
                          <input type="number" min="1" value={actCount}
                            onChange={e => setActCount(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={LABEL}>Nota (opcional)</label>
                          <input type="text" value={actNote} onChange={e => setActNote(e.target.value)}
                            placeholder="Ej: Compra en remate feria..." className={INPUT} />
                        </div>
                        <button type="button" onClick={handleActivity} disabled={actSaving || weanLoading || !actCount}
                          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl text-sm transition-all disabled:opacity-40">
                          {(actSaving || weanLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Confirmar {actId}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}

          {/* ════ TAB 3 — REGISTROS ════ */}
          {tab === 'registros' && (
            <div className="px-6 py-5 space-y-5">

              {/* BCS */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={LABEL}>Condición corporal (BCS)</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 italic">Estimado general del rodeo — escala 1–9</p>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg text-white whitespace-nowrap ${bcsColorClass(bcsScore)}`}>
                    {bcsScore}/9 · {bcsLabel(bcsScore)}
                  </span>
                </div>

                <div className="relative pt-1">
                  <div className="w-full h-2.5 rounded-full bg-gradient-to-r from-red-400 via-amber-400 via-lime-400 to-green-600" />
                  <input type="range" min={1} max={9} step={1} value={bcsScore}
                    onChange={e => setBcsScore(Number(e.target.value))}
                    className="w-full cursor-pointer absolute top-0 opacity-0 h-2.5" />
                  <div className={`absolute top-0 w-4 h-4 rounded-full border-2 border-white shadow-md -translate-y-[3px] -translate-x-1/2 transition-all ${bcsColorClass(bcsScore)}`}
                    style={{ left: `${((bcsScore - 1) / 8) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-black text-gray-400 tracking-widest">{[1,2,3,4,5,6,7,8,9].map(n => <span key={n}>{n}</span>)}</div>

                {/* BCS save + photo */}
                <div className="flex gap-2">
                  <button type="button" onClick={saveBcs} disabled={bcsSaving}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-2.5 rounded-xl text-xs transition-all disabled:opacity-40">
                    {bcsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : bcsSaved ? <Check className="w-3.5 h-3.5" /> : null}
                    {bcsSaved ? 'Guardado' : 'Guardar BCS'}
                  </button>
                  <label className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs cursor-pointer transition-all">
                    <Camera className="w-4 h-4" /> Foto
                    <input type="file" accept="image/*" capture="environment" className="hidden" />
                  </label>
                </div>
              </div>

              {/* Note — hidden by default */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <button type="button" onClick={() => setShowNote(v => !v)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-700 transition-colors font-medium">
                  <MessageSquarePlus className="w-4 h-4 text-gray-400" />
                  ¿Agregar descripción adicional?
                  {showNote ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {showNote && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3">
                      <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} rows={3}
                        placeholder="Observaciones sobre el rodeo..." className={TEXTAREA} />
                      <button type="button" onClick={saveNote} disabled={noteSaving || !quickNote.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black py-2.5 rounded-xl text-xs transition-all disabled:opacity-40">
                        {noteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : noteSaved ? <Check className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {noteSaved ? 'Nota guardada' : 'Guardar nota'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* New event */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className={`${LABEL} flex items-center gap-1.5`}><CalendarDays className="w-3 h-3 text-gray-400" /> Nueva tarea / evento</p>

                {/* Event type — colored dots */}
                <div className="grid grid-cols-2 gap-1.5">
                  {EVENT_TYPES_QUICK.map(t => (
                    <button key={t.id} type="button" onClick={() => setNewEvType(t.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                        newEvType === t.id
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                      }`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${t.color}`} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Title + mic */}
                <div className="relative">
                  <input type="text" value={newEvTitle} onChange={e => setNewEvTitle(e.target.value)}
                    placeholder="Título del evento..." className={`${INPUT} pr-10`} />
                  <button type="button" onClick={toggleMic}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-all ${micOn ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                    {micOn ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className={`${LABEL}`}>Fecha inicio</label>
                    <input type="date" value={newEvDate} onChange={e => setNewEvDate(e.target.value)} className={INPUT} />
                  </div>
                  <div className="space-y-1">
                    <label className={`${LABEL}`}>Fecha fin (opc.)</label>
                    <input type="date" value={newEvEndDate} onChange={e => setNewEvEndDate(e.target.value)} className={INPUT} />
                  </div>
                </div>

                {/* Description */}
                <textarea value={newEvDesc} onChange={e => setNewEvDesc(e.target.value)} rows={2}
                  placeholder="Descripción del evento (opcional)..." className={TEXTAREA} />

                {/* Assignee */}
                {teamMembers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className={`${LABEL} flex items-center gap-1.5`}><Users className="w-3 h-3 text-gray-400" /> Asignar a</label>
                    <select value={newEvAssignee} onChange={e => setNewEvAssignee(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
                      <option value="">Sin asignar</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.first_name ?? ''} {m.last_name ?? ''} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="button" onClick={saveEvent} disabled={evSaving || !newEvTitle.trim()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 font-black py-2.5 rounded-xl text-sm hover:bg-green-50 transition-all disabled:opacity-40">
                  {evSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : evSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {evSaved ? 'Evento creado' : 'Agregar a la Agenda'}
                </button>
              </div>

              {/* Events list */}
              {evLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
              ) : agendaEvents.length > 0 ? (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <p className={LABEL}>Eventos vinculados</p>
                  <div className={`space-y-2 ${showAllEvents && agendaEvents.length > 10 ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                    {visibleEvents.map(ev => {
                      const dot = EVENT_TYPES_QUICK.find(t => t.id === ev.event_type)?.color ?? 'bg-gray-400'
                      return (
                        <div key={ev.id} className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{ev.title}</p>
                            <p className="text-[10px] text-gray-400">{ev.event_date}{ev.end_date ? ` → ${ev.end_date}` : ''} · {ev.event_type}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {hiddenCount > 0 && !showAllEvents && (
                    <button type="button" onClick={() => setShowAllEvents(true)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-700 py-2 rounded-xl hover:bg-green-50 transition-all border border-dashed border-gray-200">
                      <ChevronRight className="w-3.5 h-3.5" /> Ver {hiddenCount} evento{hiddenCount !== 1 ? 's' : ''} más
                    </button>
                  )}
                  {showAllEvents && agendaEvents.length > 2 && (
                    <button type="button" onClick={() => setShowAllEvents(false)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-all">
                      <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos
                    </button>
                  )}
                </div>
              ) : isEditing ? (
                <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-100 pt-4">Sin eventos vinculados a este rodeo</p>
              ) : null}

            </div>
          )}
        </div>

        {/* Footer — Tab 1 save */}
        {tab === 'operativo' && (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !canSave}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isEditing ? 'Actualizar' : 'Crear rodeo'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
