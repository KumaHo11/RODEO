/**
 * auth.ts — Helper compartido de autenticación para API Routes
 *
 * Evita duplicar la lógica de `getOrgId` en cada route handler.
 * Uso:
 *   const auth = await requireAuth(req)
 *   if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
 */
import { type NextRequest } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne } from '@/lib/db'

export type AuthContext = {
  orgId: string
  uid: string
  profileId: string
}

/**
 * Verifica el token Bearer del header Authorization y retorna el contexto
 * de autenticación (orgId, uid, profileId) o null si no está autenticado.
 *
 * Cache en-memoria simple por uid para reducir DB lookups en ráfagas
 * de requests del mismo usuario (TTL: 5 minutos).
 */
const profileCache = new Map<string, { data: AuthContext; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

export async function requireAuth(req: NextRequest): Promise<AuthContext | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null

  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null

  const { uid } = decoded

  // Check in-memory cache first
  const cached = profileCache.get(uid)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  const profile = await queryOne<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM profiles WHERE firebase_uid = $1',
    [uid]
  )

  if (!profile?.organization_id) return null

  const ctx: AuthContext = {
    orgId: profile.organization_id,
    uid,
    profileId: profile.id,
  }

  // Store in cache
  profileCache.set(uid, { data: ctx, expiresAt: Date.now() + CACHE_TTL_MS })

  return ctx
}

/** Invalida el cache de un usuario (útil tras cambios de org o rol) */
export function invalidateAuthCache(uid: string) {
  profileCache.delete(uid)
}
