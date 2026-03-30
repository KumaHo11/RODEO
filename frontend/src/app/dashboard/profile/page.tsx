'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { User, Mail, Phone, Camera, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function ProfilePage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    role: '',
    avatar_url: ''
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
          avatar_url: data.avatar_url || ''
        })
      }
      setLoading(false)
    }
    load()
  }, [user, supabase])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    
    if (user) {
      await supabase.from('profiles').update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone
      }).eq('id', user.id)
      
      setSuccess('Perfil actualizado exitosamente.')
    }
    setSaving(false)
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}-${Math.random()}.${fileExt}`

    try {
      setLoading(true)
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      
      const newAvatarUrl = data.publicUrl
      setFormData({ ...formData, avatar_url: newAvatarUrl })
      
      await supabase.from('profiles').update({ avatar_url: newAvatarUrl }).eq('id', user.id)
      
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Error subiendo foto. Asegúrate de que tienes permisos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tu Perfil</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gestiona tu información personal y opciones de contacto.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-gray-100">
            <div className="relative group flex-shrink-0">
              <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center text-green-600 relative overflow-hidden ring-4 ring-white shadow-md">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12" />
                )}
                {loading && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                  </div>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  title="Cambiar foto de perfil" 
                  disabled={loading}
                  className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs flex flex-col items-center justify-center pb-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-4 w-4 mb-0.5" />
                  <span>Subir</span>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUploadAvatar} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{formData.first_name || 'Desconocido'} {formData.last_name}</h2>
              <p className="text-gray-500 flex items-center mt-1">
                <Mail className="h-4 w-4 mr-2 text-gray-400" /> <span className="text-gray-900">{user?.email}</span>
              </p>
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Rol: {formData.role === 'OWNER' ? 'Propietario' : formData.role}
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 animate-pulse">Cargando datos...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellido</label>
                  <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input type="tel" className="block w-full pl-10 rounded-md border-gray-300 focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2 text-gray-900 bg-white" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+54 9 11 1234-5678" />
                  </div>
                </div>
              </div>

              {success && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200 flex items-center">{success}</p>}

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm disabled:opacity-50 transition-colors">
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
