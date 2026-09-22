'use client'
import { enqueue } from '@/lib/offline/outbox'
import { dbGetAll, dbUpsertMany, dbUpsert, metaSet, outboxGetAll, dbGetOrg } from '@/lib/offline/db'


import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  savePendingAudio, getAllPendingAudios, deletePendingAudio, PendingAudio,
  savePendingPhoto, getAllPendingPhotos, deletePendingPhoto,
  countPendingItems, getPendingPhoto, getPendingAudio,
} from '@/lib/audioOfflineStore'
import {
  Mic, Camera, Loader2, Image as ImageIcon,
  CheckCircle2, Mic2, Search, WifiOff, ChevronDown, ChevronUp,
  Lock, MessageCircle, FileText, Plus, X as XIcon, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePlan } from '@/hooks/usePlan'
import { useRouter } from 'next/navigation'
import OnboardingTour from '@/components/OnboardingTour'
import { useConfirm } from '@/components/ui/ConfirmModal'

import { BitacoraGrid } from './components/BitacoraGrid'
import { mapRawNote, groupWaPhotoEntries } from '@/types/bitacora'
import type { BitacoraEntry, BitacoraAiResult } from '@/types/bitacora'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
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

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-7">
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i}
          className={`w-[3px] rounded-full bg-red-500 transition-all duration-150 ${active ? 'animate-pulse' : ''}`}
          style={{
            height: active ? `${10 + Math.abs(Math.sin(i * 0.7)) * 16}px` : '3px',
            animationDelay: `${i * 60}ms`,
            animationDuration: `${500 + i * 70}ms`,
          }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BitacoraPage() {
  const { user } = useAuth()
  const { confirm, ConfirmModal } = useConfirm()
  const router = useRouter()
  const { hasFeature } = usePlan()
  const canVoice = hasFeature('voice_bitacora')

  // ── Data ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<BitacoraEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingOffline, setPendingOffline] = useState(0)

  // ── Paddocks + Herds for selectors ────────────────────────────────────────
  const [paddocks, setPaddocks] = useState<{ id: string; name: string }[]>([])
  const [herds, setHerds] = useState<{ id: string; name: string }[]>([])

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingMsg, setSavingMsg] = useState('Subiendo...')
  const [search, setSearch] = useState('')
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string | null>(null)
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string | null>(null)
  const [showMobileHistory, setShowMobileHistory] = useState(true)
  const [editingTextNote, setEditingTextNote] = useState<BitacoraEntry | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const monthNames = useMemo(() =>
    ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  , [])

  // ── Recording ─────────────────────────────────────────────────────────────
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

  // ── Photo ──────────────────────────────────────────────────────────────────
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [showTextMenu, setShowTextMenu] = useState(false)
  const [textNote, setTextNote] = useState('')
  const [showPhotoDetails, setShowPhotoDetails] = useState(false)
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])

  const saveNoteRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Geo
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  // ─── Load paddocks + herds for selectors ───────────────────────────────────
  useEffect(() => {
    if (!user) return
    apiFetch('/api/paddocks').then(r => r.ok && r.json()).then(d => {
      if (d?.paddocks) setPaddocks(d.paddocks.map((p: any) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
    apiFetch('/api/herds').then(r => r.ok && r.json()).then(d => {
      if (d?.herds) setHerds(d.herds.map((h: any) => ({ id: h.id, name: h.name })))
    }).catch(() => {})
  }, [user])

  // ─── Load notes ─────────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let fetchedRaw: any[] = []

    // Step 1: IndexedDB immediate
    try {
      const localNotes = await dbGetAll('field_notes')
      const bitacoraLocal = localNotes.filter((n: any) => !n.paddock_id)
      if (bitacoraLocal.length > 0) {
        fetchedRaw = bitacoraLocal
        setNotes(bitacoraLocal.map(mapRawNote))
        setLoading(false)
      }
    } catch { /* ignore */ }

    // Step 2: API background refresh
    try {
      const res = await apiFetch('/api/field-notes?bitacora_only=1')
      if (res.ok) {
        fetchedRaw = (await res.json()).notes || []
        await dbUpsertMany('field_notes', fetchedRaw).catch(() => {})
      }
    } catch { /* keep IDB data */ }

    // Step 3: Merge offline outbox
    try {
      const pendingItems = await outboxGetAll()
      const pendingNotes = pendingItems.filter((item: any) => {
        try {
          const body = item.body ? JSON.parse(item.body) : {}
          return (
            item.type === 'field_note' &&
            (body?.paddock_id === null || body?.paddock_id === undefined || body?.paddock_id === '') &&
            !body?.herd_id
          )
        } catch { return false }
      })

      const localNotes = await Promise.all(pendingNotes.map(async (item: any) => {
        const body = item.body ? JSON.parse(item.body) : {}
        const noteData: any = {
          ...body,
          id: item.id,
          created_at: new Date(item.created_at).toISOString(),
          is_pending: true,
          title: body.title ?? 'Pendiente',
        }
        if (item.mediaType === 'photo' && item.mediaId) {
          const photo = await getPendingPhoto(item.mediaId)
          if (photo?.blob) noteData.photo_url = URL.createObjectURL(photo.blob)
        } else if (item.mediaType === 'audio' && item.mediaId) {
          const audio = await getPendingAudio(item.mediaId)
          if (audio?.blob) {
            noteData.audio_url = URL.createObjectURL(audio.blob)
            noteData.audio_duration_secs = audio.durationSecs
            if (!noteData.content && audio.transcript) noteData.content = audio.transcript
          }
        }
        return noteData
      }))

      setNotes(groupWaPhotoEntries([...localNotes, ...fetchedRaw].map(mapRawNote)))
    } catch (e) {
      console.error('Error merging offline notes:', e)
      setNotes(groupWaPhotoEntries(fetchedRaw.map(mapRawNote)))
    }

    setLoading(false)
  }, [user])

  useEffect(() => { loadNotes() }, [loadNotes])

  // ─── Count pending offline ────────────────────────────────────────────────
  const refreshPending = useCallback(async () => {
    const count = await countPendingItems()
    setPendingOffline(count)
  }, [])

  useEffect(() => { refreshPending() }, [refreshPending])

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let isLoadingRef = false

    const queueHandler = () => { refreshPending(); loadNotes() }
    const syncHandler = () => {
      refreshPending()
      if (isLoadingRef) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        isLoadingRef = true
        loadNotes().finally(() => { isLoadingRef = false })
      }, 3000)
    }

    window.addEventListener('rodeo_queue_updated', queueHandler)
    window.addEventListener('rodeo_sync_completed', syncHandler)
    return () => {
      window.removeEventListener('rodeo_queue_updated', queueHandler)
      window.removeEventListener('rodeo_sync_completed', syncHandler)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [refreshPending, loadNotes])

  // ─── Geo ──────────────────────────────────────────────────────────────────
  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      () => {}, { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ─── Recording ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setAudioBlob(null); setAudioUrl(null); setLiveTranscript('')
    setPhotoFiles([])
    getLocation()

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
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
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

  // ─── Photo ────────────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setAudioBlob(null); setAudioUrl(null); setLiveTranscript('')
    
    const newFiles = [...photoFiles, ...files].slice(0, 10)
    setPhotoFiles(newFiles)
    
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setPhotoPreviews(newPreviews)
    
    setTextNote('')
    setShowPhotoDetails(true)
    getLocation()
  }

  const removePhoto = (idx: number) => {
    const newFiles = [...photoFiles]
    newFiles.splice(idx, 1)
    setPhotoFiles(newFiles)
    setPhotoPreviews(newFiles.map(f => URL.createObjectURL(f)))
    if (newFiles.length === 0) resetCapture()
  }

  // ─── Auto-save audio on stop ──────────────────────────────────────────────
  useEffect(() => {
    if (audioBlob && !isRecording) saveNoteRef.current()
  }, [audioBlob, isRecording])

  // ─── Save ──────────────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (saving) return
    setSaving(true)
    const timestamp = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    const title = audioBlob ? `Audio · ${timestamp}` : photoFiles.length > 0 ? `Foto · ${timestamp}` : 'Nota'

    // OFFLINE path: audio
    if (!navigator.onLine && audioBlob) {
      setSavingMsg('Guardando sin conexión...')
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const pa: PendingAudio = {
        id, blob: audioBlob, durationSecs: recordSecsRef.current,
        lat, lng, createdAt: new Date().toISOString(), title,
        transcript: liveTranscript,
      }
      await savePendingAudio(pa)
      await enqueue({
        type: 'field_note', url: '/api/field-notes', method: 'POST',
        body: { paddock_id: null, tags: ['GENERAL'], title, content: liveTranscript || null, lat, lng, sync_status: 'PENDING' },
        mediaType: 'audio', mediaId: id,
        idempotency_key: `field_note-audio-${id}`,
      })
      await refreshPending()
      toast.success('🎙️ Audio guardado. Se subirá al servidor cuando tengas conexión.')
      flashSaved(); resetCapture(); return
    }

    // OFFLINE path: photo
    if (!navigator.onLine && photoFiles.length > 0) {
      setSavingMsg(`Guardando foto${photoFiles.length > 1 ? 's' : ''} sin conexión...`)
      
      const photoIds = photoFiles.map(() => `local-photo-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      
      for (let i = 0; i < photoFiles.length; i++) {
        const blob = new Blob([await photoFiles[i].arrayBuffer()], { type: photoFiles[i].type })
        await savePendingPhoto({ id: photoIds[i], blob, lat, lng, createdAt: new Date().toISOString(), title })
      }
      
      await enqueue({
        type: 'field_note', url: '/api/field-notes', method: 'POST',
        body: { paddock_id: null, tags: ['GENERAL'], title, content: textNote.trim() || null, lat, lng, sync_status: 'PENDING' },
        mediaType: 'photo', mediaId: photoIds[0],
        mediaIds: { photo: photoIds[0], photos: photoIds }, // Extra data for sync
        idempotency_key: `field_note-photo-${photoIds[0]}`,
      } as any)
      await refreshPending()
      toast.success('📷 Foto guardada. Se subirá al servidor cuando tengas conexión.')
      flashSaved(); resetCapture(); return
    }

    // OFFLINE path: text
    if (!navigator.onLine) {
      setSavingMsg('Guardando sin conexión...')
      const noteId = `field-note-text-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await enqueue({
        type: 'field_note', url: '/api/field-notes', method: 'POST',
        body: { paddock_id: null, tags: ['GENERAL'], title, content: liveTranscript || null, lat, lng, sync_status: 'PENDING' },
        idempotency_key: `field_note-text-${noteId}`,
      })
      await refreshPending()
      toast.success('📝 Nota guardada. Se subirá al servidor cuando tengas conexión.')
      flashSaved(); resetCapture(); return
    }

    // ONLINE path
    try {
      let audio_url: string | null = null
      let photo_urls: string[] = []
      let transcript = liveTranscript

      if (audioBlob) {
        setSavingMsg('Subiendo audio...')
        const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
        const fd = new FormData()
        fd.append('file', new File([audioBlob], `audio-${Date.now()}.${ext}`, { type: audioBlob.type }))
        fd.append('folder', 'bitacora-audio')
        const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
        if (r.ok) { audio_url = (await r.json()).url }

        setSavingMsg('Transcribiendo...')
        try {
          const tf = new FormData()
          tf.append('file', new File([audioBlob], `audio-${Date.now()}.${ext}`, { type: audioBlob.type }))
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60000)
          const tr = await apiFetch('/api/transcribe-audio', { method: 'POST', body: tf, signal: controller.signal })
          clearTimeout(timeoutId)
          if (tr.ok) {
            const d = await tr.json()
            if (d.transcript && d.transcript !== '[Sin voz detectable]') transcript = d.transcript
          }
        } catch { /* fallback to live transcript */ }
      }

      if (photoFiles.length > 0) {
        setSavingMsg(`Subiendo foto${photoFiles.length > 1 ? 's' : ''}...`)
        const uploadPromises = photoFiles.map(async (file) => {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('folder', 'bitacora-photos')
          const r = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (r.ok) return (await r.json()).url
          return null
        })
        const results = await Promise.all(uploadPromises)
        photo_urls = results.filter(Boolean) as string[]
      }
      
      const photo_url = photo_urls.length > 0 ? photo_urls[0] : null

      setSavingMsg('Guardando nota...')
      const postRes = await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          paddock_id: null, tags: ['GENERAL'], title,
          content: textNote.trim() || transcript || null,
          lat, lng, audio_url, photo_url, photo_urls,
          audio_duration_secs: audioBlob ? recordSecsRef.current : null,
        }),
      })

      if (postRes.ok) {
        // Upsert optimista en IDB: la nota nueva llega de inmediato al store local,
        // sin depender del próximo prefetch ni de loadNotes() desde la red.
        try {
          const { note } = await postRes.clone().json()
          if (note?.id) {
            await dbUpsert('field_notes', note)
            // Invalida el TTL para que el siguiente prefetch siempre refresque IDB
            await metaSet('prefetch_ts_field_notes', 0)
          }
        } catch { /* no crítico — loadNotes() a continuación es el fallback */ }
      }

      flashSaved(); resetCapture(); loadNotes()

    } catch (e) {
      console.error('saveNote error:', e)
      setSaving(false)
    }
  }

  const saveTextNote = async () => {
    if (saving || !textNote.trim()) return
    setSaving(true)
    const timestamp = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    const title = `Nota de texto · ${timestamp}`

    if (!navigator.onLine) {
      setSavingMsg('Guardando sin conexión...')
      const txtId = `field-note-text-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await enqueue({
        type: 'field_note', url: '/api/field-notes', method: 'POST',
        body: { paddock_id: null, tags: ['GENERAL'], title, content: textNote.trim(), lat, lng, sync_status: 'PENDING' },
        idempotency_key: `field_note-text-${txtId}`,
      })
      toast.success('📝 Nota guardada. Se subirá al servidor cuando tengas conexión.')
      flashSaved(); resetCapture(); setShowTextMenu(false); setTextNote(''); return
    }

    try {
      setSavingMsg('Guardando nota...')
      const postRes = await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({ paddock_id: null, tags: ['GENERAL'], title, content: textNote.trim(), lat, lng }),
      })
      if (postRes.ok) {
        try {
          const { note } = await postRes.clone().json()
          if (note?.id) {
            await dbUpsert('field_notes', note)
            await metaSet('prefetch_ts_field_notes', 0)
          }
        } catch { /* no crítico */ }
      }
      flashSaved(); resetCapture(); setShowTextMenu(false); setTextNote(''); loadNotes()

    } catch {
      toast.error('No se pudo guardar la nota')
      setSaving(false)
    }
  }

  const updateTextNote = async () => {
    if (saving || !editingTextNote || !(editingTextNote.content || '').trim()) return
    setSaving(true)
    try {
      setSavingMsg('Actualizando nota...')
      await apiFetch(`/api/field-notes/${editingTextNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: (editingTextNote.content || '').trim() }),
      })
      toast.success('Nota actualizada')
      setEditingTextNote(null)
      loadNotes()
    } catch {
      toast.error('No se pudo actualizar la nota')
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: string, isPending: boolean) => {
    if (isPending) {
      toast.info('No se pueden eliminar notas pendientes hasta que se sincronicen.')
      return
    }
    const ok = await confirm({
      title: 'Eliminar nota',
      description: '¿Estás seguro que deseas eliminar esta nota? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await apiFetch(`/api/field-notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== id))
        toast.success('Nota eliminada')
      } else throw new Error('Error API')
    } catch { toast.error('No se pudo eliminar la nota') }
  }

  saveNoteRef.current = saveNote

  const flashSaved = () => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const resetCapture = () => {
    setAudioBlob(null); setAudioUrl(null)
    setPhotoFiles([])
    setPhotoPreviews([])
    setLat(null); setLng(null)
    setShowPhotoDetails(false)
  }
  const handleCancelCapture = resetCapture

  // ─── WhatsApp handlers ────────────────────────────────────────────────────
  const handleApplyWA = async (note: BitacoraEntry) => {
    const ar = note.analysis_result
    if (!ar) return
    try {
      await apiFetch(`/api/field-notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      setNotes(prev => prev.map(n =>
        n.id === note.id
          ? { ...n, status: 'APPROVED', analysis_result: { ...ar, needsReview: false } }
          : n
      ))
      toast.success('✅ Novedad aplicada al planificador')
    } catch { toast.error('No se pudo aplicar la sugerencia') }
  }

  const handleDismissWA = async (note: BitacoraEntry) => {
    try {
      await apiFetch(`/api/field-notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DISMISSED', analysis_result: null }),
      })
      setNotes(prev => prev.filter(n => n.id !== note.id))
      toast.success('Novedad descartada')
    } catch { toast.error('No se pudo descartar la sugerencia') }
  }

  const handleAiResultSaved = (noteId: string, result: BitacoraAiResult) => {
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, aiResult: result } : n
    ))
  }

  // ─── Filtering ────────────────────────────────────────────────────────────
  const sorted = [...notes].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    notes.forEach(note => {
      const d = new Date(note.createdAt)
      if (!isNaN(d.getTime())) months.add(monthNames[d.getMonth()])
    })
    return Array.from(months)
  }, [notes, monthNames])

  const filtered = useMemo(() => {
    return sorted.filter(n => {
      if (search.trim() && !(
        n.title?.toLowerCase().includes(search.toLowerCase()) ||
        n.content?.toLowerCase().includes(search.toLowerCase())
      )) return false

      let type = 'texto'
      if (n.mediaType === 'audio') type = 'audio'
      else if (n.mediaType === 'image') type = 'foto'
      else if (n.mediaType === 'video') type = 'video'
      else if (n.source === 'WHATSAPP' || n.source === 'whatsapp') type = 'whatsapp'

      if (historyTypeFilter) {
        if (historyTypeFilter === 'audio' && type !== 'audio') return false
        if (historyTypeFilter === 'foto' && type !== 'foto') return false
        if (historyTypeFilter === 'video' && type !== 'video') return false
        if (historyTypeFilter === 'texto' && type !== 'texto') return false
        if (historyTypeFilter === 'whatsapp' && n.source !== 'WHATSAPP' && n.source !== 'whatsapp') return false
      }

      if (historyMonthFilter) {
        const d = new Date(n.createdAt)
        if (!isNaN(d.getTime()) && monthNames[d.getMonth()] !== historyMonthFilter) return false
      }

      return true
    })
  }, [sorted, search, historyTypeFilter, historyMonthFilter, monthNames])

  // ─── Stats ────────────────────────────────────────────────────────────────
  const ac = notes.filter(n => n.mediaType === 'audio').length
  const ic = notes.filter(n => n.mediaType === 'image').length
  const vc = notes.filter(n => n.mediaType === 'video').length
  const tc = notes.filter(n => n.mediaType === 'text' && n.source !== 'WHATSAPP' && n.source !== 'whatsapp').length
  const wc = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true'
    ? notes.filter(n => n.source === 'WHATSAPP' || n.source === 'whatsapp').length : 0
  const pr = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true'
    ? notes.filter(n => (n.source === 'WHATSAPP' || n.source === 'whatsapp') && n.analysis_result?.needsReview).length : 0

  const chips = [
    { label: 'Audios', count: ac, key: 'audio' },
    { label: 'Imágenes', count: ic, key: 'foto' },
    ...(vc > 0 ? [{ label: 'Videos', count: vc, key: 'video' }] : []),
    { label: 'Textos', count: tc, key: 'texto' },
    ...(wc > 0 ? [{ label: 'WhatsApp', count: wc, key: 'whatsapp', highlight: pr > 0 ? pr : null }] : []),
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-[calc(100vh-120px)] flex flex-col">
      <OnboardingTour
        tourId="tour-bitacora-v2"
        steps={[
          {
            target: '.tour-bitacora-filtros',
            title: 'Busca y Filtra tus Notas',
            content: 'Filtrá por audios, fotos, videos o mensajes de WhatsApp.',
          },
          {
            target: '.tour-bitacora-grabar',
            title: 'Graba una Nota de Voz',
            content: 'Pulsá el círculo rojo para grabar. Se transcribe automáticamente.',
          },
        ]}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="pt-2 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950">Bitácora</h1>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              Registro de actividades · Notas de voz y fotos · Historial del campo
            </p>

            {/* Stats chips */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit mt-3 flex-wrap">
              {chips.map(s => (
                <div key={s.label} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-white text-gray-900 shadow-sm pointer-events-none select-none">
                  {s.label}
                  <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                    (s as any).highlight ? 'bg-amber-500 text-white' : 'bg-gray-900 text-white'
                  }`}>{s.count}</span>
                  {(s as any).highlight && (
                    <span className="text-[9px] font-black text-amber-600">{(s as any).highlight} revisiones</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start">
            {pendingOffline > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shrink-0">
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-black text-amber-700 hidden sm:inline">
                  {pendingOffline} pendiente{pendingOffline > 1 ? 's' : ''}
                </span>
                <span className="text-xs font-black text-amber-700 sm:hidden">
                  {pendingOffline}
                </span>
              </div>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200 whitespace-nowrap shrink-0">
                <Plus className="w-4 h-4 shrink-0" /> Nuevo registro
              </button>
              
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 flex flex-col gap-1">
                     <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => { setMenuOpen(false); startRecording() }}>
                       <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                         <Mic className="w-4 h-4 text-red-500" />
                       </div>
                       <span className="text-sm font-bold text-gray-700">Grabar audio</span>
                     </button>
                     <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => { setMenuOpen(false); setShowPhotoMenu(true) }}>
                       <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                         <Camera className="w-4 h-4 text-green-600" />
                       </div>
                       <span className="text-sm font-bold text-gray-700">Tomar foto</span>
                     </button>
                     <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => { setMenuOpen(false); setShowTextMenu(true) }}>
                       <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                         <FileText className="w-4 h-4 text-slate-600" />
                       </div>
                       <span className="text-sm font-bold text-gray-700">Agregar texto</span>
                     </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="tour-bitacora-filtros flex gap-3 flex-wrap items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar en bitácora..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={historyTypeFilter || 'all'}
              onChange={e => setHistoryTypeFilter(e.target.value === 'all' ? null : e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer focus:ring-1 focus:ring-green-600"
            >
              <option value="all">Tipo</option>
              <option value="audio">Audios</option>
              <option value="foto">Imágenes</option>
              {vc > 0 && <option value="video">Videos</option>}
              <option value="texto">Textos</option>
              {process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true' && (
                <option value="whatsapp">WhatsApp</option>
              )}
            </select>

            {availableMonths.length > 0 && (
              <select
                value={historyMonthFilter || 'all'}
                onChange={e => setHistoryMonthFilter(e.target.value === 'all' ? null : e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer focus:ring-1 focus:ring-green-600"
              >
                <option value="all">Mes</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <div className="sm:hidden mt-6">
          <button
            onClick={() => {
              setShowMobileHistory(!showMobileHistory)
              if (!showMobileHistory) {
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all"
          >
            <span>{showMobileHistory ? 'Ocultar historial' : 'Ver historial de registros'} ({filtered.length})</span>
            {showMobileHistory ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div className={`flex-1 pb-64 ${showMobileHistory ? 'block' : 'hidden sm:block'} mt-4 sm:mt-0`}>
        <BitacoraGrid
          entries={filtered}
          loading={loading}
          searchQuery={search}
          paddocks={paddocks}
          herds={herds}
          onDelete={deleteNote}
          onEdit={setEditingTextNote}
          onApplyWA={handleApplyWA}
          onDismissWA={handleDismissWA}
          onAiResultSaved={handleAiResultSaved}
        />
      </div>


      {/* ── Recording & Saving overlays ──────────────────────────────── */}
      {(isRecording || saving || saved) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center pointer-events-none">
          {/* Backdrop — only when recording */}
          {isRecording && (
            <div className="absolute inset-0 bg-gray-950/30 backdrop-blur-[2px] pointer-events-auto" />
          )}

          {isRecording ? (
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] border border-gray-100/80 p-6 flex flex-col items-center gap-5 animate-in slide-in-from-bottom-6 duration-300 pointer-events-auto">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Grabando</span>
              </div>

              {/* Live transcript */}
              {liveTranscript && (
                <div className="w-full bg-gray-950 rounded-2xl px-4 py-3 max-h-24 overflow-y-auto">
                  <p className="text-xs text-gray-300 leading-relaxed">{liveTranscript}</p>
                </div>
              )}

              {/* Waveform */}
              <Waveform active />

              {/* Timer */}
              <span className="text-4xl font-black text-gray-900 tabular-nums tracking-tighter">
                {fmtDuration(recordSecs)}
              </span>

              {/* Stop button — square red pill matching RODEO's button language */}
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-200 flex items-center justify-center"
                aria-label="Detener grabación"
              >
                <div className="w-6 h-6 bg-white rounded-[4px]" />
              </button>

              <p className="text-[10px] text-gray-400 font-semibold">Toca para detener</p>
            </div>
          ) : saving ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 flex items-center gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.10)] pointer-events-auto animate-in slide-in-from-bottom-4 duration-200">
              <Loader2 className="w-5 h-5 text-green-600 animate-spin shrink-0" />
              <p className="text-sm font-bold text-gray-700">{savingMsg}</p>
            </div>
          ) : saved ? (
            <div className="bg-white rounded-2xl border border-green-100 px-6 py-5 flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.10)] pointer-events-auto animate-in zoom-in-95 duration-300">
              <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">¡Guardado!</p>
                <p className="text-[10px] text-gray-400 font-medium">Registro en la bitácora</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Photo menu modal ─────────────────────────────────────────── */}
      {showPhotoMenu && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/50 backdrop-blur-md px-4"
          onClick={() => setShowPhotoMenu(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowPhotoMenu(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
                <ImageIcon className="w-4 h-4" />
                <span>Elegir de la galería</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Text menu modal ──────────────────────────────────────────── */}
      {showTextMenu && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/50 backdrop-blur-md px-4"
          onClick={() => setShowTextMenu(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowTextMenu(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="text-center mb-6 mt-2">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-100">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Agregar texto</h3>
              <p className="text-sm text-gray-500 mt-1">Escribí tu nota de campo</p>
            </div>
            <div className="space-y-4">
              <textarea
                autoFocus
                value={textNote}
                onChange={e => setTextNote(e.target.value)}
                placeholder="Ej: Revisar el bebedero del fondo..."
                className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <button
                onClick={saveTextNote}
                disabled={!textNote.trim() || saving}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-600 text-white rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>Guardar nota</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoChange} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />

      {/* ── Photo details modal ──────────────────────────────────────── */}
      {showPhotoDetails && photoPreviews.length > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/50 backdrop-blur-md px-4"
          onClick={() => resetCapture()}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => resetCapture()} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="text-center mb-4 mt-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Detalles de la imagen</h3>
              <p className="text-sm text-gray-500 mt-1">Podés agregar una descripción (opcional)</p>
            </div>
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                {photoPreviews.map((preview, idx) => (
                  <div key={idx} className="relative w-40 h-32 shrink-0 snap-center group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Vista previa" className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-sm" />
                    <button onClick={() => removePhoto(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md sm:scale-0 sm:group-hover:scale-100 transition-all z-10">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <textarea
                autoFocus
                value={textNote}
                onChange={e => setTextNote(e.target.value)}
                placeholder="Ej: Tranquera rota..."
                className="w-full h-24 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <button
                onClick={saveNote}
                disabled={saving}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-600 text-white rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>Guardar imagen</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit text note modal ──────────────────────────────────────── */}
      {editingTextNote && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/50 backdrop-blur-md px-4"
          onClick={() => setEditingTextNote(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setEditingTextNote(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="text-center mb-6 mt-2">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 border border-gray-200">
                <FileText className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Editar nota</h3>
              <p className="text-sm text-gray-500 mt-1">Modifica el texto guardado</p>
            </div>
            <div className="space-y-4">
              <textarea
                autoFocus
                value={editingTextNote.content || ''}
                onChange={e => setEditingTextNote({ ...editingTextNote, content: e.target.value })}
                className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <button
                onClick={updateTextNote}
                disabled={saving || !(editingTextNote.content || '').trim()}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-600 text-white rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>Guardar cambios</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal />
    </div>
  )
}
