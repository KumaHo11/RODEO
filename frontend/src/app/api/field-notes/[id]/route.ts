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
    const { paddock_id, tags, title, content, lat, lng, photo_url, audio_url, analysis_result, status } = body
    const category = Array.isArray(tags) && tags.length > 0 ? tags[0] : undefined

    // Build dynamic SET clause — only update fields that are explicitly provided in the request body
    // This allows safe partial updates (e.g. PATCH { content: "transcript" } won't wipe other fields)
    const setClauses: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    const push = (expr: string, val: any) => { vals.push(val); setClauses.push(`${expr} = $${vals.length}`) }

    if ('paddock_id'      in body) push('paddock_id',      paddock_id ?? null)
    if ('tags'            in body) push('tags',            tags ? JSON.stringify(tags) : null)
    if (category)                  push('category',        category)
    if ('title'           in body) push('title',           title ?? null)
    if ('content'         in body) push('content',         content ?? null)
    if ('lat'             in body) push('lat',             lat ?? null)
    if ('lng'             in body) push('lng',             lng ?? null)
    if ('photo_url'       in body) push('photo_url',       photo_url ?? null)
    if ('audio_url'       in body) push('audio_url',       audio_url ?? null)
    if ('analysis_result' in body) push('analysis_result', analysis_result ? JSON.stringify(analysis_result) : null)
    if ('status'          in body) push('status',          status ?? null)

    const noteId = (await params).id
    vals.push(noteId, orgId)

    await mutate(
      `UPDATE field_notes SET ${setClauses.join(', ')} WHERE id = $${vals.length - 1} AND org_id = $${vals.length}`,
      vals
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
