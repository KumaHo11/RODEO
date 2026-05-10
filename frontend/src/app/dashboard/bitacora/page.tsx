'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { savePendingAudio, getAllPendingAudios, deletePendingAudio, PendingAudio, savePendingPhoto, getAllPendingPhotos, deletePendingPhoto, countPendingItems } from '@/lib/audioOfflineStore'
import {
  Mic, Camera, Loader2, Image as ImageIcon,
  CheckCircle2, Mic2, Search, WifiOff, ChevronDown, ChevronUp, Lock, MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePlan } from '@/hooks/usePlan'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso: string) => {
  const d = new Date(iso), today = new Date(), yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}
const fmtDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
const groupByDate = (notes: any[]) => {
  const map = new Map<string, any[]>()
  for (const n of notes) {
    const key = fmtDate(n.created_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  return map
}

// ── Timer hook ────────────────────────────────────────────────────────────────
function useTimer(active: boolean) {
  const [secs, setSecs] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (active) { setSecs(0); ref.current = setInterval(() => setSecs(s => s + 1), 1000) }
    else if (ref.current) clearInterval(ref.current)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [active])
  return secs
}

// ── Waveform ──────────────────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-7">
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i} className={`w-[3px] rounded-full bg-red-500 transition-all duration-150 ${active ? 'animate-pulse' : ''}`}
          style={{ height: active ? `${10 + Math.abs(Math.sin(i * 0.7)) * 16}px` : '3px', animationDelay: `${i * 60}ms`, animationDuration: `${500 + i * 70}ms` }} />
      ))}
    </div>
  )
}

// ── Note row ──────────────────────────────────────────────────────────────────
function NoteRow({ note }: { note: any }) {
  const [expanded, setExpanded] = useState(false)
  const isAudio = !!note.audio_url
  const isPhoto = !!note.photo_url
  const hasTranscript = !!note.content

  return (
    <div className="group py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-950 tracking-tight leading-snug">
            {note.title.replace('Audio · ', '').replace('Foto · ', '')}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-gray-400">{fmtTime(note.created_at)}</span>
            {note.paddock_name && (
              <><span className="w-1 h-1 rounded-full bg-gray-200" /><span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">{note.paddock_name}</span></>
            )}
            {isAudio && <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Audio</span>}
          </div>

          {/* Transcript preview */}
          {hasTranscript && (
            <div className="mt-2">
              <p className={`text-sm text-gray-600 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
                {note.content}
              </p>
              {note.content.length > 100 && (
                <button onClick={() => setExpanded(e => !e)}
                  className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 hover:text-gray-600 transition-colors">
                  {expanded ? <><ChevronUp className="w-3 h-3" />Ver menos</> : <><ChevronDown className="w-3 h-3" />Ver más</>}
                </button>
              )}
            </div>
          )}
          {isAudio && !hasTranscript && (
            <p className="text-xs text-gray-400 italic mt-1">Sin transcripción disponible</p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          {isAudio && note.audio_url ? (
            <>
              <audio src={note.audio_url} controls preload="none" className="h-8 w-36 rounded-lg" style={{ accentColor: '#ef4444' }} />
              {note.audio_duration_secs != null && (
                <span className="text-[10px] text-gray-300 tabular-nums">{fmtDuration(note.audio_duration_secs)}</span>
              )}
            </>
          ) : isPhoto && note.photo_url ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => window.open(note.photo_url, '_blank')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={note.photo_url} alt="foto" className="w-full h-full object-cover" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BitacoraPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const { hasFeature } = usePlan()
  const canVoice = hasFeature('voice_bitacora')
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingMsg, setSavingMsg] = useState('Subiendo...')
  const [pendingOffline, setPendingOffline] = useState(0)
  const [search, setSearch] = useState('')

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const recordSecs = useTimer(isRecording)
  const recordSecsRef = useRef(0)

  // Web Speech live transcript
  const [liveTranscript, setLiveTranscript] = useState('')
  const speechRef = useRef<any>(null)

  // Photo
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)

  // Geo
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  // ── Load notes ──────────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await apiFetch('/api/field-notes')
    setNotes(res.ok ? (await res.json()).notes || [] : [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadNotes() }, [loadNotes])

  // ── Count pending offline audios ────────────────────────────────────────────
  const refreshPending = useCallback(async () => {
    const count = await countPendingItems()
    setPendingOffline(count)
  }, [])

  useEffect(() => { refreshPending() }, [refreshPending])

  // ── Sync offline audios when back online ────────────────────────────────────
  const syncOfflineAudios = useCallback(async () => {
    if (!navigator.onLine) return
    const pending = await getAllPendingAudios()
    const pendingPhotos = await getAllPendingPhotos()
    if (pending.length === 0 && pendingPhotos.length === 0) return

    for (const pa of pending) {
      try {
        const fd = new FormData()
        fd.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
        fd.append('folder', 'bitacora-audio')
        const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) continue
        const { url: audio_url } = await uploadRes.json()

        let transcript = pa.transcript || ''
        if (!transcript) {
          try {
            const tf = new FormData()
            tf.append('file', new File([pa.blob], `audio-${pa.id}.webm`, { type: 'audio/webm' }))
            const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf })
            if (tr.ok) { const d = await tr.json(); transcript = d.transcript || '' }
          } catch { /* transcription optional */ }
        }

        await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: null, tags: ['GENERAL'], title: pa.title,
            content: transcript || null, lat: pa.lat, lng: pa.lng,
            audio_url, audio_duration_secs: pa.durationSecs,
          }),
        })
        await deletePendingAudio(pa.id)
      } catch (e) {
        console.warn('Failed to sync offline audio:', e)
      }
    }

    // Sync pending photos
    for (const pp of pendingPhotos) {
      try {
        const fd = new FormData()
        fd.append('file', new File([pp.blob], `photo-${pp.id}.jpg`, { type: 'image/jpeg' }))
        fd.append('folder', 'bitacora-photos')
        const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) continue
        const { url: photo_url } = await uploadRes.json()
        await apiFetch('/api/field-notes', {
          method: 'POST',
          body: JSON.stringify({
            paddock_id: null, tags: ['GENERAL'], title: pp.title,
            content: null, lat: pp.lat, lng: pp.lng, photo_url,
          }),
        })
        await deletePendingPhoto(pp.id)
      } catch (e) {
        console.warn('Failed to sync offline photo:', e)
      }
    }

    await refreshPending()
    loadNotes()
  }, [loadNotes, refreshPending])

  useEffect(() => {
    window.addEventListener('online', syncOfflineAudios)
    return () => window.removeEventListener('online', syncOfflineAudios)
  }, [syncOfflineAudios])

  // ── Geo ─────────────────────────────────────────────────────────────────────
  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {}, { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ── Recording ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    // Completely isolate audio state — clear everything before starting
    setAudioBlob(null); setAudioUrl(null); setLiveTranscript('')
    setPhotoFile(null) // ensure photo state is clean
    getLocation()

    // Web Speech API for live transcript
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

    // MediaRecorder for audio blob
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
      speechRef.current?.stop()
      toast.error('No se pudo acceder al micrófono. Verificá los permisos del navegador.')
    }
  }

  const stopRecording = () => {
    recordSecsRef.current = recordSecs
    speechRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  // ── Photo ───────────────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Ensure audio state is clean before saving a photo note
    setAudioBlob(null); setAudioUrl(null); setLiveTranscript('')
    setPhotoFile(file)
    getLocation()
  }

  // ── Auto-save triggers — each guarded so they don't cross-fire ────────────
  // Audio: only fires when we have a blob AND we are NOT recording (just stopped)
  // It reads the blob directly; liveTranscript is always reset before recording starts
  useEffect(() => {
    if (audioBlob && !isRecording) saveNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob])

  // Photo: only fires when photoFile changes AND there is no audioBlob pending
  // (audioBlob was cleared in handlePhotoChange so this is safe)
  useEffect(() => {
    if (photoFile && !audioBlob) saveNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFile])

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (saving) return
    setSaving(true)
    const timestamp = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    const title = audioBlob ? `Audio · ${timestamp}` : photoFile ? `Foto · ${timestamp}` : 'Nota'

    // ── OFFLINE path: audio
    if (!navigator.onLine && audioBlob) {
      setSavingMsg('Guardando sin conexión...')
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const pa: PendingAudio = {
        id, blob: audioBlob, durationSecs: recordSecsRef.current,
        lat, lng, createdAt: new Date().toISOString(), title,
        transcript: liveTranscript,
      }
      await savePendingAudio(pa)
      await refreshPending()
      flashSaved(); resetCapture(); return
    }

    // ── OFFLINE path: photo
    if (!navigator.onLine && photoFile) {
      setSavingMsg('Guardando foto sin conexión...')
      const id = `local-photo-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const blob = new Blob([await photoFile.arrayBuffer()], { type: photoFile.type })
      await savePendingPhoto({ id, blob, lat, lng, createdAt: new Date().toISOString(), title })
      await refreshPending()
      flashSaved(); resetCapture(); return
    }

    // ── ONLINE path ──
    try {
      let audio_url: string | null = null
      let photo_url: string | null = null
      let transcript = liveTranscript

      if (audioBlob) {
        // 1. Upload blob
        setSavingMsg('Subiendo audio...')
        const fd = new FormData()
        fd.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
        fd.append('folder', 'bitacora-audio')
        const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (r.ok) { audio_url = (await r.json()).url }

        // 2. Transcribe with Gemini (even if Speech API got something, Gemini is more accurate)
        setSavingMsg('Transcribiendo...')
        try {
          const tf = new FormData()
          tf.append('file', new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))
          const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf })
          if (tr.ok) {
            const d = await tr.json()
            if (d.transcript && d.transcript !== '[Sin voz detectable]') transcript = d.transcript
          }
        } catch { /* keep Web Speech transcript as fallback */ }
      }

      if (photoFile) {
        setSavingMsg('Subiendo foto...')
        const fd = new FormData()
        fd.append('file', photoFile); fd.append('folder', 'bitacora-photos')
        const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (r.ok) { photo_url = (await r.json()).url }
      }

      setSavingMsg('Guardando nota...')
      await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          paddock_id: null, tags: ['GENERAL'], title,
          content: transcript || null, lat, lng,
          audio_url, photo_url,
          audio_duration_secs: audioBlob ? recordSecsRef.current : null,
        }),
      })

      flashSaved(); resetCapture(); loadNotes()
    } catch (e) {
      console.error('saveNote error:', e)
      setSaving(false)
    }
  }

  const flashSaved = () => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const resetCapture = () => {
    setAudioBlob(null); setAudioUrl(null)
    setPhotoFile(null); setLiveTranscript('')
    setLat(null); setLng(null)
  }

  // ── Filtering ───────────────────────────────────────────────────────────────
  const sorted = [...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const filtered = search.trim()
    ? sorted.filter(n => n.title?.toLowerCase().includes(search.toLowerCase()) || n.content?.toLowerCase().includes(search.toLowerCase()))
    : sorted
  const grouped = groupByDate(filtered)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-[calc(100vh-120px)] flex flex-col bg-white">

      {/* Header */}
      <div className="px-6 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black tracking-tight text-gray-950">Bitácora</h1>
          {pendingOffline > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-black text-amber-700">{pendingOffline} pendiente{pendingOffline > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mt-4 w-fit">
          <Link
            href="/dashboard/bitacora"
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              pathname === '/dashboard/bitacora'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Notas
          </Link>
          <Link
            href="/dashboard/bitacora/bandeja"
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              pathname === '/dashboard/bitacora/bandeja'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Bandeja WA
          </Link>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar grabaciones y notas..."
            className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-200" />
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 pb-56 px-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-gray-400">
            <Mic2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-sm font-bold text-gray-300 italic">
              {search ? 'Sin resultados para esa búsqueda' : 'Presioná el círculo rojo para grabar'}
            </p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateLabel, dayNotes]) => (
            <div key={dateLabel} className="mb-6">
              <div className="py-2 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-gray-50">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{dateLabel}</span>
              </div>
              {dayNotes.map(note => <NoteRow key={note.id} note={note} />)}
            </div>
          ))
        )}
      </div>

      {/* Capture area — pinned to bottom of viewport */}
      <div className="sticky bottom-0 left-0 right-0 mt-auto pb-8 sm:pb-6 px-8 pt-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-none z-50">
        <div className="max-w-md mx-auto flex flex-col items-center gap-8 pointer-events-auto">

          {isRecording ? (
            <div className="w-full flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
              {/* Live transcript display */}
              {liveTranscript && (
                <div className="w-full bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 max-h-24 overflow-y-auto">
                  <p className="text-xs text-gray-300 leading-relaxed">{liveTranscript}</p>
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <Waveform active />
                <span className="text-3xl font-black text-red-600 tabular-nums tracking-tight">{fmtDuration(recordSecs)}</span>
              </div>
              <button onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-white border-[6px] border-gray-100 flex items-center justify-center shadow-2xl active:scale-95 transition-all">
                <div className="w-8 h-8 bg-red-600 rounded-sm shadow-inner" />
              </button>
            </div>
          ) : saving ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-10 h-10 text-gray-300 animate-spin" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{savingMsg}</p>
            </div>
          ) : saved ? (
            <div className="flex flex-col items-center gap-4 py-8 animate-in zoom-in duration-300">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </div>
          ) : canVoice ? (
            <div className="flex items-center gap-14">
              <button onClick={() => setShowPhotoMenu(true)}
                className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all border border-gray-100 active:scale-95">
                <Camera className="w-6 h-6" />
              </button>
              <button onClick={startRecording}
                className="w-24 h-24 rounded-full bg-white border-[6px] border-gray-100 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all">
                <div className="w-16 h-16 rounded-full bg-red-600 shadow-lg shadow-red-200" />
              </button>
              <div className="w-14 h-14 invisible" />
            </div>
          ) : (
            /* Plan no incluye voice — mostrar mensaje de upgrade */
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                <Lock className="w-7 h-7 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-gray-700">Grabación de audio</p>
                <p className="text-xs text-gray-400 mt-1">Disponible desde el plan <span className="font-bold text-gray-600">Planificador</span></p>
              </div>
              <button onClick={() => window.location.href = '/dashboard/planes'}
                className="mt-1 px-5 py-2 text-xs font-black text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-all">
                Ver planes y contratar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Photo menu */}
      {showPhotoMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setShowPhotoMenu(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-6" />
            <div className="px-6 space-y-2">
              <button onClick={() => { setShowPhotoMenu(false); cameraRef.current?.click() }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-blue-600" />
                </div>
                <div><p className="text-sm font-black text-gray-900">Tomar Foto</p><p className="text-xs text-gray-400">Usar la cámara del dispositivo</p></div>
              </button>
              <button onClick={() => { setShowPhotoMenu(false); galleryRef.current?.click() }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-violet-600" />
                </div>
                <div><p className="text-sm font-black text-gray-900">Galería</p><p className="text-xs text-gray-400">Elegir de tus archivos</p></div>
              </button>
            </div>
            <button onClick={() => setShowPhotoMenu(false)} className="w-full mt-4 py-4 text-sm font-black text-gray-400">CERRAR</button>
          </div>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
    </div>
  )
}
