'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '../components/PageShell'

interface ConfigItem {
  key: string; value: string; label: string; category: string; is_secret: boolean; hasValue: boolean; updated_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  payments:     'Pasarelas de Pago',
  integrations: 'Integraciones AgTech',
  auth:         'Autenticación',
  general:      'General',
  menu:         'Visibilidad del Menú',
}

export default function AdminConfigPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<Record<string, ConfigItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/config', { headers: { Authorization: `Bearer ${token}` } })
      setConfig((await res.json()).config || {})
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  async function handleSave(key: string) {
    if (!user) return
    setSaving(key)
    try {
      const token = await user.getIdToken()
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      })
      setEditingKey(null); setEditValue('')
      setSuccess(key); setTimeout(() => setSuccess(null), 3000)
      fetchConfig()
    } finally { setSaving(null) }
  }

  async function revealSecret(key: string) {
    if (!user) return
    const token = await user.getIdToken()
    const res = await fetch('/api/admin/config?reveal=1', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    for (const items of Object.values(data.config) as ConfigItem[][]) {
      const item = items.find((i: ConfigItem) => i.key === key)
      if (item) {
        setShowSecrets(s => ({ ...s, [key]: true }))
        setConfig(prev => {
          const updated = { ...prev }
          for (const cat of Object.keys(updated)) {
            updated[cat] = updated[cat].map(i => i.key === key ? { ...i, value: item.value } : i)
          }
          return updated
        })
        break
      }
    }
  }

  return (
    <PageShell
      label="Gestión de API Keys y parámetros del sistema"
      actions={
        <button onClick={fetchConfig}
          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 text-sm transition-colors">
          {loading ? '…' : 'Actualizar'}
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {Object.entries(config).map(([category, items]) => (
            <div key={category} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-3.5 border-b border-gray-100">
                <h3 className="text-gray-900 font-semibold text-sm">{CATEGORY_LABELS[category] || category}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map(item => (
                  <div key={item.key} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-900 text-sm font-medium">{item.label}</span>
                        {item.is_secret && <span className="text-[10px] text-gray-400">🔑</span>}
                        {item.hasValue
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Configurado</span>
                          : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-200">Sin configurar</span>}
                        {success === item.key && <span className="text-[10px] text-green-600 font-medium">✓ Guardado</span>}
                      </div>
                      <div className="text-gray-400 text-[10px] font-mono">{item.key}</div>

                      {editingKey === item.key ? (
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            type={item.is_secret ? 'password' : 'text'}
                            value={editValue} autoFocus
                            onChange={e => setEditValue(e.target.value)}
                            placeholder={`Nuevo valor…`}
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-green-500" />
                          <button onClick={() => handleSave(item.key)} disabled={saving === item.key}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-xl font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                            {saving === item.key && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                            Guardar
                          </button>
                          <button onClick={() => { setEditingKey(null); setEditValue('') }}
                            className="px-3 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-gray-400 text-xs font-mono bg-gray-50 rounded-lg px-3 py-1.5 flex-1 truncate border border-gray-100">
                            {item.hasValue ? item.value : <span className="italic text-gray-300">no configurado</span>}
                          </code>
                          {item.is_secret && item.hasValue && !showSecrets[item.key] && (
                            <button onClick={() => revealSecret(item.key)}
                              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border border-gray-100 rounded-lg transition-colors">
                              Revelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {category === 'menu' ? (
                      <div className="flex-shrink-0 flex items-center">
                        <button
                          onClick={() => {
                            const nextValue = item.value === 'true' ? 'false' : 'true'
                            setEditValue(nextValue)
                            // Trigger save directly
                            if (!user) return
                            setSaving(item.key)
                            user.getIdToken().then(token => {
                              fetch('/api/admin/config', {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ key: item.key, value: nextValue }),
                              }).then(() => {
                                setSuccess(item.key)
                                setTimeout(() => setSuccess(null), 3000)
                                fetchConfig()
                              }).finally(() => setSaving(null))
                            })
                          }}
                          disabled={saving === item.key}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${item.value === 'true' ? 'bg-green-600' : 'bg-gray-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${item.value === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ) : editingKey !== item.key && (
                      <button onClick={() => { setEditingKey(item.key); setEditValue('') }}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 text-xs font-medium transition-colors">
                        {item.hasValue ? 'Actualizar' : 'Configurar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-amber-800 font-semibold text-sm mb-1">Seguridad de API Keys</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Las API Keys se almacenan en la base de datos y todas las modificaciones se registran en el Audit Log.
              Para mayor seguridad en producción, considerar usar Google Secret Manager.
              Nunca compartir estas claves por canales no seguros.
            </p>
          </div>
        </div>
      )}
    </PageShell>
  )
}
