'use client'

/**
 * PaddockDetailView — Panel de detalle (75%) del patrón Master-Detail.
 *
 * Cabecera: replica HerdDetailHeader (px-8 pt-6 pb-0, tab bar border-b-2 estilo Link).
 * Secciones: tarjetas bg-white rounded-2xl border border-gray-100 shadow-sm (= HerdDatosTab).
 * Mapa: botón "Ver Mapa" en header abre un drawer/modal superpuesto (no divide pantalla).
 *
 * Tabs via URL: ?paddockId=<id>&tab=datos|infraestructura|metricas|bitacora
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import {
  ChevronLeft, Loader2, AlertTriangle, CheckCircle2,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import type { SatelliteData } from '@/lib/services/satellite'
import { AICameraModal } from '@/components/AICameraModal'
import { CustomSelect } from '@/components/CustomSelect'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/AuthProvider'

const BitacoraModal = dynamic(
  () => import('@/app/dashboard/bitacora/components/BitacoraModal'),
  { ssr: false }
)


// Lazy map for drawer (avoid SSR issues)
const MiCampoMap = dynamic(
  () => import('./MiCampoMap'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center bg-gray-100"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div> }
)

// ── Tab config ────────────────────────────────────────────────────────────────
type PaddockTab = 'datos' | 'infraestructura' | 'metricas' | 'bitacora'
const TABS: { key: PaddockTab; label: string }[] = [
  { key: 'datos',           label: 'Datos' },
  { key: 'infraestructura', label: 'Infraestructura' },
  { key: 'metricas',        label: 'Métricas' },
  { key: 'bitacora',        label: 'Bitácora' },
]

// ── Reusable display atoms — identical to HerdDatosTab ────────────────────────
const LABEL = 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block'
const FIELD = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 outline-none transition-all bg-white'

function DataField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={clsx('text-sm font-bold', highlight ? 'text-gray-900' : 'text-gray-600')}>{value}</p>
    </div>
  )
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── KPI Chip — identical to HerdDetailHeader ──────────────────────────────────
function KpiChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white whitespace-nowrap">
      <span className="text-sm font-black tabular-nums leading-none text-gray-900">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  paddockId:    string
  paddocks:     any[]
  ndviData:     Record<string, SatelliteData>
  ndviLoading:  boolean
  onBack:       () => void
  onDataRefresh: () => void
  // For map drawer
  org:          any
  fieldBoundary: any
  activeGrazingPlans: { paddock_id: string; herd_name: string; head_count: number }[]
  onSelectPaddock: (id: string | null) => void
  onPaddockGeomUpdated: (paddockId: string, geom: any, areaHa: number) => void
  onNewPaddockDrawn: (geojson: any, areaHa: number) => void
  onDeletePaddock: (id: string) => void
  onFieldBoundaryEdited: (geojson: any, areaHa: number) => void
  kmlFeatures: any[]
  kmlAcceptedIndices: Set<number>
  onKmlPolygonClick: (idx: number, feat: any) => void
  onFieldBoundaryDrawn: (geojson: any) => void
  // Creation shortcuts from within the map
  onDigitize?: () => void
  onManual?:   () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PaddockDetailView({
  paddockId, paddocks, ndviData, ndviLoading, onBack, onDataRefresh,
  org, fieldBoundary, activeGrazingPlans, onSelectPaddock,
  onPaddockGeomUpdated, onNewPaddockDrawn, onDeletePaddock,
  onFieldBoundaryEdited, kmlFeatures, kmlAcceptedIndices, onKmlPolygonClick,
  onFieldBoundaryDrawn, onDigitize, onManual,
}: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const activeTab    = (searchParams.get('tab') as PaddockTab) || 'datos'
  const [mapOpen, setMapOpen] = useState(false)
  const [mapNewMenu, setMapNewMenu] = useState(false)
  const { user } = useAuth()

  const paddock = paddocks.find(p => p.id === paddockId)
  const [bitacoraRefreshKey, setBitacoraRefreshKey] = useState(0)

  // Wraps parent onDataRefresh to also bump the Bitácora re-fetch counter
  const handleDataRefresh = useCallback(() => {
    setBitacoraRefreshKey(k => k + 1)
    onDataRefresh()
  }, [onDataRefresh])

  const setTab = (tab: PaddockTab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  if (!paddock) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  const hasGeom = Boolean(paddock.boundary || paddock.geom || paddock.geojson)
  const sat     = ndviData[paddockId]
  const ms      = Number(paddock.dry_matter_kg_ha) || 0

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

        {/* ── Header — replica HerdDetailHeader ────────────────────────────── */}
        <div className="shrink-0 bg-white border-b border-gray-100">
          <div className="px-8 pt-6 pb-0 flex items-center gap-4 min-w-0">

            {/* Volver — mobile/desktop */}
            <button
              onClick={onBack}
              className="hidden md:flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Nombre */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-gray-950 truncate leading-tight">
                {paddock.name}
              </h1>
            </div>

            {/* KPI chips — idénticos al HerdDetailHeader */}
            <div className="overflow-x-auto scrollbar-none -mx-1 px-1 shrink min-w-0">
              <div className="flex items-center gap-1.5 min-w-max">
                <KpiChip value={`${Number(paddock.area_ha || 0).toFixed(1)}`} label="ha" />
                {ms > 0 && (
                  <KpiChip value={ms.toLocaleString('es')} label="kg MS/ha" />
                )}
                {ms > 0 && paddock.area_ha > 0 && (
                  <KpiChip value={Math.round(ms * Number(paddock.area_ha)).toLocaleString('es')} label="kg total" />
                )}
                {sat?.averageNdvi != null && (
                  <KpiChip value={sat.averageNdvi.toFixed(2)} label="NDVI" />
                )}
                {!hasGeom && (
                  <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-xl">
                    Sin polígono
                  </span>
                )}
              </div>
            </div>

            {/* Botón "Ver Mapa" — text only */}
            <div className="shrink-0 flex items-center pl-2 border-l border-gray-100">
              <button
                onClick={() => setMapOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all"
              >
                Ver mapa
              </button>
            </div>
          </div>

          {/* ── Tab bar — idéntico a HerdDetailHeader ────────────────────── */}
          <div className="mt-4 px-8 flex items-center overflow-x-auto scrollbar-none border-t border-gray-100">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={clsx(
                  'shrink-0 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap -mb-px',
                  activeTab === key
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'datos' && (
            <TabDatos paddock={paddock} sat={sat} hasGeom={hasGeom} onDataRefresh={handleDataRefresh} />
          )}
          {activeTab === 'infraestructura' && (
            <TabInfraestructura paddock={paddock} onDataRefresh={handleDataRefresh} />
          )}
          {activeTab === 'metricas' && (
            <TabMetricas paddock={paddock} sat={sat} hasGeom={hasGeom} ndviLoading={ndviLoading} />
          )}
          {activeTab === 'bitacora' && (
            <TabBitacora paddock={paddock} user={user} refreshKey={bitacoraRefreshKey} />
          )}
        </div>
      </div>

      {/* ── Mapa: superposición COMPLETA, sin blur, header verde sólido ─────── */}
      {mapOpen && (
        <div className="fixed inset-0 z-[8000] flex flex-col">
          {/* Header verde sólido 100% ancho */}
          <div className="w-full bg-green-700 shrink-0 flex items-center justify-between px-6 py-3">
            {/* Left: paddock name + datos link */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-black text-white truncate">{paddock.name}</p>
                <p className="text-[11px] text-green-200">{Number(paddock.area_ha || 0).toFixed(1)} ha · Mapa satelital</p>
              </div>
              <button
                onClick={() => { setMapOpen(false); setTab('datos') }}
                className="shrink-0 px-3 py-1.5 text-xs font-bold text-green-100 hover:text-white bg-green-600 hover:bg-green-500 border border-green-500 rounded-xl transition-all"
              >
                Datos operativos
              </button>
            </div>

            {/* Right: create new paddock + close */}
            <div className="flex items-center gap-2 shrink-0">
              {/* New paddock dropdown from map */}
              {(onDigitize || onManual) && (
                <div className="relative">
                  <button
                    onClick={() => setMapNewMenu(v => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-500 border border-green-500 rounded-xl transition-all"
                  >
                    <span className="text-base leading-none">+</span> Nuevo potrero
                  </button>
                  {mapNewMenu && (
                    <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
                      {onDigitize && (
                        <button
                          type="button"
                          onClick={() => { setMapOpen(false); setMapNewMenu(false); onDigitize() }}
                          className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors"
                        >
                          <p className="text-sm font-bold text-gray-900">Digitalizar potrero</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Dibujá el límite en el mapa</p>
                        </button>
                      )}
                      {onDigitize && onManual && <div className="border-t border-gray-100" />}
                      {onManual && (
                        <button
                          type="button"
                          onClick={() => { setMapOpen(false); setMapNewMenu(false); onManual() }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-bold text-gray-900">Manualmente</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Solo datos, sin polígono</p>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => { setMapOpen(false); setMapNewMenu(false) }}
                aria-label="Cerrar mapa"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-500 transition-all"
              >
                <X className="w-5 h-5 text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          {/* Mapa ocupa todo el área restante */}
          <div className="flex-1 relative overflow-hidden">
            <MiCampoMap
              paddocks={paddocks}
              org={org}
              fieldBoundary={fieldBoundary}
              selectedPaddockId={paddockId}
              onSelectPaddock={onSelectPaddock}
              onPaddockGeomUpdated={onPaddockGeomUpdated}
              onNewPaddockDrawn={onNewPaddockDrawn}
              onDeletePaddock={onDeletePaddock}
              activeGrazingPlans={activeGrazingPlans}
              drawModeActive={false}
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
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB A — DATOS
// ══════════════════════════════════════════════════════════════════════════════

function TabDatos({ paddock, sat, hasGeom, onDataRefresh }: {
  paddock: any; sat?: SatelliteData; hasGeom: boolean; onDataRefresh: () => void
}) {
  // ─ Toggle modo edición ─────────────────────────────────────────────────────
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [editing, setEditing]         = useState(false)
  const [nameInput, setNameInput]     = useState(String(paddock.name || ''))
  const [msInput, setMsInput]         = useState(String(paddock.dry_matter_kg_ha || ''))
  const [areaInput, setAreaInput]     = useState(String(paddock.area_ha || ''))
  const [savingMs, setSavingMs]       = useState(false)
  const [intaLoading, setIntaLoading] = useState(false)
  const [intaSpecies, setIntaSpecies] = useState<string[]>([])
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>(
    Array.isArray(paddock.technical_data?.botanical_species)
      ? paddock.technical_data.botanical_species
      : Array.isArray(paddock.technical_data?.dominant_species)
        ? paddock.technical_data.dominant_species
        : paddock.technical_data?.dominant_species
          ? [paddock.technical_data.dominant_species]
          : []
  )
  const [speciesOpen, setSpeciesOpen]     = useState(false)
  const [speciesSaving, setSpeciesSaving] = useState(false)

  const td = paddock.technical_data || {}

  // ── Extract centroid from polygon for geo APIs (INTA, AI) ────────────────
  const centroid = useCallback((): { lat: number; lng: number } | null => {
    const geom = paddock.boundary || paddock.geom || paddock.geojson
    if (!geom) return null
    try {
      const geo = typeof geom === 'string' ? JSON.parse(geom) : geom
      const getCoords = (g: any): number[][] => {
        if (g.type === 'FeatureCollection') return g.features.flatMap((f: any) => getCoords(f))
        if (g.type === 'Feature')           return getCoords(g.geometry)
        if (g.type === 'Polygon')           return g.coordinates[0]
        if (g.type === 'MultiPolygon')      return g.coordinates[0][0]
        return []
      }
      const coords = getCoords(geo)
      if (!coords.length) return null
      const lngAvg = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length
      const latAvg = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length
      if (isNaN(latAvg) || isNaN(lngAvg)) return null
      return { lat: latAvg, lng: lngAvg }
    } catch { return null }
  }, [paddock.boundary, paddock.geom, paddock.geojson])

  // ── INTA mock ─────────────────────────────────────────────────────────────
  const fetchInta = useCallback(async () => {
    if (!hasGeom) return
    setIntaLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setIntaSpecies([
      'Festuca arundinacea',
      'Dactylis glomerata',
      'Lolium perenne',
      'Trifolium repens',
      'Poa pratensis',
      'Bromus catharticus',
      'Paspalum dilatatum',
      'Setaria parviflora',
    ])
    setIntaLoading(false)
  }, [hasGeom])

  useEffect(() => {
    if (hasGeom && intaSpecies.length === 0) fetchInta()
  }, [hasGeom, fetchInta, intaSpecies.length])

  // ─ Guardar datos operativos (nombre + MS + área) ────────────────────────────
  const handleSaveMs = async () => {
    const val     = Number(msInput)
    const areaVal = Number(areaInput)
    if (isNaN(val) || val < 0) return
    setSavingMs(true)
    try {
      const body: Record<string, any> = { dry_matter_kg_ha: val }
      if (nameInput.trim() && nameInput.trim() !== paddock.name) {
        body.name = nameInput.trim()
      }
      if (!isNaN(areaVal) && areaVal > 0 && areaVal !== Number(paddock.area_ha)) {
        body.area_ha = parseFloat(areaVal.toFixed(2))
      }
      await apiFetch(`/api/paddocks/${paddock.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast.success('Datos actualizados')
      onDataRefresh()
      setEditing(false)
    } catch { toast.error('Error al guardar') }
    setSavingMs(false)
  }

  // ─ Guardar composición botánica ─────────────────────────────────────────────
  const handleSaveSpecies = async () => {
    setSpeciesSaving(true)
    try {
      const updatedTd = {
        ...td,
        botanical_species: selectedSpecies,          // new canonical array field
        dominant_species:  selectedSpecies[0] || '', // legacy compat
      }
      await apiFetch(`/api/paddocks/${paddock.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ technical_data: updatedTd }),
      })
      toast.success('Composición botánica guardada')
      setSpeciesOpen(false)
      onDataRefresh()
    } catch { toast.error('Error al guardar') }
    setSpeciesSaving(false)
  }

  const handleAiApply = async (result: any, uploadedUrls?: string[]) => {
    try {
      // Normalize field names — API may return different shapes
      const dryMatter = result.dry_matter_kg_ha
        ?? result.estimated_dry_matter_kg_ha
        ?? result.forage_availability_kg_ha

      const species = Array.isArray(result.predominant_species) && result.predominant_species.length
        ? result.predominant_species.join(', ')
        : result.dominant_species || result.pasture_type || null

      const heightCm  = result.grass_height_cm ?? result.average_height_cm
      const coverPct  = result.coverage_pct    ?? result.ground_cover_percentage
      const protein   = result.protein_content_pct
      const stage     = result.phenological_stage ?? result.growth_stage
      const status    = result.pasture_status

      const updatedTd = {
        ...td,
        dominant_species:    species || td.dominant_species,
        phenological_stage:  stage   || td.phenological_stage,
        coverage_pct:        coverPct  ?? td.coverage_pct,
        protein_content_pct: protein   ?? td.protein_content_pct,
        last_ai_analysis_at: new Date().toISOString(),
      }

      // Build a non-empty content string — using normalized values
      const contentParts: string[] = []
      if (dryMatter)  contentParts.push(`MS estimada: ${Math.round(dryMatter).toLocaleString('es')} kg/ha`)
      if (species)    contentParts.push(`Especie: ${species}`)
      if (heightCm)   contentParts.push(`Altura: ${heightCm} cm`)
      if (protein)    contentParts.push(`Proteína: ${protein}%`)
      if (coverPct)   contentParts.push(`Cobertura: ${coverPct}%`)
      if (stage)      contentParts.push(`Estado: ${stage}`)
      if (status)     contentParts.push(`Pastura: ${status}`)
      if (result.recommendation) contentParts.push(`Recomendación: ${result.recommendation}`)
      if (!contentParts.length)  contentParts.push('Análisis completado con IA Gemini')

      const patchRes = await apiFetch(`/api/paddocks/${paddock.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          dry_matter_kg_ha: dryMatter ?? Number(paddock.dry_matter_kg_ha),
          technical_data: updatedTd,
        }),
      })

      if (patchRes.ok && dryMatter != null) {
        // Optimistic sync so header KPI chips update before the list reload
        setMsInput(String(Math.round(dryMatter)))
      }

      await apiFetch('/api/field-notes', {
        method: 'POST',
        body: JSON.stringify({
          title:      `Análisis IA · ${paddock.name}`,
          category:   'general',
          paddock_id: paddock.id,
          content:    contentParts.join('. '),
          photo_url:  uploadedUrls?.[0] || null,
          photo_urls: uploadedUrls?.length ? uploadedUrls : null,
        }),
      })
      toast.success('Análisis IA aplicado')
      onDataRefresh()
    } catch {
      toast.error('Error al aplicar análisis')
    }
    setAiModalOpen(false)
  }

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-4xl">

      {/* ── Datos operativos con toggle Editar/Guardar ─────────────────────── */}
      <SectionCard
        title="Datos operativos"
        action={
          editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditing(false)
                  setNameInput(paddock.name || '')
                  setMsInput(String(paddock.dry_matter_kg_ha || ''))
                  setAreaInput(String(paddock.area_ha || ''))
                }}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMs}
                disabled={savingMs}
                className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-all"
              >
                {savingMs ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Guardar'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
            >
              Editar
            </button>
          )
        }
      >
        {editing ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Nombre</p>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Nombre del potrero"
                className={FIELD}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Superficie (ha)</p>
              <input
                type="number"
                min="0"
                step="0.1"
                value={areaInput}
                onChange={e => setAreaInput(e.target.value)}
                placeholder="ha"
                className={FIELD}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Materia Seca (kg/ha)</p>
              <input
                type="number"
                min="0"
                step="50"
                value={msInput}
                onChange={e => setMsInput(e.target.value)}
                placeholder="kg MS/ha"
                className={FIELD}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <DataField label="Nombre" value={paddock.name} />
            <DataField label="Superficie" value={`${Number(paddock.area_ha || 0).toFixed(1)} ha`} highlight />
            <DataField
              label="Materia Seca"
              value={paddock.dry_matter_kg_ha ? `${Number(paddock.dry_matter_kg_ha).toLocaleString('es')} kg/ha` : '—'}
              highlight
            />
            {paddock.area_ha > 0 && paddock.dry_matter_kg_ha > 0 && (
              <DataField
                label="Total MS"
                value={`${Math.round(Number(paddock.area_ha) * Number(paddock.dry_matter_kg_ha)).toLocaleString('es')} kg`}
                highlight
              />
            )}
            {sat?.averageNdvi != null && (
              <DataField label="NDVI actual" value={sat.averageNdvi.toFixed(3)} />
            )}
            {sat?.captureDate && (
              <DataField label="Fecha NDVI" value={new Date(sat.captureDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })} />
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Análisis IA ───────────────────────────────────────── */}
      <SectionCard title="Análisis IA de Pasto">
        {td.last_ai_analysis_at ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-green-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Último análisis: {new Date(td.last_ai_analysis_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              {td.dominant_species    && <DataField label="Especie dominante"  value={td.dominant_species}           />}
              {td.phenological_stage  && <DataField label="Estado fenológico"   value={td.phenological_stage}         />}
              {td.coverage_pct != null && <DataField label="Cobertura"          value={`${td.coverage_pct}%`}         />}
              {td.protein_content_pct != null && <DataField label="Proteína"    value={`${td.protein_content_pct}%`} />}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin análisis realizado aún.</p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setAiModalOpen(true)}
            className="px-4 py-1.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all"
          >
            Analizar con IA
          </button>
        </div>
        <AICameraModal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          title={`Estimar materia seca: ${paddock.name}`}
          mode="biomass"
          onApply={handleAiApply}
          lat={centroid()?.lat}
          lng={centroid()?.lng}
        />
      </SectionCard>

      {/* ── Composición Botánica INTA — dropdown multi-selección + Guardar ── */}
      <SectionCard
        title="Composición Botánica"
        action={
          selectedSpecies.length > 0 && !speciesOpen ? (
            <button
              onClick={handleSaveSpecies}
              disabled={speciesSaving}
              className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-all"
            >
              {speciesSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Guardar'}
            </button>
          ) : undefined
        }
      >
        {!hasGeom ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Este potrero no tiene polígono dibujado. La consulta a INTA requiere coordenadas geográficas.
            </p>
          </div>
        ) : intaLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Consultando base de datos INTA Pasturas…
          </div>
        ) : intaSpecies.length > 0 ? (
          <div className="space-y-3">
            {/* Trigger — shows selected pills or placeholder */}
            <button
              type="button"
              onClick={() => setSpeciesOpen(v => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-all text-left"
            >
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {selectedSpecies.length > 0 ? (
                  selectedSpecies.map(sp => (
                    <span
                      key={sp}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full italic"
                    >
                      {sp}
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); setSelectedSpecies(prev => prev.filter(s => s !== sp)) }}
                        className="ml-0.5 text-green-400 hover:text-green-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">Seleccioná una o más especies…</span>
                )}
              </div>
              <svg
                className={clsx('w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform', speciesOpen ? 'rotate-180' : '')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown list */}
            {speciesOpen && (
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm">
                {intaSpecies.map(sp => {
                  const checked = selectedSpecies.includes(sp)
                  return (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => {
                        setSelectedSpecies(prev =>
                          prev.includes(sp) ? prev.filter(s => s !== sp) : [...prev, sp]
                        )
                      }}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors',
                        checked ? 'bg-green-50 text-green-800 font-bold' : 'hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      <span className="italic">{sp}</span>
                      {checked && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Save + Done buttons when dropdown is open */}
            {speciesOpen && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveSpecies}
                  disabled={speciesSaving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-all"
                >
                  {speciesSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Guardar selección'}
                </button>
                <button
                  type="button"
                  onClick={() => setSpeciesOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin datos botánicos para esta región.</p>
        )}
      </SectionCard>

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB B — INFRAESTRUCTURA
// ══════════════════════════════════════════════════════════════════════════════

function TabInfraestructura({ paddock, onDataRefresh }: { paddock: any; onDataRefresh: () => void }) {
  const td = paddock.technical_data || {}
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    hasWater:      Boolean(td.hasWater || td.has_water_point),
    waterType:     String(td.waterType || td.water_type || ''),
    fencing_ok:    Boolean(td.fencing_ok),
    has_shade:     Boolean(td.has_shade || td.hasShade),
    hasPests:      Boolean(td.hasPests || (td.weed_types?.length ?? 0) > 0),
    weedNotes:     String(td.weed_notes || td.weedNotes || ''),
    hasPredators:  Boolean(td.hasPredators || td.has_predators),
    predatorNotes: String(td.predator_notes || td.predatorNotes || ''),
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/paddocks/${paddock.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          technical_data: {
            ...td,
            hasWater: form.hasWater, waterType: form.waterType,
            fencing_ok: form.fencing_ok, has_shade: form.has_shade,
            hasPests: form.hasPests, weed_notes: form.weedNotes,
            hasPredators: form.hasPredators, predator_notes: form.predatorNotes,
          },
        }),
      })
      toast.success('Infraestructura guardada')
      onDataRefresh()
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-5">
      <SectionCard title="Infraestructura del potrero">
        <div className="space-y-4">
          <ToggleRow label="Punto de agua" description="Bebedero, tajamar, río o acequia accesible"
            checked={form.hasWater} onChange={v => setForm(f => ({ ...f, hasWater: v }))}>
            {form.hasWater && (
              <input className={clsx(FIELD, 'mt-2 text-xs')} placeholder="Tipo: tajamar, bebedero, arroyo…"
                value={form.waterType} onChange={e => setForm(f => ({ ...f, waterType: e.target.value }))} />
            )}
          </ToggleRow>
          <ToggleRow label="Alambrado en buen estado" description="Perimetral e interno en condiciones adecuadas"
            checked={form.fencing_ok} onChange={v => setForm(f => ({ ...f, fencing_ok: v }))} />
          <ToggleRow label="Sombra disponible" description="Montes, cortinas forestales o reparo natural"
            checked={form.has_shade} onChange={v => setForm(f => ({ ...f, has_shade: v }))} />
          <ToggleRow label="Malezas presentes" description="Especies invasoras o tóxicas detectadas" alert
            checked={form.hasPests} onChange={v => setForm(f => ({ ...f, hasPests: v }))}>
            {form.hasPests && (
              <input className={clsx(FIELD, 'mt-2 text-xs')} placeholder="Ej: cardos, vinagrillos, senecio…"
                value={form.weedNotes} onChange={e => setForm(f => ({ ...f, weedNotes: e.target.value }))} />
            )}
          </ToggleRow>
          <ToggleRow label="Depredadores detectados" description="Zorros, pumas u otros con presencia activa" alert
            checked={form.hasPredators} onChange={v => setForm(f => ({ ...f, hasPredators: v }))}>
            {form.hasPredators && (
              <input className={clsx(FIELD, 'mt-2 text-xs')} placeholder="Tipo de depredador y frecuencia…"
                value={form.predatorNotes} onChange={e => setForm(f => ({ ...f, predatorNotes: e.target.value }))} />
            )}
          </ToggleRow>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 w-full py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar infraestructura'}
        </button>
      </SectionCard>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB C — MÉTRICAS
// ══════════════════════════════════════════════════════════════════════════════

function TabMetricas({ paddock, sat, hasGeom, ndviLoading }: {
  paddock: any; sat?: SatelliteData; hasGeom: boolean; ndviLoading: boolean
}) {
  const ms       = Number(paddock.dry_matter_kg_ha) || 0
  const msHistory = generateMsHistory(ms)
  const ndviHistory = generateNdviHistory(sat?.averageNdvi)

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-5">

      {/* KPIs de crecimiento */}
      <SectionCard title="Tasas de crecimiento">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <DataField label="Crecimiento diario"  value={ms > 0 ? `${(ms * 0.012).toFixed(1)} kg/ha/día` : '—'} highlight />
          <DataField label="Crecimiento mensual" value={ms > 0 ? `${Math.round(ms * 0.012 * 30).toLocaleString('es')} kg/ha` : '—'} highlight />
          <DataField label="Días de descanso est." value={ms > 0 ? `${Math.round(1 / 0.012)} días` : '—'} />
        </div>
      </SectionCard>

      {/* ── Gráfico financiero de pasto — fondo BLANCO ────────── */}
      <SectionCard title="Evolución de materia seca" action={
        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">kg MS/ha · estimado</span>
      }>
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden h-56">
          <FinancialChart data={msHistory} />
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Curva estimada de disponibilidad de pasto. Los datos reales se integrarán con mediciones periódicas.
        </p>
      </SectionCard>

      {/* NDVI */}
      <SectionCard title="Índice NDVI">
        {!hasGeom ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              El índice NDVI satelital está disponible solo para potreros con polígono dibujado.
            </p>
          </div>
        ) : ndviLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando NDVI satelital…
          </div>
        ) : sat ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <DataField label="NDVI actual" value={sat.averageNdvi != null ? sat.averageNdvi.toFixed(3) : '—'} highlight />
              <DataField label="MS estimada por NDVI" value={sat.estimatedAvailableDryMatterHa != null ? `${Math.round(sat.estimatedAvailableDryMatterHa).toLocaleString('es')} kg/ha` : '—'} />
              <DataField label="Cobertura verdácea" value={sat.grazableAreaPct != null ? `${sat.grazableAreaPct.toFixed(0)}%` : '—'} />
            </div>
            {/* NDVI chart — white background */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden h-36">
              <NdviChart data={ndviHistory} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin datos NDVI disponibles para este potrero.</p>
        )}
      </SectionCard>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB D — BITÁCORA (con BitacoraModal multimedia real)
// ══════════════════════════════════════════════════════════════════════════════

function TabBitacora({ paddock, user, refreshKey }: { paddock: any; user: any; refreshKey?: number }) {
  const [notes, setNotes]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setNotes([]) // clear stale notes before fetch
    try {
      const res = await apiFetch(`/api/field-notes?paddock_id=${paddock.id}&limit=40`)
      if (res.ok) {
        const d = await res.json()
        // Normalise: accept both {notes:[]} and {data:[]} shapes
        setNotes(d.notes || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }, [paddock.id])

  // Re-fetch when paddock changes OR when parent calls onDataRefresh (refreshKey bumps)
  useEffect(() => { load() }, [load, refreshKey])

  const handleDelete = async (id: string, isPending: boolean) => {
    try {
      if (isPending) {
        // Remove from local state only
        setNotes(prev => prev.filter(n => n.id !== id))
      } else {
        await apiFetch(`/api/field-notes/${id}`, { method: 'DELETE' })
        toast.success('Nota eliminada')
        await load()
      }
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl space-y-5">

      {/* ── Nuevo registro — abre BitacoraModal real ──────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Nuevo registro</h3>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-500 mb-3">
            Registrá movimientos, observaciones, fotos o notas de voz para este potrero.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all"
          >
            Agregar registro
          </button>
        </div>
      </div>

      {/* ── Historial ───────────────────────────────────── */}
      <SectionCard title="Historial de actividad">
        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}
        {!loading && notes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Sin registros en la bitácora de este potrero.</p>
        )}
        {!loading && (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="border border-gray-100 rounded-xl px-4 py-3 bg-white hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{note.title}</p>
                    {note.content && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{note.content}</p>
                    )}
                    {/* Audio badge */}
                    {note.audio_url && (
                      <div className="mt-2">
                        <audio controls src={note.audio_url} className="h-8 w-full max-w-[260px]" />
                      </div>
                    )}
                    {/* Photo thumbnails */}
                    {(note.photo_url || (note.photo_urls?.length > 0)) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(note.photo_urls || [note.photo_url]).filter(Boolean).map((url: string, i: number) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={url} alt="Foto" className="h-20 w-auto rounded-lg object-cover border border-gray-100" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    {note.category && (
                      <span className="text-[8px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        {note.category}
                      </span>
                    )}
                    <p className="text-[9px] text-gray-300">
                      {note.created_at ? new Date(note.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : ''}
                    </p>
                    <button
                      onClick={() => handleDelete(note.id, !!note.is_pending)}
                      className="mt-1 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Modal multimedia real (fotos, audio, offline) ────── */}
      <BitacoraModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { load() }}
        user={user}
        initialPaddockId={paddock.id}
        initialPaddockName={paddock.name}
        paddocks={[{ id: paddock.id, name: paddock.name }]}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ATOMS & CHARTS
// ══════════════════════════════════════════════════════════════════════════════

function ToggleRow({ label, description, checked, onChange, children, alert }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
  children?: React.ReactNode; alert?: boolean
}) {
  return (
    <div className={clsx(
      'rounded-xl border p-3.5 transition-all',
      checked && alert ? 'bg-red-50/50 border-red-100' : checked ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">{label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={clsx(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200',
            checked
              ? alert ? 'bg-red-500 border-red-500' : 'bg-green-500 border-green-500'
              : 'bg-gray-200 border-gray-200'
          )}
        >
          <span className={clsx(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200',
            checked ? 'translate-x-4' : 'translate-x-0'
          )} />
        </button>
      </div>
      {children}
    </div>
  )
}

// ── Gráfico financiero estilo TradingView (SVG nativo) ───────────────────────

interface CandlePoint { t: number; open: number; close: number; high: number; low: number }

function FinancialChart({ data }: { data: CandlePoint[] }) {
  if (!data.length) return null
  const W = 700, H = 220
  // Left pad wide enough for Y-axis labels (e.g. "2,400")
  const pad = { t: 14, b: 32, l: 54, r: 12 }
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b
  const values = data.flatMap(d => [d.high, d.low])
  const rawMin = Math.min(...values), rawMax = Math.max(...values)
  // Nice round ticks for Y axis
  const yRange = rawMax - rawMin || 500
  const yMin = Math.floor((rawMin - yRange * 0.08) / 100) * 100
  const yMax = Math.ceil((rawMax  + yRange * 0.08) / 100) * 100
  const range = yMax - yMin || 1
  const toX   = (i: number) => pad.l + (i / (data.length - 1)) * pw
  const toY   = (v: number) => pad.t + ((yMax - v) / range) * ph

  // Y ticks: ~5 evenly spaced nice round values
  const yTickCount = 5
  const yStep = Math.ceil((yMax - yMin) / (yTickCount - 1) / 100) * 100
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + yStep * 0.1; v += yStep) yTicks.push(v)

  // X ticks: every ~7 points (weekly)
  const xStep = Math.max(1, Math.floor(data.length / 5))
  const xTicks = data
    .map((d, i) => ({ i, t: d.t }))
    .filter((_, i) => i % xStep === 0 || i === data.length - 1)

  const areaPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.close).toFixed(1)}`).join(' ')
    + ` L${toX(data.length - 1).toFixed(1)},${H - pad.b} L${pad.l},${H - pad.b} Z`
  const cw = Math.max(3, pw / data.length * 0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <rect x="0" y="0" width={W} height={H} fill="white" />
      <defs>
        <linearGradient id="fg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y grid lines + Y tick labels */}
      {yTicks.map(v => {
        const y = toY(v)
        if (y < pad.t - 2 || y > H - pad.b + 2) return null
        return (
          <g key={v}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3.5} fill="#9ca3af" fontSize="9" textAnchor="end" fontWeight="600">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString('es')}
            </text>
          </g>
        )
      })}

      {/* Y axis line */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#e5e7eb" strokeWidth="1" />
      {/* X axis line */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#e5e7eb" strokeWidth="1" />

      {/* X tick labels */}
      {xTicks.map(({ i, t }) => {
        const x = toX(i)
        const d = new Date(t)
        const label = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '')
        return (
          <text key={i} x={x} y={H - pad.b + 11} fill="#9ca3af" fontSize="8.5" textAnchor="middle" fontWeight="500">
            {label}
          </text>
        )
      })}

      {/* Y axis unit label */}
      <text x={8} y={pad.t + ph / 2} fill="#d1d5db" fontSize="7.5" textAnchor="middle" fontWeight="700"
        transform={`rotate(-90, 8, ${pad.t + ph / 2})`}>
        kg MS/ha
      </text>

      {/* Area */}
      <path d={areaPath} fill="url(#fg1)" />
      {/* Close line */}
      <polyline
        points={data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.close).toFixed(1)}`).join(' ')}
        fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Candles */}
      {data.map((d, i) => {
        const x = toX(i)
        const bull = d.close >= d.open
        const color = bull ? '#16a34a' : '#ef4444'
        return (
          <g key={i}>
            <line x1={x} y1={toY(d.high)} x2={x} y2={toY(d.low)} stroke={color} strokeWidth="0.8" opacity="0.5" />
            <rect x={x - cw / 2} y={Math.min(toY(d.open), toY(d.close))}
              width={cw} height={Math.max(1, Math.abs(toY(d.open) - toY(d.close)))}
              fill={color} opacity="0.8" rx="0.5" />
          </g>
        )
      })}
      {/* Last value callout */}
      <text x={toX(data.length - 1) - 3} y={toY(data[data.length - 1].close) - 5}
        fill="#15803d" fontSize="9" textAnchor="end" fontWeight="bold">
        {Math.round(data[data.length - 1].close).toLocaleString('es')} kg/ha
      </text>
    </svg>
  )
}

function NdviChart({ data }: { data: { t: number; value: number }[] }) {
  if (!data.length) return null
  const W = 700, H = 140
  // Left pad for Y axis labels (NDVI values like "0.65")
  const pad = { t: 12, b: 30, l: 44, r: 12 }
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b
  const vals = data.map(d => d.value)
  const rawMin = Math.min(...vals), rawMax = Math.max(...vals)
  const margin = (rawMax - rawMin) * 0.12 || 0.05
  const yMin = Math.max(0, rawMin - margin)
  const yMax = Math.min(1, rawMax + margin)
  const range = yMax - yMin || 0.1
  const toX = (i: number) => pad.l + (i / (data.length - 1)) * pw
  const toY = (v: number) => pad.t + ((yMax - v) / range) * ph

  // Y ticks: 4 values between min and max
  const yTickCount = 4
  const rawStep = (yMax - yMin) / (yTickCount - 1)
  const step = Math.ceil(rawStep * 100) / 100
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + step * 0.1; v += step) yTicks.push(parseFloat(v.toFixed(3)))

  // X ticks
  const xStep = Math.max(1, Math.floor(data.length / 4))
  const xTicks = data
    .map((d, i) => ({ i, t: d.t }))
    .filter((_, i) => i % xStep === 0 || i === data.length - 1)

  const area = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ')
    + ` L${toX(data.length - 1).toFixed(1)},${H - pad.b} L${pad.l},${H - pad.b} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <rect x="0" y="0" width={W} height={H} fill="white" />
      <defs>
        <linearGradient id="ng1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#65a30d" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#65a30d" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y grid + Y tick labels */}
      {yTicks.map(v => {
        const y = toY(v)
        if (y < pad.t - 2 || y > H - pad.b + 2) return null
        return (
          <g key={v}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad.l - 5} y={y + 3.5} fill="#9ca3af" fontSize="8.5" textAnchor="end" fontWeight="600">
              {v.toFixed(2)}
            </text>
          </g>
        )
      })}

      {/* Y axis line */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#e5e7eb" strokeWidth="1" />
      {/* X axis line */}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#e5e7eb" strokeWidth="1" />

      {/* X tick labels */}
      {xTicks.map(({ i, t }) => {
        const x = toX(i)
        const d = new Date(t)
        const label = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '')
        return (
          <text key={i} x={x} y={H - pad.b + 11} fill="#9ca3af" fontSize="8.5" textAnchor="middle" fontWeight="500">
            {label}
          </text>
        )
      })}

      {/* Y unit label */}
      <text x={7} y={pad.t + ph / 2} fill="#d1d5db" fontSize="7" textAnchor="middle" fontWeight="700"
        transform={`rotate(-90, 7, ${pad.t + ph / 2})`}>
        NDVI
      </text>

      {/* Area + line */}
      <path d={area} fill="url(#ng1)" />
      <polyline points={data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ')}
        fill="none" stroke="#65a30d" strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.value)} r="2" fill="#65a30d" opacity="0.9" />
      ))}
      {/* Last value callout */}
      <text x={toX(data.length - 1) - 3} y={toY(data[data.length - 1].value) - 5}
        fill="#4d7c0f" fontSize="9" textAnchor="end" fontWeight="bold">
        {data[data.length - 1].value.toFixed(3)}
      </text>
    </svg>
  )
}

// ── Helpers de datos mock ─────────────────────────────────────────────────────

function generateMsHistory(currentMs: number): CandlePoint[] {
  const base = currentMs > 0 ? currentMs : 1200
  return Array.from({ length: 28 }, (_, i) => {
    const trend = 1 + (i - 14) * 0.014
    const noise = (Math.random() - 0.5) * base * 0.1
    const close = Math.max(200, base * trend + noise)
    const open  = close * (1 + (Math.random() - 0.5) * 0.04)
    const high  = Math.max(open, close) * (1 + Math.random() * 0.025)
    const low   = Math.min(open, close) * (1 - Math.random() * 0.025)
    return { t: i, open, close, high, low }
  })
}

function generateNdviHistory(current?: number): { t: number; value: number }[] {
  const base = current ?? 0.45
  return Array.from({ length: 12 }, (_, i) => ({
    t: i,
    value: Math.min(0.9, Math.max(0.1, base + (Math.random() - 0.5) * 0.1 + (i - 6) * 0.004)),
  }))
}
