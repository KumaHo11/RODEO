'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Loader2, Plus, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'

type Version = {
  id: string
  version_number: string
  content: string
  is_active: boolean
  created_at: string
}

type Acceptance = {
  id: string
  profile_id: string
  version_id: string
  accepted_at: string
  ip_address: string
  profiles: {
    first_name: string
    last_name: string
    firebase_uid: string
  }
  terms_and_conditions_versions: {
    version_number: string
  }
}

export default function AdminTermsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'versions' | 'acceptances'>('versions')
  
  // Versions
  const [versions, setVersions] = useState<Version[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [newVersionNum, setNewVersionNum] = useState('')
  const [newVersionContent, setNewVersionContent] = useState('')
  const [savingVersion, setSavingVersion] = useState(false)

  // Acceptances
  const [acceptances, setAcceptances] = useState<Acceptance[]>([])
  const [loadingAcceptances, setLoadingAcceptances] = useState(false)

  const fetchVersions = useCallback(async () => {
    if (!user) return
    setLoadingVersions(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/terms/versions', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingVersions(false)
    }
  }, [user])

  const fetchAcceptances = useCallback(async () => {
    if (!user) return
    setLoadingAcceptances(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/terms/acceptances', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAcceptances(data.acceptances || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAcceptances(false)
    }
  }, [user])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  useEffect(() => {
    if (activeTab === 'acceptances') fetchAcceptances()
  }, [activeTab, fetchAcceptances])

  const handleSaveVersion = async () => {
    if (!newVersionNum || !newVersionContent) return
    setSavingVersion(true)
    try {
      const token = await user?.getIdToken()
      const res = await fetch('/api/admin/terms/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          versionNumber: newVersionNum,
          content: newVersionContent,
          isActive: true
        })
      })
      if (res.ok) {
        setShowNewVersion(false)
        setNewVersionNum('')
        setNewVersionContent('')
        fetchVersions()
      } else {
        const data = await res.json()
        alert(data.error || 'Error al guardar versión')
      }
    } catch (err) {
      console.error(err)
      alert('Error de red')
    } finally {
      setSavingVersion(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Términos y Condiciones</h1>
          <p className="text-gray-500 text-sm">Gestiona los textos legales y audita aceptaciones de usuarios.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('versions')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeTab === 'versions' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Versiones de T&C
        </button>
        <button
          onClick={() => setActiveTab('acceptances')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeTab === 'acceptances' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Control de Aceptaciones
        </button>
      </div>

      {activeTab === 'versions' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewVersion(!showNewVersion)}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition flex items-center gap-2"
            >
              {showNewVersion ? 'Cancelar' : <><Plus className="w-4 h-4" /> Nueva Versión</>}
            </button>
          </div>

          {showNewVersion && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Crear nueva versión</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Número de Versión</label>
                    <input
                      type="text"
                      placeholder="Ej: v2.0"
                      value={newVersionNum}
                      onChange={e => setNewVersionNum(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex justify-between">
                      <span>Contenido (HTML)</span>
                    </label>
                    <textarea
                      placeholder="<h1>Términos...</h1><p>Texto aquí</p>"
                      value={newVersionContent}
                      onChange={e => setNewVersionContent(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm h-64 font-mono outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                  </div>
                </div>
                
                {/* Live Preview */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vista Previa</label>
                  <div 
                    className="w-full border border-gray-200 rounded-xl p-4 text-sm h-[calc(100%-1.25rem)] overflow-y-auto prose prose-sm bg-gray-50 text-gray-600"
                    dangerouslySetInnerHTML={{ __html: newVersionContent || '<span class="text-gray-400">La vista previa aparecerá aquí...</span>' }}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveVersion}
                  disabled={!newVersionNum || !newVersionContent || savingVersion}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingVersion ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Publicar Versión'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Versión</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha de Creación</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingVersions ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando versiones...
                    </td>
                  </tr>
                ) : versions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500 font-medium">No hay versiones publicadas</td>
                  </tr>
                ) : (
                  versions.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{v.version_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {v.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                            <XCircle className="w-3.5 h-3.5" /> Inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {new Date(v.created_at).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'acceptances' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-sm text-gray-900">Registro de Aceptaciones</h3>
              <button onClick={fetchAcceptances} className="text-gray-500 hover:text-green-600 p-1">
                <RefreshCw className={`w-4 h-4 ${loadingAcceptances ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Versión</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">IP Address</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loadingAcceptances ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando registros...
                    </td>
                  </tr>
                ) : acceptances.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">No hay aceptaciones registradas</td>
                  </tr>
                ) : (
                  acceptances.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{a.profiles?.first_name} {a.profiles?.last_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{a.profiles?.firebase_uid?.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-700">
                        {a.terms_and_conditions_versions?.version_number}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-500">
                        {new Date(a.accepted_at).toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-400 font-mono text-xs">
                        {a.ip_address || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
