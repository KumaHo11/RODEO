/**
 * GET /api/debug/token-check
 * TEMPORAL — Diagnóstico del token de Firebase y estado del perfil
 * Verificar y ELIMINAR después de resolver el problema
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return NextResponse.json({ error: 'No Authorization header', hint: 'Enviar: Authorization: Bearer <idToken>' }, { status: 400 })
  }

  // Decodificar el token sin verificar (solo para diagnóstico)
  let rawPayload: any = null
  try {
    const parts = token.split('.')
    if (parts.length === 3) {
      rawPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    }
  } catch { /* ignore */ }

  // Verificar con Firebase public keys
  const decoded = await verifyFirebaseToken(token)

  // Buscar perfil en DB si tenemos UID
  let dbProfile: any = null
  let dbError: string | null = null
  if (decoded?.uid) {
    try {
      dbProfile = await queryOne<{ id: string; email: string; firebase_uid: string; organization_id: string }>(
        'SELECT id, email, firebase_uid, organization_id FROM profiles WHERE firebase_uid = $1',
        [decoded.uid]
      )
    } catch (e: any) {
      dbError = e.message
    }
  }

  return NextResponse.json({
    token_valid: !!decoded,
    token_uid: decoded?.uid ?? null,
    token_email: decoded?.email ?? null,
    token_email_verified: decoded?.email_verified ?? null,
    token_iat: decoded?.iat ? new Date(decoded.iat * 1000).toISOString() : null,
    token_exp: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    raw_uid_in_token: rawPayload?.sub ?? rawPayload?.uid ?? null,
    raw_email_in_token: rawPayload?.email ?? null,
    raw_aud: rawPayload?.aud ?? null,
    db_profile_found: !!dbProfile,
    db_profile_email: dbProfile?.email ?? null,
    db_profile_org_id: dbProfile?.organization_id ?? null,
    db_error: dbError,
    will_get_404: decoded && !dbProfile,
    will_get_401: !decoded,
  })
}
