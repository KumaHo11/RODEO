'use client'

/**
 * app/dashboard/mi-campo/page.tsx
 *
 * Layout 25/75 — replicación milimétrica de HerdsMasterLayout:
 *   LEFT  25% (w-[300px]): PaddockSidePanel (lista master, bg-white, border-r)
 *   RIGHT 75% (flex-1):    PaddockDetailView con tabs o empty state
 *
 * El mapa ya NO divide la pantalla: se abre como drawer desde PaddockDetailView.
 *
 * URL state: ?paddockId=<id>&tab=<tab>
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { getPaddockNDVI, type SatelliteData } from '@/lib/services/satellite'
import { dbGetAll, dbUpsertMany, dbGetOrg, dbUpsertOrg } from '@/lib/offline/db'
import { toast } from 'sonner'
import {
  X, Check, Plus, Building2, MapPin, Loader2, Search, AlertTriangle, Link2,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmModal'
import type { ParsedKmlFeature } from '@/lib/kmlParser'
import OnboardingTour from '@/components/OnboardingTour'
import PaddockSidePanel from './components/PaddockSidePanel'
import PaddockDetailView from './components/PaddockDetailView'
import dynamic from 'next/dynamic'

// Lazy map for digitize overlay (avoid SSR issues)
const MiCampoMapForDigitize = dynamic(
  () => import('./components/MiCampoMap'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center bg-gray-100"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div> }
)

// ── Empty state cuando no hay nada seleccionado ───────────────────────────────
function EmptyDetailState({ onCreateClick, onKmlClick }: { onCreateClick: () => void; onKmlClick: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <h2 className="text-base font-black text-gray-600 mb-1">Seleccioná un potrero</h2>
      <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-6">
        Hacé clic en cualquier potrero de la lista para ver sus datos, métricas, infraestructura y bitácora.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={onCreateClick}
          className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all"
        >
          Nuevo potrero
        </button>
        <button
          onClick={onKmlClick}
          className="px-4 py-2 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all"
        >
          Importar KML / KMZ
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MiCampoPage() {
  return (
    <Suspense>
      <MiCampoPageInner />
    </Suspense>
  )
}

function MiCampoPageInner() {
  const { user }  = useAuth()
  const router    = useRouter()
  const searchParams = useSearchParams()
  const { confirm, ConfirmModal } = useConfirm()

  // ── URL ───────────────────────────────────────────────────────────────────
  const paddockId = searchParams.get('paddockId')

  // ── Data state ────────────────────────────────────────────────────────────
  const [paddocks,   setPaddocks]   = useState<any[]>([])
  const [org,        setOrg]        = useState<any>(null)
  const [fieldBoundary, setFieldBoundary] = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [isOffline,  setIsOffline]  = useState(false)
  const [ndviData,   setNdviData]   = useState<Record<string, SatelliteData>>({})
  const [ndviLoading, setNdviLoading] = useState(false)
  const [activeGrazingPlans, setActiveGrazingPlans] = useState<{paddock_id:string;herd_name:string;head_count:number}[]>([])
  const [herds, setHerds] = useState<any[]>([])

  // ── KML state ─────────────────────────────────────────────────────────────
  const [kmlFeatures, setKmlFeatures]           = useState<ParsedKmlFeature[]>([])
  const [kmlAccepted, setKmlAccepted]           = useState<Set<number>>(new Set())
  const [kmlModalFeature, setKmlModalFeature]   = useState<{ feat: ParsedKmlFeature; idx: number } | null>(null)
  const kmlFileInputRef = useRef<HTMLInputElement>(null)

  // ── Map draw modes ────────────────────────────────────────────────────────
  const [drawModeActive, setDrawModeActive]               = useState(false)
  const [fieldBoundaryDrawMode, setFieldBoundaryDrawMode] = useState(false)
  const [pendingAssignId, setPendingAssignId]             = useState<string|null>(null)

  // ── Inline creation (replaces legacy PaddockModal) ────────────────────────
  const [newPaddockMode, setNewPaddockMode] = useState(false)  // manual form
  const [digitizeMode,   setDigitizeMode]   = useState(false)  // map+draw overlay
  const [creatingName,   setCreatingName]   = useState('')
  const [creatingMs,     setCreatingMs]     = useState('')
  const [creatingArea,   setCreatingArea]   = useState('')
  const [creatingBusy,   setCreatingBusy]   = useState(false)
  const [pendingGeom,    setPendingGeom]    = useState<any>(null)
  const [pendingAreaHa,  setPendingAreaHa]  = useState(0)

  // ── Field setup modal ─────────────────────────────────────────────────────
  const [setupModal, setSetupModal]           = useState(false)
  const [setupName, setSetupName]             = useState('')
  const [setupLocation, setSetupLocation]     = useState('')
  const [setupArea, setSetupArea]             = useState<number|''>('')
  const [savingField, setSavingField]         = useState(false)
  const [setupImgUrl, setSetupImgUrl]         = useState<string|null>(null)
  const [setupImgFile, setSetupImgFile]       = useState<File|null>(null)
  const [setupImgUploading, setSetupImgUploading] = useState(false)
  const setupImgRef = useRef<HTMLInputElement>(null)

  // ── URL helpers ───────────────────────────────────────────────────────────
  const selectPaddock = useCallback((id: string | null) => {
    const params = new URLSearchParams()
    if (id) { params.set('paddockId', id); params.set('tab', 'datos') }
    router.replace(id ? `?${params.toString()}` : '?', { scroll: false })
  }, [router])

  const goBack = useCallback(() => router.replace('?', { scroll: false }), [router])

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // 1. IDB primero
    try {
      const [local, localOrg] = await Promise.all([dbGetAll('paddocks'), dbGetOrg()])
      if (local.length > 0) {
        setPaddocks(local)
        if (localOrg) { setOrg(localOrg); if (localOrg.boundaries) setFieldBoundary(localOrg.boundaries) }
        setLoading(false)
      }
    } catch {}

    // 2. API
    try {
      const [pRes, oRes, plRes, hRes] = await Promise.all([
        apiFetch('/api/paddocks'),
        apiFetch('/api/organizations'),
        apiFetch('/api/grazing-plans'),
        apiFetch('/api/herds'),
      ])
      const pData  = pRes.ok  ? (await pRes.json()).paddocks || []  : []
      const oData  = oRes.ok  ? (await oRes.json()).organization    : null
      const plData = plRes.ok ? (await plRes.json()).plans || []    : []
      const hData  = hRes.ok  ? (await hRes.json()).herds || []     : []

      if (!pRes.ok && !oRes.ok) throw new Error('offline')

      if (pRes.ok) await dbUpsertMany('paddocks', pData).catch(() => {})
      if (oRes.ok && oData) await dbUpsertOrg(oData).catch(() => {})

      setOrg(oData)
      if (oData?.boundaries) setFieldBoundary(oData.boundaries)
      setHerds(hData)

      // Active grazing plans
      const today = new Date().toISOString().split('T')[0]
      const active = plData.filter((p: any) => {
        const s = (p.status ?? '').toUpperCase()
        return s === 'ACTIVE' || ((s === 'PLANNED' || s === 'PROGRAMADO') && p.entry_date <= today && (!p.exit_date || p.exit_date >= today))
      }).map((p: any) => {
        const matched = hData.filter((h: any) => h.id === p.herd_id || (Array.isArray(p.herd_ids) && p.herd_ids.includes(h.id)))
        return {
          paddock_id: p.paddock_id,
          herd_name: matched[0]?.name || 'Rodeo',
          head_count: matched.reduce((s: number, h: any) => s + (Number(h.head_count) || 0), 0),
        }
      })
      setActiveGrazingPlans(active)
      setPaddocks(pData)
      setIsOffline(false)
      setLoading(false)
      loadNdvi(pData)
    } catch {
      setIsOffline(true)
      setLoading(false)
    }
  }, [user])

  const loadNdvi = async (list: any[]) => {
    setNdviLoading(true)
    const results: Record<string, SatelliteData> = {}
    await Promise.all(list.map(async p => {
      try {
        const n = await getPaddockNDVI(p.boundary, p.id, Number(p.area_ha))
        if (n) results[p.id] = n
      } catch {}
    }))
    setNdviData(results)
    setNdviLoading(false)
  }

  useEffect(() => { loadData() }, [loadData])

  // ── Auto-select first paddock when none is selected ───────────────────────
  useEffect(() => {
    if (!loading && paddocks.length > 0 && !paddockId && !newPaddockMode && !digitizeMode) {
      selectPaddock(paddocks[0].id)
    }
  }, [loading, paddocks, paddockId, newPaddockMode, digitizeMode, selectPaddock])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePaddockGeomUpdated = async (id: string, geom: any, areaHa: number) => {
    setPaddocks(prev => prev.map(p => p.id === id ? { ...p, area_ha: areaHa } : p))
    await loadData()
  }

  const handleNewPaddockDrawn = useCallback(async (geojson: any, areaHa: number) => {
    setDrawModeActive(false)
    if (pendingAssignId) {
      try {
        await apiFetch(`/api/paddocks/${pendingAssignId}`, {
          method: 'PATCH',
          body: JSON.stringify({ geojson, area_ha: areaHa }),
        })
        toast.success('Polígono asignado')
        await loadData()
      } catch { toast.error('Error al asignar el polígono') }
      setPendingAssignId(null)
      return
    }
    // If digitizing for a new paddock: store and open manual inline form
    setPendingGeom(geojson)
    setPendingAreaHa(areaHa)
    setCreatingArea(areaHa.toFixed(2))
    setDigitizeMode(false)
    setNewPaddockMode(true)
  }, [pendingAssignId, loadData])

  const handleFieldBoundaryDrawn = useCallback(async (geojson: any) => {
    setFieldBoundaryDrawMode(false)
    try {
      const { area: turfArea } = await import('@turf/area')
      const ha = turfArea({ type: 'Feature', geometry: geojson, properties: {} }) / 10000
      await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ boundaries: geojson, total_area_ha: parseFloat(ha.toFixed(2)) }),
      })
      toast.success('Límite del campo guardado')
      await loadData()
    } catch {}
  }, [loadData])

  const handleFieldBoundaryEdited = useCallback(async (geojson: any, areaHa: number) => {
    try {
      await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ boundaries: geojson, total_area_ha: areaHa }),
      })
      toast.success('Límite del campo actualizado')
      await loadData()
    } catch { toast.error('Error al guardar límite') }
  }, [loadData])

  const handleDeletePaddock = async (id: string) => {
    try {
      const res = await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(`No se pudo eliminar: ${d.error}`); return }
      toast.success('Potrero eliminado')
      if (paddockId === id) goBack()
      await loadData()
    } catch (e: any) { toast.error(`No se pudo eliminar: ${e.message}`) }
  }

  // ── Manual inline creation save ──────────────────────────────────────────────────
  const handleManualSave = async () => {
    if (!creatingName.trim()) { toast.error('Ingresá un nombre para el potrero'); return }
    setCreatingBusy(true)
    try {
      const body: Record<string, any> = {
        name: creatingName.trim(),
        current_status: 'RESTING',
        area_ha: creatingArea !== '' ? parseFloat(Number(creatingArea).toFixed(2)) : 0,
      }
      if (creatingMs !== '') body.dry_matter_kg_ha = Number(creatingMs)
      if (pendingGeom)       body.geojson          = pendingGeom
      const res = await apiFetch('/api/paddocks', { method: 'POST', body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Potrero “${creatingName.trim()}” creado`)
        setNewPaddockMode(false)
        setPendingGeom(null)
        setCreatingName('')
        setCreatingMs('')
        setCreatingArea('')
        await loadData()
        if (data.paddock?.id) selectPaddock(data.paddock.id)
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al crear el potrero')
      }
    } catch { toast.error('Error al crear el potrero') }
    setCreatingBusy(false)
  }

  const handleSetupField = async () => {
    setSavingField(true)
    try {
      const patch: Record<string, any> = {}
      if (setupArea && Number(setupArea) > 0) patch.total_area_ha = Number(setupArea)
      if (setupName.trim()) patch.name = setupName.trim()
      if (setupLocation.trim()) patch.location_label = setupLocation.trim()
      if (setupImgUrl && !setupImgUrl.startsWith('blob:')) {
        patch.technical_data = { ...(org?.technical_data || {}), field_image_url: setupImgUrl }
      }
      await apiFetch('/api/organizations', { method: 'PATCH', body: JSON.stringify(patch) })
      setSetupModal(false)
      await loadData()
    } catch {}
    setSavingField(false)
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const avgNdvi = (() => {
    const vals = paddocks.map(p => ndviData[p.id]?.averageNdvi ?? p.current_ndvi).filter(v => v != null)
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  })()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    /*
     * Replicación exacta de HerdsMasterLayout:
     * flex h-full overflow-hidden w-full
     */
    <div className="flex h-full overflow-hidden w-full">
      <OnboardingTour
        tourId="tour-potreros-v2"
        steps={[
          { target: '.paddock-sidebar', title: 'Lista de Potreros', content: 'Seleccioná un potrero para ver sus datos y métricas.', placement: 'right' },
          { target: '.paddock-detail', title: 'Vista de Detalle', content: 'Navegá por las pestañas para ver datos, infraestructura, métricas y bitácora.', placement: 'left' },
        ]}
      />

      {/* ── Sidebar 25% — idéntico a HerdsMasterLayout aside ──────────────── */}
      <aside className="
        paddock-sidebar
        hidden md:flex shrink-0 flex-col
        w-[300px]
        bg-white
        border-r border-gray-200
        shadow-[1px_0_6px_0_rgba(0,0,0,0.04)]
        overflow-hidden
      ">
        {/* Offline banner */}
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[10px] font-bold text-amber-700">Datos sin conexión</p>
          </div>
        )}

        <PaddockSidePanel
          paddocks={paddocks}
          org={org}
          loading={loading}
          selectedPaddockId={paddockId}
          onSelectPaddock={selectPaddock}
          ndviData={ndviData}
          avgNdvi={avgNdvi}
          onSetupField={() => {
            setSetupName(org?.name || '')
            setSetupLocation(org?.location_label || '')
            setSetupArea(org?.total_area_ha || '')
            setSetupModal(true)
          }}
          onDigitize={() => {
            // Open map immediately with draw mode active
            setDigitizeMode(true)
          }}
          onManualCreate={() => {
            setPendingGeom(null)
            setCreatingName('')
            setCreatingMs('')
            setCreatingArea('')
            setNewPaddockMode(true)
          }}
          onKmlFeaturesLoaded={(features) => {
            setKmlFeatures(features)
            setKmlAccepted(new Set())
            toast.info(`${features.length} polígono${features.length !== 1 ? 's' : ''} importado${features.length !== 1 ? 's' : ''}. Abrí el mapa desde "Ver Mapa" para asignarlos.`, { duration: 6000 })
          }}
        />
      </aside>

      {/* ── Panel derecho 75% ── */}
      <main className="paddock-detail flex-1 flex flex-col overflow-hidden bg-gray-50 min-w-0">

        {/* A) Inline manual creation form */}
        {newPaddockMode && !digitizeMode && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="shrink-0 bg-white border-b border-gray-100 px-8 pt-6 pb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-gray-950">Nuevo potrero</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pendingGeom ? 'Polígono dibujado · completá los datos' : 'Sin polígono · solo datos'}
                </p>
              </div>
              <button
                onClick={() => { setNewPaddockMode(false); setPendingGeom(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
                aria-label="Cancelar creación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-8 max-w-xl space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-gray-50">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Datos del potrero</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Nombre *</p>
                    <input
                      autoFocus
                      value={creatingName}
                      onChange={e => setCreatingName(e.target.value)}
                      placeholder="Ej. Lote Norte"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Superficie (ha)</p>
                      <input
                        type="number" min="0" step="0.1"
                        value={creatingArea}
                        onChange={e => setCreatingArea(e.target.value)}
                        placeholder="ha"
                        readOnly={Boolean(pendingGeom && Number(creatingArea) > 0)}
                        className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all ${pendingGeom ? 'bg-gray-50 text-gray-500' : ''}`}
                      />
                      {pendingGeom && <p className="text-[9px] text-gray-400 mt-1">Calculada del polígono</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Materia Seca (kg/ha)</p>
                      <input
                        type="number" min="0" step="50"
                        value={creatingMs}
                        onChange={e => setCreatingMs(e.target.value)}
                        placeholder="Ej. 1500"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setNewPaddockMode(false); setPendingGeom(null) }}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >Cancelar</button>
                <button
                  onClick={handleManualSave}
                  disabled={creatingBusy || !creatingName.trim()}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {creatingBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear potrero'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* B) Digitize: full-screen map with draw tools */}
        {digitizeMode && (
          <DigitizeMapOverlay
            paddocks={paddocks}
            org={org}
            fieldBoundary={fieldBoundary}
            activeGrazingPlans={activeGrazingPlans}
            kmlFeatures={kmlFeatures}
            kmlAcceptedIndices={kmlAccepted}
            onKmlPolygonClick={(idx, feat) => setKmlModalFeature({ feat, idx })}
            onNewPaddockDrawn={handleNewPaddockDrawn}
            onFieldBoundaryDrawn={handleFieldBoundaryDrawn}
            onFieldBoundaryEdited={handleFieldBoundaryEdited}
            onClose={() => setDigitizeMode(false)}
          />
        )}

        {/* C) Existing paddock detail */}
        {!newPaddockMode && !digitizeMode && paddockId && (
          <PaddockDetailView
            paddockId={paddockId}
            paddocks={paddocks}
            ndviData={ndviData}
            ndviLoading={ndviLoading}
            onBack={goBack}
            onDataRefresh={loadData}
            org={org}
            fieldBoundary={fieldBoundary}
            activeGrazingPlans={activeGrazingPlans}
            onSelectPaddock={selectPaddock}
            onPaddockGeomUpdated={handlePaddockGeomUpdated}
            onNewPaddockDrawn={handleNewPaddockDrawn}
            onDeletePaddock={handleDeletePaddock}
            onFieldBoundaryEdited={handleFieldBoundaryEdited}
            kmlFeatures={kmlFeatures}
            kmlAcceptedIndices={kmlAccepted}
            onKmlPolygonClick={(idx, feat) => setKmlModalFeature({ feat, idx })}
            onFieldBoundaryDrawn={handleFieldBoundaryDrawn}
            onDigitize={() => { setNewPaddockMode(false); setDigitizeMode(true) }}
            onManual={() => { setDigitizeMode(false); setNewPaddockMode(true) }}
          />
        )}

        {/* D) Empty state (0 paddocks, nothing active) */}
        {!newPaddockMode && !digitizeMode && !paddockId && paddocks.length === 0 && !loading && (
          <EmptyDetailState
            onCreateClick={() => {
              setCreatingName('')
              setCreatingMs('')
              setCreatingArea('')
              setPendingGeom(null)
              setNewPaddockMode(true)
            }}
            onKmlClick={() => kmlFileInputRef.current?.click()}
          />
        )}
      </main>

      {/* Hidden KML input for empty state */}
      <input
        ref={kmlFileInputRef}
        type="file"
        accept=".kml,.kmz,.zip,.geojson,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const { parseKmlFile } = await import('@/lib/kmlParser')
          const result = await parseKmlFile(file)
          e.target.value = ''
          if (!result.error && result.features.length > 0) {
            setKmlFeatures(result.features)
            setKmlAccepted(new Set())
            toast.info(`${result.features.length} polígono${result.features.length !== 1 ? 's' : ''} importado${result.features.length !== 1 ? 's' : ''}.`)
          }
        }}
      />



      {/* ── KML assign modal ──────────────────────────────────────────────── */}
      {kmlModalFeature && (
        <KmlPolygonModal
          feature={kmlModalFeature.feat}
          idx={kmlModalFeature.idx}
          existingPaddocks={paddocks}
          onClose={() => setKmlModalFeature(null)}
          onCreated={() => { setKmlAccepted(prev => new Set([...prev, kmlModalFeature!.idx])); setKmlModalFeature(null); loadData() }}
          onAssigned={() => { setKmlAccepted(prev => new Set([...prev, kmlModalFeature!.idx])); setKmlModalFeature(null); loadData() }}
        />
      )}

      {/* ── Field setup modal ─────────────────────────────────────────────── */}
      {setupModal && (
        <FieldSetupModal
          name={setupName}         onName={setSetupName}
          location={setupLocation} onLocation={setSetupLocation}
          area={setupArea}         onArea={setSetupArea}
          saving={savingField}
          onClose={() => setSetupModal(false)}
          onSave={handleSetupField}
        />
      )}

      <ConfirmModal />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DigitizeMapOverlay — Full-screen map with draw tools for new paddock creation
// ══════════════════════════════════════════════════════════════════════════════

const _MiCampoMapForDigitize = MiCampoMapForDigitize

function DigitizeMapOverlay({
  paddocks, org, fieldBoundary, activeGrazingPlans,
  kmlFeatures, kmlAcceptedIndices, onKmlPolygonClick,
  onNewPaddockDrawn, onFieldBoundaryDrawn, onFieldBoundaryEdited, onClose,
}: {
  paddocks: any[]; org: any; fieldBoundary: any
  activeGrazingPlans: any[]
  kmlFeatures: any[]; kmlAcceptedIndices: Set<number>
  onKmlPolygonClick: (idx: number, feat: any) => void
  onNewPaddockDrawn: (geojson: any, areaHa: number) => void
  onFieldBoundaryDrawn: (geojson: any) => void
  onFieldBoundaryEdited: (geojson: any, areaHa: number) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[8000] flex flex-col">
      {/* Header verde sólido 100% ancho — sin blur */}
      <div className="w-full bg-green-700 shrink-0 flex items-center justify-between px-6 py-3">
        <div>
          <p className="text-sm font-black text-white">Digitalizar potrero</p>
          <p className="text-[11px] text-green-200">Dibujá el límite del potrero en el mapa</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar mapa"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-500 transition-all"
        >
          <X className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>
      </div>
      {/* Map ocupa todo el área restante */}
      <div className="flex-1 relative overflow-hidden">
        <_MiCampoMapForDigitize
          paddocks={paddocks}
          org={org}
          fieldBoundary={fieldBoundary}
          selectedPaddockId={null}
          onSelectPaddock={() => {}}
          onPaddockGeomUpdated={() => {}}
          onNewPaddockDrawn={onNewPaddockDrawn}
          onDeletePaddock={() => {}}
          activeGrazingPlans={activeGrazingPlans}
          drawModeActive={true}
          onDrawModeChange={() => {}}
          fieldBoundaryDrawMode={false}
          onFieldBoundaryDrawn={onFieldBoundaryDrawn}
          onFieldBoundaryDrawModeChange={() => {}}
          onFieldBoundaryEdited={onFieldBoundaryEdited}
          kmlFeatures={kmlFeatures}
          kmlAcceptedIndices={kmlAcceptedIndices}
          onKmlPolygonClick={onKmlPolygonClick}
        />
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// KML Polygon Modal — unchanged logic, lighter markup
// ══════════════════════════════════════════════════════════════════════════════
function KmlPolygonModal({ feature, idx, existingPaddocks, onClose, onCreated, onAssigned }: {
  feature: ParsedKmlFeature; idx: number
  existingPaddocks: any[]; onClose: () => void; onCreated: () => void; onAssigned: () => void
}) {
  const [mode, setMode]     = useState<'choose'|'create'|'assign'>('choose')
  const [name, setName]     = useState(feature.name || '')
  const [msHa, setMsHa]     = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const filtered = existingPaddocks.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))

  const FIELD_SM = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none'

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/paddocks', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), area_ha: feature.area_ha, boundary: feature.geojson, current_status: 'RESTING', dry_matter_kg_ha: msHa !== '' ? Number(msHa) : undefined }),
      })
      if (res.ok) { toast.success(`Potrero "${name.trim()}" creado`); onCreated() }
      else toast.error('Error al crear el potrero')
    } catch { toast.error('Error al crear el potrero') }
    setSaving(false)
  }

  const handleAssign = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/paddocks/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ geojson: feature.geojson, area_ha: feature.area_ha }),
      })
      if (res.ok) { toast.success('Polígono asignado'); onAssigned() }
      else toast.error('Error al asignar el polígono')
    } catch { toast.error('Error al asignar el polígono') }
    setSaving(false)
  }

  const content = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-black text-gray-900">Polígono KML</h3>
            <p className="text-[11px] text-cyan-600 font-bold mt-0.5">{feature.name} · {feature.area_ha.toFixed(2)} ha</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-medium">¿Qué querés hacer con este polígono?</p>
              <button onClick={() => setMode('create')} className="w-full flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all text-left">
                <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shrink-0"><Plus className="w-4 h-4 text-white" /></div>
                <div><p className="text-sm font-black text-gray-900">Nuevo potrero</p><p className="text-[10px] text-gray-500 mt-0.5">Crea un potrero con los límites de este polígono</p></div>
              </button>
              <button onClick={() => setMode('assign')} className="w-full flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0"><Link2 className="w-4 h-4 text-white" /></div>
                <div><p className="text-sm font-black text-gray-900">Asignar a existente</p><p className="text-[10px] text-gray-500 mt-0.5">Usa este polígono como límite de un potrero ya creado</p></div>
              </button>
            </div>
          )}
          {mode === 'create' && (
            <div className="space-y-3">
              <button onClick={() => setMode('choose')} className="text-[10px] text-gray-400 hover:text-gray-600 font-bold">← Volver</button>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Nombre del potrero</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Lote Norte" className={FIELD_SM} autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">MS/ha <span className="font-normal normal-case opacity-70">(kg)</span></label>
                <input type="number" min="0" step="50" value={msHa} onChange={e => setMsHa(e.target.value)} placeholder="Ej. 1500" className={FIELD_SM} />
              </div>
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-cyan-700">Área calculada</span>
                <span className="text-sm font-black text-cyan-900">{feature.area_ha.toFixed(2)} ha</span>
              </div>
              <button onClick={handleCreate} disabled={!name.trim() || saving}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear potrero'}
              </button>
            </div>
          )}
          {mode === 'assign' && (
            <div className="space-y-3">
              <button onClick={() => setMode('choose')} className="text-[10px] text-gray-400 hover:text-gray-600 font-bold">← Volver</button>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre..."
                className={FIELD_SM} autoFocus />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filtered.map(p => (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${selectedId === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-blue-50'}`}>
                    {p.name} <span className={`text-[10px] ${selectedId === p.id ? 'text-blue-200' : 'text-gray-400'}`}>{Number(p.area_ha || 0).toFixed(1)} ha</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="text-[11px] text-gray-400 text-center py-4">Sin resultados</p>}
              </div>
              {selectedId && (
                <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 font-medium">Se reemplazará el polígono actual del potrero.</p>
                </div>
              )}
              <button onClick={handleAssign} disabled={!selectedId || saving}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Asignar polígono'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}

// ══════════════════════════════════════════════════════════════════════════════
// Field Setup Modal — simple and clean
// ══════════════════════════════════════════════════════════════════════════════
function FieldSetupModal({ name, onName, location, onLocation, area, onArea, saving, onClose, onSave }: {
  name: string; onName: (v: string) => void
  location: string; onLocation: (v: string) => void
  area: number|''; onArea: (v: number|'') => void
  saving: boolean; onClose: () => void; onSave: () => void
}) {
  const FIELD = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none'
  const LABEL = 'text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5'

  const content = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-black text-gray-900">Configurar campo</h3>
            <p className="text-xs text-gray-400 mt-0.5">Nombre, ubicación y superficie</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LABEL}><Building2 className="w-3.5 h-3.5 inline mr-1" />Nombre del campo</label>
            <input type="text" value={name} onChange={e => onName(e.target.value)} placeholder="Ej: La Esperanza" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}><MapPin className="w-3.5 h-3.5 inline mr-1" />Ubicación</label>
            <input type="text" value={location} onChange={e => onLocation(e.target.value)} placeholder="Ciudad, provincia o país..." className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Hectáreas totales</label>
            <input type="number" value={area} onChange={e => onArea(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ej: 1245" className={FIELD} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
