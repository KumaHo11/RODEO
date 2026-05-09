/**
 * GET  /api/historial-potrero?paddock_id=<id>&days=30
 *   Devuelve el historial climático de un potrero ordenado por fecha DESC.
 *
 * POST /api/historial-potrero
 *   Upsert de un registro (lluvia manual, NDVI, etc.) por el productor.
 *   Body: { paddock_id, fecha, precipitacion_usuario_mm?, ndvi?, humedad_pct?,
 *            velocidad_viento_kmh?, temperatura_c?, radiacion_solar? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query, queryOne, mutate } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Auth helper (mismo patrón que /api/climate-adjustment)
async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token).catch(() => null)
  if (!decoded) return null
  const profile = await queryOne<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  ).catch(() => null)
  if (!profile?.organization_id) return null
  return { uid: decoded.uid, profileId: profile.id, orgId: profile.organization_id }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const paddockId = searchParams.get('paddock_id')
  const days      = Math.min(90, parseInt(searchParams.get('days') ?? '30', 10))

  if (!paddockId) {
    return NextResponse.json({ error: 'paddock_id requerido' }, { status: 400 })
  }

  // Verificar que el potrero pertenece a la org del usuario
  const ownership = await queryOne<{ id: string }>(`
    SELECT id FROM paddocks WHERE id = $1 AND org_id = $2
  `, [paddockId, auth.orgId])

  if (!ownership) {
    return NextResponse.json({ error: 'Potrero no encontrado' }, { status: 404 })
  }

  const rows = await query<{
    id: string
    fecha: string
    ndvi: number | null
    fuente_ndvi: string
    precipitacion_api_mm: number | null
    precipitacion_usuario_mm: number | null
    humedad_pct: number | null
    velocidad_viento_kmh: number | null
    temperatura_c: number | null
    radiacion_solar: number | null
    et_calculada_mm: number | null
    balance_hidrico_mm: number | null
    c_adj: number | null
    lluvia_fuente: string
    rs_fuente: string
    temp_fuente: string
    created_at: string
    updated_at: string
  }>(`
    SELECT
      id, fecha::text, ndvi, fuente_ndvi,
      precipitacion_api_mm, precipitacion_usuario_mm,
      humedad_pct, velocidad_viento_kmh, temperatura_c, radiacion_solar,
      et_calculada_mm, balance_hidrico_mm, c_adj,
      lluvia_fuente, rs_fuente, temp_fuente,
      created_at, updated_at
    FROM historial_potrero
    WHERE paddock_id = $1
      AND fecha >= CURRENT_DATE - ($2 || ' days')::interval
    ORDER BY fecha DESC
  `, [paddockId, days])

  return NextResponse.json({ historial: rows, paddock_id: paddockId })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.paddock_id || !body?.fecha) {
    return NextResponse.json({ error: 'paddock_id y fecha son requeridos' }, { status: 400 })
  }

  // Verificar propiedad del potrero
  const paddock = await queryOne<{ id: string }>(`
    SELECT id FROM paddocks WHERE id = $1 AND org_id = $2
  `, [body.paddock_id, auth.orgId])

  if (!paddock) return NextResponse.json({ error: 'Potrero no encontrado' }, { status: 404 })

  // Upsert — solo actualiza los campos enviados en el body
  const row = await mutate(`
    INSERT INTO historial_potrero (
      org_id, paddock_id, fecha,
      ndvi, fuente_ndvi,
      precipitacion_usuario_mm,
      humedad_pct, velocidad_viento_kmh,
      temperatura_c, radiacion_solar,
      lluvia_fuente
    ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,'user')
    ON CONFLICT (paddock_id, fecha) DO UPDATE SET
      precipitacion_usuario_mm = COALESCE(EXCLUDED.precipitacion_usuario_mm, historial_potrero.precipitacion_usuario_mm),
      ndvi                     = COALESCE(EXCLUDED.ndvi,                     historial_potrero.ndvi),
      fuente_ndvi              = CASE WHEN EXCLUDED.ndvi IS NOT NULL THEN 'manual' ELSE historial_potrero.fuente_ndvi END,
      humedad_pct              = COALESCE(EXCLUDED.humedad_pct,              historial_potrero.humedad_pct),
      velocidad_viento_kmh     = COALESCE(EXCLUDED.velocidad_viento_kmh,     historial_potrero.velocidad_viento_kmh),
      temperatura_c            = COALESCE(EXCLUDED.temperatura_c,            historial_potrero.temperatura_c),
      radiacion_solar          = COALESCE(EXCLUDED.radiacion_solar,          historial_potrero.radiacion_solar),
      lluvia_fuente            = CASE WHEN EXCLUDED.precipitacion_usuario_mm IS NOT NULL THEN 'user' ELSE historial_potrero.lluvia_fuente END,
      updated_at               = NOW()
    RETURNING id, fecha::text, precipitacion_usuario_mm, ndvi, c_adj
  `, [
    auth.orgId,
    body.paddock_id,
    body.fecha,
    body.ndvi          ?? null,
    body.ndvi != null ? 'manual' : null,
    body.precipitacion_usuario_mm ?? null,
    body.humedad_pct   ?? null,
    body.velocidad_viento_kmh ?? null,
    body.temperatura_c ?? null,
    body.radiacion_solar ?? null,
  ])

  return NextResponse.json({ ok: true, row })
}
