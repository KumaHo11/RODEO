/**
 * GET  /api/field-notes          — Lista notas de la org, filtrable por paddock_id
 * POST /api/field-notes          — Crea una nota
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string; id: string }>(
    'SELECT organization_id, id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, profileId: profile.id }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const paddockId     = searchParams.get('paddock_id')
    const source        = searchParams.get('source')        // 'WHATSAPP' | 'APP'
    const status        = searchParams.get('status')        // 'PENDING_REVIEW' | 'APPROVED'
    // bitacora_only=1: feed cronológico unificado de la org.
    // NO filtra por paddock_id IS NULL — la Bitácora muestra TODAS las notas
    // del campo independientemente de si tienen potrero/rodeo asignado.
    // El paddock_name se muestra como badge en la card (enriquecimiento),
    // no como criterio de exclusión.
    const bitacoraOnly  = searchParams.get('bitacora_only')

    let sql = `
      SELECT
        fn.*,
        COALESCE(p.first_name || ' ' || p.last_name, p.email) AS user_display_name,
        p.email              AS user_email,
        pa.name              AS paddock_name,
        h.name               AS rodeo_name,
        fn.whatsapp_phone    AS sender_phone
      FROM field_notes fn
      LEFT JOIN profiles p  ON p.id = fn.created_by
      LEFT JOIN paddocks pa ON pa.id = fn.paddock_id
      LEFT JOIN herds h     ON h.id  = fn.rodeo_id
      WHERE fn.org_id = $1
    `
    const vals: any[] = [auth.orgId]

    if (paddockId) { sql += ` AND fn.paddock_id = $${vals.length + 1}`; vals.push(paddockId) }
    // bitacoraOnly: no agrega filtro — devuelve todas las notas de la org.
    // La exclusión por paddock ya se hace cuando se llama con ?paddock_id=X.
    if (source)    { sql += ` AND fn.source = $${vals.length + 1}`;     vals.push(source) }
    if (status)    { sql += ` AND fn.status = $${vals.length + 1}`;     vals.push(status) }

    sql += ` ORDER BY fn.created_at DESC LIMIT 200`

    const rows = await serviceQuery(sql, vals)
    return NextResponse.json({ notes: rows })
  } catch (err: any) {
    console.error('GET /api/field-notes error:', err)
    return NextResponse.json({ error: 'Server error', detail: err?.message }, { status: 500 })
  }
}



export async function POST(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      paddock_id, rodeo_id, tags, title, content,
      lat, lng, photo_url, photo_urls, audio_url, video_url, analysis_result,
      audio_duration_secs,
    } = body

    const normalizedTags: string[] = Array.isArray(tags) && tags.length > 0 ? tags : ['GENERAL']
    const category = normalizedTags[0]

    const { rows } = await serviceMutate(
      `INSERT INTO field_notes
         (org_id, created_by, paddock_id, rodeo_id, tags, category, title, content, lat, lng, photo_url, photo_urls, audio_url, video_url, audio_duration_secs, analysis_result, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW(), NOW())
       RETURNING *`,
      [
        auth.orgId, auth.profileId,
        paddock_id || null,
        rodeo_id || null,
        normalizedTags,
        category,
        title,
        content || null,
        lat || null,
        lng || null,
        photo_url || null,
        photo_urls || [],
        audio_url || null,
        video_url || null,
        audio_duration_secs || null,
        analysis_result ? JSON.stringify(analysis_result) : null,
      ]
    )

    return NextResponse.json({ note: rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/field-notes error:', err)
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
