'use client'

/**
 * HerdModal — Modal unificado Alta y Edición de Rodeos.
 * Tabs: Datos operativos · Actividades · Registros y agenda.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Check, Loader2, Plus, Minus, ChevronDown, ChevronUp,
  Calendar, Hash, Scale, Clock, ClipboardList, Leaf,
  TrendingDown, TrendingUp, Baby, ShoppingCart,
  AlertTriangle, BookOpen, CalendarDays, Info, Edit3,
  Camera, Mic, MicOff, MessageSquarePlus, ChevronRight, Users, Trash2, Search, FileText, Image as ImageIcon, Filter, Activity, Target, Stethoscope, Scissors, CheckCircle2, Lock, Paperclip, Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '@/lib/apiFetch'
import { CatCombobox, BreedCombobox } from '@/components/HerdComboboxes'
import { Tooltip } from '@/design-system/atoms/Tooltip'
import {
  CATEGORIA_PESO_DEFAULT,
  RAZAS_POR_CATEGORIA, CATEGORIA_COLORS, CATEGORIA_LABEL_RAE,
  CATEGORIA_REF,
  type CategoriaComercial,
} from '@/lib/categorias'
import { usePlan } from '@/hooks/usePlan'
import { calculateBaseEV, calculateProjectedEV, PHYSIOLOGICAL_CATEGORIES, PHYSIO_LABEL, PHYSIO_EV_BASE, GROWTH_PHYSIO_CATEGORIES, type PhysiologicalCategory } from '@/lib/grazing/evProjection'
import { calcularEVRodeo, LACTANCIA_RANGES, ESTADIOS_GESTACION, RATION_SUGERIDA_POR_CATEGORIA, type LactanciaRange, type EstadioGestacion } from '@/lib/grazing/evMatrix'
import { todayISO } from '@/lib/utils/dates'
import GrowthProjectionChart from '@/components/GrowthProjectionChart'
import WeaningWizard from '@/components/WeaningWizard'
import { PhysioEVPanel, type PhysioEVPanelValue } from '@/components/PhysioEVPanel'

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
  exit_date?: string | null
  total_ev: number | null
  bcs_score: number | null
  parent_herd_id: string | null
  herd_notes: any[]
  created_at?: string
  // v8: Physiological fields
  physiological_category?: string | null
  last_weigh_date?: string | null
  daily_gain_kg?: number | null
  // v9: EV Matrix fields
  lactancia_range?: string | null
  estadio_gestacion?: string | null
  custom_racion_kg?: number | null
  // v10: Lote de Manejo fields
  grupo_manejo_id?: string | null
  grupo_manejo_nombre?: string | null
}

interface Props {
  herd?: HerdData | null
  allHerds?: HerdData[]
  isTemporary?: boolean
  onClose: () => void
  onSaved: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// calculateBaseEV importado desde lib/grazing/evProjection
// todayISO importado desde lib/utils/dates

async function compressImage(file: File, maxDim = 1200): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim }
        else if (height > maxDim) { width *= maxDim / height; height = maxDim }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() }))
          else resolve(file)
        }, 'image/jpeg', 0.7)
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

function bcsLabel(s: number) {
  if (s <= 1) return 'Muy baja'
  if (s <= 2) return 'Baja'
  if (s <= 3) return 'Óptima'
  if (s <= 4) return 'Alta'
  return 'Muy alta'
}

// Event type dots palette
const EVENT_TYPES_QUICK = [
  { id: 'tratamiento_sanitario', label: 'Tratamiento sanitario', color: 'bg-blue-500' },
  { id: 'servicio',              label: 'Servicio',              color: 'bg-purple-500' },
  { id: 'paricion',              label: 'Parición',              color: 'bg-green-500' },
  { id: 'destete',               label: 'Destete',              color: 'bg-emerald-500' },
  { id: 'diagnostico_prenez',    label: 'Diagnóstico de preñez', color: 'bg-teal-500' },
]

const LABEL = 'text-[10px] font-black text-gray-700 tracking-widest uppercase'
const INPUT  = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-base md:text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all'
const TEXTAREA = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-base md:text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none transition-all'

// ── Activity options — uniform grid layout ─────────────────────────────────────

const ACTIVITIES = [
  { id: 'paricion',  label: 'Parición',  desc: 'Incorpora crías nacidas en el rodeo',       type: 'entrada', icon: Plus  },
  { id: 'compra',    label: 'Compra',    desc: 'Ingreso de animales por compra o traslado',  type: 'entrada', icon: Plus  },
  { id: 'mortandad', label: 'Mortandad', desc: 'Bajas por muerte, descarte o causas ajenas', type: 'salida',  icon: Minus },
  { id: 'venta',     label: 'Venta',     desc: 'Egreso de animales por venta o faena',       type: 'salida',  icon: Minus },
  { id: 'destete',   label: 'Destete',   desc: 'Segregación de terneros con asistencia EV',  type: 'salida',  icon: Minus },
]
const ACTIVITY_ADDS   = new Set(['paricion', 'compra'])
type ActivityId = 'paricion' | 'compra' | 'mortandad' | 'venta' | 'destete'

// Categorías que NO tienen Parición ni Destete (terneros, novillos, toros)
const ACTIVIDADES_EXCLUIDAS: Record<string, Set<string>> = {
  paricion: new Set([
    'TERNERO', 'RECRIA_NOVILLO', 'RECRIA_VAQUILLONA', 'TORO',          // fisiológica
    'TERNEROS', 'TERNERAS', 'NOVILLOS', 'NOVILLITOS', 'TOROS', 'TORITOS' // comercial
  ]),
  destete: new Set([
    'TERNERO', 'RECRIA_NOVILLO', 'RECRIA_VAQUILLONA', 'TORO',
    'TERNEROS', 'TERNERAS', 'NOVILLOS', 'NOVILLITOS', 'TOROS', 'TORITOS'
  ]),
}

// ── SpeechRecognition hook ────────────────────────────────────────────────────

function useSpeech(onResult: (t: string) => void, onStart?: () => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return }
    if (listening) { recRef.current?.stop(); return }
    if (onStart) onStart()
    const rec = new SR()
    rec.lang = 'es-AR'; rec.continuous = true; rec.interimResults = true
    rec.onresult = (e: any) => {
      let full = ''
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript
      }
      onResult(full)
    }
    rec.onend = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [listening, onResult, onStart])

  return { listening, toggle }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function HerdModal({ herd, allHerds = [], isTemporary = false, onClose, onSaved }: Props) {
  const { hasFeature } = usePlan()
  const canVoice     = hasFeature('voice_bitacora')
  const isEditing = !!herd?.id

  const [tab, setTab] = useState<'operativo' | 'actividades' | 'registros' | 'historial'>('operativo')

  // liveHerd: copia local del herd que se actualiza optimistamente tras cada actividad.
  // Esto evita que el modal muestre datos obsoletos mientras el padre refetcha.
  const [liveHerd, setLiveHerd] = useState(herd)

  // Sync liveHerd when the parent re-passes a fresh herd prop (after onSaved refetch)
  useEffect(() => { if (herd) setLiveHerd(herd) }, [herd])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── Tab 1: Datos operativos ───────────────────────────────────────────────
  const initCatKey = useMemo<CategoriaComercial | null>(() => {
    if (!herd?.categoria) return 'TERNEROS'
    return Object.keys(CATEGORIA_LABEL_RAE).includes(herd.categoria)
      ? herd.categoria as CategoriaComercial : null
  }, [herd])

  const [catLabel,      setCatLabel]      = useState(herd?.categoria ? (CATEGORIA_LABEL_RAE[herd.categoria as CategoriaComercial] ?? herd.categoria) : CATEGORIA_LABEL_RAE['TERNEROS']!)
  const [catKey,        setCatKey]        = useState<CategoriaComercial | null>(initCatKey)
  const [name,          setName]          = useState(herd?.name ?? '')
  // admission_date: always store as 'YYYY-MM-DD' or empty string (never null in input)
  const [admissionDate, setAdmissionDate] = useState<string>(
    herd?.admission_date ? String(herd.admission_date).slice(0, 10) : todayISO()
  )
  const [count,         setCount]         = useState<number | ''>(herd?.head_count ?? '')
  const [weight,        setWeight]        = useState<number | ''>(herd?.avg_weight_kg != null ? Math.round(Number(herd.avg_weight_kg)) : '')
  const [ageValue,      setAgeValue]      = useState<number | ''>('')
  const [ageUnit,       setAgeUnit]       = useState<'months' | 'years'>('months')
  const [breed,         setBreed]         = useState(herd?.breed ?? '')
  const [exitDate,      setExitDate]      = useState<string>(
    herd?.exit_date ? String(herd.exit_date).slice(0, 10) : ''
  )

  // ── v9: Panel fisiológico unificado (PhysioEVPanel state) ──────────────────
  const [physioPanel, setPhysioPanel] = useState<PhysioEVPanelValue>({
    physioCategory: (herd?.physiological_category as PhysiologicalCategory | undefined) ?? '',
    pesoKg: herd?.avg_weight_kg != null ? Math.round(Number(herd.avg_weight_kg)) : '',
    adpvKgDay: herd?.daily_gain_kg != null ? Number(herd.daily_gain_kg) : '',
    lactanciaRange: (herd?.lactancia_range as LactanciaRange | undefined) ?? '',
    estadioGestacion: (herd?.estadio_gestacion as EstadioGestacion | undefined) ?? '',
    lastWeighDate: herd?.last_weigh_date ? String(herd.last_weigh_date).slice(0, 10) : '',
    customRacionKgDia: herd?.custom_racion_kg != null ? Number(herd.custom_racion_kg) : null,
  })

  // Alias de compatibilidad con código existente (destete, parición, etc.)
  const physioCategory = physioPanel.physioCategory as PhysiologicalCategory | ''
  const lastWeighDate  = physioPanel.lastWeighDate
  const dailyGainKg   = physioPanel.adpvKgDay
  const setPhysioCategory = (cat: PhysiologicalCategory | '') =>
    setPhysioPanel(prev => ({ ...prev, physioCategory: cat }))
  const setLastWeighDate  = (d: string) =>
    setPhysioPanel(prev => ({ ...prev, lastWeighDate: d }))
  const setDailyGainKg    = (v: number | '') =>
    setPhysioPanel(prev => ({ ...prev, adpvKgDay: v }))

  const gdpRequired = physioCategory !== '' && GROWTH_PHYSIO_CATEGORIES.has(physioCategory as PhysiologicalCategory)
  const gdpEnabled  = physioCategory !== '' && physioCategory !== 'VACA_CON_TERNERO'

  useEffect(() => {
    if (herd?.age_months) { setAgeValue(herd.age_months); setAgeUnit('months') }
    else if (herd?.age_years) { setAgeValue(herd.age_years); setAgeUnit('years') }
  }, [herd])

  useEffect(() => {
    if (!isEditing && catKey && !weight) setWeight(CATEGORIA_PESO_DEFAULT[catKey] ?? '')
  }, [catKey, isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  // GDP defaults inteligentes por categoría fisiológica
  useEffect(() => {
    if (physioCategory === '') return
    if (GROWTH_PHYSIO_CATEGORIES.has(physioCategory as PhysiologicalCategory)) {
      // Ternero/Recría: GDP default 0.500 kg/día (crecimiento activo)
      if (dailyGainKg === '' || dailyGainKg === 0) setDailyGainKg(0.5)
    } else if (physioCategory === 'VACA_CON_TERNERO') {
      // La madre mantiene peso — GDP = 0 (crecimiento medido en la cría)
      setDailyGainKg(0)
    }
    // VACA_PRENADA / VACA_VACIA: no pisar si el usuario ya cargó un valor
  }, [physioCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  const availableBreeds = useMemo(() => catKey ? (RAZAS_POR_CATEGORIA[catKey] ?? ['Otra']) : ['Otra'], [catKey])
  const currentRef = catKey ? CATEGORIA_REF[catKey] : undefined
  const ageMonths  = ageValue !== '' ? (ageUnit === 'years' ? Number(ageValue) * 12 : Number(ageValue)) : null

  /**
   * effectiveEV — EV del recuadro de resultados
   *
   * Prioridad:
   * 1. Categoría fisiológica + peso → tablas Cocimano (calcularEVRodeo)
   * 2. Categoría fisiológica sin peso → PHYSIO_EV_BASE × cabezas (legacy)
   * 3. Sin categoría fisiológica → calculateBaseEV por peso/categoría comercial
   */
  const effectiveEV = useMemo(() => {
    if (!count || Number(count) <= 0) return 0
    const n = Number(count)

    if (physioCategory && physioPanel.pesoKg && Number(physioPanel.pesoKg) > 0) {
      // Ruta Cocimano — EV exacto
      const result = calcularEVRodeo(
        {
          categoria: physioCategory,
          pesoKg: Number(physioPanel.pesoKg),
          adpvKgDay: Number(physioPanel.adpvKgDay) || 0,
          lactanciaRange: (physioPanel.lactanciaRange as LactanciaRange) || null,
          estadioGestacion: (physioPanel.estadioGestacion as EstadioGestacion) || null,
        },
        n,
        physioPanel.customRacionKgDia,
      )
      return result.evTotal
    }

    if (physioCategory) {
      // Fallback legacy: EV_base fisiológico × cabezas
      const evBase = PHYSIO_EV_BASE[physioCategory as PhysiologicalCategory] ?? 1.0
      return parseFloat((evBase * n).toFixed(2))
    }

    // Fallback comercial: fórmula INTA por peso
    return count && weight ? calculateBaseEV(catKey, Number(weight), n) : 0
  }, [physioCategory, physioPanel, count, catKey, weight])

  // liveEV es alias de effectiveEV para compatibilidad con el payload de save
  const liveEV = effectiveEV

  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const canSave = !!name.trim() && Number(count) > 0 && (!isTemporary || !!exitDate)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true); setSaveError(null)
    const payload = {
      name: name.trim(), species: catLabel || catKey || 'vacas',
      categoria: catKey, breed: breed.trim() || null,
      head_count: Number(count),
      avg_weight_kg: physioPanel.pesoKg !== '' ? Number(physioPanel.pesoKg) : (weight !== '' ? Number(weight) : null),
      age_months: ageMonths,
      age_years: ageUnit === 'years' && ageValue !== '' ? Number(ageValue) : null,
      // Only send date if it's a valid YYYY-MM-DD string
      admission_date: admissionDate && admissionDate.length === 10 ? admissionDate : null,
      exit_date: exitDate && exitDate.length === 10 ? exitDate : null,
      total_ev: liveEV || null,
      // v8: Physiological fields
      physiological_category: physioPanel.physioCategory || null,
      last_weigh_date: physioPanel.lastWeighDate && physioPanel.lastWeighDate.length === 10 ? physioPanel.lastWeighDate : null,
      daily_gain_kg: physioPanel.adpvKgDay !== '' ? Number(physioPanel.adpvKgDay) : null,
      // v9: EV Matrix fields
      lactancia_range: physioPanel.lactanciaRange || null,
      estadio_gestacion: physioPanel.estadioGestacion || null,
      custom_racion_kg: physioPanel.customRacionKgDia ?? null,
    }
    try {
      if (!navigator.onLine && isEditing) {
        const { addToOfflineQueue } = await import('@/components/OfflineIndicator')
        addToOfflineQueue({
          type: 'herd_update',
          data: { herd_id: herd.id, ...payload },
          timestamp: Date.now(),
        } as any)
        import('sonner').then(({ toast }) => toast.success('Rodeo guardado offline. Se sincronizará al conectar.'))
        onSaved(); onClose()
        return
      }

      let res: Response
      if (isEditing) {
        res = await apiFetch(`/api/herds/${herd.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        if (!navigator.onLine) {
           setSaveError('No podés crear nuevos rodeos sin conexión.')
           return
        }
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
  const [actWeight,  setActWeight]  = useState<number | ''>('')   // peso de animales que ENTRAN
  const [actDate,    setActDate]    = useState<string>(todayISO())
  const [actNote,    setActNote]    = useState('')
  const [actSaving,  setActSaving]  = useState(false)
  const [actSuccess, setActSuccess] = useState<string | null>(null)
  const [actError,   setActError]   = useState<string | null>(null)
  const [weanLoading, setWeanLoading] = useState(false)
  const [weanSuccess, setWeanSuccess] = useState(false)
  // Wizard de Destete (overlay — kept for legacy fallback)
  const [weaningWizardOpen, setWeaningWizardOpen] = useState(false)

  // ── Destete inline state ─────────────────────────────────────────────────
  const [weanDestination,  setWeanDestination]  = useState<'new' | 'existing'>('new')
  const [weanNewHerdName,  setWeanNewHerdName]  = useState('')
  const [weanTargetHerdId, setWeanTargetHerdId] = useState('')
  const [weanCalfWeight,   setWeanCalfWeight]   = useState<number | ''>(160)
  const [weanCalfGdp,      setWeanCalfGdp]      = useState<number | ''>(0.55)

  // Modal de confirmación de destete (nuevo — v8 fix)
  const [weaningConfirmOpen,  setWeaningConfirmOpen]  = useState(false)
  const [weanMothersOutcome,  setWeanMothersOutcome]  = useState<'partial' | 'total'>('partial')

  // Rodeos existentes aptos para recibir terneros
  const weanTargetHerds = useMemo(() =>
    allHerds.filter(h =>
      h.id !== herd?.id &&
      (h.physiological_category === 'TERNERO' || h.physiological_category === 'RECRIA_NOVILLO' ||
       h.categoria === 'TERNEROS' || h.categoria === 'TERNERAS' || h.categoria === 'NOVILLITOS')
    ),
    [allHerds, herd?.id]
  )

  // ── Parición Wizard state ──────────────────────────────────────────────────
  const [paricionMadres,       setParicionMadres]       = useState<number | ''>('')
  const [paricionCrias,        setParicionCrias]        = useState<number | ''>('')
  const [paricionFecha,        setParicionFecha]        = useState<string>(todayISO())
  const [paricionPesoCrias,    setParicionPesoCrias]    = useState<number | ''>(35)
  const [paricionDestino,      setParicionDestino]      = useState<'new' | 'existing'>('new')
  const [paricionNombreNuevo,  setParicionNombreNuevo]  = useState<string>('')
  const [paricionHerdDestinoId, setParicionHerdDestinoId] = useState<string>('')

  // Rodeos VACA_CON_TERNERO existentes (para transferir el lote parido)
  const paricionRodeosDestino = useMemo(() =>
    allHerds.filter(h =>
      h.id !== herd?.id &&
      h.physiological_category === 'VACA_CON_TERNERO'
    ),
    [allHerds, herd?.id]
  )

  // Destino de las vacas cuyos terneros murieron al nacer (VACA_VACIA)
  const [paricionVacasVaciasDestino, setParicionVacasVaciasDestino] = useState<'new' | 'existing' | 'skip'>('existing')
  const [paricionVacasVaciasNombre,  setParicionVacasVaciasNombre]  = useState<string>('')
  const [paricionVacasVaciasHerdId,  setParicionVacasVaciasHerdId]  = useState<string>('')

  // Rodeos VACA_VACIA existentes (destino de las pérdidas al nacer)
  const paricionRodeosVaciaDestino = useMemo(() =>
    allHerds.filter(h =>
      h.id !== herd?.id &&
      (h.physiological_category === 'VACA_VACIA' || h.physiological_category === 'VACA_SECA')
    ),
    [allHerds, herd?.id]
  )

  // Vacas cuya cría murió al nacer (diferencia madres - crías vivas)
  const paricionBajasAlNacer = useMemo(() => {
    const m = Number(paricionMadres) || 0
    const c = paricionCrias !== '' ? Number(paricionCrias) : m
    return Math.max(0, m - c)
  }, [paricionMadres, paricionCrias])

  // ¿Mostrar el wizard completo de parición?
  const isParicionWizard = (
    liveHerd?.physiological_category === 'VACA_PRENADA' ||
    herd?.physiological_category === 'VACA_PRENADA'
  )

  // Actividades visibles según la categoría del rodeo actual
  const activePhysio  = liveHerd?.physiological_category ?? herd?.physiological_category ?? ''
  const activeComCat  = liveHerd?.categoria ?? herd?.categoria ?? catKey ?? ''
  const visibleActivities = useMemo(() =>
    ACTIVITIES.filter(a => {
      const excl = ACTIVIDADES_EXCLUIDAS[a.id]
      if (!excl) return true
      return !excl.has(activePhysio as string) && !excl.has(activeComCat as string)
    }),
    [activePhysio, activeComCat]  // eslint-disable-line react-hooks/exhaustive-deps
  )

  // EV live preview del destete (crías)
  const weanCalvesEV = useMemo(() => {
    const w = weanCalfWeight !== '' ? Number(weanCalfWeight) : 160
    const n = actCount !== '' ? Number(actCount) : 0
    return calculateProjectedEV('TERNERO', w, n)
  }, [weanCalfWeight, actCount])



  // ── Parición Wizard: handler completo ───────────────────────────────────────
  const handleParicion = async () => {
    if (!herd?.id || !paricionMadres) return
    if (paricionDestino === 'new' && !paricionNombreNuevo.trim()) return
    if (paricionDestino === 'existing' && !paricionHerdDestinoId) return

    setActSaving(true); setActError(null)
    const n = Number(paricionMadres)
    const currentCount = liveHerd?.head_count ?? herd.head_count ?? 0
    const newCount = Math.max(0, currentCount - n)
    const newEV = parseFloat((newCount * (PHYSIO_EV_BASE['VACA_PRENADA'] ?? 1.2)).toFixed(2))
    const destinoEV = parseFloat((n * (PHYSIO_EV_BASE['VACA_CON_TERNERO'] ?? 1.35)).toFixed(2))

    // Crías VIVAS = paricionCrias (puede diferir de madres por mellizos o bajas)
    const criasVivas  = paricionCrias !== '' ? Math.max(0, Number(paricionCrias)) : n
    const bajasNacer  = Math.max(0, n - criasVivas)
    // EV para el lote de vacas con ternero (basado en crías vivas = madres que sí tienen ternero)
    const destinoEVActual = parseFloat((criasVivas * (PHYSIO_EV_BASE['VACA_CON_TERNERO'] ?? 1.35)).toFixed(2))
    const vaciaEV   = parseFloat((bajasNacer * (PHYSIO_EV_BASE['VACA_VACIA'] ?? 0.80)).toFixed(2))

    try {
      // Determinar el grupo_manejo_id del lote:
      // Si el rodeo original ya tiene uno, lo reutilizamos;
      // si no, creamos uno nuevo vía /api/herds/group para que sean del mismo lote.
      let grupoId: string = herd.grupo_manejo_id ?? ''
      const grupoNombre = herd.grupo_manejo_nombre || herd.name
      if (!grupoId) {
        const grpRes = await apiFetch('/api/herds/group', {
          method: 'PATCH',
          body: JSON.stringify({
            herd_ids: [herd.id],
            grupo_manejo_nombre: grupoNombre,
            action: 'group',
          }),
        })
        if (grpRes.ok) {
          const grpData = await grpRes.json()
          grupoId = grpData.grupo_manejo_id ?? ''
        }
      }

      // 1. Descontar madres paridas del rodeo original (sigue siendo VACA_PRENADA)
      const patchRes = await apiFetch(`/api/herds/${herd.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ head_count: newCount, total_ev: newEV }),
      })
      if (!patchRes.ok) throw new Error('No se pudo actualizar el rodeo original')

      // 2. Lote VACA_CON_TERNERO — usar criasVivas (no madresParidas)
      if (paricionDestino === 'new') {
        const postRes = await apiFetch('/api/herds', {
          method: 'POST',
          body: JSON.stringify({
            name: paricionNombreNuevo.trim(),
            species: herd.species || 'vacas',
            categoria: herd.categoria || 'VACAS',
            breed: herd.breed || null,
            head_count: criasVivas,
            avg_weight_kg: herd.avg_weight_kg ?? null,
            physiological_category: 'VACA_CON_TERNERO',
            total_ev: destinoEVActual,
            admission_date: paricionFecha && paricionFecha.length === 10 ? paricionFecha : null,
            // v10: Asignar al mismo Lote de Manejo que el rodeo original
            grupo_manejo_id: grupoId || null,
            grupo_manejo_nombre: grupoNombre,
          }),
        })
        if (!postRes.ok) throw new Error('No se pudo crear el rodeo de paridas')
      } else {
        const targetHerd = paricionRodeosDestino.find(h => h.id === paricionHerdDestinoId)
        const targetCount = (targetHerd?.head_count ?? 0) + criasVivas
        const targetEV = parseFloat((targetCount * (PHYSIO_EV_BASE['VACA_CON_TERNERO'] ?? 1.35)).toFixed(2))
        const patchTargetRes = await apiFetch(`/api/herds/${paricionHerdDestinoId}`, {
          method: 'PATCH',
          body: JSON.stringify({ head_count: targetCount, total_ev: targetEV }),
        })
        if (!patchTargetRes.ok) throw new Error('No se pudo actualizar el rodeo destino')
      }

      // 3. Vacas cuyo ternero murió al nacer → VACA_VACIA (si las hay)
      if (bajasNacer > 0 && paricionVacasVaciasDestino !== 'skip') {
        if (paricionVacasVaciasDestino === 'new' && paricionVacasVaciasNombre.trim()) {
          await apiFetch('/api/herds', {
            method: 'POST',
            body: JSON.stringify({
              name: paricionVacasVaciasNombre.trim(),
              species: herd.species || 'vacas',
              categoria: herd.categoria || 'VACAS',
              breed: herd.breed || null,
              head_count: bajasNacer,
              avg_weight_kg: herd.avg_weight_kg ?? null,
              physiological_category: 'VACA_VACIA',
              total_ev: vaciaEV,
              admission_date: paricionFecha && paricionFecha.length === 10 ? paricionFecha : null,
            }),
          })
        } else if (paricionVacasVaciasDestino === 'existing' && paricionVacasVaciasHerdId) {
          const vaciaHerd = paricionRodeosVaciaDestino.find(h => h.id === paricionVacasVaciasHerdId)
          const vaciaCount = (vaciaHerd?.head_count ?? 0) + bajasNacer
          const vaciaEVTotal = parseFloat((vaciaCount * (PHYSIO_EV_BASE['VACA_VACIA'] ?? 0.80)).toFixed(2))
          await apiFetch(`/api/herds/${paricionVacasVaciasHerdId}`, {
            method: 'PATCH',
            body: JSON.stringify({ head_count: vaciaCount, total_ev: vaciaEVTotal }),
          })
        }
      }

      // 4. Registrar evento en agenda
      await apiFetch('/api/farm-events', {
        method: 'POST',
        body: JSON.stringify({
          title: `Parición: ${n} madres · ${herd.name}`,
          event_type: 'paricion',
          event_date: paricionFecha,
          herd_id: herd.id, herd_ids: [herd.id],
          description: [
            `${n} madres paridas. Crías vivas: ${criasVivas}.`,
            bajasNacer > 0 ? `Bajas al nacer: ${bajasNacer} (→ Vaca vacía).` : null,
            paricionPesoCrias !== '' ? `Peso crías: ${paricionPesoCrias} kg.` : null,
            paricionDestino === 'new'
              ? `Nuevo rodeo: ${paricionNombreNuevo.trim()}`
              : `Rodeo destino: ${paricionRodeosDestino.find(h => h.id === paricionHerdDestinoId)?.name ?? paricionHerdDestinoId}`,
          ].filter(Boolean).join(' '),
          status: 'completado',
        }),
      })

      // 5. Actualización optimista inmediata
      setLiveHerd(prev => prev ? { ...prev, head_count: newCount, total_ev: newEV } : prev)
      setCount(newCount)
      setActSuccess(
        bajasNacer > 0
          ? `✓ Parición · ${criasVivas} c/ ternero al pie · ${bajasNacer} vacías · ${newCount} preñadas`
          : `✓ Parición · ${criasVivas} c/ ternero al pie · ${newCount} preñadas remanentes`
      )
      // Reset wizard state
      setParicionMadres(''); setParicionCrias(''); setParicionFecha(todayISO())
      setParicionPesoCrias(35); setParicionDestino('new')
      setParicionNombreNuevo(''); setParicionHerdDestinoId('')
      setParicionVacasVaciasDestino('existing'); setParicionVacasVaciasNombre('')
      setParicionVacasVaciasHerdId('')
      setActId(null)
      setTimeout(() => setActSuccess(null), 4000)
      onSaved()
    } catch (e: any) {
      setActError('Error: ' + e.message)
    } finally {
      setActSaving(false)
    }
  }

  const handleActivity = async () => {
    if (!actId || !actCount || !herd?.id) return

    // ── Destete en rodeo de vacas → lanzar Wizard asistido ──────────────────
    if (
      actId === 'destete' &&
      (herd.physiological_category === 'VACA_CON_TERNERO' ||
       herd.categoria === 'VACAS' ||
       !herd.physiological_category)   // legacy: si no tiene categoría fisiológica y es destete, usar wizard
    ) {
      setWeaningWizardOpen(true)
      return
    }

    setActSaving(true); setActError(null)
    const n     = Number(actCount)
    const isAdd = ACTIVITY_ADDS.has(actId)

    try {
      const currentCount = herd.head_count || 0
      const currentWeight = Number(herd.avg_weight_kg || weight || 400)
      const newCount = isAdd ? currentCount + n : Math.max(currentCount - n, 0)

      // For additions (paricion/compra): recalculate weighted-average weight and add EV for new animals
      let newWeight = currentWeight
      let newEV: number
      if (isAdd && actWeight !== '' && Number(actWeight) > 0) {
        const newAnimalsWeight = Number(actWeight)
        // Weighted average: (currentTotal + newTotal) / newCount
        const totalKg = currentCount * currentWeight + n * newAnimalsWeight
        newWeight = newCount > 0 ? Math.round(totalKg / newCount) : newAnimalsWeight
        // EV = existing EV + EV of new animals at their weight
        const existingEV = Number(herd.total_ev) || calculateBaseEV(catKey, currentWeight, currentCount)
        const newAnimalsEV = calculateBaseEV(catKey, newAnimalsWeight, n)
        newEV = parseFloat((existingEV + newAnimalsEV).toFixed(2))
      } else {
        newEV = calculateBaseEV(catKey, currentWeight, newCount)
      }

      const patchPayload: Record<string, any> = { head_count: newCount, total_ev: newEV }
      if (isAdd && actWeight !== '' && Number(actWeight) > 0) patchPayload.avg_weight_kg = newWeight

      if (!navigator.onLine) {
        const { addToOfflineQueue } = await import('@/components/OfflineIndicator')
        addToOfflineQueue({
          type: 'herd_update',
          data: { herd_id: herd.id, ...patchPayload },
          timestamp: Date.now()
        } as any)
        
        const evTitle = `${actId.charAt(0).toUpperCase() + actId.slice(1)}: ${n} cab. · ${herd.name}${
          isAdd && actWeight !== '' ? ` · ${Number(actWeight)} kg/cab` : ''
        }`
        const evDesc = [
          actNote || null,
          isAdd && actWeight !== '' ? `Peso ingresado: ${Number(actWeight)} kg/cab · Peso promedio nuevo: ${newWeight} kg` : null,
          `EV resultante: ${newEV.toFixed(0)}`,
        ].filter(Boolean).join(' · ')
        
        addToOfflineQueue({
          type: 'farm_event',
          data: {
            title: evTitle, event_type: actId, event_date: actDate,
            herd_id: herd.id, herd_ids: [herd.id], description: evDesc || null, status: 'completado'
          },
          timestamp: Date.now() + 1
        } as any)

        setAgendaEvents(prev => [{
          id: `temp-${Date.now()}`,
          title: evTitle, event_type: actId, event_date: actDate,
          herd_id: herd.id, herd_ids: [herd.id], description: evDesc || null, status: 'completado',
        }, ...prev])

        import('sonner').then(({ toast }) => toast.success('Actividad guardada offline. Se sincronizará al conectar.'))
      } else {
        const patchRes = await apiFetch(`/api/herds/${herd.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload),
        })
        if (!patchRes.ok) throw new Error('No se pudo actualizar el stock')

        const evTitle = `${actId.charAt(0).toUpperCase() + actId.slice(1)}: ${n} cab. · ${herd.name}${
          isAdd && actWeight !== '' ? ` · ${Number(actWeight)} kg/cab` : ''
        }`
        const evDesc = [
          actNote || null,
          isAdd && actWeight !== '' ? `Peso ingresado: ${Number(actWeight)} kg/cab · Peso promedio nuevo: ${newWeight} kg` : null,
          `EV resultante: ${newEV.toFixed(0)}`,
        ].filter(Boolean).join(' · ')

        const evRes = await apiFetch('/api/farm-events', {
          method: 'POST',
          body: JSON.stringify({
            title: evTitle,
            event_type: actId,
            event_date: actDate,
            herd_id: herd.id, herd_ids: [herd.id],
            description: evDesc || null,
            status: 'completado',
          }),
        })

        // Update historial local immediately
        if (evRes.ok) {
          const saved = await evRes.json().catch(() => null)
          setAgendaEvents(prev => [{
            id: saved?.event?.id ?? `temp-${Date.now()}`,
            title: evTitle,
            event_type: actId,
            event_date: actDate,
            herd_id: herd.id,
            herd_ids: [herd.id],
            description: evDesc || null,
            status: 'completado',
          }, ...prev])
        }
      }



      // Destete: ya no tiene auto-creación hardcodeada aquí.
      // El flujo completo se maneja en handleWeaningInline (inline UI en Tab 2).

      // Actualización optimista del liveHerd para que el modal refleje el nuevo stock de inmediato
      setLiveHerd(prev => prev ? { ...prev, head_count: newCount, total_ev: newEV, avg_weight_kg: newWeight } : prev)
      // También actualizar el campo count en Tab 1 (Datos Operativos)
      setCount(newCount)

      setActSuccess(`${isAdd ? '+' : '-'}${n} cab · Stock: ${newCount} · EV: ${newEV.toFixed(0)}`)
      setActCount(1); setActWeight(''); setActNote(''); setActId(null)
      setTimeout(() => setActSuccess(null), 3500)
      onSaved()
    } catch (e: any) {
      setActError('Error: ' + e.message)
    } finally {
      setActSaving(false)
    }
  }

  /**
  /**
   * openWeaningConfirm — Valida el formulario y abre el modal de confirmación.
   * No ejecuta nada hasta que el usuario elija el destino fisiológico de las madres.
   */
  const openWeaningConfirm = () => {
    if (!herd?.id || !actCount || !weanCalfWeight || !weanCalfGdp) return
    if (weanDestination === 'new' && !weanNewHerdName.trim()) return
    if (weanDestination === 'existing' && !weanTargetHerdId) return
    const n = Number(actCount)
    const remaining = (liveHerd?.head_count ?? herd?.head_count ?? 0) - n
    // Si no quedan madres forzamos total, si quedan sugerimos partial
    setWeanMothersOutcome(remaining <= 0 ? 'total' : 'partial')
    setWeaningConfirmOpen(true)
  }

  /**
   * commitWeaning — Ejecuta el destete completo con la lógica corregida:
   *
   * SIEMPRE: stock madres = herd.head_count - n  (resta efectiva)
   * Opción A (partial): madres remanentes → VACA_CON_TERNERO  · EV = remaining × 1.35
   * Opción B (total):   madres remanentes → VACA_VACIA/SECA   · EV = remaining × 0.80
   *
   * Luego: POST/PATCH rodeo crías + POST farm-event.
   */
  const commitWeaning = async () => {
    if (!herd?.id || !actCount || !weanCalfWeight || !weanCalfGdp) return

    setWeaningConfirmOpen(false)
    setActSaving(true); setActError(null)

    const n         = Number(actCount)
    const cWeight   = Number(weanCalfWeight)
    const cGdp      = Number(weanCalfGdp)
    const today     = actDate || todayISO()
    // ── Stock correcto de madres tras el destete ──────────────────────────
    const newMothersCount = Math.max(0, (liveHerd?.head_count ?? herd?.head_count ?? 0) - n)
    const isTotal         = weanMothersOutcome === 'total' || newMothersCount === 0
    const newPhysioCat    = isTotal ? 'VACA_VACIA' : 'VACA_CON_TERNERO'
    const newEVBase       = isTotal ? 0.80 : 1.35
    const newMothersEV    = parseFloat((newEVBase * newMothersCount).toFixed(2))

    try {
      // ── v10: Determinar grupo_manejo_id del lote ────────────────────────────
      // El rodeo de terneros destetados entra al mismo Lote de Manejo que la madre.
      // Si la madre no tiene lote aún, creamos uno nuevo automáticamente.
      let grupoId: string = herd.grupo_manejo_id ?? ''
      const grupoNombre = herd.grupo_manejo_nombre || herd.name
      if (!grupoId) {
        const grpRes = await apiFetch('/api/herds/group', {
          method: 'PATCH',
          body: JSON.stringify({
            herd_ids: [herd.id],
            grupo_manejo_nombre: grupoNombre,
            action: 'group',
          }),
        })
        if (grpRes.ok) {
          const grpData = await grpRes.json()
          grupoId = grpData.grupo_manejo_id ?? ''
        }
      }

      // 1. PATCH madres — stock corregido + categoría elegida
      await apiFetch(`/api/herds/${herd.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          head_count:             newMothersCount,
          physiological_category: newPhysioCat,
          total_ev:               newMothersEV,
          last_weigh_date:        today,
        }),
      })

      // 2. Crías
      if (weanDestination === 'new') {
        await apiFetch('/api/herds', {
          method: 'POST',
          body: JSON.stringify({
            name:                   weanNewHerdName.trim(),
            species:                'terneros',
            categoria:              'TERNEROS',
            physiological_category: 'TERNERO',
            breed:                  herd.breed || null,
            head_count:             n,
            avg_weight_kg:          cWeight,
            total_ev:               weanCalvesEV,
            daily_gain_kg:          cGdp,
            last_weigh_date:        today,
            parent_herd_id:         herd.id,
            admission_date:         today,
            // v10: mismo Lote de Manejo que la madre
            grupo_manejo_id:        grupoId || null,
            grupo_manejo_nombre:    grupoNombre,
          }),
        })
      } else {
        const target = allHerds.find(h => h.id === weanTargetHerdId)
        if (target) {
          const existingCount  = target.head_count || 0
          const existingWeight = Number(target.avg_weight_kg || cWeight)
          const merged         = existingCount + n
          const mergedWeight   = Math.round((existingCount * existingWeight + n * cWeight) / merged)
          const mergedEV       = calculateProjectedEV(target.physiological_category ?? 'TERNERO', mergedWeight, merged)
          await apiFetch(`/api/herds/${weanTargetHerdId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              head_count:    merged,
              avg_weight_kg: mergedWeight,
              total_ev:      mergedEV,
              daily_gain_kg: cGdp,
              last_weigh_date: today,
            }),
          })
        }
      }

      // 3. Farm-event
      const mothersDesc = isTotal
        ? `Madres → Vaca Vacía/Seca (0.80 EV). ${newMothersCount} madres remanentes · EV: ${newMothersEV.toFixed(1)}.`
        : `Destete parcial: ${newMothersCount} madres continúan como Vaca c/ Ternero (1.35 EV). EV madres: ${newMothersEV.toFixed(1)}.`

      await apiFetch('/api/farm-events', {
        method: 'POST',
        body: JSON.stringify({
          title: `Destete: ${n} terneros · ${herd.name}`,
          event_type: 'destete',
          event_date: today,
          herd_id: herd.id,
          herd_ids: [herd.id],
          description: [
            `${n} terneros destetados. Peso al destete: ${cWeight} kg/cab (EV ~${weanCalvesEV.toFixed(1)}).`,
            mothersDesc,
            `GDP estimada crías: ${cGdp} kg/día.`,
            weanDestination === 'new'
              ? `Nuevo rodeo creado: «${weanNewHerdName.trim()}».`
              : `Transferido a rodeo existente (${n} cab).`,
            actNote ? `Notas: ${actNote}` : '',
          ].filter(Boolean).join(' '),
          status: 'completado',
        }),
      })

      const toastMsg = isTotal
        ? `Destete total · ${n} terneros segregados · Madres → Vaca Vacía/Seca`
        : `Destete parcial · ${n} terneros segregados · ${newMothersCount} madres → Vaca c/ Ternero al Pie`
      import('sonner').then(({ toast }) => toast.success(toastMsg))

      // Actualización optimista del liveHerd tras el destete
      setLiveHerd(prev => prev ? {
        ...prev,
        head_count: newMothersCount,
        total_ev: newMothersEV,
        physiological_category: newPhysioCat,
      } : prev)
      setCount(newMothersCount)

      setActId(null)
      setActCount(1)
      setWeanNewHerdName('')
      setWeanTargetHerdId('')
      setActNote('')
      setActSuccess(`✓ ${toastMsg}`)
      setTimeout(() => setActSuccess(null), 6000)
      onSaved()
      // Cerrar el HerdModal para que el usuario vea los cambios reflejados en la card
      setTimeout(() => onClose(), 800)
    } catch (e: any) {
      console.error('[commitWeaning]', e)
      setActError('Error en el destete: ' + (e?.message || String(e)))
    } finally {
      setActSaving(false)
    }
  }


  // ── Tab 3: Registros ──────────────────────────────────────────────────────
  const [bcsScore,      setBcsScore]      = useState(herd?.bcs_score ?? 3)
  const [bcsSaving,     setBcsSaving]     = useState(false)
  const [bcsSaved,      setBcsSaved]      = useState(false)
  const [bcsPhotoFile,  setBcsPhotoFile]  = useState<File | null>(null)
  const [bcsPhotoPreview, setBcsPhotoPreview] = useState<string | null>(null)
  const [bcsAnalyzing,  setBcsAnalyzing]  = useState(false)
  const [bcsAiResult,   setBcsAiResult]   = useState<string | null>(null)
  const bcsCameraRef = useRef<HTMLInputElement>(null)
  const [showNote,      setShowNote]      = useState(false)
  const [quickNote,     setQuickNote]     = useState('')
  const [noteMode,      setNoteMode]      = useState<'text' | 'audio' | 'photo' | null>(null)
  const [notePhoto,     setNotePhoto]     = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [noteExpanded,  setNoteExpanded]  = useState(false)
  const [noteSaving,    setNoteSaving]    = useState(false)
  const [noteSaved,     setNoteSaved]     = useState(false)
  const [sessionNoteCount, setSessionNoteCount] = useState(0)
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

  // ── Audio con SpeechRecognition + MediaRecorder ────────────────────────────
  const [micOn, setMicOn] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const speechRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const audioBlobRef = useRef<Blob | null>(null)

  const startRecording = useCallback(async () => {
    setQuickNote('')
    setAudioBlob(null); setAudioUrl(null)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      try {
        const rec = new SR()
        rec.continuous = true; rec.interimResults = true; rec.lang = 'es-AR'
        rec.onresult = (e: any) => {
          let full = ''
          for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
          setQuickNote(full)
        }
        rec.start()
        speechRef.current = rec
      } catch { /* SpeechRecognition not available */ }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', '']
        .find(m => !m || MediaRecorder.isTypeSupported(m)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        audioBlobRef.current = blob
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }
      mr.start()
      mediaRecorderRef.current = mr
    } catch {
      import('sonner').then(({ toast }) => toast.error('No se pudo acceder al micrófono.'))
    }
    setMicOn(true)
  }, [])

  const stopRecordingAndWait = (): Promise<Blob | null> => {
    return new Promise(resolve => {
      speechRef.current?.stop()
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setMicOn(false)
        resolve(audioBlobRef.current || audioBlob)
        return
      }
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop())
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        audioBlobRef.current = blob
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setMicOn(false)
        resolve(blob)
      }
      mediaRecorderRef.current.stop()
      setMicOn(false)
    })
  }

  const toggleMic = useCallback(() => {
    if (micOn) stopRecordingAndWait()
    else startRecording()
  }, [micOn, startRecording])

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

  useEffect(() => { if (tab === 'registros' || tab === 'historial') loadData() }, [tab, loadData])

  const saveBcs = async () => {
    if (!herd?.id) return
    setBcsSaving(true)

    const label = bcsLabel(bcsScore)

    // ── Offline Path ──
    if (!navigator.onLine) {
      let mediaId: string | undefined
      if (bcsPhotoFile) {
        mediaId = crypto.randomUUID()
        const { savePendingPhoto } = await import('@/lib/audioOfflineStore')
        await savePendingPhoto({
          id: mediaId,
          blob: bcsPhotoFile,
          lat: null, lng: null,
          createdAt: new Date().toISOString(),
          title: `Condición Corporal: ${bcsScore}/5 — ${label}`
        })
      }
      const { addToOfflineQueue } = await import('@/components/OfflineIndicator')
      addToOfflineQueue({
        type: 'bcs_update',
        data: {
          herd_id: herd.id,
          bcs_score: bcsScore,
          bcs_label: label,
          quantity: herd.head_count,
          weight_kg: herd.avg_weight_kg,
          categoria: herd.categoria,
          breed: herd.breed,
          admission_date: herd.admission_date,
          herd_name: herd.name,
          total_ev: herd.total_ev,
        },
        timestamp: Date.now(),
        mediaType: mediaId ? 'photo' : undefined,
        mediaId
      } as any)
      setBcsSaving(false)
      setBcsSaved(true)
      setSessionNoteCount(c => c + 1)
      setTimeout(() => {
        setBcsSaved(false)
        setBcsPhotoFile(null)
        setBcsPhotoPreview(null)
        setBcsAiResult(null)
      }, 3000)
      import('sonner').then(({ toast }) => {
        toast.success('Condición corporal guardada offline. Se sincronizará al conectar.')
      })
      return
    }

    // ── Online Path ──
    let photo_url: string | null = null
    if (bcsPhotoFile) {
      try {
        const compressedImage = await compressImage(bcsPhotoFile)
        const fd = new FormData()
        fd.append('file', compressedImage)
        fd.append('folder', 'bcs-photos')
        const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (up.ok) ({ url: photo_url } = await up.json())
      } catch (err) {
        console.error('[saveBcs] compress error:', err)
      }
    }

    const eventTitle = `Condición Corporal registrada: ${bcsScore}/5 — ${label}`
    const eventDesc  = [`BCS: ${bcsScore}/5`, bcsAiResult ? `IA: ${bcsAiResult}` : ''].filter(Boolean).join(' · ')

    const [patchRes] = await Promise.all([
      apiFetch(`/api/herds/${herd.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ bcs_score: bcsScore, bcs_label: label }),
      }),
      // Log to historical movements — incluye photo_url
      apiFetch('/api/movements', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'herd',
          entity_id: herd.id,
          entity_name: herd.name,
          event_type: 'bcs',
          bcs_score: bcsScore,
          quantity: herd.head_count,
          weight_kg: herd.avg_weight_kg,
          categoria: herd.categoria,
          breed: herd.breed,
          admission_date: herd.admission_date,
          notes: `${eventTitle}${bcsAiResult ? ' · IA: ' + bcsAiResult : ''}`,
          photo_url,
          metadata: { bcs_label: label, head_count: herd.head_count, ev: herd.total_ev, photo_url, ai_result: bcsAiResult },
        }),
      }),
      // Guardar como farm-event para historial del modal
      apiFetch('/api/farm-events', {
        method: 'POST',
        body: JSON.stringify({
          title: eventTitle,
          event_type: 'medicion',
          event_date: todayISO(),
          herd_id: herd.id, herd_ids: [herd.id],
          description: eventDesc,
          photo_url,
          status: 'completado',
        }),
      }),
    ])
    setBcsSaving(false)
    if (patchRes.ok) { 
      setBcsSaved(true)
      setSessionNoteCount(c => c + 1)
      
      // Actualizar historial local inmediatamente sin recargar
      setAgendaEvents(prev => [{
        id: `temp-${Date.now()}`,
        title: eventTitle,
        event_type: 'medicion',
        event_date: todayISO(),
        herd_id: herd.id,
        herd_ids: [herd.id],
        description: eventDesc,
        photo_url,
        status: 'completado',
      }, ...prev])

      window.dispatchEvent(new Event('refresh-farm-events'))
      window.dispatchEvent(new Event('refresh-events'))
      window.dispatchEvent(new Event('refresh-herds'))

      import('sonner').then(({ toast }) => {
        toast.success('Condición corporal guardada en el historial')
      })

      setTimeout(() => {
        setBcsSaved(false)
        setBcsPhotoFile(null)
        setBcsPhotoPreview(null)
        setBcsAiResult(null)
      }, 3000) 
    }
  }

  const analyzeBcs = async () => {
    if (!bcsPhotoFile) return
    setBcsAnalyzing(true)
    setBcsAiResult(null)
    try {
      const compressedImage = await compressImage(bcsPhotoFile)
      const reader = new FileReader()
      const b64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(compressedImage)
      })
      const resp = await apiFetch('/api/analyze-body-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mimeType: compressedImage.type, species: catKey ? catKey.toLowerCase() : 'bovino' }),
      })
      if (resp.ok) {
        const json = await resp.json()
        const data = json?.data ?? json
        const score = data?.bcs_score
        const condLabel = data?.condition_label ?? data?.label ?? ''
        const recommendation = data?.recommendation ?? ''
        if (score) {
          const roundedScore = Math.min(5, Math.max(1, Math.round(score)))
          setBcsScore(roundedScore)
          setBcsAiResult(`${score}/5 — ${condLabel}${recommendation ? ' · ' + recommendation : ''}`)
          import('sonner').then(({ toast }) => toast.success(`IA detectó BCS ${score}/5 — ${condLabel}`))
        } else {
          import('sonner').then(({ toast }) => toast.error('La IA no pudo determinar la condición corporal'))
        }
      } else {
        import('sonner').then(({ toast }) => toast.error('No se pudo analizar la imagen con IA'))
      }
    } catch (e: any) {
      import('sonner').then(({ toast }) => toast.error('Error al analizar: ' + e.message))
    }
    setBcsAnalyzing(false)
  }

  const saveNote = async () => {
    let effectiveBlob = audioBlobRef.current || audioBlob
    if (micOn) {
      effectiveBlob = await stopRecordingAndWait()
    }

    if (!quickNote.trim() && !notePhoto && !effectiveBlob) return
    if (!herd?.id) return
    setNoteSaving(true)

    const isAudioNote = noteMode === 'audio' || !!effectiveBlob
    const titleStr = isAudioNote
      ? `🎙️ Nota de audio: ${quickNote.trim().slice(0, 60) || 'Audio guardado'}`
      : quickNote.trim()
        ? `Nota: ${quickNote.trim().slice(0, 60)}`
        : (notePhoto ? 'Nota visual agregada' : 'Nota de rodeo')

    // ── Offline Path ──
    if (!navigator.onLine) {
      let mediaType: 'audio' | 'photo' | undefined
      let mediaId: string | undefined
      if (notePhoto) {
        mediaType = 'photo'
        mediaId = crypto.randomUUID()
        const { savePendingPhoto } = await import('@/lib/audioOfflineStore')
        await savePendingPhoto({ id: mediaId, blob: notePhoto, lat: null, lng: null, createdAt: new Date().toISOString(), title: titleStr })
      } else if (effectiveBlob) {
        mediaType = 'audio'
        mediaId = crypto.randomUUID()
        const { savePendingAudio } = await import('@/lib/audioOfflineStore')
        await savePendingAudio({ id: mediaId, blob: effectiveBlob, durationSecs: 0, lat: null, lng: null, createdAt: new Date().toISOString(), title: titleStr, transcript: quickNote.trim() })
      }
      
      const { addToOfflineQueue } = await import('@/components/OfflineIndicator')
      addToOfflineQueue({
        type: 'farm_event',
        data: {
          title: titleStr, event_type: 'nota', event_date: todayISO(),
          herd_id: herd.id, herd_ids: [herd.id],
          description: quickNote.trim() || null, status: 'completado'
        },
        timestamp: Date.now(),
        mediaType, mediaId
      } as any)
      
      setAgendaEvents(prev => [{ id: `temp-${Date.now()}`, title: titleStr, event_type: 'nota', event_date: todayISO(), herd_id: herd.id, herd_ids: [herd.id], description: quickNote.trim() || null, status: 'completado' }, ...prev])
      setNoteSaving(false); setNoteSaved(true); setQuickNote(''); setNotePhoto(null); setAudioBlob(null); setAudioUrl(null); audioBlobRef.current = null;
      setTimeout(() => setNoteSaved(false), 3000)
      import('sonner').then(({ toast }) => toast.success('Nota guardada offline. Se sincronizará al conectar.'))
      return
    }

    // ── Online Path ──
    let photo_url: string | null = null
    if (notePhoto) {
      try {
        const compressedImage = await compressImage(notePhoto)
        const fd = new FormData()
        fd.append('file', compressedImage)
        fd.append('folder', 'herd-notes')
        const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (up.ok) ({ url: photo_url } = await up.json())
      } catch (err) {
        console.error('[saveNote] compress error:', err)
      }
    }

    let audio_url: string | null = null
    let finalTranscript = quickNote.trim()

    if (effectiveBlob) {
      const blobType = effectiveBlob.type || 'audio/webm'
      const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm'
      const fd = new FormData()
      fd.append('file', new File([effectiveBlob], `audio.${ext}`, { type: blobType }))
      fd.append('folder', 'herd-audio')
      const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (up.ok) ({ url: audio_url } = await up.json())

      // ── Transcribe with Gemini (best effort) ──
      try {
        const tf = new FormData()
        tf.append('file', new File([effectiveBlob], `audio-${Date.now()}.${ext}`, { type: blobType }))
        const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf })
        if (tr.ok) {
          const d = await tr.json()
          if (d.transcript && d.transcript !== '[Sin voz detectable]') {
            finalTranscript = d.transcript
            setQuickNote(d.transcript) // update local state so it doesn't disappear
          }
        }
      } catch { /* keep live Web Speech transcript */ }
    }

    const resolvedTitle = isAudioNote
      ? `🎙️ Nota de audio: ${finalTranscript.slice(0, 60) || 'Audio guardado'}`
      : finalTranscript
        ? `Nota: ${finalTranscript.slice(0, 60)}`
        : (notePhoto ? 'Nota visual agregada' : 'Nota de rodeo')

    const description = [finalTranscript, photo_url ? `[Foto](${photo_url})` : ''].filter(Boolean).join('\n\n')

    const res = await apiFetch('/api/farm-events', {
      method: 'POST',
      body: JSON.stringify({
        title: resolvedTitle,
        event_type: 'nota',
        event_date: todayISO(),
        herd_id: herd.id, herd_ids: [herd.id],
        description: description || null,
        photo_url,
        audio_url,
        status: 'completado',
      }),
    })

    if (!res.ok) {
      import('sonner').then(({ toast }) => toast.error('Error al guardar la nota'))
      setNoteSaving(false)
      return
    }

    // Update historial local immediately — no need to reload
    const saved = await res.json().catch(() => null)
    setAgendaEvents(prev => [{
      id: saved?.event?.id ?? `temp-${Date.now()}`,
        title: resolvedTitle,
        event_type: 'nota',
        event_date: todayISO(),
        herd_id: herd.id,
        herd_ids: [herd.id],
        description: description || null,
        photo_url,
      audio_url,
      status: 'completado',
    }, ...prev])

    setNoteSaving(false); setNoteSaved(true); setQuickNote(''); setNotePhoto(null); setAudioBlob(null); setAudioUrl(null); audioBlobRef.current = null;
    setTimeout(() => setNoteSaved(false), 3000)
  }

  const saveEvent = async () => {
    if (!newEvTitle.trim() || !herd?.id) return
    setEvSaving(true)
    
    const payload = {
      title: newEvTitle.trim(),
      event_type: newEvType,
      event_date: newEvDate,
      end_date: newEvEndDate || null,
      description: newEvDesc.trim() || null,
      herd_id: herd.id, herd_ids: [herd.id],
      status: 'pendiente',
      assigned_to: newEvAssignee || null,
    }

    if (!navigator.onLine) {
      const { addToOfflineQueue } = await import('@/components/OfflineIndicator')
      addToOfflineQueue({
        type: 'farm_event',
        data: payload,
        timestamp: Date.now()
      } as any)
      setAgendaEvents(prev => [{
        id: `temp-${Date.now()}`,
        ...payload
      }, ...prev])
      import('sonner').then(({ toast }) => toast.success('Evento guardado offline. Se sincronizará al conectar.'))
    } else {
      const res = await apiFetch('/api/farm-events', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const saved = await res.json().catch(() => null)
        setAgendaEvents(prev => [{
          id: saved?.event?.id ?? `temp-${Date.now()}`,
          ...payload
        }, ...prev])
      }
    }
    
    setEvSaving(false); setEvSaved(true)
    setNewEvTitle(''); setNewEvDate(todayISO()); setNewEvEndDate(''); setNewEvDesc(''); setNewEvAssignee('')
    setTimeout(() => setEvSaved(false), 3000)
  }

  const [eventToDelete, setEventToDelete] = useState<any>(null)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)

  const handleDeleteEvent = async () => {
    if (!eventToDelete || !herd?.id) return
    setIsDeletingEvent(true)
    try {
      const type = eventToDelete.event_type
      if (['paricion', 'compra', 'mortandad', 'venta', 'destete'].includes(type)) {
        const match = eventToDelete.title.match(/: (\d+) cab/)
        if (match) {
          const n = Number(match[1])
          const isAdd = ['paricion', 'compra'].includes(type)
          // If the event added animals, deleting it subtracts them. If it subtracted animals, deleting it adds them back.
          const newCount = isAdd ? Math.max((herd.head_count || 0) - n, 0) : (herd.head_count || 0) + n
          const newEV = calculateBaseEV(catKey, Number(herd.avg_weight_kg || weight || 400), newCount)
          await apiFetch(`/api/herds/${herd.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ head_count: newCount, total_ev: newEV }),
          })
          // Local update to avoid waiting for parent reload
          setCount(newCount)
        }
      }
      await apiFetch(`/api/farm-events/${eventToDelete.id}`, { method: 'DELETE' })
      loadData()
      onSaved()
    } catch (e) {
      console.error(e)
    } finally {
      setIsDeletingEvent(false)
      setEventToDelete(null)
    }
  }

  const catColors  = catKey ? CATEGORIA_COLORS[catKey] : null
  const displayCat = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : catLabel

  const TABS = [
    { id: 'operativo',   label: 'Datos operativos' },
    { id: 'actividades', label: 'Actividades' },
    { id: 'registros',   label: 'Registros' },
    { id: 'historial',   label: 'Historial' },
  ] as const

  const [historySearch, setHistorySearch] = useState('')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string | null>(null)
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string | null>(null)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)

  const monthNames = useMemo(() => ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"], []);

  const filteredEvents = useMemo(() => {
    return agendaEvents.filter(ev => {
      if (historySearch && !ev.title.toLowerCase().includes(historySearch.toLowerCase()) && !(ev.description || '').toLowerCase().includes(historySearch.toLowerCase())) {
        return false;
      }
      
      const isNota = ev.event_type === 'nota' || ev.title.includes('Nota');
      let type = ev.event_type;
      if (isNota) {
        if (ev.audio_url) type = 'audio';
        else if (ev.photo_url) type = 'foto';
        else type = 'texto';
      }

      if (historyTypeFilter) {
        if (historyTypeFilter === 'audio' && type !== 'audio') return false;
        if (historyTypeFilter === 'foto' && type !== 'foto') return false;
        if (historyTypeFilter === 'texto' && type !== 'texto') return false;
        if (historyTypeFilter === 'otros' && ['audio', 'foto', 'texto'].includes(type)) return false;
      }

      if (historyMonthFilter) {
        const d = new Date(ev.event_date);
        const dateObj = isNaN(d.getTime()) ? new Date(ev.created_at || ev.event_date) : d;
        if (!isNaN(dateObj.getTime())) {
          const m = monthNames[dateObj.getMonth()];
          if (m !== historyMonthFilter) return false;
        } else {
          return false;
        }
      }
      return true;
    });
  }, [agendaEvents, historySearch, historyTypeFilter, historyMonthFilter, monthNames]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    agendaEvents.forEach(ev => {
      const d = new Date(ev.event_date);
      const dateObj = isNaN(d.getTime()) ? new Date(ev.created_at || ev.event_date) : d;
      if (!isNaN(dateObj.getTime())) {
        months.add(monthNames[dateObj.getMonth()]);
      }
    });
    // Sort logic could be added here if needed, but string set is fine for now
    return Array.from(months);
  }, [agendaEvents, monthNames]);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-white sm:bg-black/40 sm:backdrop-blur-sm flex flex-col sm:items-center sm:justify-center sm:p-4 pb-20 sm:pb-0">
      <div className="bg-white w-full h-full sm:rounded-2xl sm:shadow-2xl sm:w-full sm:max-w-5xl sm:max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {catColors && (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${catColors.bg}`}>
                <span className={`text-xs font-black ${catColors.text}`}>{displayCat.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h3 className="text-xl font-black text-gray-950">
                {isEditing ? herd.name : 'Nuevo rodeo'}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                {isEditing ? `${liveHerd?.head_count ?? herd?.head_count} cabezas · ${displayCat}` : 'Alta de rodeo'}
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
              className={`flex-1 py-2.5 text-[10px] font-black tracking-wide rounded-t-lg transition-all border-b-2 uppercase overflow-hidden whitespace-nowrap text-ellipsis px-1 ${
                tab === id
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain">

          {/* ════ PESTAÑA: DATOS OPERATIVOS ════ */}
          {tab === 'operativo' && (
            <div className="px-5 pt-5 pb-28 space-y-3">

              {/* ――― SECCIÓN 1: Identificación y mercado ――― */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                  <div className="w-1.5 h-4 rounded-full bg-gray-300 shrink-0" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    Identificación y mercado
                  </p>
                </div>
                <div className="px-4 py-4 space-y-3">

                  {/* Nombre */}
                  <div className="space-y-1.5">
                    <label className={LABEL}>Nombre del rodeo *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Ej: Vientres 2024, Recría Norte..." className={INPUT} autoFocus={!isEditing} />
                  </div>

                  {/* Stock + Raza */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={`${LABEL} flex items-center gap-1.5`}>
                        <Hash className="w-3 h-3 text-gray-400" /> Stock
                      </label>
                      <input type="number" min="1" value={count} inputMode="numeric"
                        onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))}
                        onFocus={e => e.target.select()} placeholder="Cabezas" className={INPUT} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={LABEL}>Raza</label>
                      <BreedCombobox value={breed} onChange={setBreed} breeds={availableBreeds} />
                    </div>
                  </div>

                  {/* Categoría Comercial */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className={LABEL} style={{ marginBottom: 0 }}>Categoría comercial</label>
                      <Tooltip text="Clasificación para valorización de mercado y reportes patrimoniales. No afecta el cálculo de consumo de pastoreo." />
                    </div>
                    <CatCombobox value={catLabel} onChange={(lbl, key) => { setCatLabel(lbl); setCatKey(key) }} />
                    {catKey === null && catLabel.trim() && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                        <Info className="w-3 h-3 shrink-0" /> Categoría personalizada — sin cotización del Mercado de Cañuelas
                      </p>
                    )}
                  </div>

                  {/* Fecha de alta + toggle rodeo temporario */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={`${LABEL} flex items-center gap-1.5`}>
                          <Calendar className="w-3 h-3 text-gray-400" /> Fecha de alta
                        </label>
                        <input type="date" value={admissionDate}
                          onChange={e => setAdmissionDate(e.target.value)} className={INPUT} />
                      </div>
                      {isTemporary && (
                        <div className="space-y-1.5">
                          <label className={`${LABEL} flex items-center gap-1.5`}>
                            <Calendar className="w-3 h-3 text-gray-400" /> Fecha de salida
                            <span className="text-red-500 font-black">*</span>
                          </label>
                          <input type="date" value={exitDate}
                            onChange={e => setExitDate(e.target.value)} className={INPUT} />
                        </div>
                      )}
                    </div>

                    {/* Toggle rodeo temporario */}
                    <button
                      type="button"
                      onClick={() => setExitDate(isTemporary ? '' : (exitDate || ''))}
                      className="flex items-center gap-2 group w-fit"
                    >
                      <div className={`w-8 h-4 rounded-full transition-colors shrink-0 ${isTemporary ? 'bg-amber-400' : 'bg-gray-200'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full m-0.5 shadow-sm transition-transform ${isTemporary ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 group-hover:text-gray-700 transition-colors">
                        Rodeo temporario
                      </p>
                      {isTemporary && (
                        <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                          Requerí la fecha de salida
                        </span>
                      )}
                    </button>
                  </div>

                </div>
              </div>

              {/* ――― SECCIÓN 2: Perfil biológico ――― */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                  <div className="w-1.5 h-4 rounded-full bg-teal-400 shrink-0" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    Perfil biológico
                  </p>
                  <Tooltip text="Las variables biológicas determinan cuánto pasto consume este rodeo. Afectan directamente el balance forrajero de tu plan de pastoreo." />
                </div>
                <div className="px-4 py-4 space-y-4">

                  {/* Estado fisiológico */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className={LABEL} style={{ marginBottom: 0 }}>Estado fisiológico</label>
                      <Tooltip text="En qué etapa productiva está el rodeo. Determina sus requerimientos reales de materia seca, independientemente de la categoría comercial." />
                    </div>
                    <select
                      className={INPUT}
                      value={physioPanel.physioCategory}
                      onChange={e => setPhysioPanel(prev => ({
                        ...prev,
                        physioCategory: e.target.value as any,
                        lactanciaRange: '',
                        estadioGestacion: '',
                        customRacionKgDia: null,
                      }))}
                    >
                      <option value="">— Seleccionar estado —</option>
                      <optgroup label="Vacas">
                        <option value="VACA_CON_TERNERO">Vaca con ternero al pie</option>
                        <option value="VACA_PRENADA">Vaca preñada</option>
                        <option value="VACA_VACIA">Vaca vacía</option>
                      </optgroup>
                      <optgroup label="Recría / crecimiento">
                        <option value="TERNERO">Ternero/a</option>
                        <option value="RECRIA_NOVILLO">Novillito / novillo</option>
                        <option value="RECRIA_VAQUILLONA">Vaquillona</option>
                      </optgroup>
                      <optgroup label="Toros">
                        <option value="TORO_DESCANSO">Toro en descanso</option>
                        <option value="TORO_SERVICIO">Toro en servicio</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Inputs condicionales */}
                  {physioPanel.physioCategory && (
                    <div className="space-y-3">

                      {/* Peso + último pesaje */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className={`${LABEL} flex items-center gap-1.5`}>
                            <Scale className="w-3 h-3 text-gray-400" />
                            {physioPanel.physioCategory === 'VACA_CON_TERNERO' ? 'Peso de la madre (kg)' : 'Peso promedio (kg)'}
                          </label>
                          <input type="number" min="50" max="900" step="5" inputMode="numeric"
                            className={INPUT}
                            value={physioPanel.pesoKg}
                            onChange={e => setPhysioPanel(p => ({ ...p, pesoKg: e.target.value === '' ? '' : Number(e.target.value) }))}
                            onFocus={e => e.target.select()}
                            placeholder="Ej: 400" />
                        </div>
                        <div className="space-y-1.5">
                          <label className={`${LABEL} flex items-center gap-1.5`}>
                            <Calendar className="w-3 h-3 text-gray-400" /> Último pesaje
                          </label>
                          <input type="date" className={INPUT}
                            value={physioPanel.lastWeighDate}
                            onChange={e => setPhysioPanel(p => ({ ...p, lastWeighDate: e.target.value }))} />
                        </div>
                      </div>

                      {/* Lactancia */}
                      {physioPanel.physioCategory === 'VACA_CON_TERNERO' && (
                        <div className="space-y-1.5">
                          <label className={LABEL}>Período de lactancia</label>
                          <select className={INPUT}
                            value={physioPanel.lactanciaRange}
                            onChange={e => setPhysioPanel(p => ({ ...p, lactanciaRange: e.target.value as any }))}>
                            <option value="">— Seleccionar mes —</option>
                            {LACTANCIA_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Gestación */}
                      {physioPanel.physioCategory === 'VACA_PRENADA' && (
                        <div className="space-y-1.5">
                          <label className={LABEL}>Estadio de gestación</label>
                          <select className={INPUT}
                            value={physioPanel.estadioGestacion}
                            onChange={e => setPhysioPanel(p => ({ ...p, estadioGestacion: e.target.value as any }))}>
                            <option value="">— Seleccionar mes —</option>
                            {ESTADIOS_GESTACION.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                          </select>
                        </div>
                      )}

                      {/* ADPV */}
                      {['TERNERO','RECRIA_NOVILLO','RECRIA_VAQUILLONA','TORO_DESCANSO','TORO_SERVICIO'].includes(physioPanel.physioCategory) && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className={LABEL} style={{ marginBottom: 0 }}>
                              <TrendingUp className="w-3 h-3 text-teal-500 inline mr-1" />ADPV (kg/día)
                            </label>
                            <Tooltip text="ADPV = Aumento Diario de Peso Vivo. Cuántos kg gana cada animal por día. Ej: 0.500 kg/día = 500 gramos. Rango típico en pastoreo: 0.300–0.800 kg/día." />
                          </div>
                          <input type="number" step="0.05" min="-0.2" max="1.5" inputMode="decimal"
                            className={INPUT}
                            value={physioPanel.adpvKgDay}
                            onChange={e => setPhysioPanel(p => ({ ...p, adpvKgDay: e.target.value === '' ? '' : Number(e.target.value) }))}
                            onFocus={e => e.target.select()} placeholder="Ej: 0.500" />
                          <p className="text-[10px] text-gray-400">Aumento Diario de Peso Vivo</p>
                        </div>
                      )}

                    </div>
                  )}

                  {physioPanel.physioCategory && (!physioPanel.pesoKg || Number(physioPanel.pesoKg) <= 0) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                      <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <p className="text-[10px] text-amber-700 font-medium">Ingresá el peso para ver el impacto forrajero</p>
                    </div>
                  )}

                </div>
              </div>

              {/* ――― SECCIÓN 3: Impacto forrajero ――― */}
              {effectiveEV > 0 && physioPanel.physioCategory && (
                <div className="rounded-xl border border-green-200 bg-white overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-green-50/60 border-b border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 rounded-full bg-green-400 shrink-0" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-green-700">Impacto forrajero</p>
                    </div>
                    <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      {Number(count) || 0} cabezas
                    </span>
                  </div>
                  <div className="px-4 py-4 space-y-4">

                    {/* EV unitario + total */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl px-3 py-3 border border-gray-100 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">EV por cabeza</p>
                        <p className="text-xl font-black text-gray-900 tabular-nums">
                          {(effectiveEV / Math.max(Number(count) || 1, 1)).toFixed(3)}
                        </p>
                        <p className="text-[10px] text-gray-400">eq. vaca / cab.</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-3 border border-gray-100 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">EV total del lote</p>
                        <p className="text-xl font-black text-gray-900 tabular-nums">{effectiveEV.toFixed(1)}</p>
                        <p className="text-[10px] text-gray-400">eq. vaca</p>
                      </div>
                    </div>

                    {/* Ración editable */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Ración / día</p>
                        <Tooltip text="kg de Materia Seca por cabeza por día. Ajustálo según tu disponibilidad forrajera. Se usa en la planificación del Gantt." />
                        {physioPanel.customRacionKgDia !== null && (
                          <button type="button"
                            onClick={() => setPhysioPanel(p => ({ ...p, customRacionKgDia: null }))}
                            className="ml-auto text-[9px] text-amber-600 font-bold hover:underline">
                            Restablecer sugerida
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input type="number" step="0.5" min="1" max="30" inputMode="decimal"
                          className="w-full bg-white border-2 border-emerald-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all pr-28"
                          value={physioPanel.customRacionKgDia ?? (RATION_SUGERIDA_POR_CATEGORIA[physioPanel.physioCategory as string] ?? 12)}
                          onChange={e => setPhysioPanel(p => ({ ...p, customRacionKgDia: Number(e.target.value) || null }))}
                          onFocus={e => e.target.select()} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium pointer-events-none">
                          kg MS/cab/d
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3.5 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Consumo del rodeo</p>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-800 tabular-nums">
                            {((physioPanel.customRacionKgDia ?? (RATION_SUGERIDA_POR_CATEGORIA[physioPanel.physioCategory as string] ?? 12)) * (Number(count) || 0)).toLocaleString('es-AR')}
                            <span className="text-[10px] font-normal text-emerald-600 ml-1">kg MS/día</span>
                          </p>
                          <p className="text-[9px] text-emerald-600/70">
                            {physioPanel.customRacionKgDia ?? (RATION_SUGERIDA_POR_CATEGORIA[physioPanel.physioCategory as string] ?? 12)} kg × {Number(count) || 0} cab.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Proyección de crecimiento */}
              {effectiveEV > 0 && physioPanel.adpvKgDay !== '' && Number(physioPanel.adpvKgDay) > 0 && physioPanel.pesoKg !== '' && (
                <GrowthProjectionChart
                  physioCategory={physioCategory || null}
                  avgWeightKg={Number(physioPanel.pesoKg)}
                  gdpKgDay={Number(physioPanel.adpvKgDay)}
                  headCount={Number(count) || 1}
                  lastWeighDate={physioPanel.lastWeighDate || null}
                  months={6}
                />
              )}

              {saveError && (
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{saveError}</p>
              )}

            </div>
          )}

          {/* Tab marker */}


          {/* ════ TAB 2 — ACTIVIDADES ════ */}
          {tab === 'actividades' && (
            <div className="px-5 pt-5 pb-24 space-y-4">
              {!isEditing ? (
                <div className="py-10 text-center">
                  <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-400">Guardá primero el rodeo para registrar actividades</p>
                </div>
              ) : (
                <>
                  {/* ── Toasts ── */}
                  <AnimatePresence mode="sync">
                    {actSuccess && (
                      <motion.div key="act-success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-xs font-bold text-green-700">{actSuccess}</p>
                      </motion.div>
                    )}
                    {weanSuccess && (
                      <motion.div key="wean-success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-xs font-bold text-green-700">Rodeo de terneros creado correctamente</p>
                      </motion.div>
                    )}
                    {actError && (
                      <motion.div key="act-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs font-bold text-red-600">{actError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Stock pill ── */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">Stock actual</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">
                      {(liveHerd?.head_count ?? herd?.head_count ?? 0).toLocaleString('es-AR')}
                      <span className="text-xs font-medium text-gray-400 ml-1">cab</span>
                    </span>
                  </div>

                  {/* ── Activity list — accordion style ── */}
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">

                    {/* Group: Entradas */}
                    <div className="px-4 py-2 bg-gray-50/80">
                      <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Entradas</p>
                    </div>

                    {visibleActivities.filter(a => ACTIVITY_ADDS.has(a.id)).map(a => {
                      const sel = actId === a.id
                      // ¿Este es el wizard completo de parición?
                      const isThisParicionWizard = a.id === 'paricion' && isParicionWizard
                      return (
                        <div key={a.id} className="divide-y divide-gray-100">
                          <button
                            type="button"
                            onClick={() => setActId(sel ? null : a.id as ActivityId)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                              sel ? 'bg-green-50' : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              sel ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <Plus className={`w-3.5 h-3.5 ${sel ? 'text-green-700' : 'text-gray-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold transition-colors ${sel ? 'text-green-800' : 'text-gray-800'}`}>{a.label}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                                {isThisParicionWizard
                                  ? 'Asistente de parición · Segregá el lote parido con EV 1.35'
                                  : (a as any).desc}
                              </p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                              sel ? 'border-green-600 bg-green-600' : 'border-gray-300'
                            }`}>
                              {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </button>

                          <AnimatePresence>
                            {sel && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-3 space-y-3 bg-white border-t border-gray-100">
                                  {isThisParicionWizard ? (
                                    /* ════ WIZARD PARICIÓN (VACA_PRENADA) ════ */
                                    <>
                                      {/* Step 1 — Datos del evento */}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Madres paridas</label>
                                          <input type="number" min="1"
                                            max={liveHerd?.head_count ?? herd?.head_count ?? undefined}
                                            value={paricionMadres}
                                            onChange={e => {
                                              const v = e.target.value === '' ? '' : Number(e.target.value)
                                              setParicionMadres(v)
                                              // Auto-sync crías si el usuario no las editó aún
                                              if (v !== '') setParicionCrias(v)
                                            }}
                                            onFocus={e => e.target.select()}
                                            className={INPUT} placeholder="Ej: 30" />
                                          <p className="text-[9px] text-gray-400">máx {liveHerd?.head_count ?? herd?.head_count ?? '?'} cab</p>
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Crías nacidas vivas</label>
                                          <input type="number" min="0"
                                            value={paricionCrias}
                                            onChange={e => setParicionCrias(e.target.value === '' ? '' : Number(e.target.value))}
                                            onFocus={e => e.target.select()}
                                            className={INPUT} placeholder="= madres paridas" />
                                          <p className="text-[9px] text-gray-400">editá si hubo mellizos o bajas al nacer</p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Fecha del evento</label>
                                          <input type="date" value={paricionFecha}
                                            onChange={e => setParicionFecha(e.target.value)} className={INPUT} />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Peso crías al nacer (kg)</label>
                                          <input type="number" min="20" max="60" step="1"
                                            value={paricionPesoCrias}
                                            onChange={e => setParicionPesoCrias(e.target.value === '' ? '' : Number(e.target.value))}
                                            onFocus={e => e.target.select()}
                                            className={INPUT} placeholder="Ej: 35" />
                                        </div>
                                      </div>

                                      {/* Step 2 — Preview de impacto (usa criasVivas) */}
                                      {!!paricionMadres && Number(paricionMadres) > 0 && (() => {
                                        const m = Number(paricionMadres)
                                        const c = paricionCrias !== '' ? Math.max(0, Number(paricionCrias)) : m
                                        const bajas = Math.max(0, m - c)
                                        const remanentes = Math.max(0, (liveHerd?.head_count ?? herd?.head_count ?? 0) - m)
                                        return (
                                          <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3 space-y-1.5">
                                            <p className={LABEL}>Impacto en el rodeo</p>
                                            <div className="flex items-center justify-between text-[10px]">
                                              <span className="text-gray-500">Vacas preñadas remanentes</span>
                                              <span className="font-black text-gray-800">{remanentes} cab</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px]">
                                              <span className="text-gray-500">Lote Vaca c/ Ternero al Pie</span>
                                              <span className="font-black text-green-700">{c} cab · EV {(c * 1.35).toFixed(1)}</span>
                                            </div>
                                            {bajas > 0 && (
                                              <div className="flex items-center justify-between text-[10px] border-t border-amber-100 pt-1.5">
                                                <span className="text-amber-600">Vacas sin ternero (cría murió)</span>
                                                <span className="font-black text-amber-700">{bajas} cab · EV {(bajas * 0.80).toFixed(1)}</span>
                                              </div>
                                            )}
                                            {Number(paricionCrias) > m && (
                                              <p className="text-[9px] text-gray-400">{Number(paricionCrias) - m} mellizo(s) detectado(s)</p>
                                            )}
                                          </div>
                                        )
                                      })()}

                                      {/* Step 3 — Destino del lote parido (VACA_CON_TERNERO) */}
                                      <div className="space-y-2">
                                        <p className={LABEL}>Destino del lote con ternero al pie</p>
                                        <label className={`flex items-start gap-2.5 cursor-pointer px-3 py-3 rounded-xl border-2 transition-all ${
                                          paricionDestino === 'new' ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                          <input type="radio" name="paricion-dest" value="new"
                                            checked={paricionDestino === 'new'}
                                            onChange={() => setParicionDestino('new')}
                                            className="mt-0.5 accent-green-600" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800">Crear nuevo rodeo</p>
                                            <p className="text-[9px] text-gray-400 mt-0.5">Categoría automática: Vaca con Ternero al Pie · EV 1.35</p>
                                            {paricionDestino === 'new' && (
                                              <input type="text" className={`${INPUT} mt-2`}
                                                placeholder="Nombre (ej: Parición Cabeza 2026)"
                                                value={paricionNombreNuevo}
                                                onChange={e => setParicionNombreNuevo(e.target.value)}
                                                autoFocus />
                                            )}
                                          </div>
                                        </label>
                                        <label className={`flex items-start gap-2.5 cursor-pointer px-3 py-3 rounded-xl border-2 transition-all ${
                                          paricionDestino === 'existing' ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                          <input type="radio" name="paricion-dest" value="existing"
                                            checked={paricionDestino === 'existing'}
                                            onChange={() => setParicionDestino('existing')}
                                            className="mt-0.5 accent-green-600" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800">Transferir a rodeo existente</p>
                                            <p className="text-[9px] text-gray-400 mt-0.5">Solo rodeos activos con categoría Vaca con Ternero al Pie</p>
                                            {paricionDestino === 'existing' && (
                                              paricionRodeosDestino.length === 0 ? (
                                                <p className="text-[9px] text-amber-600 mt-2 font-medium">
                                                  Sin rodeos de Vaca con Ternero al Pie disponibles.
                                                </p>
                                              ) : (
                                                <select className={`${INPUT} mt-2`}
                                                  value={paricionHerdDestinoId}
                                                  onChange={e => setParicionHerdDestinoId(e.target.value)}>
                                                  <option value="">— Seleccionar rodeo —</option>
                                                  {paricionRodeosDestino.map(h => (
                                                    <option key={h.id} value={h.id}>
                                                      {h.name} · {h.head_count} cab · EV {Number(h.total_ev).toFixed(1)}
                                                    </option>
                                                  ))}
                                                </select>
                                              )
                                            )}
                                          </div>
                                        </label>
                                      </div>

                                      {/* Step 4 — Vacas sin ternero (bajas al nacer) */}
                                      {paricionBajasAlNacer > 0 && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                                          <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <div>
                                              <p className="text-xs font-bold text-amber-800">
                                                {paricionBajasAlNacer} vaca{paricionBajasAlNacer > 1 ? 's' : ''} sin ternero al pie
                                              </p>
                                              <p className="text-[9px] text-amber-600 mt-0.5">
                                                Su ternero murió al nacer. Pasan a estado Vaca Vacía (EV 0.80). ¿Dónde las alojás?
                                              </p>
                                            </div>
                                          </div>
                                          <div className="space-y-1.5">
                                            {(['existing', 'new', 'skip'] as const).map(opt => (
                                              <label key={opt} className={`flex items-start gap-2 cursor-pointer px-2.5 py-2 rounded-lg border transition-all ${
                                                paricionVacasVaciasDestino === opt ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
                                              }`}>
                                                <input type="radio" name="vacias-dest" value={opt}
                                                  checked={paricionVacasVaciasDestino === opt}
                                                  onChange={() => setParicionVacasVaciasDestino(opt)}
                                                  className="mt-0.5 accent-amber-600 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[10px] font-bold text-gray-800">
                                                    {opt === 'existing' ? 'Sumar a rodeo de Vaca Vacía existente'
                                                      : opt === 'new' ? 'Crear nuevo rodeo Vaca Vacía'
                                                      : 'Registrar manualmente después'}
                                                  </p>
                                                  {opt === 'existing' && paricionVacasVaciasDestino === 'existing' && (
                                                    paricionRodeosVaciaDestino.length === 0 ? (
                                                      <p className="text-[9px] text-amber-600 mt-1.5">Sin rodeos de Vaca Vacía disponibles. Elegí "Crear nuevo" o "Después".</p>
                                                    ) : (
                                                      <select className={`${INPUT} mt-1.5`}
                                                        value={paricionVacasVaciasHerdId}
                                                        onChange={e => setParicionVacasVaciasHerdId(e.target.value)}>
                                                        <option value="">— Seleccionar rodeo —</option>
                                                        {paricionRodeosVaciaDestino.map(h => (
                                                          <option key={h.id} value={h.id}>{h.name} · {h.head_count} cab</option>
                                                        ))}
                                                      </select>
                                                    )
                                                  )}
                                                  {opt === 'new' && paricionVacasVaciasDestino === 'new' && (
                                                    <input type="text" className={`${INPUT} mt-1.5`}
                                                      placeholder="Nombre rodeo (ej: Vacas Vacías 2026)"
                                                      value={paricionVacasVaciasNombre}
                                                      onChange={e => setParicionVacasVaciasNombre(e.target.value)} />
                                                  )}
                                                </div>
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Confirm */}
                                      <button type="button" onClick={handleParicion}
                                        disabled={
                                          actSaving || !paricionMadres ||
                                          (paricionDestino === 'new' && !paricionNombreNuevo.trim()) ||
                                          (paricionDestino === 'existing' && (!paricionHerdDestinoId || paricionRodeosDestino.length === 0)) ||
                                          (paricionBajasAlNacer > 0 && paricionVacasVaciasDestino === 'new' && !paricionVacasVaciasNombre.trim()) ||
                                          (paricionBajasAlNacer > 0 && paricionVacasVaciasDestino === 'existing' && !paricionVacasVaciasHerdId && paricionRodeosVaciaDestino.length > 0)
                                        }
                                        className="w-full py-2.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all disabled:opacity-40">
                                        {actSaving ? 'Guardando...' : 'Confirmar parición'}
                                      </button>
                                    </>
                                  ) : a.id === 'paricion' ? (
                                    /* ════ PARICIÓN en rodeo SIN categoría VACA_PRENADA ════ */
                                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-4 space-y-3">
                                      <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                        <div>
                                          <p className="text-xs font-bold text-amber-800">El wizard de parición requiere categoría Vaca Preñada</p>
                                          <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                                            Este rodeo no tiene la categoría fisiológica <strong>Vaca Preñada</strong> configurada.
                                            Para acceder al asistente completo de parición (segregación de lotes, EV automático, control de bajas al nacer),
                                            andá a <strong>Datos Operativos → Categoría Fisiológica</strong> y seleccioná <em>Vaca Preñada</em>.
                                          </p>
                                        </div>
                                      </div>
                                      <button type="button" onClick={() => setTab('operativo')}
                                        className="w-full py-2 text-xs font-bold text-amber-700 border border-amber-400 rounded-xl bg-white hover:bg-amber-50 transition-all">
                                        Ir a Datos Operativos para configurar la categoría
                                      </button>
                                    </div>
                                  ) : (
                                    /* ════ Formulario simple (Compra u otros) ════ */
                                    <>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Cantidad de cabezas</label>
                                          <input type="number" min="1" value={actCount}
                                            onChange={e => setActCount(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT} />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Fecha</label>
                                          <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className={INPUT} />
                                        </div>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className={LABEL}>Peso de ingreso (kg/cab)</label>
                                        <input type="number" min="0" step="1" value={actWeight}
                                          inputMode="numeric"
                                          onChange={e => setActWeight(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                          onFocus={e => e.target.select()}
                                          placeholder="Ej: 320" className={INPUT} />
                                        <p className="text-[10px] text-gray-400">Se recalcula el peso promedio y EV del rodeo</p>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className={LABEL}>Nota (opcional)</label>
                                        <input type="text" value={actNote} onChange={e => setActNote(e.target.value)}
                                          placeholder="Ej: Compra en remate feria..." className={INPUT} />
                                      </div>
                                      <button type="button" onClick={handleActivity} disabled={actSaving || !actCount}
                                        className="w-full py-2.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all disabled:opacity-40">
                                        {actSaving ? 'Guardando...' : `Confirmar ${a.label.toLowerCase()}`}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    {/* Group: Salidas — solo si hay salidas visibles */}
                    {visibleActivities.filter(a => !ACTIVITY_ADDS.has(a.id)).length > 0 && (
                      <div className="px-4 py-2 bg-gray-50/80">
                        <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Salidas</p>
                      </div>
                    )}

                    {visibleActivities.filter(a => !ACTIVITY_ADDS.has(a.id)).map(a => {
                      const sel = actId === a.id
                      return (
                        <div key={a.id} className="divide-y divide-gray-100">
                          <button
                            type="button"
                            onClick={() => setActId(sel ? null : a.id as ActivityId)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                              sel ? 'bg-green-50' : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              sel ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <Minus className={`w-3.5 h-3.5 ${sel ? 'text-green-700' : 'text-gray-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold transition-colors ${sel ? 'text-green-800' : 'text-gray-800'}`}>{a.label}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{(a as any).desc}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                              sel ? 'border-green-600 bg-green-600' : 'border-gray-300'
                            }`}>
                              {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </button>

                          <AnimatePresence>
                            {sel && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-3 space-y-3 bg-white border-t border-gray-100">
                                  {actId === 'destete' ? (
                                    /* ════ DESTETE ════ */
                                    <>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Terneros destetados</label>
                                          <input type="number" min="1" value={actCount}
                                            onChange={e => setActCount(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT} />
                                          <p className="text-[9px] text-gray-400">máx {liveHerd?.head_count ?? herd?.head_count ?? '?'} cab</p>
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Fecha</label>
                                          <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className={INPUT} />
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3 space-y-3">
                                        <p className={LABEL}>Crías · Parámetros</p>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-1.5">
                                            <label className={LABEL}>Peso al destete (kg)</label>
                                            <input type="number" min="80" max="280" step="5"
                                              value={weanCalfWeight}
                                              onChange={e => setWeanCalfWeight(e.target.value === '' ? '' : Number(e.target.value))}
                                              onFocus={e => e.target.select()}
                                              className={INPUT} placeholder="Ej: 160" />
                                          </div>
                                          <div className="space-y-1.5">
                                            <label className={LABEL}>GDP crías (kg/día)</label>
                                            <input type="number" min="0" max="2" step="0.05"
                                              value={weanCalfGdp}
                                              onChange={e => setWeanCalfGdp(e.target.value === '' ? '' : Number(e.target.value))}
                                              onFocus={e => e.target.select()}
                                              className={INPUT} placeholder="Ej: 0.55" />
                                          </div>
                                        </div>
                                        {weanCalvesEV > 0 && actCount !== '' && Number(actCount) > 0 && (
                                          <p className="text-[10px] text-gray-500">
                                            EV crías: <strong className="text-green-700">{weanCalvesEV.toFixed(2)} EV</strong>
                                            <span className="text-gray-400 ml-1.5">· {Math.round(weanCalvesEV * 11).toLocaleString('es-AR')} kg MS/día</span>
                                          </p>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <p className={LABEL}>Destino de los terneros</p>
                                        <label className={`flex items-start gap-2.5 cursor-pointer px-3 py-3 rounded-xl border-2 transition-all ${
                                          weanDestination === 'new' ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                          <input type="radio" name="wean-dest" value="new"
                                            checked={weanDestination === 'new'}
                                            onChange={() => setWeanDestination('new')}
                                            className="mt-0.5 accent-green-600" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800">Crear nuevo rodeo</p>
                                            <p className="text-[9px] text-gray-400 mt-0.5">Se da de alta un rodeo de terneros con los parámetros ingresados</p>
                                            {weanDestination === 'new' && (
                                              <input type="text" className={`${INPUT} mt-2`}
                                                placeholder="Nombre del rodeo (ej: Destete 2026)"
                                                value={weanNewHerdName}
                                                onChange={e => setWeanNewHerdName(e.target.value)}
                                                autoFocus />
                                            )}
                                          </div>
                                        </label>
                                        <label className={`flex items-start gap-2.5 cursor-pointer px-3 py-3 rounded-xl border-2 transition-all ${
                                          weanDestination === 'existing' ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                          <input type="radio" name="wean-dest" value="existing"
                                            checked={weanDestination === 'existing'}
                                            onChange={() => setWeanDestination('existing')}
                                            className="mt-0.5 accent-green-600" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800">Transferir a rodeo existente</p>
                                            <p className="text-[9px] text-gray-400 mt-0.5">Ternero/a o Recría activos en el establecimiento</p>
                                            {weanDestination === 'existing' && (
                                              weanTargetHerds.length === 0 ? (
                                                <p className="text-[9px] text-amber-600 mt-2 font-medium">Sin rodeos de terneros/recría disponibles.</p>
                                              ) : (
                                                <select className={`${INPUT} mt-2`} value={weanTargetHerdId} onChange={e => setWeanTargetHerdId(e.target.value)}>
                                                  <option value="">— Seleccionar rodeo —</option>
                                                  {weanTargetHerds.map(h => (
                                                    <option key={h.id} value={h.id}>{h.name} · {h.head_count} cab {h.avg_weight_kg ? `· ${h.avg_weight_kg} kg` : ''}</option>
                                                  ))}
                                                </select>
                                              )
                                            )}
                                          </div>
                                        </label>
                                      </div>
                                      {herd && Number(actCount) > 0 && (
                                        <div className="flex items-center justify-between text-[10px] px-1 pt-1">
                                          <span className="text-gray-400">Madres remanentes tras el destete</span>
                                          <span className="font-black text-green-700">
                                            {Math.max(0, (liveHerd?.head_count ?? herd?.head_count ?? 0) - Number(actCount))} cab
                                          </span>
                                        </div>
                                      )}
                                      <div className="space-y-1.5">
                                        <label className={LABEL}>Nota (opcional)</label>
                                        <input type="text" value={actNote} onChange={e => setActNote(e.target.value)}
                                          placeholder="Ej: Destete precoz..." className={INPUT} />
                                      </div>
                                      <button type="button" onClick={openWeaningConfirm}
                                        disabled={actSaving || !actCount || (weanDestination === 'new' && !weanNewHerdName.trim()) || (weanDestination === 'existing' && !weanTargetHerdId)}
                                        className="w-full py-2.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all disabled:opacity-40">
                                        Confirmar destete
                                      </button>
                                    </>
                                  ) : (
                                    /* ════ Mortandad / Venta ════ */
                                    <>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Cantidad de cabezas</label>
                                          <input type="number" min="1" value={actCount}
                                            onChange={e => setActCount(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT} />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className={LABEL}>Fecha</label>
                                          <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className={INPUT} />
                                        </div>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className={LABEL}>Nota (opcional)</label>
                                        <input type="text" value={actNote} onChange={e => setActNote(e.target.value)}
                                          placeholder={actId === 'venta' ? 'Ej: Venta en remate feria...' : 'Ej: Causa, potrero...'} className={INPUT} />
                                      </div>
                                      <button type="button" onClick={handleActivity} disabled={actSaving || !actCount}
                                        className="w-full py-2.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all disabled:opacity-40">
                                        {actSaving ? 'Guardando...' : `Confirmar ${a.label.toLowerCase()}`}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>

                </>
              )}
            </div>
          )}

          {/* ════ TAB 3 — REGISTROS ════ */}
          {tab === 'registros' && (
            <div className="px-6 pt-5 pb-24 space-y-4">

              {!isEditing ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <ClipboardList className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-400">Guardá primero el rodeo</p>
                  <p className="text-[10px] text-gray-300 mt-1">Los registros estarán disponibles una vez creado</p>
                </div>
              ) : (
                <>

                  {/* ── CARD 1: Notas de rodeo ── */}
                  <div className="rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <Mic className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-800 tracking-widest uppercase">Notas del Rodeo</p>
                          <p className="text-[9px] text-gray-400 font-medium">Audio · Texto · Foto</p>
                        </div>
                      </div>
                      {sessionNoteCount > 0 && (
                        <span className="flex items-center gap-1 bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          <span className="w-1 h-1 rounded-full bg-green-300 animate-pulse" />
                          +{sessionNoteCount}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      {/* Three capture buttons */}
                      <div className="grid gap-2 mb-3 grid-cols-3">
                        {/* Mic — siempre visible, pero difuminado si no tiene voice_bitacora */}
                        <div className="relative h-full">
                          <button type="button"
                            onClick={() => {
                              if (!canVoice) return;
                              if (noteExpanded && noteMode === 'audio') { setNoteExpanded(false); setNoteMode(null) } else { setNoteExpanded(true); setNoteMode('audio') }
                            }}
                            className={`w-full h-full relative flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${
                              noteMode === 'audio' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/40'
                            } ${!canVoice ? 'opacity-50 blur-[1px] cursor-not-allowed' : ''}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${noteMode === 'audio' ? 'bg-red-500 shadow-md shadow-red-200' : 'bg-red-100'}`}>
                              {micOn ? <MicOff className={`w-4 h-4 ${noteMode === 'audio' ? 'text-white' : 'text-red-500'}`} /> : <Mic className={`w-4 h-4 ${noteMode === 'audio' ? 'text-white' : 'text-red-500'}`} />}
                            </div>
                            <span className="text-[9px] font-black text-gray-600 tracking-wide">{micOn ? 'GRABANDO' : 'AUDIO'}</span>
                            {micOn && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                          </button>
                          {!canVoice && (
                            <div className="absolute inset-0 flex items-center justify-center z-10" title="Requiere Plan Holístico">
                              <span className="bg-white/80 backdrop-blur-sm p-1 rounded-full border border-gray-200 shadow-sm">
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Camera */}
                        <button type="button"
                          onClick={() => { if (noteMode === 'photo' && noteExpanded) { setNoteExpanded(false); setNoteMode(null) } else { setNoteExpanded(true); setNoteMode('photo') } }}
                          className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${
                            noteMode === 'photo' && noteExpanded ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/40'
                          }`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${noteMode === 'photo' && noteExpanded ? 'bg-green-500 shadow-md shadow-green-200' : 'bg-green-100'}`}>
                            <Camera className={`w-4 h-4 ${noteMode === 'photo' && noteExpanded ? 'text-white' : 'text-green-600'}`} />
                          </div>
                          <span className="text-[9px] font-black text-gray-600 tracking-wide">FOTO</span>
                        </button>
                        {/* Text */}
                        <button type="button"
                          onClick={() => { if (noteExpanded && noteMode === null) { setNoteExpanded(false) } else { setNoteExpanded(true); setNoteMode(null) } }}
                          className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${
                            noteExpanded && noteMode === null ? 'border-gray-500 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                          }`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${noteExpanded && noteMode === null ? 'bg-gray-700 shadow-md' : 'bg-gray-100'}`}>
                            <MessageSquarePlus className={`w-4 h-4 ${noteExpanded && noteMode === null ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <span className="text-[9px] font-black text-gray-600 tracking-wide">TEXTO</span>
                        </button>
                      </div>

                      {/* Expanded note form */}
                      {noteExpanded && (
                        <div className="space-y-2.5 pt-1 border-t border-gray-100 mt-1">
                          {noteMode === 'audio' && (
                            <button type="button" onClick={toggleMic}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all ${micOn ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                              {micOn ? <><MicOff className="w-4 h-4" /> Detener grabación</> : <><Mic className="w-4 h-4" /> Iniciar grabación de voz</>}
                            </button>
                          )}
                          {micOn && (
                            <div className="flex items-center justify-center gap-2 py-1">
                              <div className="flex items-end gap-0.5 h-5">{[3,5,4,7,5,6,3,4].map((h, i) => (<div key={i} className="w-0.5 bg-red-500 rounded-full animate-bounce" style={{ height: `${h * 2.5}px`, animationDelay: `${i * 80}ms` }} />))}</div>
                              <span className="text-[9px] font-black text-red-600 tracking-widest uppercase">Escuchando y grabando…</span>
                            </div>
                          )}
                          {noteMode === 'audio' && audioUrl && !micOn && (
                            <audio controls src={audioUrl} className="w-full mt-2 rounded-xl" />
                          )}
                          {noteMode === 'photo' && (
                            <div className="flex flex-col gap-2">
                              <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:text-green-700 bg-gray-50">
                                  <Paperclip className="w-3.5 h-3.5" /> Galería
                                </button>
                                <button type="button" onClick={() => cameraInputRef.current?.click()}
                                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-green-600 rounded-xl hover:bg-green-700">
                                  <Camera className="w-3.5 h-3.5" /> Cámara
                                </button>
                              </div>
                              <input type="file" ref={fileInputRef} className="sr-only" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setNotePhoto(e.target.files[0]); setNoteMode('photo'); setNoteExpanded(true) } }} />
                              <input type="file" ref={cameraInputRef} className="sr-only" accept="image/*" capture="environment" onChange={e => { if(e.target.files?.[0]) { setNotePhoto(e.target.files[0]); setNoteMode('photo'); setNoteExpanded(true) } }} />
                              {notePhoto && (
                                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 mt-2">
                                  <img src={URL.createObjectURL(notePhoto)} className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => setNotePhoto(null)} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"><X className="w-4 h-4"/></button>
                                </div>
                              )}
                            </div>
                          )}
                          <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} rows={3}
                            placeholder={noteMode === 'audio' ? 'El dictado aparecerá aquí…' : noteMode === 'photo' ? 'Descripción de la foto (opcional)…' : 'Observación, evento o nota…'}
                            className={TEXTAREA} autoFocus={noteMode !== 'audio'} />
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={async () => { await saveNote(); setSessionNoteCount(c => c + 1); setNoteExpanded(false); setNoteMode(null) }}
                              disabled={noteSaving || (!quickNote.trim() && !notePhoto)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all">
                              {noteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              {noteSaved ? '¡Guardado!' : 'Guardar nota'}
                            </button>
                            <button type="button" onClick={() => { setNoteExpanded(false); setNoteMode(null); setQuickNote(''); setNotePhoto(null); setAudioBlob(null); setAudioUrl(null) }}
                              className="px-3 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl hover:text-gray-700">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── CARD 2: Condición Corporal (BCS) ── */}
                  <div className="rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <Scale className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-800 tracking-widest uppercase">Registro de condición corporal</p>
                          <p className="text-[9px] text-gray-400 font-medium">BCS · Escala 1–5</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={saveBcs} disabled={bcsSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all">
                          {bcsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : bcsSaved ? <Check className="w-3.5 h-3.5" /> : null}
                          {bcsSaved ? 'Guardado' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                    <div className="px-4 py-4 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setBcsScore(n)}
                            className={`flex-1 py-3 rounded-xl border-2 text-base font-black transition-all ${
                              bcsScore === n 
                                ? 'bg-green-400 border-green-400 text-white shadow-md scale-105' 
                                : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      
                      {/* Photo capture */}
                      <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
                        {!bcsPhotoFile ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => bcsCameraRef.current?.click()}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:text-green-700 bg-gray-50 transition-all">
                              <Camera className="w-4 h-4" /> Agregar foto de evidencia (opcional)
                            </button>
                          </div>
                        ) : (
                          <div className="relative animate-in zoom-in-95 duration-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={bcsPhotoPreview!} alt="BCS" className="w-full max-h-48 object-cover rounded-xl border border-gray-200 shadow-sm" />
                            <button type="button" onClick={() => { setBcsPhotoFile(null); setBcsPhotoPreview(null); setBcsAiResult(null) }}
                              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full transition-all">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {/* Botón análisis IA — visible cuando hay foto */}
                        {bcsPhotoFile && (
                          <div className="relative">
                            <button type="button" onClick={analyzeBcs} disabled={bcsAnalyzing || !hasFeature('ai_insights') || (typeof navigator !== 'undefined' && !navigator.onLine)}
                              title={(typeof navigator !== 'undefined' && !navigator.onLine) ? 'Requiere conexión a internet' : !hasFeature('ai_insights') ? 'Requiere Plan Holístico' : undefined}
                              className={`w-full flex items-center justify-center gap-1.5 py-3 text-sm font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-xl transition-all whitespace-nowrap overflow-hidden px-2 ${(!hasFeature('ai_insights') || (typeof navigator !== 'undefined' && !navigator.onLine)) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-violet-100 disabled:opacity-50'}`}>
                              {bcsAnalyzing ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Sparkles className="w-4 h-4 shrink-0" />}
                              <span className="truncate">{bcsAnalyzing ? 'Analizando con IA…' : (typeof navigator !== 'undefined' && !navigator.onLine) ? 'IA no disponible sin conexión' : 'Analizar condición con IA'}</span>
                            </button>
                            {!hasFeature('ai_insights') && (
                              <div className="absolute inset-0 flex items-center justify-center z-10" title="Requiere Plan Holístico">
                                <span className="bg-white/80 backdrop-blur-sm p-1 rounded-full border border-gray-200 shadow-sm">
                                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Resultado IA */}
                        {bcsAiResult && (
                          <div className="bg-violet-50 px-3 py-2 rounded-xl border border-violet-200 flex items-center gap-2">
                            <span className="text-lg">🤖</span>
                            <div>
                              <p className="text-[9px] font-black text-violet-500 tracking-widest uppercase">Resultado IA · Gemini</p>
                              <p className="text-sm font-black text-violet-900">{bcsAiResult}</p>
                            </div>
                          </div>
                        )}
                        <input ref={bcsCameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
                          onChange={e => { const f = e.target.files?.[0]; if (f) { setBcsPhotoFile(f); setBcsPhotoPreview(URL.createObjectURL(f)); setBcsAiResult(null) } }} />
                      </div>

                      {bcsSaved && (
                        <p className="text-[10px] text-green-600 font-bold mt-2 text-center animate-in fade-in zoom-in duration-300">✓ Guardado en historial de evidencias</p>
                      )}
                    </div>
                  </div>

                  {/* ══ ÚLTIMOS REGISTROS ══ */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className={LABEL}>Últimos registros</p>
                      {evLoading && <Loader2 className="w-3 h-3 text-green-500 animate-spin" />}
                    </div>

                    {agendaEvents.length === 0 && !evLoading && (
                      <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed border-gray-200">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2.5">
                          <Mic className="w-5 h-5 text-gray-300" />
                        </div>
                        <p className="text-xs font-bold text-gray-400">Sin registros aún</p>
                        <p className="text-[9px] text-gray-300 mt-1">Usá los botones de arriba para capturar</p>
                      </div>
                    )}

                    {agendaEvents.length > 0 && (
                      <div className="space-y-2">
                        {agendaEvents.slice(0, 3).map(ev => {
                          const isNota = ev.event_type === 'nota' || ev.title.includes('Nota')
                          let type = ev.event_type;
                          if (isNota) {
                            if (ev.audio_url) type = 'audio';
                            else if (ev.photo_url) type = 'foto';
                            else type = 'texto';
                          }
                          return (
                            <div key={ev.id} className="flex gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                                {type === 'audio' ? <Mic className="w-3.5 h-3.5 text-red-500" /> :
                                 type === 'foto' ? <ImageIcon className="w-3.5 h-3.5 text-green-600" /> :
                                 isNota ? <FileText className="w-3.5 h-3.5 text-gray-500" /> :
                                 <div className="w-2 h-2 rounded-full bg-gray-400" />}
                              </div>
                              <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-all">
                                <div className="px-3 pt-2 pb-1">
                                  <p className="text-[11px] font-black text-gray-900 leading-tight">{ev.title}</p>
                                  <p className="text-[8px] text-gray-400 font-medium mt-0.5">{ev.event_date}{ev.end_date ? ` → ${ev.end_date}` : ''}{isNota ? '' : ` · ${ev.event_type}`}</p>
                                </div>
                                {ev.audio_url && (
                                  <div className="px-3 pb-2">
                                    <audio controls src={ev.audio_url} className="w-full rounded-lg" style={{ height: '28px' }} />
                                  </div>
                                )}
                                {ev.photo_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={ev.photo_url} alt="Evidencia" className="w-full max-h-24 object-cover" />
                                )}
                                {!ev.audio_url && !ev.photo_url && <div className="pb-1" />}
                              </div>
                            </div>
                          )
                        })}
                        {agendaEvents.length > 3 && (
                          <button type="button" onClick={() => setTab('historial')}
                            className="w-full text-[10px] font-bold text-green-600 hover:text-green-800 py-1.5 text-center transition-colors">
                            Ver todos los registros ({agendaEvents.length}) →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════ TAB 4 — HISTORIAL ════ */}
          {tab === 'historial' && (
            <div className="px-6 pt-5 pb-24 space-y-4">
              {!isEditing ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-400">Guardá primero el rodeo</p>
                  <p className="text-[10px] text-gray-300 mt-1">El historial estará disponible una vez creado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={LABEL}>Historial de registros</p>
                    {evLoading && <Loader2 className="w-3 h-3 text-green-500 animate-spin" />}
                  </div>

                  {/* Search & Filters */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 overflow-x-auto">

                    {/* Filters panel — expands left of search */}
                    {(isFilterExpanded || historyTypeFilter || historyMonthFilter) && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-gray-100 rounded-2xl p-1 flex gap-1 shrink-0">
                          {['audio', 'foto', 'texto', 'otros'].map(t => (
                            <button key={t} onClick={() => setHistoryTypeFilter(f => f === t ? null : t)}
                              className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                                historyTypeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-white/50'
                              }`}>
                              {t.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {availableMonths.length > 0 && (
                          <div className="bg-gray-100 rounded-2xl p-1 flex gap-1 shrink-0">
                            {availableMonths.map(m => (
                              <button key={m} onClick={() => setHistoryMonthFilter(f => f === m ? null : m)}
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                                  historyMonthFilter === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-white/50'
                                }`}>
                                {m.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex-1" />

                    {/* Search + Filter icon — always visible on the right */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-2xl px-3 shrink-0">
                      <Search className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        className="bg-transparent border-none py-2.5 text-xs outline-none focus:ring-0 text-gray-900 w-32 sm:w-44 placeholder:text-gray-400"
                      />
                      <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" />
                      <button
                        onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                        className={`p-1 rounded-xl transition-all shrink-0 ${isFilterExpanded || historyTypeFilter || historyMonthFilter ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <Filter className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />
                    <div className="space-y-2">
                      {filteredEvents.map(ev => {
                        const isNota = ev.event_type === 'nota' || ev.title.includes('Nota')
                        let type = ev.event_type;
                        if (isNota) {
                          if (ev.audio_url) type = 'audio';
                          else if (ev.photo_url) type = 'foto';
                          else type = 'texto';
                        }

                        return (
                          <div key={ev.id} className="flex gap-2.5 group">
                            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 z-10">
                              {type === 'audio' ? <Mic className="w-3.5 h-3.5 text-red-500" /> :
                               type === 'foto' ? <Camera className="w-3.5 h-3.5 text-green-600" /> :
                               isNota ? <FileText className="w-3.5 h-3.5 text-gray-500" /> :
                               <div className="w-2 h-2 rounded-full bg-gray-400" />}
                            </div>
                            <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-all">
                              <div className="px-3 py-2 flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-black text-gray-900 leading-tight">{ev.title}</p>
                                  <p className="text-[9px] text-gray-400 mt-0.5">{ev.event_date}{ev.end_date ? ` → ${ev.end_date}` : ''}{isNota ? '' : ` · ${ev.event_type}`}</p>
                                  {ev.description && !ev.description.startsWith('[Foto]') && (
                                    <p className="text-[10px] text-gray-500 mt-0.5 whitespace-pre-wrap">{ev.description}</p>
                                  )}
                                  {ev.audio_url && (
                                    <audio controls src={ev.audio_url} className="w-full h-8 mt-2" />
                                  )}
                                </div>
                                <button type="button" onClick={() => setEventToDelete(ev)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all shrink-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {ev.photo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ev.photo_url} alt="Evidencia" className="w-full max-h-60 object-cover" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {filteredEvents.length === 0 && !evLoading && (
                        <p className="text-xs text-gray-400 text-center py-4">
                          {agendaEvents.length === 0 ? "No hay eventos registrados" : "No hay resultados para los filtros"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Tab 1 save / general */}
        {(tab === 'operativo' || (tab === 'registros' && sessionNoteCount > 0)) && (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
              Cancelar
            </button>
            {tab === 'operativo' && (
              <button type="button" onClick={handleSave} disabled={saving || !canSave}
                className="px-5 py-2 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all disabled:opacity-40">
                {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear rodeo')}
              </button>
            )}
            {tab === 'registros' && sessionNoteCount > 0 && (
              <button type="button" onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all">
                Confirmar (+{sessionNoteCount} registros)
              </button>
            )}
          </div>
        )}

        {/* Event Deletion Modal */}
        {eventToDelete && (
          <div className="absolute inset-0 z-[10000] bg-white/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-sm w-full text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900">¿Eliminar registro?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Vas a eliminar el evento <span className="font-bold text-gray-700">"{eventToDelete.title}"</span>. 
                Si este evento modificó el stock (ej. Parición, Mortandad, Compra, Venta), el stock general del rodeo se revertirá automáticamente.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={() => setEventToDelete(null)} disabled={isDeletingEvent}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
                  Cancelar
                </button>
                <button type="button" onClick={handleDeleteEvent} disabled={isDeletingEvent}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center justify-center gap-2">
                  {isDeletingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )


  // ── Confirm modal computed values ─────────────────────────────────────────
  const weanN         = actCount !== '' ? Number(actCount) : 0
  const weanRemaining = Math.max(0, (liveHerd?.head_count ?? herd?.head_count ?? 0) - weanN)
  const evPartial     = parseFloat((1.35 * weanRemaining).toFixed(2))
  const evTotal       = parseFloat((0.80 * weanRemaining).toFixed(2))

  if (typeof document === 'undefined') return null

  const confirmPortalContent = weaningConfirmOpen && herd ? (
    <AnimatePresence>
      <motion.div
        key="wean-confirm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={() => setWeaningConfirmOpen(false)}
      >
        <motion.div
          key="wean-confirm-card"
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black text-green-700 tracking-widest uppercase mb-1">Confirmación de Destete</p>
                <h3 className="text-sm font-black text-gray-900 leading-snug">
                  Estado Fisiológico del Rodeo de Madres
                </h3>
              </div>
              <button onClick={() => setWeaningConfirmOpen(false)}
                className="w-7 h-7 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-all shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-600 font-medium mt-2 leading-relaxed">
              Ha seleccionado realizar un destete de{' '}
              <strong className="text-gray-800">{weanN} terneros</strong> sobre el rodeo{' '}
              <strong className="text-gray-800">{herd.name}</strong>. Para mantener la precisión del stock y el cálculo
              {' '}de Equivalente Vaca (EV), determine la condición actual de las madres remanentes:
            </p>
          </div>

          {/* Opciones */}
          <div className="px-5 py-4 space-y-3">

            {/* Opción A — Destete Parcial */}
            <button
              type="button"
              onClick={() => setWeanMothersOutcome('partial')}
              disabled={weanRemaining <= 0}
              className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all ${
                weanMothersOutcome === 'partial'
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${weanRemaining <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                  weanMothersOutcome === 'partial' ? 'border-green-600 bg-green-600' : 'border-gray-300'
                }`}>
                  {weanMothersOutcome === 'partial' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">Opción A — Destete Parcial</p>
                  <p className="text-[10px] text-gray-500 font-normal mt-0.5 leading-relaxed">
                    Mantener el stock remanente de{' '}
                    <strong className="text-green-700">{weanRemaining} vacas</strong> como{' '}
                    <strong className="text-green-700">Vaca con Ternero al Pie</strong> (EV Base: 1.35).
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {weanRemaining} cab × 1.35 = {evPartial.toFixed(1)} EV
                    </span>
                    <span className="text-[9px] text-green-700 font-bold">
                      {Math.round(evPartial * 11).toLocaleString('es-AR')} kg MS/día
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Opción B — Destete Total */}
            <button
              type="button"
              onClick={() => setWeanMothersOutcome('total')}
              className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all ${
                weanMothersOutcome === 'total'
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                  weanMothersOutcome === 'total' ? 'border-green-600 bg-green-600' : 'border-gray-300'
                }`}>
                  {weanMothersOutcome === 'total' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">Opción B — Destete Total / Cambio de Categoría</p>
                  <p className="text-[10px] text-gray-500 font-normal mt-0.5 leading-relaxed">
                    Finalizar el destete de todo el rodeo y pasar las{' '}
                    <strong className="text-gray-700">{weanRemaining} vacas</strong> a la categoría{' '}
                    <strong className="text-gray-700">Vaca Vacía/Seca</strong> (EV Base: 0.80).
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {weanRemaining} cab × 0.80 = {evTotal.toFixed(1)} EV
                    </span>
                    <span className="text-[9px] text-emerald-600 font-bold">
                      {Math.round(evTotal * 11).toLocaleString('es-AR')} kg MS/día
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Resumen de impacto */}
            <div className="bg-gray-50 rounded-xl px-3.5 py-3 border border-gray-100 space-y-1">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Resumen de la operación</p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-600">Stock madres (antes)</p>
                <p className="text-[10px] font-black text-gray-800">{liveHerd?.head_count ?? herd?.head_count} cab</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-600">Terneros segregados</p>
                <p className="text-[10px] font-black text-orange-600">−{weanN} cab</p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-1 mt-1">
                <p className="text-[10px] font-black text-gray-700">Stock madres (después)</p>
                <p className="text-[10px] font-black text-gray-900">{weanRemaining} cab</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-gray-700">EV madres (después)</p>
                <p className={`text-[10px] font-black ${
                  'text-green-700'
                }`}>
                  {weanMothersOutcome === 'partial' ? evPartial.toFixed(1) : evTotal.toFixed(1)} EV
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 pb-6 space-y-2">
            <button
              type="button"
              onClick={commitWeaning}
              disabled={actSaving}
              className="w-full py-2.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all disabled:opacity-40"
            >
              {actSaving ? 'Procesando...' : 'Confirmar y ejecutar destete'}
            </button>
            <button
              type="button"
              onClick={() => setWeaningConfirmOpen(false)}
              className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ) : null

  return (
    <>
      {createPortal(modalContent, document.body)}
      {confirmPortalContent && createPortal(confirmPortalContent, document.body)}
      {weaningWizardOpen && herd && (
        <WeaningWizard
          herd={herd}
          allHerds={allHerds}
          weanedCount={actCount !== '' ? Number(actCount) : Math.floor((herd.head_count || 0) * 0.9)}
          weanDate={actDate || todayISO()}
          notes={actNote || undefined}
          onClose={() => setWeaningWizardOpen(false)}
          onCompleted={() => {
            setWeaningWizardOpen(false)
            setActId(null)
            setActSuccess('✓ Destete completado · categorías y EV actualizados')
            onSaved()
          }}
        />
      )}
    </>
  )
}
