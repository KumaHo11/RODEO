'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import {
  User, Mail, Phone, Camera, Loader2, LogOut, Lock,
  CreditCard, Clock, ChevronRight, CheckCircle, AlertCircle, Building
} from 'lucide-react'
import Image from 'next/image'

const ROLES = [
  { value: 'producer', label: 'Productor ganadero' },
  { value: 'manager', label: 'Administrador de campo' },
  { value: 'consultant', label: 'Asesor / consultor' },
  { value: 'other', label: 'Otro' },
]

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'perfil' | 'facturacion'>('perfil')

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    role: '',
    avatar_url: '',
  })

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          role: data.role || '',
          avatar_url: data.avatar_url || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [user, supabase])

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    setError('')

    // Upload to storage
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) { setError('Error al subir la imagen: ' + uploadErr.message); setUploadingAvatar(false); return }

    // Get public URL
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData.publicUrl + '?v=' + Date.now()

    // Save to profile
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setFormData(prev => ({ ...prev, avatar_url: publicUrl }))
    setUploadingAvatar(false)
    setSuccess('Foto de perfil actualizada.')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    setError('')
    if (user) {
      const { error: err } = await supabase.from('profiles').update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        role: formData.role,
      }).eq('id', user.id)
      if (err) setError('Error al guardar: ' + err.message)
      else { setSuccess('Perfil guardado correctamente.'); setTimeout(() => setSuccess(''), 3000) }
    }
    setSaving(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handlePasswordReset = async () => {
    if (!user?.email) return
    await supabase.auth.resetPasswordForEmail(user.email)
    setSuccess('Te enviamos un correo para restablecer tu contraseña.')
    setTimeout(() => setSuccess(''), 5000)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* === Avatar + Identity card === */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Green banner */}
        <div className="h-24 bg-gradient-to-r from-green-600 to-emerald-500" />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <button
                onClick={handleAvatarClick}
                className="w-20 h-20 rounded-2xl ring-4 ring-white overflow-hidden bg-green-100 flex items-center justify-center hover:opacity-90 transition-opacity relative"
                disabled={uploadingAvatar}
              >
                {formData.avatar_url ? (
                  <Image src={formData.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <span className="text-3xl font-black text-green-700">
                    {formData.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <p className="text-[10px] text-gray-400 font-medium pb-1">Miembro desde {new Date(user?.created_at || '').toLocaleDateString('es', { month: 'long', year: 'numeric' })}</p>
          </div>

          <h2 className="text-xl font-black text-gray-900">
            {formData.first_name || formData.last_name
              ? `${formData.first_name} ${formData.last_name}`.trim()
              : user?.email}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* === Tabs === */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {(['perfil', 'facturacion'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize ${
              activeTab === tab ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'perfil' ? 'Mi perfil' : 'Facturación'}
          </button>
        ))}
      </div>

      {/* Feedback messages */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* === PERFIL TAB === */}
      {activeTab === 'perfil' && (
        <form onSubmit={handleSave} className="space-y-4">

          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Datos personales</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Nombre</label>
                <input
                  value={formData.first_name}
                  onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Apellido</label>
                <input
                  value={formData.last_name}
                  onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Correo electrónico</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-500">{user?.email}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="+54 9 11 1234 5678"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Rol</label>
              <select
                value={formData.role}
                onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Seleccionar rol...</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : 'Guardar cambios'}
          </button>
        </form>
      )}

      {/* === Seguridad === */}
      {activeTab === 'perfil' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Seguridad</h3>
          <button
            onClick={handlePasswordReset}
            className="flex items-center justify-between w-full p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Lock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">Cambiar contraseña</p>
                <p className="text-xs text-gray-400">Recibirás un correo con el enlace</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>
      )}

      {/* === FACTURACIÓN TAB === */}
      {activeTab === 'facturacion' && (
        <div className="space-y-4">
          {/* Plan actual */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Plan actual</h3>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Building className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-black text-green-800">Plan Pro</p>
                  <p className="text-xs text-green-600">Activo · Vence el 01/05/2026</p>
                </div>
              </div>
              <span className="text-xs font-bold bg-green-600 text-white px-3 py-1 rounded-full">Vigente</span>
            </div>
          </div>

          {/* Histórico de pagos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Historial de pagos</h3>
            <div className="space-y-3">
              {[
                { date: '01/04/2026', amount: '$29.99', status: 'Completado', method: 'Tarjeta •••• 4242' },
                { date: '01/03/2026', amount: '$29.99', status: 'Completado', method: 'Tarjeta •••• 4242' },
                { date: '01/02/2026', amount: '$29.99', status: 'Completado', method: 'Tarjeta •••• 4242' },
              ].map((payment, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{payment.amount}</p>
                      <p className="text-xs text-gray-400">{payment.method} · {payment.date}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg">{payment.status}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 italic text-center">La integración de pagos estará disponible próximamente.</p>
          </div>

          {/* Próximos vencimientos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Próximos vencimientos</h3>
            <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
              <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-yellow-800">Renovación automática</p>
                <p className="text-xs text-yellow-600 mt-0.5">Tu plan se renueva el 01/05/2026. Te notificaremos 7 días antes.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Cerrar sesión === */}
      <div className="bg-white rounded-2xl border border-red-100 p-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-red-600">Cerrar sesión</p>
            <p className="text-xs text-gray-400">Finalizarás tu sesión en este dispositivo</p>
          </div>
        </button>
      </div>

    </div>
  )
}
