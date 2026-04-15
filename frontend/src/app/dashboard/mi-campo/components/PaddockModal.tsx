'use client'

/**
 * PaddockModal — Modal de gestión de potrero (3 tabs)
 * Tipografía y campos unificados con el modal de Rebaños.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { X, Check, Loader2, Trash2, ChevronDown, ChevronUp, Mic, MicOff, Plus, BookOpen, MapPin, Wrench, Leaf, AlertTriangle, BarChart3, Droplets, Camera, Paperclip } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { SatelliteData } from '@/lib/services/satellite'

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
  ndviData?: SatelliteData
  onClose: () => void
  onSave: (
    paddockId: string,
    name: string,
    technicalData: Record<string, any>,
    dryMatter?: number,
    areaHa?: number,
  ) => Promise<void>
  onDelete?: (paddockId: string) => void
  isCreating?: boolean
  user?: any
  paddocks?: Paddock[]
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

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ─── Shared token strings ──────────────────────────────────────────────────
const LABEL_CLS  = 'text-[10px] font-black text-gray-400 tracking-widest uppercase'
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
  const containerRef      = useRef<HTMLDivElement>(null)

  const allOptions = [...new Set([...options, ...selected.filter(s => !options.includes(s))])]
  const filtered   = query.trim()
    ? allOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o))
    : allOptions.filter(o => !selected.includes(o)).slice(0, 8)
  const canAddCustom = allowCustom && query.trim() && !allOptions.some(o => o.toLowerCase() === query.trim().toLowerCase())

  const add    = (item: string) => { onChange([...selected, item]); setQuery('') }
  const remove = (item: string) => onChange(selected.filter(s => s !== item))

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={INPUT_CLS}
        />
        {open && (filtered.length > 0 || canAddCustom) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[10001] max-h-48 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onMouseDown={e => { e.preventDefault(); add(opt) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0"
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
                onMouseDown={e => { e.preventDefault(); add(query.trim()); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors font-bold"
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
  paddock, ndviData, onClose, onSave, onDelete, isCreating = false, user,
}: Props) {
  const [activeTab, setActiveTab] = useState<'operativo' | 'infraestructura' | 'registros'>('operativo')
  const [saving, setSaving]       = useState(false)

  // Tab 1
  const [name, setName]             = useState(paddock.name)
  const [areaHa, setAreaHa]         = useState<number | ''>(paddock.area_ha ?? '')
  const [msHa, setMsHa]             = useState<number | ''>(paddock.dry_matter_kg_ha ?? '')
  const [qualityScore, setQuality]  = useState<number>(paddock.technical_data?.quality_score ?? 5)
  const [grassTypes, setGrassTypes] = useState<string[]>(paddock.technical_data?.grass_types ?? [])
  const [weedTypes, setWeedTypes]   = useState<string[]>(paddock.technical_data?.weed_types ?? [])

  const totalMs = areaHa !== '' && msHa !== '' ? Number(areaHa) * Number(msHa) : null
  const isGeo   = Boolean(paddock.boundary || ndviData)

  const qualityBadgeCls = qualityScore >= 7
    ? 'bg-green-100 text-green-800 border-green-200'
    : qualityScore >= 4
    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
    : 'bg-red-100 text-red-800 border-red-200'

  const qualityDotCls = qualityScore >= 7 ? 'bg-green-500' : qualityScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'

  // Tab 2
  const [waterSources, setWaterSources]       = useState<string[]>(paddock.technical_data?.water_sources ?? [])
  const [fenceStatus, setFenceStatus]         = useState<string>(paddock.technical_data?.fence_status ?? '')
  const [accessList, setAccessList]           = useState<string[]>(paddock.technical_data?.access ?? [])
  const [hasElectricity, setHasElectricity]   = useState<boolean>(paddock.technical_data?.has_electricity ?? false)
  const [electricityType, setElectricityType] = useState<string>(paddock.technical_data?.electricity_type ?? '')
  const [hasPredators, setHasPredators]       = useState<boolean>(paddock.technical_data?.has_predators ?? false)

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
    if (activeTab === 'registros') loadNotes()
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
    const customWater = waterSources.filter(w => !WATER_SOURCES_DEFAULT.includes(w))
    const td: Record<string, any> = {
      ...(paddock.technical_data || {}),
      quality_score: qualityScore,
      grass_types: grassTypes,
      weed_types: weedTypes,
      water_sources: waterSources,
      water_sources_custom: customWater,
      fence_status: fenceStatus,
      access: accessList,
      has_electricity: hasElectricity,
      electricity_type: electricityType,
      has_predators: hasPredators,
      hasWater: waterSources.length > 0,
      waterType: waterSources[0] || undefined,
      hasPests: weedTypes.length > 0,
      weeds: weedTypes,
      hasInfraIssues: fenceStatus === 'none' || fenceStatus === 'poor',
      hasPredators,
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
    setAudioTranscript('')
    setAudioBlob(null); setAudioUrl(null)
    // SpeechRecognition para transcripción en vivo
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true; rec.interimResults = true; rec.lang = 'es-AR'
      rec.onresult = (e: any) => {
        let full = ''
        for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
        setAudioTranscript(full)
        if (!noteTitle) setNoteTitle(full.split('.')[0].slice(0, 60))
      }
      rec.start()
      speechRef.current = rec
    }
    // MediaRecorder para archivo de audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }
      mr.start()
      mediaRecorderRef.current = mr
    } catch { alert('No se pudo acceder al micrófono.') }
    setRecording(true)
  }, [noteTitle])

  const stopRecording = useCallback(() => {
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  // ── Guardar nota ───────────────────────────────────────────────────────────
  const saveQuickNote = useCallback(async () => {
    const content = noteText || audioTranscript
    if (!content && !noteImage && !audioBlob) return
    setNoteSaving(true)

    let photo_url: string | null = null
    if (noteImage) {
      const fd = new FormData()
      fd.append('file', noteImage)
      fd.append('folder', 'field-notes')
      const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (up.ok) ({ url: photo_url } = await up.json())
    }

    let audio_url: string | null = null
    if (audioBlob) {
      const fd = new FormData()
      fd.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
      fd.append('folder', 'field-notes-audio')
      const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (up.ok) ({ url: audio_url } = await up.json())
    }

    const title = noteTitle.trim() || content?.slice(0, 60) || noteImage?.name || 'Nota de campo'
    await apiFetch('/api/field-notes', {
      method: 'POST',
      body: JSON.stringify({
        paddock_id: paddock.id,
        category: noteResult ? 'BIOMASA' : 'GENERAL',
        tags: noteResult ? ['BIOMASA'] : ['GENERAL'],
        title,
        content: content || null,
        photo_url,
        audio_url,
        analysis_result: noteResult || null,
      }),
    })
    setNoteSaving(false); setNoteSaved(true)
    setNoteText(''); setAudioTranscript(''); setNoteMode(null); setNoteResult(null); setNoteImage(null)
    setNoteExpanded(false)
    setTimeout(() => setNoteSaved(false), 3000)
    loadNotes() // recarga el historial
  }, [noteText, audioTranscript, noteImage, noteResult, paddock.id, loadNotes, noteTitle, audioBlob])

  // ── Eliminar nota (solo creador) ─────────────────────────────────────────────
  const deleteNote = useCallback(async (noteId: string) => {
    if (!confirm('¿Eliminar este registro? Quedará marcado como eliminado en el historial.')) return
    await apiFetch(`/api/field-notes/${noteId}`, { method: 'DELETE' })
    setDeletedNotes(prev => ({ ...prev, [noteId]: new Date() }))
  }, [])

  const analyzeNoteImage = useCallback(async () => {
    if (!noteImage) return
    setNoteAnalyzing(true)
    try {
      const reader = new FileReader()
      const b64: string = await new Promise((res, rej) => { reader.onload = () => res((reader.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(noteImage) })
      const resp = await fetch('/api/analyze-biomass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mimeType: noteImage.type, area_ha: areaHa }) })
      setNoteResult(resp.ok ? await resp.json() : null)
    } catch {}
    setNoteAnalyzing(false)
  }, [noteImage, areaHa])

  const analyzeBio = useCallback(async () => {
    if (!bioPhoto) return
    setBioAnalyzing(true); setBioError(null); setBioResult(null)
    try {
      const reader = new FileReader()
      const b64: string = await new Promise((res, rej) => { reader.onload = () => res((reader.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(bioPhoto) })
      const resp = await fetch('/api/analyze-biomass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mimeType: bioPhoto.type, area_ha: areaHa }) })
      const data = resp.ok ? await resp.json() : null
      if (data?.dry_matter_kg_ha) { setBioResult(data); setMsHa(Math.round(data.dry_matter_kg_ha)) }
      else setBioError('No se pudo analizar la imagen.')
    } catch (e: any) { setBioError(e.message) }
    setBioAnalyzing(false)
  }, [bioPhoto, areaHa])

  const refreshNdvi = useCallback(async () => {
    setNdviRefreshing(true)
    try {
      const geoRes = await apiFetch(`/api/paddocks/${paddock.id}`)
      if (!geoRes.ok) return
      const { paddock: geo } = await geoRes.json()
      if (!geo?.boundary) return
      const resp = await fetch('/api/ndvi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geojson: geo.boundary, paddock_id: paddock.id }) })
      if (!resp.ok) return
      const res = await resp.json()
      await apiFetch(`/api/paddocks/${paddock.id}`, { method: 'PATCH', body: JSON.stringify({ current_ndvi: res.averageNdvi }) })
    } catch {}
    setNdviRefreshing(false)
  }, [paddock.id])

  const ndviStatus = (v: number) => v >= 0.6 ? 'Óptimo' : v >= 0.4 ? 'Bueno' : v >= 0.2 ? 'Regular' : 'Bajo'

  const tabs = [
    { id: 'operativo',       label: 'Datos operativos' },
    { id: 'infraestructura', label: 'Infraestructura'  },
    { id: 'registros',       label: 'Registros'        },
  ] as const

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header — mismo estilo que Rebaños */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-black text-gray-950">
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
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 text-[11px] font-black tracking-wide rounded-t-lg transition-all border-b-2 uppercase ${
                activeTab === id
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto">

          {/* ════ TAB 1 — DATOS OPERATIVOS ════ */}
          {activeTab === 'operativo' && (
            <div className="px-6 py-5 space-y-4">

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
                  <label className={LABEL_CLS}>
                    Superficie (ha){isGeo && <span className="ml-1 normal-case font-medium tracking-normal">· auto</span>}
                  </label>
                  <input
                    type="number" min="0" step="0.1" value={areaHa}
                    onChange={e => setAreaHa(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 50"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>MS disponible (kg MS/ha)</label>
                  <input
                    type="number" min="0" step="50" value={msHa}
                    onChange={e => setMsHa(e.target.value === '' ? '' : Number(e.target.value))}
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

              {/* Calidad relativa */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={LABEL_CLS}>Calidad relativa</label>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${qualityBadgeCls}`}>
                    {qualityScore}/10
                  </span>
                </div>
                <div className="relative">
                  <div className="w-full h-2 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 mb-1" />
                  <input
                    type="range" min={1} max={10} step={1} value={qualityScore}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-full cursor-pointer absolute top-0 opacity-0 h-2"
                  />
                  <div
                    className={`absolute -top-0.5 w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 transition-all ${qualityDotCls}`}
                    style={{ left: `${((qualityScore - 1) / 9) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-black text-gray-400 tracking-widest uppercase">
                  <span>Muy mala</span><span>Regular</span><span>Excelente</span>
                </div>
              </div>

              {/* Composición botánica */}
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <p className={LABEL_CLS}>Composición botánica</p>
                <SearchableMultiSelect
                  label="Tipo de pasto"
                  options={GRASS_TYPES}
                  selected={grassTypes}
                  onChange={setGrassTypes}
                  placeholder="Buscar tipo de pasto…"
                  allowCustom
                />
                <SearchableMultiSelect
                  label="Malezas"
                  options={WEED_TYPES}
                  selected={weedTypes}
                  onChange={setWeedTypes}
                  placeholder="Buscar maleza…"
                  allowCustom
                />
              </div>
            </div>
          )}

          {/* ════ TAB 2 — INFRAESTRUCTURA ════ */}
          {activeTab === 'infraestructura' && (
            <div className="px-6 py-5 space-y-5">

              <SearchableMultiSelect
                label="Agua disponible"
                options={WATER_SOURCES_DEFAULT}
                selected={waterSources}
                onChange={setWaterSources}
                placeholder="Buscar fuente de agua… (o escribir nueva)"
                allowCustom
              />

              {/* Alambrados */}
              <div className="space-y-2">
                <label className={LABEL_CLS}>Estado de alambrados</label>
                <div className="space-y-2">
                  {FENCE_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div
                        onClick={() => setFenceStatus(opt.value)}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          fenceStatus === opt.value ? 'border-green-600 bg-green-600' : 'border-gray-300'
                        }`}
                      >
                        {fenceStatus === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span
                        onClick={() => setFenceStatus(opt.value)}
                        className={`text-sm font-bold transition-colors ${fenceStatus === opt.value ? 'text-gray-900' : 'text-gray-500'}`}
                      >
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <SearchableMultiSelect
                label="Accesos y conectividad"
                options={ACCESS_OPTIONS_DEFAULT}
                selected={accessList}
                onChange={setAccessList}
                placeholder="Buscar tipo de acceso…"
                allowCustom
              />

              {/* Electricidad */}
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

              {/* Depredadores */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-gray-700">Presencia de depredadores</p>
                  <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mt-0.5">
                    {hasPredators ? 'Alerta activa' : 'Sin reportes'}
                  </p>
                </div>
                <Toggle checked={hasPredators} onChange={() => setHasPredators(v => !v)} />
              </div>
            </div>
          )}

          {/* ════ TAB 3 — REGISTROS ════ */}
          {activeTab === 'registros' && (
            <div className="flex flex-col" style={{ minHeight: 0 }}>

              {/* ── Quick Action Header ── "La Grabadora de Campo" ── */}
              <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[11px] font-black text-gray-800 tracking-tight">Grabadora de campo</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Captura instantánea de lo que pasa en el potrero</p>
                  </div>
                  {sessionNoteCount > 0 && (
                    <span className="flex items-center gap-1.5 bg-green-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm shadow-green-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                      +{sessionNoteCount} nuevos
                    </span>
                  )}
                </div>

                {/* Three big circular capture buttons */}
                <div className="grid grid-cols-3 gap-3">

                  {/* 🔴 Mic */}
                  <button type="button"
                    onClick={() => {
                      if (noteExpanded && noteMode === 'audio') { setNoteExpanded(false); setNoteMode(null) }
                      else { setNoteExpanded(true); setNoteMode('audio') }
                    }}
                    className={`relative flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all select-none ${
                      noteMode === 'audio' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/40'
                    }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      noteMode === 'audio' ? 'bg-red-500 shadow-lg shadow-red-200' : 'bg-red-100'
                    }`}>
                      {recording
                        ? <MicOff className={`w-5 h-5 ${noteMode === 'audio' ? 'text-white' : 'text-red-500'}`} />
                        : <Mic className={`w-5 h-5 ${noteMode === 'audio' ? 'text-white' : 'text-red-500'}`} />}
                    </div>
                    <span className="text-[10px] font-black text-gray-600 tracking-wide">
                      {recording ? 'GRABANDO' : 'AUDIO'}
                    </span>
                    {recording && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping" />}
                  </button>

                  {/* 🟢 Camera */}
                  <button type="button"
                    onClick={() => {
                      if (noteExpanded && noteMode === 'image') { setNoteExpanded(false); setNoteMode(null) }
                      else { setNoteExpanded(true); setNoteMode('image') }
                    }}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all select-none ${
                      noteMode === 'image' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/40'
                    }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      noteMode === 'image' ? 'bg-green-500 shadow-lg shadow-green-200' : 'bg-green-100'
                    }`}>
                      <Camera className={`w-5 h-5 ${noteMode === 'image' ? 'text-white' : 'text-green-600'}`} />
                    </div>
                    <span className="text-[10px] font-black text-gray-600 tracking-wide">FOTO</span>
                  </button>

                  {/* ⚫ Keyboard / Text */}
                  <button type="button"
                    onClick={() => {
                      if (noteExpanded && noteMode === 'text') { setNoteExpanded(false); setNoteMode(null) }
                      else { setNoteExpanded(true); setNoteMode('text') }
                    }}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all select-none ${
                      noteMode === 'text' ? 'border-gray-500 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                    }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      noteMode === 'text' ? 'bg-gray-700 shadow-lg shadow-gray-200' : 'bg-gray-100'
                    }`}>
                      <BookOpen className={`w-5 h-5 ${noteMode === 'text' ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <span className="text-[10px] font-black text-gray-600 tracking-wide">TEXTO</span>
                  </button>
                </div>

                {/* ── Expanded capture form ── */}
                {noteExpanded && (
                  <div className="mt-4 space-y-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <input type="text" value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
                      placeholder="Título del registro (opcional)…" className={INPUT_CLS} />

                    {/* TEXT */}
                    {noteMode === 'text' && (
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                        placeholder="Escribí tu observación de campo…" rows={3} autoFocus
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:ring-1 focus:ring-green-600 outline-none resize-none transition-all" />
                    )}

                    {/* IMAGE */}
                    {noteMode === 'image' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => noteImageRef.current?.click()}
                            className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:text-green-700 transition-colors bg-gray-50">
                            <Paperclip className="w-4 h-4" /> Galería
                          </button>
                          <button type="button" onClick={() => noteCameraRef.current?.click()}
                            className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-all">
                            <Camera className="w-4 h-4" /> Cámara
                          </button>
                        </div>
                        <input ref={noteImageRef} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) { setNoteImage(f); setNoteImagePreview(URL.createObjectURL(f)); setNoteResult(null) } }} />
                        <input ref={noteCameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) { setNoteImage(f); setNoteImagePreview(URL.createObjectURL(f)); setNoteResult(null) } }} />
                        {noteImagePreview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={noteImagePreview} alt="preview" className="w-full max-h-44 object-cover rounded-xl" />
                        )}
                        {noteImage && (
                          <button type="button" onClick={analyzeNoteImage} disabled={noteAnalyzing}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-100 disabled:opacity-50 transition-all">
                            {noteAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>✨</span>}
                            {noteAnalyzing ? 'Analizando con IA…' : 'Analizar biomasa con IA'}
                          </button>
                        )}
                        {noteResult && (
                          <div className="bg-violet-50 px-4 py-3 rounded-xl border border-violet-200 flex items-center gap-3">
                            <span className="text-2xl">🌿</span>
                            <div>
                              <p className="text-[10px] font-black text-violet-500 tracking-widest uppercase">Resultado IA · Gemini</p>
                              <p className="text-lg font-black text-violet-900">{Number(noteResult.dry_matter_kg_ha).toLocaleString('es')} kg MS/ha</p>
                            </div>
                          </div>
                        )}
                        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Descripción adicional (optativo)…" rows={2}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:ring-1 focus:ring-green-600 outline-none resize-none" />
                      </div>
                    )}

                    {/* AUDIO */}
                    {noteMode === 'audio' && (
                      <div className="space-y-3">
                        <button type="button" onClick={recording ? stopRecording : startRecording}
                          className={`w-full flex items-center justify-center gap-2.5 py-4 text-sm font-black rounded-2xl transition-all ${
                            recording ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}>
                          {recording ? <><MicOff className="w-5 h-5" /> Detener</> : <><Mic className="w-5 h-5" /> Grabar ahora</>}
                        </button>
                        {recording && (
                          <div className="flex items-center justify-center gap-3 py-2">
                            <div className="flex items-end gap-0.5 h-8">
                              {[3,6,4,8,5,7,3,6,5,4].map((h, i) => (
                                <div key={i} className="w-1 bg-red-500 rounded-full animate-bounce"
                                  style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms`, animationDuration: '0.65s' }} />
                              ))}
                            </div>
                            <span className="text-[10px] font-black text-red-600 tracking-widest uppercase">Grabando…</span>
                          </div>
                        )}
                        {audioTranscript && (
                          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <p className={LABEL_CLS}>Transcripción en vivo</p>
                            <p className="text-sm font-medium text-gray-700 mt-1 italic">&ldquo;{audioTranscript}&rdquo;</p>
                          </div>
                        )}
                        {audioUrl && !recording && (
                          <div className="space-y-1.5">
                            <p className={LABEL_CLS}>Audio grabado — listo para guardar</p>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio controls src={audioUrl} className="w-full rounded-xl" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save / Cancel */}
                    <div className="flex items-center gap-2 pt-1">
                      {(noteText || audioTranscript || noteImage || audioBlob) && (
                        <button type="button"
                          onClick={async () => { await saveQuickNote(); setSessionNoteCount(c => c + 1) }}
                          disabled={noteSaving}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-black bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all">
                          {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {noteSaving ? 'Guardando…' : 'Guardar registro'}
                        </button>
                      )}
                      <button type="button"
                        onClick={() => {
                          setNoteExpanded(false); setNoteMode(null)
                          setNoteTitle(''); setNoteText(''); setAudioTranscript('')
                          setNoteImage(null); setNoteImagePreview(null)
                          setAudioBlob(null); setAudioUrl(null)
                        }}
                        className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 bg-gray-100 rounded-xl transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Intelligence Cards — always visible ── */}
              <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                <p className={`${LABEL_CLS} mb-3`}>Inteligencia de campo</p>
                <div className="grid grid-cols-2 gap-3">

                  {/* Card A — NDVI */}
                  <div className={`rounded-2xl border p-4 ${
                    currentNdvi != null
                      ? currentNdvi >= 0.4 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-black tracking-widest uppercase text-gray-500">NDVI Actual</p>
                      <span className="text-[8px] font-bold text-gray-400">Sentinel-2</span>
                    </div>
                    {currentNdvi != null ? (
                      <>
                        <p className={`text-2xl font-black leading-none ${
                          currentNdvi >= 0.6 ? 'text-green-700' : currentNdvi >= 0.4 ? 'text-amber-600' : 'text-red-600'
                        }`}>{Number(currentNdvi).toFixed(3)}</p>
                        <p className="text-[10px] font-bold text-gray-500 mt-0.5">{ndviStatus(currentNdvi)}</p>
                        <div className="w-full h-1.5 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-green-500 mt-2" />
                      </>
                    ) : (
                      <p className="text-xs font-bold text-gray-400 mt-1">Sin datos</p>
                    )}
                    {isGeo && (
                      <button type="button" onClick={refreshNdvi} disabled={ndviRefreshing}
                        className="mt-2.5 text-[10px] font-black text-gray-400 hover:text-green-700 flex items-center gap-1 transition-colors disabled:opacity-50">
                        {ndviRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>↻</span>}
                        {ndviRefreshing ? 'Actualizando…' : 'Actualizar'}
                      </button>
                    )}
                    {!isGeo && <p className="text-[9px] text-gray-400 mt-2 italic">Sin georreferencia</p>}
                  </div>

                  {/* Card B — IA Biomass */}
                  <div className="rounded-2xl border bg-violet-50 border-violet-200 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-black tracking-widest uppercase text-violet-500">Estado MS (IA)</p>
                      <span className="text-[8px] font-bold text-violet-400">Gemini</span>
                    </div>
                    {bioResult ? (
                      <>
                        <p className="text-2xl font-black text-violet-800 leading-none">{Number(bioResult.dry_matter_kg_ha).toLocaleString('es')}</p>
                        <p className="text-[10px] font-bold text-violet-600 mt-0.5">kg MS/ha</p>
                        {bioResult.coverage_pct && <p className="text-[9px] text-violet-400">Cobertura: {bioResult.coverage_pct}%</p>}
                      </>
                    ) : msHa ? (
                      <>
                        <p className="text-2xl font-black text-violet-700 leading-none">{Number(msHa).toLocaleString('es')}</p>
                        <p className="text-[10px] font-bold text-violet-500 mt-0.5">kg MS/ha · Manual</p>
                      </>
                    ) : (
                      <p className="text-xs font-bold text-violet-400 mt-1">Sin análisis aún</p>
                    )}
                    <button type="button"
                      onClick={() => { setNoteExpanded(true); setNoteMode('image') }}
                      className="mt-2.5 text-[10px] font-black text-violet-600 hover:text-violet-800 flex items-center gap-1 transition-colors">
                      ✨ Analizar nueva foto
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Timeline — Historial de Evidencias ── */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className={LABEL_CLS}>Historial de evidencias</p>
                  {notesLoading && <Loader2 className="w-3.5 h-3.5 text-green-500 animate-spin" />}
                </div>

                {notes.length === 0 && !notesLoading && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                      <Mic className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-400">Sin registros aún</p>
                    <p className="text-[10px] text-gray-300 mt-1">Usá los botones de arriba para capturar</p>
                  </div>
                )}

                {/* Feed con línea de tiempo izquierda */}
                <div className="relative">
                  {notes.filter(n => !deletedNotes[n.id]).length > 0 && (
                    <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gray-100" />
                  )}
                  <div className="space-y-4">
                    {notes.map(note => {
                      if (deletedNotes[note.id]) {
                        return (
                          <div key={note.id} className="flex items-center gap-3 pl-10 opacity-30">
                            <p className="text-[10px] text-gray-400 italic">Registro eliminado</p>
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
                        <div key={note.id} className="flex gap-3 group">
                          {/* Timeline node */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 border ${
                            hasAudio ? 'bg-red-50 border-red-200' : hasPhoto ? 'bg-green-50 border-green-200' : `${primary.bg} ${primary.border}`
                          }`}>
                            {hasAudio
                              ? <Mic className="w-4 h-4 text-red-500" />
                              : hasPhoto
                              ? <Camera className="w-4 h-4 text-green-600" />
                              : <CatIcon className="w-4 h-4" style={{ color: primary.color }} />}
                          </div>

                          {/* Card */}
                          <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                            {/* Header */}
                            <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {tags.map(t => {
                                    const c = CAT_CONFIG[t] || CAT_CONFIG.GENERAL
                                    return <span key={t} className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${c.badge}`}>{c.label}</span>
                                  })}
                                  {hasAudio && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-widest">Audio</span>}
                                  {hasAI && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-widest">IA Analizada</span>}
                                </div>
                                <h4 className="text-xs font-black text-gray-900 leading-snug">{note.title}</h4>
                              </div>
                              {isOwner && (
                                <button type="button" onClick={() => deleteNote(note.id)}
                                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Audio player */}
                            {hasAudio && (
                              <div className="px-4 pb-3">
                                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                <audio controls src={note.audio_url} className="w-full rounded-lg" style={{ height: '36px' }} />
                              </div>
                            )}

                            {/* Photo */}
                            {hasPhoto && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={note.photo_url} alt="Evidencia" className="w-full max-h-40 object-cover" />
                            )}

                            {/* Text */}
                            {note.content && (
                              <div className="px-4 pb-3">
                                <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{note.content}</p>
                              </div>
                            )}

                            {/* AI chips */}
                            {hasAI && (
                              <div className="px-4 pb-3 flex gap-2 flex-wrap">
                                {[
                                  { l: 'MS/ha', v: `${note.analysis_result.dry_matter_kg_ha} kg` },
                                  { l: 'Alt.', v: `${note.analysis_result.grass_height_cm ?? '—'} cm` },
                                  { l: 'Cobertura', v: `${note.analysis_result.coverage_pct ?? '—'}%` },
                                ].map(item => (
                                  <div key={item.l} className="bg-violet-50 rounded-lg px-2.5 py-1.5">
                                    <p className="text-[8px] text-violet-400 font-black uppercase">{item.l}</p>
                                    <p className="text-[11px] font-black text-violet-800">{item.v}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Timestamp */}
                            <div className="px-4 pb-3">
                              <p className="text-[9px] text-gray-300 font-medium">{fmtDate(note.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Footer — con contador de sesión */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          {!isCreating ? (
            <button
              type="button"
              onClick={() => { if (window.confirm(`¿Eliminar el potrero "${paddock.name}"?`)) { onDelete?.(paddock.id); onClose() } }}
              className="text-sm font-bold text-red-500 hover:text-red-700 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
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
}
