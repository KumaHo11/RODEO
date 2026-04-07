import React, { useState, useRef, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineIndicator'
import { 
  X, Mic, Camera, AlertTriangle, Leaf, BookOpen, 
  Wrench, BarChart3, Droplets, Beef, Loader2, Square, Check
} from 'lucide-react'

const CATEGORIES = [
  { id: 'INFRAESTRUCTURA', label: 'Infraestructura', icon: Wrench, border: 'border-cyan-200', text: 'text-cyan-800', bg: 'bg-cyan-50' },
  { id: 'SANIDAD_VEGETAL', label: 'Sanidad vegetal', icon: Leaf, border: 'border-green-200', text: 'text-green-800', bg: 'bg-green-50' },
  { id: 'RESTRICCION', label: 'Restricción de uso', icon: AlertTriangle, border: 'border-red-200', text: 'text-red-800', bg: 'bg-red-50' },
  { id: 'BIOMASA', label: 'Biomasa', icon: BarChart3, border: 'border-violet-200', text: 'text-violet-800', bg: 'bg-violet-50' },
  { id: 'HIDRICO', label: 'Hídrico', icon: Droplets, border: 'border-sky-200', text: 'text-sky-800', bg: 'bg-sky-50' },
  { id: 'GANADO', label: 'Ganado', icon: Beef, border: 'border-amber-200', text: 'text-amber-800', bg: 'bg-amber-50' },
  { id: 'GENERAL', label: 'General', icon: BookOpen, border: 'border-gray-200', text: 'text-gray-800', bg: 'bg-gray-50' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  user: any
  initialPaddockId?: string
  initialPaddockName?: string
  paddocks?: any[]
}

export default function BitacoraModal({ isOpen, onClose, onSaved, user, initialPaddockId, paddocks, initialPaddockName }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    paddock_id: initialPaddockId || '',
    tags: ['GENERAL'],
    title: '',
    content: ''
  })
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (isOpen) {
      setForm({ paddock_id: initialPaddockId || '', tags: ['GENERAL'], title: '', content: '' })
      setTranscript('')
    }
  }, [isOpen, initialPaddockId])

  if (!isOpen) return null

  const toggleFormTag = (tagId: string) => {
    setForm(prev => {
      const has = prev.tags.includes(tagId)
      let next = has ? prev.tags.filter(t => t !== tagId) : [...prev.tags.filter(t => t !== 'GENERAL'), tagId]
      if (next.length === 0) next = ['GENERAL']
      return { ...prev, tags: next }
    })
  }

  const startRecording = async () => {
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
        setForm(prev => ({
          ...prev, content: full, title: prev.title || full.split('.')[0].slice(0, 60),
        }))
      }
      rec.start()
      recognitionRef.current = rec
      setIsRecording(true)
    } else {
      alert('Tu navegador no soporta dictado por voz')
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    setSaving(true)

    if (!navigator.onLine) {
      addToOfflineQueue({
        type: 'field_note',
        data: {
          created_by: user?.uid,
          paddock_id: form.paddock_id || null,
          tags: form.tags, category: form.tags[0],
          title: form.title, content: form.content || null,
          sync_status: 'PENDING',
        },
        timestamp: Date.now(),
      })
      setSaving(false)
      onSaved()
      onClose()
      return
    }

    try {
      await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          paddock_id: form.paddock_id || null,
          tags: form.tags,
          title: form.title,
          content: form.content || null,
        }),
      })
      setSaving(false)
      onSaved()
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 pb-20 sm:pb-4 pointer-events-none">
      <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="bg-white w-full sm:w-[500px] h-full sm:h-auto sm:max-h-[85vh] sm:rounded-2xl shadow-2xl relative z-10 flex flex-col pointer-events-auto overflow-hidden animate-in sm:zoom-in-95 slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-200">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
          <h2 className="text-xl font-black text-gray-900">Nueva Nota</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors"><X className="w-5 h-5"/></button>
        </div>

        <form id="note-form" onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-4 space-y-5 bg-gray-50/50">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Potrero designado</label>
            {initialPaddockId && !paddocks ? (
              <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl">
                <p className="text-sm font-black text-gray-900">{initialPaddockName || 'Potrero Seleccionado'}</p>
              </div>
            ) : (
              <select value={form.paddock_id} onChange={(e) => setForm({...form, paddock_id: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none">
                <option value="">General (Sin potrero específico)</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-gray-500 uppercase">¿Qué está pasando?</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ej: Alambre roto en la bebida" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all placeholder:text-gray-300 font-medium" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Clasificación</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id} type="button" onClick={() => toggleFormTag(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    form.tags.includes(cat.id) ? `${cat.bg} ${cat.border} ${cat.text}` : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" /> {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Detalle y Dictado de voz</label>
            <div className="relative">
              <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder={isRecording ? 'Escuchando tu voz...' : 'Escribí detalles adicionales o pulsá dictar...'} rows={4} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none resize-none pb-12 transition-all placeholder:text-gray-300" />
              <div className="absolute bottom-2 left-2 right-2 flex justify-end">
                {isRecording ? (
                  <button type="button" onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-all"><Square className="w-3 h-3 fill-red-600" /> Detener grabación</button>
                ) : (
                  <button type="button" onClick={startRecording} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold hover:bg-green-200 transition-all"><Mic className="w-3 h-3" /> Dictar detalle</button>
                )}
              </div>
            </div>
            {isRecording && <p className="text-xs text-green-600 animate-pulse text-center mt-2 font-bold">Escuchando... {transcript && '🗣️'}</p>}
          </div>

        </form>
        
        <div className="p-4 border-t border-gray-100 bg-white shrink-0">
          <button type="submit" form="note-form" disabled={saving || !form.title} className="w-full flex justify-center items-center gap-2 py-3.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 focus:ring-4 focus:ring-green-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Check className="w-5 h-5"/>} {saving ? 'Guardando...' : 'Guardar Nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
