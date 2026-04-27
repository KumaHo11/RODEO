/**
 * GET/PATCH /api/admin/config
 * System configuration (API keys, integration settings).
 * Values are masked on GET for secret keys.
 */
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

function maskSecret(value: string): string {
  if (!value || value.length < 8) return value ? '••••••••' : ''
  return value.slice(0, 4) + '••••••••' + value.slice(-4)
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const showSecrets = req.nextUrl.searchParams.get('reveal') === '1'

  try {
    const configs = await query<{
      key: string; value: string; label: string; category: string; is_secret: boolean; updated_at: string
    }>(`SELECT key, value, label, category, is_secret, updated_at FROM system_config ORDER BY category, key`)

    const result = configs.map(c => ({
      ...c,
      value: (c.is_secret && !showSecrets) ? maskSecret(c.value) : c.value,
      hasValue: c.value.length > 0,
    }))

    // Group by category
    const grouped: Record<string, typeof result> = {}
    for (const c of result) {
      if (!grouped[c.category]) grouped[c.category] = []
      grouped[c.category].push(c)
    }

    return NextResponse.json({ config: grouped })
  } catch (err) {
    console.error('GET /api/admin/config error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, value } = await req.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  try {
    await query(
      `UPDATE system_config
       SET value = $1, updated_at = NOW()
       WHERE key = $2`,
      [value || '', key]
    )

    // Audit log (sin guardar el valor para no exponer secrets)
    await query(
      `INSERT INTO audit_logs (actor_email, action, entity_type, entity_id, new_value)
       VALUES ($1, 'CONFIG_UPDATED', 'system_config', NULL, $2)`,
      [admin.email || '', JSON.stringify({ key, updated: true })]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/config error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
