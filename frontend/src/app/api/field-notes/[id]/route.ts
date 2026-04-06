/**
 * PATCH  /api/field-notes/[id]  — Actualiza una nota
 * DELETE /api/field-notes/[id]  — Elimina una nota
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

async function getOrgId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  return typeof profile?.organization_id === 'string' ? profile.organization_id : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { paddock_id, tags, title, content, lat, lng, photo_url, analysis_result } = body
    const category = Array.isArray(tags) && tags.length > 0 ? tags[0] : undefined

    await mutate(
      `UPDATE field_notes SET
         paddock_id     = COALESCE($1, paddock_id),
         tags           = COALESCE($2, tags),
         category       = COALESCE($3, category),
         title          = COALESCE($4, title),
         content        = $5,
         lat            = $6,
         lng            = $7,
         photo_url      = COALESCE($8, photo_url),
         analysis_result = COALESCE($9, analysis_result),
         updated_at     = NOW()
       WHERE id = $10 AND org_id = $11`,
      [
        paddock_id ?? null,
        tags ? JSON.stringify(tags) : null,
        category ?? null,
        title ?? null,
        content ?? null,
        lat ?? null,
        lng ?? null,
        photo_url ?? null,
        analysis_result ? JSON.stringify(analysis_result) : null,
        (await params).id,
        orgId,
      ]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/field-notes/[id]:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await mutate('DELETE FROM field_notes WHERE id = $1 AND org_id = $2', [(await params).id, orgId])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/field-notes/[id]:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
