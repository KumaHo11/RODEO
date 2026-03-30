'use client'

import dynamic from 'next/dynamic'

// Leaflet uses 'window' object which is not available during SSR,
// so we need to dynamically import the component with ssr: false
const PaddockMap = dynamic(
  () => import('@/components/PaddockMap'),
  { ssr: false, loading: () => <div className="h-[calc(100vh-14rem)] min-h-[500px] w-full bg-gray-100 flex items-center justify-center rounded-lg border border-gray-200">Cargando Mapa...</div> }
)

export default function PaddocksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mapa de potreros</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Dibuja tus potreros sobre el mapa utilizando las herramientas de dibujo. <br/>
          una vez creados, podrás ver su área y el índice de vegetación satelital haciendo clic sobre cada uno.
        </p>
      </div>

      <div className="rounded-lg shadow">
        <PaddockMap />
      </div>
    </div>
  )
}
