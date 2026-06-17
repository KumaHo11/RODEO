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
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'

// ── buildHierarchy — Groups flat herds into LoteData[] + ungrouped[] —————————

function buildHierarchy(herds: any[]) {
  const grouped = new Map<string, any[]>()
  const ungrouped: any[] = []

  for (const h of herds) {
    if (h.grupo_manejo_id) {
      const key = h.grupo_manejo_id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(h)
    } else {
      ungrouped.push(h)
    }
  }

  const lotes = Array.from(grouped.entries()).map(([id, hijos]) => {
    const nombre       = hijos[0]?.grupo_manejo_nombre ?? hijos[0]?.name ?? 'Lote'
    const totalCabezas = hijos.reduce((s: number, h: any) => s + (Number(h.head_count) || 0), 0)
    const totalEV      = hijos.reduce((s: number, h: any) => s + (Number(h.total_ev)   || 0), 0)
    return {
      grupo_manejo_id: id,
      nombre,
      hijos,
      totales: {
        head_count:        Math.round(totalCabezas),
        total_ev:          Math.round(totalEV * 10) / 10,
        consumo_kg_ms_dia: Math.round(totalEV * 11),
      },
    }
  })

  return { lotes, ungrouped }
}

// ── GET ────────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // First: guaranteed core columns + v8 + v10 columns
    let herds: any[]
    try {
      herds = await serviceQuery(
        `SELECT id, org_id, name, species, breed, categoria, head_count,
                avg_weight_kg, total_ev,
                age_years, age_months, admission_date,
                bcs_score, bcs_label, bcs_data, photo_url,
                parent_herd_id, herd_notes, exit_date,
                physiological_category, last_weigh_date, daily_gain_kg,
                lactancia_range, estadio_gestacion, custom_racion_kg,
                grupo_manejo_id, grupo_manejo_nombre,
                created_at, updated_at
         FROM herds
         WHERE org_id = $1
         ORDER BY grupo_manejo_nombre NULLS LAST, created_at DESC`,
        [auth.orgId]
      )
    } catch {
      try {
        herds = await serviceQuery(
          `SELECT id, org_id, name, species, breed, categoria, head_count,
                  avg_weight_kg, total_ev,
                  age_years, age_months, admission_date,
                  bcs_score, bcs_label, bcs_data, photo_url,
                  parent_herd_id, herd_notes, exit_date,
                  physiological_category, last_weigh_date, daily_gain_kg,
                  lactancia_range, estadio_gestacion, custom_racion_kg,
                  created_at, updated_at
           FROM herds
           WHERE org_id = $1
           ORDER BY created_at DESC`,
          [auth.orgId]
        )
      } catch {
        try {
          herds = await serviceQuery(
            `SELECT id, org_id, name, species, breed, categoria, head_count,
                    avg_weight_kg, total_ev,
                    age_years, age_months, admission_date,
                    bcs_score, bcs_label, bcs_data, photo_url,
                    parent_herd_id, herd_notes, exit_date,
                    created_at, updated_at
             FROM herds
             WHERE org_id = $1
             ORDER BY created_at DESC`,
            [auth.orgId]
          )
        } catch {
          // Final fallback: guaranteed-only columns
          herds = await serviceQuery(
            `SELECT id, org_id, name, species, breed, categoria, head_count,
                    avg_weight_kg, total_ev, created_at, updated_at
             FROM herds
             WHERE org_id = $1
             ORDER BY created_at DESC`,
            [auth.orgId]
          )
        }
      }
    }

    // Build hierarchical structure server-side
    const { lotes, ungrouped } = buildHierarchy(herds)

    return NextResponse.json({ herds, lotes, ungrouped })
  } catch (err: any) {
    console.error('GET /api/herds error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, species, breed,
      head_count, avg_weight_kg, total_ev, categoria,
      // Optional new columns (v1-v7 migrations)
      age_months, age_years, admission_date, parent_herd_id, exit_date,
      // Temporary herd fields
      is_temporary, notes,
      // Physiological fields (v8 migration)
      physiological_category, last_weigh_date, daily_gain_kg,
      // EV Matrix fields (v9 migration)
      lactancia_range, estadio_gestacion, custom_racion_kg,
      // Lote de Manejo fields (v10 migration)
      grupo_manejo_id, grupo_manejo_nombre,
    } = body

    if (!name || !head_count) {
      return NextResponse.json({ error: 'Nombre y cantidad requeridos' }, { status: 400 })
    }

    // Step 1: INSERT with guaranteed columns only (always works)
    const result = await serviceMutate(
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
    if (id && (age_months || age_years || admission_date || parent_herd_id || exit_date || is_temporary != null || notes)) {
      try {
        await serviceMutate(
          `UPDATE herds
           SET age_months = $1, age_years = $2, admission_date = $3, parent_herd_id = $4, exit_date = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [
            age_months     || null,
            age_years      || null,
            admission_date || null,
            parent_herd_id || null,
            exit_date      || null,
            id,
          ]
        )
      } catch (optErr: any) {
        console.warn('POST /api/herds optional columns skipped:', optErr.message)
      }
      // is_temporary and notes — separate update with fallback
      try {
        await serviceMutate(
          `UPDATE herds SET is_temporary = $1, herd_notes = $2 WHERE id = $3`,
          [is_temporary ?? false, notes || null, id]
        )
      } catch {
        // Column may not exist in older schema — non-critical
      }
    }

    // Step 3: UPDATE physiological fields (v8) — separate block, silently skip if not migrated
    if (id && (physiological_category !== undefined || last_weigh_date !== undefined || daily_gain_kg !== undefined)) {
      try {
        await serviceMutate(
          `UPDATE herds
           SET physiological_category = $1,
               last_weigh_date = $2,
               daily_gain_kg = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [
            physiological_category ?? null,
            last_weigh_date        ?? null,
            daily_gain_kg          ?? null,
            id,
          ]
        )
      } catch (physErr: any) {
        console.warn('POST /api/herds physiological columns skipped (run v8 migration):', physErr.message)
      }
    }

    // Step 3.5: UPDATE EV Matrix fields (v9)
    if (id && (lactancia_range !== undefined || estadio_gestacion !== undefined || custom_racion_kg !== undefined)) {
      try {
        await serviceMutate(
          `UPDATE herds
           SET lactancia_range = $1,
               estadio_gestacion = $2,
               custom_racion_kg = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [
            lactancia_range ?? null,
            estadio_gestacion ?? null,
            custom_racion_kg ?? null,
            id,
          ]
        )
      } catch (evErr: any) {
        console.warn('POST /api/herds EV Matrix columns skipped (run v9 migration):', evErr.message)
      }
    }

    // Step 4: UPDATE lote de manejo fields (v10) — silently skip if not migrated
    if (id && (grupo_manejo_id !== undefined || grupo_manejo_nombre !== undefined)) {
      try {
        await serviceMutate(
          `UPDATE herds
           SET grupo_manejo_id = $1,
               grupo_manejo_nombre = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [
            grupo_manejo_id     ?? null,
            grupo_manejo_nombre ?? null,
            id,
          ]
        )
      } catch (loteErr: any) {
        console.warn('POST /api/herds lote columns skipped (run v10 migration):', loteErr.message)
      }
    }

    return NextResponse.json({ id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/herds error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
