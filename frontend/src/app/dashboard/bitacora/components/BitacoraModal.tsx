/**
 * BitacoraModal — Modal de captura de notas de campo.
 * Tres modos completamente aislados: AUDIO | FOTO | TEXTO
 * Cada modo tiene su propio estado y flujo de guardado independiente.
 * Al cambiar de modo, el estado anterior se limpia.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineIndicator'
import {
  X, Mic, Camera, AlertTriangle, Leaf, BookOpen,
  Wrench, BarChart3, Droplets, Footprints, Loader2,
  Square, Check, Type, Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Image compression helper ──────────────────────────────────────────────────
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
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
          else resolve(file)
        }, 'image/jpeg', 0.7)
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'INFRAESTRUCTURA', label: 'Infraestructura', icon: Wrench,        border: 'border-cyan-200',   text: 'text-cyan-800',   bg: 'bg-cyan-50' },
  { id: 'SANIDAD_VEGETAL', label: 'Sanidad vegetal', icon: Leaf,           border: 'border-green-200',  text: 'text-green-800',  bg: 'bg-green-50' },
  { id: 'RESTRICCION',     label: 'Restricción',     icon: AlertTriangle,  border: 'border-red-200',    text: 'text-red-800',    bg: 'bg-red-50' },
  { id: 'BIOMASA',         label: 'Biomasa',          icon: BarChart3,      border: 'border-violet-200', text: 'text-violet-800', bg: 'bg-violet-50' },
  { id: 'HIDRICO',         label: 'Hídrico',          icon: Droplets,       border: 'border-sky-200',    text: 'text-sky-800',    bg: 'bg-sky-50' },
  { id: 'GANADO',          label: 'Ganado',           icon: Footprints,     border: 'border-amber-200',  text: 'text-amber-800',  bg: 'bg-amber-50' },
  { id: 'GENERAL',         label: 'General',          icon: BookOpen,       border: 'border-gray-200',   text: 'text-gray-800',   bg: 'bg-gray-50' },
]

type CaptureMode = 'AUDIO' | 'FOTO' | 'TEXTO'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  user: any
  initialPaddockId?: string
  initialPaddockName?: string
  paddocks?: any[]
}

// ── Waveform component ────────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-6">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i}
          className={`w-[3px] rounded-full bg-red-500 transition-all duration-150 ${active ? 'animate-pulse' : ''}`}
          style={{ height: active ? `${8 + Math.abs(Math.sin(i * 0.8)) * 12}px` : '3px', animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  )
}

export default function BitacoraModal({
  isOpen, onClose, onSaved, user,
  initialPaddockId, paddocks, initialPaddockName,
}: Props) {

  // ── Shared form state ────────────────────────────────────────────────────
  const [mode, setMode] = useState<CaptureMode>('TEXTO')
  const [paddockId, setPaddockId] = useState(initialPaddockId || '')
  const [tags, setTags] = useState(['GENERAL'])
  const [saving, setSaving] = useState(false)
  const [savingMsg, setSavingMsg] = useState('')

  // ── AUDIO mode state ─────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [liveTranscript, setLiveTranscript] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const speechRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordSecsSnap = useRef(0)

  // ── AI analysis result ───────────────────────────────────────────────────
  const [aiAnalysis, setAiAnalysis] = useState<{
    category: string
    paddock_hint: string | null
    tasks: string[]
    confidence: number
  } | null>(null)

  // ── FOTO mode state ──────────────────────────────────────────────────────
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [showPhotoSource, setShowPhotoSource] = useState(false)

  // ── TEXTO mode state ─────────────────────────────────────────────────────
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  // ── Reset everything when modal opens / mode changes ────────────────────
  const resetAll = useCallback(() => {
    setMode('TEXTO')
    setTags(['GENERAL'])
    setSaving(false)
    setAiAnalysis(null)
    // Audio
    setIsRecording(false); setRecordSecs(0); setAudioBlob(null); setLiveTranscript('')
    if (timerRef.current) clearInterval(timerRef.current)
    speechRef.current?.stop(); mediaRecorderRef.current?.stop()
    // Photo
    setPhotoFile(null); setPhotoPreview(null); setShowPhotoSource(false)
    // Text
    setTextTitle(''); setTextContent('')
  }, [])

  const resetAudio = () => {
    setIsRecording(false); setRecordSecs(0); setAudioBlob(null); setLiveTranscript('')
    setAiAnalysis(null)
    if (timerRef.current) clearInterval(timerRef.current)
    speechRef.current?.stop()
  }

  const resetPhoto = () => { setPhotoFile(null); setPhotoPreview(null) }
  const resetText = () => { setTextTitle(''); setTextContent('') }

  const switchMode = (m: CaptureMode) => {
    if (m === mode) return
    // Clean up current mode before switching
    if (mode === 'AUDIO') resetAudio()
    if (mode === 'FOTO') resetPhoto()
    if (mode === 'TEXTO') resetText()
    setMode(m)
  }

  useEffect(() => {
    if (isOpen) {
      setPaddockId(initialPaddockId || '')
      resetAll()
    }
  }, [isOpen, initialPaddockId, resetAll])

  if (!isOpen) return null

  // ── Tag toggle ─────────────────────────────────────────────────────────
  const toggleTag = (id: string) => {
    setTags(prev => {
      const has = prev.includes(id)
      const next = has ? prev.filter(t => t !== id) : [...prev.filter(t => t !== 'GENERAL'), id]
      return next.length === 0 ? ['GENERAL'] : next
    })
  }

  // ── AUDIO recording ───────────────────────────────────────────────────
  const startRecording = async () => {
    setAudioBlob(null); setLiveTranscript(''); setRecordSecs(0)

    // Web Speech API live transcript
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true; rec.interimResults = true; rec.lang = 'es-AR'
      rec.onresult = (e: any) => {
        let full = ''
        for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript
        setLiveTranscript(full)
      }
      rec.start()
      speechRef.current = rec
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      // Timer
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
      setIsRecording(true)
    } catch {
      speechRef.current?.stop()
      toast.error('No se pudo acceder al micrófono. Verificá los permisos del navegador.')
    }
  }

  const stopRecording = () => {
    recordSecsSnap.current = recordSecs
    if (timerRef.current) clearInterval(timerRef.current)
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── PHOTO selection ────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setShowPhotoSource(false)
    e.target.value = '' // reset so same file can be re-selected
  }

  // ── SAVE ──────────────────────────────────────────────────────────────
  const canSave = () => {
    if (saving) return false
    if (mode === 'AUDIO') return !!audioBlob && !isRecording
    if (mode === 'FOTO') return !!photoFile
    if (mode === 'TEXTO') return textTitle.trim().length > 0
    return false
  }

  const handleSave = async () => {
    if (!canSave()) return
    setSaving(true)
    const timestamp = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

    // ── Offline path ──
    if (!navigator.onLine) {
      const offlineId = crypto.randomUUID()
      if (mode === 'TEXTO') {
        addToOfflineQueue({
          type: 'field_note',
          data: {
            created_by: user?.uid, paddock_id: paddockId || null,
            tags, category: tags[0], title: textTitle, content: textContent || null,
            sync_status: 'PENDING',
          },
          timestamp: Date.now(),
        })
      } else if (mode === 'AUDIO' && audioBlob) {
        import('@/lib/audioOfflineStore').then(({ savePendingAudio }) => {
          savePendingAudio({
            id: offlineId,
            blob: audioBlob,
            durationSecs: recordSecsSnap.current,
            lat: null, lng: null,
            createdAt: new Date().toISOString(),
            title: `Audio · ${timestamp}`,
            transcript: liveTranscript
          })
        })
        addToOfflineQueue({
          type: 'field_note',
          data: {
            created_by: user?.uid, paddock_id: paddockId || null,
            tags, category: tags[0], title: `Audio · ${timestamp}`,
            sync_status: 'PENDING',
          },
          timestamp: Date.now(),
          mediaType: 'audio',
          mediaId: offlineId
        })
        toast.success('Audio guardado offline. Se sincronizará automáticamente.')
      } else if (mode === 'FOTO' && photoFile) {
        import('@/lib/audioOfflineStore').then(({ savePendingPhoto }) => {
          savePendingPhoto({
            id: offlineId,
            blob: photoFile,
            lat: null, lng: null,
            createdAt: new Date().toISOString(),
            title: `Foto · ${timestamp}`
          })
        })
        addToOfflineQueue({
          type: 'field_note',
          data: {
            created_by: user?.uid, paddock_id: paddockId || null,
            tags, category: tags[0], title: `Foto · ${timestamp}`,
            sync_status: 'PENDING',
          },
          timestamp: Date.now(),
          mediaType: 'photo',
          mediaId: offlineId
        })
        toast.success('Foto guardada offline. Se sincronizará automáticamente.')
      }
      setSaving(false); onSaved(); onClose(); return
    }

    try {
      // ── AUDIO save ──────────────────────────────────────────────────
      if (mode === 'AUDIO' && audioBlob) {
        setSavingMsg('Subiendo audio...')
        let audio_url: string | null = null
        const fd = new FormData()
        fd.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
        fd.append('folder', 'bitacora-audio')
        const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (uploadRes.ok) { audio_url = (await uploadRes.json()).url }

        let transcript = liveTranscript
        let finalTags = tags
        let finalPaddockId = paddockId || null
        let analysisResult: any = null

        setSavingMsg('Analizando con IA...')
        try {
          const tf = new FormData()
          tf.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
          const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf })
          if (tr.ok) {
            const d = await tr.json()
            if (d.transcript && d.transcript !== '[Sin voz detectable]') transcript = d.transcript

            // Auto-apply category if confidence is high and user left default
            if (d.confidence > 0.65 && d.category && d.category !== 'GENERAL' && tags.includes('GENERAL')) {
              finalTags = [d.category]
            }

            // Auto-match paddock_hint to existing paddocks
            if (!paddockId && d.paddock_hint && paddocks?.length) {
              const hint = d.paddock_hint.toLowerCase()
              const match = paddocks.find(p =>
                p.name?.toLowerCase().includes(hint) || hint.includes(p.name?.toLowerCase())
              )
              if (match) finalPaddockId = match.id
            }

            analysisResult = {
              category:      d.category,
              paddock_hint:  d.paddock_hint,
              tasks:         d.tasks || [],
              confidence:    d.confidence,
            }
          }
        } catch { /* fallback to Web Speech transcript */ }

        setSavingMsg('Guardando...')
        const response = await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: finalPaddockId, tags: finalTags,
            title: `Audio · ${timestamp}`,
            content: transcript || null,
            audio_url, audio_duration_secs: recordSecsSnap.current,
            analysis_result: analysisResult,
          }),
        })
        if (!response.ok) throw new Error('Error al guardar nota de audio')
      }

      // ── FOTO save ───────────────────────────────────────────────
      else if (mode === 'FOTO' && photoFile) {
        setSavingMsg('Subiendo foto...')
        let photo_url: string | null = null
        try {
          const compressedImage = await compressImage(photoFile)
          const fd = new FormData()
          fd.append('file', compressedImage); fd.append('folder', 'bitacora-photos')
          const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (r.ok) { photo_url = (await r.json()).url }
        } catch (err) {
          console.error('[BitacoraModal] compress error:', err)
        }

        setSavingMsg('Guardando...')
        const response = await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: paddockId || null, tags,
            title: `Foto · ${timestamp}`,
            content: null,
            photo_url,
          }),
        })
        if (!response.ok) throw new Error('Error al guardar nota con foto')
      }

      // ── TEXTO save ──────────────────────────────────────────────────
      else if (mode === 'TEXTO') {
        setSavingMsg('Guardando...')
        const response = await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: paddockId || null, tags,
            title: textTitle,
            content: textContent || null,
          }),
        })
        if (!response.ok) throw new Error('Error al guardar nota de texto')
      }

      setSaving(false); onSaved(); onClose()
    } catch (e: any) {
      console.error('BitacoraModal save error:', e)
      toast.error(e.message || 'Error al guardar la nota')
      setSaving(false); setSavingMsg('')
    }
  }

  // ── Mode button config ────────────────────────────────────────────────
  const MODES: { id: CaptureMode; label: string; icon: React.ReactNode }[] = [
    { id: 'AUDIO', label: 'Audio', icon: <Mic className="w-5 h-5" /> },
    { id: 'FOTO',  label: 'Foto',  icon: <Camera className="w-5 h-5" /> },
    { id: 'TEXTO', label: 'Texto', icon: <Type className="w-5 h-5" /> },
  ]

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-lg shadow-2xl relative z-10 rounded-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-950 tracking-tight">Nueva Nota</h2>
            {(paddockId || initialPaddockName) && (
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Para: {paddocks?.find(p => p.id === paddockId)?.name || initialPaddockName || 'Potrero'}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Paddock selector */}
          {!initialPaddockId && (
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Potrero</label>
              <select value={paddockId} onChange={e => setPaddockId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-green-600 outline-none appearance-none cursor-pointer">
                <option value="">General (Sin potrero específico)</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Mode selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Tipo de registro</label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => (
                <button key={m.id} type="button" onClick={() => switchMode(m.id)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-xs font-black transition-all ${
                    mode === m.id
                      ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-gray-100'
                  }`}>
                  <span className={mode === m.id ? 'text-white' : 'text-gray-400'}>{m.icon}</span>
                  {m.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Clasificación</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} type="button" onClick={() => toggleTag(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    tags.includes(cat.id) ? `${cat.bg} ${cat.border} ${cat.text}` : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                  }`}>
                  <cat.icon className="w-3.5 h-3.5" /> {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── AUDIO MODE ──────────────────────────────────────────────── */}
          {mode === 'AUDIO' && (
            <div className="space-y-3">
              <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Grabación de voz</label>

              {!audioBlob && !isRecording && (
                <button type="button" onClick={startRecording}
                  className="w-full flex flex-col items-center gap-3 py-8 bg-red-50 hover:bg-red-100 border-2 border-dashed border-red-200 rounded-2xl transition-all group">
                  <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-200 group-hover:scale-105 transition-transform">
                    <Mic className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm font-black text-red-700">Presioná para grabar</p>
                  <p className="text-xs text-red-400">El audio se transcribirá automáticamente con IA</p>
                </button>
              )}

              {isRecording && (
                <div className="flex flex-col items-center gap-4 py-6 bg-red-50 rounded-2xl border border-red-100">
                  <Waveform active />
                  <span className="text-2xl font-black text-red-600 tabular-nums">{fmtDuration(recordSecs)}</span>
                  {liveTranscript && (
                    <div className="w-full px-4 py-2 bg-white/80 rounded-xl border border-red-100 mx-4">
                      <p className="text-xs text-gray-600 italic leading-relaxed line-clamp-3">{liveTranscript}</p>
                    </div>
                  )}
                  <button type="button" onClick={stopRecording}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-all active:scale-95">
                    <Square className="w-4 h-4 fill-white" /> Detener
                  </button>
                </div>
              )}

              {audioBlob && !isRecording && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Audio grabado · {fmtDuration(recordSecsSnap.current)}</p>
                    <button type="button" onClick={() => { setAudioBlob(null); setLiveTranscript(''); setAiAnalysis(null) }}
                      className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest">
                      Re-grabar
                    </button>
                  </div>
                  <audio src={URL.createObjectURL(audioBlob)} controls className="w-full h-8 rounded-lg" />
                  {liveTranscript && (
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Transcripción en vivo</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{liveTranscript}</p>
                      <p className="text-[9px] text-gray-400 mt-2">Gemini mejorará la transcripción y detectará la categoría al guardar.</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI analysis preview — shown after save if we had a previous analysis */}
              {aiAnalysis && aiAnalysis.tasks.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Tareas detectadas por IA</p>
                  {aiAnalysis.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-amber-900">{task}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FOTO MODE ──────────────────────────────────────────────── */}
          {mode === 'FOTO' && (
            <div className="space-y-3">
              <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Foto de campo</label>

              {!photoFile && (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => cameraRef.current?.click()}
                    className="flex flex-col items-center gap-3 py-6 bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-200 rounded-2xl transition-all">
                    <Camera className="w-8 h-8 text-blue-500" />
                    <p className="text-xs font-black text-blue-700">Tomar foto</p>
                  </button>
                  <button type="button" onClick={() => galleryRef.current?.click()}
                    className="flex flex-col items-center gap-3 py-6 bg-violet-50 hover:bg-violet-100 border-2 border-dashed border-violet-200 rounded-2xl transition-all">
                    <ImageIcon className="w-8 h-8 text-violet-500" />
                    <p className="text-xs font-black text-violet-700">Galería</p>
                  </button>
                </div>
              )}

              {photoFile && photoPreview && (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="preview" className="w-full h-48 object-cover rounded-2xl border border-gray-100" />
                  <button type="button" onClick={resetPhoto}
                    className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest">
                    Cambiar foto
                  </button>
                </div>
              )}

              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
              <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
            </div>
          )}

          {/* ── TEXTO MODE ─────────────────────────────────────────────── */}
          {mode === 'TEXTO' && (
            <div className="space-y-3">
              <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Nota de texto</label>
              <input type="text" value={textTitle} onChange={e => setTextTitle(e.target.value)}
                placeholder="Título · ¿Qué está pasando?" required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base md:text-sm font-bold text-gray-950 focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300" />
              <textarea value={textContent} onChange={e => setTextContent(e.target.value)}
                placeholder="Detalle adicional (opcional)..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base md:text-sm font-medium text-gray-700 focus:ring-1 focus:ring-green-600 outline-none resize-none transition-all placeholder:text-gray-400" />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave()}
            className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 shadow-md shadow-green-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {savingMsg || 'Guardando...'}</>
              : <><Check className="w-4 h-4" /> Guardar Nota</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
