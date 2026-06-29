/**
 * lib/connectivity.ts
 *
 * navigator.onLine NO es confiable en iOS: puede devolver true aunque el
 * dispositivo esté en modo avión o sin internet real. Esta función hace
 * una verificación real de conectividad con un fetch HEAD de bajo costo.
 *
 * Uso:
 *   const offline = await isOffline()
 *   if (offline) { // guardar en cola }
 */

let _cachedOffline: boolean | null = null
let _lastCheck = 0
const CACHE_TTL_MS = 5000 // re-verificar cada 5 s máximo

/**
 * Devuelve true si el dispositivo NO tiene conectividad real a internet.
 * Usa un HEAD request a /manifest.json (siempre cacheado por el SW) como señal.
 * Tiene caché de 5 segundos para no hacer fetch en cada llamada.
 */
export async function isOffline(): Promise<boolean> {
  // Eliminamos el short-circuit de !navigator.onLine porque Chrome/Safari a veces
  // lo reportan como false en el arranque de la PWA aunque haya internet.
  // Si realmente no hay red, el fetch fallará de inmediato sin penalización.
  const now = Date.now()
  if (_cachedOffline !== null && now - _lastCheck < CACHE_TTL_MS) {
    return _cachedOffline
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3s timeout
    await fetch('/manifest.json', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    _cachedOffline = false
    _lastCheck = now
    return false
  } catch {
    // TypeError (network error) o AbortError (timeout) → sin conectividad
    _cachedOffline = true
    _lastCheck = now
    return true
  }
}

/** Invalida el caché de conectividad (llamar cuando 'online'/'offline' event dispara) */
export function invalidateConnectivityCache() {
  _cachedOffline = null
  _lastCheck = 0
}
