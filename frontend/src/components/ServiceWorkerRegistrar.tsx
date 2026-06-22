'use client'

/**
 * ServiceWorkerRegistrar
 * Registra el SW custom (/sw.js) en el cliente.
 * Componente separado para no convertir layout.tsx en 'use client'.
 *
 * Después de registrar exitosamente:
 *  1. Si hay nueva versión, se activa en segundo plano (SKIP_WAITING)
 *  2. Pre-cachea rutas del dashboard para carga offline instantánea
 */

import { useEffect } from 'react'

// Rutas principales del dashboard para pre-cachear
const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/mi-campo',
  '/dashboard/herds',
  '/dashboard/agenda',
  '/dashboard/bitacora',
  '/dashboard/tareas',
  '/dashboard/calculadora',
  '/dashboard/grazing',
  '/dashboard/profile',
]

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
              // Nueva versión disponible — activar sin recargar
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        console.log('[SW] Registrado:', registration.scope)

        // Pre-cachear rutas del dashboard después de un delay
        // (solo si ya hay un SW activo controlando la página)
        if (navigator.serviceWorker.controller) {
          setTimeout(() => {
            navigator.serviceWorker.controller?.postMessage({
              type: 'PRECACHE_ROUTES',
              routes: DASHBOARD_ROUTES,
            })
          }, 5000) // Esperar 5s para no competir con el render inicial
        }

        // Si es la primera vez (no hay controller), esperar a que el SW tome control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          setTimeout(() => {
            navigator.serviceWorker.controller?.postMessage({
              type: 'PRECACHE_ROUTES',
              routes: DASHBOARD_ROUTES,
            })
          }, 3000)
        }, { once: true })

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
