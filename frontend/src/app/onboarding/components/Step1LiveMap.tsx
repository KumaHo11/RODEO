'use client'

/**
 * Step1LiveMap — Mapa de solo lectura que reacciona a la ubicación seleccionada.
 * No tiene herramientas de dibujo. Se usa en el layout split du Step 1.
 */

import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

// Custom green pin marker
const greenIcon = typeof window !== 'undefined' ? new L.Icon({
  iconUrl:      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl:    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize:     [25, 41],
  iconAnchor:   [12, 41],
  popupAnchor:  [1, -34],
  shadowSize:   [41, 41],
}) : undefined

interface MapFlyProps {
  center: [number, number]
  zoom: number
}

function MapFly({ center, zoom }: MapFlyProps) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 })
  }, [center, zoom, map])
  return null
}

interface Props {
  location: { lat: number; lng: number } | null
  onMapClick?: (lat: number, lng: number) => void
}

export default function Step1LiveMap({ location, onMapClick }: Props) {
  const DEFAULT_CENTER: [number, number] = [-34.6037, -60.5]
  const DEFAULT_ZOOM = 5

  const center: [number, number] = location
    ? [location.lat, location.lng]
    : DEFAULT_CENTER
  const zoom = location ? 12 : DEFAULT_ZOOM

  function MapClickHandler() {
    const map = useMap()
    useEffect(() => {
      if (!onMapClick) return
      const handler = (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
      map.on('click', handler)
      return () => { map.off('click', handler) }
    }, [map])
    return null
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <MapFly center={center} zoom={zoom} />
        <MapClickHandler />
        {location && greenIcon && (
          <Marker position={[location.lat, location.lng]} icon={greenIcon} />
        )}
      </MapContainer>

      {/* Overlay label */}
      {!location && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-100 rounded-2xl px-4 py-3 shadow-lg text-center">
            <p className="text-xs font-black text-gray-700">Buscá tu campo</p>
            <p className="text-[10px] text-gray-400 font-normal mt-0.5">El mapa se va a centrar aquí</p>
          </div>
        </div>
      )}

      {location && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
            <p className="text-[10px] font-bold text-white/90">Hacé click en el mapa para ajustar el pin</p>
          </div>
        </div>
      )}
    </div>
  )
}
