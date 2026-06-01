'use client'

/**
 * ServiceWorkerRegistrar
 * Registra el SW custom (/sw.js) en el cliente.
 * Componente separado para no convertir layout.tsx en 'use client'.
 * Actualización silenciosa: cuando hay nueva versión, el SW se activa
 * en la próxima carga sin interrumpir la sesión actual.
 */

import { useEffect } from 'react'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // siempre pedir la versión más reciente del sw.js
        })

        // Cuando hay una actualización disponible, activarla en segundo plano
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nueva versión disponible — activar sin recargar (el usuario seguirá en la misma página)
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        console.log('[SW] Registrado:', registration.scope)
      } catch (err) {
        console.warn('[SW] Registro fallido (no crítico):', err)
      }
    }

    // Registrar después del load para no competir con recursos críticos
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null // No renderiza nada
}
