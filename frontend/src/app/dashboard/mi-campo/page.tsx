'use client'

import dynamic from 'next/dynamic'
import PaddockSidePanel from './components/PaddockSidePanel'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { getPaddockNDVI, SatelliteData } from '@/lib/services/satellite'
import { X, Check, MapPin, Plus } from 'lucide-react'

const MiCampoMap = dynamic(() => import('./components/MiCampoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Cargando mapa satelital...</p>
      </div>
    </div>
  ),
})

const STATUS_OPTIONS = [
  { id: 'RESTING',  label: 'En Descanso', color: 'bg-green-100 text-green-700' },
  { id: 'GRAZING',  label: 'En Pastoreo', color: 'bg-orange-100 text-orange-700' },
]

export default function MiCampoPage() {
  const { user } = useAuth()
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [org, setOrg] = useState<any>(null)
  const [fieldBoundary, setFieldBoundary] = useState<any>(null)
  const [selectedPaddockId, setSelectedPaddockId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ndviData, setNdviData] = useState<Record<string, SatelliteData>>({})
  const [ndviLoading, setNdviLoading] = useState(false)
  const [activeGrazingPlans, setActiveGrazingPlans] = useState<{paddock_id: string; herd_name: string; head_count: number}[]>([])

  // ── New paddock creation state ─────────────────────────────────────────────
  const [newPaddockModal, setNewPaddockModal] = useState(false)
  const [newPaddockGeom, setNewPaddockGeom] = useState<any>(null)
  const [newPaddockAreaHa, setNewPaddockAreaHa] = useState<number>(0)
  const [newPaddockName, setNewPaddockName] = useState('')
  const [newPaddockStatus, setNewPaddockStatus] = useState('RESTING')
  const [savingNewPaddock, setSavingNewPaddock] = useState(false)
  const [newPaddockError, setNewPaddockError] = useState<string | null>(null)

  // ── Draw mode trigger for MiCampoMap ─────────────────────────────────────
  const [drawModeActive, setDrawModeActive] = useState(false)
  const triggerDrawRef = useRef<(() => void) | null>(null)

  // ── Field setup state ──────────────────────────────────────────────────────
  const [setupFieldModal, setSetupFieldModal] = useState(false)
  const [setupFieldArea, setSetupFieldArea] = useState<number | ''>('')
  const [savingField, setSavingField] = useState(false)

  // ── Manual paddock state ───────────────────────────────────────────────────
  const [manualPaddockModal, setManualPaddockModal] = useState(false)
  const [manualPaddockName, setManualPaddockName] = useState('')
  const [manualPaddockArea, setManualPaddockArea] = useState<number | ''>('')
  const [manualPaddockMs, setManualPaddockMs] = useState<number | ''>('')
  const [savingManualPaddock, setSavingManualPaddock] = useState(false)
  const [manualPaddockError, setManualPaddockError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [paddocksRes, orgRes, plansRes] = await Promise.all([
      apiFetch('/api/paddocks'),
      apiFetch('/api/organizations'),
      apiFetch('/api/grazing-plans'),
    ])

    const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks || [] : []
    const orgData      = orgRes.ok      ? (await orgRes.json()).organization : null
    const plansData    = plansRes.ok    ? (await plansRes.json()).plans || [] : []

    setOrg(orgData)

    // Set field boundary from org.boundaries (GeoJSON Polygon saved during onboarding)
    if (orgData?.boundaries) {
      setFieldBoundary(orgData.boundaries)
    }

    // Build active grazing badges from plans
    const activePlans = plansData
      .filter((p: any) => p.status === 'ACTIVE')
      .map((p: any) => ({
        paddock_id: p.paddock_id,
        herd_name: p.herds?.name || 'Rebaño',
        head_count: p.herds?.head_count || 0,
      }))
    setActiveGrazingPlans(activePlans)

    setPaddocks(paddocksData)
    setLoading(false)
    loadNdviForPaddocks(paddocksData)
  }, [user])

  const loadNdviForPaddocks = async (paddocks: any[]) => {
    setNdviLoading(true)
    const results: Record<string, SatelliteData> = {}
    await Promise.all(
      paddocks.map(async (p) => {
        try {
          const ndvi = await getPaddockNDVI(p.boundary, p.id, Number(p.area_ha))
          results[p.id] = ndvi
          // Update paddock dry_matter_kg_ha via API if not already set
          if (!p.dry_matter_kg_ha) {
            await apiFetch(`/api/paddocks/${p.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ dry_matter_kg_ha: ndvi.estimatedAvailableDryMatterHa }),
            })
          }
        } catch {}
      })
    )
    setNdviData(results)
    setNdviLoading(false)
  }

  useEffect(() => { loadData() }, [loadData])

  const handlePaddockSaved = async (paddockId: string, technicalData: Record<string, any>, dryMatter?: number) => {
    const updates: Record<string, any> = { technical_data: technicalData }
    if (dryMatter !== undefined) updates.dry_matter_kg_ha = dryMatter
    await apiFetch(`/api/paddocks/${paddockId}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setPaddocks(prev => prev.map(p => p.id === paddockId ? { ...p, ...updates } : p))
  }

  const handlePaddockGeomUpdated = async () => {
    await loadData()
  }

  // ── Handle new polygon drawn from map ─────────────────────────────────────
  const handleNewPaddockDrawn = useCallback((geojson: any, areaHa: number) => {
    setDrawModeActive(false)
    setNewPaddockGeom(geojson)
    setNewPaddockAreaHa(areaHa)
    setNewPaddockName('')
    setNewPaddockStatus('RESTING')
    setNewPaddockModal(true)
  }, [])

  const handleCreatePaddock = async () => {
    if (!newPaddockName.trim() || !newPaddockGeom) return
    setSavingNewPaddock(true)
    setNewPaddockError(null)

    try {
      const res = await apiFetch('/api/paddocks', {
        method: 'POST',
        body: JSON.stringify({
          name: newPaddockName.trim(),
          area_ha: newPaddockAreaHa,
          current_status: newPaddockStatus,
          geojson: newPaddockGeom,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setNewPaddockError(errData.error || `Error ${res.status}: no se pudo guardar el potrero.`)
        setSavingNewPaddock(false)
        return
      }

      setSavingNewPaddock(false)
      setNewPaddockModal(false)
      setNewPaddockError(null)
      await loadData()
    } catch (err: any) {
      setNewPaddockError('Error de red: ' + (err.message || 'Intenta de nuevo'))
      setSavingNewPaddock(false)
    }
  }

  const handleSetupField = async () => {
    if (!setupFieldArea || setupFieldArea <= 0) return
    setSavingField(true)
    try {
      const res = await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ total_area_ha: Number(setupFieldArea) }),
      })
      if (res.ok) {
        setSetupFieldModal(false)
        await loadData()
      }
    } catch (err) {}
    setSavingField(false)
  }

  const handleCreateManualPaddock = async () => {
    if (!manualPaddockName.trim() || !manualPaddockArea || manualPaddockArea <= 0) return
    setSavingManualPaddock(true)
    setManualPaddockError(null)
    try {
      const res = await apiFetch('/api/paddocks', {
        method: 'POST',
        body: JSON.stringify({
          name: manualPaddockName.trim(),
          area_ha: Number(manualPaddockArea),
          current_status: 'RESTING',
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setManualPaddockError(errData.error || 'Error al guardar')
        setSavingManualPaddock(false)
        return
      }
      const data = await res.json()
      if (data.id && manualPaddockMs) {
        await apiFetch(`/api/paddocks/${data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ dry_matter_kg_ha: Number(manualPaddockMs) })
        })
      }
      setSavingManualPaddock(false)
      setManualPaddockModal(false)
      setManualPaddockName('')
      setManualPaddockArea('')
      setManualPaddockMs('')
      await loadData()
    } catch (err: any) {
      setManualPaddockError('Error de red')
      setSavingManualPaddock(false)
    }
  }

  const avgNdvi = Object.values(ndviData).length > 0
    ? Object.values(ndviData).reduce((sum, d) => sum + d.averageNdvi, 0) / Object.values(ndviData).length
    : null

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-gray-100 p-3 md:p-4 gap-3 md:gap-4">
      {/* Map — on mobile goes FIRST (top), on desktop goes RIGHT (60%) */}
      <div className="order-1 md:order-2 w-full md:w-[60%] flex flex-col h-[45vh] md:h-auto rounded-2xl overflow-hidden shadow-md border border-gray-200 relative min-h-[200px]">
        <MiCampoMap
          paddocks={paddocks}
          org={org}
          fieldBoundary={fieldBoundary}
          selectedPaddockId={selectedPaddockId}
          onSelectPaddock={setSelectedPaddockId}
          onPaddockGeomUpdated={handlePaddockGeomUpdated}
          onNewPaddockDrawn={handleNewPaddockDrawn}
          onDeletePaddock={async (id) => {
            await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
            loadData()
          }}
          activeGrazingPlans={activeGrazingPlans}
          drawModeActive={drawModeActive}
          onDrawModeChange={setDrawModeActive}
        />

        {/* ── FAB: Nuevo Potrero ──────────────────────────────────────────── */}
        <div className="absolute bottom-5 right-5 z-[1000] flex flex-col items-end gap-2">
          {drawModeActive && (
            <button
              onClick={() => setDrawModeActive(false)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-xs font-black rounded-xl shadow-lg hover:bg-red-600 transition-all animate-pulse"
            >
              <X className="w-3.5 h-3.5" /> Cancelar dibujo
            </button>
          )}
          <button
            onClick={() => setDrawModeActive(v => !v)}
            title={drawModeActive ? 'Cancelar' : 'Nuevo potrero'}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all ${
              drawModeActive
                ? 'bg-red-500 hover:bg-red-600 rotate-45'
                : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Side Panel — on mobile goes SECOND (bottom), on desktop LEFT (40%) */}
      <div className="order-2 md:order-1 w-full md:w-[40%] md:shrink-0 flex flex-col overflow-hidden">
        <PaddockSidePanel
          paddocks={paddocks}
          org={org}
          loading={loading}
          selectedPaddockId={selectedPaddockId}
          onSelectPaddock={setSelectedPaddockId}
          onSaveTechnicalData={handlePaddockSaved}
          ndviData={ndviData}
          ndviLoading={ndviLoading}
          avgNdvi={avgNdvi}
          onSetupField={() => { setSetupFieldArea(org?.total_area_ha || ''); setSetupFieldModal(true); }}
          onManualPaddockCreate={() => setManualPaddockModal(true)}
          onDeletePaddock={async (id) => {
            await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
            loadData()
          }}
          onDeleteField={async () => {
            if (window.confirm('¿Seguro que deseas eliminar los límites y la superficie del campo?')) {
              await apiFetch('/api/organizations', {
                method: 'PATCH',
                body: JSON.stringify({ boundaries: null, total_area_ha: null })
              })
              loadData()
            }
          }}
        />
      </div>


      {/* ── New Paddock Creation Modal ──────────────────────────────────────── */}
      {newPaddockModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-950">Nuevo Potrero</h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                  Polígono dibujado · {newPaddockAreaHa.toFixed(1)} ha
                </p>
              </div>
              <button
                onClick={() => setNewPaddockModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Área info */}
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-[9px] font-black text-green-600 tracking-widest uppercase">Superficie detectada</p>
                  <p className="text-lg font-black text-gray-900">{newPaddockAreaHa.toFixed(2)} ha</p>
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                  Nombre del Potrero *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newPaddockName}
                  onChange={e => setNewPaddockName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newPaddockName.trim()) handleCreatePaddock() }}
                  placeholder="Ej: Potrero Norte, Lote 3, Cañada..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all"
                />
              </div>

              {/* Estado */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Estado inicial</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setNewPaddockStatus(s.id)}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all border ${newPaddockStatus === s.id ? `${s.color} border-transparent` : 'border-gray-200 text-gray-500 bg-gray-50 hover:border-gray-300'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {newPaddockError && (
              <div className="px-6 pb-0 pt-0">
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{newPaddockError}</p>
              </div>
            )}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setNewPaddockModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Descartar
              </button>
              <button
                onClick={handleCreatePaddock}
                disabled={savingNewPaddock || !newPaddockName.trim()}
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {savingNewPaddock
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-4 h-4" />
                }
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Field Setup Modal (Logical Container) ─────────────────────────────── */}
      {setupFieldModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-950">Configurar Campo</h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                  Contenedor Lógico
                </p>
              </div>
              <button
                onClick={() => setSetupFieldModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                  Hectáreas totales del campo *
                </label>
                <input
                  type="number"
                  autoFocus
                  value={setupFieldArea}
                  onChange={e => setSetupFieldArea(e.target.value === '' ? '' : Number(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter' && setupFieldArea && setupFieldArea > 0) handleSetupField() }}
                  placeholder="Ej: 500"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setSetupFieldModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSetupField}
                disabled={savingField || !setupFieldArea || setupFieldArea <= 0}
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {savingField ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Paddock Creation Modal ─────────────────────────────────────── */}
      {manualPaddockModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-950">Crear Potrero Manual</h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">
                  Sin ubicación en mapa
                </p>
              </div>
              <button
                onClick={() => setManualPaddockModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                  Nombre del Potrero *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={manualPaddockName}
                  onChange={e => setManualPaddockName(e.target.value)}
                  placeholder="Ej: Lote 3"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                  Superficie (ha) *
                </label>
                <input
                  type="number"
                  value={manualPaddockArea}
                  onChange={e => setManualPaddockArea(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ej: 50"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                  Materia Seca Actual (kg MS/ha)
                </label>
                <input
                  type="number"
                  value={manualPaddockMs}
                  onChange={e => setManualPaddockMs(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Opcional. Ej: 1200"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all"
                />
              </div>
            </div>

            {manualPaddockError && (
              <div className="px-6 pb-0 pt-0">
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{manualPaddockError}</p>
              </div>
            )}
            
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setManualPaddockModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateManualPaddock}
                disabled={savingManualPaddock || !manualPaddockName.trim() || !manualPaddockArea || manualPaddockArea <= 0}
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {savingManualPaddock ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
