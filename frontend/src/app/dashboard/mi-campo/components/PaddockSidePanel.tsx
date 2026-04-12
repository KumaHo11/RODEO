'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Search, MapPin, Droplets, Wrench, Leaf, ShieldAlert, X, Check, Satellite, TrendingUp, Loader2, Plus, NotebookPen, BarChart3, AlertTriangle, BookOpen, Camera, Images, RefreshCw, Scale, Map, Settings } from 'lucide-react'
import { SatelliteData } from '@/lib/services/satellite'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from '@/components/AuthProvider'
import BitacoraModal from '../../bitacora/components/BitacoraModal'

interface Paddock {
  id: string
  name: string
  area_ha: number
  current_status: string
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
  }
}

interface Props {
  paddocks: Paddock[]
  org: any
  loading: boolean
  selectedPaddockId: string | null
  onSelectPaddock: (id: string) => void
  onSaveTechnicalData: (id: string, data: Record<string, any>, dryMatter?: number) => void
  ndviData: Record<string, SatelliteData>
  ndviLoading: boolean
  avgNdvi: number | null
  herds?: any[]
  totalEV?: number
  onDrawFieldBoundary?: () => void   // NEW: trigger field boundary drawing mode on map
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  GRAZING: { label: 'En Pastoreo', color: 'bg-orange-100 text-orange-700' },
  RESTING: { label: 'En Descanso', color: 'bg-green-100 text-green-700' },
  default: { label: 'Sin Estado', color: 'bg-gray-100 text-gray-500' },
}

const WATER_TYPES = ['Tajamar', 'Cañería', 'Pozo', 'Bebedero', 'Arroyo', 'Otra']
const WEED_TYPES = ['Cardo', 'Rama Negra', 'Sorgo de Alepo', 'Mostacilla', 'Gramilla', 'Otra']

const TECH_ICONS = [
  { key: 'hasWater',      Icon: Droplets,   color: 'text-blue-400',   bgOn: 'bg-blue-50',   bgOff: 'bg-gray-100' },
  { key: 'hasInfraIssues',Icon: Wrench,     color: 'text-orange-400', bgOn: 'bg-orange-50', bgOff: 'bg-gray-100' },
  { key: 'hasPredators',  Icon: ShieldAlert,color: 'text-red-400',    bgOn: 'bg-red-50',    bgOff: 'bg-gray-100' },
  { key: 'hasPests',      Icon: Leaf,       color: 'text-lime-500',   bgOn: 'bg-lime-50',   bgOff: 'bg-gray-100' },
]

const getNdviLabel = (ndvi: number) => {
  if (ndvi >= 0.6) return { label: 'Óptimo', color: 'text-green-700 bg-green-100' }
  if (ndvi >= 0.4) return { label: 'Bueno', color: 'text-lime-700 bg-lime-100' }
  if (ndvi >= 0.2) return { label: 'Regular', color: 'text-yellow-700 bg-yellow-100' }
  return { label: 'Bajo', color: 'text-red-700 bg-red-100' }
}

// Reusable toggle switch component
function Toggle({ checked, onChange, colorClass }: { checked: boolean; onChange: () => void; colorClass: string }) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${checked ? colorClass : 'bg-gray-200'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all duration-200 ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

const NOTE_CAT_ICONS: Record<string, React.ComponentType<any>> = {
  INFRAESTRUCTURA: Wrench,
  SANIDAD_VEGETAL: Leaf,
  RESTRICCION: AlertTriangle,
  BIOMASA: BarChart3,
  HIDRICO: Droplets,
  GENERAL: BookOpen,
}
const NOTE_CAT_COLORS: Record<string, string> = {
  INFRAESTRUCTURA: 'bg-cyan-100 text-cyan-800',
  SANIDAD_VEGETAL: 'bg-green-100 text-green-800',
  RESTRICCION: 'bg-red-100 text-red-800',
  BIOMASA: 'bg-violet-100 text-violet-800',
  HIDRICO: 'bg-sky-100 text-sky-800',
  GENERAL: 'bg-gray-100 text-gray-700',
}

// Pastel palette matching the map colors
const PASTEL_ACCENTS = [
  '#a7f3d0', '#bfdbfe', '#fde68a', '#ddd6fe', '#fca5a5',
  '#a5f3fc', '#fbcfe8', '#d9f99d', '#fed7aa', '#c4b5fd',
]

export default function PaddockSidePanel({
  paddocks, org, loading, selectedPaddockId, onSelectPaddock, onSaveTechnicalData,
  ndviData, ndviLoading, avgNdvi, herds = [], totalEV = 0, onDrawFieldBoundary
}: Props) {
  const [search, setSearch] = useState('')
  const [sideTab, setSideTab] = useState<'campo' | 'potreros'>('campo')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'tecnico' | 'bitacora'>('tecnico')
  const [bitacoraModalOpen, setBitacoraModalOpen] = useState(false)
  const { user } = useAuth()
  const [editingPaddock, setEditingPaddock] = useState<Paddock | null>(null)
  const [techData, setTechData] = useState<Record<string, any>>({})
  const [dryMatter, setDryMatter] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [paddockNotes, setPaddockNotes] = useState<any[]>([])
  const [notesLoading, setNotesLoading] = useState(false)

  // Multi-photo biomass
  const [bioPhotos, setBioPhotos] = useState<File[]>([])
  const [bioAnalyzing, setBioAnalyzing] = useState(false)
  const [bioResults, setBioResults] = useState<any[]>([])
  const [bioError, setBioError] = useState<string | null>(null)
  const photosInputRef = useRef<HTMLInputElement>(null)

  // NDVI refresh state
  const [ndviRefreshing, setNdviRefreshing] = useState(false)
  const [growthRate, setGrowthRate] = useState<number | null>(null)

  const loadPaddockNotes = useCallback(async (paddockId: string) => {
    setNotesLoading(true)
    setPaddockNotes([])
    const res = await apiFetch(`/api/field-notes?paddock_id=${paddockId}`)
    setPaddockNotes(res.ok ? (await res.json()).notes || [] : [])
    setNotesLoading(false)
  }, [])

  // Multi-photo: analyze up to 5 photos and average the MS result
  const analyzeBioPhotos = useCallback(async () => {
    if (!editingPaddock || bioPhotos.length === 0) return
    setBioAnalyzing(true)
    setBioError(null)
    setBioResults([])
    try {
      const results = await Promise.all(bioPhotos.map(async (file) => {
        const reader = new FileReader()
        const b64: string = await new Promise((res, rej) => {
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        const resp = await fetch('/api/analyze-biomass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64, mimeType: file.type || 'image/jpeg', area_ha: editingPaddock.area_ha }),
        })
        return resp.ok ? await resp.json() : null
      }))
      const valid = results.filter(r => r && r.dry_matter_kg_ha)
      setBioResults(valid)
      if (valid.length > 0) {
        const avgMs = Math.round(valid.reduce((s: number, r: any) => s + r.dry_matter_kg_ha, 0) / valid.length)
        setDryMatter(avgMs)
      } else {
        setBioError('No se pudieron analizar las fotos. Intentá con otras imágenes.')
      }
    } catch (e: any) {
      setBioError(e.message || 'Error en análisis')
    }
    setBioAnalyzing(false)
  }, [bioPhotos, editingPaddock])

  // NDVI refresh with growth rate calculation
  const refreshNdvi = useCallback(async (paddock: Paddock & { previous_dry_matter_kg_ha?: number; previous_ndvi_date?: string }) => {
    if (!paddock) return
    setNdviRefreshing(true)
    try {
      // Fetch geometry via API
      const geoRes = await apiFetch(`/api/paddocks/${paddock.id}`)
      if (!geoRes.ok) return
      const { paddock: geoData } = await geoRes.json()
      if (!geoData?.boundary) return

      const resp = await fetch('/api/ndvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geojson: geoData.boundary, paddock_id: paddock.id }),
      })
      if (!resp.ok) return
      const res = await resp.json()
      const newMs = res.estimatedAvailableDryMatterHa
      const currentMs = Number(paddock.dry_matter_kg_ha) || 0
      const prevMs = Number(paddock.previous_dry_matter_kg_ha) || 0
      const prevDate = paddock.previous_ndvi_date
      if (prevMs > 0 && prevDate) {
        const days = Math.max(1, Math.round((Date.now() - new Date(prevDate).getTime()) / 86400000))
        setGrowthRate((newMs - prevMs) / days)
      }
      // Persist via API
      await apiFetch(`/api/paddocks/${paddock.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          current_ndvi: res.averageNdvi,
          dry_matter_kg_ha: newMs,
        }),
      })
      setDryMatter(newMs)
    } catch (e) {
      console.error('[NDVI refresh]', e)
    }
    setNdviRefreshing(false)
  }, [])


  const filtered = paddocks.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openModal = (paddock: Paddock) => {
    setEditingPaddock(paddock)
    setTechData(paddock.technical_data || {})
    setDryMatter(paddock.dry_matter_kg_ha ?? ndviData[paddock.id]?.estimatedAvailableDryMatterHa ?? '')
    setModalTab('tecnico')
    setModalOpen(true)
    setBioPhotos([])
    setBioResults([])
    setBioError(null)
    setGrowthRate(null)
    loadPaddockNotes(paddock.id)
  }

  const handleSave = async () => {
    if (!editingPaddock) return
    setSaving(true)
    await onSaveTechnicalData(editingPaddock.id, techData, dryMatter !== '' ? Number(dryMatter) : undefined)
    setSaving(false)
    setModalOpen(false)
  }

  const toggleWeed = (weed: string) => {
    const current = techData.weeds || []
    setTechData({
      ...techData,
      weeds: current.includes(weed)
        ? current.filter((w: string) => w !== weed)
        : [...current, weed]
    })
  }

  const totalArea = paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const grazingCount = paddocks.filter(p => p.current_status === 'GRAZING').length

  // Count paddocks that have at least 1 tech data field set
  const enrichedCount = paddocks.filter(p => {
    const d = p.technical_data || {}
    return d.hasWater !== undefined || d.hasInfraIssues !== undefined || d.hasPredators !== undefined || d.hasPests !== undefined
  }).length

  return (
    <>
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black text-gray-950 tracking-tight">{org?.name || 'Mi Campo'}</h2>
            {ndviLoading && <Loader2 className="w-4 h-4 text-green-500 animate-spin" />}
          </div>

          {/* Perimeter badge */}
          {org?.boundaries ? (
            <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Map className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-[8px] font-black text-blue-500 tracking-widest uppercase">Perímetro</p>
                <p className="text-xs font-black text-gray-900">{Number(org.total_area_ha).toFixed(1)} ha · {paddocks.length} potreros · {grazingCount} en pastoreo</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onDrawFieldBoundary?.()}
              className="w-full py-2 bg-blue-50 border border-dashed border-blue-300 text-blue-700 text-[10px] font-black rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-1.5"
            >
              <Map className="w-3 h-3" /> Dibujar contorno del campo
            </button>
          )}

          {/* NDVI promedio */}
          {avgNdvi !== null && (
            <div className="mt-2 p-2.5 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2.5">
              <Satellite className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <div className="flex-1">
                <p className="text-[8px] font-black text-green-600 tracking-widest uppercase">NDVI Promedio del Campo</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-black text-gray-900">{avgNdvi.toFixed(3)}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getNdviLabel(avgNdvi).color}`}>
                    {getNdviLabel(avgNdvi).label}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Paddock list — single scroll, no tabs ───────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-2.5 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-50 z-10">
            <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Potreros ({paddocks.length})</p>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-lg pl-6 pr-2 py-1 text-[10px] text-gray-700 placeholder:text-gray-300 focus:ring-1 focus:ring-green-500 outline-none w-24"
              />
            </div>
          </div>
          <div className="p-3 space-y-1.5">
          {loading ? (
            <div className="space-y-2 pt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <MapPin className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">Sin potreros registrados</p>
              <p className="text-[10px] text-gray-300 mt-1">Dibuja un potrero en el mapa</p>
            </div>
          ) : (
            filtered.map((paddock, paddockIdx) => {
              const status = STATUS_LABEL[paddock.current_status] || STATUS_LABEL.default
              const isSelected = paddock.id === selectedPaddockId
              const sat = ndviData[paddock.id]
              const ndviVal = sat?.averageNdvi ?? paddock.current_ndvi
              const ndviInfo = ndviVal != null ? getNdviLabel(ndviVal) : null
              const isReal = sat?.source === 'sentinel-2-l2a'
              const td = paddock.technical_data || {}
              const accentColor = PASTEL_ACCENTS[paddockIdx % PASTEL_ACCENTS.length]

              return (
                <div
                  key={paddock.id}
                  className={`w-full rounded-xl border transition-all cursor-pointer overflow-hidden ${isSelected
                    ? 'bg-green-50 border-green-200 shadow-sm'
                    : 'bg-white border-gray-100 hover:border-green-100 hover:bg-gray-50/50'
                    }`}
                  style={{ borderLeftColor: accentColor, borderLeftWidth: 4 }}
                  onClick={() => onSelectPaddock(paddock.id)}
                >
                  <div className="p-3.5 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          {/* MS como dato principal */}
                          {(() => {
                            const ms = Number(paddock.dry_matter_kg_ha) || (ndviData[paddock.id]?.estimatedAvailableDryMatterHa || 0)
                            const msColor = ms >= 1500 ? 'text-green-700' : ms >= 800 ? 'text-amber-700' : ms > 0 ? 'text-red-600' : 'text-gray-400'
                            const ha = Number(paddock.area_ha) || 0
                            return ms > 0 ? (
                              <div>
                                <p className="text-xs font-black text-gray-900 truncate leading-tight mb-0.5">{paddock.name}</p>
                                <p className={`text-base font-black leading-none ${msColor}`}>{ms.toLocaleString()} <span className="text-[9px] font-bold text-gray-400">kg MS/ha</span></p>
                                <p className="text-[9px] text-gray-500">{(ms * ha).toFixed(0)} kg totales · {ha.toFixed(1)} ha</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-black text-gray-900 truncate leading-tight">{paddock.name}</p>
                                <p className="text-[10px] text-gray-400">{Number(paddock.area_ha || 0).toFixed(1)} ha · Sin análisis</p>
                              </div>
                            )
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                          {ndviVal != null && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${ndviInfo?.color}`}>NDVI {Number(ndviVal).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      {/* Tech icons row */}
                      <div className="flex items-center gap-1 mt-1.5">
                        {TECH_ICONS.map(({ key, Icon, color, bgOn, bgOff }) => {
                          const td2 = td as Record<string, any>
                          const active = Boolean(td2[key]) || (key === 'hasPests' && (td2.weeds || []).length > 0)
                          return (
                            <span key={key} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${active ? bgOn : bgOff}`} title={key}>
                              <Icon className={`w-3 h-3 ${active ? color : 'text-gray-300'}`} />
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openModal(paddock) }}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-black text-green-600 bg-green-50 hover:bg-green-100 rounded-lg border border-green-100 transition-all"
                    >
                      Ver/Editar
                    </button>
                  </div>
                </div>
              )
            })
          )}
          </div>{/* p-3 */}
        </div>{/* flex-1 scroll */}

        {/* Footer — always visible */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
            {enrichedCount}/{paddocks.length} potreros con detalle técnico
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="bg-green-400 h-1.5 rounded-full transition-all"
              style={{ width: paddocks.length > 0 ? `${(enrichedCount / paddocks.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && editingPaddock && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal header unificado */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-950 tracking-tight">{editingPaddock.name}</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Potrero · {Number(editingPaddock.area_ha || 0).toFixed(1)} ha
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-3 border-b border-gray-100">
              <button
                onClick={() => setModalTab('tecnico')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-xl transition-all ${
                  modalTab === 'tecnico' ? 'bg-green-50 text-green-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Detalle técnico
              </button>
              <button
                onClick={() => setModalTab('bitacora')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-xl transition-all ${
                  modalTab === 'bitacora' ? 'bg-green-50 text-green-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <NotebookPen className="w-3.5 h-3.5" /> Bitácora
                {paddockNotes.length > 0 && (
                  <span className="w-4 h-4 text-[9px] font-black bg-green-600 text-white rounded-full flex items-center justify-center">
                    {paddockNotes.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── TAB: BITÁCORA ── */}
            {modalTab === 'bitacora' && (
              <div className="max-h-[60vh] overflow-y-auto relative">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm p-3 border-b border-gray-100 flex justify-between items-center z-10">
                  <p className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Historial de notas</p>
                  <button onClick={() => setBitacoraModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all">
                    <Plus className="w-3 h-3" /> Nueva Nota
                  </button>
                </div>
                {notesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                  </div>
                ) : paddockNotes.length === 0 ? (
                  <div className="text-center py-10">
                    <NotebookPen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-400">Sin notas para este potrero</p>
                    <p className="text-xs text-gray-300 mt-1">Agregá notas desde Bitácora de potreros</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {paddockNotes.map(note => {
                      const tags: string[] = Array.isArray(note.tags) && note.tags.length > 0
                        ? note.tags : [note.category || 'GENERAL']
                      const PrimaryIcon = NOTE_CAT_ICONS[tags[0]] || BookOpen
                      const date = new Date(note.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
                      return (
                        <div key={note.id} className="px-5 py-3.5">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${NOTE_CAT_COLORS[tags[0]]?.replace('text-','bg-').split(' ')[0] || 'bg-gray-100'}`}>
                              <PrimaryIcon className="w-4 h-4" style={{ opacity: 0.8 }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1 mb-1">
                                {tags.map(tag => (
                                  <span key={tag} className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${NOTE_CAT_COLORS[tag] || NOTE_CAT_COLORS.GENERAL}`}>
                                    {tag.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs font-black text-gray-900 leading-snug">{note.title}</p>
                              {note.content && (
                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{note.content}</p>
                              )}
                              {note.analysis_result && (
                                <div className="mt-1.5 flex gap-2">
                                  <span className="text-[9px] bg-violet-50 text-violet-700 font-bold px-2 py-0.5 rounded-lg">
                                    MS: {note.analysis_result.dry_matter_kg_ha} kg/ha
                                  </span>
                                  <span className="text-[9px] bg-violet-50 text-violet-700 font-bold px-2 py-0.5 rounded-lg">
                                    Altura: {note.analysis_result.grass_height_cm} cm
                                  </span>
                                </div>
                              )}
                              {note.photo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={note.photo_url} alt="" className="mt-1.5 rounded-lg w-full max-h-28 object-cover" />
                              )}
                              <p className="text-[9px] text-gray-400 mt-1.5">{date}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: DETALLE TÉCNICO ── */}
            {modalTab === 'tecnico' && (
            <div className="px-6 py-5 flex-1 overflow-y-auto max-h-[70vh] space-y-5">

              {/* ── HERO: Materia Seca — campo más importante ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-gray-900 uppercase tracking-wider">Materia seca disponible</p>
                  {dryMatter !== '' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {Number(dryMatter).toLocaleString()} kg MS/ha
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="50"
                    value={dryMatter}
                    onChange={e => setDryMatter(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={`Ej: ${ndviData[editingPaddock.id]?.estimatedAvailableDryMatterHa ?? 1800} kg MS/ha`}
                    className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-black text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                  />
                  <span className="text-xs text-gray-400 font-bold whitespace-nowrap">kg/ha</span>
                </div>
                {dryMatter !== '' && Number(editingPaddock.area_ha) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100">
                    <BarChart3 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <p className="text-xs text-green-700 font-bold">
                      Total: <strong>{(Number(dryMatter) * Number(editingPaddock.area_ha)).toFixed(0)} kg MS</strong>
                      <span className="text-gray-400 font-normal ml-1">en {Number(editingPaddock.area_ha).toFixed(1)} ha</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Análisis IA fotos — colapsado y discreto */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                  <Camera className="w-3.5 h-3.5 text-gray-500" />
                  <p className="text-[10px] font-black text-gray-600 tracking-wide">Analizar con IA (fotos de pastura)</p>
                  <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 bg-indigo-600 text-white rounded-full">Gemini</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photosInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                    >
                      <Camera className="w-3 h-3" />
                      {bioPhotos.length === 0 ? 'Subir fotos' : `${bioPhotos.length} foto${bioPhotos.length > 1 ? 's' : ''}`}
                    </button>
                    {bioPhotos.length > 0 && (
                      <button
                        onClick={analyzeBioPhotos}
                        disabled={bioAnalyzing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-all"
                      >
                        {bioAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Images className="w-3 h-3" />}
                        {bioAnalyzing ? 'Analizando...' : 'Analizar'}
                      </button>
                    )}
                  </div>
                  <input ref={photosInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).slice(0, 5)
                      setBioPhotos(files); setBioResults([]); setBioError(null)
                    }}
                  />
                  {bioError && <p className="text-[9px] text-red-600 font-bold">{bioError}</p>}
                  {bioResults.length > 0 && (
                    <div className="bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                      <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Resultado IA</p>
                      <p className="text-lg font-black text-indigo-800">
                        {Math.round(bioResults.reduce((s: number, r: any) => s + r.dry_matter_kg_ha, 0) / bioResults.length).toLocaleString()}
                        <span className="text-xs font-bold text-indigo-500 ml-1">kg MS/ha</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* NDVI */}
              {(ndviData[editingPaddock.id] || editingPaddock.current_ndvi != null) && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <Satellite className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">NDVI satelital</p>
                    <p className="text-sm font-black text-gray-900">
                      {(ndviData[editingPaddock.id]?.averageNdvi ?? editingPaddock.current_ndvi)?.toFixed(3)}
                      <span className="text-[9px] font-bold text-gray-400 ml-2">
                        {ndviData[editingPaddock.id]?.source === 'sentinel-2-l2a' ? 'Sentinel-2' : 'Estimado'}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => refreshNdvi(editingPaddock as any)}
                    disabled={ndviRefreshing}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all"
                  >
                    {ndviRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Actualizar
                  </button>
                </div>
              )}


              {/* Condiciones del potrero */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Condiciones del potrero</p>

                {/* Agua */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${techData.hasWater ? 'bg-blue-100' : 'bg-gray-50'}`}>
                      <Droplets className={`w-3.5 h-3.5 ${techData.hasWater ? 'text-blue-500' : 'text-gray-300'}`} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Agua disponible</p>
                      <p className="text-[9px] text-gray-400">{techData.hasWater ? 'Fuente de agua presente' : 'Sin agua en el potrero'}</p>
                    </div>
                  </div>
                  <Toggle checked={!!techData.hasWater} onChange={() => setTechData({ ...techData, hasWater: !techData.hasWater })} colorClass="bg-blue-500" />
                </div>

                {/* Infraestructura */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${techData.hasInfraIssues ? 'bg-orange-100' : 'bg-gray-50'}`}>
                      <Wrench className={`w-3.5 h-3.5 ${techData.hasInfraIssues ? 'text-orange-500' : 'text-gray-300'}`} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Infraestructura</p>
                      <p className="text-[9px] text-gray-400">{techData.hasInfraIssues ? 'Requiere atención' : 'Sin issues reportados'}</p>
                    </div>
                  </div>
                  <Toggle checked={!!techData.hasInfraIssues} onChange={() => setTechData({ ...techData, hasInfraIssues: !techData.hasInfraIssues })} colorClass="bg-orange-500" />
                </div>

                {/* Malezas */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${techData.hasPests ? 'bg-lime-100' : 'bg-gray-50'}`}>
                      <Leaf className={`w-3.5 h-3.5 ${techData.hasPests ? 'text-lime-600' : 'text-gray-300'}`} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Malezas</p>
                      <p className="text-[9px] text-gray-400">{techData.hasPests ? 'Malezas detectadas' : 'Pastura limpia'}</p>
                    </div>
                  </div>
                  <Toggle checked={!!techData.hasPests} onChange={() => setTechData({ ...techData, hasPests: !techData.hasPests, weeds: !techData.hasPests ? (techData.weeds || []) : [] })} colorClass="bg-lime-500" />
                </div>

                {/* Depredadores */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${techData.hasPredators ? 'bg-red-100' : 'bg-gray-50'}`}>
                      <ShieldAlert className={`w-3.5 h-3.5 ${techData.hasPredators ? 'text-red-500' : 'text-gray-300'}`} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Depredadores</p>
                      <p className="text-[9px] text-gray-400">{techData.hasPredators ? 'Alerta activa' : 'Sin reportes'}</p>
                    </div>
                  </div>
                  <Toggle checked={!!techData.hasPredators} onChange={() => setTechData({ ...techData, hasPredators: !techData.hasPredators })} colorClass="bg-red-500" />
                </div>

                {/* Tipo de agua */}
                {techData.hasWater && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Tipo de fuente</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WATER_TYPES.map(type => (
                        <button key={type} onClick={() => setTechData({ ...techData, waterType: type })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${techData.waterType === type ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-blue-50'}`}
                        >{type}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tipo de maleza */}
                {techData.hasPests && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Tipo de maleza</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WEED_TYPES.map(weed => {
                        const sel = (techData.weeds || []).includes(weed)
                        return (
                          <button key={weed} onClick={() => toggleWeed(weed)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${sel ? 'bg-lime-200 text-lime-800' : 'bg-gray-100 text-gray-600 hover:bg-lime-50'}`}
                          >{weed}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>{/* end condiciones */}
            </div>
            )}


            {/* Footer tecnico */}
            {(modalTab as string) === 'tecnico' && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
                <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 text-sm font-black text-white bg-green-600 rounded-xl shadow-md shadow-green-100 hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar cambios
                </button>
              </div>
            )}
            {(modalTab as string) === 'bitacora' && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button onClick={() => setModalOpen(false)} className="px-6 py-2.5 text-sm font-black text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bitácora Modal (Independiente) ── */}
      <BitacoraModal 
        isOpen={bitacoraModalOpen} 
        onClose={() => setBitacoraModalOpen(false)} 
        onSaved={() => {
          if (editingPaddock) loadPaddockNotes(editingPaddock.id)
        }}
        user={user}
        initialPaddockId={editingPaddock?.id}
        initialPaddockName={editingPaddock?.name}
        paddocks={paddocks}
      />
    </>
  )
}
