'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'
import {
  Mail, Phone, Camera, Loader2, LogOut, Lock, Eye, EyeOff,
  CreditCard, Clock, ChevronRight, CheckCircle, AlertCircle, Building, Check
} from 'lucide-react'
import Image from 'next/image'

// Atomic Components — RODEO Design System
import { Button, Input, FormField, Tabs, Card, CardHeader } from '@/design-system'

// ── Inline password change using Admin SDK (no re-auth required) ──────────────
function PasswordChangeSection() {
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (pwd !== confirm) { setError('Las contraseñas no coinciden'); return }
    setSaving(true); setError('')
    const res = await apiFetch('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ password: pwd }),
    })
    if (res.ok) {
      setSuccess(true)
      setTimeout(() => { setOpen(false); setSuccess(false); setPwd(''); setConfirm('') }, 2000)
    } else {
      const d = await res.json()
      setError(d.error || 'Error al cambiar contraseña.')
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader title="Seguridad" />
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center justify-between w-full p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Lock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-gray-900 tracking-tight">Cambiar contraseña</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Actualizar acceso</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
        </button>
      ) : success ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100 shadow-sm shadow-green-100">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-sm font-bold text-green-700">Contraseña actualizada exitosamente</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            type={show ? 'text' : 'password'} 
            required 
            value={pwd}
            onChange={e => { setPwd(e.target.value); setError('') }}
            placeholder="Nueva contraseña (mín. 8 caract.)"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button type="button" onClick={() => setShow(v => !v)}>
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input 
            type={show ? 'text' : 'password'} 
            required 
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            placeholder="Confirmar contraseña"
            leftIcon={<Lock className="w-4 h-4" />}
            error={!!confirm && confirm !== pwd}
          />
          
          {error && <p className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" className="flex-1" type="submit" isLoading={saving} disabled={pwd.length < 8 || pwd !== confirm}>
              Guardar
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'perfil' | 'facturacion' | 'planes'>('perfil')

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
      const res = await apiFetch('/api/auth/profile')
      if (res.ok) {
        const { profile: data } = await res.json()
        if (data) {
          setFormData({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            phone: data.phone || '',
            role: data.role || '',
            avatar_url: data.avatar_url || '',
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [user])

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('La actualización de foto estará disponible próximamente.')
    setTimeout(() => setError(''), 3000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    setError('')
    const res = await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        role: formData.role,
      }),
    })
    if (!res.ok) { setError('Error al guardar el perfil.') }
    else { setSuccess('Perfil guardado correctamente.'); setTimeout(() => setSuccess(''), 3000) }
    setSaving(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">

      {/* === Avatar + Identity card === */}
      <Card padding="none">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-green-700 via-green-600 to-emerald-500" />

        <div className="px-8 pb-8">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-12 mb-6">
            <div className="relative">
              <button
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-[32px] ring-8 ring-white overflow-hidden bg-gray-100 flex items-center justify-center hover:opacity-90 transition-all relative group"
                disabled={uploadingAvatar}
              >
                {formData.avatar_url ? (
                  <Image src={formData.avatar_url} alt="Avatar" fill className="object-cover" />
                ) : (
                  <span className="text-4xl font-black text-green-700">
                    {formData.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Miembro desde</p>
               <p className="text-xs font-bold text-gray-900 mt-1">{user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('es', { month: 'long', year: 'numeric' }) : '—'}</p>
            </div>
          </div>

          <h1 className="text-3xl font-black text-gray-950 tracking-tight">
            {formData.first_name || formData.last_name
              ? `${formData.first_name} ${formData.last_name}`.trim()
              : user?.email}
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-1">{user?.email}</p>
        </div>
      </Card>

      {/* === Tabs === */}
      <Tabs 
        activeTab={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'perfil', label: 'Mi perfil' },
          { id: 'facturacion', label: 'Facturación' },
          { id: 'planes', label: 'Mis planes' },
        ]}
      />

      {/* Feedback messages */}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-5 py-3 shadow-sm shadow-green-50">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-bold">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-3 shadow-sm shadow-red-50">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-bold">{error}</p>
        </div>
      )}

      {/* === PERFIL TAB === */}
      {activeTab === 'perfil' && (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader title="Datos personales" />

            <div className="grid grid-cols-2 gap-4">
              <FormField 
                label="Nombre"
                placeholder="Tu nombre"
                value={formData.first_name}
                onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
              />
              <FormField 
                label="Apellido"
                placeholder="Tu apellido"
                value={formData.last_name}
                onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
              />
            </div>

            <FormField 
              label="Correo electrónico"
              value={user?.email || ''}
              readOnly
              leftIcon={<Mail className="w-4 h-4" />}
              className="opacity-70 pointer-events-none"
            />

            <FormField 
              label="Teléfono"
              placeholder="+54 9 11 1234 5678"
              value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </Card>

          <Button type="submit" size="lg" className="w-full shadow-lg shadow-green-100" isLoading={saving}>
            Guardar cambios
          </Button>
        </form>
      )}

      {/* === Seguridad === */}
      {activeTab === 'perfil' && (
        <PasswordChangeSection />
      )}

      {/* === FACTURACIÓN TAB === */}
      {activeTab === 'facturacion' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Facturación" />
            <div className="flex items-center justify-between p-5 bg-green-50 rounded-2xl border border-green-100 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                  <Building className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-black text-green-950">Plan Pro</p>
                  <p className="text-xs font-bold text-green-600 mt-0.5">Vence el 01/05/2026</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-green-600 text-white px-3 py-1.5 rounded-full uppercase tracking-widest">Activo</span>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">Historial de pagos</p>
              {[
                { date: '01/04/2026', amount: '$29.99', status: 'Completado', method: 'Tarjeta •••• 4242' },
                { date: '01/03/2026', amount: '$29.99', status: 'Completado', method: 'Tarjeta •••• 4242' },
              ].map((payment, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{payment.amount}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{payment.method} · {payment.date}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">{payment.status}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="md" className="bg-amber-50 border-amber-100">
            <div className="flex items-center gap-4">
               <Clock className="w-5 h-5 text-amber-600 shrink-0" />
               <div>
                 <p className="text-sm font-black text-amber-900 tracking-tight">Próxima renovación</p>
                 <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1">01 de Mayo, 2026</p>
               </div>
            </div>
          </Card>
        </div>
      )}

      {/* === PLANES TAB === */}
      {activeTab === 'planes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-7 h-7 text-green-700" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-1">Planes y suscripción</h3>
            <p className="text-sm text-gray-400 mb-5">
              Administrá tu suscripción, cambiá de plan o renová con descuento anual.
            </p>
            <a
              href="/dashboard/planes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-black transition-all shadow-lg"
            >
              <CreditCard className="w-4 h-4" />
              Ver planes y contratar
            </a>
          </div>
        </div>
      )}

      {/* === Cerrar sesión === */}
      <div className="pt-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-4 w-full p-4 rounded-2xl border border-red-50 hover:bg-red-50 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
            <LogOut className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-black text-red-600 tracking-tight">Cerrar sesión</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Finalizar sesión en este equipo</p>
          </div>
        </button>
      </div>

    </div>
  )
}
