'use client'

/**
 * WhatsAppLinksManager — Gestión de vínculos teléfono → miembro del equipo.
 * Se embebe en la página de Equipo (/dashboard/equipo) para el OWNER.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { Phone, Plus, Trash2, Loader2, MessageCircle, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface Link {
  id: string
  phone: string
  first_name: string | null
  last_name: string | null
  email: string
  profile_role: string
  created_at: string
}

interface Profile { id: string; first_name: string | null; last_name: string | null; email: string }

export default function WhatsAppLinksManager({ orgProfiles }: { orgProfiles: Profile[] }) {
  const [links, setLinks]         = useState<Link[]>([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [phone, setPhone]         = useState('')
  const [profileId, setProfileId] = useState('')
  const [saving, setSaving]       = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch('/api/admin/whatsapp-links')
    if (res.ok) setLinks((await res.json()).links ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadLinks() }, [loadLinks])

  const handleAdd = async () => {
    if (!phone.trim() || !profileId) { toast.error('Completá el teléfono y seleccioná el miembro'); return }
    setSaving(true)
    const res = await apiFetch('/api/admin/whatsapp-links', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.trim(), profile_id: profileId }),
    })
    if (res.ok) {
      toast.success('Vínculo creado')
      setPhone(''); setProfileId(''); setAdding(false)
      loadLinks()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al crear vínculo')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await apiFetch(`/api/admin/whatsapp-links?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Vínculo eliminado'); loadLinks() }
    else toast.error('Error al eliminar')
    setDeletingId(null)
  }

  const usedProfileIds = new Set(links.map(l => l.email))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">Vínculos WhatsApp</p>
            <p className="text-[11px] text-gray-400">Asociá números de teléfono con miembros del equipo</p>
          </div>
        </div>
        <button
          onClick={() => setAdding(a => !a)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all"
        >
          {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {adding ? 'Cancelar' : 'Agregar'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="px-5 py-4 bg-green-50/50 border-b border-green-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono (E.164)</label>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+549 11 1234-5678"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:ring-1 focus:ring-green-600 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Miembro del equipo</label>
              <select
                value={profileId}
                onChange={e => setProfileId(e.target.value)}
                className="w-full mt-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:ring-1 focus:ring-green-600 outline-none appearance-none cursor-pointer"
              >
                <option value="">Seleccionar…</option>
                {orgProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name ? `${p.first_name} ${p.last_name ?? ''}` : p.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Guardando…' : 'Confirmar vínculo'}
          </button>
        </div>
      )}

      {/* Links list */}
      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-10">
            <Phone className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-300">Sin vínculos configurados</p>
            <p className="text-[11px] text-gray-300 mt-0.5">Agregá el número de WhatsApp de cada peón</p>
          </div>
        ) : (
          links.map(link => (
            <div key={link.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">
                  {link.first_name?.[0]?.toUpperCase() ?? link.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {link.first_name ? `${link.first_name} ${link.last_name ?? ''}` : link.email}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">{link.phone}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(link.id)}
                disabled={deletingId === link.id}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                title="Eliminar vínculo"
              >
                {deletingId === link.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
