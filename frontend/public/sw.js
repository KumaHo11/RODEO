/**
 * RODEO — Service Worker
 * Estrategia: NetworkFirst para navegación y APIs, CacheFirst para assets estáticos.
 * Garantiza que la app funcione completamente offline después de la primera carga.
 */

const CACHE_VERSION = 'v5'
const SHELL_CACHE   = `rodeo-shell-${CACHE_VERSION}`
const API_CACHE     = `rodeo-api-${CACHE_VERSION}`
const ASSET_CACHE   = `rodeo-assets-${CACHE_VERSION}`
const IMAGE_CACHE   = `rodeo-images-${CACHE_VERSION}`
const MAP_CACHE     = `rodeo-maps-${CACHE_VERSION}`

// Rutas del shell de la app que se pre-cachean en install
const SHELL_URLS = [
  '/',
  '/dashboard',
  '/dashboard/mi-campo',
  '/dashboard/herds',
  '/dashboard/bitacora',
  '/dashboard/bitacora/bandeja',
  '/dashboard/grazing',
  '/dashboard/insights',
  '/dashboard/planes',
  '/_offline',
  '/manifest.json',
]

// ── Install: pre-cachear el shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async cache => {
      // Usamos fetch manual con redirect:'follow' en lugar de cache.add()
      // porque cache.add() rechaza respuestas 302 (que el middleware de auth
      // devuelve para URLs protegidas) y no guarda nada en caché.
      const results = await Promise.allSettled(
        SHELL_URLS.map(async url => {
          try {
            // redirect:'follow' → si el middleware redirige a /login, seguimos
            // el redirect y cacheamos la respuesta final (la página de login o la app)
            const response = await fetch(url, { redirect: 'follow' })
            if (response && (response.ok || response.status === 0)) {
              await cache.put(url, response)
            }
          } catch (err) {
            console.warn(`[SW] No se pudo pre-cachear ${url}:`, err)
          }
        })
      )
      return results
    }).then(() => self.skipWaiting())
  )
})

// ── Activate: limpiar caches viejos ───────────────────────────────────────────
self.addEventListener('activate', event => {
  const validCaches = [SHELL_CACHE, API_CACHE, ASSET_CACHE, IMAGE_CACHE, MAP_CACHE]
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => {
            console.log('[SW] Eliminando cache viejo:', key)
            return caches.delete(key)
          })
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: estrategia según tipo de request ────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar: extensiones de Chrome, requests no-HTTP, WebSockets
  if (!url.protocol.startsWith('http')) return
  if (request.method !== 'GET') return

  // ── 1. APIs que NUNCA se cachean (upload, auth, transcripción) ─────────────
  if (
    url.pathname.startsWith('/api/upload') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/transcribe-audio') ||
    url.pathname.startsWith('/api/webhooks')
  ) {
    // Pasar directo a la red — si falla, falla (no cachear)
    return
  }

  // ── 2. Otras APIs: NetworkFirst con timeout → caché como fallback ──────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 8000))
    return
  }

  // ── 3. Assets estáticos de Next.js (_next/static): CacheFirst ─────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstWithNetworkFallback(request, ASSET_CACHE))
    return
  }

  // ── 4. Imágenes GCS / Firebase Storage: CacheFirst (30 días) ──────────────
  if (
    url.hostname.includes('storage.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com')
  ) {
    event.respondWith(cacheFirstWithNetworkFallback(request, IMAGE_CACHE))
    return
  }

  // ── 5. Tiles de mapa ArcGIS: CacheFirst (7 días) ──────────────────────────
  if (url.hostname.includes('arcgisonline.com') || url.hostname.includes('arcgis.com')) {
    event.respondWith(cacheFirstWithNetworkFallback(request, MAP_CACHE))
    return
  }

  // ── 6. Google Fonts: CacheFirst ────────────────────────────────────────────
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirstWithNetworkFallback(request, ASSET_CACHE))
    return
  }

  // ── 7. Navegación HTML (pages): NetworkFirst → shell cacheado ──────────────
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request))
    return
  }

  // ── 8. Todo lo demás: NetworkFirst ────────────────────────────────────────
  event.respondWith(networkFirstWithCache(request, ASSET_CACHE, 5000))
})

// ── Estrategias ───────────────────────────────────────────────────────────────

/**
 * NetworkFirst con timeout.
 * Si la red responde antes del timeout → cachea y devuelve.
 * Si no → devuelve respuesta cacheada si existe.
 */
async function networkFirstWithCache(request, cacheName, timeoutMs = 6000) {
  const cache = await caches.open(cacheName)
  try {
    const networkResponse = await fetchWithTimeout(request, timeoutMs)
    if (networkResponse && networkResponse.ok) {
      // Clonar antes de leer — las respuestas solo se pueden consumir una vez
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    // Sin caché y sin red → respuesta vacía de error para APIs
    return new Response(JSON.stringify({ error: 'offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * CacheFirst con fallback a red.
 * Assets inmutables (JS/CSS hasheados, imágenes GCS).
 */
async function cacheFirstWithNetworkFallback(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    return new Response('', { status: 503 })
  }
}

/**
 * Navegación HTML: detecta offline INMEDIATAMENTE sin esperar timeout.
 * Si estamos offline → va directo al caché (sin esperar 5s).
 * Si estamos online → NetworkFirst con timeout corto → fallback a caché.
 * Garantiza que jamás aparezca el dinosaurio.
 */
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE)

  // ── Fast-path offline: skip network entirely ──────────────────────────────
  // navigator.onLine está disponible en SW scope y es la señal más rápida
  if (!self.navigator.onLine) {
    return serveFromShellCache(cache, request)
  }

  // ── Online path: network first con timeout corto ───────────────────────────
  try {
    const networkResponse = await fetchWithTimeout(request, 4000)
    if (networkResponse && networkResponse.ok) {
      // Clonar y cachear en background sin bloquear la respuesta
      const clone = networkResponse.clone()
      cache.put(request, clone).catch(() => {})
      return networkResponse
    }
    throw new Error('network-error')
  } catch {
    // Red falló (timeout, error de conexión, etc.) → caché
    return serveFromShellCache(cache, request)
  }
}

/**
 * Busca la mejor respuesta cacheada disponible para una navegación:
 * 1. URL exacta → 2. Rutas padre → 3. /dashboard → 4. / → 5. HTML mínimo
 */
async function serveFromShellCache(cache, request) {
  // 1. URL exacta
  const exactMatch = await cache.match(request)
  if (exactMatch) return exactMatch

  // 2. Rutas padre (e.g. /dashboard/mi-campo → /dashboard → /)
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    const parentPath = '/' + segments.slice(0, i).join('/')
    const parentMatch = await cache.match(new Request(url.origin + (parentPath || '/')))
    if (parentMatch) return parentMatch
  }

  // 3. Shell principal del dashboard
  const dashboardMatch = await cache.match(new Request(url.origin + '/dashboard'))
  if (dashboardMatch) return dashboardMatch

  // 4. Raíz
  const rootMatch = await cache.match(new Request(url.origin + '/'))
  if (rootMatch) return rootMatch

  // 5. Página offline
  const offlinePage = await cache.match(new Request(url.origin + '/_offline'))
  if (offlinePage) return offlinePage

  // 6. HTML mínimo de emergencia (nunca mostrar el dinosaurio)
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RODEO — Sin conexión</title><style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;color:#374151;gap:16px;padding:24px}h1{font-size:1.5rem;font-weight:900;color:#111827;margin:0}p{font-size:.875rem;color:#6b7280;text-align:center;margin:0}button{background:#16a34a;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:.875rem;font-weight:700;cursor:pointer}</style></head><body><h1>Sin conexión</h1><p>RODEO está cargando en modo offline.<br>Tus datos están guardados en el dispositivo.</p><button onclick="location.reload()">Reintentar</button></body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

/**
 * Fetch con timeout para no esperar indefinidamente en red lenta.
 */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(request).then(
      res => { clearTimeout(timer); resolve(res) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}

// ── Mensaje de sincronización desde OfflineIndicator ─────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SYNC_OFFLINE_QUEUE') {
    // El sync real lo maneja OfflineIndicator.tsx en el cliente
    // El SW solo confirma recepción
    event.source?.postMessage({ type: 'SYNC_ACK' })
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
