'use client'

import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { PADDOCK_COLORS } from './paddockColors'

// Fix Leaflet marker icons
if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  })
}

interface PaddockDrawMapProps {
  center: [number, number]
  mode: 'field' | 'paddock'
  paddockCount: number
  onShapeDrawn: (geojson: any, layer: any) => void
}

function DrawingManager({
  mode,
  paddockCount,
  onShapeDrawn,
}: {
  mode: 'field' | 'paddock'
  paddockCount: number
  onShapeDrawn: (geojson: any, layer: any) => void
}) {
  const map      = useMap()
  const modeRef  = useRef(mode)
  const countRef = useRef(paddockCount)

  useEffect(() => { modeRef.current = mode },        [mode])
  useEffect(() => { countRef.current = paddockCount }, [paddockCount])

  useEffect(() => {
    if (!map) return

    map.pm.addControls({
      position:         'topleft',
      drawMarker:       false,
      drawPolyline:     false,
      drawRectangle:    false,
      drawCircle:       false,
      drawCircleMarker: false,
      drawText:         false,
      cutPolygon:       false,
      dragMode:         false,
      editMode:         true,
      removalMode:      false,
      drawPolygon:      true,
    })

    const handleCreate = (e: any) => {
      if (e.shape !== 'Polygon') return
      const layer   = e.layer as L.Polygon
      const geojson = layer.toGeoJSON()

      if (modeRef.current === 'field') {
        // Field boundary: dashed blue outline, no fill
        layer.setStyle({
          color:       '#1d4ed8',
          fillColor:   'transparent',
          fillOpacity: 0,
          weight:      2.5,
          dashArray:   '8, 6',
        })
      } else {
        // Paddock: solid color from palette
        const color = PADDOCK_COLORS[countRef.current % PADDOCK_COLORS.length]
        layer.setStyle({
          color,
          fillColor:   color,
          fillOpacity: 0.35,
          weight:      2,
          dashArray:   undefined,
        })
      }

      onShapeDrawn(geojson, layer)
    }

    map.on('pm:create', handleCreate)
    return () => { map.off('pm:create', handleCreate) }
  }, [map, onShapeDrawn])

  return null
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.setView(center, map.getZoom()) }, [center, map])
  return null
}

export default function PaddockDrawMap({ center, mode, paddockCount, onShapeDrawn }: PaddockDrawMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      className="w-full h-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <MapUpdater center={center} />
      <DrawingManager mode={mode} paddockCount={paddockCount} onShapeDrawn={onShapeDrawn} />
    </MapContainer>
  )
}
