import React, { useState, useRef, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { addToOfflineQueue } from '@/components/OfflineIndicator'
import { 
  X, Mic, Camera, AlertTriangle, Leaf, BookOpen, 
  Wrench, BarChart3, Droplets, Footprints, Loader2, Square, Check
} from 'lucide-react'

const CATEGORIES = [
  { id: 'INFRAESTRUCTURA', label: 'Infraestructura', icon: Wrench, border: 'border-cyan-200', text: 'text-cyan-800', bg: 'bg-cyan-50' },
  { id: 'SANIDAD_VEGETAL', label: 'Sanidad vegetal', icon: Leaf, border: 'border-green-200', text: 'text-green-800', bg: 'bg-green-50' },
  { id: 'RESTRICCION', label: 'Restricción de uso', icon: AlertTriangle, border: 'border-red-200', text: 'text-red-800', bg: 'bg-red-50' },
  { id: 'BIOMASA', label: 'Biomasa', icon: BarChart3, border: 'border-violet-200', text: 'text-violet-800', bg: 'bg-violet-50' },
  { id: 'HIDRICO', label: 'Hídrico', icon: Droplets, border: 'border-sky-200', text: 'text-sky-800', bg: 'bg-sky-50' },
  { id: 'GANADO', label: 'Ganado', icon: Footprints, border: 'border-amber-200', text: 'text-amber-800', bg: 'bg-amber-50' },
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-lg shadow-2xl relative z-10 rounded-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header unificado */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-950 tracking-tight">Nueva Nota</h2>
            {form.paddock_id && (
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Para: {paddocks?.find(p => p.id === form.paddock_id)?.name || initialPaddockName || 'Potrero'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-all">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <form id="note-form" onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          
          {!initialPaddockId && (
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Potrero designado</label>
              <select 
                value={form.paddock_id} 
                onChange={(e) => setForm({...form, paddock_id: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-green-600 outline-none appearance-none cursor-pointer"
              >
                <option value="">General (Sin potrero específico)</option>
                {paddocks?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">¿Qué está pasando?</label>
            <input 
              type="text" 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              placeholder="Ej: Alambre roto en la bebida" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-950 focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300" 
              required 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Clasificación</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id} type="button" onClick={() => toggleFormTag(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    form.tags.includes(cat.id) ? `${cat.bg} ${cat.border} ${cat.text}` : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" /> {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Detalle y Dictado de voz</label>
            <div className="relative group">
              <textarea 
                value={form.content} 
                onChange={e => setForm({...form, content: e.target.value})} 
                placeholder={isRecording ? 'Escuchando tu voz...' : 'Escribí detalles adicionales o pulsá dictar...'} 
                rows={4} 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 focus:ring-1 focus:ring-green-600 outline-none resize-none pb-12 transition-all placeholder:text-gray-400" 
              />
              <div className="absolute bottom-2 left-2 right-2 flex justify-end">
                {isRecording ? (
                  <button type="button" onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-black hover:bg-red-200 transition-all border border-red-200">
                    <Square className="w-3 h-3 fill-red-600" /> Detener grabación
                  </button>
                ) : (
                  <button type="button" onClick={startRecording} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-green-700 rounded-xl text-[10px] font-black hover:bg-green-50 transition-all shadow-sm">
                    <Mic className="w-3.5 h-3.5" /> Dictar detalle
                  </button>
                )}
              </div>
            </div>
            {isRecording && <p className="text-xs text-green-600 animate-pulse text-center mt-2 font-bold tracking-tight">🎙️ Grabando dictado...</p>}
          </div>

        </form>
        
        {/* Footer unificado */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="note-form" 
            disabled={saving || !form.title} 
            className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 shadow-md shadow-green-100 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} 
            {saving ? 'Guardando...' : 'Guardar Nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
