'use client'

import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

// Fix Leaflet marker icons
if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  })
}

interface LeafletMapProps {
  center: [number, number]
  onPolygonComplete: (coords: [number, number][]) => void
  layerType?: 'osm' | 'satellite'
}

function DrawingManager({ onPolygonComplete }: { onPolygonComplete: (coords: [number, number][]) => void }) {
  const map = useMap()
  
  useEffect(() => {
    if (!map) return

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      cutPolygon: false,
      dragMode: true,
      editMode: true,
      removalMode: true,
    })

    const onDraw = (e: any) => {
      if (e.shape === 'Polygon') {
        const layer = e.layer as L.Polygon
        const latlngs = layer.getLatLngs() as L.LatLng[][] | L.LatLng[]
        const coords: [number, number][] = []
        const actualLatLngs = Array.isArray(latlngs[0]) ? (latlngs[0] as L.LatLng[]) : (latlngs as L.LatLng[])
        
        actualLatLngs.forEach(ll => {
          coords.push([ll.lng, ll.lat])
        })
        
        onPolygonComplete(coords)
        layer.setStyle({
          color: '#ffffff',
          fillColor: '#ffffff',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 5'
        })
      }
    }

    map.on('pm:create', onDraw)
    return () => { map.off('pm:create', onDraw) }
  }, [map, onPolygonComplete])

  return null
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

export default function LeafletMap({ center, onPolygonComplete, layerType = 'satellite' }: LeafletMapProps) {
  return (
    <MapContainer 
      center={center} 
      zoom={12} 
      className="w-full h-full"
      scrollWheelZoom={true}
    >
      {layerType === 'satellite' ? (
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      <MapUpdater center={center} />
      <DrawingManager onPolygonComplete={onPolygonComplete} />
    </MapContainer>
  )
}
