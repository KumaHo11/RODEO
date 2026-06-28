/**
 * RODEO — Service Worker v6
 *
 * Estrategias:
 *  1. Precache:     App shell (manifest, íconos, offline fallback HTML, login)
 *  2. Cache-first:  Assets estáticos (/_next/static/, imágenes, fuentes)
 *  3. Network-first: Navegaciones HTML (con fallback a offline page)
 *  4. Background Sync: Envía outbox cuando la red vuelve
 *
 * IMPORTANTE: Las llamadas a /api/ NO son interceptadas por el SW.
 * Los datos offline se manejan via IndexedDB + outbox pattern.
 * Esto evita problemas con headers de Authorization.
 *
 * Versionado: Cambiá CACHE_VERSION para invalidar todas las caches.
 */

const CACHE_VERSION = 'rodeo-v9'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`

// Recursos a pre-cachear en install
const PRECACHE_URLS = [
  '/manifest.json',
  '/FaviconFondoVerde.svg',
  '/LogoHeaderVerde_1.svg',
  '/LogoInstallapp.svg',
  '/icons/icon-180.png',
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

  // ── 0. SKIP everything that isn't a simple GET ──────────────────────────
  if (request.method !== 'GET') return

  // ── 1. SKIP API calls — they carry Authorization headers that break ─────
  // when re-fetched inside the SW. IndexedDB + outbox handle offline data.
  if (url.pathname.startsWith('/api/')) return

  // ── 2. SKIP Next.js Server Actions and RSC payloads ─────────────────────
  if (request.headers.get('next-action')) return
  if (request.headers.get('accept')?.includes('text/x-component')) return
  if (request.headers.get('rsc')) return

  // ── 3. SKIP Firebase Auth / Google API requests ─────────────────────────
  if (url.hostname.includes('googleapis.com') && !url.href.startsWith('https://fonts.')) return
  if (url.hostname.includes('firebaseapp.com')) return

  // Solo interceptar requests del mismo origen y fuentes
  if (url.origin !== self.location.origin && !FONT_ORIGINS.some(o => url.href.startsWith(o))) {
    return
  }

  // ── 4. Fuentes (Google Fonts): Stale-While-Revalidate ──────────────────
  if (FONT_ORIGINS.some(o => url.href.startsWith(o))) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // ── 5. Assets estáticos Next.js: Cache-First ───────────────────────────
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|woff2?)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── 6. Navegación HTML: Network-first con fallback offline ─────────────
  // Timeout reducido a 6s para evitar fallos largos por serverless cold starts
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      networkFirst(request, DYNAMIC_CACHE, 6000).catch(async () => {
        return caches.match('/_offline') || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // ── 7. Resto (JS chunks, CSS, etc.): Stale-While-Revalidate ───────────
  // Cambiado de network-first a SWR para que los chunks carguen instantáneamente
  // desde cache mientras se revalida en background (evita bloqueos offline)
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
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

async function networkFirst(request, cacheName, timeoutMs = 6000) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeout)

    // Solo cacheamos si es exitosa o 304 (no redirecciones)
    if (response.ok || response.status === 304) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    // Red caída o timeout → intentar cache
    const matchOptions = request.mode === 'navigate' ? { ignoreSearch: true } : {}
    const cached = await caches.match(request, matchOptions)
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

  // Diagnostic report: return SW status info
  if (type === 'DIAGNOSTIC_REPORT') {
    Promise.all([
      caches.open(STATIC_CACHE).then(c => c.keys()).then(k => k.length),
      caches.open(DYNAMIC_CACHE).then(c => c.keys()).then(k => k.length),
    ]).then(([staticCount, dynamicCount]) => {
      if (event.source) {
        event.source.postMessage({
          type: 'DIAGNOSTIC_RESPONSE',
          data: {
            version: CACHE_VERSION,
            staticCached: staticCount,
            dynamicCached: dynamicCount,
            timestamp: Date.now(),
          }
        })
      }
    }).catch(() => {})
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

// ── Periodic Background Sync (Chrome/Edge only) ─────────────────────────────
// Syncs data every 30 minutes even when the app isn't active.
// Safari/Firefox ignore this — those rely on visibilitychange + online events.

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rodeo-periodic-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          // At least one tab is open — trigger sync there
          clients[0].postMessage({ type: 'SYNC_STARTED' })
        }
      })
    )
  }
})
