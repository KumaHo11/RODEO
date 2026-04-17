'use client'

import dynamic from 'next/dynamic'
import PaddockSidePanel from './components/PaddockSidePanel'
import PaddockModal from './components/PaddockModal'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { getPaddockNDVI, SatelliteData } from '@/lib/services/satellite'
import { X, Check, Plus, Satellite, Image as ImageIcon } from 'lucide-react'

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

const DRAFT_PADDOCK = (name = '', area_ha = 0) => ({
  id: '__NEW__',
  name,
  area_ha,
  current_status: 'RESTING',
  dry_matter_kg_ha: undefined,
  technical_data: {},
  geom: null,
})

export default function MiCampoPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const editPaddockId = searchParams.get('editPaddock')
  const [paddocks, setPaddocks]             = useState<any[]>([])
  const [org, setOrg]                       = useState<any>(null)
  const [fieldBoundary, setFieldBoundary]   = useState<any>(null)
  const [selectedPaddockId, setSelectedPaddockId] = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)
  const [ndviData, setNdviData]             = useState<Record<string, SatelliteData>>({})
  const [ndviLoading, setNdviLoading]       = useState(false)
  const [activeGrazingPlans, setActiveGrazingPlans] = useState<{paddock_id: string; herd_name: string; head_count: number}[]>([])

  // -- Unified creation modal ─────────────────────────────────────────────────
  const [creationModal, setCreationModal]   = useState(false)
  const [creationGeom, setCreationGeom]     = useState<any>(null)
  const [creationAreaHa, setCreationAreaHa] = useState(0)

  // -- Map draw modes ─────────────────────────────────────────────────────────
  const [drawModeActive, setDrawModeActive]           = useState(false)
  const [fieldBoundaryDrawMode, setFieldBoundaryDrawMode] = useState(false)

  // -- Map view toggle (satellite | image) ────────────────────────────────────
  const [mapView, setMapView] = useState<'satellite' | 'image'>('satellite')

  // -- Field setup modal ──────────────────────────────────────────────────────
  const [setupFieldModal, setSetupFieldModal] = useState(false)
  const [setupFieldArea, setSetupFieldArea]   = useState<number | ''>('')
  const [savingField, setSavingField]         = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
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
    const plansData    = plansRes.ok    ? (await plansRes.json()).plans || []  : []

    setOrg(orgData)
    if (orgData?.boundaries) setFieldBoundary(orgData.boundaries)

    const activePlans = plansData.filter((p: any) => p.status === 'ACTIVE').map((p: any) => ({
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
          // Only auto-update NDVI-derived dry matter if paddock has no user-entered value
          if (!p.dry_matter_kg_ha && ndvi.estimatedAvailableDryMatterHa) {
            // Store NDVI in paddock but NOT override dry_matter_kg_ha
            await apiFetch(`/api/paddocks/${p.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ current_ndvi: ndvi.averageNdvi }),
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

  const handlePaddockGeomUpdated = async () => { await loadData() }

  // ── Creation via map draw ────────────────────────────────────────────────────
  const handleNewPaddockDrawn = useCallback((geojson: any, areaHa: number) => {
    setDrawModeActive(false)
    setCreationGeom(geojson)
    setCreationAreaHa(areaHa)
    setCreationModal(true)
  }, [])

  // ── Field boundary drawn from map ────────────────────────────────────────────
  const handleFieldBoundaryDrawn = useCallback(async (geojson: any) => {
    setFieldBoundaryDrawMode(false)
    try {
      const { area: turfArea } = await import('@turf/area')
      const calc = turfArea({ type: 'Feature', geometry: geojson, properties: {} }) / 10000
      await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ boundaries: geojson, total_area_ha: parseFloat(calc.toFixed(2)) }),
      })
      await loadData()
    } catch {}
  }, [loadData])

  // ── Manual creation from side panel ─────────────────────────────────────────
  const openManualCreation = () => {
    setCreationGeom(null)
    setCreationAreaHa(0)
    setCreationModal(true)
  }

  // ── PaddockModal.onSave for creation ─────────────────────────────────────────
  const handleCreatePaddock = async (
    _draftId: string,
    name: string,
    technicalData: Record<string, any>,
    dryMatter?: number,
    areaHa?: number,
  ) => {
    const body: Record<string, any> = {
      name: name.trim(),
      area_ha: areaHa ?? creationAreaHa,
      current_status: 'RESTING',
      technical_data: technicalData,
    }
    if (creationGeom)              body.geojson           = creationGeom
    if (dryMatter !== undefined)   body.dry_matter_kg_ha  = dryMatter
    const res = await apiFetch('/api/paddocks', { method: 'POST', body: JSON.stringify(body) })
    if (res.ok) { setCreationModal(false); await loadData() }
  }

  // ── Field setup (manual ha) ──────────────────────────────────────────────────
  const handleSetupField = async () => {
    if (!setupFieldArea || setupFieldArea <= 0) return
    setSavingField(true)
    try {
      const res = await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ total_area_ha: Number(setupFieldArea) }),
      })
      if (res.ok) { setSetupFieldModal(false); await loadData() }
    } catch {}
    setSavingField(false)
  }

  const avgNdvi = Object.values(ndviData).length > 0
    ? Object.values(ndviData).reduce((sum, d) => sum + d.averageNdvi, 0) / Object.values(ndviData).length
    : null

  // Field image from org — auto-switch to image view when available
  const fieldImg = org?.technical_data?.field_image_url as string | null

  useEffect(() => {
    if (fieldImg) {
      setMapView('image')
    } else {
      setMapView('satellite')
    }
  }, [fieldImg])

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-gray-100 p-3 md:p-4 gap-3 md:gap-4">

      {/* ── Map panel — mobile top, desktop right 65% ──────────────────── */}
      <div className="order-1 md:order-2 w-full md:w-[65%] flex flex-col h-[50vh] md:h-full rounded-2xl overflow-hidden shadow-md border border-gray-200 relative min-h-[200px]">

        {/* View toggle tabs — solo cuando hay imagen cargada */}
        {fieldImg && (
          <div className="flex border-b border-gray-200 bg-white shrink-0 z-[500] relative">
            <button
              onClick={() => setMapView('satellite')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all border-b-2 ${
                mapView === 'satellite'
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              <Satellite className="w-3.5 h-3.5" /> Vista satelital
            </button>
            <button
              onClick={() => setMapView('image')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all border-b-2 ${
                mapView === 'image'
                  ? 'text-green-700 border-green-600 bg-green-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Imagen cargada
            </button>
          </div>
        )}

        {/* Content: satellite map or uploaded image */}
        {mapView === 'image' && fieldImg ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fieldImg}
              alt="Imagen del campo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <MiCampoMap
            paddocks={paddocks}
            org={org}
            fieldBoundary={fieldBoundary}
            selectedPaddockId={selectedPaddockId}
            onSelectPaddock={setSelectedPaddockId}
            onPaddockGeomUpdated={handlePaddockGeomUpdated}
            onNewPaddockDrawn={handleNewPaddockDrawn}
            onDeletePaddock={async (id) => {
              try {
                const res = await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                  const errData = await res.json().catch(()=>({error: 'Error desconocido'}))
                  alert(`No se pudo eliminar el potrero: ${errData.error}`)
                } else {
                  loadData()
                }
              } catch(err: any) {
                alert(`No se pudo eliminar: ${err.message}`)
              }
            }}
            activeGrazingPlans={activeGrazingPlans}
            drawModeActive={drawModeActive}
            onDrawModeChange={setDrawModeActive}
            fieldBoundaryDrawMode={fieldBoundaryDrawMode}
            onFieldBoundaryDrawn={handleFieldBoundaryDrawn}
            onFieldBoundaryDrawModeChange={setFieldBoundaryDrawMode}
            initialCenter={
              org?.location?.coordinates
                ? [org.location.coordinates[1], org.location.coordinates[0]] as [number, number]
                : undefined
            }
          />
        )}

        {/* FAB: Nuevo potrero — solo en vista satelital y modo normal */}
        {mapView === 'satellite' && !fieldBoundaryDrawMode && (
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
              title={drawModeActive ? 'Cancelar' : 'Dibujar nuevo potrero'}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all ${
                drawModeActive ? 'bg-red-500 hover:bg-red-600 rotate-45' : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Indicator cuando estamos dibujando el límite del campo */}
        {fieldBoundaryDrawMode && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              Dibujá el límite del campo
              <button onClick={() => setFieldBoundaryDrawMode(false)} className="ml-2 opacity-70 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Side Panel — mobile bottom, desktop left 35% ─────────────────── */}
      <div className="order-2 md:order-1 w-full md:w-[35%] md:shrink-0 flex flex-col overflow-hidden">
        <PaddockSidePanel
          paddocks={paddocks}
          org={org}
          user={user}
          loading={loading}
          selectedPaddockId={selectedPaddockId}
          onSelectPaddock={setSelectedPaddockId}
          onSaveTechnicalData={handlePaddockSaved}
          ndviData={ndviData}
          ndviLoading={ndviLoading}
          avgNdvi={avgNdvi}
          onSetupField={() => { setSetupFieldArea(org?.total_area_ha || ''); setSetupFieldModal(true) }}
          onManualPaddockCreate={openManualCreation}
          defaultEditPaddockId={editPaddockId || undefined}
          onDeletePaddock={async (id) => {
            try {
              const res = await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const errData = await res.json().catch(()=>({error: 'Error desconocido'}))
                alert(`No se pudo eliminar el potrero: ${errData.error}`)
              } else {
                loadData()
              }
            } catch(err: any) {
              alert(`No se pudo eliminar: ${err.message}`)
            }
          }}
          onDeleteField={async () => {
            if (window.confirm('¿Eliminar los límites del campo? Podés volver a configurarlo cuando quieras.')) {
              await apiFetch('/api/organizations', {
                method: 'PATCH',
                body: JSON.stringify({ boundaries: null, total_area_ha: null }),
              })
              loadData()
            }
          }}
          onDataRefresh={loadData}
        />
      </div>

      {/* ── Unified Creation Modal ───────────────────────────────────────── */}
      {creationModal && (
        <PaddockModal
          isCreating
          paddock={DRAFT_PADDOCK('', creationAreaHa)}
          onClose={() => setCreationModal(false)}
          onSave={handleCreatePaddock}
        />
      )}

      {/* ── Field Setup Modal ─────────────────────────────────────────────── */}
      {setupFieldModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Configurar campo</h3>
                <p className="text-xs text-gray-400 mt-0.5">Ingresá la superficie o dibujá el límite en el mapa</p>
              </div>
              <button onClick={() => setSetupFieldModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Hectáreas totales</label>
                <input
                  type="number" autoFocus value={setupFieldArea}
                  onChange={e => setSetupFieldArea(e.target.value === '' ? '' : Number(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter' && setupFieldArea && setupFieldArea > 0) handleSetupField() }}
                  placeholder="Ej: 500"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                />
              </div>

              {/* Dibujar límite del campo en el mapa */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="px-2 bg-white text-xs text-gray-400">o</span></div>
              </div>
              <button
                type="button"
                onClick={() => { setSetupFieldModal(false); setFieldBoundaryDrawMode(true) }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all"
              >
                <Plus className="w-4 h-4" /> Dibujar límite del campo en el mapa
              </button>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setSetupFieldModal(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSetupField}
                disabled={savingField || !setupFieldArea || setupFieldArea <= 0}
                className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {savingField ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
