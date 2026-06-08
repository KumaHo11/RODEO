'use client'

import dynamic from 'next/dynamic'
import PaddockSidePanel from './components/PaddockSidePanel'
import PaddockModal from './components/PaddockModal'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { getPaddockNDVI, SatelliteData } from '@/lib/services/satellite'
import { X, Check, Plus, Satellite, Image as ImageIcon, MapPin, Building2, Loader2 as Spin, Search, AlertTriangle, Link2, Loader2 } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmModal'
import { toast } from 'sonner'
import type { ParsedKmlFeature } from '@/lib/kmlParser'
import OnboardingTour from '@/components/OnboardingTour'

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
  const { confirm, ConfirmModal } = useConfirm()
  const searchParams = useSearchParams()
  const editPaddockId = searchParams.get('editPaddock')
  const returnTo = searchParams.get('returnTo')
  const [paddocks, setPaddocks]             = useState<any[]>([])
  const [org, setOrg]                       = useState<any>(null)
  const [fieldBoundary, setFieldBoundary]   = useState<any>(null)
  const [selectedPaddockId, setSelectedPaddockId] = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)
  const [isOfflineData, setIsOfflineData]   = useState(false)
  const [ndviData, setNdviData]             = useState<Record<string, SatelliteData>>({})
  const [ndviLoading, setNdviLoading]       = useState(false)
  const [activeGrazingPlans, setActiveGrazingPlans] = useState<{paddock_id: string; herd_name: string; head_count: number}[]>([])
  const [herds, setHerds] = useState<any[]>([])
  const [planningDefaults, setPlanningDefaults] = useState({ dailyAllocationKg: 12, targetRemnantKgHa: 600 })
  const [climateSnapshots, setClimateSnapshots] = useState<Record<string, any>>({})

  // -- Unified creation modal ─────────────────────────────────────────────────
  const [creationModal, setCreationModal]   = useState(false)
  const [creationGeom, setCreationGeom]     = useState<any>(null)
  const [creationAreaHa, setCreationAreaHa] = useState(0)

  // -- Map draw modes ─────────────────────────────────────────────────────────
  const [drawModeActive, setDrawModeActive]           = useState(false)
  const [fieldBoundaryDrawMode, setFieldBoundaryDrawMode] = useState(false)
  const [pendingAssignPaddockId, setPendingAssignPaddockId] = useState<string | null>(null)
  const [editPolygonPaddockId, setEditPolygonPaddockId] = useState<string | null>(null)

  // -- Map view toggle (satellite | image) ────────────────────────────────────
  const [mapView, setMapView] = useState<'satellite' | 'image'>('satellite')
  // -- Dynamic map center (updated when user picks a location) ─────────────
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)

  // -- KML import state ────────────────────────────────────────────────────────
  const [kmlFeatures, setKmlFeatures] = useState<ParsedKmlFeature[]>([])
  const [kmlAccepted, setKmlAccepted] = useState<Set<number>>(new Set())
  const [kmlModalFeature, setKmlModalFeature] = useState<{ feat: ParsedKmlFeature; idx: number } | null>(null)

  // -- Field setup modal ──────────────────────────────────────────────────────
  const [setupFieldModal, setSetupFieldModal] = useState(false)
  const [setupFieldArea, setSetupFieldArea]   = useState<number | ''>('')
  const [setupFieldName, setSetupFieldName]   = useState('')
  const [setupFieldLocation, setSetupFieldLocation] = useState('')
  const [savingField, setSavingField]         = useState(false)
  const setupImgRef = useRef<HTMLInputElement>(null)
  const [setupImgUploading, setSetupImgUploading] = useState(false)
  const [setupImgUrl, setSetupImgUrl]         = useState<string | null>(null)
  const [setupImgFile, setSetupImgFile]       = useState<File | null>(null)
  // URL de imagen "en sesión" — persiste aunque el modal se cierre, hasta que se guarda en DB
  const [sessionFieldImg, setSessionFieldImg] = useState<string | null>(null)
  // -- Location autocomplete (Nominatim — same as onboarding) ──────────────
  const [locationSuggs, setLocationSuggs]     = useState<any[]>([])
  const [showLocationSuggs, setShowLocationSuggs] = useState(false)
  const [locationSearching, setLocationSearching] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // ── Paso 1: IndexedDB inmediata ────────────────────────────────────────
    try {
      const { dbGetAll, dbGetOrg } = await import('@/lib/offline/db')
      const [localPaddocks, localOrg] = await Promise.all([
        dbGetAll('paddocks'),
        dbGetOrg(),
      ])
      if (localPaddocks.length > 0) {
        setPaddocks(localPaddocks)
        if (localOrg) {
          setOrg(localOrg)
          if (localOrg.boundaries) setFieldBoundary(localOrg.boundaries)
        }
        setLoading(false)
        setIsOfflineData(false)
      }
    } catch { /* ignore */ }

    // ── Paso 2: API en background ──────────────────────────────────────────
    try {
      const [paddocksRes, orgRes, plansRes, herdsRes, climateRes] = await Promise.all([
        apiFetch('/api/paddocks'),
        apiFetch('/api/organizations'),
        apiFetch('/api/grazing-plans'),
        apiFetch('/api/herds'),
        apiFetch('/api/climate-adjustment').catch(() => ({ ok: false } as Response)),
      ])
      const paddocksData = paddocksRes.ok ? (await paddocksRes.json()).paddocks || [] : []
      const orgData      = orgRes.ok      ? (await orgRes.json()).organization : null
      const plansData    = plansRes.ok    ? (await plansRes.json()).plans || []  : []
      const herdsData    = herdsRes.ok    ? (await herdsRes.json()).herds || []  : []
      const climateData  = climateRes.ok  ? (await climateRes.json()).snapshots || [] : []

      if (!paddocksRes.ok && !orgRes.ok) throw new Error('offline')

      // Guardar datos críticos en IndexedDB y caché local
      const { dbUpsertMany, dbUpsertOrg } = await import('@/lib/offline/db')
      if (paddocksRes.ok) {
        await dbUpsertMany('paddocks', paddocksData).catch(() => {})
        try { localStorage.setItem('rodeo_cached_paddocks', JSON.stringify(paddocksData)) } catch { /* ignore */ }
      }
      if (orgRes.ok && orgData) {
        await dbUpsertOrg(orgData).catch(() => {})
        try { localStorage.setItem('rodeo_cached_org', JSON.stringify(orgData)) } catch { /* ignore */ }
      }

      // Indexar snapshots climáticos por paddock_id (el más reciente primero)
      const snapMap: Record<string, any> = {}
      climateData.forEach((s: any) => {
        if (!snapMap[s.paddock_id]) {
          snapMap[s.paddock_id] = s
        }
      })
      setClimateSnapshots(snapMap)

      setOrg(orgData)
      if (orgData?.boundaries) setFieldBoundary(orgData.boundaries)
      if (orgData?.default_daily_allocation_kg || orgData?.default_target_remnant_kg_ha) {
        setPlanningDefaults({
          dailyAllocationKg:  Number(orgData.default_daily_allocation_kg  ?? 12),
          targetRemnantKgHa:  Number(orgData.default_target_remnant_kg_ha ?? 600),
        })
      }

      // Construir indicadores de pastoreo activo para el mapa
      const today = new Date().toISOString().split('T')[0]
      console.log('[mapa] all plans statuses:', plansData.map((p: any) => ({ id: p.id, status: p.status, paddock_id: p.paddock_id, entry: p.entry_date, exit: p.exit_date })))
      const activePlans = plansData
        .filter((p: any) => {
          const s = (p.status ?? '').toUpperCase()
          if (s === 'ACTIVE') return true
          if ((s === 'PLANNED' || s === 'PROGRAMADO') && p.entry_date <= today && (!p.exit_date || p.exit_date >= today)) return true
          return false
        })
        .map((p: any) => {
          let ids: string[] = []
          if (p.herd_id) ids.push(p.herd_id)
          try {
            const extras: string[] = typeof p.herd_ids === 'string'
              ? JSON.parse(p.herd_ids)
              : Array.isArray(p.herd_ids) ? p.herd_ids : []
            ids = Array.from(new Set([...ids, ...extras]))
          } catch {}

          const matchedHerds = ids.length > 0
            ? herdsData.filter((h: any) => ids.includes(h.id))
            : p.herds ? [p.herds] : []

          const totalHead = matchedHerds.reduce((s: number, h: any) => s + (Number(h.head_count) || 0), 0)
          const names = matchedHerds.map((h: any) => h.name).filter(Boolean)
          const herdLabel = names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0] || 'Rodeo'

          return {
            paddock_id: p.paddock_id,
            herd_name: herdLabel,
            head_count: totalHead || p.herds?.head_count || 0,
          }
        })
      console.log('[mapa] activePlans calculados:', activePlans)
      setActiveGrazingPlans(activePlans)
      setHerds(herdsData)
      setPaddocks(paddocksData)
      setIsOfflineData(false)
      setLoading(false)
      loadNdviForPaddocks(paddocksData)
    } catch {
      // Fallback: usar datos cacheados localmente
      try {
        const cachedPaddocks = JSON.parse(localStorage.getItem('rodeo_cached_paddocks') || '[]')
        const cachedOrg = JSON.parse(localStorage.getItem('rodeo_cached_org') || 'null')
        setPaddocks(cachedPaddocks)
        if (cachedOrg) {
          setOrg(cachedOrg)
          if (cachedOrg.boundaries) setFieldBoundary(cachedOrg.boundaries)
        }
        setIsOfflineData(true)
      } catch { /* ignore */ }
      setLoading(false)
    }
  }, [user])

  const loadNdviForPaddocks = async (paddocks: any[]) => {
    setNdviLoading(true)
    const results: Record<string, SatelliteData> = {}
    await Promise.all(
      paddocks.map(async (p) => {
        try {
          const ndvi = await getPaddockNDVI(p.boundary, p.id, Number(p.area_ha))
          // Skip null (manual paddock without polygon)
          if (!ndvi) return
          results[p.id] = ndvi
          // Only auto-update NDVI-derived dry matter if paddock has no user-entered value
          if (!p.dry_matter_kg_ha && ndvi.estimatedAvailableDryMatterHa) {
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

    if (!navigator.onLine) {
      const { addToOfflineQueue } = await import('@/components/OfflineIndicator')
      addToOfflineQueue({
        type: 'paddock_update',
        data: { paddock_id: paddockId, ...updates },
        timestamp: Date.now()
      } as any)
      import('sonner').then(({ toast }) => toast.success('Potrero guardado offline. Se sincronizará al conectar.'))
    } else {
      await apiFetch(`/api/paddocks/${paddockId}`, { method: 'PATCH', body: JSON.stringify(updates) })
    }
    
    setPaddocks(prev => prev.map(p => p.id === paddockId ? { ...p, ...updates } : p))
  }

  const handlePaddockGeomUpdated = async (paddockId: string, geom: any, areaHa: number) => {
    // Optimistically update local state so hectares refresh immediately
    setPaddocks(prev => prev.map(p => p.id === paddockId ? { ...p, area_ha: areaHa } : p))
    // Recalculate total field area with new values
    const newTotal = paddocks.reduce((sum, p) => {
      const ha = p.id === paddockId ? areaHa : Number(p.area_ha) || 0
      return sum + ha
    }, 0)
    try {
      await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ total_area_ha: parseFloat(newTotal.toFixed(2)) }),
      })
    } catch {}
    await loadData()
  }

  // ── Creation via map draw ────────────────────────────────────────────────────
  const handleNewPaddockDrawn = useCallback(async (geojson: any, areaHa: number) => {
    setDrawModeActive(false)
    if (pendingAssignPaddockId) {
      try {
        const { area: turfArea } = await import('@turf/area')
        const geom = geojson.type === 'Feature' ? geojson.geometry : geojson
        const calcArea = parseFloat((turfArea({ type: 'Feature', geometry: geom, properties: {} }) / 10000).toFixed(2))
        await apiFetch(`/api/paddocks/${pendingAssignPaddockId}`, {
          method: 'PATCH',
          body: JSON.stringify({ geojson, area_ha: calcArea }),
        })
        toast.success('Polígono asignado correctamente')
        await loadData()
      } catch {
        toast.error('Error al asignar el polígono')
      }
      setPendingAssignPaddockId(null)
      return
    }
    setCreationGeom(geojson)
    setCreationAreaHa(areaHa)
    setCreationModal(true)
  }, [pendingAssignPaddockId, loadData])

  // ── Assign polygon to existing manual paddock ────────────────────────────────
  const handleAssignPolygon = useCallback((paddockId: string) => {
    setPendingAssignPaddockId(paddockId)
    setDrawModeActive(true)
    setMapView('satellite')
    toast.info('Dibujá el polígono en el mapa para asignarlo a este potrero', { duration: 5000 })
  }, [])

  // ── Activate edit mode on existing paddock polygon ──────────────────────────
  const handleEditPolygon = useCallback((paddockId: string) => {
    setEditPolygonPaddockId(paddockId)
    setSelectedPaddockId(paddockId)
    setMapView('satellite')
    toast.info('Usá el botón "Editar" (✏️) del mapa, movés los vértices y presioná "Guardar" (✓) para confirmar los cambios.', { duration: 7000 })
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
      toast.success('Límite del campo guardado')
      await loadData()
    } catch {}
  }, [loadData])

  // ── Field boundary edited in map (existing polygon moved) ────────────────────
  const handleFieldBoundaryEdited = useCallback(async (geojson: any, areaHa: number) => {
    try {
      await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ boundaries: geojson, total_area_ha: areaHa }),
      })
      toast.success('Límite del campo actualizado')
      await loadData()
    } catch {
      toast.error('Error al guardar el límite del campo')
    }
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

  // ── Field setup (name + location + ha + photo) ───────────────────────────────
  const handleSetupField = async () => {
    setSavingField(true)
    try {
      const patch: Record<string, any> = {}
      if (setupFieldArea && Number(setupFieldArea) > 0) patch.total_area_ha = Number(setupFieldArea)
      if (setupFieldName.trim()) patch.name = setupFieldName.trim()
      if (setupFieldLocation.trim()) patch.location_label = setupFieldLocation.trim()

      // Always carry the field_image_url forward:
      // - If a new real server URL was uploaded this session, use it
      // - Otherwise keep whatever was already in the DB
      const existingImgUrl = org?.technical_data?.field_image_url as string | null
      const newServerUrl   = setupImgUrl && !setupImgUrl.startsWith('blob:') ? setupImgUrl : null
      const finalImgUrl    = newServerUrl || existingImgUrl || null

      // Always write technical_data so we don't accidentally drop field_image_url
      patch.technical_data = {
        ...(org?.technical_data || {}),
        ...(finalImgUrl ? { field_image_url: finalImgUrl } : {}),
      }

      const res = await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        setSetupFieldModal(false)
        setSetupImgUrl(null)
        setSetupImgFile(null)
        await loadData()
        // Keep image view active after saving if any image exists
        if (finalImgUrl || sessionFieldImg) setMapView('image')
      }
    } catch {}
    setSavingField(false)
  }

  const handleSetupImgUpload = async (file: File) => {
    setSetupImgUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      // Use apiFetch to include Firebase auth token (plain fetch returns 401)
      const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        const url: string = data.url  // GCS URL or /uploads/<filename> local fallback

        setSetupImgUrl(url)
        setSessionFieldImg(url)
        setMapView('image')

        // Persist immediately to DB — navigation away won't lose the image
        await apiFetch('/api/organizations', {
          method: 'PATCH',
          body: JSON.stringify({
            technical_data: {
              ...(org?.technical_data || {}),
              field_image_url: url,
            },
          }),
        })
        // Refresh org state so fieldImg is up-to-date
        const orgRes = await apiFetch('/api/organizations')
        if (orgRes.ok) {
          const { organization } = await orgRes.json()
          setOrg(organization)
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        console.warn('[upload] Image upload failed:', res.status, errData.error || res.statusText)
      }
    } catch (e) {
      console.warn('[upload] Image upload error', e)
    }
    setSetupImgUploading(false)
  }

  // Called from the modal when a file is selected — immediately shows local preview
  const handleFileSelected = (file: File) => {
    const blobUrl = URL.createObjectURL(file)
    setSetupImgFile(file)
    setSetupImgUrl(blobUrl)           // temp URL visible in the modal preview
    setSessionFieldImg(blobUrl)       // enables the toggle on the main panel NOW
    setMapView('image')               // switch to image view immediately
    handleSetupImgUpload(file)        // upload in background and replace with server URL
  }

  const handleDeleteFieldImage = async () => {
    try {
      await apiFetch('/api/organizations', {
        method: 'PATCH',
        body: JSON.stringify({
          technical_data: {
            ...(org?.technical_data || {}),
            field_image_url: null,
          },
        }),
      })
      setSessionFieldImg(null)
      setSetupImgUrl(null)
      setSetupImgFile(null)
      setMapView('satellite')
      const orgRes = await apiFetch('/api/organizations')
      if (orgRes.ok) {
        const { organization } = await orgRes.json()
        setOrg(organization)
      }
    } catch (e) {
      console.warn('[delete-image]', e)
    }
  }

  const openSetupModal = () => {
    setSetupFieldArea(org?.total_area_ha || '')
    setSetupFieldName(org?.name || '')
    setSetupFieldLocation(org?.location_label || '')
    // Pre-load the existing server URL so the modal shows the current photo
    const existingImgUrl = org?.technical_data?.field_image_url as string | null
    setSetupImgUrl(existingImgUrl || null)
    setSetupImgFile(null)
    setSetupFieldModal(true)
  }

  const avgNdvi = Object.values(ndviData).length > 0
    ? Object.values(ndviData).reduce((sum, d) => sum + d.averageNdvi, 0) / Object.values(ndviData).length
    : null

  // Field image from org — auto-switch to image view when available
  const fieldImg = org?.technical_data?.field_image_url as string | null
  const effectiveFieldImg = fieldImg || sessionFieldImg

  useEffect(() => {
    // Auto-switch to image view whenever a field photo becomes available
    if ((fieldImg || sessionFieldImg) && mapView === 'satellite') {
      setMapView('image')
    }
  }, [fieldImg, sessionFieldImg]) // react whenever org loads or session image changes

  return (
    <div className="flex flex-col md:flex-row md:h-full md:overflow-hidden bg-gray-100 md:p-4 md:gap-4">
      <OnboardingTour
        tourId="tour-potreros-v1"
        steps={[
          {
            target: '.tour-mapa-potreros',
            title: 'Mapa Interactivo',
            content: 'Aquí puedes visualizar tu campo, alternar a vista satelital y usar las herramientas para dibujar potreros.',
            placement: 'left'
          },
          {
            target: '.tour-lista-potreros',
            title: 'Panel de Control',
            content: 'Gestiona la información técnica, carga archivos KML con tus linderos y visualiza índices NDVI.',
            placement: 'right'
          }
        ]}
      />

      {/* ── Map panel — mobile sticky top, desktop right 65% ────────────────── */}
      <div className="tour-mapa-potreros order-1 md:order-2 w-full md:w-[65%] flex flex-col h-[70vw] max-h-[420px] md:h-full md:max-h-none rounded-none md:rounded-2xl overflow-hidden shadow-none md:shadow-md border-0 md:border md:border-gray-200 relative min-h-[260px] sticky top-0 z-[400] md:static md:z-auto">

        {/* View toggle — always visible when fieldImg exists OR always available as overlay */}
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
            disabled={!effectiveFieldImg}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all border-b-2 ${
              mapView === 'image' && effectiveFieldImg
                ? 'text-green-700 border-green-600 bg-green-50/50'
                : effectiveFieldImg
                  ? 'text-gray-400 border-transparent hover:text-gray-600'
                  : 'text-gray-200 border-transparent cursor-not-allowed'
            }`}
            title={!effectiveFieldImg ? 'Subí una foto del campo para ver esta vista' : undefined}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {effectiveFieldImg ? 'Imagen cargada' : 'Sin imagen'}
          </button>
        </div>

        {/* Content: satellite map or uploaded image */}
        {mapView === 'image' && effectiveFieldImg ? (
        <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveFieldImg}
              alt="Imagen del campo"
              className="max-w-full max-h-full object-contain"
            />
            {/* Delete image button */}
            <button
              onClick={handleDeleteFieldImage}
              className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-red-600/80 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all backdrop-blur-sm"
              title="Eliminar imagen del campo"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Eliminar imagen
            </button>
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
                  const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
                  toast.error(`No se pudo eliminar el potrero: ${errData.error}`)
                } else {
                  toast.success('Potrero eliminado')
                  // Recalculate total ha excluding deleted paddock
                  const remaining = paddocks.filter(p => p.id !== id)
                  const newTotal = remaining.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0)
                  try {
                    await apiFetch('/api/organizations', {
                      method: 'PATCH',
                      body: JSON.stringify({ total_area_ha: parseFloat(newTotal.toFixed(2)) }),
                    })
                  } catch {}
                  loadData()
                }
              } catch (err: any) {
                toast.error(`No se pudo eliminar: ${err.message}`)
              }
            }}
            activeGrazingPlans={activeGrazingPlans}
            drawModeActive={drawModeActive}
            onDrawModeChange={setDrawModeActive}
            fieldBoundaryDrawMode={fieldBoundaryDrawMode}
            onFieldBoundaryDrawn={handleFieldBoundaryDrawn}
            onFieldBoundaryDrawModeChange={setFieldBoundaryDrawMode}
            onFieldBoundaryEdited={handleFieldBoundaryEdited}
            initialCenter={
              mapCenter
                ?? (org?.location?.coordinates
                  ? [org.location.coordinates[1], org.location.coordinates[0]] as [number, number]
                  : undefined)
            }
            kmlFeatures={kmlFeatures}
            kmlAcceptedIndices={kmlAccepted}
            onKmlPolygonClick={(idx, feat) => {
              setMapView('satellite')
              setKmlModalFeature({ feat, idx })
            }}
          />
        )}

        {/* FAB: Nuevo potrero — solo en vista satelital y modo normal */}
        {mapView === 'satellite' && !fieldBoundaryDrawMode && (
          <div className="absolute bottom-5 right-5 z-[1000] flex flex-col items-end gap-2">
            {drawModeActive && (
              <button
                onClick={() => { setDrawModeActive(false); setPendingAssignPaddockId(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-xs font-black rounded-xl shadow-lg hover:bg-red-600 transition-all animate-pulse"
              >
                <X className="w-3.5 h-3.5" /> {pendingAssignPaddockId ? 'Cancelar asignación' : 'Cancelar dibujo'}
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

      {/* ── Side Panel — mobile scrolls below map, desktop left 35% ─────────── */}
      <div className="tour-lista-potreros order-2 md:order-1 w-full md:w-[35%] md:shrink-0 flex flex-col md:overflow-hidden px-3 pb-4 pt-3 md:p-0 gap-3">
        {/* Banner de datos sin conexión */}
        {isOfflineData && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 mx-0 md:mx-1 mt-1 md:mt-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <p className="text-[10px] font-bold">Datos sin conexión · Mostrando última versión guardada</p>
          </div>
        )}
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
          onSetupField={openSetupModal}
          onFieldImageUploaded={(url) => { setMapView('image') }}
          onManualPaddockCreate={openManualCreation}
          onAssignPolygon={handleAssignPolygon}
          onEditPolygon={handleEditPolygon}
          defaultEditPaddockId={editPaddockId || undefined}
          returnTo={returnTo || undefined}
          onDeletePaddock={async (id) => {
            try {
              const res = await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
                toast.error(`No se pudo eliminar el potrero: ${errData.error}`)
              } else {
                toast.success('Potrero eliminado')
                // Recalculate total ha excluding deleted paddock
                const remaining = paddocks.filter(p => p.id !== id)
                const newTotal = remaining.reduce((sum: number, p: any) => sum + (Number(p.area_ha) || 0), 0)
                try {
                  await apiFetch('/api/organizations', {
                    method: 'PATCH',
                    body: JSON.stringify({ total_area_ha: parseFloat(newTotal.toFixed(2)) }),
                  })
                } catch {}
                loadData()
              }
            } catch (err: any) {
              toast.error(`No se pudo eliminar: ${err.message}`)
            }
          }}
          onDeleteField={async () => {
            const ok = await confirm({
              title: '¿Eliminar los límites del campo?',
              description: 'Podés volver a configurarlo cuando quieras desde esta sección.',
              confirmLabel: 'Sí, eliminar',
              variant: 'danger',
            })
            if (ok) {
              await apiFetch('/api/organizations', {
                method: 'PATCH',
                body: JSON.stringify({ boundaries: null, total_area_ha: null }),
              })
              toast.success('Límites del campo eliminados')
              loadData()
            }
          }}
          onDataRefresh={loadData}
          herds={herds}
          planningDefaults={planningDefaults}
          onKmlFeaturesLoaded={(features) => {
            setKmlFeatures(features)
            setKmlAccepted(new Set())
            setMapView('satellite') // switch to map so polygons are visible
            toast.info(`${features.length} polígono${features.length !== 1 ? 's' : ''} importado${features.length !== 1 ? 's' : ''}. Hacé click en un polígono del mapa para asignarlo.`, { duration: 6000 })
          }}
        />
      </div>

      {/* ── Unified Creation Modal ────────────────────────────────────── */}
      {creationModal && (
        <PaddockModal
          isCreating
          paddock={DRAFT_PADDOCK('', creationAreaHa)}
          onClose={() => setCreationModal(false)}
          onSave={handleCreatePaddock}
        />
      )}

      {/* ── KML polygon action modal ─────────────────────────────────── */}
      {kmlModalFeature && (
        <KmlPolygonActionModal
          feature={kmlModalFeature.feat}
          idx={kmlModalFeature.idx}
          existingPaddocks={paddocks}
          onClose={() => setKmlModalFeature(null)}
          onCreated={() => {
            setKmlAccepted(prev => new Set([...prev, kmlModalFeature.idx]))
            setKmlModalFeature(null)
            loadData()
          }}
          onAssigned={() => {
            setKmlAccepted(prev => new Set([...prev, kmlModalFeature.idx]))
            setKmlModalFeature(null)
            loadData()
          }}
        />
      )}

      {/* ── Field Setup Modal (expandido) ──────────────────────────────────── */}
      {setupFieldModal && (
        <FieldSetupModalInline
          fieldImg={fieldImg}
          setupFieldName={setupFieldName}
          setSetupFieldName={setSetupFieldName}
          setupFieldLocation={setupFieldLocation}
          setSetupFieldLocation={setSetupFieldLocation}
          setupFieldArea={setupFieldArea}
          setSetupFieldArea={setSetupFieldArea}
          setupImgUrl={setupImgUrl}
          setupImgFile={setupImgFile}
          setupImgRef={setupImgRef}
          setupImgUploading={setupImgUploading}
          onFileSelected={handleFileSelected}
          savingField={savingField}
          onClose={() => setSetupFieldModal(false)}
          onSave={handleSetupField}
          onDrawBoundary={() => { setSetupFieldModal(false); setFieldBoundaryDrawMode(true) }}
          onLocationSelected={(lat, lon) => { setMapCenter([lat, lon]); setMapView('satellite') }}
        />
      )}
      <ConfirmModal />
    </div>
  )
}

// ── KmlPolygonActionModal ────────────────────────────────────────────────────────────
function KmlPolygonActionModal({
  feature, idx, existingPaddocks, onClose, onCreated, onAssigned,
}: {
  feature: ParsedKmlFeature
  idx: number
  existingPaddocks: any[]
  onClose: () => void
  onCreated: () => void
  onAssigned: () => void
}) {
  const [mode, setMode] = useState<'choose' | 'create' | 'assign'>('choose')
  const [name, setName] = useState(feature.name || '')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = existingPaddocks.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/paddocks', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          area_ha: feature.area_ha,
          boundary: feature.geojson,
          current_status: 'RESTING',
        }),
      })
      if (res.ok) {
        toast.success(`Potrero "${name.trim()}" creado`)
        onCreated()
      } else {
        toast.error('Error al crear el potrero')
      }
    } catch { toast.error('Error al crear el potrero') }
    setSaving(false)
  }

  const handleAssign = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/paddocks/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          geojson: feature.geojson,
          area_ha: feature.area_ha,
        }),
      })
      if (res.ok) {
        const p = existingPaddocks.find(p => p.id === selectedId)
        toast.success(`Polígono asignado a "${p?.name || 'potrero'}"`)
        onAssigned()
      } else {
        toast.error('Error al asignar el polígono')
      }
    } catch { toast.error('Error al asignar el polígono') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900">Polígono KML</h3>
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
              <button
                onClick={() => setMode('create')}
                className="w-full flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all text-left"
              >
                <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Agregar como nuevo potrero</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Crea un potrero con los límites de este polígono</p>
                </div>
              </button>
              <button
                onClick={() => setMode('assign')}
                className="w-full flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left"
              >
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Link2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Asignar a potrero existente</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Usa este polígono como límite de un potrero ya creado</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-3">
              <button onClick={() => setMode('choose')} className="text-[10px] text-gray-400 hover:text-gray-600 font-bold">← Volver</button>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Nombre del potrero</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Lote Norte"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                  autoFocus
                />
              </div>
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-cyan-700">Área calculada</span>
                <span className="text-sm font-black text-cyan-900">{feature.area_ha.toFixed(2)} ha</span>
              </div>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || saving}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-black rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Check className="w-4 h-4" /> Crear potrero</>}
              </button>
            </div>
          )}

          {mode === 'assign' && (
            <div className="space-y-3">
              <button onClick={() => setMode('choose')} className="text-[10px] text-gray-400 hover:text-gray-600 font-bold">← Volver</button>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Buscar potrero existente</label>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      selectedId === p.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {p.name} <span className={`text-[10px] ${selectedId === p.id ? 'text-blue-200' : 'text-gray-400'}`}>{Number(p.area_ha || 0).toFixed(1)} ha</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-[11px] text-gray-400 text-center py-4">No se encontraron potreros</p>
                )}
              </div>
              {selectedId && (
                <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 font-medium">Se reemplazará el polígono actual del potrero seleccionado.</p>
                </div>
              )}
              <button
                onClick={handleAssign}
                disabled={!selectedId || saving}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Asignando...</> : <><Check className="w-4 h-4" /> Asignar polígono</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FieldSetupModalInline ────────────────────────────────────────────────────────────
// Extraído para mantener MiCampoPage limpio.
// Usa Nominatim (igual que onboarding Step1Field) para autocomplete de ubicación.
function FieldSetupModalInline({
  fieldImg,
  setupFieldName, setSetupFieldName,
  setupFieldLocation, setSetupFieldLocation,
  setupFieldArea, setSetupFieldArea,
  setupImgUrl, setupImgFile,
  setupImgRef, setupImgUploading, onFileSelected,
  savingField, onClose, onSave, onDrawBoundary,
  onLocationSelected,
}: {
  fieldImg: string | null
  setupFieldName: string; setSetupFieldName: (v: string) => void
  setupFieldLocation: string; setSetupFieldLocation: (v: string) => void
  setupFieldArea: number | ''; setSetupFieldArea: (v: number | '') => void
  setupImgUrl: string | null; setupImgFile: File | null
  setupImgRef: React.RefObject<HTMLInputElement | null>
  setupImgUploading: boolean; onFileSelected: (f: File) => void
  savingField: boolean; onClose: () => void; onSave: () => void; onDrawBoundary: () => void
  onLocationSelected?: (lat: number, lon: number) => void
}) {
  const [locationSuggs, setLocationSuggs] = useState<any[]>([])
  const [showSuggs, setShowSuggs]         = useState(false)
  const [locSearching, setLocSearching]   = useState(false)
  const [showPhotoWarning, setShowPhotoWarning] = useState(!!(setupImgUrl || fieldImg))
  const locationContainerRef              = useRef<HTMLDivElement>(null)
  const locationInputRef                  = useRef<HTMLInputElement>(null)
  const [locDropPos, setLocDropPos]       = useState<{ top: number; left: number; width: number } | null>(null)

  // Close suggestions on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (locationContainerRef.current && !locationContainerRef.current.contains(e.target as Node)) {
        setShowSuggs(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Update dropdown position when showing
  const updateLocPos = useCallback(() => {
    if (locationInputRef.current) {
      const r = locationInputRef.current.getBoundingClientRect()
      setLocDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  // Nominatim autocomplete con debounce 500ms — idéntico al onboarding Step1Field
  useEffect(() => {
    if (setupFieldLocation.length < 3) { setLocationSuggs([]); setShowSuggs(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(setupFieldLocation)}&limit=5`
        )
        setLocationSuggs(await res.json())
        setShowSuggs(true)
        updateLocPos()   // ensure portal position is fresh
      } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [setupFieldLocation, updateLocPos])


  const selectSuggestion = (s: any) => {
    setSetupFieldLocation(s.display_name)
    setLocationSuggs([])
    setShowSuggs(false)
    // Geolocalize map to selected suggestion
    const lat = parseFloat(s.lat), lon = parseFloat(s.lon)
    if (!isNaN(lat) && !isNaN(lon)) onLocationSelected?.(lat, lon)
  }

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setupFieldLocation) return
    setLocSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(setupFieldLocation)}&limit=1`
      )
      const r = await res.json()
      if (r?.length > 0) selectSuggestion(r[0])
    } catch {} finally { setLocSearching(false) }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setShowPhotoWarning(true)
    onFileSelected(f)   // parent handles blob URL creation, state updates and upload
    e.target.value = ''
  }

  const currentImg = setupImgUrl || fieldImg

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-black text-gray-900">Configurar campo</h3>
            <p className="text-xs text-gray-400 mt-0.5">Editá el nombre, ubicación, superficie e imagen</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Nombre del campo */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-widest">
              <Building2 className="w-3.5 h-3.5" /> Nombre del campo
            </label>
            <input type="text" value={setupFieldName}
              onChange={e => setSetupFieldName(e.target.value)}
              placeholder="Ej: La Esperanza"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all placeholder:font-normal placeholder:text-gray-300"
            />
          </div>

          {/* Ubicación con Nominatim autocomplete */}
          <div className="space-y-1.5" ref={locationContainerRef}>
            <label className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-widest">
              <MapPin className="w-3.5 h-3.5" /> Ubicación
            </label>
            <form onSubmit={handleSearchLocation} className="relative">
              <input
                ref={locationInputRef}
                type="text" value={setupFieldLocation}
                onChange={e => setSetupFieldLocation(e.target.value)}
                onFocus={() => { locationSuggs.length > 0 && setShowSuggs(true); updateLocPos() }}
                onClick={() => { if (showSuggs) setShowSuggs(false) }}
                onBlur={() => setTimeout(() => setShowSuggs(false), 200)}
                placeholder="Ciudad, provincia o país..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-11 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all placeholder:font-normal placeholder:text-gray-300"
              />
              <button type="submit" disabled={locSearching}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${setupFieldLocation ? 'bg-green-600 text-white' : 'text-gray-300'}`}>
                {locSearching ? <Spin className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </form>
            {/* Portal dropdown — escapes overflow clipping of the modal scroll container */}
            {showSuggs && locationSuggs.length > 0 && locDropPos && typeof document !== 'undefined' && createPortal(
              <div
                style={{ position: 'fixed', top: locDropPos.top, left: locDropPos.left, width: locDropPos.width, zIndex: 99999 }}
                className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
              >
                {locationSuggs.map((s: any, i: number) => (
                  <button key={i}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-2.5 text-xs font-normal text-gray-600 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    {s.display_name}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Hectáreas */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-widest">
              Hectáreas totales
            </label>
            <input type="number" value={setupFieldArea}
              onChange={e => setSetupFieldArea(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej: 1245"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all placeholder:font-normal placeholder:text-gray-300"
            />
          </div>

          {/* Imagen del campo */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-black text-gray-500 uppercase tracking-widest">
              <ImageIcon className="w-3.5 h-3.5" /> Imagen del campo
            </label>

            {currentImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentImg} alt="Vista previa"
                className="w-full h-36 object-cover rounded-xl border border-gray-200" />
            )}

            {/* Nombre del archivo seleccionado */}
            {setupImgFile && !setupImgUploading && (
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg">
                <ImageIcon className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <p className="text-xs font-semibold text-violet-700 truncate">{setupImgFile.name}</p>
                <span className="text-[10px] text-violet-400 shrink-0 uppercase font-bold">{setupImgFile.name.split('.').pop()}</span>
              </div>
            )}

            <button type="button" onClick={() => setupImgRef.current?.click()}
              disabled={setupImgUploading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 disabled:opacity-50 transition-all">
              {setupImgUploading
                ? <><Spin className="w-4 h-4 animate-spin" /> Subiendo...</>
                : <><ImageIcon className="w-4 h-4" /> {currentImg ? 'Cambiar imagen' : 'Subir foto del campo'}</>
              }
            </button>
            <input ref={setupImgRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {/* ⚠ Warning de limitaciones al usar foto */}
            {showPhotoWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Importante: módulos no disponibles con foto
                </div>
                <p className="text-[11px] text-amber-600 leading-snug">
                  Al usar una imagen propia en lugar del mapa satelital, los siguientes módulos <strong>quedan deshabilitados</strong>:
                </p>
                <ul className="text-[11px] text-amber-600 space-y-0.5 pl-3 list-disc">
                  <li>Índice NDVI satelital (análisis de vegetación)</li>
                  <li>Datos climáticos en tiempo real</li>
                  <li>Módulo de Carbono y captura de CO₂</li>
                </ul>
                <p className="text-[10px] text-amber-500 mt-1">Podés volver al mapa satelital en cualquier momento usando las pestañas superiores.</p>
              </div>
            )}

            {!showPhotoWarning && currentImg && (
              <p className="text-[10px] text-gray-400 text-center">
                Imagen actual del campo. Podés cambiarla o volver al mapa satelital con las pestañas.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="px-2 bg-white text-xs text-gray-400">o dibujá el límite</span></div>
          </div>

          <button type="button" onClick={onDrawBoundary}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all">
            <Plus className="w-4 h-4" /> Dibujar límite del campo en el mapa
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
            Cancelar
          </button>
          <button onClick={onSave} disabled={savingField || setupImgUploading}
            className="flex-1 px-5 py-2.5 text-sm font-black text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-green-200">
            {savingField ? <Spin className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
