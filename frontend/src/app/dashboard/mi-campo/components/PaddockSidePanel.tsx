'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Search, MapPin, Droplets, Wrench, Leaf, ShieldAlert, Satellite, Loader2, Plus, BarChart3, BookOpen, AlertTriangle, Map, Trash2, PenLine, Upload, Image as ImageIcon } from 'lucide-react'
import { SatelliteData } from '@/lib/services/satellite'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from '@/components/AuthProvider'
import { usePlan } from '@/hooks/usePlan'
import BitacoraModal from '../../bitacora/components/BitacoraModal'
import PaddockModal from './PaddockModal'
import { kml as kmlToGeo } from '@tmcw/togeojson'
import { area as turfArea } from '@turf/area'

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
  defaultEditPaddockId?: string
  planningDefaults?: { dailyAllocationKg: number; targetRemnantKgHa: number }
}

const TECH_ICONS = [
  { key: 'hasWater',       Icon: Droplets,    color: 'text-blue-400',   bgOn: 'bg-blue-50',   bgOff: 'bg-gray-100' },
  { key: 'hasInfraIssues', Icon: Wrench,      color: 'text-orange-400', bgOn: 'bg-orange-50', bgOff: 'bg-gray-100' },
  { key: 'hasPredators',   Icon: ShieldAlert, color: 'text-red-400',    bgOn: 'bg-red-50',    bgOff: 'bg-gray-100' },
  { key: 'hasPests',       Icon: Leaf,        color: 'text-lime-500',   bgOn: 'bg-lime-50',   bgOff: 'bg-gray-100' },
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
  onFieldImageUploaded, defaultEditPaddockId, planningDefaults,
}: Props) {
  const [search, setSearch]     = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [bitacoraModalOpen, setBitacoraModalOpen] = useState(false)
  const { user } = useAuth()
  const { hasFeature } = usePlan()
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
    setActiveMap(prev => ({ ...prev, [paddockId]: next }))
    await apiFetch(`/api/paddocks/${paddockId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: next }),
    })
    onDataRefresh?.()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    onDataRefresh?.()
  }

  // ── KML Import ─────────────────────────────────────────────────────────────
  const handleKmlImport = useCallback(async (file: File) => {
    setKmlImporting(true); setKmlMessage(null)
    try {
      const text    = await file.text()
      const parser  = new DOMParser()
      const dom     = parser.parseFromString(text, 'text/xml')
      const geojson = kmlToGeo(dom)
      const features = geojson.features.filter(
        (f: any) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
      )
      if (features.length === 0) { setKmlMessage('No se encontraron polígonos en el KML.'); return }
      let created = 0
      for (let i = 0; i < features.length; i++) {
        const feat   = features[i]
        const rawName = feat.properties?.name || feat.properties?.Name || ''
        const paddockName = rawName.trim() || `Potrero ${i + 1}`
        const areaHa = parseFloat((turfArea(feat) / 10000).toFixed(2))
        await apiFetch('/api/paddocks', { method: 'POST', body: JSON.stringify({ name: paddockName, area_ha: areaHa, boundary: feat.geometry }) })
        created++
      }
      setKmlMessage(`${created} potrero${created !== 1 ? 's' : ''} importado${created !== 1 ? 's' : ''} correctamente.`)
      onDataRefresh?.()
    } catch { setKmlMessage('Error al procesar el KML.') }
    finally { setKmlImporting(false) }
  }, [onDataRefresh])



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
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">

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
              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-0.5">Mi Campo</p>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-xl font-black text-gray-950 tracking-tight truncate">{org?.name || 'Mi Campo'}</h2>
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
                      {avgQuality != null && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${qualityBadgeColor}`}>
                          Calidad {avgQuality}/10
                        </span>
                      )}
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
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-2.5 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-50 z-10">
            <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Potreros ({paddocks.length})</p>
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
                const msColor    = ms >= 1500 ? 'text-green-700' : ms >= 800 ? 'text-amber-700' : 'text-red-600'
                const qualityScore = (paddock.technical_data as any)?.quality_score as number | undefined
                const qColor = qualityScore != null
                  ? qualityScore >= 7 ? 'bg-green-100 text-green-800 border-green-200'
                  : qualityScore >= 4 ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-red-100 text-red-800 border-red-200'
                  : ''

                return (
                  <div
                    key={paddock.id}
                    className={`w-full rounded-2xl border transition-all overflow-hidden cursor-pointer group ${ 
                      !isActive
                        ? 'bg-gray-50 border-gray-200 opacity-60 shadow-sm'
                        : isSelected
                          ? 'bg-white border-green-300 shadow-lg'
                          : 'bg-white border-gray-200 shadow-md hover:shadow-lg hover:border-gray-300'
                    }`}
                    onClick={() => isActive && onSelectPaddock(paddock.id)}
                  >
                    {/* ── Header: nombre + estado + toggle ── */}
                    <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Nombre — jerarquía principal, tamaño grande */}
                        <h3 className={`text-2xl font-black leading-tight truncate ${
                          isActive ? 'text-gray-950' : 'text-gray-400'
                        }`}>
                          {paddock.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            paddock.current_status === 'GRAZING' ? 'bg-orange-400' : isActive ? 'bg-green-400' : 'bg-gray-300'
                          }`} />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {paddock.current_status === 'GRAZING' ? 'En pastoreo' : 'Descansando'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {/* Toggle inhabilitado */}
                        <button
                          type="button"
                          onClick={e => toggleDisable(e, paddock.id)}
                          title={isActive ? 'Inhabilitar potrero' : 'Habilitar potrero'}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                            isActive ? 'bg-green-500 border-green-500' : 'bg-red-400 border-red-400'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            isActive ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* ── Hectáreas — tamaño subtítulo (antes era el heading) ── */}
                    {isActive && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-100 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]">
                        <div className="flex items-baseline gap-1.5 pt-2">
                          <p className="text-sm font-black text-gray-700 tabular-nums">
                            {Number(paddock.area_ha || 0).toFixed(1)}
                          </p>
                          <p className="text-xs font-bold text-gray-400">ha</p>
                        </div>
                      </div>
                    )}

                    {/* ── MS + calidad ── */}
                    {isActive && (
                      <div className="px-4 pb-3 border-t border-gray-100 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)]">
                        <div className="flex items-stretch gap-4 pt-3">
                          {ms > 0 ? (
                            <>
                              <div>
                                <p className="text-[9px] font-black text-gray-300 tracking-widest uppercase mb-1">MS/ha</p>
                                <p className={`text-2xl font-black tabular-nums leading-none ${msColor}`}>
                                  {ms.toLocaleString('es')}
                                </p>
                              </div>
                              {totalMsCard != null && (
                                <>
                                  <div className="w-px bg-gray-100 self-stretch" />
                                  <div>
                                    <p className="text-[9px] font-black text-gray-300 tracking-widest uppercase mb-1">Total MS</p>
                                    <p className="text-sm font-black text-gray-600 tabular-nums">
                                      {totalMsCard.toLocaleString('es')} <span className="font-medium text-gray-400">kg</span>
                                    </p>
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-gray-300 italic pt-1">Sin datos de MS</p>
                          )}
                          {qualityScore != null && (
                            <div className="ml-auto self-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${qColor}`}>
                                {qualityScore}/10
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Bottom: indicadores técnicos + Detalles ── */}
                    {isActive && (
                      <div className="px-4 pb-4 pt-3 border-t border-gray-100 shadow-[0_-1px_0_0_rgba(0,0,0,0.05)] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {TECH_ICONS.map(({ key, Icon, color, bgOn, bgOff }) => {
                            const active = Boolean(td[key]) || (key === 'hasPests' && (td.weeds || td.weed_types || []).length > 0)
                            return (
                              <span key={key} className={`w-6 h-6 rounded-lg flex items-center justify-center ${active ? bgOn : 'bg-gray-50'}`}>
                                <Icon className={`w-3.5 h-3.5 ${active ? color : 'text-gray-200'}`} />
                              </span>
                            )
                          })}
                          {canNdvi && ndviVal != null && (
                            <span className="text-[9px] font-bold text-gray-400 ml-1">
                              NDVI {Number(ndviVal).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); openModal(paddock) }}
                          className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm"
                        >
                          Detalles
                        </button>
                      </div>
                    )}

                    {/* Disabled badge */}
                  </div>
                )
              })
            )}
          </div>
        </div>


        {/* ── Footer — sin botón "Configurar campo" ────────────────────────── */}
        {paddocks.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <p className="text-[10px] text-gray-400 font-medium">
              {paddocks.filter(p => {
                const d = p.technical_data || {}
                return (d as any).hasWater !== undefined || (d as any).hasInfraIssues !== undefined
              }).length}/{paddocks.length} potreros con detalle técnico
            </p>
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
          onClose={() => { setModalOpen(false); setEditingPaddock(null) }}
          onSave={handleModalSave}
          onDelete={onDeletePaddock}
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
    </>
  )
}
