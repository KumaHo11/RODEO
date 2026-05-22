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
import { Lock } from 'lucide-react'

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

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function PaddockMap() {
  const { user } = useAuth()
  const { hasFeature } = usePlan()

  const [geoData, setGeoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [boundaries, setBoundaries] = useState<any>(null)

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
      </MapContainer>
    </div>
  )
}
