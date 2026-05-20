'use client'

/**
 * PaddockModal — Modal de gestión de potrero (3 tabs)
 * Tipografía y campos unificados con el modal de Rebaños.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2, Trash2, ChevronDown, ChevronUp, Mic, MicOff, Plus, BookOpen, MapPin, Wrench, Leaf, AlertTriangle, BarChart3, Droplets, Camera, Paperclip, Lock } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { SatelliteData } from '@/lib/services/satellite'
import { SimpleNumberInput } from '@/design-system/atoms/SimpleNumberInput'
import { Tooltip } from '@/design-system/atoms/Tooltip'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/ConfirmModal'
import { usePlan } from '@/hooks/usePlan'
import { useClimateAnalytics } from '@/lib/context/ClimateAnalyticsContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Paddock {
  id: string
  name: string
  area_ha: number
  current_status: string
  current_ndvi?: number
  dry_matter_kg_ha?: number
  estimated_adh?: number
  technical_data?: Record<string, any>
  geom?: any
  boundary?: any
}

interface Props {
  paddock: Paddock
  ndviData?: SatelliteData | null
  onClose: () => void
  onSave: (
    paddockId: string,
    name: string,
    technicalData: Record<string, any>,
    dryMatter?: number,
    areaHa?: number,
  ) => Promise<void>
  onDelete?: (paddockId: string) => void
  onAssignPolygon?: (paddockId: string) => void   // Draw new polygon for manual paddock
  onEditPolygon?: (paddockId: string) => void     // Edit existing polygon vertices on map
  isCreating?: boolean
  user?: any
  paddocks?: Paddock[]
  herds?: Array<{ total_ev?: number | null }>
  planningDefaults?: { dailyAllocationKg: number; targetRemnantKgHa: number }
}

// ─── Datos parametrizados ─────────────────────────────────────────────────────

const GRASS_TYPES = [
  'Pasto bandera / Banderita (Bouteloua megapotamica)',
  'Cebadilla criolla / Cebadilla australiana (Bromus catharticus var. catharticus)',
  'Cebadilla pampeana (Bromus catharticus var. rupestris)',
  'Raigrás / Raigrás criollo (Lolium multiflorum)',
  'Flechilla fina (Nassella tenuis)',
  'Flechilla grande (Nassella longiglumis)',
  'Flechilla negra (Piptochaetium napostaense)',
  'Unquillo (Poa ligularis)',
  'Pasto plateado / Pasto de hoja (Digitaria californica)',
  'Pasto escoba (Schizachyrium plumigerum)',
  'Pata de gallo (Eustachys retusa)',
  'Penacho blanco (Bothriochloa edwardsiana)',
  'Pasto puna dulce / Estipa de hoja ancha (Amelichloa caudata)',
  'Vicia (Vicia villosa)',
  'Alfilerillo (Erodium cicutarium)',
  'Trébol de carretilla (Medicago minima var. minima)',
  'Arvejilla (Adesmia muricata var. muricata)',
  'Avena negra / Avena salvaje (Avena barbata y Avena fatua)',
]

const WEED_TYPES = [
  'Roseta (Cenchrus spinifex)',
  'Sorgo de Alepo / Maicillo (Sorghum halepense)',
  'Gramón / Pata de perdiz (Cynodon dactylon)',
  'Paja vizcachera (Amelichloa ambigua)',
  'Revienta caballo (Solanum elaeagnifolium)',
  'Abrepuño amarillo (Centaurea solstitialis)',
  'Rama negra (Conyza bonariensis)',
  'Flor amarilla (Diplotaxis tenuifolia)',
  'Mostacilla (Hirschfeldia incana)',
  'Yuyo esqueleto (Chondrilla juncea)',
  'Cardo ruso (Salsola kali)',
  'Cardo pendiente (Cardo thoermeri)',
  'Cardo negro (Cirsium vulgare)',
  'Cardo cruz / Cardo chileno (Carthamus lanatus)',
  'Roseta brava / Roseta francesa (Tribulus terrestris)',
  'Lechuga salvaje (Lactuca serriola)',
  'Mata trigo / Seca tierra (Baccharis gilliesii)',
]

const WATER_SOURCES_DEFAULT = ['Laguna', 'Bebederos', 'Arroyo', 'Pozo', 'Aguadas']

const FENCE_OPTIONS = [
  { value: 'none',     label: 'Sin alambrado' },
  { value: 'poor',     label: 'Mal estado' },
  { value: 'complete', label: 'Perimetral completo' },
]

const ACCESS_OPTIONS_DEFAULT = [
  'Acceso interno',
  'Acceso externo (calle)',
  'Colindancia con vecinos',
  'Acceso difícil',
  'Tranquerón',
  'Tranquera',
  'Cercanía a manga',
]

// ─── Categorías (igual que Bitácora) ──────────────────────────────────

const CAT_CONFIG: Record<string, {
  label: string; Icon: any;
  bg: string; border: string; text: string; badge: string; color: string
}> = {
  INFRAESTRUCTURA: { label: 'Infraestructura', Icon: Wrench,        bg: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-800',   badge: 'bg-cyan-100 text-cyan-800',    color: '#0891b2' },
  SANIDAD_VEGETAL: { label: 'Sanidad vegetal',  Icon: Leaf,          bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800',  badge: 'bg-green-100 text-green-800',   color: '#16a34a' },
  RESTRICCION:     { label: 'Restricción',      Icon: AlertTriangle, bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    badge: 'bg-red-100 text-red-800',       color: '#dc2626' },
  BIOMASA:         { label: 'Análisis biomasa', Icon: BarChart3,     bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-800',  color: '#7c3aed' },
  HIDRICO:         { label: 'Hídrico',          Icon: Droplets,      bg: 'bg-sky-50',     border: 'border-sky-200',    text: 'text-sky-800',    badge: 'bg-sky-100 text-sky-800',       color: '#0369a1' },
  GENERAL:         { label: 'General',          Icon: BookOpen,      bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-800',   badge: 'bg-gray-100 text-gray-800',     color: '#374151' },
}

const getCat = (note: any) => {
  const tags: string[] = Array.isArray(note.tags) && note.tags.length > 0 ? note.tags : [note.category || 'GENERAL']
  return { tags, primary: CAT_CONFIG[tags[0]] || CAT_CONFIG.GENERAL }
}

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ''
  try { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) }
  catch { return String(iso).slice(0, 10) }
}

// ─── Shared token strings ──────────────────────────────────────────────────
const LABEL_CLS  = 'text-[10px] font-black text-gray-700 tracking-widest uppercase'
const INPUT_CLS  = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-400'
const SELECT_CLS = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:ring-1 focus:ring-gray-400 outline-none transition-all'

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-10 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${checked ? 'bg-green-600' : 'bg-gray-200'}`}
    >
      <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute top-[3px] transition-all duration-200 ${checked ? 'left-[22px]' : 'left-[3px]'}`} />
    </button>
  )
}

function SelectedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const display = label.split(' (')[0]
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-100 text-green-800 text-[11px] font-bold border border-green-200">
      {display}
      <button type="button" onClick={onRemove} className="text-green-500 hover:text-green-800 transition-colors ml-0.5 leading-none">×</button>
    </span>
  )
}

function SearchableMultiSelect({
  label, options, selected, onChange, placeholder = 'Buscar...', allowCustom = false,
}: {
  label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void
  placeholder?: string; allowCustom?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const inputRef          = useRef<HTMLInputElement>(null)
  const containerRef      = useRef<HTMLDivElement>(null)

  const allOptions = [...new Set([...options, ...selected.filter(s => !options.includes(s))])]
  const filtered   = query.trim()
    ? allOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o))
    : allOptions.filter(o => !selected.includes(o)).slice(0, 12)
  const canAddCustom = allowCustom && query.trim().length > 0 &&
    !allOptions.some(o => o.toLowerCase() === query.trim().toLowerCase()) &&
    !selected.some(s => s.toLowerCase() === query.trim().toLowerCase())

  const add = (item: string) => {
    onChange([...selected, item])
    setQuery('')
    // Immediately re-focus input — dropdown stays open because blur never fires
    inputRef.current?.focus()
  }
  const remove = (item: string) => onChange(selected.filter(s => s !== item))

  // Close only on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const showDropdown = open && (filtered.length > 0 || canAddCustom)

  return (
    <div className="space-y-1.5">
      <p className={LABEL_CLS}>{label}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map(s => <SelectedChip key={s} label={s} onRemove={() => remove(s)} />)}
        </div>
      )}
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay close so onMouseDown on options fires first
            setTimeout(() => setOpen(false), 150)
          }}
          placeholder={placeholder}
          className={INPUT_CLS}
        />
        {showDropdown && (
          // onMouseDown preventDefault stops the input blur so the list stays open
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[10001] max-h-52 overflow-y-auto"
            onMouseDown={e => e.preventDefault()}
          >
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => add(opt)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 active:bg-green-100 transition-colors border-b border-gray-50 last:border-0"
              >
                <span className="font-medium">{opt.split(' (')[0]}</span>
                {opt.includes('(') && (
                  <span className="text-gray-400 text-[11px] ml-1">({opt.split('(')[1].replace(')', '')})</span>
                )}
              </button>
            ))}
            {canAddCustom && (
              <button
                type="button"
                onClick={() => { add(query.trim()); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors font-bold border-t border-gray-100"
              >
                + Agregar &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Collapsible({ title, children, defaultOpen = false, accent }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
  accent?: 'violet' | 'green'
}) {
  const [open, setOpen] = useState(defaultOpen)
  const headerCls = accent === 'violet'
    ? 'bg-violet-50 hover:bg-violet-100 border-violet-100'
    : accent === 'green'
    ? 'bg-green-50 hover:bg-green-100 border-green-100'
    : 'bg-gray-50 hover:bg-gray-100'
  const labelCls = accent === 'violet'
    ? 'text-[10px] font-black tracking-widest uppercase text-violet-700'
    : accent === 'green'
    ? 'text-[10px] font-black tracking-widest uppercase text-green-700'
    : LABEL_CLS
  return (
    <div className="border border-gray-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left border-b ${open ? `rounded-t-xl ${headerCls}` : `rounded-xl ${headerCls}`}`}
      >
        <span className={labelCls}>{title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-4 rounded-b-xl bg-white border-t border-gray-100">{children}</div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PaddockModal({
  paddock, ndviData, onClose, onSave, onDelete, onAssignPolygon, onEditPolygon, isCreating = false, user, paddocks = [], herds = [], planningDefaults,
}: Props) {
  const { confirm, ConfirmModal } = useConfirm()
  const { hasFeature } = usePlan()
  const { snapshots } = useClimateAnalytics()
  const paddockSnapshots = React.useMemo(() => {
    const sorted = snapshots.filter(s => s.paddock_id === paddock.id).sort((a, b) => new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime())
    const seenDates = new Set<string>()
    return sorted.filter(s => {
      const dateStr = new Date(s.calculated_at).toISOString().split('T')[0]
      if (seenDates.has(dateStr)) return false
      seenDates.add(dateStr)
      return true
    })
  }, [snapshots, paddock.id])
  const canVoice     = hasFeature('voice_bitacora') // audio + transcripción IA
  const canAiInsight = hasFeature('ai_insights')    // análisis biomasa IA
  const canNdvi      = hasFeature('ndvi_access')    // NDVI satelital
  const [activeTab, setActiveTab] = useState<'operativo' | 'infraestructura' | 'registros' | 'historial'>('operativo')
  const [saving, setSaving]       = useState(false)

  // Tab 1
  const [name, setName]             = useState(paddock.name)
  // Store as string to avoid browser '09' concatenation bug with type=number
  const [areaHa, setAreaHa]         = useState<string>(
    paddock.area_ha > 0 ? String(paddock.area_ha) : ''
  )
  const [msHa, setMsHa]             = useState<string>(
    paddock.dry_matter_kg_ha != null && Number(paddock.dry_matter_kg_ha) > 0 ? String(paddock.dry_matter_kg_ha) : ''
  )
  const [qualityScore, setQuality]  = useState<number>(paddock.technical_data?.quality_score ?? 5)
  const [grassTypes, setGrassTypes] = useState<string[]>(paddock.technical_data?.grass_types ?? [])
  const [weedTypes, setWeedTypes]   = useState<string[]>(paddock.technical_data?.weed_types ?? [])

  const totalMs = areaHa !== '' && msHa !== '' && !isNaN(Number(areaHa)) && !isNaN(Number(msHa))
    ? Number(areaHa) * Number(msHa) : null
  const isGeo   = Boolean(paddock.boundary || ndviData)

  // Tab 2 — Infraestructura
  const [hasWaterPoint, setHasWaterPoint]         = useState<boolean>(paddock.technical_data?.has_water_point ?? (paddock.technical_data?.water_sources?.length > 0))
  const [waterCapacityLiters, setWaterCapacityLiters] = useState<number | ''>(paddock.technical_data?.water_capacity_liters ?? '')
  const [fenceType, setFenceType]                 = useState<string>(paddock.technical_data?.fence_type ?? paddock.technical_data?.fence_status ?? '')
  const [fenceDropdownOpen, setFenceDropdownOpen] = useState(false)
  const [hasShade, setHasShade]                   = useState<boolean>(paddock.technical_data?.has_shade ?? false)
  const [accessList, setAccessList]               = useState<string[]>(paddock.technical_data?.access ?? [])
  const [hasElectricity, setHasElectricity]       = useState<boolean>(paddock.technical_data?.has_electricity ?? false)
  const [electricityType, setElectricityType]     = useState<string>(paddock.technical_data?.electricity_type ?? '')
  const [hasPredators, setHasPredators]           = useState<boolean>(paddock.technical_data?.has_predators ?? false)
  const [relativeQuality, setRelativeQuality]     = useState<number>(paddock.technical_data?.relative_quality ?? 0)

  // Tab 3 — notas e historial
  const [noteExpanded, setNoteExpanded]     = useState(false)
  const [noteMode, setNoteMode]             = useState<'text' | 'image' | 'audio' | null>(null)
  const [noteTitle, setNoteTitle]           = useState('')
  const [noteText, setNoteText]             = useState('')
  const [noteImage, setNoteImage]           = useState<File | null>(null)
  const [noteImagePreview, setNoteImagePreview] = useState<string | null>(null)
  const [noteAnalyzing, setNoteAnalyzing]   = useState(false)
  const [noteResult, setNoteResult]         = useState<any>(null)
  const [noteSaving, setNoteSaving]         = useState(false)
  const [noteSaved, setNoteSaved]           = useState(false)
  const noteImageRef                        = useRef<HTMLInputElement>(null)
  const noteCameraRef                       = useRef<HTMLInputElement>(null)

  // Audio
  const [recording, setRecording]             = useState(false)
  const [audioTranscript, setAudioTranscript] = useState('')
  const [audioBlob, setAudioBlob]             = useState<Blob | null>(null)
  const audioBlobRef                          = useRef<Blob | null>(null)  // sync ref for closure access
  const [audioUrl, setAudioUrl]               = useState<string | null>(null)
  const mediaRecorderRef                      = useRef<MediaRecorder | null>(null)
  const audioChunksRef                        = useRef<Blob[]>([])
  const speechRef                             = useRef<any>(null)

  // Historial + eliminados locales
  const [notes, setNotes]                     = useState<any[]>([])
  const [notesLoading, setNotesLoading]       = useState(false)
  const [deletedNotes, setDeletedNotes]       = useState<Record<string, Date>>({})
  // Session counter — notes created in this modal session
  const [sessionNoteCount, setSessionNoteCount] = useState(0)

  const loadNotes = useCallback(async () => {
    if (!paddock.id || paddock.id === '__NEW__') return
    setNotesLoading(true)
    const res = await apiFetch(`/api/field-notes?paddock_id=${paddock.id}`)
    setNotes(res.ok ? (await res.json()).notes || [] : [])
    setNotesLoading(false)
  }, [paddock.id])

  useEffect(() => {
    if (activeTab === 'registros' || activeTab === 'historial') loadNotes()
  }, [activeTab, loadNotes])

  const [bioPhoto, setBioPhoto]               = useState<File | null>(null)
  const [bioAnalyzing, setBioAnalyzing]       = useState(false)
  const [bioResult, setBioResult]             = useState<any>(null)
  const [bioError, setBioError]               = useState<string | null>(null)
  const bioInputRef                           = useRef<HTMLInputElement>(null)
  const bioCameraRef                          = useRef<HTMLInputElement>(null)
  const [ndviRefreshing, setNdviRefreshing]   = useState(false)
  const currentNdvi = ndviData?.averageNdvi ?? paddock.current_ndvi

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const td: Record<string, any> = {
      ...(paddock.technical_data || {}),
      quality_score:        qualityScore,
      grass_types:          grassTypes,
      weed_types:           weedTypes,
      // Nuevos campos de infraestructura (blueprint)
      has_water_point:      hasWaterPoint,
      water_capacity_liters: hasWaterPoint && waterCapacityLiters !== '' ? Number(waterCapacityLiters) : null,
      fence_type:           fenceType,
      fence_status:         fenceType,   // backwards compat
      has_shade:            hasShade,
      access:               accessList,
      has_electricity:      hasElectricity,
      electricity_type:     electricityType,
      has_predators:        hasPredators,
      hasWater:             hasWaterPoint,
      hasPests:             weedTypes.length > 0,
      weeds:                weedTypes,
      hasInfraIssues:       fenceType === 'none' || fenceType === 'poor',
      hasPredators,
      relative_quality:     relativeQuality > 0 ? relativeQuality : undefined,
    }
    await onSave(paddock.id, name.trim(), td,
      msHa   !== '' ? Number(msHa)   : undefined,
      areaHa !== '' ? Number(areaHa) : undefined,
    )
    setSaving(false)
    onClose()
  }

  // ── Audio con SpeechRecognition + MediaRecorder ────────────────────────────
  const startRecording = useCallback(async () => {
    // Reset ONLY audio state — never touch noteTitle (shared state)
    setAudioTranscript('')
    setAudioBlob(null); setAudioUrl(null)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      try {
        const rec = new SR()
        rec.continuous = true; rec.interimResults = true; rec.lang = 'es-AR'
        rec.onresult = (e: any) => {
          let full = ''
          for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
          setAudioTranscript(full)
        }
        rec.start()
        speechRef.current = rec
      } catch { /* SpeechRecognition not available on this device */ }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Pick best supported MIME type (webm for Chrome/Android, mp4 for Safari/iOS)
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', '']
        .find(m => !m || MediaRecorder.isTypeSupported(m)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        audioBlobRef.current = blob        // sync ref — always up to date
        setAudioBlob(blob)                 // trigger re-render
        setAudioUrl(URL.createObjectURL(blob))
      }
      mr.start()
      mediaRecorderRef.current = mr
    } catch { toast.error('No se pudo acceder al micrófono. Verificá los permisos del navegador.') }
    setRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  // ── Helper: reset ALL capture state after saving ───────────────────────────
  const resetNoteCapture = useCallback(() => {
    setNoteText('')
    setNoteTitle('')
    setAudioTranscript('')
    setAudioBlob(null)
    setAudioUrl(null)
    audioBlobRef.current = null
    setNoteImage(null)
    setNoteImagePreview(null)
    setNoteResult(null)
    setNoteMode(null)
    setNoteExpanded(false)
    setRecording(false)
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
  }, [])

  // ── Guardar nota ───────────────────────────────────────────────────────────
  const saveQuickNote = useCallback(async () => {
    // If still recording, stop first and wait for onstop to complete
    let effectiveBlob: Blob | null = audioBlobRef.current

    if (recording && mediaRecorderRef.current?.state !== 'inactive') {
      setNoteSaving(true)
      // Stop SpeechRecognition immediately
      speechRef.current?.stop()
      // Wait for MediaRecorder.onstop to fire and blob to be available
      effectiveBlob = await new Promise<Blob | null>((resolve) => {
        const mr = mediaRecorderRef.current
        if (!mr || mr.state === 'inactive') { resolve(audioBlobRef.current); return }
        const origOnStop = mr.onstop
        mr.onstop = (ev) => {
          if (typeof origOnStop === 'function') origOnStop.call(mr, ev)
          setTimeout(() => resolve(audioBlobRef.current), 50)
        }
        mr.stop()
      })
      setRecording(false)
    }

    const content = noteText || audioTranscript
    if (!content && !noteImage && !effectiveBlob) {
      setNoteSaving(false)
      return
    }

    setNoteSaving(true)
    const timestamp = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

    // ── Offline Path ──
    if (!navigator.onLine) {
      const offlineId = crypto.randomUUID()
      if (!effectiveBlob && !noteImage) {
        import('@/components/OfflineIndicator').then(({ addToOfflineQueue }) => {
          addToOfflineQueue({
            type: 'field_note',
            data: {
              paddock_id: paddock.id,
              category: noteResult ? 'BIOMASA' : 'GENERAL',
              tags: noteResult ? ['BIOMASA'] : ['GENERAL'],
              title: noteTitle.trim() || (noteText || audioTranscript).slice(0, 60) || 'Nota de campo',
              content: noteText || audioTranscript || null,
              sync_status: 'PENDING',
              analysis_result: noteResult || null,
            },
            timestamp: Date.now(),
          })
        })
      } else if (effectiveBlob) {
        import('@/lib/audioOfflineStore').then(({ savePendingAudio }) => {
          savePendingAudio({
            id: offlineId,
            blob: effectiveBlob!,
            durationSecs: 0,
            lat: null, lng: null,
            createdAt: new Date().toISOString(),
            title: noteTitle.trim() || `Audio · ${timestamp}`,
            transcript: audioTranscript
          })
        })
        toast.success('Audio guardado offline. Se sincronizará automáticamente.')
      } else if (noteImage) {
        import('@/lib/audioOfflineStore').then(({ savePendingPhoto }) => {
          savePendingPhoto({
            id: offlineId,
            blob: noteImage,
            lat: null, lng: null,
            createdAt: new Date().toISOString(),
            title: noteTitle.trim() || noteImage.name,
          })
        })
        toast.success('Foto guardada offline. Se sincronizará automáticamente.')
      }
      setNoteSaving(false)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
      resetNoteCapture()
      audioBlobRef.current = null
      return
    }

    // ── Online Path ──
    let photo_url: string | null = null
    if (noteImage) {
      const fd = new FormData()
      fd.append('file', noteImage)
      fd.append('folder', 'field-notes')
      const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (up.ok) ({ url: photo_url } = await up.json())
      else console.warn('[saveQuickNote] photo upload failed:', up.status)
    }

    // 1. Upload audio file (use ref blob for reliability)
    let audio_url: string | null = null
    let finalTranscript = audioTranscript
    if (effectiveBlob) {
      const blobType = effectiveBlob.type || 'audio/webm'
      const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm'
      const fd = new FormData()
      fd.append('file', new File([effectiveBlob], `audio-${Date.now()}.${ext}`, { type: blobType }))
      fd.append('folder', 'field-notes-audio')
      const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (up.ok) {
        const upData = await up.json()
        audio_url = upData.url || null
        console.log('[saveQuickNote] audio uploaded:', audio_url)
      } else {
        const errTxt = await up.text().catch(() => String(up.status))
        console.warn('[saveQuickNote] audio upload failed:', errTxt)
        toast.error('No se pudo subir el audio. Se guardará la nota sin audio.')
      }

      // 2. Transcribe with Gemini (best effort — don't block save on failure)
      try {
        const tf = new FormData()
        tf.append('file', new File([effectiveBlob], `audio-${Date.now()}.${ext}`, { type: blobType }))
        const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf })
        if (tr.ok) {
          const d = await tr.json()
          if (d.transcript && d.transcript !== '[Sin voz detectable]') {
            finalTranscript = d.transcript
            setAudioTranscript(d.transcript)
          }
        }
      } catch { /* keep live Web Speech transcript */ }
    }

    // 3. Build content AFTER transcript resolved
    const resolvedContent = noteText || finalTranscript || null
    const resolvedTitle = noteTitle.trim() ||
      resolvedContent?.slice(0, 60) ||
      noteImage?.name ||
      (effectiveBlob ? `Audio · ${timestamp}` : 'Nota de campo')

    // 4. Save note
    const saveRes = await apiFetch('/api/field-notes', {
      method: 'POST',
      body: JSON.stringify({
        paddock_id: paddock.id,
        category: noteResult ? 'BIOMASA' : 'GENERAL',
        tags: noteResult ? ['BIOMASA'] : ['GENERAL'],
        title: resolvedTitle,
        content: resolvedContent,
        photo_url,
        audio_url,
        analysis_result: noteResult || null,
      }),
    })

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}))
      console.error('[saveQuickNote] POST failed:', errData)
      toast.error('No se pudo guardar el registro. Intentá de nuevo.')
      setNoteSaving(false)
      return
    }

    setNoteSaving(false)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 3000)
    audioBlobRef.current = null
    resetNoteCapture()
    loadNotes()
  }, [noteText, audioTranscript, noteImage, noteResult, paddock.id, loadNotes, noteTitle, recording, resetNoteCapture])

  // ── Eliminar nota (solo creador) ─────────────────────────────────────────────
  const deleteNote = useCallback(async (noteId: string) => {
    const ok = await confirm({
      title: '¿Eliminar este registro?',
      description: 'El registro quedará marcado como eliminado en el historial.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    await apiFetch(`/api/field-notes/${noteId}`, { method: 'DELETE' })
    setDeletedNotes(prev => ({ ...prev, [noteId]: new Date() }))
  }, [confirm])

  const analyzeNoteImage = useCallback(async () => {
    if (!noteImage) return
    setNoteAnalyzing(true)
    setNoteResult(null)
    try {
      const reader = new FileReader()
      const b64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(noteImage)
      })
      const resp = await apiFetch('/api/analyze-biomass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mimeType: noteImage.type, area_ha: areaHa })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        toast.error(err.error || 'Error al analizar la imagen')
        setNoteAnalyzing(false)
        return
      }
      const data = await resp.json()
      // API returns { success: true, data: { dry_matter_kg_ha, ... } }
      const result = data?.data ?? data
      if (result?.dry_matter_kg_ha) {
        setNoteResult(result)
      } else {
        toast.error('La IA no pudo determinar la biomasa de esta imagen')
      }
    } catch (e: any) {
      console.error('analyzeNoteImage error:', e)
      toast.error('Error de conexión al analizar')
    }
    setNoteAnalyzing(false)
  }, [noteImage, areaHa])

  const analyzeBio = useCallback(async () => {
    if (!bioPhoto) return
    setBioAnalyzing(true); setBioError(null); setBioResult(null)
    try {
      const reader = new FileReader()
      const b64: string = await new Promise((res, rej) => { reader.onload = () => res((reader.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(bioPhoto) })
      const resp = await apiFetch('/api/analyze-biomass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mimeType: bioPhoto.type, area_ha: areaHa }) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setBioError(err.error || 'No se pudo analizar la imagen.')
      } else {
        const data = await resp.json()
        // API returns { success: true, data: { dry_matter_kg_ha, ... } }
        const result = data?.data ?? data
        if (result?.dry_matter_kg_ha) { setBioResult(result); setMsHa(String(Math.round(result.dry_matter_kg_ha))) }
        else setBioError('La IA no pudo determinar la biomasa de esta imagen.')
      }
    } catch (e: any) { setBioError(e.message || 'Error de conexión') }
    setBioAnalyzing(false)
  }, [bioPhoto, areaHa])

  const refreshNdvi = useCallback(async () => {
    setNdviRefreshing(true)
    try {
      const geoRes = await apiFetch(`/api/paddocks/${paddock.id}`)
      if (!geoRes.ok) return
      const { paddock: geo } = await geoRes.json()
      if (!geo?.boundary) return

      // Deduplicate snapshots by 5 days
      const snapshots = geo?.technical_data?.historical_snapshots || [];
      const hasRecentSnapshot = snapshots.some((snap: any) => {
        const snapTime = new Date(snap.date).getTime();
        const diffDays = (Date.now() - snapTime) / 86400000;
        return diffDays < 5;
      });

      if (hasRecentSnapshot) {
        toast.info(`El NDVI se actualiza cada 5 días. Ya existe una medición reciente.`);
        setNdviRefreshing(false);
        return;
      }

      const resp = await apiFetch('/api/ndvi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geojson: geo.boundary, paddock_id: paddock.id }) })
      if (!resp.ok) return
      const res = await resp.json()
      await apiFetch(`/api/paddocks/${paddock.id}`, { method: 'PATCH', body: JSON.stringify({ current_ndvi: res.averageNdvi }) })
      toast.success('NDVI actualizado correctamente.');
    } catch {
      toast.error('Error al actualizar NDVI.');
    }
    setNdviRefreshing(false)
  }, [paddock.id])

  const ndviStatus = (v: number) => v >= 0.6 ? 'Óptimo' : v >= 0.4 ? 'Bueno' : v >= 0.2 ? 'Regular' : 'Bajo'

  const tabs = [
    { id: 'operativo',       label: 'Datos operativos', disabled: false },
    { id: 'infraestructura', label: 'Infraestructura',   disabled: false },
    { id: 'registros',       label: 'Registros',         disabled: isCreating },
    { id: 'historial',       label: 'Historial',         disabled: isCreating },
  ] as const

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-white md:bg-black/40 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:p-4 pb-20 md:pb-0">
      <ConfirmModal />
      <div className="bg-white w-full h-full md:rounded-2xl md:shadow-2xl md:w-full md:max-w-2xl md:max-h-[92vh] flex flex-col">

        {/* Header — mismo estilo que Rebaños */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-xl font-black text-gray-950">
              {isCreating ? 'Nuevo potrero' : paddock.name}
            </h3>
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
              {isCreating ? 'Datos del potrero' : `${Number(paddock.area_ha || 0).toFixed(1)} ha${isGeo ? ' · Georreferenciado' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs — verde institucional */}
        <div className="flex border-b border-gray-100 shrink-0 px-2 pt-2">
          {tabs.map(({ id, label, disabled }) => (
            <button
              key={id}
              onClick={() => !disabled && setActiveTab(id)}
              disabled={disabled}
              title={disabled ? 'Guardá el potrero primero para acceder' : undefined}
              className={`flex-1 py-2.5 text-[10px] font-black tracking-wide rounded-t-lg transition-all border-b-2 uppercase overflow-hidden whitespace-nowrap text-ellipsis px-1 ${
                disabled
                  ? 'text-gray-300 border-transparent cursor-not-allowed'
                  : activeTab === id
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {disabled ? <Lock className="w-3 h-3 mx-auto" /> : label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain">

          {/* ════ TAB 1 — DATOS OPERATIVOS ════ */}
          {activeTab === 'operativo' && (
            <div className="px-6 pt-5 pb-48 space-y-4">

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Nombre del potrero *</label>
                <input
                  type="text" autoFocus value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Lote Norte, Cañada, Potrero 3…"
                  className={INPUT_CLS}
                />
              </div>

              {/* Superficie + MS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={LABEL_CLS}>
                      Superficie (ha){isGeo && <span className="ml-1 normal-case font-medium tracking-normal">· calculado</span>}
                    </label>
                    {isGeo && onEditPolygon && (
                      <button
                        type="button"
                        onClick={() => { onEditPolygon(paddock.id); onClose() }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                      >
                        <MapPin className="w-3 h-3" /> Editar polígono
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={areaHa}
                    onChange={e => {
                      const v = e.target.value.replace(',', '.')
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setAreaHa(v)
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="Ej: 50"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className={LABEL_CLS}>MS disponible (kg MS/ha)</label>
                    <Tooltip text="Kilos de pasto seco por hectárea. Es la 'comida real' sin el agua. Más de 1500 kg MS/ha = bueno. Menos de 800 = bajo. Solo usaremos el 50% para no dañar el suelo." />
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={msHa}
                    onChange={e => {
                      const v = e.target.value.replace(',', '.')
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setMsHa(v)
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="Ej: 1 200"
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Total MS */}
              {totalMs !== null && (
                <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                  Total de materia seca:{' '}
                  <span className="text-gray-700 normal-case tracking-normal font-bold">{totalMs.toLocaleString('es')} kg MS</span>
                </p>
              )}

              {/* Rendimiento Relativo */}
              {(msHa !== '' && areaHa !== '') && (() => {
                const _ms = Number(msHa)

                // Coeficiente de Rendimiento
                const _activePaddocks = paddocks.filter(p => Number(p.dry_matter_kg_ha) > 0)
                const _modAvg = _activePaddocks.length > 0
                  ? _activePaddocks.reduce((s, p) => s + Number(p.dry_matter_kg_ha), 0) / _activePaddocks.length
                  : 0
                const _coef = _modAvg > 0 && _ms > 0 ? _ms / _modAvg : null

                if (_coef === null) return null

                return (
                  <div className="rounded-xl bg-green-50 border border-green-100 p-3.5 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Rendimiento Relativo</p>
                      <Tooltip text="Indicador de rendimiento del potrero." />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {_coef !== null && (
                        <div className={`bg-white rounded-xl border p-3 text-center ${
                          _coef >= 1.1 ? 'border-green-200' : _coef >= 0.9 ? 'border-gray-200' : 'border-amber-200'
                        }`}>
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Coeficiente</p>
                            <Tooltip text="Rendimiento relativo de este potrero frente al promedio del campo. Mayor a 1 = sobre el promedio. Menor a 1 = por debajo del promedio." />
                          </div>
                          <p className={`text-2xl font-black leading-none ${
                            _coef >= 1.1 ? 'text-green-700' : _coef >= 0.9 ? 'text-gray-700' : 'text-amber-700'
                          }`}>
                            {_coef.toFixed(2)}
                          </p>
                          <p className={`text-[9px] font-bold mt-0.5 ${
                            _coef >= 1.1 ? 'text-green-500' : _coef >= 0.9 ? 'text-gray-400' : 'text-amber-500'
                          }`}>
                            {_coef >= 1.1 ? 'Sobre el promedio' : _coef >= 0.9 ? 'En la media' : 'Bajo el promedio'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Calidad relativa */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={LABEL_CLS}>Calidad Relativa del Forraje</span>
                  <Tooltip text="Escala del 1 al 10: qué tan nutritivo y productivo es el pasto de este potrero comparado con los demás. 1-3 = pobre. 4-6 = regular. 7-10 = excelente. Sirve para priorizar cuál potrero pastorear primero." />
                </div>
                <SimpleNumberInput
                  label=""
                  min={1}
                  max={10}
                  step={1}
                  value={qualityScore}
                  onChange={e => setQuality(Number(e.target.value))}
                />
              </div>

              {/* Composición botánica */}
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <p className={LABEL_CLS}>Composición botánica</p>
                <SearchableMultiSelect
                  label="Tipo de pasto"
                  options={GRASS_TYPES}
                  selected={grassTypes}
                  onChange={setGrassTypes}
                  placeholder="Buscar o agregar tu tipo de pasto…"
                  allowCustom
                />
                <SearchableMultiSelect
                  label="Malezas"
                  options={WEED_TYPES}
                  selected={weedTypes}
                  onChange={setWeedTypes}
                  placeholder="Buscar o agregar maleza…"
                  allowCustom
                />
              </div>
            </div>
          )}

          {/* ════ TAB 2 — INFRAESTRUCTURA ════ */}
          {activeTab === 'infraestructura' && (
            <div className="px-6 py-5 space-y-5">

              {/* ── A. Módulo de Agua ───────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-sm font-bold text-gray-800">¿Tiene aguada?</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Bebedero, laguna, arroyo u otra fuente permanente</p>
                  </div>
                  <Toggle checked={hasWaterPoint} onChange={() => { setHasWaterPoint(v => !v); if (hasWaterPoint) setWaterCapacityLiters('') }} />
                </div>
                {hasWaterPoint && (
                  <div className="space-y-1.5 pl-1">
                    <label className={LABEL_CLS}>Capacidad de agua (litros)</label>
                    <input
                      type="number" min={0} step={100}
                      value={waterCapacityLiters}
                      onChange={e => setWaterCapacityLiters(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ej: 5000"
                      className={INPUT_CLS}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* ── B. Módulo de Alambrado (Dropdown Editable) ─────────────── */}
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Tipo de alambrado</label>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={fenceType}
                        onChange={e => setFenceType(e.target.value)}
                        onFocus={() => setFenceDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setFenceDropdownOpen(false), 150)}
                        placeholder="Seleccioná o escribí el tipo…"
                        className={INPUT_CLS}
                      />
                      {fenceDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[10001]">
                          {['Fijo convencional', 'Eléctrico permanente', 'Eléctrico móvil'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onMouseDown={() => { setFenceType(opt); setFenceDropdownOpen(false) }}
                              className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {fenceType && (
                    <button
                      type="button"
                      onClick={() => setFenceType('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >×</button>
                  )}
                </div>
              </div>

              {/* ── C. Módulo de Sombra ─────────────────────────────────────── */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-gray-800">Sombra disponible</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">Árboles, cortinas forestales u otra sombra natural</p>
                </div>
                <Toggle checked={hasShade} onChange={() => setHasShade(v => !v)} />
              </div>

              {/* ── Accesos ─────────────────────────────────────────────────── */}
              <SearchableMultiSelect
                label="Accesos y conectividad"
                options={ACCESS_OPTIONS_DEFAULT}
                selected={accessList}
                onChange={setAccessList}
                placeholder="Buscar tipo de acceso…"
                allowCustom
              />

              {/* ── Electricidad ─────────────────────────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={LABEL_CLS}>Electricidad</label>
                  <Toggle checked={hasElectricity} onChange={() => { setHasElectricity(v => !v); if (hasElectricity) setElectricityType('') }} />
                </div>
                {hasElectricity && (
                  <input
                    type="text" value={electricityType}
                    onChange={e => setElectricityType(e.target.value)}
                    placeholder="Tipo: Solar, Red eléctrica, Generador…"
                    className={INPUT_CLS}
                  />
                )}
              </div>

              {/* ── Depredadores ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-gray-700">Presencia de depredadores</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">{hasPredators ? 'Alerta activa' : 'Sin reportes'}</p>
                </div>
                <Toggle checked={hasPredators} onChange={() => setHasPredators(v => !v)} />
              </div>

            </div>
          )}

          {/* ════ TAB 3 — REGISTROS ════ */}
          {activeTab === 'registros' && (
            <div className="px-6 py-4 space-y-4">

                {/* ══ CARD 1: NOTAS DE CAMPO ══ */}
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                        <Mic className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-800 tracking-widest uppercase">Notas de campo</p>
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
                    {/* Three capture buttons — switching mode resets previous mode state */}
                    <div className={`grid gap-2 mb-3 ${canVoice ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {/* Mic — solo si voice_bitacora habilitado */}
                      {canVoice ? (
                        <button type="button"
                          onClick={() => {
                            if (noteMode === 'audio') {
                              setNoteExpanded(false); setNoteMode(null)
                            } else {
                              setNoteText(''); setNoteImage(null); setNoteImagePreview(null); setNoteResult(null)
                              setNoteExpanded(true); setNoteMode('audio')
                            }
                          }}
                          className={`relative flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${noteMode === 'audio' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/40'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${noteMode === 'audio' ? 'bg-red-500 shadow-md shadow-red-200' : 'bg-red-100'}`}>
                            {recording ? <MicOff className={`w-4 h-4 ${noteMode === 'audio' ? 'text-white' : 'text-red-500'}`} /> : <Mic className={`w-4 h-4 ${noteMode === 'audio' ? 'text-white' : 'text-red-500'}`} />}
                          </div>
                          <span className="text-[9px] font-black text-gray-600 tracking-wide">{recording ? 'GRABANDO' : 'AUDIO'}</span>
                          {recording && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                        </button>
                      ) : null}
                      {/* Camera */}
                      <button type="button"
                        onClick={() => {
                          if (noteMode === 'image') {
                            setNoteExpanded(false); setNoteMode(null)
                          } else {
                            // Clear previous mode data
                            setAudioTranscript(''); setAudioBlob(null); setAudioUrl(null); setNoteText('')
                            speechRef.current?.stop(); mediaRecorderRef.current?.stop(); setRecording(false)
                            setNoteExpanded(true); setNoteMode('image')
                          }
                        }}
                        className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${noteMode === 'image' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/40'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${noteMode === 'image' ? 'bg-green-500 shadow-md shadow-green-200' : 'bg-green-100'}`}>
                          <Camera className={`w-4 h-4 ${noteMode === 'image' ? 'text-white' : 'text-green-600'}`} />
                        </div>
                        <span className="text-[9px] font-black text-gray-600 tracking-wide">FOTO</span>
                      </button>
                      {/* Text */}
                      <button type="button"
                        onClick={() => {
                          if (noteMode === 'text') {
                            setNoteExpanded(false); setNoteMode(null)
                          } else {
                            // Clear previous mode data
                            setAudioTranscript(''); setAudioBlob(null); setAudioUrl(null)
                            setNoteImage(null); setNoteImagePreview(null); setNoteResult(null)
                            speechRef.current?.stop(); mediaRecorderRef.current?.stop(); setRecording(false)
                            setNoteExpanded(true); setNoteMode('text')
                          }
                        }}
                        className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 transition-all ${noteMode === 'text' ? 'border-gray-500 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${noteMode === 'text' ? 'bg-gray-700 shadow-md' : 'bg-gray-100'}`}>
                          <BookOpen className={`w-4 h-4 ${noteMode === 'text' ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className="text-[9px] font-black text-gray-600 tracking-wide">TEXTO</span>
                      </button>
                    </div>

                    {/* Expanded capture form */}
                    {noteExpanded && (
                      <div className="space-y-2.5 pt-2 border-t border-gray-100">
                        <input type="text" value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
                          placeholder="Título del registro (opcional)…" className={INPUT_CLS} />

                        {/* TEXT mode */}
                        {noteMode === 'text' && (
                          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                            placeholder="Escribí tu observación de campo…" rows={3} autoFocus
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:ring-1 focus:ring-green-600 outline-none resize-none" />
                        )}

                        {/* AUDIO mode */}
                        {noteMode === 'audio' && (
                          <div className="space-y-2">
                            <button type="button" onClick={recording ? stopRecording : startRecording}
                              className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-black rounded-xl transition-all ${recording ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                              {recording ? <><MicOff className="w-4 h-4" /> Detener</> : <><Mic className="w-4 h-4" /> Grabar ahora</>}
                            </button>
                            {recording && (
                              <div className="flex items-center justify-center gap-2">
                                <div className="flex items-end gap-0.5 h-5">{[3,5,4,7,5,6,3,4].map((h, i) => (<div key={i} className="w-0.5 bg-red-500 rounded-full animate-bounce" style={{ height: `${h * 2.5}px`, animationDelay: `${i * 80}ms` }} />))}</div>
                                <span className="text-[9px] font-black text-red-600 tracking-widest uppercase">Grabando…</span>
                              </div>
                            )}
                            {audioTranscript && (
                              <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                                <p className={LABEL_CLS}>Transcripción</p>
                                <p className="text-xs font-medium text-gray-700 mt-1 italic">"{audioTranscript}"</p>
                              </div>
                            )}
                            {audioUrl && !recording && (
                               
                              <audio controls src={audioUrl} className="w-full rounded-xl" />
                            )}
                          </div>
                        )}

                        {/* IMAGE mode */}
                        {noteMode === 'image' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button type="button" onClick={() => noteImageRef.current?.click()}
                                className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:text-green-700 bg-gray-50">
                                <Paperclip className="w-3.5 h-3.5" /> Galería
                              </button>
                              <button type="button" onClick={() => noteCameraRef.current?.click()}
                                className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-green-600 rounded-xl hover:bg-green-700">
                                <Camera className="w-3.5 h-3.5" /> Cámara
                              </button>
                            </div>
                            <input ref={noteImageRef} type="file" accept="image/*" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) { setNoteImage(f); setNoteImagePreview(URL.createObjectURL(f)); setNoteResult(null) } }} />
                            <input ref={noteCameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) { setNoteImage(f); setNoteImagePreview(URL.createObjectURL(f)); setNoteResult(null) } }} />
                            {noteImagePreview && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={noteImagePreview} alt="preview" className="w-full max-h-36 object-cover rounded-xl" />
                            )}
                            {noteImage && canAiInsight && (
                              <button type="button" onClick={analyzeNoteImage} disabled={noteAnalyzing}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-100 disabled:opacity-50">
                                {noteAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>✨</span>}
                                {noteAnalyzing ? 'Analizando con IA…' : 'Analizar biomasa con IA'}
                              </button>
                            )}
                            {noteImage && !canAiInsight && (
                              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                <p className="text-[10px] font-bold text-gray-400">✨ Análisis de biomasa IA disponible en planes Pro</p>
                              </div>
                            )}
                            {noteResult && (
                              <div className="bg-violet-50 px-3 py-2 rounded-xl border border-violet-200 flex items-center gap-2">
                                <span className="text-lg">🌿</span>
                                <div>
                                  <p className="text-[9px] font-black text-violet-500 tracking-widest uppercase">Resultado IA · Gemini</p>
                                  <p className="text-sm font-black text-violet-900">{Number(noteResult.dry_matter_kg_ha).toLocaleString('es')} kg MS/ha</p>
                                </div>
                              </div>
                            )}
                            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Descripción adicional…" rows={2}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:ring-1 focus:ring-green-600 outline-none resize-none" />
                          </div>
                        )}

                        {/* Save / Cancel */}
                        <div className="flex gap-2">
                          {(noteText || audioTranscript || noteImage || audioBlob) && (
                            <button type="button"
                              onClick={async () => {
                                await saveQuickNote()
                                setSessionNoteCount(c => c + 1)
                                import('sonner').then(({ toast }) =>
                                  toast.success('✓ Registro guardado en el historial')
                                )
                              }}
                              disabled={noteSaving}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50">
                              {noteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              {noteSaving ? 'Guardando…' : 'Guardar nota'}
                            </button>
                          )}
                          <button type="button"
                            onClick={resetNoteCapture}
                            className="px-3 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl hover:text-gray-700">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ══ CARD 2: INTELIGENCIA DE CAMPO ══ */}
                {canNdvi ? (
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                        <span className="text-[11px]">🛰️</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-800 tracking-widest uppercase">Inteligencia de campo</p>
                        <p className="text-[9px] text-gray-400 font-medium">NDVI Sentinel-2 · Biomasa IA Gemini</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {/* Card NDVI */}
                    <div className={`rounded-xl border p-3 ${
                      currentNdvi != null
                        ? currentNdvi >= 0.4 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black tracking-widest uppercase text-gray-500">NDVI</p>
                        <span className="text-[8px] font-bold text-gray-400">Sentinel-2</span>
                      </div>
                      {currentNdvi != null ? (
                        <>
                          <p className={`text-xl font-black leading-none ${currentNdvi >= 0.6 ? 'text-green-700' : currentNdvi >= 0.4 ? 'text-amber-600' : 'text-red-600'}`}>
                            {Number(currentNdvi).toFixed(3)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-500 mt-0.5">{ndviStatus(currentNdvi)}</p>
                          <div className="w-full h-1 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-green-500 mt-2" />
                        </>
                      ) : (
                        <p className="text-xs font-bold text-gray-400 mt-1">Sin datos</p>
                      )}
                      {isGeo ? (
                        <button type="button" onClick={refreshNdvi} disabled={ndviRefreshing}
                          className="mt-2 text-[9px] font-black text-gray-400 hover:text-green-700 flex items-center gap-0.5 disabled:opacity-50">
                          {ndviRefreshing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '↻'} Actualizar
                        </button>
                      ) : (
                        <p className="text-[9px] text-gray-400 mt-1.5 italic">Sin georreferencia</p>
                      )}
                    </div>

                    {/* Card IA Biomass */}
                    <div className="rounded-xl border bg-violet-50 border-violet-200 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black tracking-widest uppercase text-violet-500">MS/ha (IA)</p>
                        <span className="text-[8px] font-bold text-violet-400">Gemini</span>
                      </div>
                      {bioResult ? (
                        <>
                          <p className="text-xl font-black text-violet-800 leading-none">{Number(bioResult.dry_matter_kg_ha).toLocaleString('es')}</p>
                          <p className="text-[9px] font-bold text-violet-600 mt-0.5">kg MS/ha</p>
                          {bioResult.coverage_pct && <p className="text-[8px] text-violet-400">Cob: {bioResult.coverage_pct}%</p>}
                        </>
                      ) : msHa ? (
                        <>
                          <p className="text-xl font-black text-violet-700 leading-none">{Number(msHa).toLocaleString('es')}</p>
                          <p className="text-[9px] font-bold text-violet-500 mt-0.5">kg MS/ha · Manual</p>
                        </>
                      ) : (
                        <p className="text-xs font-bold text-violet-400 mt-1">Sin análisis</p>
                      )}
                      <button type="button"
                        onClick={() => { setNoteExpanded(true); setNoteMode('image') }}
                        className="mt-2 text-[9px] font-black text-violet-600 hover:text-violet-800 flex items-center gap-0.5">
                        ✨ Analizar foto
                      </button>
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 flex items-center gap-3">
                    <span className="text-2xl">🛰️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-700">NDVI e Inteligencia de campo</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Disponible desde el plan Latifundio.</p>
                    </div>
                    <a href="/dashboard/planes" className="shrink-0 text-[9px] font-black px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all whitespace-nowrap">
                      Ver planes
                    </a>
                  </div>
                )}

                {/* ══ HISTORIAL DE REGISTROS (sólo en Tab Registros — resumen rápido) ══ */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className={LABEL_CLS}>Últimos registros</p>
                    {notesLoading && <Loader2 className="w-3 h-3 text-green-500 animate-spin" />}
                  </div>

                  {notes.length === 0 && !notesLoading && (
                    <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed border-gray-200">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2.5">
                        <Mic className="w-5 h-5 text-gray-300" />
                      </div>
                      <p className="text-xs font-bold text-gray-400">Sin registros aún</p>
                      <p className="text-[9px] text-gray-300 mt-1">Usá los botones de arriba para capturar</p>
                    </div>
                  )}

                  {notes.length > 0 && (
                    <div className="space-y-2">
                      {notes.slice(0, 3).map(note => {
                        if (deletedNotes[note.id]) return null
                        const { tags, primary } = getCat(note)
                        const { Icon: CatIcon } = primary
                        const hasAudio = !!note.audio_url
                        const hasPhoto = !!note.photo_url
                        const hasAI    = !!note.analysis_result?.dry_matter_kg_ha
                        return (
                          <div key={note.id} className="flex gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${hasAudio ? 'bg-red-50 border-red-200' : hasPhoto ? 'bg-green-50 border-green-200' : `${primary.bg} ${primary.border}`}`}>
                              {hasAudio ? <Mic className="w-3 h-3 text-red-500" /> : hasPhoto ? <Camera className="w-3 h-3 text-green-600" /> : <CatIcon className="w-3 h-3" style={{ color: primary.color }} />}
                            </div>
                            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-3 py-2">
                              <div className="flex flex-wrap gap-1 mb-0.5">
                                {tags.map(t => { const c = CAT_CONFIG[t] || CAT_CONFIG.GENERAL; return <span key={t} className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${c.badge}`}>{c.label}</span> })}
                                {hasAI && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase">IA</span>}
                              </div>
                              <p className="text-[11px] font-black text-gray-900 leading-tight">{note.title}</p>
                              <p className="text-[8px] text-gray-300 font-medium mt-0.5">{fmtDate(note.created_at)}</p>
                            </div>
                          </div>
                        )
                      })}
                      {notes.length > 3 && (
                        <button type="button" onClick={() => setActiveTab('historial')}
                          className="w-full text-[10px] font-bold text-green-600 hover:text-green-800 py-1.5 text-center transition-colors">
                          Ver todos los registros ({notes.length}) →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
          )}
          {/* ════ TAB 4 — HISTORIAL ════ */}
          {activeTab === 'historial' && (
            <div className="px-6 py-5 space-y-5">

              {/* ══ NDVI SATELITAL — diferenciado con badge y estilo esmeralda ══ */}
              {paddockSnapshots.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">NDVI Satelital</span>
                    <div className="flex-1 h-px bg-emerald-100" />
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <span className="text-[10px]">🛰️</span> Cada 5 días
                    </span>
                  </div>
                  <div className="space-y-2">
                    {paddockSnapshots.map((snap: any, i: number) => {
                      const ndvi = Number(snap.ndvi)
                      const ndviBg = ndvi >= 0.6 ? 'bg-emerald-50 border-emerald-200' : ndvi >= 0.4 ? 'bg-green-50 border-green-200' : ndvi >= 0.2 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                      const ndviTxt = ndvi >= 0.6 ? 'text-emerald-700' : ndvi >= 0.4 ? 'text-green-700' : ndvi >= 0.2 ? 'text-amber-700' : 'text-red-700'
                      const ndviLabel = ndvi >= 0.6 ? 'Óptimo' : ndvi >= 0.4 ? 'Bueno' : ndvi >= 0.2 ? 'Regular' : 'Bajo'
                      return (
                        <div key={i} className={`flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl border ${ndviBg}`}>
                          <div className="flex items-center gap-2">
                            {/* Distinctive satellite icon for NDVI entries */}
                            <div className="w-7 h-7 rounded-lg bg-white/70 border border-current/20 flex items-center justify-center text-[13px]" title="Medición satelital Sentinel-2">🛰️</div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border bg-white/60 ${ndviTxt}`}>{ndviLabel}</span>
                                <span className="text-[8px] font-bold text-gray-400 bg-white/60 border border-gray-200 px-1.5 py-0.5 rounded-full">Sentinel-2</span>
                              </div>
                              <p className="text-xs font-bold text-gray-700 mt-0.5">{new Date(snap.calculated_at).toLocaleDateString('es-AR')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">NDVI</p>
                              <p className={`text-base font-black ${ndviTxt}`}>{ndvi.toFixed(3)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Crecimiento</p>
                              <p className="text-base font-black text-gray-900">{Number(snap.grass_growth_rate).toFixed(1)} <span className="text-xs font-bold text-gray-400">kg/d</span></p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ══ REGISTROS DE CAMPO (notas, audios, fotos) ══ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">Registros de campo</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  {notesLoading && <Loader2 className="w-3 h-3 text-green-500 animate-spin" />}
                </div>

                {notes.length === 0 && !notesLoading && paddockSnapshots.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed border-gray-200">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2.5">
                      <Mic className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-400">Sin historial aún</p>
                    <p className="text-[9px] text-gray-300 mt-1">Los registros y mediciones NDVI aparecerán aquí</p>
                  </div>
                )}

                {notes.length === 0 && !notesLoading && paddockSnapshots.length > 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-4">No hay registros de campo para este potrero.</p>
                )}

                {notes.length > 0 && (
                  <div className="relative">
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />
                    <div className="space-y-3">
                      {notes.map(note => {
                        if (deletedNotes[note.id]) {
                          return (
                            <div key={note.id} className="flex items-center gap-3 pl-10 opacity-30">
                              <p className="text-[9px] text-gray-400 italic">Registro eliminado</p>
                            </div>
                          )
                        }
                        const { tags, primary } = getCat(note)
                        const { Icon: CatIcon } = primary
                        const isOwner = !user || note.created_by === user?.id || note.created_by === user?.uid
                        const hasAudio = !!note.audio_url
                        const hasPhoto = !!note.photo_url
                        const hasAI    = !!note.analysis_result?.dry_matter_kg_ha

                        return (
                          <div key={note.id} className="flex gap-2.5 group">
                            {/* Timeline node */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 z-10 border ${hasAudio ? 'bg-red-50 border-red-200' : hasPhoto ? 'bg-green-50 border-green-200' : `${primary.bg} ${primary.border}`}`}>
                              {hasAudio ? <Mic className="w-3.5 h-3.5 text-red-500" /> : hasPhoto ? <Camera className="w-3.5 h-3.5 text-green-600" /> : <CatIcon className="w-3.5 h-3.5" style={{ color: primary.color }} />}
                            </div>
                            {/* Card */}
                            <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-all">
                              <div className="px-3 pt-2.5 pb-2 flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {tags.map(t => { const c = CAT_CONFIG[t] || CAT_CONFIG.GENERAL; return <span key={t} className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${c.badge}`}>{c.label}</span> })}
                                    {hasAudio && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">Audio</span>}
                                    {hasAI && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase">IA</span>}
                                  </div>
                                  <h4 className="text-[11px] font-black text-gray-900 leading-tight">{note.title}</h4>
                                </div>
                                {isOwner && (
                                  <button type="button" onClick={() => deleteNote(note.id)}
                                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-md transition-all shrink-0">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {hasAudio && (
                                <div className="px-3 pb-2">
                                  <audio controls src={note.audio_url} className="w-full rounded-lg" style={{ height: '32px' }} />
                                </div>
                              )}
                              {hasPhoto && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={note.photo_url} alt="Evidencia" className="w-full max-h-32 object-cover" />
                              )}
                              {note.content && (
                                <div className="px-3 pb-2">
                                  <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-3">{note.content}</p>
                                </div>
                              )}
                              {hasAI && (
                                <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                                  {[
                                    { l: 'MS/ha', v: `${note.analysis_result.dry_matter_kg_ha} kg` },
                                    { l: 'Alt.', v: `${note.analysis_result.grass_height_cm ?? '—'} cm` },
                                    { l: 'Cob.', v: `${note.analysis_result.coverage_pct ?? '—'}%` },
                                  ].map(item => (
                                    <div key={item.l} className="bg-violet-50 rounded-lg px-2 py-1">
                                      <p className="text-[7px] text-violet-400 font-black uppercase">{item.l}</p>
                                      <p className="text-[10px] font-black text-violet-800">{item.v}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="px-3 pb-2">
                                <p className="text-[8px] text-gray-300 font-medium">{fmtDate(note.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — con contador de sesión */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          {!isCreating ? (
            <div className="flex flex-col gap-1.5">
              {/* Assign polygon — solo para potreros manuales sin georreferencia */}
              {!isGeo && onAssignPolygon && (
                <button
                  type="button"
                  onClick={() => { onAssignPolygon(paddock.id); onClose() }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" /> Asignar polígono en mapa
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: `¿Eliminar el potrero "${paddock.name}"?`,
                    description: 'Esta acción eliminará el potrero y todos sus registros asociados.',
                    confirmLabel: 'Eliminar potrero',
                    variant: 'danger',
                  })
                  if (ok) { onDelete?.(paddock.id); onClose() }
                }}
                className="text-sm font-bold text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          ) : <div />}

          <div className="flex gap-3 items-center">
            <button onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isCreating
                ? sessionNoteCount > 0 ? `Crear potrero (+${sessionNoteCount} registros)` : 'Crear potrero'
                : sessionNoteCount > 0 ? `Guardar (+${sessionNoteCount} nuevos)` : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
