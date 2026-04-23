'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineIndicator'
import {
  Mic, Camera, Square, Loader2, MapPin, Image as ImageIcon,
  CheckCircle2, Mic2, User, Clock, Search,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}
const fmtDuration = (secs: number) => {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
const groupByDate = (notes: any[]) => {
  const map = new Map<string, any[]>()
  for (const n of notes) {
    const key = fmtDate(n.created_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  return map
}

// ── Recording timer hook ───────────────────────────────────────────────────────
function useTimer(active: boolean) {
  const [secs, setSecs] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (active) {
      setSecs(0)
      ref.current = setInterval(() => setSecs(s => s + 1), 1000)
    } else {
      if (ref.current) clearInterval(ref.current)
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [active])
  return secs
}

// ── Waveform ──────────────────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-7">
      {Array.from({ length: 11 }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full bg-red-500 transition-all duration-150 ${active ? 'animate-pulse' : ''}`}
          style={{
            height: active ? `${10 + Math.abs(Math.sin(i * 0.7)) * 16}px` : '3px',
            animationDelay: `${i * 60}ms`,
            animationDuration: `${500 + i * 70}ms`,
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BitacoraPage() {
  const { user } = useAuth()

  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Recording state ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const recordSecs = useTimer(isRecording)
  const recordSecsRef = useRef(0) // captures duration before timer resets

  // ── Photo state ────────────────────────────────────────────────────────────
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)

  // ── Location ───────────────────────────────────────────────────────────────
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await apiFetch('/api/field-notes')
    setNotes(res.ok ? (await res.json()).notes || [] : [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadNotes() }, [loadNotes])

  // ── Geo ────────────────────────────────────────────────────────────────────
  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setAudioBlob(null); setAudioUrl(null)
    getLocation()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch {
      alert('No se pudo acceder al micrófono')
    }
  }

  const stopRecording = () => {
    recordSecsRef.current = recordSecs // save before timer resets
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    getLocation()
  }

  // ── Auto-save after stop recording ────────────────────────────────────────
  useEffect(() => {
    if (audioBlob && !isRecording) {
      saveNote()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, isRecording])

  // ── Auto-save after photo ──────────────────────────────────────────────────
  useEffect(() => {
    if (photoFile) {
      saveNote()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFile])

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (saving) return
    setSaving(true)

    const title = audioBlob
      ? `Audio · ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
      : photoFile
        ? `Foto · ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
        : 'Nota de campo'

    // Offline queue fallback
    if (!navigator.onLine) {
      addToOfflineQueue({
        type: 'field_note',
        data: {
          created_by: user?.uid,
          paddock_id: null,
          tags: ['GENERAL'],
          category: 'GENERAL',
          title,
          content: null,
          lat, lng,
          sync_status: 'PENDING',
        },
        timestamp: Date.now(),
      })
      setSaving(false)
      flashSaved()
      resetCapture()
      return
    }

    try {
      let audio_url: string | null = null
      let photo_url: string | null = null

      if (audioBlob) {
        const fd = new FormData()
        fd.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
        fd.append('folder', 'bitacora-audio')
        const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (r.ok) { 
          const d = await r.json()
          audio_url = d.url 
        } else {
          const errData = await r.json().catch(() => ({}))
          console.error('Audio upload failed:', errData)
          throw new Error('Error al subir audio')
        }
      }

      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        fd.append('folder', 'bitacora-photos')
        const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (r.ok) { 
          const d = await r.json()
          photo_url = d.url 
        } else {
          const errData = await r.json().catch(() => ({}))
          console.error('Photo upload failed:', errData)
          throw new Error('Error al subir foto')
        }
      }

      const res = await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          paddock_id: null,
          tags: ['GENERAL'],
          title,
          content: null,
          lat, lng,
          audio_url,
          photo_url,
          audio_duration_secs: audioBlob ? recordSecsRef.current : null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Field note save failed:', errData)
        throw new Error(errData.message || 'Error al guardar nota')
      }

      flashSaved()
      resetCapture()
      loadNotes()
    } catch {
      setSaving(false)
    }
  }

  const flashSaved = () => {
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const resetCapture = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setPhotoFile(null)
    setPhotoPreview(null)
    setLat(null); setLng(null)
  }

  // ── Grouped notes ──────────────────────────────────────────────────────────
  const sorted = [...notes].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const grouped = groupByDate(sorted)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-[calc(100vh-120px)] flex flex-col bg-white">
      
      {/* ── Header Estilo iOS ── */}
      <div className="px-6 pt-10 pb-4">
        <h1 className="text-4xl font-black tracking-tight text-gray-950">Bitácora</h1>
        <div className="relative mt-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar grabaciones..."
            className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-200"
          />
        </div>
      </div>

      {/* ── NOTES LIST ── */}
      <div className="flex-1 pb-48 px-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-32 text-gray-400">
            <Mic2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-sm font-bold text-gray-300 italic">No hay registros</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateLabel, dayNotes]) => (
            <div key={dateLabel} className="mb-8">
              {/* Date header */}
              <div className="py-2.5 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-gray-50">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{dateLabel}</span>
              </div>

              {/* Rows simplified */}
              <div className="divide-y divide-gray-50">
                {dayNotes.map((note) => {
                  const isAudio = !!note.audio_url
                  const isPhoto = !!note.photo_url

                  return (
                    <div
                      key={note.id}
                      className="group flex items-center justify-between py-5 active:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-lg font-bold text-gray-950 truncate tracking-tight">
                          {note.title.replace('Audio · ', '').replace('Foto · ', '')}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                          <span className="text-sm font-medium">{fmtTime(note.created_at)}</span>
                          {note.paddock_name && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-gray-200" />
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
                                {note.paddock_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1 max-w-[140px]">
                        {isAudio && note.audio_url ? (
                          <>
                            <audio
                              src={note.audio_url}
                              controls
                              preload="none"
                              className="h-8 w-36 rounded-lg"
                              style={{ accentColor: '#ef4444' }}
                            />
                            {note.audio_duration_secs != null && (
                              <span className="text-[10px] text-gray-300 tabular-nums">
                                {fmtDuration(note.audio_duration_secs)}
                              </span>
                            )}
                          </>
                        ) : isPhoto && note.photo_url ? (
                          <div
                            className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => window.open(note.photo_url, '_blank')}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={note.photo_url} alt="foto" className="w-full h-full object-cover" />
                          </div>
                        ) : isPhoto ? (
                          <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 border border-gray-100">
                            <Camera className="w-5 h-5" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── FIXED CAPTURE AREA — VOICE MEMOS STYLE ── */}
      <div className="fixed bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
        <div className="max-w-md mx-auto flex flex-col items-center gap-8 pointer-events-auto">
          
          {isRecording ? (
            <div className="w-full flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="flex flex-col items-center gap-2">
                <Waveform active />
                <span className="text-3xl font-black text-red-600 tabular-nums tracking-tight">{fmtDuration(recordSecs)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-white border-[6px] border-gray-100 flex items-center justify-center shadow-2xl active:scale-95 transition-all group"
              >
                <div className="w-8 h-8 bg-red-600 rounded-sm shadow-inner" />
              </button>
            </div>
          ) : saving ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-gray-200 animate-spin" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizando...</p>
            </div>
          ) : saved ? (
            <div className="flex flex-col items-center gap-4 py-8 animate-in zoom-in duration-300">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-14">
              {/* Photo */}
              <button
                onClick={() => setShowPhotoMenu(true)}
                className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all border border-gray-100 active:scale-95"
              >
                <Camera className="w-6 h-6" />
              </button>

              {/* RECORD - THE SOLID RED CIRCLE */}
              <button
                onClick={startRecording}
                className="w-24 h-24 rounded-full bg-white border-[6px] border-gray-100 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all group relative"
              >
                <div className="w-16 h-16 rounded-full bg-red-600 shadow-lg shadow-red-200 active:scale-95 transition-transform" />
              </button>

              <div className="w-14 h-14 invisible" />
            </div>
          )}
        </div>
      </div>

      {/* Photo source menu */}
      {showPhotoMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setShowPhotoMenu(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-6" />
            <div className="px-6 space-y-2">
              <button
                onClick={() => { setShowPhotoMenu(false); cameraRef.current?.click() }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 active:bg-gray-100 rounded-2xl transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Tomar Foto</p>
                  <p className="text-xs text-gray-400">Usar la cámara del dispositivo</p>
                </div>
              </button>
              <button
                onClick={() => { setShowPhotoMenu(false); galleryRef.current?.click() }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 active:bg-gray-100 rounded-2xl transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Galería</p>
                  <p className="text-xs text-gray-400">Elegir de tus archivos</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowPhotoMenu(false)}
              className="w-full mt-4 py-4 text-sm font-black text-gray-400 hover:text-gray-600 transition-colors"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
    </div>
  )
}

