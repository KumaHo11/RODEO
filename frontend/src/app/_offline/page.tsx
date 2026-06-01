'use client'

/**
 * Página offline fallback — Rodeo App
 * Se sirve cuando el usuario navega a cualquier ruta del dashboard sin red
 * y el Service Worker no tiene un HTML cacheado para esa ruta exacta.
 */

import React, { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflineFallbackPage() {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = () => {
    setRetrying(true)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center max-w-sm">
        {/* Ícono */}
        <div className="w-20 h-20 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-amber-600" />
        </div>

        {/* Texto principal */}
        <h1 className="text-2xl font-black text-gray-900 mb-2">Sin conexión</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          No hay red disponible en este momento. Los datos que ya cargaste seguirán
          accesibles dentro de la app. Volvé atrás o intentá recargar cuando tengas señal.
        </p>

        {/* Acciones */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Intentando reconectar…' : 'Reintentar'}
          </button>
          <button
            onClick={() => window.history.back()}
            className="py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
          >
            ← Volver
          </button>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-gray-400 font-medium mt-6">
          Rodeo App funciona sin internet para las secciones visitadas.
        </p>
      </div>
    </div>
  )
}
