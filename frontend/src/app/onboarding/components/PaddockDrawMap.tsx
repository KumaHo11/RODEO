'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { PADDOCK_COLORS } from './paddockColors'
import turfArea from '@turf/area'

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
  onMidDraw?: (areaHa: number | null) => void
}

function DrawingManager({
  mode,
  paddockCount,
  onShapeDrawn,
  onMidDraw,
}: {
  mode: 'field' | 'paddock'
  paddockCount: number
  onShapeDrawn: (geojson: any, layer: any) => void
  onMidDraw?: (areaHa: number | null) => void
}) {
  const map      = useMap()
  const modeRef  = useRef(mode)
  const countRef = useRef(paddockCount)

  useEffect(() => { modeRef.current = mode },        [mode])
  useEffect(() => { countRef.current = paddockCount }, [paddockCount])

  useEffect(() => {
    if (!map) return

    // Enable drawing controls with descriptive labels (we override via CSS/custom buttons)
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

    // Enable global snapping for precision
    map.pm.setGlobalOptions({
      snappable:    true,
      snapDistance: 15,
      allowSelfIntersection: false,
    })

    // Mid-draw: calculate area in real-time
    const handleDrawStart = () => {
      if (onMidDraw) onMidDraw(null)
    }

    const handleDrawChange = (e: any) => {
      if (!onMidDraw) return
      try {
        const latlngs: L.LatLng[] = e.workingLayer?.getLatLngs?.()[0] ?? []
        if (latlngs.length < 3) { onMidDraw(null); return }
        const coords = [...latlngs, latlngs[0]].map(ll => [ll.lng, ll.lat])
        const geojson = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } }
        const ha = parseFloat((turfArea(geojson) / 10000).toFixed(1))
        onMidDraw(ha)
      } catch { onMidDraw(null) }
    }

    const handleCreate = (e: any) => {
      if (e.shape !== 'Polygon') return
      if (onMidDraw) onMidDraw(null)

      const layer   = e.layer as L.Polygon
      const geojson = layer.toGeoJSON()

      if (modeRef.current === 'field') {
        layer.setStyle({
          color:       '#1d4ed8',
          fillColor:   '#3b82f6',
          fillOpacity: 0.08,
          weight:      2.5,
          dashArray:   '8, 6',
        })
      } else {
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

    map.on('pm:drawstart', handleDrawStart)
    map.on('pm:change',    handleDrawChange)
    map.on('pm:create',    handleCreate)

    return () => {
      map.off('pm:drawstart', handleDrawStart)
      map.off('pm:change',    handleDrawChange)
      map.off('pm:create',    handleCreate)
    }
  }, [map, onShapeDrawn, onMidDraw])

  return null
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.setView(center, map.getZoom()) }, [center, map])
  return null
}

export default function PaddockDrawMap({ center, mode, paddockCount, onShapeDrawn, onMidDraw }: PaddockDrawMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      className="w-full h-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <MapUpdater center={center} />
      <DrawingManager mode={mode} paddockCount={paddockCount} onShapeDrawn={onShapeDrawn} onMidDraw={onMidDraw} />
    </MapContainer>
  )
}
