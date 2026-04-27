'use client'

/**
 * Bandeja de Revisión WhatsApp — Dashboard del Productor
 * Permite revisar, editar y aprobar registros enviados por los peones vía WhatsApp.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  MessageSquare, Mic, Image as ImageIcon, Check, ChevronDown,
  ChevronUp, Loader2, Phone, Clock, MapPin, Edit3, X,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────
interface FieldNote {
  id: string
  title: string
  content: string | null
  audio_url: string | null
  photo_url: string | null
  audio_duration_secs: number | null
  whatsapp_phone: string | null
  created_at: string
  status: 'PENDING_REVIEW' | 'APPROVED'
  paddock_id: string | null
  paddock_name: string | null
  user_display_name: string | null
  tags: string[]
}

interface Paddock { id: string; name: string }

const CATEGORIES = [
  { id: 'INFRAESTRUCTURA', label: 'Infraestructura' },
  { id: 'SANIDAD_VEGETAL', label: 'Sanidad vegetal' },
  { id: 'RESTRICCION',     label: 'Restricción'     },
  { id: 'BIOMASA',         label: 'Biomasa'          },
  { id: 'HIDRICO',         label: 'Hídrico'          },
  { id: 'GANADO',          label: 'Ganado'           },
  { id: 'GENERAL',         label: 'General'          },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (iso: string) => new Date(iso).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const phone  = (p: string | null) => p?.replace(/(\+54)(\d{2})(\d{4})(\d{4})/, '$1 $2 $3-$4') ?? '—'

// ── NoteCard component ───────────────────────────────────────────────────────
function NoteCard({
  note, paddocks, onApprove,
}: {
  note: FieldNote
  paddocks: Paddock[]
  onApprove: (id: string, patch: Partial<FieldNote>) => Promise<void>
}) {
  const [editing, setEditing]     = useState(false)
  const [content, setContent]     = useState(note.content ?? '')
  const [paddockId, setPaddockId] = useState(note.paddock_id ?? '')
  const [category, setCategory]   = useState(note.tags?.[0] ?? 'GENERAL')
  const [expanded, setExpanded]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const isApproved = note.status === 'APPROVED'

  const handleApprove = async () => {
    setSaving(true)
    await onApprove(note.id, {
      content,
      paddock_id: paddockId || null,
      tags: [category],
      status: 'APPROVED',
    } as any)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
      isApproved ? 'border-green-100 opacity-75' : 'border-gray-100 shadow-sm hover:shadow-md'
    }`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            note.audio_url ? 'bg-red-50' : note.photo_url ? 'bg-blue-50' : 'bg-gray-50'
          }`}>
            {note.audio_url
              ? <Mic className="w-4 h-4 text-red-500" />
              : note.photo_url
              ? <ImageIcon className="w-4 h-4 text-blue-500" />
              : <MessageSquare className="w-4 h-4 text-gray-400" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 truncate">{note.user_display_name ?? phone(note.whatsapp_phone)}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Clock className="w-3 h-3" />{fmt(note.created_at)}
              </span>
              {note.whatsapp_phone && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Phone className="w-3 h-3" />{phone(note.whatsapp_phone)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isApproved
            ? <span className="flex items-center gap-1 text-[11px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg"><Check className="w-3 h-3"/>Aprobado</span>
            : <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Pendiente</span>
          }
          {!isApproved && (
            <button onClick={() => setEditing(e => !e)}
              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
              {editing ? <X className="w-3.5 h-3.5 text-gray-500" /> : <Edit3 className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          )}
        </div>
      </div>

      {/* Audio player */}
      {note.audio_url && (
        <div className="px-5 pb-3">
          <audio src={note.audio_url} controls preload="none"
            className="w-full h-9 rounded-xl" style={{ accentColor: '#ef4444' }} />
          {note.audio_duration_secs != null && (
            <p className="text-[10px] text-gray-400 mt-1">{fmtDur(note.audio_duration_secs)}</p>
          )}
        </div>
      )}

      {/* Photo */}
      {note.photo_url && (
        <div className="px-5 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={note.photo_url} alt="foto de campo"
            className="w-full max-h-56 object-cover rounded-xl border border-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(note.photo_url!, '_blank')} />
        </div>
      )}

      {/* Transcription / text */}
      {editing ? (
        <div className="px-5 pb-4 space-y-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transcripción / Texto</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              rows={4}
              className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:ring-1 focus:ring-green-600 outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Potrero</label>
              <select value={paddockId} onChange={e => setPaddockId(e.target.value)}
                className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 focus:ring-1 focus:ring-green-600 outline-none appearance-none cursor-pointer">
                <option value="">Sin asignar</option>
                {paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-800 focus:ring-1 focus:ring-green-600 outline-none appearance-none cursor-pointer">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleApprove} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black shadow-md shadow-green-100 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Aprobar y asignar'}
          </button>
        </div>
      ) : (
        note.content && (
          <div className="px-5 pb-4">
            <p className={`text-sm text-gray-600 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
              {note.content}
            </p>
            {note.content.length > 120 && (
              <button onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5 hover:text-gray-600">
                {expanded ? <><ChevronUp className="w-3 h-3"/>Ver menos</> : <><ChevronDown className="w-3 h-3"/>Ver más</>}
              </button>
            )}
            {note.paddock_name && (
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin className="w-3 h-3 text-green-500" />
                <span className="text-xs font-black text-green-700">{note.paddock_name}</span>
              </div>
            )}
            {/* Quick approve without editing */}
            {!isApproved && (
              <button onClick={() => setEditing(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-green-200 text-green-700 rounded-xl text-xs font-black hover:bg-green-50 transition-all">
                <Edit3 className="w-3.5 h-3.5" />Revisar y aprobar
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function BandejaWhatsAppPage() {
  const { user } = useAuth()
  const [notes, setNotes]       = useState<FieldNote[]>([])
  const [paddocks, setPaddocks] = useState<Paddock[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'PENDING_REVIEW' | 'ALL'>('PENDING_REVIEW')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [notesRes, paddocksRes] = await Promise.all([
      apiFetch('/api/field-notes?source=WHATSAPP'),
      apiFetch('/api/paddocks'),
    ])
    if (notesRes.ok) setNotes((await notesRes.json()).notes ?? [])
    if (paddocksRes.ok) setPaddocks((await paddocksRes.json()).paddocks ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const handleApprove = async (id: string, patch: Partial<FieldNote>) => {
    try {
      const res = await apiFetch(`/api/field-notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      toast.success('Registro aprobado y asignado')
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
    } catch {
      toast.error('Error al guardar. Intentá de nuevo.')
    }
  }

  const displayed = filter === 'PENDING_REVIEW'
    ? notes.filter(n => n.status === 'PENDING_REVIEW')
    : notes

  const pending = notes.filter(n => n.status === 'PENDING_REVIEW').length

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950">Bandeja WhatsApp</h1>
            <p className="text-sm text-gray-400 mt-1">Registros enviados por el equipo de campo vía WhatsApp Business</p>
          </div>
          {pending > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-center">
              <p className="text-2xl font-black text-amber-600">{pending}</p>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pendiente{pending > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-5">
          {(['PENDING_REVIEW', 'ALL'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {f === 'PENDING_REVIEW' ? `Pendientes (${pending})` : 'Todos'}
            </button>
          ))}
          <button onClick={loadData} className="ml-auto px-4 py-2 rounded-xl text-xs font-black bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
            Actualizar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-gray-300 animate-spin" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-24">
            <MessageSquare className="w-14 h-14 mx-auto text-gray-200 mb-4" />
            <p className="text-sm font-bold text-gray-300">
              {filter === 'PENDING_REVIEW' ? 'No hay registros pendientes 🎉' : 'Aún no se recibieron mensajes por WhatsApp'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(note => (
              <NoteCard key={note.id} note={note} paddocks={paddocks} onApprove={handleApprove} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
