'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineIndicator'
import {
  Mic, MicOff, Camera, MapPin, X, Plus,
  Wrench, Leaf, AlertTriangle, BookOpen, Loader2, Sparkles,
  BarChart3, Droplets, CheckCircle2, AlertCircle,
  SortDesc, SortAsc, Search, Pencil, Calendar, CheckSquare2,
  Square, Check, Image as ImageIcon, Footprints, HeartPulse,
  NotebookPen, RefreshCw, Navigation2, Radio,
} from 'lucide-react'

// ── Dynamic map (no SSR) ────────────────────────────────────────────────────
const LocationPicker = dynamic(() => import('./components/LocationPicker'), { ssr: false })

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'INFRAESTRUCTURA', label: 'Infraestructura', icon: Wrench, color: '#0891b2', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', badge: 'bg-cyan-100 text-cyan-800', keywords: ['alambre', 'tranquera', 'aguada', 'bomba', 'molino', 'alambrado', 'cerco', 'puerta', 'rotunda'] },
  { id: 'SANIDAD_VEGETAL', label: 'Sanidad vegetal', icon: Leaf, color: '#16a34a', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-800', keywords: ['maleza', 'plaga', 'yuyo', 'cardillo', 'tóxica', 'toxica', 'pasto', 'hierba', 'monte'] },
  { id: 'RESTRICCION', label: 'Restricción de uso', icon: AlertTriangle, color: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-800', keywords: ['inundado', 'clausurado', 'siembra', 'restringido', 'cerrado', 'prohibido'] },
  { id: 'BIOMASA', label: 'Análisis biomasa', icon: BarChart3, color: '#7c3aed', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-800', keywords: ['biomasa', 'materia seca', 'ms/ha', 'forraje', 'altura pasto'] },
  { id: 'HIDRICO', label: 'Hídrico', icon: Droplets, color: '#0369a1', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', badge: 'bg-sky-100 text-sky-800', keywords: ['agua', 'bebedero', 'inundado', 'seco', 'lluvia', 'cañada', 'humedal'] },
  { id: 'GANADO', label: 'Condición Corporal', icon: Footprints, color: '#b45309', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800', keywords: ['ganado', 'animal', 'condición', 'bcs', 'flaco', 'gordo', 'ternero', 'vaca', 'toro'] },
  { id: 'GENERAL', label: 'General', icon: BookOpen, color: '#374151', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', badge: 'bg-gray-100 text-gray-800', keywords: [] },
]
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

function detectTags(text: string): string[] {
  const lower = text.toLowerCase()
  const detected = CATEGORIES.filter(cat => cat.keywords.length > 0 && cat.keywords.some(kw => lower.includes(kw))).map(c => c.id)
  return detected.length > 0 ? detected : ['GENERAL']
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
    reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: file.type || 'image/jpeg' })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Waveform visualizer ──────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-current transition-all ${active ? 'animate-pulse' : ''}`}
          style={{
            height: active ? `${12 + Math.sin(i * 0.8) * 16}px` : '4px',
            animationDelay: `${i * 80}ms`,
            animationDuration: `${600 + i * 80}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
type CaptureMode = 'idle' | 'recording' | 'photo' | 'reviewing'

export default function BitacoraPage() {
  const { user } = useAuth()

  const [notes, setNotes] = useState<any[]>([])
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ── Capture state ────────────────────────────────────────────────────────
  const [captureMode, setCaptureMode] = useState<CaptureMode>('idle')

  // Voice
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioGcsUrlRef = useRef<string | null>(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioGcsUploaded, setAudioGcsUploaded] = useState(false)

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)

  // AI Analysis
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<any | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [bcsResult, setBcsResult] = useState<any | null>(null)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [photoMode, setPhotoMode] = useState<'biomasa' | 'bcs'>('biomasa')

  // Location
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Form (shown in "reviewing" mode)
  const [form, setForm] = useState({
    paddock_id: '',
    tags: ['GENERAL'] as string[],
    title: '',
    content: '',
  })
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [editingNote, setEditingNote] = useState<any | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Feed filters
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterPaddock, setFilterPaddock] = useState('all')
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)

  // ── Load ──────────────────────────────────────────────────────────────────
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

  // ── Geolocation ──────────────────────────────────────────────────────────
  const requestLocation = () => {
    setLocating(true)
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    )
  }

  // ── Recording ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setCaptureMode('recording')
    setIsRecording(true)
    setTranscript('')
    setAudioBlob(null)
    setAudioUrl(null)
    audioGcsUrlRef.current = null
    setAudioGcsUploaded(false)
    requestLocation()

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'es-AR'
      rec.onresult = (e: any) => {
        let full = ''
        for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
        setTranscript(full)
        const detectedTags = detectTags(full)
        setForm(prev => ({ ...prev, content: full, tags: detectedTags, title: prev.title || full.split('.')[0].slice(0, 60) }))
      }
      rec.start()
      recognitionRef.current = rec
    }

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
        try {
          setAudioUploading(true)
          const fd = new FormData()
          fd.append('file', new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
          fd.append('folder', 'bitacora-audio')
          const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (res.ok) {
            const { url } = await res.json()
            audioGcsUrlRef.current = url
            setAudioGcsUploaded(true)
          }
        } catch { /* noop */ } finally { setAudioUploading(false) }
      }
      mr.start()
      mediaRecorderRef.current = mr
    } catch { /* noop */ }
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    setCaptureMode('reviewing')
    setIsFormOpen(true)
  }

  // ── Photo ────────────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAiResult(null)
    setAiError(null)
    setBcsResult(null)
    setCaptureMode('photo')
    setIsFormOpen(true)
    requestLocation()
  }

  // ── AI Biomass ────────────────────────────────────────────────────────────
  const handleAnalyzeBiomass = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setAiResult(null)
    setAiError(null)
    setAnalysisStep(0)
    const t1 = setTimeout(() => setAnalysisStep(1), 900)
    const t2 = setTimeout(() => setAnalysisStep(2), 2200)
    try {
      const { base64, mimeType } = await fileToBase64(photoFile)
      const res = await fetch('/api/analyze-biomass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType }) })
      const json = await res.json()
      clearTimeout(t1); clearTimeout(t2); setAnalysisStep(2)
      if (!json.success) throw new Error(json.error)
      setAiResult(json.data)
      setForm(prev => ({
        ...prev,
        tags: Array.from(new Set([...prev.tags.filter(t => t !== 'GENERAL'), 'BIOMASA'])),
        title: prev.title || `Remanente — ${json.data.condition_label || 'Análisis IA'}`,
        content: prev.content || `MS disponible: ${json.data.dry_matter_kg_ha} kg/ha · Altura: ${json.data.grass_height_cm} cm · Cobertura: ${json.data.coverage_pct}%\n${json.data.recommendation || ''}`,
      }))
    } catch (err: any) { clearTimeout(t1); clearTimeout(t2); setAiError(err.message || 'Error en análisis') }
    setAnalyzing(false)
  }

  // ── AI BCS ────────────────────────────────────────────────────────────────
  const handleAnalyzeBCS = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setBcsResult(null)
    setAiError(null)
    setAnalysisStep(0)
    const t1 = setTimeout(() => setAnalysisStep(1), 900)
    const t2 = setTimeout(() => setAnalysisStep(2), 2200)
    try {
      const { base64, mimeType } = await fileToBase64(photoFile)
      const res = await fetch('/api/analyze-body-condition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType, species: 'bovino' }) })
      const json = await res.json()
      clearTimeout(t1); clearTimeout(t2); setAnalysisStep(2)
      if (!json.success) throw new Error(json.error)
      setBcsResult(json.data)
      setForm(prev => ({
        ...prev,
        tags: Array.from(new Set([...prev.tags.filter(t => t !== 'GENERAL'), 'GANADO'])),
        title: prev.title || `CC ${json.data.bcs_score} — ${json.data.condition_label}`,
        content: prev.content || `Condición corporal: ${json.data.bcs_score}/${json.data.bcs_scale} (${json.data.condition_label})\n${json.data.condition_es}\n${json.data.recommendation || ''}`,
      }))
    } catch (err: any) { clearTimeout(t1); clearTimeout(t2); setAiError(err.message || 'Error en análisis') }
    setAnalyzing(false)
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    setSaving(true)

    if (!navigator.onLine) {
      addToOfflineQueue({ type: 'field_note', data: { created_by: user?.uid, paddock_id: form.paddock_id || null, tags: form.tags, category: form.tags[0], title: form.title, content: form.content || null, lat, lng, sync_status: 'PENDING' }, timestamp: Date.now() })
      setSaving(false)
      setSavedOffline(true)
      setTimeout(() => { setSavedOffline(false); resetCapture() }, 2000)
      return
    }

    let photo_url: string | null = null
    if (photoFile) {
      const fd = new FormData()
      fd.append('file', photoFile)
      fd.append('folder', 'field-notes')
      const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (uploadRes.ok) { const { url } = await uploadRes.json(); photo_url = url }
    }

    const biomassData = aiResult ? { analysis_result: aiResult, tags: Array.from(new Set([...form.tags, 'BIOMASA'])) } : {}

    if (editingNote) {
      await apiFetch(`/api/field-notes/${editingNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ paddock_id: form.paddock_id || null, tags: form.tags, title: form.title, content: form.content || null, lat, lng, photo_url: photo_url || editingNote.photo_url, ...biomassData }),
      })
    } else {
      await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({ paddock_id: form.paddock_id || null, tags: (biomassData as any).tags || form.tags, title: form.title, content: form.content || null, lat, lng, photo_url, audio_url: audioGcsUrlRef.current || null, analysis_result: aiResult || null }),
      })
    }

    setSaving(false)
    resetCapture()
    loadData()
  }

  const resetCapture = () => {
    setCaptureMode('idle')
    setIsFormOpen(false)
    setIsRecording(false)
    setTranscript('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setAiResult(null)
    setAiError(null)
    setBcsResult(null)
    setAudioBlob(null)
    setAudioUrl(null)
    audioGcsUrlRef.current = null
    setAudioGcsUploaded(false)
    setLat(null)
    setLng(null)
    setShowMap(false)
    setForm({ paddock_id: '', tags: ['GENERAL'], title: '', content: '' })
    setEditingNote(null)
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
  }

  const openEdit = (note: any) => {
    const tags = Array.isArray(note.tags) && note.tags.length > 0 ? note.tags : [note.category || 'GENERAL']
    setEditingNote(note)
    setForm({ paddock_id: note.paddock_id || '', tags, title: note.title || '', content: note.content || '' })
    setPhotoPreview(note.photo_url || null)
    setAiResult(note.analysis_result || null)
    setLat(note.lat != null ? Number(note.lat) : null)
    setLng(note.lng != null ? Number(note.lng) : null)
    setCaptureMode('reviewing')
    setIsFormOpen(true)
  }

  const toggleFormTag = (tagId: string) => {
    setForm(prev => {
      const has = prev.tags.includes(tagId)
      let next = has ? prev.tags.filter(t => t !== tagId) : [...prev.tags.filter(t => t !== 'GENERAL'), tagId]
      if (next.length === 0) next = ['GENERAL']
      return { ...prev, tags: next }
    })
  }

  // ── Feed filtering ────────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const months = new Set<number>()
    notes.forEach(n => months.add(new Date(n.created_at).getMonth()))
    return Array.from(months).sort((a, b) => a - b)
  }, [notes])

  const filtered = useMemo(() => {
    let result = notes.filter(n => {
      const noteTags: string[] = Array.isArray(n.tags) && n.tags.length > 0 ? n.tags : [n.category || 'GENERAL']
      if (filterTags.length > 0 && !filterTags.some(t => noteTags.includes(t))) return false
      if (filterPaddock !== 'all' && n.paddock_id !== filterPaddock) return false
      if (filterMonth !== null && new Date(n.created_at).getMonth() !== filterMonth) return false
      if (search && !n.title?.toLowerCase().includes(search.toLowerCase()) && !n.content?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    return [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime(), tb = new Date(b.created_at).getTime()
      return newestFirst ? tb - ta : ta - tb
    })
  }, [notes, filterTags, filterPaddock, filterMonth, search, newestFirst])

  const getNoteTags = (note: any): string[] =>
    Array.isArray(note.tags) && note.tags.length > 0 ? note.tags : [note.category || 'GENERAL']

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Bitácora</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            {notes.length} nota{notes.length !== 1 ? 's' : ''} · captura rápida desde el campo
          </p>
        </div>
      </div>

      {/* ── CAPTURE ZONE — 2 FABs masivos ── */}
      {captureMode === 'idle' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Grabar Audio */}
          <button
            onClick={startRecording}
            disabled={!voiceSupported}
            className="group relative flex flex-col items-center justify-center gap-3 py-10 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-3xl shadow-lg shadow-green-200 hover:shadow-green-300 hover:from-green-700 hover:to-green-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 select-none"
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Mic className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-base font-black tracking-tight">Grabar Audio</p>
              <p className="text-xs font-medium text-green-200 mt-0.5">Pulsá y hablá</p>
            </div>
          </button>

          {/* Tomar Foto */}
          <button
            onClick={() => setShowPhotoMenu(true)}
            className="group relative flex flex-col items-center justify-center gap-3 py-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:from-blue-700 hover:to-blue-800 active:scale-[0.97] transition-all duration-200 select-none"
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Camera className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-base font-black tracking-tight">Tomar Foto</p>
              <p className="text-xs font-medium text-blue-200 mt-0.5">Cámara o galería</p>
            </div>
          </button>

          {/* Nota manual (secundario) */}
          <button
            onClick={() => { setCaptureMode('reviewing'); setIsFormOpen(true) }}
            className="col-span-2 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-600 font-bold text-sm rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nueva nota de texto
          </button>

          {/* Photo menu */}
          {showPhotoMenu && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowPhotoMenu(false)}>
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <p className="text-sm font-black text-gray-950">Elegir fuente</p>
                </div>
                <div className="p-3 space-y-1">
                  <button
                    onClick={() => { setShowPhotoMenu(false); cameraInputRef.current?.click() }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Camera className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Cámara</p>
                      <p className="text-xs text-gray-400">Tomar foto ahora</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowPhotoMenu(false); galleryInputRef.current?.click() }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Galería</p>
                      <p className="text-xs text-gray-400">Elegir de fotos guardadas</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
          <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>
      )}

      {/* ── RECORDING STATE ── */}
      {captureMode === 'recording' && (
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-6 text-white shadow-lg shadow-green-200">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-sm font-black">Grabando...</span>
            </div>
            <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 font-black text-sm rounded-xl hover:bg-green-50 transition-colors">
              <Square className="w-3.5 h-3.5 fill-green-700" />
              Detener
            </button>
          </div>
          <div className="text-green-200 mb-4">
            <Waveform active={isRecording} />
          </div>
          {transcript && (
            <div className="bg-white/15 rounded-2xl p-4">
              <p className="text-sm leading-relaxed">{transcript}</p>
            </div>
          )}
          {!transcript && (
            <p className="text-center text-green-200 text-sm font-medium">Hablá naturalmente... está escuchando</p>
          )}
          {lat && <p className="text-xs text-green-200 mt-3 text-center">📍 Ubicación registrada</p>}
        </div>
      )}

      {/* ── REVIEW / FORM PANEL ── */}
      {isFormOpen && captureMode !== 'recording' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-black text-gray-950">
              {editingNote ? 'Editar nota' : captureMode === 'photo' ? 'Nota con foto' : captureMode === 'reviewing' && audioUrl ? 'Nota de audio' : 'Nueva nota'}
            </h2>
            <button onClick={resetCapture} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div className="px-5 py-4 space-y-4">

              {/* Audio preview */}
              {audioUrl && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-green-800">Audio grabado</p>
                    {audioGcsUploaded && <p className="text-[10px] text-green-600">✓ Guardado en la nube</p>}
                    {audioUploading && <p className="text-[10px] text-green-500 animate-pulse">Subiendo...</p>}
                  </div>
                  <audio src={audioUrl} controls className="h-8 max-w-[140px]" />
                </div>
              )}

              {/* Transcripción */}
              {transcript && !form.title && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 leading-relaxed border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Transcripción</p>
                  {transcript}
                </div>
              )}

              {/* Photo preview */}
              {photoPreview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Foto" className="w-full max-h-52 object-cover rounded-2xl" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); setAiResult(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* AI Analysis buttons */}
              {photoFile && !aiResult && !bcsResult && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyzeBiomass}
                    disabled={analyzing}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 rounded-xl hover:bg-violet-100 disabled:opacity-50 transition-colors"
                  >
                    {analyzing && photoMode === 'biomasa' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                    Análisis Biomasa
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyzeBCS}
                    disabled={analyzing}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    {analyzing && photoMode === 'bcs' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HeartPulse className="w-3.5 h-3.5" />}
                    Condición Corporal
                  </button>
                </div>
              )}

              {/* AI result */}
              {aiResult && (
                <div className="grid grid-cols-3 gap-2">
                  {[{ label: 'Materia seca', value: `${aiResult.dry_matter_kg_ha} kg/ha` }, { label: 'Altura', value: `${aiResult.grass_height_cm} cm` }, { label: 'Cobertura', value: `${aiResult.coverage_pct}%` }].map(item => (
                    <div key={item.label} className="bg-violet-50 rounded-xl px-2.5 py-2">
                      <p className="text-[8px] text-violet-400 font-bold uppercase">{item.label}</p>
                      <p className="text-xs font-black text-violet-800">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Título */}
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="¿Qué está pasando?"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-950 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none placeholder:text-gray-300"
                />
              </div>

              {/* Categorías */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Categoría</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleFormTag(cat.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded-xl border transition-all ${
                        form.tags.includes(cat.id)
                          ? `${cat.bg} ${cat.border} ${cat.text}`
                          : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <cat.icon className="w-3 h-3" /> {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Potrero */}
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Potrero</label>
                <select
                  value={form.paddock_id}
                  onChange={e => setForm({ ...form, paddock_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
                >
                  <option value="">General (sin potrero)</option>
                  {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Detalle */}
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Detalle adicional</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="Detalles adicionales..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none placeholder:text-gray-300"
                />
              </div>

              {/* Ubicación + mapa */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Ubicación GPS</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={locating}
                      className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 transition-colors"
                    >
                      {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation2 className="w-3 h-3" />}
                      {lat ? 'Actualizar' : 'Capturar'}
                    </button>
                    {lat && (
                      <button
                        type="button"
                        onClick={() => setShowMap(v => !v)}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        {showMap ? 'Ocultar mapa' : 'Ajustar en mapa'}
                      </button>
                    )}
                  </div>
                </div>
                {lat && lng && !showMap && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <p className="text-[11px] font-bold text-blue-700 tabular-nums">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                  </div>
                )}
                {showMap && lat && lng && (
                  <div className="rounded-2xl overflow-hidden border border-gray-200 h-52">
                    <LocationPicker lat={lat} lng={lng} onMove={(la, lo) => { setLat(la); setLng(lo) }} />
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
              <button
                type="button"
                onClick={resetCapture}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !form.title}
                className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 shadow-sm shadow-green-100 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Guardando...' : editingNote ? 'Guardar cambios' : 'Guardar nota'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Separator + Filters ── */}
      {captureMode === 'idle' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Historial</p>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
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
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterTags(prev => prev.includes(cat.id) ? prev.filter(t => t !== cat.id) : [...prev, cat.id])}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded-xl border transition-all ${
                    filterTags.includes(cat.id) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <cat.icon className="w-3 h-3" /> {cat.label}
                </button>
              ))}
            </div>
            <select
              value={filterPaddock}
              onChange={e => setFilterPaddock(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl text-gray-700 focus:ring-1 focus:ring-green-600 outline-none"
            >
              <option value="all">Todos los potreros</option>
              {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {filterMonth !== null && (
              <button onClick={() => setFilterMonth(null)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-700">
                <X className="w-3 h-3" /> {MONTHS_ES[filterMonth]}
              </button>
            )}
            {availableMonths.filter(m => m !== filterMonth).map(m => (
              <button key={m} onClick={() => setFilterMonth(m)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50">
                <Calendar className="w-2.5 h-2.5" /> {MONTHS_ES[m]}
              </button>
            ))}
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
              <p className="text-sm mt-1">Ajustá los filtros o grabá una nota nueva</p>
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
                      <div className={`w-10 h-10 rounded-xl ${primaryCat.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <primaryCat.icon className="w-5 h-5" style={{ color: primaryCat.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {noteTags.map(tagId => {
                            const cat = CAT_MAP[tagId] || CAT_MAP['GENERAL']
                            return <span key={tagId} className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${cat.badge}`}>{cat.label}</span>
                          })}
                          {condCfg && CondIcon && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${condCfg.bg} ${condCfg.color}`}>
                              <CondIcon className="w-2.5 h-2.5" /> {condition}
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-black text-gray-900 leading-snug">{note.title}</h3>
                          <button
                            onClick={() => openEdit(note)}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-gray-100 hover:bg-green-100 flex items-center justify-center shrink-0 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-500 hover:text-green-700" />
                          </button>
                        </div>
                        {note.content && <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{note.content}</p>}
                        {note.analysis_result && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {[{ label: 'Materia seca', value: `${note.analysis_result.dry_matter_kg_ha} kg/ha` }, { label: 'Altura pasto', value: `${note.analysis_result.grass_height_cm} cm` }, { label: 'Cobertura', value: `${note.analysis_result.coverage_pct}%` }].map(item => (
                              <div key={item.label} className="bg-violet-50 rounded-xl px-2.5 py-1.5">
                                <p className="text-[8px] text-violet-400 font-bold uppercase">{item.label}</p>
                                <p className="text-xs font-black text-violet-800">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {note.photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={note.photo_url} alt="Foto de campo" className="mt-2 rounded-xl w-full max-h-40 object-cover" />
                        )}
                        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">{fmtDate(note.created_at)}</span>
                          {paddock && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500"><MapPin className="w-2.5 h-2.5" />{paddock.name}</span>}
                          {note.lat && <span className="text-[10px] text-blue-400 font-medium">📍 {Number(note.lat).toFixed(4)}, {note.lng != null ? Number(note.lng).toFixed(4) : ''}</span>}
                          {note.audio_url && <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><Mic className="w-2.5 h-2.5" />Audio</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
