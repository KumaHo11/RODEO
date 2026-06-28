import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineManager'
import { X, Mic, Camera, Loader2, Check, Square, Trash2, CloudOff } from 'lucide-react'
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

// ── Visualizador de Audio Real ────────────────────────────────────────────────
function RealWaveform({ stream }: { stream: MediaStream | null }) {
  const [volumes, setVolumes] = useState<number[]>(Array(15).fill(4))
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) return
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const audioCtx = new AudioContextClass()
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = 64
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      const newVols = []
      for(let i=0; i<15; i++) {
        const val = dataArray[i * 2] || 0
        newVols.push(Math.max(4, val / 3))
      }
      setVolumes(newVols)
    }
    draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audioCtx.close().catch(() => {})
    }
  }, [stream])

  return (
    <div className="flex items-center justify-center gap-[3px] h-12">
      {volumes.map((v, i) => (
        <div key={i}
          className="w-[4px] rounded-full bg-red-500 transition-all duration-75"
          style={{ height: `${v}px` }}
        />
      ))}
    </div>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  user: any
  initialPaddockId?: string
  initialPaddockName?: string
  paddocks?: any[]
}

export default function BitacoraModal({
  isOpen, onClose, onSaved, user,
  initialPaddockId, paddocks, initialPaddockName,
}: Props) {

  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  // ── Unified State ────────────────────────────────────────────────────────
  const [paddockId, setPaddockId] = useState(initialPaddockId || '')
  const [textContent, setTextContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingMsg, setSavingMsg] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Audio State
  const [isRecording, setIsRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [liveTranscript, setLiveTranscript] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const speechRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordSecsSnap = useRef(0)
  const isRecordingRef = useRef(false)

  // Photo State
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)

  const resetAll = useCallback(() => {
    setSaving(false); setSavingMsg(''); setTextContent('')
    setIsRecording(false); setRecordSecs(0); setAudioBlob(null); setMediaStream(null); setLiveTranscript('')
    if (timerRef.current) clearInterval(timerRef.current)
    speechRef.current?.stop(); mediaRecorderRef.current?.stop()
    setPhotoFile(null); setPhotoPreview(null); setShowPhotoMenu(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setPaddockId(initialPaddockId || '')
      resetAll()
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen, initialPaddockId, resetAll])

  if (!isOpen) return null

  // ── Auto-expand Textarea ──────────────────────────────────────────────────
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextContent(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  // ── AUDIO ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (audioBlob) {
      const confirm = window.confirm('Ya grabaste un audio. ¿Querés reemplazarlo?')
      if (!confirm) return
    }
    setAudioBlob(null); setLiveTranscript(''); setRecordSecs(0)
    
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true; rec.interimResults = true; rec.lang = 'es-AR'
      rec.onresult = (e: any) => {
        let final = ''
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript
          else interim += e.results[i][0].transcript
        }
        if (final) {
          setTextContent(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + final)
        }
        setLiveTranscript(interim)
      }
      rec.onend = () => {
        if (isRecordingRef.current) {
          try { rec.start() } catch (e) {}
        }
      }
      rec.start()
      speechRef.current = rec
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMediaStream(stream)
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
        setMediaStream(null)
      }
      mr.start()
      mediaRecorderRef.current = mr
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
      isRecordingRef.current = true
      setIsRecording(true)
    } catch {
      speechRef.current?.stop()
      toast.error('No se pudo acceder al micrófono. Verificá los permisos.')
    }
  }

  const stopRecording = () => {
    isRecordingRef.current = false
    recordSecsSnap.current = recordSecs
    if (timerRef.current) clearInterval(timerRef.current)
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (liveTranscript) {
      setTextContent(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + liveTranscript)
      setLiveTranscript('')
    }
  }

  const removeAudio = () => {
    setAudioBlob(null)
    setLiveTranscript('')
    recordSecsSnap.current = 0
  }

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── PHOTO ───────────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  // ── SAVE ────────────────────────────────────────────────────────────────
  const canSave = () => {
    if (saving || isRecording) return false
    return !!audioBlob || !!photoFile || textContent.trim().length > 0
  }

  const handleSave = async () => {
    if (!canSave()) return
    setSaving(true)
    const timestamp = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    const genTitle = `Nota · ${timestamp}`

    if (!isOnline) {
      const audioId = audioBlob ? crypto.randomUUID() : undefined
      const photoId = photoFile ? crypto.randomUUID() : undefined

      if (audioBlob && audioId) {
        const { savePendingAudio } = await import('@/lib/audioOfflineStore')
        await savePendingAudio({
          id: audioId, blob: audioBlob, durationSecs: recordSecsSnap.current,
          lat: null, lng: null, createdAt: new Date().toISOString(), title: genTitle, transcript: ''
        })
      }

      if (photoFile && photoId) {
        const { savePendingPhoto } = await import('@/lib/audioOfflineStore')
        await savePendingPhoto({
          id: photoId, blob: photoFile, lat: null, lng: null, createdAt: new Date().toISOString(), title: genTitle
        })
      }

      addToOfflineQueue({
        type: 'field_note',
        data: {
          created_by: user?.uid, paddock_id: paddockId || null,
          tags: ['GENERAL'], category: 'GENERAL', title: genTitle, content: textContent || null,
          sync_status: 'PENDING',
        },
        timestamp: Date.now(),
        mediaIds: { audio: audioId, photo: photoId },
        hasAudio: !!audioBlob,
        hasPhoto: !!photoFile
      } as any)
      toast.success('Nota guardada en el dispositivo. Se sincronizará automáticamente.')
      setSaving(false); onSaved(); onClose(); return
    }

    try {
      setSavingMsg('Guardando...')
      let audio_url: string | null = null
      let photo_url: string | null = null

      if (audioBlob) {
        setSavingMsg('Subiendo audio...')
        const fd = new FormData()
        fd.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
        fd.append('folder', 'bitacora-audio')
        const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd, timeout: 60000 })
        if (uploadRes.ok) audio_url = (await uploadRes.json()).url || null
      }

      if (photoFile) {
        setSavingMsg('Subiendo foto...')
        const compressedImage = await compressImage(photoFile)
        const fd = new FormData()
        fd.append('file', compressedImage); fd.append('folder', 'bitacora-photos')
        const r = await apiFetch('/api/upload', { method: 'POST', body: fd, timeout: 60000 })
        if (r.ok) photo_url = (await r.json()).url || null
      }

      setSavingMsg('Analizando nota...')
      const response = await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          paddock_id: paddockId || null, tags: ['GENERAL'],
          title: genTitle, content: textContent || null,
          audio_url, photo_url, audio_duration_secs: recordSecsSnap.current,
          analysis_result: null,
        }),
      })
      if (!response.ok) throw new Error('Error al guardar la nota')
      const savedNote = await response.json().catch(() => ({}))
      const savedNoteId: string | null = savedNote?.note?.id ?? null

      // Background AI transcription/classification
      if (savedNoteId && (audioBlob || textContent)) {
        ;(async () => {
          try {
            let finalTranscript = textContent
            if (audioBlob) {
              const tf = new FormData()
              tf.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 60000)
              const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf, signal: controller.signal, timeout: 60000 }).catch(() => null)
              clearTimeout(timeoutId)
              if (tr?.ok) {
                const d = await tr.json().catch(() => ({}))
                if (d.transcript && d.transcript !== '[Sin voz detectable]') {
                  finalTranscript = finalTranscript ? `${finalTranscript}\n\n[Audio] ${d.transcript}` : d.transcript
                  // We also get category and tasks from transcription endpoint if we want, or we can just save the transcript.
                  const analysisResult = { category: d.category, paddock_hint: d.paddock_hint, tasks: d.tasks || [], confidence: d.confidence }
                  await apiFetch(`/api/field-notes/${savedNoteId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ content: finalTranscript, tags: [d.category || 'GENERAL'], analysis_result: analysisResult }),
                  }).catch(() => null)
                }
              }
            }
          } catch { /* ignore */ }
        })()
      }

      setSaving(false); onSaved(); onClose()
    } catch (e: any) {
      console.error('Save error:', e)
      toast.error(e.message || 'Error al guardar la nota')
      setSaving(false); setSavingMsg('')
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full sm:max-w-lg shadow-2xl relative z-10 sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-gray-950 tracking-tight">Nueva Nota</h2>
              {!isOnline && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1">
                  <CloudOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
            {(paddockId || initialPaddockName) && (
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {paddocks?.find(p => p.id === paddockId)?.name || initialPaddockName || 'Potrero'}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Paddock selector */}
          {!initialPaddockId && (
            <select value={paddockId} onChange={e => setPaddockId(e.target.value)}
              className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 focus:ring-1 focus:ring-green-500 outline-none appearance-none">
              <option value="">General (Sin potrero)</option>
              {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Text Editor */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={textContent}
              onChange={handleTextChange}
              placeholder="Escribí o dictá lo que está pasando..."
              rows={4}
              className="w-full bg-transparent text-base md:text-sm font-medium text-gray-800 placeholder:text-gray-300 outline-none resize-none min-h-[100px]"
            />
            {liveTranscript && (
              <p className="text-sm font-medium text-green-600 italic animate-pulse">
                {liveTranscript}
              </p>
            )}
          </div>

          {/* Media Previews */}
          {(photoPreview || audioBlob) && (
            <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-50">
              {photoPreview && (
                <div className="relative inline-block w-24 h-24 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Adjunto" className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-sm" />
                  <button onClick={removePhoto} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md scale-0 group-hover:scale-100 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {audioBlob && !isRecording && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-2 pr-4 relative group">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-gray-400">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-700">Audio grabado</p>
                    <p className="text-[10px] text-gray-400">{fmtDuration(recordSecsSnap.current)}</p>
                  </div>
                  <button onClick={removeAudio} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Recording State */}
          {isRecording && (
            <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col items-center gap-3">
              <span className="text-xs font-black text-red-500 uppercase tracking-widest animate-pulse">Grabando</span>
              <RealWaveform stream={mediaStream} />
              <span className="text-xl font-black text-red-600 tabular-nums">{fmtDuration(recordSecs)}</span>
            </div>
          )}

        </div>

        {/* Toolbar & Save */}
        <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button type="button" onClick={startRecording}
                className="w-10 h-10 rounded-full bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors">
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button type="button" onClick={stopRecording}
                className="w-10 h-10 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors">
                <Square className="w-4 h-4 fill-current" />
              </button>
            )}
            
            <button type="button" onClick={() => setShowPhotoMenu(true)}
              className="w-10 h-10 rounded-full bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-500 flex items-center justify-center transition-colors">
              <Camera className="w-5 h-5" />
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
            <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
          </div>

          <button type="button" onClick={handleSave} disabled={!canSave()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-sm transition-all ${
              isOnline ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? (savingMsg || 'Guardando...') : (isOnline ? 'Guardar' : 'Guardar offline')}
          </button>

        </div>
      </div>

      {/* Photo menu modal */}
      {showPhotoMenu && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-gray-900/50 backdrop-blur-md px-4"
          onClick={() => setShowPhotoMenu(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowPhotoMenu(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6 mt-2">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-100">
                <Camera className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Agregar imagen</h3>
              <p className="text-sm text-gray-500 mt-1">Seleccioná el origen de la foto</p>
            </div>
            
            <div className="space-y-3">
              <button onClick={() => { setShowPhotoMenu(false); cameraRef.current?.click() }}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all font-bold">
                <Camera className="w-4 h-4" />
                <span>Tomar foto con la cámara</span>
              </button>
              
              <button onClick={() => { setShowPhotoMenu(false); galleryRef.current?.click() }}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 transition-all font-bold border border-green-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                <span>Elegir de la galería</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
