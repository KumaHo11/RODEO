/**
 * API endpoint: POST /api/season-plans/import
 * ─────────────────────────────────────────────
 * Recibe un payload JSON ya parseado desde el cliente (SheetJS)
 * y crea un season_plan con source = 'excel_import'.
 *
 * El cliente hace todo el parseo del .xlsx; este endpoint solo
 * valida y persiste. Nunca recibe el archivo binario.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate } from '@/lib/db'

async function getAuth(req: NextRequest) {
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

// Ensures the season_plans table exists (idempotent)
async function ensureTable() {
  await serviceMutate(`
    CREATE TABLE IF NOT EXISTS season_plans (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      season_type     TEXT NOT NULL DEFAULT 'cerrado',
      year            INTEGER NOT NULL,
      start_date      DATE,
      end_date        DATE,
      no_growth_from  DATE,
      no_growth_to    DATE,
      drought_reserve_days INTEGER DEFAULT 0,
      daily_allocation_kg  NUMERIC(8,2) DEFAULT 12,
      cell_name        TEXT,
      total_ha         NUMERIC(10,2),
      source           TEXT NOT NULL DEFAULT 'manual',
      source_filename  TEXT,
      status           TEXT NOT NULL DEFAULT 'draft',
      demand_snapshot  JSONB,
      supply_snapshot  JSONB,
      metrics          JSONB,
      notes            TEXT,
      created_by       UUID REFERENCES profiles(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  // Ensure grazing_plans has the season_plan_id column to allow cascade deletion when an imported file is removed
  await serviceMutate(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grazing_plans' AND column_name='season_plan_id') THEN 
        ALTER TABLE grazing_plans ADD COLUMN season_plan_id UUID REFERENCES season_plans(id) ON DELETE CASCADE; 
      END IF; 
    END $$;
  `).catch(e => console.error('Migration error adding season_plan_id:', e.message))
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await ensureTable()

    const body = await req.json()

    // Batch import: can receive an array of plans or a single plan
    const plans = Array.isArray(body.plans) ? body.plans : [body]

    if (plans.length === 0) {
      return NextResponse.json({ error: 'No se recibieron planes para importar' }, { status: 400 })
    }

    if (plans.length > 200) {
      return NextResponse.json({ error: 'Máximo 200 planes por importación' }, { status: 400 })
    }

    const created: string[] = []
    const errors: { row: number; message: string }[] = []

    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]
      const {
        name,
        season_type = 'cerrado',
        year,
        start_date,
        end_date,
        no_growth_from,
        no_growth_to,
        drought_reserve_days = 0,
        daily_allocation_kg = 12,
        cell_name,
        total_ha,
        source_filename,
        demand_snapshot,
        supply_snapshot,
        metrics,
        notes,
        movements,
      } = p

      if (!name || !year) {
        errors.push({ row: i + 1, message: 'Falta nombre o año' })
        continue
      }

      try {
        const result = await serviceMutate(
          `INSERT INTO season_plans (
            org_id, name, season_type, year,
            start_date, end_date, no_growth_from, no_growth_to,
            drought_reserve_days, daily_allocation_kg,
            cell_name, total_ha,
            source, source_filename, status,
            demand_snapshot, supply_snapshot, metrics,
            notes, created_by
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
          ) RETURNING id`,
          [
            auth.orgId, name, season_type, Number(year),
            start_date || null, end_date || null,
            no_growth_from || null, no_growth_to || null,
            Number(drought_reserve_days), Number(daily_allocation_kg),
            cell_name || null, total_ha ? Number(total_ha) : null,
            'excel_import', source_filename || null, 'closed',
            demand_snapshot ? JSON.stringify(demand_snapshot) : null,
            supply_snapshot ? JSON.stringify(supply_snapshot) : null,
            metrics ? JSON.stringify(metrics) : null,
            notes || null,
            auth.profileId,
          ]
        )
        const spId = String(result.rows[0]?.id ?? '')
        created.push(spId)

        // Cache para no crear múltiples veces el mismo potrero o rodeo si aparece en varias filas
        const newPaddocks = new Map<string, string>()
        const newHerds    = new Map<string, string>()

        if (spId && movements && Array.isArray(movements) && movements.length > 0) {
          for (const m of movements) {
            let finalPaddockId = m.paddock_id
            let finalHerdId    = m.herd_id

            // ── Auto-crear potrero ──
            if (m._create_paddock && m.excel_paddock_name) {
              if (newPaddocks.has(m.excel_paddock_name)) {
                finalPaddockId = newPaddocks.get(m.excel_paddock_name)
              } else {
                try {
                  const ha = m.area_ha ? Number(m.area_ha) : 1
                  const pRes = await serviceMutate(
                    `INSERT INTO paddocks (org_id, name, area_ha, current_status, created_at, updated_at) VALUES ($1, $2, $3, 'IDLE', NOW(), NOW()) RETURNING id`,
                    [auth.orgId, m.excel_paddock_name, ha]
                  )
                  finalPaddockId = pRes.rows[0]?.id
                  if (finalPaddockId) newPaddocks.set(m.excel_paddock_name, finalPaddockId)
                } catch (e: any) { console.error('Error auto-creating paddock:', e.message) }
              }
            }

            // ── Auto-crear rodeo ──
            if (m._create_herd && m.excel_herd_name) {
              if (newHerds.has(m.excel_herd_name)) {
                finalHerdId = newHerds.get(m.excel_herd_name)
              } else {
                try {
                  const hRes = await serviceMutate(
                    `INSERT INTO herds (org_id, name, total_ev, head_count, created_at, updated_at) VALUES ($1, $2, 10, 1, NOW(), NOW()) RETURNING id`,
                    [auth.orgId, m.excel_herd_name]
                  )
                  finalHerdId = hRes.rows[0]?.id
                  if (finalHerdId) newHerds.set(m.excel_herd_name, finalHerdId)
                } catch (e: any) { console.error('Error auto-creating herd:', e.message) }
              }
            }

            // Fallback: si no tenemos un paddock_id resoluble, omitimos el registro gráfico para proteger la BD
            if (!finalPaddockId) continue

            // Para importar un bloque al Gantt, necesitamos obligatoriamente una fecha de entrada
            if (!m.entry_date) continue

            await serviceMutate(`
              INSERT INTO grazing_plans (
                org_id, paddock_id, herd_id, herd_ids, entry_date, exit_date, actual_entry_date, actual_exit_date, status, notes, season_plan_id, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COMPLETED', 'Movimiento registrado importado de Excel', $9, NOW(), NOW())
            `, [
              auth.orgId, finalPaddockId, finalHerdId, finalHerdId ? [finalHerdId] : [], 
              m.entry_date, m.exit_date, m.entry_date, m.exit_date, spId
            ]).catch(e => console.error('Error inserting movement:', e.message))
          }
        }
      } catch (err: any) {
        errors.push({ row: i + 1, message: err.message })
      }
    }

    return NextResponse.json({
      imported: created.length,
      errors: errors.length > 0 ? errors : undefined,
      ids: created,
    }, { status: created.length > 0 ? 201 : 400 })

  } catch (err: any) {
    console.error('POST /api/season-plans/import error:', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}
