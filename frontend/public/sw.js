/**
 * RODEO — Service Worker v10
 *
 * HOTFIX: Corrección crítica de pantalla en blanco en PWA.
 *
 * Problemas resueltos:
 *  1. PANTALLA BLANCA: El SW pre-cacheaba sólo el HTML pero no los
 *     chunks JS/CSS que Next.js necesita para renderizar. Ahora todos los
 *     assets de /_next/static/ se cachean con Cache-First desde la primera
 *     visita online.
 *  2. CONGELA EN SAFARI/iOS: Las respuestas "redirected" dentro de fetch
 *     para navegaciones causaban que Safari se bloqueara. Ahora se manejan
 *     explícitamente con Response.redirect().
 *  3. VERSIÓN OBSOLETA: La caché antigua nunca se purgaba si el CACHE_VERSION
 *     no cambiaba. Bumpeamos a v10 para forzar invalidación total.
 *  4. OFFLINE SIN DATOS: Se mejoró el fallback para siempre servir la página
 *     offline en lugar de un error de red crudo.
 *
 * Estrategias:
 *  - Precache:        Shell mínimo (manifest, íconos, offline HTML, login)
 *  - Cache-First:     /_next/static/ chunks (JS/CSS) e imágenes estáticas
 *  - Network-First:   Navegaciones HTML (con fallback a cache o /_offline)
 *  - SWR:             Fuentes de Google
 *  - SKIP:            /api/* — manejado por IndexedDB + outbox
 *
 * Versionado: Cambiar CACHE_VERSION invalida TODAS las cachés existentes.
 */

const CACHE_VERSION  = 'rodeo-v10'
const STATIC_CACHE   = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`

// Recursos críticos para el shell mínimo
const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/_offline',
  '/login',
]

// Dominios de fuentes permitidas
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Pre-cachear URLs críticas; silenciar errores individuales
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Precache skip: ${url}`, err.message)
          })
        )
      )
      const ok = results.filter(r => r.status === 'fulfilled').length
      console.log(`[SW v10] Precache: ${ok}/${PRECACHE_URLS.length} URLs cacheadas`)
    })
  )
  // Tomar control inmediatamente sin esperar que otros tabs cierren
  self.skipWaiting()
})

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => !name.startsWith(CACHE_VERSION))
          .map(name => {
            console.log('[SW v10] Purgando caché antigua:', name)
            return caches.delete(name)
          })
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // ── 0. Solo interceptar GET ──────────────────────────────────────────────
  if (request.method !== 'GET') return

  // ── 1. SKIP: llamadas a /api/ (manejadas por IndexedDB + outbox) ─────────
  if (url.pathname.startsWith('/api/')) return

  // ── 2. SKIP: Server Actions de Next.js ──────────────────────────────────
  if (request.headers.get('next-action')) return

  // ── 3. SKIP: Firebase / Google APIs (no fuentes) ─────────────────────────
  const isGoogleFont = FONT_ORIGINS.some(o => url.href.startsWith(o))
  if (url.hostname.includes('googleapis.com') && !isGoogleFont) return
  if (url.hostname.includes('firebaseapp.com')) return
  if (url.hostname.includes('firebasestorage.googleapis.com')) return

  // ── 4. Solo interceptar mismo origen + fuentes ──────────────────────────
  if (url.origin !== self.location.origin && !isGoogleFont) return

  // ── 5. Fuentes Google: Stale-While-Revalidate ────────────────────────────
  if (isGoogleFont) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // ── 6. Assets estáticos de Next.js: Cache-First ──────────────────────────
  //    /_next/static/ contiene chunks JS/CSS con hash en el nombre.
  //    Cache-First es ideal: una vez en caché, no cambian (el hash cambia).
  //    FIX CRÍTICO: Sin cachear estos assets, la app no puede renderizar offline.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(woff2?|ttf|eot|otf)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── 7. Imágenes y SVGs públicos: Cache-First ─────────────────────────────
  if (url.pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|gif)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── 8. Chunks JS/CSS de Next.js en /_next/ (no /static/): SWR ──────────
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
    return
  }

  // ── 9. Navegaciones HTML: Network-First con fallback a caché ─────────────
  //    FIX CRÍTICO: Usamos network-first para asegurar que el HTML siempre
  //    venga con los últimos scripts que el servidor sirve. Fallback a caché
  //    si hay error de red.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstNavigation(request, DYNAMIC_CACHE))
    return
  }

  // ── 10. Resto: Stale-While-Revalidate ────────────────────────────────────
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
})

// ── Cache Strategies ─────────────────────────────────────────────────────────

/**
 * Cache-First: Devuelve desde caché si existe, si no va a la red y guarda.
 * Ideal para assets con hash (/_next/static/) que nunca cambian.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Sin red y sin caché — devolver vacío con status 408
    return new Response('', { status: 408, statusText: 'Request Timeout' })
  }
}

/**
 * Network-First para Navegaciones: Va a la red primero.
 * FIX CLAVE para iOS/Safari: Maneja explícitamente las redirecciones
 * que Next.js hace (ej: /dashboard → /login cuando no autenticado)
 * convirtiéndolas en Response.redirect() limpio que Safari acepta.
 * Fallback: caché → página offline.
 */
async function networkFirstNavigation(request, cacheName) {
  try {
    const response = await fetch(request)

    // Safari Bug Fix: Las respuestas "redirected" en modo navigate rompen Safari PWA.
    // Hay que convertirlas en una redirección explícita.
    if (response.redirected) {
      return Response.redirect(response.url, 302)
    }

    // Sólo cachear respuestas exitosas (200 OK), nunca errores ni redirecciones
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }

    return response
  } catch {
    // Sin red: intentar caché ignorando query string (common en PWA navegación)
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached

    // Último recurso: página offline
    const offlinePage = await caches.match('/_offline')
    if (offlinePage) return offlinePage

    return new Response(
      '<html><body style="font-family:sans-serif;padding:2rem;text-align:center"><h1>Sin conexión</h1><p>Por favor verifica tu red e intenta de nuevo.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

/**
 * Stale-While-Revalidate: Devuelve caché inmediatamente y actualiza en background.
 * Ideal para fuentes y recursos que cambian poco.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached || new Response('', { status: 408 }))

  return cached || fetchPromise
}

// ── Messages ─────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type } = event.data || {}

  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (type === 'SYNC_COMPLETED') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        if (client.id !== event.source?.id) {
          client.postMessage({ type: 'SYNC_COMPLETED' })
        }
      })
    })
  }

  // Pre-cachear rutas adicionales del dashboard bajo demanda
  if (type === 'PRECACHE_ROUTES') {
    const routes = event.data.routes || []
    caches.open(DYNAMIC_CACHE).then(async (cache) => {
      for (const route of routes) {
        try {
          await cache.add(route)
        } catch {
          // Silenciar rutas que fallen (pueden necesitar autenticación)
        }
      }
      console.log(`[SW v10] Pre-cacheadas ${routes.length} rutas del dashboard`)
    })
  }

  // Reporte de diagnóstico
  if (type === 'DIAGNOSTIC_REPORT') {
    Promise.all([
      caches.open(STATIC_CACHE).then(c => c.keys()).then(k => k.length),
      caches.open(DYNAMIC_CACHE).then(c => c.keys()).then(k => k.length),
    ]).then(([staticCount, dynamicCount]) => {
      event.source?.postMessage({
        type: 'DIAGNOSTIC_RESPONSE',
        data: {
          version: CACHE_VERSION,
          staticCached: staticCount,
          dynamicCached: dynamicCount,
          timestamp: Date.now(),
        }
      })
    }).catch(() => {})
  }
})

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'rodeo-outbox-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_STARTED' })
        })
      })
    )
  }
})

// ── Periodic Background Sync (Chrome/Edge only) ───────────────────────────────
// Safari/Firefox no soportan esto. Usan visibilitychange + online events.

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rodeo-periodic-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({ type: 'SYNC_STARTED' })
        }
      })
    )
  }
})
