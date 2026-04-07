'use client'

/**
 * OnboardingMapSingleton
 * ──────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
export type MapMode = 'locate' | 'draw'

export interface DrawnShape {
  geojson: any
  area_ha: number
  layer: L.Layer
}

export interface OnboardingMapSingletonProps {
  mode: MapMode
  // Locate mode
  location: { lat: number; lng: number } | null
  onLocationChange: (lat: number, lng: number) => void
  // Draw mode
  drawPhase: 'field' | 'paddock'     // what are we drawing?
  paddockCount: number               // for color cycling
  onShapeDrawn: (shape: DrawnShape) => void
  onMidDraw: (areaHa: number | null) => void
}

// ──────────────────────────────────────────────────────────────────────────────
// Inner controller — runs inside MapContainer, never re-mounts
// ──────────────────────────────────────────────────────────────────────────────
function MapController({
  mode,
  location,
  onLocationChange,
  drawPhase,
  paddockCount,
  onShapeDrawn,
  onMidDraw,
}: OnboardingMapSingletonProps) {
  const map           = useMap()
  const modeRef       = useRef<MapMode>(mode)
  const drawPhaseRef  = useRef(drawPhase)
  const paddockRef    = useRef(paddockCount)
  const didFlyRef     = useRef(false)       // only fly once on first location set
  const geomanInited  = useRef(false)

  useEffect(() => { modeRef.current = mode },       [mode])
  useEffect(() => { drawPhaseRef.current = drawPhase }, [drawPhase])
  useEffect(() => { paddockRef.current = paddockCount }, [paddockCount])

  // ── On location set: fly map there (only once, or if location changes) ──────
  useEffect(() => {
    if (!location) return
    if (!didFlyRef.current) {
      map.flyTo([location.lat, location.lng], 13, { duration: 1.0 })
      didFlyRef.current = true
    }
  }, [location, map])

  // ── Click in 'locate' mode → set location ────────────────────────────────
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

  // ── Geoman setup (once) ────────────────────────────────────────────────────
  useEffect(() => {
    if (geomanInited.current) return
    geomanInited.current = true

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false, drawPolyline: false, drawRectangle: false,
      drawCircle: false, drawCircleMarker: false, drawText: false,
      cutPolygon: false, dragMode: false, editMode: true,
      removalMode: false, drawPolygon: true,
    })

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

      if (drawPhaseRef.current === 'field') {
        layer.setStyle({ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 2.5, dashArray: '8, 6' })
      } else {
        const color = PADDOCK_COLORS[paddockRef.current % PADDOCK_COLORS.length]
        layer.setStyle({ color, fillColor: color, fillOpacity: 0.35, weight: 2, dashArray: undefined })
      }

      onShapeDrawn({ geojson, area_ha, layer })
    })
  }, [map]) // intentionally no deps — setup runs once

  // ── Mode switching — hide/show Geoman controls ─────────────────────────────
  useEffect(() => {
    if (mode === 'locate') {
      // Disable drawing
      map.pm.disableDraw()
      map.pm.removeControls()
    } else {
      // Enable drawing
      map.pm.addControls({
        position: 'topleft',
        drawMarker: false, drawPolyline: false, drawRectangle: false,
        drawCircle: false, drawCircleMarker: false, drawText: false,
        cutPolygon: false, dragMode: false, editMode: true,
        removalMode: false, drawPolygon: true,
      })
      // Auto-start polygon drawing after a brief delay
      const t = setTimeout(() => {
        try { map.pm.enableDraw('Polygon') } catch {}
      }, 600)
      return () => clearTimeout(t)
    }
  }, [mode, map])

  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported component — the singleton wrapper
// ──────────────────────────────────────────────────────────────────────────────
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

      {props.mode === 'draw' && props.drawPhase === 'field' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/90 backdrop-blur-sm border border-blue-400/50 text-white rounded-2xl shadow-lg">
            <div className="w-2 h-2 rounded-full bg-blue-200 animate-pulse shrink-0" />
            <p className="text-xs font-black">Hacé clic para empezar a dibujar el borde de tu campo</p>
          </div>
        </div>
      )}

      {props.mode === 'draw' && props.drawPhase === 'paddock' && (
        <>
          {/* Context hint */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-600/90 backdrop-blur-sm border border-green-400/50 text-white rounded-2xl shadow-lg">
              <div className="w-2 h-2 rounded-full bg-green-200 animate-pulse shrink-0" />
              <p className="text-xs font-black">Dibujá potreros dentro del perímetro</p>
            </div>
          </div>

          {/* Arrow indicator pointing to the polygon button (Geoman puts controls at top-left, ~44px from top) */}
          <div
            className="absolute z-[1100] pointer-events-none"
            style={{ top: '38px', left: '4px' }}
          >
            <div className="flex flex-col items-center">
              {/* Animated arrow pointing UP to the button */}
              <svg
                className="animate-bounce"
                width="18" height="22" viewBox="0 0 18 22" fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
              >
                <path d="M9 0L0 10H6V22H12V10H18L9 0Z" fill="#16a34a" />
              </svg>
              <div className="mt-1 bg-green-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
                Click aquí
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
