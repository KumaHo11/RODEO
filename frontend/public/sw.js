/**
 * RODEO — Service Worker Avanzado
 *
 * Estrategias:
 *  1. Precache:     App shell (manifest, íconos, offline fallback HTML)
 *  2. Cache-first:  Assets estáticos (/_next/static/, imágenes, fuentes)
 *  3. Network-first: Navegaciones HTML (con fallback a offline page)
 *  4. Network-first: API calls (con fallback al cache si hay timeout)
 *  5. Background Sync: Envía outbox cuando la red vuelve
 *
 * Versionado: Cambiá CACHE_VERSION para invalidar todas las caches.
 */

const CACHE_VERSION = 'rodeo-v2'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const API_CACHE     = `${CACHE_VERSION}-api`

// Recursos a pre-cachear en install
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/FaviconFondoVerde.svg',
  '/LogoHeaderVerde_1.svg',
  '/LogoInstallapp.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/_offline',
]

// Dominios de fuentes para SWR
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

// ── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Pre-cachear URLs críticas (no falla si alguna da error)
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Precache skip: ${url}`, err.message)
          })
        )
      )
      console.log('[SW] Precache done:', results.filter(r => r.status === 'fulfilled').length, '/', PRECACHE_URLS.length)
    })
  )
  // Activar inmediatamente sin esperar a que cierren otros tabs
  self.skipWaiting()
})

// ── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => !name.startsWith(CACHE_VERSION))
          .map(name => {
            console.log('[SW] Purging old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// ── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // ── 0. Never intercept Server Actions or non-GET mutations ─────────────
  // Next.js Server Actions send POST with 'next-action' header or
  // 'text/x-component' accept. Caching them breaks everything.
  if (request.method !== 'GET') return
  if (request.headers.get('next-action')) return
  if (request.headers.get('accept')?.includes('text/x-component')) return

  // Solo interceptar requests del mismo origen y HTTPS/localhost
  if (url.origin !== self.location.origin && !FONT_ORIGINS.some(o => url.href.startsWith(o))) {
    return
  }

  // ── 1. Fuentes (Google Fonts): Stale-While-Revalidate ──────────────────
  if (FONT_ORIGINS.some(o => url.href.startsWith(o))) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // ── 2. Assets estáticos Next.js: Cache-First ───────────────────────────
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|woff2?)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── 3. API calls: Network-first con timeout de 5s ─────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5000))
    return
  }

  // ── 4. Navegación HTML: Network-first con fallback offline ─────────────
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      networkFirst(request, DYNAMIC_CACHE, 8000).catch(() => {
        return caches.match('/_offline') || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // ── 5. Resto: Network-first genérico ───────────────────────────────────
  event.respondWith(networkFirst(request, DYNAMIC_CACHE, 5000))
})

// ── Cache Strategies ────────────────────────────────────────────────────────

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
    return new Response('', { status: 408 })
  }
}

async function networkFirst(request, cacheName, timeoutMs = 5000) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeout)

    if (response.ok || response.status === 304) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    // Red caída o timeout → intentar cache
    const cached = await caches.match(request)
    if (cached) return cached

    // Para navegaciones, devolver offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/_offline')
      if (offlinePage) return offlinePage
    }

    throw err
  }
}

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

// ── Messages ────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type } = event.data || {}

  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (type === 'SYNC_COMPLETED') {
    // Propagar a todos los clientes (tabs)
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        if (client.id !== event.source?.id) {
          client.postMessage({ type: 'SYNC_COMPLETED' })
        }
      })
    })
  }

  // Precachear rutas adicionales del dashboard
  if (type === 'PRECACHE_ROUTES') {
    const routes = event.data.routes || []
    caches.open(DYNAMIC_CACHE).then(async (cache) => {
      for (const route of routes) {
        try {
          await cache.add(route)
        } catch {
          // Silently skip routes that fail
        }
      }
    })
  }
})

// ── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'rodeo-outbox-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        // Notificar a los clientes para que procesen el outbox
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_STARTED' })
        })
      })
    )
  }
})
