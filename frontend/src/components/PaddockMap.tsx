'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import L from 'leaflet'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { area } from '@turf/area'

const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
})

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
      const layer = e.layer
      const geojson = layer.toGeoJSON()
      onPaddockDrawn(geojson, layer)
    }

    map.on('pm:create', handleCreate)

    // Listen to global delete events
    const handleRemove = async (e: any) => {
      const id = e.layer.feature?.properties?.id;
      if (id) {
        const supabase = createClient()
        await supabase.from('paddocks').delete().eq('id', id)
      }
    }
    map.on('pm:remove', handleRemove)

    // Attach update listeners to layers as they are added (including GeoJSON)
    const handleLayerAdd = (e: any) => {
      if (e.layer && e.layer.pm) {
        e.layer.on('pm:update', async (x: any) => {
          const id = x.layer.feature?.properties?.id;
          if (!id) return;
          const newGeo = x.layer.toGeoJSON();
          const { area } = await import('@turf/area');
          const newArea = area(newGeo) / 10000;
          const supabase = createClient()
          await supabase.rpc('update_paddock_geom', { 
            p_id: id, 
            p_geojson: newGeo.geometry, 
            p_area_ha: newArea 
          });
        });
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

function FitBounds({ geoData }: { geoData: any }) {
  const map = useMap()
  useEffect(() => {
    if (geoData && geoData.features && geoData.features.length > 0) {
      try {
        const geoJsonLayer = L.geoJSON(geoData)
        map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: 16 })
      } catch(e) { console.error("Error fit bounds", e) }
    }
  }, [map, geoData])
  return null
}

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
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        map.flyTo([lat, lon], 14)
      } else {
        alert("Lugar no encontrado. Intenta agregar la provincia (ej: Tandil, Buenos Aires).")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSearching(false)
    }
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
        <button 
          type="submit" 
          disabled={searching}
          className="bg-green-600 text-white px-3 flex items-center justify-center hover:bg-green-700 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      </form>
    </div>
  )
}

interface DraftPaddock {
  geojson: any;
  layer: any;
  area_ha: number;
}

export default function PaddockMap() {
  const [geoData, setGeoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Modal State (Draft)
  const [draft, setDraft] = useState<DraftPaddock | null>(null)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit Modal State (Existing Paddock)
  const [selectedPaddock, setSelectedPaddock] = useState<any>(null)
  const [editName, setEditName] = useState('')

  const supabase = createClient()
  const { user } = useAuth()
  
  const fetchPaddocks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_paddocks_geojson')
    if (error) {
      console.error('Error fetching paddocks:', error)
    } else {
      setGeoData(data)
    }
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    fetchPaddocks()
  }, [fetchPaddocks])

  const handlePaddockDrawn = (geojson: any, layer: any) => {
    // Calculate area via turf logic using GeoJSON Feature
    const sqMeters = area(geojson)
    const area_ha = sqMeters / 10000
    
    setDraft({ geojson, layer, area_ha })
    setDraftName('')
  }

  const handleSaveDraft = async () => {
    if (!draft || !draftName) return
    setSaving(true)

    const { error } = await supabase.rpc('create_paddock', {
      p_name: draftName,
      p_area_ha: draft.area_ha,
      p_geojson: draft.geojson.geometry
    })
    
    setSaving(false)

    if (error) {
      console.error("Error creating paddock:", error.message, error.details || '', error.hint || '')
      alert(`Error al guardar el lote: ${error.message}`)
    } else {
      fetchPaddocks()
    }
    
    draft.layer.remove()
    setDraft(null)
  }

  const handleCancelDraft = () => {
    if (draft) {
      draft.layer.remove()
      setDraft(null)
    }
  }

  // Assuming a static center for now
  const center: [number, number] = [-34.604, -58.3805] 
  
  const getNdviStatus = (ndvi: number) => {
    if (ndvi >= 0.5) return { label: 'Óptimo', color: 'bg-green-100 text-green-800 border-green-200' }
    if (ndvi >= 0.3) return { label: 'Medio', color: 'bg-orange-100 text-orange-800 border-orange-200' }
    return { label: 'Bajo', color: 'bg-red-100 text-red-800 border-red-200' }
  }

  const getGeoQualityColor = (quality: number) => {
    if (!quality) return 'gray'
    if (quality <= 3) return '#ffb3b3' // pastel red
    if (quality <= 6) return '#ffffcc' // pastel yellow
    return '#b3ffb3' // pastel green
  }

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties) {
      const { name, status, area_ha, id } = feature.properties
      const fillColor = status === 'GRAZING' ? 'orange' : 'green'
      
      const pathOptions = { color: fillColor, fillColor: fillColor, fillOpacity: 0.5, weight: 2 }
      layer.setStyle(pathOptions)

      // Replace bindPopup with custom React state click
      layer.on('click', () => {
        setSelectedPaddock({ ...feature.properties, layer })
        setEditName(name)
      })
    }
  }

  const handleUpdateDetails = async () => {
    if (!selectedPaddock) return
    setSaving(true)
    const { error } = await supabase.rpc('update_paddock_details', {
      p_id: selectedPaddock.id,
      p_name: editName
    })
    setSaving(false)
    if (error) {
      console.error("Error updating paddock:", error.message)
      alert(`Error al actualizar: ${error.message}`)
    } else {
      setSelectedPaddock(null)
      fetchPaddocks() 
    }
  }

  return (
    <div className="h-[calc(100vh-14rem)] min-h-[500px] w-full rounded-lg overflow-hidden border border-gray-300 shadow-sm relative z-0">
      
      {/* Existing Paddock Edit Modal */}
      {selectedPaddock && (
        <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-xl border border-gray-200 w-80">
          <h3 className="font-bold text-lg text-gray-900 mb-2 border-b pb-2">Detalles del Lote</h3>
          
          <div className="space-y-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border text-gray-900 bg-white" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-gray-50 p-2 rounded border border-gray-100 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Área Geográfica</p>
                <p className="font-bold text-gray-800 text-base">{Number(selectedPaddock.area_ha).toFixed(2)} ha</p>
              </div>
              <div className="bg-green-50 p-2 rounded border border-green-100 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-green-600 uppercase font-bold tracking-tight">Área Pastoreable</p>
                <p className="font-bold text-green-800 text-base">{Number(selectedPaddock.grazable_area_ha || selectedPaddock.area_ha).toFixed(2)} ha</p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm mt-3">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight mb-2">Salud de Pastura (Satélite)</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-gray-900 leading-tight">
                    {selectedPaddock.current_ndvi ? Number(selectedPaddock.current_ndvi).toFixed(2) : '--'}
                  </p>
                  <p className="text-[10px] text-gray-400">Índice NDVI</p>
                </div>
                {selectedPaddock.current_ndvi && (
                  <div className={`px-3 py-1 rounded-full border text-xs font-bold ${getNdviStatus(selectedPaddock.current_ndvi).color}`}>
                    {getNdviStatus(selectedPaddock.current_ndvi).label}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button 
                onClick={() => {
                  selectedPaddock.layer.pm.enable();
                  setSelectedPaddock(null);
                  alert("Modo de edición activado. Arrastra los bordes del polígono y los cambios se guardarán automáticamente.");
                }} 
                className="w-full text-xs bg-indigo-50 text-indigo-700 py-2 rounded-lg font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
              >
                Editar Polígono Geográfico
              </button>
            </div>

            <div className="bg-green-50 p-2 rounded border border-green-100 italic text-[10px] text-green-700">
               📍 Use la sección "Potreros" para registrar Aforos físicos o ver biomasa satelital detallada.
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-100">
              <button onClick={() => setSelectedPaddock(null)} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cerrar</button>
              <button 
                onClick={handleUpdateDetails} 
                disabled={saving || !editName} 
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Nombre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Draft Paddock Modal */}
      {draft && (
        <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-xl border border-gray-200 w-80">
          <h3 className="font-bold text-lg text-gray-900 mb-4">Guardar Nuevo Lote</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del lote *</label>
              <input 
                type="text" 
                required 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border text-gray-900 bg-white"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="Ej. Lote Norte"
              />
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Área Calculada</p>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{draft.area_ha.toFixed(2)} hectáreas</p>
            </div>

            <div className="bg-blue-50 p-2 rounded border border-blue-100 text-[10px] text-blue-700">
               Una vez creado, podrá registrar la biomasa real (Aforo) desde la sección de Potreros para calibrar este lote.
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button 
                onClick={handleCancelDraft}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveDraft}
                disabled={!draftName || saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-green-600 font-semibold bg-white px-4 py-2 rounded-md shadow">Cargando mapa...</div>
        </div>
      )}
      <MapContainer center={center} zoom={15} scrollWheelZoom={true} className="h-full w-full">
        <MapSearch />
        <FitBounds geoData={geoData} />
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <GeomanControl onPaddockDrawn={handlePaddockDrawn} />
        {geoData && geoData.features && geoData.features.length > 0 && (
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
