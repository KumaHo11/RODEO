'use client'

/**
 * OnboardingMapSingleton
 * ----------------------
 * Single Leaflet MapContainer that NEVER unmounts during steps 1–2.
 * Changes only its interaction mode:
 *
 *   'locate'  — Draggable pin, click-to-set location. No drawing tools.
 *   'draw'    — Pin fades out, Geoman polygon drawing auto-activates.
 *
 * Props are minimal; all real state lives in OnboardingContext via callbacks.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { PADDOCK_COLORS } from './paddockColors'
import turfArea from '@turf/area'
import type { ParsedKmlFeature } from '@/lib/kmlParser'

// Fix default Leaflet icons
if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  })
}

const greenIcon = typeof window !== 'undefined' ? new L.Icon({
  iconUrl:    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl:  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize:   [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
}) : undefined

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------
export type MapMode = 'locate' | 'draw'

export interface DrawnShape {
  id?: number
  geojson: any
  area_ha: number
  layer: L.Layer
}

export interface OnboardingMapSingletonProps {
  mode: MapMode
  // Locate mode
  location: { lat: number; lng: number; address?: string } | null
  onLocationChange: (lat: number, lng: number) => void
  // Draw mode
  drawPhase: 'paddock'               // what are we drawing?
  paddockCount: number               // for color cycling
  onShapeDrawn: (shape: DrawnShape) => void
  onMidDraw: (areaHa: number | null) => void
  onShapeEdited?: (layerId: number, geojson: any, areaHa: number) => void
  onShapeRemoved?: (layerId: number) => void
  // KML import
  kmlFeatures?: ParsedKmlFeature[]
  acceptedKmlIndices?: Set<number>
  onKmlPolygonClick?: (index: number, feature: ParsedKmlFeature) => void
}

// ------------------------------------------------------------------------------
// Inner controller — runs inside MapContainer, never re-mounts
// ------------------------------------------------------------------------------
function MapController({
  mode,
  location,
  onLocationChange,
  drawPhase,
  paddockCount,
  onShapeDrawn,
  onMidDraw,
  onShapeEdited,
  onShapeRemoved,
  kmlFeatures,
  acceptedKmlIndices,
  onKmlPolygonClick,
}: OnboardingMapSingletonProps) {
  const map           = useMap()
  const modeRef       = useRef<MapMode>(mode)
  const drawPhaseRef  = useRef(drawPhase)
  const paddockRef    = useRef(paddockCount)
  const geomanInited  = useRef(false)
  // KML layers registry: index → Leaflet layer
  const kmlLayersRef  = useRef<Record<number, L.Layer>>({})

  useEffect(() => { modeRef.current = mode },       [mode])
  useEffect(() => { drawPhaseRef.current = drawPhase }, [drawPhase])
  useEffect(() => { paddockRef.current = paddockCount }, [paddockCount])

  // -- On location set: fly map there whenever address changes ----------------
  const lastAddressRef = useRef<string>('')
  useEffect(() => {
    if (!location) return
    // Always fly when the address string changes (covers first set AND KML override)
    const addrKey = location.address ?? `${location.lat},${location.lng}`
    if (addrKey !== lastAddressRef.current) {
      lastAddressRef.current = addrKey
      map.flyTo([location.lat, location.lng], 13, { duration: 1.0 })
    }
  }, [location, map])

  // -- Click in 'locate' mode → set location --------------------------------
  useEffect(() => {
    const handler = async (e: L.LeafletMouseEvent) => {
      if (modeRef.current !== 'locate') return
      const { lat, lng } = e.latlng
      onLocationChange(lat, lng)
      // Don't pan — marker will appear at click point naturally
    }
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, onLocationChange])

  // -- Inject readable labels onto Geoman toolbar buttons -------------------
  const injectToolbarLabels = useCallback(() => {
    const LABEL_MAP: Record<string, string> = {
      'Draw Polygon':  'Criar',
      'Edit Layers':   'Editar',
      'Delete Layers': 'Eliminar',
    }
    setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.leaflet-pm-toolbar .leaflet-buttons-control-button').forEach(btn => {
        if (btn.querySelector('.rodeo-pm-label')) return
        const rawTitle = btn.getAttribute('title')
          ?? btn.querySelector('[title]')?.getAttribute('title')
          ?? ''
        const label = LABEL_MAP[rawTitle]
        if (!label) return
        const span = document.createElement('span')
        span.className = 'rodeo-pm-label'
        span.textContent = label
        Object.assign(span.style, {
          display: 'block', fontSize: '8px', fontWeight: '800', color: '#374151',
          textAlign: 'center', lineHeight: '1', marginTop: '2px',
          letterSpacing: '0.04em', pointerEvents: 'none', whiteSpace: 'nowrap',
        })
        btn.style.height = 'auto'
        btn.style.paddingBottom = '3px'
        btn.appendChild(span)
      })
    }, 350)
  }, [])

  // -- Geoman setup (once) ----------------------------------------------------
  useEffect(() => {
    if (geomanInited.current) return
    geomanInited.current = true

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false, drawPolyline: false, drawRectangle: false,
      drawCircle: false, drawCircleMarker: false, drawText: false,
      cutPolygon: false, dragMode: false, editMode: true,
      removalMode: true, drawPolygon: true,
    })
    injectToolbarLabels()

    map.pm.setGlobalOptions({ snappable: true, snapDistance: 15, allowSelfIntersection: false })

    // Mid-draw area calculation
    map.on('pm:change', (e: any) => {
      try {
        const latlngs: L.LatLng[] = e.workingLayer?.getLatLngs?.()[0] ?? []
        if (latlngs.length < 3) { onMidDraw(null); return }
        const coords = [...latlngs, latlngs[0]].map(ll => [ll.lng, ll.lat])
        const gj = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } }
        onMidDraw(parseFloat((turfArea(gj) / 10000).toFixed(1)))
      } catch { onMidDraw(null) }
    })

    map.on('pm:drawstart', () => onMidDraw(null))

    map.on('pm:create', (e: any) => {
      if (e.shape !== 'Polygon') return
      onMidDraw(null)
      const layer = e.layer as L.Polygon
      const geojson = layer.toGeoJSON()
      const area_ha = parseFloat((turfArea(geojson) / 10000).toFixed(2))

      const color = PADDOCK_COLORS[paddockRef.current % PADDOCK_COLORS.length]
      layer.setStyle({ color, fillColor: color, fillOpacity: 0.35, weight: 2, dashArray: undefined })

      const layerId = (layer as any)._leaflet_id

      layer.on('pm:edit', (evt: any) => {
        const editedLayer = evt.layer || evt.target
        const updatedGeoJSON = editedLayer.toGeoJSON()
        const updatedArea = parseFloat((turfArea(updatedGeoJSON) / 10000).toFixed(2))
        onShapeEdited?.(layerId, updatedGeoJSON.geometry || updatedGeoJSON, updatedArea)
      })

      layer.on('pm:remove', () => {
        onShapeRemoved?.(layerId)
      })

      onShapeDrawn({ id: layerId, geojson, area_ha, layer })
    })
  }, [map]) // intentionally no deps — setup runs once

  // -- KML Features rendering ------------------------------------------------
  useEffect(() => {
    // Remove old KML layers
    Object.values(kmlLayersRef.current).forEach(l => {
      try { map.removeLayer(l) } catch {}
    })
    kmlLayersRef.current = {}

    if (!kmlFeatures || kmlFeatures.length === 0) return

    kmlFeatures.forEach((feat, idx) => {
      const isAccepted = acceptedKmlIndices?.has(idx) ?? false
      const layer = L.geoJSON(feat.geojson, {
        style: isAccepted
          ? { color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.35, weight: 2, dashArray: undefined }
          : { color: '#0891b2', fillColor: '#06b6d4', fillOpacity: 0.25, weight: 2.5, dashArray: '6, 4' },
      })

      if (!isAccepted) {
        layer.on('click', () => {
          onKmlPolygonClick?.(idx, feat)
        })
        // Highlight on hover
        layer.on('mouseover', () => {
          layer.setStyle({ fillOpacity: 0.45, weight: 3 })
        })
        layer.on('mouseout', () => {
          layer.setStyle({ fillOpacity: 0.25, weight: 2.5 })
        })
      }

      layer.addTo(map)
      kmlLayersRef.current[idx] = layer
    })
   
  }, [map, kmlFeatures, acceptedKmlIndices])

  // -- Mode switching — hide/show Geoman controls ----------------------------─
  useEffect(() => {
    if (mode === 'locate') {
      map.pm.disableDraw()
      map.pm.removeControls()
    } else {
      map.pm.addControls({
        position: 'topleft',
        drawMarker: false, drawPolyline: false, drawRectangle: false,
        drawCircle: false, drawCircleMarker: false, drawText: false,
        cutPolygon: false, dragMode: false, editMode: true,
        removalMode: true, drawPolygon: true,
      })
      injectToolbarLabels()
      // Auto-start polygon drawing after a brief delay
      const t = setTimeout(() => {
        try { map.pm.enableDraw('Polygon') } catch {}
      }, 600)
      return () => clearTimeout(t)
    }
  }, [mode, map, injectToolbarLabels])

  return null
}

// ------------------------------------------------------------------------------
// Exported component — the singleton wrapper
// ------------------------------------------------------------------------------
export default function OnboardingMapSingleton(props: OnboardingMapSingletonProps) {
  const DEFAULT_CENTER: [number, number] = [-34.6037, -60.5]

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={5}
        className="w-full h-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        {/* Location pin — visible in locate mode, fades out in draw mode */}
        {props.location && greenIcon && (
          <Marker
            position={[props.location.lat, props.location.lng]}
            icon={greenIcon}
            opacity={props.mode === 'locate' ? 1 : 0.25}
            draggable={props.mode === 'locate'}
            eventHandlers={{
              dragend: (e: any) => {
                const ll = e.target.getLatLng()
                props.onLocationChange(ll.lat, ll.lng)
              },
            }}
          />
        )}

        <MapController {...props} />
      </MapContainer>

      {/* Overlay hints */}
      {props.mode === 'locate' && !props.location && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-100 rounded-2xl px-5 py-3 shadow-lg text-center">
            <p className="text-xs font-black text-gray-700">Buscá tu campo a la izquierda</p>
            <p className="text-[10px] text-gray-400 font-normal mt-0.5">o hacé click en el mapa para fijar el pin</p>
          </div>
        </div>
      )}

      {props.mode === 'locate' && props.location && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center whitespace-nowrap">
            <p className="text-[10px] font-bold text-white/90">Arrastrá el pin para ajustar la posición</p>
          </div>
        </div>
      )}

      {props.mode === 'draw' && props.drawPhase === 'paddock' && (
        <>
          {/* Context hint */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-600/90 backdrop-blur-sm border border-green-400/50 text-white rounded-2xl shadow-lg">
              <div className="w-2 h-2 rounded-full bg-green-200 animate-pulse shrink-0" />
              <p className="text-xs font-black">Dibujá potreros</p>
            </div>
          </div>

          {/* Arrow indicator pointing to Geoman Polygon tool natively on its right side */}
          <div
            className="absolute z-[1100] pointer-events-none"
            style={{ top: '80px', left: '44px' }}
          >
            <div className="flex items-center gap-1.5 animate-pulse">
              <div className="bg-green-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full whitespace-nowrap shadow-md">
                Click aquí
              </div>
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
              >
                <path d="M19 12H5M5 12L12 19M5 12L12 5" />
              </svg>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
