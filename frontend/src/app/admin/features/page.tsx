'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '../components/PageShell'
import { Satellite, ClipboardList, PawPrint, Leaf } from 'lucide-react'


const FEATURES = [
  {
    group: 'MRV Satelital',
    icon: Satellite,
    items: [
      { key: 'metrics_module', label: 'Dashboard métricas satelitales', desc: '10 índices Sentinel-2: NDVI, EVI, SAVI, BSI, SOC, NDMI, fCover, SAR, Compactación' },
      { key: 'deforestation_guard', label: 'Deforestation Guard EUDR', desc: 'Verificación deforestación post-2020 contra Global Forest Watch. Cumplimiento EUDR 2023/1115.' },
      { key: 'time_machine', label: 'Time Machine histórico 2020→hoy', desc: 'Backfill satelital mes a mes desde la línea de base EUDR (31/12/2020).' },
    ]
  },
  {
    group: 'Compliance y Reportes',
    icon: ClipboardList,
    items: [
      { key: 'compliance_dashboard', label: 'Dashboard Compliance EUDR/EOV/GRSB', desc: 'Semáforo de cumplimiento normativo con scores por potrero.' },
      { key: 'mrv_reports', label: 'Reportes PDF MRV con hash SHA256', desc: 'Reportes auditables con firma digital SHA256 verificable.' },
      { key: 'alert_engine', label: 'Motor de alertas NDVI/BSI', desc: 'Alertas automáticas: caída NDVI, suelo desnudo crítico, riesgo deforestación.' },
    ]
  },
  {
    group: 'Registro Animal',
    icon: PawPrint,
    items: [
      { key: 'animal_registry', label: 'Registro individual de animales + RFID', desc: 'Trazabilidad individual, bitácora de vida, importación CSV (Allflex/Gallagher).' },
      { key: 'rfid_bluetooth', label: 'Escaneo RFID Bluetooth', desc: 'Lectura Web Bluetooth para lectores Gallagher HR5, Tru-Test SRS2. Modo offline con cola de sync.' },
    ]
  },
  {
    group: 'Carbono y API',
    icon: Leaf,
    items: [
      { key: 'carbon_accounting', label: 'Huella de carbono IPCC Tier 1', desc: 'Cálculo tCO₂e por potrero: CH₄ entérico + N₂O + proxy SOC satelital. GWP AR6.' },
      { key: 'api_access', label: 'API B2B v2 + Marketplace de datos', desc: 'Acceso API con claves SHA256, CORS, OpenAPI spec. Marketplace para otorgar acceso a certificadoras.' },
    ]
  },
]

export default function AdminFeaturesPage() {
  const { user } = useAuth()
  const [configMap, setConfigMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/config', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const newMap: Record<string, string> = {}
      for (const items of Object.values(data.config || {}) as any[][]) {
        for (const item of items) {
          if (item.hasValue) {
            newMap[item.key] = item.value
          }
        }
      }
      setConfigMap(newMap)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  async function toggleFeature(featureKey: string) {
    if (!user) return
    const overrideKey = `feature_override_${featureKey}`
    // If it's not present or true, it means it's ON. Toggling means setting it to 'false'.
    const isCurrentlyOn = configMap[overrideKey] !== 'false'
    const nextValue = isCurrentlyOn ? 'false' : 'true'

    setSaving(featureKey)
    try {
      const token = await user.getIdToken()
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: overrideKey, value: nextValue }),
      })
      setConfigMap(prev => ({ ...prev, [overrideKey]: nextValue }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <PageShell
      label="Módulos LATIFUNDIO — Feature Flags"
      actions={
        <button onClick={fetchConfig} disabled={loading}
          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 text-sm transition-colors disabled:opacity-50">
          {loading ? '…' : 'Actualizar'}
        </button>
      }
    >
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-3xl">
        <p className="text-amber-800 font-semibold text-sm mb-1">Toggle global</p>
        <p className="text-amber-700 text-xs leading-relaxed">
          Si está OFF, NINGÚN usuario puede acceder al módulo aunque tenga plan LATIFUNDIO. Utilizado para rollbacks y mantenimiento.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {FEATURES.map((group) => {
            const Icon = group.icon
            return (
              <div key={group.group} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <h3 className="text-gray-900 font-semibold text-sm">{group.group}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.items.map(item => {
                    const overrideKey = `feature_override_${item.key}`
                    const isCurrentlyOn = configMap[overrideKey] !== 'false'
                    
                    return (
                      <div key={item.key} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-900 text-sm font-bold">{item.label}</span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-900 text-white tracking-wider">LATIFUNDIO</span>
                            {saving === item.key && <span className="text-[10px] text-gray-400 italic">Cargando...</span>}
                          </div>
                          <p className="text-gray-500 text-xs mb-1.5">{item.desc}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">{overrideKey}</span>
                            {!isCurrentlyOn && (
                              <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                Desactivado globalmente
                              </span>
                            )}
                            {isCurrentlyOn && (
                              <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                Activo
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex items-center">
                          <button
                            onClick={() => toggleFeature(item.key)}
                            disabled={saving === item.key}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${isCurrentlyOn ? 'bg-green-600' : 'bg-gray-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isCurrentlyOn ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
