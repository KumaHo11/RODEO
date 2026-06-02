/**
 * lib/offline/auth-cache.ts
 * Caché de token de autenticación para login offline.
 *
 * Al hacer login online, guardamos el token en IndexedDB con su expiración.
 * Al abrir offline, el AuthProvider obtiene el token cacheado y lo pone
 * en la cookie __session para que el middleware Edge no redirija al login.
 */

import { metaGet, metaSet } from './db'

const META_KEY_TOKEN   = 'auth_token'
const META_KEY_EXP     = 'auth_token_exp'
const META_KEY_PROFILE = 'auth_profile'

// Margen de seguridad: si el token expira en menos de 10 minutos, lo consideramos inválido
const EXPIRY_MARGIN_MS = 10 * 60 * 1000

// ── Guardar token ─────────────────────────────────────────────────────────────

/**
 * Llama esto después de cada login exitoso o refresco de token.
 * @param token - Firebase ID token (JWT)
 * @param expMs  - Timestamp de expiración en ms (iat + 3600s * 1000)
 */
export async function cacheAuthToken(token: string, expMs: number): Promise<void> {
  await Promise.all([
    metaSet(META_KEY_TOKEN, token),
    metaSet(META_KEY_EXP, expMs),
  ])
}

// ── Obtener token cacheado ────────────────────────────────────────────────────

/**
 * Devuelve el token cacheado si aún no expiró, o null si está expirado/ausente.
 */
export async function getCachedAuthToken(): Promise<string | null> {
  try {
    const [token, exp] = await Promise.all([
      metaGet(META_KEY_TOKEN),
      metaGet(META_KEY_EXP),
    ])

    if (!token || !exp) return null

    const now = Date.now()
    if (exp - now < EXPIRY_MARGIN_MS) {
      // Token expirado o por expirar
      console.warn('[auth-cache] Token expirado o por expirar, descartando')
      return null
    }

    return token as string
  } catch {
    return null
  }
}

// ── Guardar perfil ────────────────────────────────────────────────────────────

export async function cacheProfile(profile: any): Promise<void> {
  await metaSet(META_KEY_PROFILE, profile)
}

export async function getCachedProfile(): Promise<any | null> {
  return metaGet(META_KEY_PROFILE)
}

// ── Limpiar (al logout) ───────────────────────────────────────────────────────

export async function clearAuthCache(): Promise<void> {
  await Promise.all([
    metaSet(META_KEY_TOKEN, null),
    metaSet(META_KEY_EXP, null),
    metaSet(META_KEY_PROFILE, null),
  ])
}

// ── Decodificar JWT para obtener exp ─────────────────────────────────────────

/**
 * Decodifica el payload de un JWT sin verificar firma.
 * Solo para extraer el campo `exp` (expiración en segundos Unix).
 */
export function decodeJwtExp(token: string): number | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded.exp ? decoded.exp * 1000 : null // convertir a ms
  } catch {
    return null
  }
}
