/**
 * GET  /api/herds  — Lista de rodeos de la organización
 * POST /api/herds  — Crea un nuevo rodeo
 *
 * COLUMN STRATEGY
 * ───────────────
 * The table has been evolving. The queries here are built to work against
 * both the original schema (no new columns) and the migrated schema.
 *
 * ORIGINAL guaranteed columns:
 *   id, org_id, name, species, breed, category, categoria,
 *   head_count, avg_weight_kg, total_ev, created_at, updated_at
 *
 * Columns added by later migrations (may not exist yet):
 *   age_years, age_months, admission_date, parent_herd_id,
 *   herd_notes, bcs_score, bcs_label, bcs_data, photo_url
 *
 * Run `node scripts/migrate-db.js` to add them.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate } from '@/lib/db'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // First: guaranteed core columns
    let herds: any[]
    try {
      herds = await query(
        `SELECT id, org_id, name, species, breed, categoria, head_count,
                avg_weight_kg, total_ev,
                age_years, age_months, admission_date,
                bcs_score, bcs_label, bcs_data, photo_url,
                parent_herd_id, herd_notes,
                created_at, updated_at
         FROM herds
         WHERE org_id = $1
         ORDER BY created_at DESC`,
        [auth.orgId]
      )
    } catch {
      // Fallback to guaranteed-only columns (pre-migration DB)
      herds = await query(
        `SELECT id, org_id, name, species, breed, categoria, head_count,
                avg_weight_kg, total_ev, created_at, updated_at
         FROM herds
         WHERE org_id = $1
         ORDER BY created_at DESC`,
        [auth.orgId]
      )
    }

    return NextResponse.json({ herds })
  } catch (err: any) {
    console.error('GET /api/herds error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, species, breed,
      head_count, avg_weight_kg, total_ev, categoria,
      // Optional new columns
      age_months, age_years, admission_date, parent_herd_id,
    } = body

    if (!name || !head_count) {
      return NextResponse.json({ error: 'Nombre y cantidad requeridos' }, { status: 400 })
    }

    // Step 1: INSERT with guaranteed columns only (always works)
    const result = await mutate(
      `INSERT INTO herds
         (org_id, name, species, breed, head_count, avg_weight_kg, total_ev, categoria)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        auth.orgId,
        name,
        species || 'vacas',
        breed   || null,
        head_count,
        avg_weight_kg || null,
        total_ev      || null,
        categoria     || null,
      ]
    )

    const id: string | null = (result.rows[0]?.id as string) ?? null

    // Step 2: UPDATE with new optional columns — silently skip if columns don't exist yet
    if (id && (age_months || age_years || admission_date || parent_herd_id)) {
      try {
        await mutate(
          `UPDATE herds
           SET age_months = $1, age_years = $2, admission_date = $3, parent_herd_id = $4,
               updated_at = NOW()
           WHERE id = $5`,
          [
            age_months     || null,
            age_years      || null,
            admission_date || null,
            parent_herd_id || null,
            id,
          ]
        )
      } catch (optErr: any) {
        // Columns not yet migrated — non-critical, main record already saved
        console.warn('POST /api/herds optional columns skipped:', optErr.message)
      }
    }

    return NextResponse.json({ id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/herds error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
