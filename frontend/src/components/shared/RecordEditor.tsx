import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Mic, Camera, Loader2, Check, Square, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

// ── Image compression helper ──────────────────────────────────────────────────
export async function compressImage(file: File, maxDim = 1200): Promise<File> {
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

export interface RecordEditorProps {
  onSave: (data: { textContent: string; audioBlob: Blob | null; photoFile: File | null; recordSecs: number; liveTranscript: string }) => Promise<void>
  isOnline: boolean
  savingMsg?: string
}

export default function RecordEditor({ onSave, isOnline, savingMsg }: RecordEditorProps) {
  const [textContent, setTextContent] = useState('')
  const [saving, setSaving] = useState(false)
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
    setSaving(false)
    setTextContent('')
    setIsRecording(false)
    setRecordSecs(0)
    setAudioBlob(null)
    setMediaStream(null)
    setLiveTranscript('')
    if (timerRef.current) clearInterval(timerRef.current)
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setPhotoFile(null)
    setPhotoPreview(null)
    setShowPhotoMenu(false)
  }, [])

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
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', '']
        .find(m => !m || MediaRecorder.isTypeSupported(m)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
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
    
    // Stop recording gracefully if somehow it's still running
    if (isRecording) {
        stopRecording()
        // Wait a tiny bit for the blob to be created
        await new Promise(res => setTimeout(res, 300))
    }

    try {
        await onSave({ textContent, audioBlob, photoFile, recordSecs: recordSecsSnap.current, liveTranscript })
        resetAll()
    } catch (e: any) {
        toast.error(e.message || 'Error al guardar')
    } finally {
        setSaving(false)
    }
  }

  return (
    <div className="flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 space-y-4">
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
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-50">
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
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col items-center gap-3">
            <span className="text-xs font-black text-red-500 uppercase tracking-widest animate-pulse">Grabando</span>
            <RealWaveform stream={mediaStream} />
            <span className="text-xl font-black text-red-600 tabular-nums">{fmtDuration(recordSecs)}</span>
          </div>
        )}
      </div>

      {/* Toolbar & Save */}
      <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button type="button" onClick={startRecording}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center shadow-sm transition-colors">
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            <button type="button" onClick={stopRecording}
              className="w-10 h-10 rounded-full bg-red-100 border border-red-200 text-red-600 hover:bg-red-200 flex items-center justify-center shadow-sm transition-colors">
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}
          
          <button type="button" onClick={() => setShowPhotoMenu(true)}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-blue-200 hover:bg-blue-50 text-gray-500 hover:text-blue-500 flex items-center justify-center shadow-sm transition-colors">
            <Camera className="w-5 h-5" />
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
          <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
        </div>

        <button type="button" onClick={handleSave} disabled={!canSave()}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white shadow-sm transition-all ${
            isOnline ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
          } disabled:opacity-40 disabled:cursor-not-allowed`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? (savingMsg || 'Guardando...') : (isOnline ? 'Guardar' : 'Guardar offline')}
        </button>
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
