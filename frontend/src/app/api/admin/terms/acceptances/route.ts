import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query } from '@/lib/db'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded || decoded.system_role !== 'SUPER_ADMIN') return null
  return decoded
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const versionId = searchParams.get('versionId')
    const search = searchParams.get('search')

    let sql = `
      SELECT 
        u.id as acceptance_id, 
        u.accepted_at, 
        u.ip_address,
        p.id as profile_id,
        p.first_name,
        p.last_name,
        p.email,
        o.name as org_name,
        v.version_number
      FROM user_terms_acceptances u
      JOIN profiles p ON u.profile_id = p.id
      JOIN terms_and_conditions_versions v ON u.version_id = v.id
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (versionId) {
      sql += ` AND u.version_id = $${paramIndex}`
      params.push(versionId)
      paramIndex++
    }

    if (search) {
      sql += ` AND (p.email ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    sql += ` ORDER BY u.accepted_at DESC LIMIT 500`

    const acceptances = await query(sql, params)
    return NextResponse.json({ success: true, acceptances })
  } catch (err: any) {
    console.error('Error in GET /api/admin/terms/acceptances:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
