/**
 * GET /api/admin/users
 * Lista todos los usuarios con filtros opcionales.
 * Solo accesible por SUPER_ADMIN.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

  const { searchParams } = req.nextUrl
  const status   = searchParams.get('status')    // 'active' | 'inactive'
  const planSlug = searchParams.get('plan')       // slug del plan
  const dateFrom = searchParams.get('date_from')  // ISO date
  const dateTo   = searchParams.get('date_to')
  const search   = searchParams.get('search')     // email / nombre
  const page     = parseInt(searchParams.get('page') || '1')
  const limit    = parseInt(searchParams.get('limit') || '50')
  const offset   = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIdx = 1

  if (status === 'active')   { conditions.push(`p.is_active = true`); }
  if (status === 'inactive') { conditions.push(`p.is_active = false`); }

  if (planSlug) {
    conditions.push(`sp.slug = $${paramIdx++}`)
    params.push(planSlug)
  }

  if (dateFrom) {
    conditions.push(`p.created_at >= $${paramIdx++}`)
    params.push(dateFrom)
  }

  if (dateTo) {
    conditions.push(`p.created_at <= $${paramIdx++}`)
    params.push(dateTo)
  }

  if (search) {
    conditions.push(`(p.email ILIKE $${paramIdx} OR p.first_name ILIKE $${paramIdx} OR p.last_name ILIKE $${paramIdx})`)
    params.push(`%${search}%`)
    paramIdx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Excluir super admins de la lista de usuarios
  const excludeSystemRoles = conditions.length > 0
    ? `AND p.system_role IS NULL`
    : `WHERE p.system_role IS NULL`

  const sql = `
    SELECT
      p.id,
      p.firebase_uid,
      p.email,
      p.first_name,
      p.last_name,
      p.is_active,
      p.created_at,
      p.onboarding_step,
      p.country_code,
      o.id        AS org_id,
      o.name      AS org_name,
      o.total_area_ha,
      o.plan_status,
      sp.id       AS plan_id,
      sp.name     AS plan_name,
      sp.slug     AS plan_slug,
      sp.price    AS plan_price,
      (SELECT COUNT(*) FROM paddocks WHERE org_id = o.id) AS paddocks_count,
      (SELECT COUNT(*) FROM herds    WHERE org_id = o.id) AS herds_count
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
    ${whereClause}
    ${excludeSystemRoles.startsWith('AND') && conditions.length > 0 ? excludeSystemRoles : ''}
    ${!conditions.length ? excludeSystemRoles : ''}
    ORDER BY p.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `
  params.push(limit, offset)

  const countSql = `
    SELECT COUNT(*) as total
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
    ${whereClause}
    ${conditions.length > 0 ? 'AND' : 'WHERE'} p.system_role IS NULL
  `

  try {
    const [users, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, params.length - 2)),
    ])

    return NextResponse.json({
      users,
      total: parseInt((countResult[0] as any)?.total || '0'),
      page,
      limit,
    })
  } catch (err) {
    console.error('GET /api/admin/users error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, is_active, plan_id } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  try {
    if (is_active !== undefined) {
      // 1. Update DB
      await query(`UPDATE profiles SET is_active = $1, updated_at = NOW() WHERE id = $2`, [is_active, userId])

      // 2. Sync with Firebase Auth — disabling blocks the user's token immediately
      const { adminAuth } = await import('@/lib/firebase/admin')
      const rows = await query<{ firebase_uid: string }>(
        `SELECT firebase_uid FROM profiles WHERE id = $1`,
        [userId]
      )
      const firebaseUid = rows[0]?.firebase_uid
      if (firebaseUid) {
        await adminAuth.updateUser(firebaseUid, { disabled: !is_active })
      }
    }

    if (plan_id) {
      await query(
        `UPDATE organizations SET subscription_plan_id = $1, updated_at = NOW()
         WHERE id = (SELECT organization_id FROM profiles WHERE id = $2)`,
        [plan_id, userId]
      )
    }

    // Audit log — actor_id must be a UUID, not a Firebase UID string
    const adminProfile = await query<{ id: string }>(
      `SELECT id FROM profiles WHERE firebase_uid = $1 LIMIT 1`,
      [admin.uid]
    )
    const actorId = adminProfile[0]?.id ?? null

    await query(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, new_value)
       VALUES ($1, $2, 'USER_UPDATED', 'profile', $3, $4)`,
      [actorId, admin.email || '', userId, JSON.stringify({ is_active, plan_id })]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/users error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
