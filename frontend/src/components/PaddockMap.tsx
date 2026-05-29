'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import L from 'leaflet'
import { useAuth } from '@/components/AuthProvider'
import { usePlan } from '@/hooks/usePlan'
import { apiFetch } from '@/lib/apiFetch'
import { area } from '@turf/area'
import { toast } from 'sonner'
import { Lock, Upload, Map, Search, Plus, Link2, X, Check, Loader2, AlertTriangle } from 'lucide-react'
import { parseKmlFile } from '@/lib/kmlParser'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

// ─── Geoman toolbar: create / delete / edit ───────────────────────────────────
function GeomanControl({ onPaddockDrawn }: { onPaddockDrawn: (geojson: any, layer: any) => void }) {
  const map = useMap()

  useEffect(() => {
    map.pm.setLang('es')
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawMarker: false,
      drawText: false,
      editControls: true,
      removalMode: true,
      cutPolygon: false,
    })

    const handleCreate = (e: any) => {
      onPaddockDrawn(e.layer.toGeoJSON(), e.layer)
    }
    map.on('pm:create', handleCreate)

    const handleRemove = async (e: any) => {
      const id = e.layer.feature?.properties?.id
      if (id) {
        await apiFetch(`/api/paddocks/${id}`, { method: 'DELETE' })
      }
    }
    map.on('pm:remove', handleRemove)

    // Persist geometry edits automatically
    const handleLayerAdd = (e: any) => {
      if (e.layer?.pm) {
        e.layer.on('pm:update', async (x: any) => {
          const id = x.layer.feature?.properties?.id
          if (!id) return
          const newGeo = x.layer.toGeoJSON()
          const { area: turfArea } = await import('@turf/area')
          const newArea = turfArea(newGeo) / 10000
          await apiFetch(`/api/paddocks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ geojson: newGeo.geometry, area_ha: newArea }),
          })
        })
      }
    }
    map.on('layeradd', handleLayerAdd)

    return () => {
      map.pm.removeControls()
      map.off('pm:create', handleCreate)
      map.off('pm:remove', handleRemove)
      map.off('layeradd', handleLayerAdd)
    }
  }, [map, onPaddockDrawn])

  return null
}

// ─── Fit map to loaded paddocks ───────────────────────────────────────────────
function FitBounds({ geoData }: { geoData: any }) {
  const map = useMap()
  useEffect(() => {
    if (geoData?.features?.length > 0) {
      try {
        map.fitBounds(L.geoJSON(geoData).getBounds(), { padding: [50, 50], maxZoom: 16 })
      } catch (e) { console.error('fitBounds error', e) }
    }
  }, [map, geoData])
  return null
}

// ─── Location search bar ──────────────────────────────────────────────────────
function MapSearch() {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data?.length > 0) {
        map.flyTo([data[0].lat, data[0].lon], 14)
      } else {
        toast.error('Lugar no encontrado. Intentá con ciudad y provincia (ej: Tandil, Buenos Aires).')
      }
    } catch (e) { console.error(e) }
    setSearching(false)
  }

  return (
    <div className="absolute top-4 left-16 z-[1000]">
      <form onSubmit={handleSearch} className="flex bg-white rounded-md shadow-md overflow-hidden border border-gray-200">
        <input
          type="text"
          placeholder="Buscar zona o ciudad..."
          className="px-3 py-2 w-64 outline-none text-sm text-gray-900 bg-white"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={searching} className="bg-green-600 text-white px-3 flex items-center justify-center hover:bg-green-700 disabled:opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      </form>
    </div>
  )
}

// ─── NDVI helper ──────────────────────────────────────────────────────────────
const getNdviStatus = (ndvi: number) => {
  if (ndvi >= 0.5) return { label: 'Óptimo', color: 'bg-green-100 text-green-800 border-green-200' }
  if (ndvi >= 0.3) return { label: 'Medio',  color: 'bg-orange-100 text-orange-800 border-orange-200' }
  return { label: 'Bajo', color: 'bg-red-100 text-red-800 border-red-200' }
}

interface DraftPaddock { geojson: any; layer: any; area_ha: number }

// ─── KML Layer Renderer ─────────────────────────────────────────────────────────
function KmlLayerRenderer({
  features,
  acceptedIndices,
  onPolygonClick,
}: {
  features: ParsedKmlFeature[]
  acceptedIndices: Set<number>
  onPolygonClick: (idx: number, feat: ParsedKmlFeature) => void
}) {
  const map = useMap()
  const layersRef = useRef<Record<number, L.Layer>>({})

  useEffect(() => {
    // Clear old layers
    Object.values(layersRef.current).forEach(l => { try { map.removeLayer(l) } catch {} })
    layersRef.current = {}

    features.forEach((feat, idx) => {
      const accepted = acceptedIndices.has(idx)
      const layer = L.geoJSON(feat.geojson, {
        style: accepted
          ? { color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.4, weight: 2.5, dashArray: undefined }
          : { color: '#0891b2', fillColor: '#06b6d4', fillOpacity: 0.2, weight: 2.5, dashArray: '8, 5' },
      })

      if (!accepted) {
        layer.on('click', () => onPolygonClick(idx, feat))
        layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.4, weight: 3 }))
        layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.2, weight: 2.5 }))
      }

      // Label tooltip
      layer.bindTooltip(
        `<div style="font-weight:800;font-size:11px;color:#0e7490">${feat.name}<br/><span style="font-weight:500;font-size:10px">${feat.area_ha.toFixed(1)} ha · KML</span></div>`,
        { permanent: false, direction: 'center', className: 'kml-tooltip' }
      )

      layer.addTo(map)
      layersRef.current[idx] = layer
    })

    // Fit map to KML features if any
    if (features.length > 0) {
      try {
        const allLayers = Object.values(layersRef.current)
        const group = L.featureGroup(allLayers as L.Layer[])
        map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 16 })
      } catch {}
    }

    return () => {
      Object.values(layersRef.current).forEach(l => { try { map.removeLayer(l) } catch {} })
      layersRef.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, features, acceptedIndices])

  return null
}

// ─── KML Action Modal ──────────────────────────────────────────────────────────
function KmlActionModal({
  feature,
  existingPaddocks,
  onClose,
  onCreated,
  onAssigned,
}: {
  feature: ParsedKmlFeature
  existingPaddocks: any[]
  onClose: () => void
  onCreated: () => void
  onAssigned: () => void
}) {
  const [view, setView] = useState<'choose' | 'create' | 'assign'>('choose')

  // Create form state
  const [newName, setNewName]       = useState(feature.name)
  const [newStatus, setNewStatus]   = useState<'RESTING' | 'GRAZING'>('RESTING')
  const [newForraje, setNewForraje] = useState('')
  const [saving, setSaving]         = useState(false)

  // Assign state
  const [search, setSearch]         = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assigning, setAssigning]   = useState(false)

  const filtered = existingPaddocks.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/paddocks', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          area_ha: feature.area_ha,
          geojson: feature.geojson.geometry ?? feature.geojson,
          current_status: newStatus,
          dry_matter_kg_ha: newForraje !== '' ? Number(newForraje) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(`Error: ${err.error || 'Error desconocido'}`)
      } else {
        toast.success(`Potrero "${newName.trim()}" creado desde KML ✅`)
        onCreated()
      }
    } catch { toast.error('Error al crear el potrero') }
    setSaving(false)
  }

  const handleAssign = async () => {
    if (!selectedId) return
    setAssigning(true)
    try {
      const geomJson = feature.geojson.geometry ?? feature.geojson
      const res = await apiFetch(`/api/paddocks/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ geojson: geomJson, area_ha: feature.area_ha }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(`Error: ${err.error || 'Error desconocido'}`)
      } else {
        const name = existingPaddocks.find(p => p.id === selectedId)?.name ?? 'Potrero'
        toast.success(`Límite KML asignado a "${name}" ✅`)
        onAssigned()
      }
    } catch { toast.error('Error al asignar el polígono') }
    setAssigning(false)
  }

  return (
    <div
      className="absolute inset-0 z-[2000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[340px] max-h-[90vh] overflow-y-auto border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-black text-cyan-500 tracking-widest uppercase">Polígono KML importado</p>
            <p className="text-sm font-black text-gray-900 mt-0.5">{feature.name}</p>
            <p className="text-[11px] text-gray-500 font-medium">{feature.area_ha.toFixed(2)} ha calculadas</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Choose view */}
        {view === 'choose' && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-bold text-gray-600 text-center">¿Qué hacés con este polígono?</p>

            <button
              onClick={() => setView('create')}
              className="w-full flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all group text-left"
            >
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-green-200 transition-all">
                <Plus className="w-4 h-4 text-green-700" />
              </div>
              <div>
                <p className="text-xs font-black text-green-800">Agregar como nuevo potrero</p>
                <p className="text-[10px] text-green-600 font-normal mt-0.5">Crea un potrero nuevo con este polígono como límite</p>
              </div>
            </button>

            <button
              onClick={() => setView('assign')}
              className="w-full flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all group text-left"
            >
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-all">
                <Link2 className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <p className="text-xs font-black text-blue-800">Asignar a potrero existente</p>
                <p className="text-[10px] text-blue-600 font-normal mt-0.5">Vincula este polígono a uno de tus potreros ya creados</p>
              </div>
            </button>
          </div>
        )}

        {/* Create new paddock view */}
        {view === 'create' && (
          <div className="p-5 space-y-4">
            <button onClick={() => setView('choose')} className="text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              ← Volver
            </button>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase block mb-1.5">Nombre del potrero *</label>
              <input
                autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ej: Lote Norte"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase block mb-1.5">Estado inicial</label>
              <div className="grid grid-cols-2 gap-2">
                {(['RESTING', 'GRAZING'] as const).map(s => (
                  <button key={s} onClick={() => setNewStatus(s)}
                    className={`py-2.5 rounded-xl border text-[11px] font-black transition-all ${
                      newStatus === s
                        ? s === 'RESTING' ? 'bg-green-600 border-green-600 text-white' : 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {s === 'RESTING' ? '🌱 En descanso' : '🐄 En pastoreo'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase block mb-1.5">
                Forraje disponible <span className="font-normal normal-case">(opcional)</span>
              </label>
              <div className="relative">
                <input type="number" min="0" max="10000" step="50" value={newForraje}
                  onChange={e => setNewForraje(e.target.value)} placeholder="Ej: 1200"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">kg MS/ha</span>
              </div>
              {newForraje !== '' && Number(newForraje) > 0 && feature.area_ha > 0 && (
                <p className="text-[10px] text-green-600 font-bold mt-1 ml-1">
                  ≈ {Math.round(Number(newForraje) * feature.area_ha).toLocaleString()} kg MS totales
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-100 px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase">Área calculada</span>
              <span className="text-sm font-black text-gray-900">{feature.area_ha.toFixed(2)} ha</span>
            </div>

            <button
              onClick={handleCreate} disabled={!newName.trim() || saving}
              className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black py-3 rounded-2xl transition-all text-sm shadow-lg shadow-green-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : <><Check className="w-4 h-4" /> Crear potrero</>}
            </button>
          </div>
        )}

        {/* Assign to existing view */}
        {view === 'assign' && (
          <div className="p-5 space-y-3">
            <button onClick={() => setView('choose')} className="text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              ← Volver
            </button>

            {existingPaddocks.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-500">No tenés potreros creados</p>
                <p className="text-[10px] text-gray-400 mt-1">Primero creá un potrero y después asigná el polígono.</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar potrero..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Sin resultados</p>}
                  {filtered.map(p => (
                    <button key={p.id} onClick={() => setSelectedId(p.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                        selectedId === p.id
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${p.current_status === 'GRAZING' ? 'bg-orange-400' : 'bg-green-500'}`} />
                        <span className="text-xs font-bold">{p.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium shrink-0">{Number(p.area_ha || 0).toFixed(1)} ha</span>
                    </button>
                  ))}
                </div>

                {selectedId && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] text-amber-700 font-bold">
                      ⚠️ El límite geográfico del potrero seleccionado será reemplazado por el polígono del KML.
                    </p>
                  </div>
                )}

                <button onClick={handleAssign} disabled={!selectedId || assigning}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black py-3 rounded-2xl transition-all text-sm shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {assigning
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Asignando...</>
                    : <><Link2 className="w-4 h-4" /> Asignar polígono</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function PaddockMap() {
  const { user } = useAuth()
  const { hasFeature } = usePlan()

  const [geoData, setGeoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [boundaries, setBoundaries] = useState<any>(null)
  const [paddocksRaw, setPaddocksRaw] = useState<any[]>([]) // for assign modal list

  // Stable layer registry: id → Leaflet layer (survives re-renders)
  const paddockLayersRef = useRef<Record<string, any>>({})
  const boundaryLayerRef = useRef<any>(null)

  // UI states
  const [draft, setDraft] = useState<DraftPaddock | null>(null)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPaddock, setSelectedPaddock] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null)
  const [editingBoundary, setEditingBoundary] = useState(false)
  const [savingBoundary, setSavingBoundary] = useState(false)
  const [activeFromDate, setActiveFromDate] = useState('')

  // KML import states
  const [mapTab, setMapTab] = useState<'map' | 'kml'>('map')
  const [kmlFeatures, setKmlFeatures] = useState<ParsedKmlFeature[]>([])
  const [kmlAccepted, setKmlAccepted] = useState<Set<number>>(new Set())
  const [kmlModalFeature, setKmlModalFeature] = useState<{ feat: ParsedKmlFeature; idx: number } | null>(null)
  const [kmlLoading, setKmlLoading] = useState(false)
  const [kmlError, setKmlError] = useState<string | null>(null)
  const kmlFileRef = useRef<HTMLInputElement>(null)

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setKmlLoading(true)
    setKmlError(null)
    const result = await parseKmlFile(file)
    setKmlLoading(false)
    if (kmlFileRef.current) kmlFileRef.current.value = ''
    if (result.error) {
      setKmlError(result.error)
      toast.error(result.error)
      return
    }
    setKmlFeatures(result.features)
    setKmlAccepted(new Set())
    toast.success(`${result.features.length} polígono${result.features.length !== 1 ? 's' : ''} importado${result.features.length !== 1 ? 's' : ''} del KML`)
  }

  const handleKmlPolygonClick = useCallback((idx: number, feat: ParsedKmlFeature) => {
    setSelectedPaddock(null) // close existing paddock panel
    setKmlModalFeature({ feat, idx })
  }, [])

  const center: [number, number] = [-34.604, -58.3805]

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const fetchPaddocks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const paddocksRes = await apiFetch('/api/paddocks?geojson=1')
    if (paddocksRes.ok) {
      const json = await paddocksRes.json()
      // Convert paddock list to GeoJSON FeatureCollection
      const features = (json.paddocks || []).filter((p: any) => p.boundary).map((p: any) => ({
        type: 'Feature',
        geometry: p.boundary,
        properties: {
          id: p.id, name: p.name, status: p.current_status,
          area_ha: p.area_ha, current_ndvi: p.current_ndvi,
          is_active: p.is_active, grazable_area_ha: p.grazable_area_ha,
          dry_matter_kg_ha: p.dry_matter_kg_ha,
        }
      }))
      setGeoData({ type: 'FeatureCollection', features })
      setPaddocksRaw(json.paddocks || [])
    }

    const orgRes = await apiFetch('/api/organizations')
    if (orgRes.ok) {
      const orgJson = await orgRes.json()
      if (orgJson.organization?.boundaries) setBoundaries(orgJson.organization.boundaries)
    }

    setLoading(false)
  }, [user])

  useEffect(() => { fetchPaddocks() }, [fetchPaddocks])

  // ─── Draw new paddock ───────────────────────────────────────────────────────
  const handlePaddockDrawn = (geojson: any, layer: any) => {
    setDraft({ geojson, layer, area_ha: area(geojson) / 10000 })
    setDraftName('')
  }

  const handleSaveDraft = async () => {
    if (!draft || !draftName) return
    setSaving(true)
    const res = await apiFetch('/api/paddocks', {
      method: 'POST',
      body: JSON.stringify({
        name: draftName, area_ha: draft.area_ha,
        geojson: draft.geojson.geometry,
        current_status: 'RESTING',
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json()
      toast.error(`Error al guardar el potrero: ${err.error || 'Error desconocido'}`)
    } else {
      toast.success('Potrero guardado correctamente')
      fetchPaddocks()
    }
    draft.layer.remove()
    setDraft(null)
  }

  const handleCancelDraft = () => {
    if (draft) { draft.layer.remove(); setDraft(null) }
  }

  // ─── Edit existing paddock name ─────────────────────────────────────────────
  const handleUpdateDetails = async () => {
    if (!selectedPaddock) return
    setSaving(true)
    const res = await apiFetch(`/api/paddocks/${selectedPaddock.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('Error al actualizar el nombre del potrero')
    } else {
      toast.success('Nombre actualizado')
      setSelectedPaddock(null)
      fetchPaddocks()
    }
  }

  // ─── Edit paddock POLYGON geometry ─────────────────────────────────────────
  // Uses stable ref registry to avoid stale layer issues after re-renders
  const handleEditPaddockPolygon = (paddockId: string) => {
    const layer = paddockLayersRef.current[paddockId]
    if (!layer) {
      toast.error('No se pudo obtener la capa. Intentá refrescar el mapa.')
      return
    }
    setEditingPolygonId(paddockId)
    setSelectedPaddock(null)
    layer.pm.enable({ allowSelfIntersection: false })
    layer.once('pm:disable', () => setEditingPolygonId(null))
  }

  // ─── Toggle paddock active / inactive ──────────────────────────────────────
  const handleTogglePaddockActive = async (paddockId: string, currentlyActive: boolean) => {
    const res = await apiFetch(`/api/paddocks/${paddockId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !currentlyActive }),
    })
    if (!res.ok) { toast.error('Error al cambiar estado del potrero'); return }
    fetchPaddocks()
    setSelectedPaddock(null)
    setActiveFromDate('')
  }

  // ─── Edit field boundary ────────────────────────────────────────────────────
  const handleEditBoundary = () => {
    if (!boundaryLayerRef.current) return
    setEditingBoundary(true)
    boundaryLayerRef.current.pm.enable()
  }

  const handleSaveBoundary = async () => {
    if (!boundaryLayerRef.current) return
    setSavingBoundary(true)
    boundaryLayerRef.current.pm.disable()
    const updatedGeoJson = boundaryLayerRef.current.toGeoJSON()
    const geom = updatedGeoJson.geometry ?? updatedGeoJson
    await apiFetch('/api/organizations', {
      method: 'PATCH',
      body: JSON.stringify({ boundaries: geom }),
    })
    setEditingBoundary(false)
    setSavingBoundary(false)
    fetchPaddocks()
  }

  // ─── GeoJSON onEachFeature ──────────────────────────────────────────────────
  const onEachFeature = (feature: any, layer: any) => {
    if (!feature.properties) return
    const { name, status, id, is_active } = feature.properties

    // Color legend: inactive=gray dashed, grazing=orange, resting=green
    const isActive = is_active !== false
    const fillColor = !isActive ? '#9ca3af' : status === 'GRAZING' ? '#f97316' : '#16a34a'
    layer.setStyle({
      color: fillColor,
      fillColor,
      fillOpacity: isActive ? 0.45 : 0.15,
      weight: isActive ? 2 : 1.5,
      dashArray: isActive ? undefined : '6,4'
    })

    // Register in stable ref map so polygon edit always gets the current layer
    paddockLayersRef.current[id] = layer

    layer.on('click', () => {
      setSelectedPaddock({ ...feature.properties, layer })
      setEditName(name)
      setActiveFromDate(feature.properties.active_from || '')
    })
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-14rem)] min-h-[500px] w-full rounded-lg overflow-hidden border border-gray-300 shadow-sm relative z-0">

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded-lg shadow text-green-600 font-semibold text-sm">Cargando mapa...</div>
        </div>
      )}

      {/* ── Tab bar: Mapa / Importar KML ── */}
      <div className="absolute top-3 right-4 z-[1001] flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-md p-1">
        <button
          onClick={() => setMapTab('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
            mapTab === 'map'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Map className="w-3 h-3" /> Mapa
        </button>
        <button
          onClick={() => setMapTab('kml')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
            mapTab === 'kml'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-3 h-3" />
          Importar KML
          {kmlFeatures.length > 0 && (
            <span className="ml-1 bg-cyan-200 text-cyan-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {kmlFeatures.length}
            </span>
          )}
        </button>
      </div>

      {/* ── KML tab: upload area ── */}
      {mapTab === 'kml' && (
        <div className="absolute top-14 right-4 z-[1001] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-md p-3 w-72">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Importar polígonos</p>
          <button
            onClick={() => kmlFileRef.current?.click()}
            disabled={kmlLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-xl text-xs font-black hover:bg-cyan-100 transition-all disabled:opacity-50"
          >
            {kmlLoading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesando KML...</>
              : <><Upload className="w-3.5 h-3.5" /> Seleccionar archivo .kml</>}
          </button>
          {kmlError && (
            <div className="mt-2 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg p-2">
              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-700 font-medium">{kmlError}</p>
            </div>
          )}
          {kmlFeatures.length > 0 && (
            <>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] font-bold text-cyan-700 mb-1.5">
                  {kmlFeatures.length} polígono{kmlFeatures.length !== 1 ? 's' : ''} importado{kmlFeatures.length !== 1 ? 's' : ''} · Hacé click en el mapa
                </p>
                <div className="space-y-1">
                  {kmlFeatures.map((f, i) => (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[10px] ${
                      kmlAccepted.has(i)
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-cyan-50 border-cyan-100 text-cyan-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${kmlAccepted.has(i) ? 'bg-green-500' : 'bg-cyan-400'}`} />
                      <span className="flex-1 font-bold truncate">{f.name}</span>
                      <span className="shrink-0 text-[9px] font-medium opacity-70">{f.area_ha.toFixed(1)} ha</span>
                      {kmlAccepted.has(i) && <Check className="w-3 h-3 text-green-600 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setKmlFeatures([]); setKmlAccepted(new Set()); setKmlError(null) }}
                className="mt-2 w-full text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors py-1"
              >
                Limpiar importación
              </button>
            </>
          )}
          <input type="file" ref={kmlFileRef} accept=".kml" className="hidden" onChange={handleKmlUpload} />
        </div>
      )}

      {/* ── KML Action Modal ── */}
      {kmlModalFeature && (
        <KmlActionModal
          feature={kmlModalFeature.feat}
          existingPaddocks={paddocksRaw}
          onClose={() => setKmlModalFeature(null)}
          onCreated={() => {
            setKmlAccepted(prev => new Set([...prev, kmlModalFeature.idx]))
            setKmlModalFeature(null)
            fetchPaddocks()
          }}
          onAssigned={() => {
            setKmlAccepted(prev => new Set([...prev, kmlModalFeature.idx]))
            setKmlModalFeature(null)
            fetchPaddocks()
          }}
        />
      )}

      {/* Boundary editing toolbar */}
      {editingBoundary && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xl border border-gray-200">
          <span className="text-xs font-bold text-gray-700">Editando perímetro del campo — arrastrá los vértices</span>
          <button onClick={handleSaveBoundary} disabled={savingBoundary} className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50">
            {savingBoundary ? 'Guardando...' : '✓ Guardar'}
          </button>
          <button onClick={() => { boundaryLayerRef.current?.pm.disable(); setEditingBoundary(false) }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">
            Cancelar
          </button>
        </div>
      )}

      {/* Polygon editing indicator */}
      {editingPolygonId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-3 bg-indigo-600 px-4 py-2.5 rounded-xl shadow-xl text-white">
          <span className="text-xs font-bold">Editando polígono — arrastrá los vértices</span>
          <button
            onClick={() => {
              paddockLayersRef.current[editingPolygonId]?.pm.disable()
              setEditingPolygonId(null)
            }}
            className="px-3 py-1.5 bg-white text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-50"
          >
            ✓ Listo
          </button>
        </div>
      )}

      {/* Field boundary edit button */}
      {boundaries && !editingBoundary && !editingPolygonId && (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <button onClick={handleEditBoundary} className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 text-xs font-bold rounded-xl shadow-md border border-gray-200 hover:bg-gray-50 transition-all">
            ✏️ Editar perímetro del campo
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-md flex flex-col gap-1">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" /><span className="text-[9px] font-bold text-gray-600">En pastoreo</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-[9px] font-bold text-gray-600">En descanso</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-400 opacity-50" style={{backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 2px,#9ca3af 2px,#9ca3af 4px)'}} /><span className="text-[9px] font-bold text-gray-600">Inactivo</span></div>
      </div>

      {/* ── Paddock edit modal ── */}
      {selectedPaddock && !editingPolygonId && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-xl shadow-xl border border-gray-200 w-80 max-h-[calc(100%-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-sm text-gray-900">Detalles del Potrero</h3>
            <button onClick={() => setSelectedPaddock(null)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 text-xs">✕</button>
          </div>

          <div className="p-4 space-y-3">
            {/* Name input */}
            <div>
              <label className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Nombre</label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:ring-1 focus:ring-green-600 outline-none"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
            </div>

            {/* Area summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-2 text-center">
                <p className="text-[9px] text-gray-400 font-black uppercase">Área</p>
                <p className="text-sm font-black text-gray-900">{Number(selectedPaddock.area_ha || 0).toFixed(1)} ha</p>
              </div>
              <div className="bg-green-50 rounded-lg border border-green-100 p-2 text-center">
                <p className="text-[9px] text-green-500 font-black uppercase">Pastoreable</p>
                <p className="text-sm font-black text-green-800">{Number(selectedPaddock.grazable_area_ha || selectedPaddock.area_ha || 0).toFixed(1)} ha</p>
              </div>
            </div>

            {/* Active / Inactive toggle */}
            <div className={`rounded-xl border p-3 ${selectedPaddock.is_active !== false ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">Estado del potrero</p>
                  <p className={`text-[10px] font-bold mt-0.5 ${selectedPaddock.is_active !== false ? 'text-green-600' : 'text-gray-400'}`}>
                    {selectedPaddock.is_active !== false ? '● Activo' : '○ Inactivo'}
                  </p>
                </div>
                <button
                  onClick={() => handleTogglePaddockActive(selectedPaddock.id, selectedPaddock.is_active !== false)}
                  className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${selectedPaddock.is_active !== false ? 'bg-green-400' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-all ${selectedPaddock.is_active !== false ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Reactivation date (shows when inactive) */}
              {selectedPaddock.is_active === false && (
                <div className="mt-2 space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase">Fecha de reactivación</label>
                  <input
                    type="date"
                    value={activeFromDate}
                    onChange={e => setActiveFromDate(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-green-500 outline-none"
                  />
                  {activeFromDate && (
                    <button
                      onClick={async () => {
                        await apiFetch(`/api/paddocks/${selectedPaddock.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ is_active: false, active_from: activeFromDate }),
                        })
                        fetchPaddocks()
                        setSelectedPaddock(null)
                      }}
                      className="w-full text-[10px] font-bold bg-gray-800 text-white py-1.5 rounded-lg hover:bg-gray-700"
                    >
                      Guardar fecha de reactivación
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* NDVI */}
            {selectedPaddock.current_ndvi && (
              <div className="relative">
                <div className={`flex items-center justify-between bg-gray-50 rounded-lg border border-gray-100 px-3 py-2 transition-all ${!hasFeature('ndvi_access') ? 'opacity-50 blur-[2px]' : ''}`}>
                  <div>
                    <p className="text-[9px] text-gray-400 font-black uppercase">NDVI satelital</p>
                    <p className="text-base font-black text-gray-900">{Number(selectedPaddock.current_ndvi).toFixed(2)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getNdviStatus(selectedPaddock.current_ndvi).color}`}>
                    {getNdviStatus(selectedPaddock.current_ndvi).label}
                  </span>
                </div>
                {!hasFeature('ndvi_access') && (
                  <div className="absolute inset-0 flex items-center justify-center z-10" title="Requiere Plan Latifundio">
                    <span className="bg-white/80 backdrop-blur-sm p-1 rounded-full border border-gray-200 shadow-sm flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Edit polygon */}
            <button
              onClick={() => handleEditPaddockPolygon(selectedPaddock.id)}
              className="w-full text-xs bg-indigo-50 text-indigo-700 py-2.5 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
            >
              ✏️ Editar polígono geográfico
            </button>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => setSelectedPaddock(null)} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cerrar</button>
              <button
                onClick={handleUpdateDetails}
                disabled={saving || !editName}
                className="px-3 py-1.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar nombre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Paddock Draft Modal ── */}
      {draft && (
        <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl border border-gray-200 w-80">
          <h3 className="font-bold text-base text-gray-900 mb-4">Guardar Nuevo Potrero</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nombre del potrero *</label>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:ring-1 focus:ring-green-600 outline-none"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="Ej. Lote Norte"
              />
            </div>
            <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-[9px] text-gray-400 font-black uppercase">Área calculada</p>
              <p className="text-sm font-black text-gray-900">{draft.area_ha.toFixed(2)} ha</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 text-[10px] text-blue-700">
              Una vez creado, podés registrar aforos reales desde la sección de Potreros.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={handleCancelDraft} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSaveDraft} disabled={!draftName || saving} className="px-3 py-1.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leaflet Map ── */}
      <MapContainer center={center} zoom={15} scrollWheelZoom className="h-full w-full">
        <MapSearch />
        <FitBounds geoData={geoData} />
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <GeomanControl onPaddockDrawn={handlePaddockDrawn} />

        {boundaries && (
          <GeoJSON
            data={boundaries}
            ref={(ref: any) => { if (ref) boundaryLayerRef.current = ref }}
            style={{ color: '#374151', weight: 2, dashArray: '5,10', fillOpacity: 0, interactive: !editingBoundary }}
          />
        )}

        {geoData?.features?.length > 0 && (
          <GeoJSON
            key={JSON.stringify(geoData)}
            data={geoData}
            onEachFeature={onEachFeature}
          />
        )}

        {/* KML polygons overlay — always rendered when features are loaded */}
        {kmlFeatures.length > 0 && (
          <KmlLayerRenderer
            features={kmlFeatures}
            acceptedIndices={kmlAccepted}
            onPolygonClick={handleKmlPolygonClick}
          />
        )}
      </MapContainer>
    </div>
  )
}
