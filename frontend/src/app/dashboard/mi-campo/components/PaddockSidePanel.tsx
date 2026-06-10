'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Droplets, Leaf, ShieldAlert, Satellite, Loader2, Plus, BarChart3, BookOpen, AlertTriangle, Map, Trash2, PenLine, Upload, Image as ImageIcon, Waves, TreeDeciduous, Info } from 'lucide-react'
import { SatelliteData } from '@/lib/services/satellite'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from '@/components/AuthProvider'
import { usePlan } from '@/hooks/usePlan'
import { useConfirm } from '@/components/ui/ConfirmModal'
import BitacoraModal from '../../bitacora/components/BitacoraModal'
import PaddockModal from './PaddockModal'
import WeatherConditionChip from '@/components/WeatherConditionChip'
import { useClimateAnalytics } from '@/lib/context/ClimateAnalyticsContext'
import { parseKmlFile } from '@/lib/kmlParser'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

interface Paddock {
  id: string
  name: string
  area_ha: number
  current_status: string
  is_active: boolean
  current_ndvi?: number
  dry_matter_kg_ha?: number
  estimated_adh?: number
  technical_data?: {
    hasWater?: boolean
    waterType?: string
    hasInfraIssues?: boolean
    hasPests?: boolean
    weeds?: string[]
    hasPredators?: boolean
    quality_score?: number
    [key: string]: any
  }
}

interface Props {
  paddocks: Paddock[]
  org: any
  user?: any
  loading: boolean
  selectedPaddockId: string | null
  onSelectPaddock: (id: string) => void
  onSaveTechnicalData: (id: string, data: Record<string, any>, dryMatter?: number) => void
  ndviData: Record<string, SatelliteData>
  ndviLoading: boolean
  avgNdvi: number | null
  herds?: any[]
  totalEV?: number
  onSetupField?: () => void
  onManualPaddockCreate?: () => void
  onDeletePaddock?: (paddockId: string) => void
  onDeleteField?: () => void
  onDataRefresh?: () => void
  onFieldImageUploaded?: (url: string) => void
  onAssignPolygon?: (paddockId: string) => void
  onEditPolygon?: (paddockId: string) => void
  defaultEditPaddockId?: string
  returnTo?: string
  planningDefaults?: { dailyAllocationKg: number; targetRemnantKgHa: number }
  /** Called when KML is parsed — features are shown on the map interactively */
  onKmlFeaturesLoaded?: (features: ParsedKmlFeature[]) => void
  activeGrazingPlans?: any[]
}

// Badges de estado — semántica estricta
// Alertas críticas: color activo cuando isOn=true, ocultos cuando isOn=false
// Informativos: gris sutil siempre, solo se muestran si isOn=true
const TECH_ICONS = [
  {
    key: 'hasWater',
    Icon: Droplets,
    label: 'Agua',
    activeClass: 'bg-blue-50 text-blue-600 border border-blue-200',
    inactiveClass: 'bg-gray-50 text-gray-300 border border-gray-100',
  },
  {
    key: 'hasPredators',
    Icon: ShieldAlert,
    label: 'Depredadores',
    activeClass: 'bg-red-50 text-red-600 border border-red-200',
    inactiveClass: 'bg-gray-50 text-gray-300 border border-gray-100',
  },
  {
    key: 'hasPests',
    Icon: Leaf,
    label: 'Maleza',
    activeClass: 'bg-amber-50 text-amber-600 border border-amber-200',
    inactiveClass: 'bg-gray-50 text-gray-300 border border-gray-100',
  },
  {
    key: 'has_shade',
    Icon: TreeDeciduous,
    label: 'Sombra',
    activeClass: 'bg-green-50 text-green-600 border border-green-200',
    inactiveClass: 'bg-gray-50 text-gray-300 border border-gray-100',
  },
  {
    key: 'has_water_risk',
    Icon: Waves,
    label: 'R.Hídrico',
    activeClass: 'bg-sky-50 text-sky-600 border border-sky-200',
    inactiveClass: 'bg-gray-50 text-gray-300 border border-gray-100',
  },
]

const getNdviLabel = (ndvi: number) => {
  if (ndvi >= 0.6) return { label: 'Óptimo',  color: 'text-green-700 bg-green-100' }
  if (ndvi >= 0.4) return { label: 'Bueno',   color: 'text-lime-700 bg-lime-100' }
  if (ndvi >= 0.2) return { label: 'Regular', color: 'text-yellow-700 bg-yellow-100' }
  return             { label: 'Bajo',    color: 'text-red-700 bg-red-100' }
}

export default function PaddockSidePanel({
  paddocks, org, loading, selectedPaddockId, onSelectPaddock, onSaveTechnicalData,
  ndviData, ndviLoading, avgNdvi, herds = [], totalEV = 0,
  onSetupField, onManualPaddockCreate, onDeletePaddock, onDeleteField, onDataRefresh,
  onFieldImageUploaded, onAssignPolygon, onEditPolygon, defaultEditPaddockId, returnTo, planningDefaults,
  onKmlFeaturesLoaded, activeGrazingPlans = [],
}: Props) {
  const [search, setSearch]     = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [bitacoraModalOpen, setBitacoraModalOpen] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const { hasFeature } = usePlan()
  const { latestByPaddock } = useClimateAnalytics()
  const { confirm, ConfirmModal } = useConfirm()
  const canNdvi = hasFeature('ndvi_access')
  const [editingPaddock, setEditingPaddock] = useState<Paddock | null>(null)
  const [paddockNotes, setPaddockNotes]     = useState<any[]>([])
  const [notesLoading, setNotesLoading]     = useState(false)
  // Local optimistic is_active map so toggle feels instant
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({})

  // Sync activeMap when paddocks data changes
  useEffect(() => {
    const map: Record<string, boolean> = {}
    paddocks.forEach(p => { map[p.id] = p.is_active ?? true })
    setActiveMap(map)
  }, [paddocks])

  // Deep-link: auto-open edit modal when defaultEditPaddockId is provided
  // (effect placed after openModal to avoid closure ordering issues)

  const toggleDisable = async (e: React.MouseEvent, paddockId: string) => {
    e.stopPropagation()
    const next = !(activeMap[paddockId] ?? true)
    // Optimistic update only — no full reload to avoid skeleton flash
    setActiveMap(prev => ({ ...prev, [paddockId]: next }))
    await apiFetch(`/api/paddocks/${paddockId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: next }),
    })
    // Do NOT call onDataRefresh() here — would trigger full list skeleton
  }

  // KML import
  const kmlInputRef           = useRef<HTMLInputElement>(null)
  const [kmlImporting, setKmlImporting] = useState(false)
  const [kmlMessage, setKmlMessage]     = useState<string | null>(null)


  // ── Notes ──────────────────────────────────────────────────────────────────
  const loadPaddockNotes = useCallback(async (paddockId: string) => {
    setNotesLoading(true)
    setPaddockNotes([])
    const res = await apiFetch(`/api/field-notes?paddock_id=${paddockId}`)
    setPaddockNotes(res.ok ? (await res.json()).notes || [] : [])
    setNotesLoading(false)
  }, [])

  const openModal = (paddock: Paddock) => {
    setEditingPaddock(paddock)
    setModalOpen(true)
    loadPaddockNotes(paddock.id)
  }

  // Deep-link: auto-open edit modal when defaultEditPaddockId is provided
  const autoOpenDone = useRef(false)
  useEffect(() => {
    if (!defaultEditPaddockId || loading || paddocks.length === 0 || autoOpenDone.current) return
    const target = paddocks.find((p: Paddock) => p.id === defaultEditPaddockId)
    if (target) {
      autoOpenDone.current = true
      openModal(target)
    }
   
  }, [defaultEditPaddockId, paddocks, loading])

  const handleModalSave = async (
    paddockId: string,
    newName: string,
    technicalData: Record<string, any>,
    dryMatter?: number,
    areaHa?: number,
  ) => {
    const updates: Record<string, any> = { name: newName, technical_data: technicalData }
    if (dryMatter !== undefined) updates.dry_matter_kg_ha = dryMatter
    if (areaHa    !== undefined) updates.area_ha = areaHa
    await apiFetch(`/api/paddocks/${paddockId}`, { method: 'PATCH', body: JSON.stringify(updates) })
    await onSaveTechnicalData(paddockId, technicalData, dryMatter)

    // Recalculate total field area if the paddock area was edited
    if (areaHa !== undefined) {
      // Build the new total using the updated area for this paddock
      const newTotal = paddocks.reduce((sum, p) => {
        const ha = p.id === paddockId ? areaHa : Number(p.area_ha) || 0
        return sum + ha
      }, 0)
      // Only update if different from current org total
      if (Math.abs(newTotal - (Number(org?.total_area_ha) || 0)) > 0.01) {
        await apiFetch('/api/organizations', {
          method: 'PATCH',
          body: JSON.stringify({ total_area_ha: parseFloat(newTotal.toFixed(2)) }),
        })
      }
    }

    onDataRefresh?.()
  }

  // ── KML Import ─────────────────────────────────────────────────────────────
  const handleKmlImport = useCallback(async (file: File) => {
    setKmlImporting(true); setKmlMessage(null)
    const result = await parseKmlFile(file)
    setKmlImporting(false)
    if (result.error) {
      setKmlMessage(result.error)
      return
    }
    if (result.features.length === 0) {
      setKmlMessage('No se encontraron polígonos en el KML.')
      return
    }
    setKmlMessage(`${result.features.length} polígono${result.features.length !== 1 ? 's' : ''} cargado${result.features.length !== 1 ? 's' : ''}. Hacé click en el mapa para asignarlos.`)
    onKmlFeaturesLoaded?.(result.features)
  }, [onKmlFeaturesLoaded])



  // ── Computed ───────────────────────────────────────────────────────────────
  const filtered      = paddocks.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
  const totalArea     = paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const grazingCount  = paddocks.filter(p => p.current_status === 'GRAZING').length
  const hasFieldSetup = Boolean(org?.boundaries || org?.total_area_ha > 0)

  // Average quality score across paddocks that have it
  const qualityPaddocks = paddocks.filter(p => p.technical_data?.quality_score != null)
  const avgQuality = qualityPaddocks.length > 0
    ? Math.round(qualityPaddocks.reduce((s, p) => s + (p.technical_data!.quality_score || 0), 0) / qualityPaddocks.length)
    : null

  const qualityBadgeColor = avgQuality
    ? avgQuality >= 7 ? 'bg-green-100 text-green-800 border-green-200'
    : avgQuality >= 4 ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-red-100 text-red-800 border-red-200'
    : ''

  return (
    <>
      <div className="flex flex-col md:h-full bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-start gap-3 relative overflow-hidden">
            
            {/* Thumbnail del campo */}
            {hasFieldSetup ? (
              org?.technical_data?.field_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.technical_data.field_image_url} alt="Campo" className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-green-600 flex items-center justify-center shrink-0">
                  <Map className="w-6 h-6 text-white" />
                </div>
              )
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                <Map className="w-6 h-6 text-gray-400" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-1">Mi Campo</p>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-2xl font-black text-gray-950 tracking-tight truncate" title={org?.name || 'Mi Campo'}>
                  {org?.name || 'Mi Campo'}
                </h2>
                {ndviLoading && <Loader2 className="w-3.5 h-3.5 text-green-500 animate-spin" />}
              </div>
              
              {org?.location_label && (
                <p className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />{org.location_label}
                </p>
              )}

              {hasFieldSetup ? (
                <>
                  <p className="text-xl font-black text-gray-900 leading-none">
                    {Number(org.total_area_ha || totalArea || 0).toFixed(0)} ha
                    <span className="text-sm font-bold text-gray-500 ml-1.5">· {paddocks.length} potreros</span>
                  </p>
                  {/* Ha de potreros — siempre visible si existen */}
                  {totalArea > 0 && (
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      Ha potreros: <span className="font-bold text-gray-600">{totalArea.toFixed(1)} ha</span>
                    </p>
                  )}
                  {grazingCount > 0 && (
                    <p className="text-xs text-orange-600 font-bold mt-1.5">{grazingCount} en pastoreo</p>
                  )}
                  {/* NDVI — solo visible con plan ndvi_access */}
                  {canNdvi && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <p className="text-[10px] text-gray-500 font-medium">
                        NDVI: <span className="font-bold text-gray-700">{avgNdvi != null ? avgNdvi.toFixed(3) : '—'}</span>
                        {avgNdvi != null && (
                          <span className="ml-1 text-gray-400">· {getNdviLabel(avgNdvi).label}</span>
                        )}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-500">No hay configuración espacial registrada.</p>
                  {onSetupField && (
                    <button
                      onClick={onSetupField}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-all"
                    >
                      <Map className="w-3.5 h-3.5" /> Configurar campo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Acciones del campo */}
            <div className="flex flex-col gap-1.5 shrink-0">

              {hasFieldSetup && onSetupField && (
                <button
                  onClick={onSetupField}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 bg-white hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 shadow-sm"
                  title="Editar campo"
                >
                  <PenLine className="w-4 h-4" />
                </button>
              )}
              {hasFieldSetup && onDeleteField && (
                <button
                  onClick={onDeleteField}
                  className="w-8 h-8 flex items-center justify-center text-red-500 bg-white hover:bg-red-50 rounded-xl transition-colors border border-red-200 shadow-sm"
                  title="Eliminar campo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>
          
        </div>

        {/* ── Paddock list ─────────────────────────────────────────────────── */}
        <div className="md:flex-1 md:overflow-y-auto">
          <div className="px-5 py-2.5 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-50 z-10">
            <p className="text-xs font-black text-gray-600 tracking-widest uppercase">Potreros ({paddocks.length})</p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => onManualPaddockCreate?.()} className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-green-700 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-all">
                <Plus className="w-3 h-3" /> Manual
              </button>
              <button
                onClick={() => kmlInputRef.current?.click()}
                disabled={kmlImporting}
                className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-all"
                title="Importar potreros desde KML"
              >
                {kmlImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} KML
              </button>
              <input ref={kmlInputRef} type="file" accept=".kml" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleKmlImport(f); e.target.value = '' }} />
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300" />
                <input type="text" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-gray-50 border border-gray-100 rounded-lg pl-6 pr-2 py-1 text-[10px] text-gray-700 placeholder:text-gray-300 focus:ring-1 focus:ring-green-500 outline-none w-24" />
              </div>
            </div>
          </div>

          {/* KML feedback */}
          {kmlMessage && (
            <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 font-medium flex items-center justify-between">
              {kmlMessage}
              <button onClick={() => setKmlMessage(null)} className="text-indigo-400 hover:text-indigo-700 ml-2">×</button>
            </div>
          )}

          <div className="p-3 space-y-1.5">
            {loading ? (
              <div className="space-y-2 pt-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <MapPin className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-400">Sin potreros registrados</p>
                <p className="text-[10px] text-gray-300 mt-1">Dibujá un polígono en el mapa o importá un KML</p>
              </div>
            ) : (
            filtered.map((paddock) => {
                const isActive   = activeMap[paddock.id] ?? true
                const isSelected = paddock.id === selectedPaddockId
                const sat        = ndviData[paddock.id]
                const ndviVal    = sat?.averageNdvi ?? paddock.current_ndvi
                const td         = (paddock.technical_data || {}) as Record<string, any>
                // MS: SOLO del dato ingresado por el usuario (no NDVI)
                const ms         = Number(paddock.dry_matter_kg_ha) || 0
                const totalMsCard = ms > 0 && paddock.area_ha ? Math.round(ms * Number(paddock.area_ha)) : null
                const rankDisplay = (paddock.technical_data as any)?.quality_score != null ? Math.min(10, Math.max(1, Math.round((paddock.technical_data as any)?.quality_score))) : undefined
                const forageQuality = (paddock.technical_data as any)?.forage_quality as number | undefined
                const climateSnap = latestByPaddock.get(paddock.id)
                const realGrowthRate = climateSnap ? Number(climateSnap.grass_growth_rate) : (paddock.dry_matter_kg_ha ? Number(paddock.dry_matter_kg_ha) * 0.012 : undefined)
                // Derive GRAZING status from herds currently assigned to this paddock
                const hasActiveHerd = herds.some((h: any) => h.current_paddock_id === paddock.id)
                const activePlanForPaddock = activeGrazingPlans.find((ap: any) => String(ap.paddock_id) === String(paddock.id))
                const isGrazing = hasActiveHerd || paddock.current_status === 'GRAZING' || !!activePlanForPaddock

                return (
                  <div
                    key={paddock.id}
                    className={`w-full rounded-2xl border transition-all cursor-pointer group ${
                      !isActive
                        ? 'bg-gray-50 border-gray-200 opacity-60 shadow-sm'
                        : isSelected
                          ? 'bg-white border-green-300 shadow-lg ring-1 ring-green-200'
                          : 'bg-white border-gray-200 shadow-md hover:shadow-lg hover:border-gray-300'
                    }`}
                    onClick={() => isActive && onSelectPaddock(paddock.id)}
                  >
                    {/* ══ ZONA 1: IDENTIDAD ══════════════════════════════ */}
                    <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-lg font-black leading-tight truncate ${
                            isActive ? 'text-gray-950' : 'text-gray-400'
                          }`}>
                            {paddock.name}
                          </h3>
                          {ms === 0 && (
                            <div className="group relative shrink-0 z-10">
                              <span title="Sin materia seca declarada no es posible planificar pastoreos en este potrero." className="flex items-center gap-0.5 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md cursor-help whitespace-nowrap">
                                <AlertTriangle className="w-2.5 h-2.5" />Sin MS
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                            {Number(paddock.area_ha || 0).toFixed(1)} ha
                          </span>
                          {activePlanForPaddock && (
                            <span className="text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 leading-none">
                              Pastando: {activePlanForPaddock.herd_name} ({activePlanForPaddock.head_count})
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Toggle ON/OFF con tooltip visible */}
                      <div className="relative group/toggle shrink-0">
                        <button
                          type="button"
                          onClick={e => toggleDisable(e, paddock.id)}
                          className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                            isActive ? 'bg-green-500 border-green-500' : 'bg-red-400 border-red-400'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            isActive ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                        {/* Tooltip custom */}
                        <div className="absolute right-0 top-7 w-48 bg-gray-900 text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg opacity-0 group-hover/toggle:opacity-100 pointer-events-none transition-opacity z-50 leading-tight">
                          {isActive
                            ? 'Potrero activo para planificación. Click para excluirlo del plan de pastoreo.'
                            : 'Potrero inactivo. Click para incluirlo en la planificación de pastoreo.'}
                          <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <>
                        {/* ══ ZONA 2: PRODUCCIÓN (MS) ═══════════════════ */}
                        {ms > 0 ? (
                          <div className="px-4 pb-3 flex items-stretch gap-4">
                            <div>
                              <p className="text-[8px] font-black text-gray-400 tracking-widest uppercase mb-0.5">MS/ha</p>
                              <div className="flex items-baseline gap-0.5">
                                <p className="text-2xl font-black tabular-nums leading-none text-gray-900">
                                  {ms.toLocaleString('es')}
                                </p>
                                <span className="text-[10px] font-bold text-gray-400">kg</span>
                              </div>
                            </div>
                            {totalMsCard != null && (
                              <>
                                <div className="w-px bg-gray-100 self-stretch" />
                                <div>
                                  <p className="text-[8px] font-black text-gray-400 tracking-widest uppercase mb-0.5">Total MS</p>
                                  <p className="text-base font-black text-gray-700 tabular-nums">
                                    {totalMsCard.toLocaleString('es')} <span className="font-medium text-gray-400 text-[10px]">kg</span>
                                  </p>
                                </div>
                              </>
                            )}
                            {/* Evaluación — Rank general (número) + Cal. pasto (estrellas) */}
                            {(rankDisplay != null || (forageQuality != null && forageQuality > 0)) && (
                              <>
                                <div className="w-px bg-gray-100 self-stretch ml-auto" />
                                <div className="flex flex-col justify-center gap-1">
                                  {rankDisplay != null && (
                                    <div className="flex items-center gap-1" title="Ranking general del potrero respecto al resto (1-10)">
                                      <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Ranking</span>
                                      <span className="text-[11px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full tabular-nums">{rankDisplay}/10</span>
                                    </div>
                                  )}
                                  {forageQuality != null && forageQuality > 0 && (
                                    <div className="flex items-center gap-0.5" title="Calidad del pasto (proteína y calidad forrajera, 1-5)">
                                      <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mr-0.5">Cal.</span>
                                      {[1,2,3,4,5].map(s => (
                                        <span key={s} className={`text-[10px] leading-none ${s <= forageQuality ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="px-4 pb-3">
                            <div className="bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-200 text-xs font-medium leading-tight flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                              <span>Para planificar pastoreos en este potrero debés declarar la Materia Seca disponible.</span>
                            </div>
                          </div>
                        )}

                        {/* ══ ZONA 3: CONTEXTO AMBIENTAL — pill compacta + drawer lateral */}
                        <div className="px-4 pb-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <WeatherConditionChip
                            mode="paddock"
                            entityName={paddock.name}
                            grassGrowthRate={realGrowthRate}
                            ndvi={ndviData[paddock.id]?.averageNdvi ?? paddock.current_ndvi}
                            customTrigger={({ onClick, cond }) => {
                              const ndviVal = ndviData[paddock.id]?.averageNdvi ?? paddock.current_ndvi
                              if (!cond) return (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-100 bg-gray-50">
                                  <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
                                  <span className="text-[9px] text-gray-300 font-bold">...</span>
                                </div>
                              )
                              return (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); onClick() }}
                                  title="Ver detalle climático del potrero"
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-100 bg-white hover:bg-gray-50 transition-all ${cond.text}`}
                                >
                                  <span className="[&>svg]:w-3 [&>svg]:h-3">{cond.icon}</span>
                                  {ndviVal != null && (
                                    <span className="text-[9px] font-bold text-gray-400">{Number(ndviVal).toFixed(2)}</span>
                                  )}
                                  <Info className="w-2.5 h-2.5 text-gray-300" />
                                </button>
                              )
                            }}
                          />
                        </div>

                         {/* ══ ZONA 4: INFRAESTRUCTURA + EDITAR ══════════ */}
                         <div className="border-t border-gray-100 px-4 py-3" onClick={e => e.stopPropagation()}>
                           {/* Chips: solo los activos */}
                           <div className="flex items-center flex-wrap gap-1.5 min-h-[20px] mb-2">
                               {TECH_ICONS.map(({ key, Icon, label, activeClass }) => {
                                 const isOn = key === 'hasPests'
                                   ? (td.hasPests || (td.weed_types?.length ?? 0) > 0)
                                   : key === 'hasWater'
                                   ? (td.hasWater || td.has_water_point)
                                   : key === 'hasPredators'
                                   ? (td.hasPredators || td.has_predators)
                                   : key === 'has_shade'
                                   ? (td.has_shade || td.hasShade)
                                   : key === 'has_water_risk'
                                   ? (td.has_water_risk || td.hasWaterRisk)
                                   : Boolean(td[key])
                                 if (!isOn) return null
                                 return (
                                   <div
                                     key={key}
                                     title={label}
                                     className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${activeClass}`}
                                   >
                                     <Icon className="w-2.5 h-2.5" />
                                     <span className="text-[8px] font-bold">{label}</span>
                                   </div>
                                 )
                               })}
                               {!TECH_ICONS.some(({ key }) => {
                                 if (key === 'hasPests') return td.hasPests || (td.weed_types?.length ?? 0) > 0
                                 if (key === 'hasWater') return td.hasWater || td.has_water_point
                                 if (key === 'hasPredators') return td.hasPredators || td.has_predators
                                 if (key === 'has_shade') return td.has_shade || td.hasShade
                                 if (key === 'has_water_risk') return td.has_water_risk || td.hasWaterRisk
                                 return Boolean(td[key])
                               }) && (
                                 <span className="text-[9px] text-gray-300 italic">Sin datos de infraestructura</span>
                               )}
                           </div>
                           {/* Botón Editar + Botón Borrar — fila propia, separado visualmente */}
                           <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-1 pb-1">
                             <button
                               type="button"
                               onClick={async (e) => {
                                 e.stopPropagation()
                                 const ok = await confirm({
                                   title: `¿Eliminar potrero "${paddock.name}"?`,
                                   description: 'Esta acción es irreversible. Se eliminará el polígono y todos los datos asociados.',
                                   confirmLabel: 'Sí, eliminar',
                                   variant: 'danger',
                                 })
                                 if (ok) onDeletePaddock?.(paddock.id)
                               }}
                               title="Eliminar potrero"
                               className="group/del flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                             >
                               <Trash2 className="w-3 h-3 text-gray-300 group-hover/del:text-red-500 transition-colors" />
                               Borrar
                             </button>
                             <button
                               type="button"
                               onClick={e => { e.stopPropagation(); openModal(paddock) }}
                               title="Editar potrero"
                               className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-all shadow-sm"
                             >
                               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                 <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                               </svg>
                               Editar
                             </button>
                           </div>
                         </div>
                       </>
                     )}

                     {!isActive && (
                       <div className="px-4 pb-3">
                         <p className="text-[10px] text-gray-300 italic">Potrero inhabilitado</p>
                       </div>
                     )}
                   </div>
                 )
               })
             )}

          </div>
        </div>

        {/* ── Footer — sin botón "Configurar campo" ────────────────────────── */}
        {paddocks.length > 0 && (
          <div className="px-5 py-3 pb-8 md:pb-3 border-t border-gray-100 shrink-0">
            <div className="flex justify-between items-end mb-1">
              <p className="text-[10px] text-gray-400 font-medium">
                {paddocks.filter(p => {
                  const d = p.technical_data || {}
                  return (d as any).hasWater !== undefined || (d as any).hasInfraIssues !== undefined
                }).length}/{paddocks.length} potreros con detalle técnico
              </p>
              <p className="text-[10px] text-gray-500 font-bold tabular-nums">
                {totalArea.toFixed(1)} ha total potreros
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-green-500 h-1 rounded-full transition-all"
                style={{ width: paddocks.length > 0 ? `${(paddocks.filter(p => { const d = p.technical_data || {}; return (d as any).hasWater !== undefined || (d as any).hasInfraIssues !== undefined }).length / paddocks.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Modal potrero ───────────────────────────────────────────────────── */}
      {modalOpen && editingPaddock && (
        <PaddockModal
          paddock={editingPaddock}
          ndviData={ndviData[editingPaddock.id]}
          onClose={() => { 
            setModalOpen(false)
            setEditingPaddock(null)
            if (returnTo) {
              router.push(returnTo)
            }
          }}
          onSave={handleModalSave}
          onDelete={onDeletePaddock}
          onAssignPolygon={onAssignPolygon}
          onEditPolygon={onEditPolygon}
          paddocks={paddocks}
          herds={herds}
          planningDefaults={planningDefaults}
          user={user}
        />
      )}

      {/* ── Bitácora ────────────────────────────────────────────────────────── */}
      <BitacoraModal
        isOpen={bitacoraModalOpen}
        onClose={() => setBitacoraModalOpen(false)}
        onSaved={() => { if (editingPaddock) loadPaddockNotes(editingPaddock.id) }}
        user={user}
        initialPaddockId={editingPaddock?.id}
        initialPaddockName={editingPaddock?.name}
        paddocks={paddocks}
      />
      <ConfirmModal />
    </>
  )
}
