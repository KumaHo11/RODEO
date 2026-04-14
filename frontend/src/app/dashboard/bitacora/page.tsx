'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineIndicator'
import {
  NotebookPen, Mic, MicOff, Camera, MapPin, X, Plus,
  Wrench, Leaf, AlertTriangle, BookOpen, Loader2, Sparkles,
  BarChart3, Droplets, CheckCircle2, AlertCircle,
  SortDesc, SortAsc, Filter, Search, Pencil, Calendar, CheckSquare2,
  Image as ImageIcon, Footprints, HeartPulse, Check
} from 'lucide-react'
import { Button } from '@/design-system'

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'INFRAESTRUCTURA',
    label: 'Infraestructura',
    icon: Wrench,
    color: '#0891b2',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-800',
    badge: 'bg-cyan-100 text-cyan-800',
    keywords: ['alambre', 'tranquera', 'aguada', 'bomba', 'molino', 'alambrado', 'cerco', 'puerta', 'rotunda'],
  },
  {
    id: 'SANIDAD_VEGETAL',
    label: 'Sanidad vegetal',
    icon: Leaf,
    color: '#16a34a',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    keywords: ['maleza', 'plaga', 'yuyo', 'cardillo', 'tóxica', 'toxica', 'pasto', 'hierba', 'monte'],
  },
  {
    id: 'RESTRICCION',
    label: 'Restricción de uso',
    icon: AlertTriangle,
    color: '#dc2626',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    keywords: ['inundado', 'clausurado', 'siembra', 'restringido', 'cerrado', 'prohibido'],
  },
  {
    id: 'BIOMASA',
    label: 'Análisis biomasa',
    icon: BarChart3,
    color: '#7c3aed',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-800',
    badge: 'bg-violet-100 text-violet-800',
    keywords: ['biomasa', 'materia seca', 'ms/ha', 'forraje', 'altura pasto'],
  },
  {
    id: 'HIDRICO',
    label: 'Hídrico',
    icon: Droplets,
    color: '#0369a1',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
    badge: 'bg-sky-100 text-sky-800',
    keywords: ['agua', 'bebedero', 'inundado', 'seco', 'lluvia', 'cañada', 'humedal'],
  },
  {
    id: 'GANADO',
    label: 'Condición Corporal',
    icon: Footprints,
    color: '#b45309',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800',
    keywords: ['ganado', 'animal', 'condición', 'bcs', 'flaco', 'gordo', 'ternero', 'vaca', 'toro'],
  },
  {
    id: 'GENERAL',
    label: 'General',
    icon: BookOpen,
    color: '#374151',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    badge: 'bg-gray-100 text-gray-800',
    keywords: [],
  },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

function detectTags(text: string): string[] {
  const lower = text.toLowerCase()
  const detected = CATEGORIES.filter(cat =>
    cat.keywords.length > 0 && cat.keywords.some(kw => lower.includes(kw))
  ).map(c => c.id)
  return detected.length > 0 ? detected : ['GENERAL']
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CONDITION_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  OPTIMO:  { color: 'text-green-700',  bg: 'bg-green-50',   icon: CheckCircle2 },
  BUENO:   { color: 'text-lime-700',   bg: 'bg-lime-50',    icon: CheckCircle2 },
  REGULAR: { color: 'text-amber-700',  bg: 'bg-amber-50',   icon: AlertCircle },
  BAJO:    { color: 'text-red-700',    bg: 'bg-red-50',     icon: AlertCircle },
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve({ base64: dataUrl.split(',')[1], mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BitacoraPage() {
  const { user } = useAuth()

  const [notes, setNotes] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterPaddock, setFilterPaddock] = useState('all')
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)

  // Form modal
  const [isOpen, setIsOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    paddock_id: '',
    tags: ['GENERAL'] as string[],
    title: '',
    content: '',
    lat: null as number | null,
    lng: null as number | null,
  })

  // Voice
  const [isRecording, setIsRecording]     = useState(false)
  const [transcript, setTranscript]       = useState('')
  const [voiceLang, setVoiceLang]         = useState('es-AR')
  const recognitionRef                    = useRef<any>(null)
  const [voiceSupported, setVoiceSupported] = useState(false)
  // Audio recording (MediaRecorder)
  const mediaRecorderRef                  = useRef<MediaRecorder | null>(null)
  const audioChunksRef                    = useRef<Blob[]>([])
  const [audioBlob, setAudioBlob]         = useState<Blob | null>(null)
  const audioGcsUrlRef = useRef<string | null>(null) // ref avoids stale closure in handleSave
  const [audioUrl, setAudioUrl]           = useState<string | null>(null)
  const [audioGcsUploaded, setAudioGcsUploaded] = useState(false) // UI indicator only
  const [audioUploading, setAudioUploading] = useState(false)

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)     // gallery
  const cameraInputRef = useRef<HTMLInputElement>(null)   // native camera

  // Photo analysis mode
  const [photoMode, setPhotoMode] = useState<'biomasa' | 'bcs'>('biomasa')

  // Biomass AI
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<any | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [applyingToPaddock, setApplyingToPaddock] = useState(false)
  const [paddockUpdated, setPaddockUpdated] = useState(false)

  // BCS AI
  const [bcsResult, setBcsResult] = useState<any | null>(null)
  const [bcsError, setBcsError] = useState<string | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [notesRes, paddocksRes] = await Promise.all([
      apiFetch('/api/field-notes'),
      apiFetch('/api/paddocks'),
    ])
    setNotes(notesRes.ok ? (await notesRes.json()).notes || [] : [])
    setPaddocks(paddocksRes.ok ? (await paddocksRes.json()).paddocks || [] : [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { setVoiceSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) }, [])

  // ── Available months derived from notes ───────────────────────────────────
  const availableMonths = useMemo(() => {
    const months = new Set<number>()
    notes.forEach(n => months.add(new Date(n.created_at).getMonth()))
    return Array.from(months).sort((a, b) => a - b)
  }, [notes])

  // ── Voice ───────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    // Start Speech Recognition for transcript
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = voiceLang
      rec.onresult = (e: any) => {
        let full = ''
        for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
        setTranscript(full)
        const detectedTags = detectTags(full)
        setForm(prev => ({
          ...prev,
          content: full,
          tags: detectedTags,
          title: prev.title || full.split('.')[0].slice(0, 60),
        }))
      }
      rec.start()
      recognitionRef.current = rec
    }
    // Simultaneously capture MediaRecorder audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
        // Upload to GCS
        try {
          setAudioUploading(true)
          const fd = new FormData()
          fd.append('file', new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
          fd.append('folder', 'bitacora-audio')
          const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (res.ok) {
            const { url } = await res.json()
            audioGcsUrlRef.current = url  // sync ref — safe in handleSave
            setAudioGcsUploaded(true)     // trigger UI update
          }
        } catch (err) { console.warn('Audio upload failed:', err) }
        finally { setAudioUploading(false) }
      }
      mr.start()
      mediaRecorderRef.current = mr
    } catch (err) {
      console.warn('MediaRecorder not available:', err)
    }
    setIsRecording(true)
    setTranscript('')
    setAudioBlob(null)
    setAudioUrl(null)
  }

  const stopRecording = async () => {
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    // Audio blob will be ready after onstop fires (~200ms)
    // Upload happens in onstop handler below
  }

  const downloadAudio = () => {
    if (!audioBlob) return
    const a = document.createElement('a')
    a.href = audioUrl!
    a.download = `bitacora-audio-${Date.now()}.webm`
    a.click()
  }

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setForm(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }))
    })
  }

  // ── Photo ───────────────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAiResult(null)
    setAiError(null)
  }

  // ── Gemini BCS Analysis ───────────────────────────────────────────────────
  const handleAnalyzeBodyCondition = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setBcsResult(null)
    setBcsError(null)
    setAnalysisStep(0)
    const t1 = setTimeout(() => setAnalysisStep(1), 900)
    const t2 = setTimeout(() => setAnalysisStep(2), 2200)
    try {
      const { base64, mimeType } = await fileToBase64(photoFile)
      const res = await fetch('/api/analyze-body-condition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, species: 'bovino' }),
      })
      const json = await res.json()
      clearTimeout(t1); clearTimeout(t2)
      setAnalysisStep(2)
      if (!json.success) throw new Error(json.error)
      setBcsResult(json.data)
      setForm(prev => ({
        ...prev,
        tags: Array.from(new Set([...prev.tags.filter(t => t !== 'GENERAL'), 'GANADO'])),
        title: prev.title || `CC ${json.data.bcs_score} — ${json.data.condition_label}`,
        content: prev.content || `Condición corporal: ${json.data.bcs_score}/${json.data.bcs_scale} (${json.data.condition_label})\n${json.data.condition_es}\n${json.data.recommendation || ''}`,
      }))
    } catch (err: any) {
      clearTimeout(t1); clearTimeout(t2)
      setBcsError(err.message || 'Error en análisis de condición corporal')
    }
    setAnalyzing(false)
  }

  // ── Gemini Biomass Analysis — with progress stepper ──────────────────────────
  const handleAnalyzeBiomass = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setAiResult(null)
    setAiError(null)
    setAnalysisStep(0)
    setPaddockUpdated(false)
    // Cycle through steps with timing
    const t1 = setTimeout(() => setAnalysisStep(1), 900)
    const t2 = setTimeout(() => setAnalysisStep(2), 2200)
    try {
      const { base64, mimeType } = await fileToBase64(photoFile)
      const res = await fetch('/api/analyze-biomass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })
      const json = await res.json()
      clearTimeout(t1); clearTimeout(t2)
      setAnalysisStep(2)
      if (!json.success) throw new Error(json.error)
      setAiResult(json.data)
      setForm(prev => ({
        ...prev,
        tags: Array.from(new Set([...prev.tags.filter(t => t !== 'GENERAL'), 'BIOMASA'])),
        title: prev.title || `Remanente — ${json.data.condition_label || json.data.condition || 'Análisis IA'}`,
        content: prev.content || `MS disponible: ${json.data.dry_matter_kg_ha} kg/ha · Altura: ${json.data.grass_height_cm} cm · Cobertura: ${json.data.coverage_pct}%\n${json.data.recommendation || ''}`,
      }))
    } catch (err: any) {
      clearTimeout(t1); clearTimeout(t2)
      setAiError(err.message || 'Error en el análisis')
    }
    setAnalyzing(false)
  }

  // ── Apply AI result directly to the selected paddock ─────────────────────────
  const handleApplyToPaddock = async () => {
    if (!aiResult || !form.paddock_id) return
    setApplyingToPaddock(true)
    await apiFetch(`/api/paddocks/${form.paddock_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dry_matter_kg_ha: aiResult.dry_matter_kg_ha }),
    })
    setApplyingToPaddock(false)
    setPaddockUpdated(true)
  }

  // ── Tag toggle in form ──────────────────────────────────────────────────────
  const toggleFormTag = (tagId: string) => {
    setForm(prev => {
      const has = prev.tags.includes(tagId)
      let next: string[]
      if (has) {
        next = prev.tags.filter(t => t !== tagId)
        if (next.length === 0) next = ['GENERAL']
      } else {
        next = [...prev.tags.filter(t => t !== 'GENERAL'), tagId]
      }
      return { ...prev, tags: next }
    })
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const [savedOffline, setSavedOffline] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    setSaving(true)

    // Offline queue (unchanged)
    if (!navigator.onLine) {
      addToOfflineQueue({
        type: 'field_note',
        data: {
          created_by: user?.uid,
          paddock_id: form.paddock_id || null,
          tags: form.tags,
          category: form.tags[0],
          title: form.title, content: form.content || null,
          lat: form.lat, lng: form.lng, sync_status: 'PENDING',
        },
        timestamp: Date.now(),
      })
      setSaving(false)
      setSavedOffline(true)
      setTimeout(() => { setSavedOffline(false); setIsOpen(false); resetForm() }, 2000)
      return
    }

    // Photo upload via /api/upload (FormData multipart)
    let photo_url: string | null = null
    if (photoFile) {
      const fd = new FormData()
      fd.append('file', photoFile)
      fd.append('folder', 'field-notes')
      const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (uploadRes.ok) {
        const { url } = await uploadRes.json()
        photo_url = url
      }
    }

    const biomassData = aiResult ? {
      analysis_result: aiResult,
      tags: Array.from(new Set([...form.tags, 'BIOMASA'])),
    } : {}

    if (editingNote) {
      await apiFetch(`/api/field-notes/${editingNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paddock_id: form.paddock_id || null,
          tags: form.tags,
          title: form.title,
          content: form.content || null,
          lat: form.lat,
          lng: form.lng,
          photo_url: photo_url || editingNote.photo_url,
          ...biomassData,
        }),
      })
    } else {
      await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          paddock_id: form.paddock_id || null,
          tags: (biomassData as any).tags || form.tags,
          title: form.title,
          content: form.content || null,
          lat: form.lat, lng: form.lng,
          photo_url,
          audio_url: audioGcsUrlRef.current || null,
          analysis_result: aiResult || null,
        }),
      })
    }

    setSaving(false)
    setIsOpen(false)
    resetForm()
    loadData()
  }

  const resetForm = () => {
    setForm({ paddock_id: '', tags: ['GENERAL'], title: '', content: '', lat: null, lng: null })
    setTranscript('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setAiResult(null)
    setAiError(null)
    setBcsResult(null)
    setBcsError(null)
    setAudioBlob(null)
    setAudioUrl(null)
    audioGcsUrlRef.current = null
    setAudioGcsUploaded(false)
    setApplyingToPaddock(false)
    setPaddockUpdated(false)
    setEditingNote(null)
    setPhotoMode('biomasa')
    stopRecording()
  }

  const openEdit = (note: any) => {
    const tags = Array.isArray(note.tags) && note.tags.length > 0
      ? note.tags
      : [note.category || 'GENERAL']
    setEditingNote(note)
    setForm({
      paddock_id: note.paddock_id || '',
      tags,
      title: note.title || '',
      content: note.content || '',
      lat: note.lat != null ? Number(note.lat) : null,
      lng: note.lng != null ? Number(note.lng) : null,
    })
    setPhotoPreview(note.photo_url || null)
    setAiResult(note.analysis_result || null)
    setIsOpen(true)
  }

  // ── Filtering + sorting ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = notes.filter(n => {
      // Tag filter: note must include ALL selected tags
      const noteTags: string[] = Array.isArray(n.tags) && n.tags.length > 0
        ? n.tags : [n.category || 'GENERAL']
      if (filterTags.length > 0 && !filterTags.some(t => noteTags.includes(t))) return false
      if (filterPaddock !== 'all' && n.paddock_id !== filterPaddock) return false
      if (filterMonth !== null && new Date(n.created_at).getMonth() !== filterMonth) return false
      if (search && !n.title?.toLowerCase().includes(search.toLowerCase()) && !n.content?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    result = [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return newestFirst ? tb - ta : ta - tb
    })
    return result
  }, [notes, filterTags, filterPaddock, filterMonth, search, newestFirst])

  const toggleFilterTag = (id: string) => {
    setFilterTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const getNoteTags = (note: any): string[] =>
    Array.isArray(note.tags) && note.tags.length > 0 ? note.tags : [note.category || 'GENERAL']

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Bitácora</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            {notes.length} nota{notes.length !== 1 ? 's' : ''} registrada{notes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsOpen(true) }} leftIcon={<Plus className="w-4 h-4" />}>
          Nueva nota
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar nota..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-1 focus:ring-green-600 outline-none w-44"
          />
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => {
            const isActive = filterTags.includes(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => toggleFilterTag(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded-xl border transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <cat.icon className="w-3 h-3" />
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Potrero filter */}
        <select value={filterPaddock} onChange={e => setFilterPaddock(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl text-gray-700 focus:ring-1 focus:ring-green-600 outline-none">
          <option value="all">Todos los potreros</option>
          {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Month filter */}
        <div className="flex gap-1 flex-wrap">
          {filterMonth !== null && (
            <button
              onClick={() => setFilterMonth(null)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-700"
            >
              <X className="w-3 h-3" /> {MONTHS_ES[filterMonth]}
            </button>
          )}
          {availableMonths.filter(m => m !== filterMonth).map(m => (
            <button
              key={m}
              onClick={() => setFilterMonth(m)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50"
            >
              <Calendar className="w-2.5 h-2.5" /> {MONTHS_ES[m]}
            </button>
          ))}
        </div>

        {/* Sort toggle */}
        <button
          onClick={() => setNewestFirst(!newestFirst)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          {newestFirst ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />}
          {newestFirst ? 'Más recientes' : 'Más antiguas'}
        </button>
      </div>

      {/* Notes feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <NotebookPen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-bold">Sin notas que coincidan</p>
          <p className="text-sm mt-1">Ajustá los filtros o creá una nueva nota</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(note => {
            const noteTags = getNoteTags(note)
            const primaryCat = CAT_MAP[noteTags[0]] || CAT_MAP['GENERAL']
            const paddock = paddocks.find(p => p.id === note.paddock_id)
            const condition = note.analysis_result?.condition
            const condCfg = condition ? CONDITION_CONFIG[condition] : null
            const CondIcon = condCfg?.icon

            return (
              <div key={note.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow group">
                <div className="flex items-start gap-4">
                  {/* Category icon */}
                  <div className={`w-10 h-10 rounded-xl ${primaryCat.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <primaryCat.icon className="w-5 h-5" style={{ color: primaryCat.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Tags row */}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {noteTags.map(tagId => {
                        const cat = CAT_MAP[tagId] || CAT_MAP['GENERAL']
                        return (
                          <span key={tagId} className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${cat.badge}`}>
                            {cat.label}
                          </span>
                        )
                      })}
                      {condCfg && CondIcon && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${condCfg.bg} ${condCfg.color}`}>
                          <CondIcon className="w-2.5 h-2.5" />
                          {condition}
                        </span>
                      )}
                    </div>

                    {/* Title + edit button */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-gray-900 leading-snug">{note.title}</h3>
                      <button
                        onClick={() => openEdit(note)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-gray-100 hover:bg-green-100 flex items-center justify-center shrink-0 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500 hover:text-green-700" />
                      </button>
                    </div>

                    {/* Content */}
                    {note.content && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{note.content}</p>
                    )}

                    {/* Biomass data */}
                    {note.analysis_result && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          { label: 'Materia seca', value: `${note.analysis_result.dry_matter_kg_ha} kg/ha` },
                          { label: 'Altura pasto', value: `${note.analysis_result.grass_height_cm} cm` },
                          { label: 'Cobertura', value: `${note.analysis_result.coverage_pct}%` },
                        ].map(item => (
                          <div key={item.label} className="bg-violet-50 rounded-xl px-2.5 py-1.5">
                            <p className="text-[8px] text-violet-400 font-bold uppercase">{item.label}</p>
                            <p className="text-xs font-black text-violet-800">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Photo thumbnail */}
                    {note.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={note.photo_url} alt="Foto de campo" className="mt-2 rounded-xl w-full max-h-40 object-cover" />
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <span className="text-[10px] text-gray-400">{fmtDate(note.created_at)}</span>
                      {paddock && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                          <MapPin className="w-2.5 h-2.5" />{paddock.name}
                        </span>
                      )}
                      {note.lat && (
                        <span className="text-[10px] text-blue-400 font-medium">
                          📍 {Number(note.lat).toFixed(4)}, {note.lng != null ? Number(note.lng).toFixed(4) : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Nueva / Editar nota ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">

            {/* ── Sticky header ── */}
            <div className="sticky top-0 bg-white/98 backdrop-blur-sm border-b border-gray-100 px-6 py-5 flex items-center justify-between rounded-t-3xl z-10 shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-950 tracking-tight">
                  {editingNote ? 'Editar nota' : 'Nueva nota de campo'}
                </h2>
                {form.paddock_id && paddocks.find(p => p.id === form.paddock_id) && (
                  <p className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {paddocks.find(p => p.id === form.paddock_id)?.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setIsOpen(false); resetForm() }}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-0">

              {/* ═══════════════════════════════════════════════════════════
                  ZONA 1: CAPTURA — Voz y Foto (hero section)
              ═══════════════════════════════════════════════════════════ */}
              <div className="px-5 pt-5 pb-4 bg-gray-50 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-green-500" /> Captura rápida
                </p>

                {/* 2 big buttons: Voz + Foto */}
                <div className="grid grid-cols-2 gap-3 mb-3">

                  {/* ── VOICE — big hero button ── */}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!voiceSupported}
                    className={`relative flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 transition-all active:scale-[0.97] disabled:opacity-40 select-none ${
                      isRecording
                        ? 'border-red-400 bg-red-50 shadow-lg shadow-red-100'
                        : 'border-green-300 bg-gradient-to-b from-green-50 to-emerald-50 hover:border-green-500 hover:shadow-md'
                    }`}
                  >
                    {isRecording && (
                      <span className="absolute top-3 right-3 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[9px] font-black text-red-500">REC</span>
                      </span>
                    )}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-green-600'} shadow-md`}>
                      {isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                    </div>
                  {/* Language selector for voice */}
                  {!isRecording && voiceSupported && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <select
                        value={voiceLang}
                        onChange={e => setVoiceLang(e.target.value)}
                        className="text-[9px] font-bold text-gray-400 bg-transparent border-0 outline-none cursor-pointer hover:text-gray-600"
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="es-AR">ES 🇦🇷</option>
                        <option value="en-US">EN 🇺🇸</option>
                        <option value="pt-BR">PT 🇧🇷</option>
                      </select>
                    </div>
                  )}
                  <div className="text-center">
                    <p className={`text-sm font-black ${isRecording ? 'text-red-600' : 'text-green-800'}`}>
                      {isRecording ? 'Detener' : 'Dictar voz'}
                    </p>
                      <p className={`text-[10px] ${isRecording ? 'text-red-400' : 'text-green-500'} leading-tight`}>
                        {isRecording ? 'Toca para parar' : 'a caballo, en campo'}
                      </p>
                    </div>
                  </button>

                  {/* ── CAMERA — big hero button ── */}
                  <button
                    type="button"
                    onClick={() => photoPreview ? fileInputRef.current?.click() : cameraInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 transition-all active:scale-[0.97] select-none ${
                      photoPreview
                        ? 'border-violet-400 bg-violet-50 shadow-md shadow-violet-100'
                        : 'border-violet-200 bg-gradient-to-b from-violet-50 to-purple-50 hover:border-violet-400 hover:shadow-md'
                    }`}
                  >
                    {photoPreview && (
                      <span className="absolute top-3 right-3 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                    {photoPreview ? (
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-violet-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-md">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-black text-violet-800">
                        {photoPreview ? 'Cambiar foto' : 'Sacar foto'}
                      </p>
                      <p className="text-[10px] text-violet-400 leading-tight">
                        {photoPreview ? 'foto cargada ✓' : 'análisis IA de pasto'}
                      </p>
                    </div>
                  </button>
                </div>

                {/* Gallery option (secondary) */}
                {!photoPreview && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> o cargar desde galería
                  </button>
                )}

                {/* Hidden inputs */}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />

                {/* ── Voice transcript live ── */}
                {(transcript || isRecording) && (
                  <div className={`mt-3 p-3.5 rounded-2xl border ${isRecording ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isRecording ? 'text-red-500' : 'text-green-600'}`}>
                      {isRecording ? '🔴 Escuchando...' : '✅ Transcripción lista'}
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed font-medium">
                      {transcript || <span className="text-gray-400 italic">Empezá a hablar...</span>}
                    </p>
                    {/* Audio playback + download */}
                    {!isRecording && audioUrl && (
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-green-200">
                        <audio src={audioUrl} controls className="h-8 flex-1" style={{ minWidth: 0 }} />
                        <button type="button" onClick={downloadAudio}
                          className="text-[10px] font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-xl flex items-center gap-1 shrink-0 transition-colors">
                          ⬇ Guardar audio
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Photo preview (full width) + AI mode selector ── */}
                {photoPreview && (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Preview" className="w-full rounded-2xl max-h-40 object-cover border-2 border-gray-100" />

                    {/* AI mode toggle */}
                    {!analyzing && !aiResult && !bcsResult && (
                      <>
                        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mt-2">
                          <button
                            type="button"
                            onClick={() => { setPhotoMode('biomasa'); setBcsResult(null); setAiResult(null) }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${photoMode === 'biomasa' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-400'}`}
                          >
                            <BarChart3 className="w-3.5 h-3.5" /> Remanente pasto
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPhotoMode('bcs'); setAiResult(null); setBcsResult(null) }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${photoMode === 'bcs' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400'}`}
                          >
                            <Footprints className="w-3.5 h-3.5" /> Condición corporal
                          </button>
                        </div>

                        {photoMode === 'biomasa' ? (
                          <button
                            type="button"
                            onClick={handleAnalyzeBiomass}
                            className="w-full mt-2 py-3.5 bg-violet-600 text-white rounded-xl text-sm font-black hover:bg-violet-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
                          >
                            <Sparkles className="w-4 h-4" /> Analizar remanente con IA
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAnalyzeBodyCondition}
                            className="w-full mt-2 py-3.5 bg-amber-600 text-white rounded-xl text-sm font-black hover:bg-amber-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
                          >
                            <HeartPulse className="w-4 h-4" /> Analizar condición corporal
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* AI analysis progress */}
                {analyzing && (
                  <div className="mt-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 ${photoMode === 'bcs' ? 'text-amber-600' : 'text-violet-600'}`}>
                      <Loader2 className="w-3 h-3 animate-spin" /> Procesando con IA...
                    </p>
                    <div className="flex items-center gap-1">
                      {(photoMode === 'biomasa'
                        ? ['Subiendo foto', 'Analizando imagen', 'Calculando biomasa']
                        : ['Subiendo foto', 'Detectando animal', 'Calculando CC']
                      ).map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className={`flex items-center gap-1 ${idx <= analysisStep ? (photoMode === 'bcs' ? 'text-amber-700' : 'text-violet-700') : 'text-gray-300'}`}>
                            {idx < analysisStep
                              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              : idx === analysisStep
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                              : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 shrink-0" />
                            }
                            <span className="text-[9px] font-bold whitespace-nowrap">{step}</span>
                          </div>
                          {idx < 2 && <div className={`flex-1 h-px mx-1 ${idx < analysisStep ? (photoMode === 'bcs' ? 'bg-amber-400' : 'bg-violet-400') : 'bg-gray-200'}`} />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Biomass AI Result */}
                {aiResult && (
                  <div className="mt-3 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-4 text-white shadow-lg shadow-violet-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-violet-200" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-200">Resultado IA — Remanente</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Mat. Seca', value: aiResult.dry_matter_kg_ha?.toLocaleString(), unit: 'kg/ha' },
                        { label: 'Altura', value: aiResult.grass_height_cm, unit: 'cm' },
                        { label: 'Cobertura', value: aiResult.coverage_pct, unit: '%' },
                      ].map(item => (
                        <div key={item.label} className="bg-white/15 rounded-xl px-2 py-2.5 text-center">
                          <p className="text-[8px] text-violet-200 font-black uppercase">{item.label}</p>
                          <p className="text-xl font-black leading-none mt-0.5">{item.value}</p>
                          <p className="text-[10px] text-violet-300 mt-0.5">{item.unit}</p>
                        </div>
                      ))}
                    </div>
                    {aiResult.recommendation && (
                      <p className="text-[11px] text-violet-100 leading-relaxed bg-white/10 rounded-xl p-2.5 mb-3">{aiResult.recommendation}</p>
                    )}
                    {form.paddock_id ? (
                      <button
                        type="button"
                        onClick={handleApplyToPaddock}
                        disabled={applyingToPaddock || paddockUpdated}
                        className="w-full py-2.5 bg-white text-violet-700 rounded-xl text-xs font-black hover:bg-violet-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {applyingToPaddock
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Actualizando...</>
                          : paddockUpdated
                          ? <><CheckCircle2 className="w-4 h-4" />Potrero actualizado ✓</>
                          : <><Check className="w-4 h-4" />Aplicar MS a {paddocks.find(p => p.id === form.paddock_id)?.name}</>
                        }
                      </button>
                    ) : (
                      <p className="text-[10px] text-violet-300 text-center">Seleccioná un potrero para aplicar estos datos</p>
                    )}
                  </div>
                )}

                {/* BCS Result */}
                {bcsResult && (
                  <div className="mt-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-amber-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <HeartPulse className="w-4 h-4 text-amber-200" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">IA — Condición Corporal</p>
                      </div>
                      {bcsResult.alert_level !== 'NINGUNA' && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${bcsResult.alert_level === 'URGENTE' ? 'bg-red-500' : 'bg-amber-300 text-amber-900'}`}>
                          {bcsResult.alert_level === 'URGENTE' ? '🔴 URGENTE' : '⚠ ATENCIÓN'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white/15 rounded-xl px-2 py-2.5 text-center col-span-1">
                        <p className="text-[8px] text-amber-200 font-black uppercase">Score CC</p>
                        <p className="text-2xl font-black leading-none mt-0.5">{bcsResult.bcs_score}</p>
                        <p className="text-[10px] text-amber-300 mt-0.5">/ {bcsResult.bcs_scale}</p>
                      </div>
                      <div className="bg-white/15 rounded-xl px-2 py-2.5 text-center col-span-2">
                        <p className="text-[8px] text-amber-200 font-black uppercase">Estado</p>
                        <p className="text-base font-black leading-snug mt-0.5">{bcsResult.condition_label}</p>
                        <p className="text-[9px] text-amber-200 mt-0.5">{bcsResult.nutritional_status}</p>
                      </div>
                    </div>
                    {bcsResult.visible_signs?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {bcsResult.visible_signs.map((sign: string, i: number) => (
                          <span key={i} className="text-[9px] bg-white/15 px-2 py-0.5 rounded-full font-medium">{sign}</span>
                        ))}
                      </div>
                    )}
                    {bcsResult.recommendation && (
                      <p className="text-[11px] text-amber-100 leading-relaxed bg-white/10 rounded-xl p-2.5">{bcsResult.recommendation}</p>
                    )}
                  </div>
                )}

                {aiError && <p className="text-xs text-red-600 mt-2 font-bold bg-red-50 rounded-xl px-3 py-2">{aiError}</p>}
                {bcsError && <p className="text-xs text-red-600 mt-2 font-bold bg-red-50 rounded-xl px-3 py-2">{bcsError}</p>}
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  ZONA 2: POTRERO
              ═══════════════════════════════════════════════════════════ */}
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Potrero</p>
                {paddocks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {paddocks.map(p => {
                      const selected = form.paddock_id === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, paddock_id: selected ? '' : p.id }))}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                            selected
                              ? 'bg-green-600 text-white border-green-600 shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3" />}
                          <MapPin className="w-3 h-3" />
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Sin potreros registrados</p>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  ZONA 3: CATEGORIAS
              ═══════════════════════════════════════════════════════════ */}
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const active = form.tags.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleFormTag(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                          active
                            ? 'bg-white ring-2 ring-offset-1 shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                        }`}
                        style={{
                          color: active ? cat.color : undefined,
                          borderColor: active ? cat.color : undefined,
                        }}
                      >
                        <cat.icon className="w-3.5 h-3.5" />
                        {cat.label}
                        {active && <CheckSquare2 className="w-3 h-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  ZONA 4: TÍTULO + NOTA
              ═══════════════════════════════════════════════════════════ */}
              <div className="px-5 py-4 space-y-4">
                {/* Título */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Título *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                    placeholder="Ej: Remanente Potrero Norte — post pastoreo"
                    required
                  />
                </div>

                {/* Nota adicional */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Nota adicional</label>
                  <textarea
                    rows={3}
                    value={form.content}
                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                    placeholder="Observaciones, detalles del potrero..."
                  />
                </div>

                {/* GPS */}
                <button
                  type="button"
                  onClick={getLocation}
                  className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-green-700 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  {form.lat ? `📍 ${form.lat.toFixed(5)}, ${form.lng?.toFixed(5)}` : 'Registrar ubicación GPS'}
                </button>
              </div>

              {savedOffline && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Guardado sin conexión. Se sincronizará luego.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 px-6 pb-8 pt-4">
                <button type="button" onClick={() => { setIsOpen(false); resetForm() }}
                  className="flex-1 py-3 text-sm font-black text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !form.title}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-sm shadow-md shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : editingNote ? 'Guardar cambios' : 'Guardar nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
