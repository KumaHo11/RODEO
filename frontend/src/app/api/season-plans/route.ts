/**
 * GET  /api/season-plans         — Lista todos los planes de temporada (histórico)
 * POST /api/season-plans         — Crea un nuevo plan de temporada
 *
 * Cada "season plan" es un registro anual/estacional que consolida:
 *  - Parámetros globales: tipo (abierto/cerrado), fechas, reserva de sequía, etc.
 *  - Datos de demanda proyectada (EV por mes)
 *  - Datos de oferta (resumen de potreros)
 *  - Fuente: 'manual' (creado en RODEO) | 'excel_import' (importado)
 *
 * Estos registros forman el HISTÓRICO que alimentará las métricas e IA futura.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

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
  return { orgId: profile.organization_id, profileId: profile.id, uid: decoded.uid }
}


// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year    = searchParams.get('year')
    const status  = searchParams.get('status')
    const source  = searchParams.get('source')

    let sql = `
      SELECT
        sp.*,
        TO_CHAR(sp.start_date,     'YYYY-MM-DD') AS start_date,
        TO_CHAR(sp.end_date,       'YYYY-MM-DD') AS end_date,
        TO_CHAR(sp.no_growth_from, 'YYYY-MM-DD') AS no_growth_from,
        TO_CHAR(sp.no_growth_to,   'YYYY-MM-DD') AS no_growth_to,
        TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS created_by_name
      FROM season_plans sp
      LEFT JOIN profiles p ON p.id = sp.created_by
      WHERE sp.org_id = $1
    `
    const params: any[] = [auth.orgId]
    let i = 2
    if (year)   { sql += ` AND sp.year = $${i++}`;   params.push(Number(year)) }
    if (status) { sql += ` AND sp.status = $${i++}`; params.push(status) }
    if (source) { sql += ` AND sp.source = $${i++}`; params.push(source) }
    sql += ` ORDER BY sp.year DESC, sp.start_date DESC`

    const plans = await serviceQuery(sql, params)
    return NextResponse.json({ plans })
  } catch (err: any) {
    console.error('GET /api/season-plans error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, season_type = 'cerrado', year,
      start_date, end_date,
      no_growth_from, no_growth_to,
      drought_reserve_days = 0,
      daily_allocation_kg = 12,
      cell_name, total_ha,
      source = 'manual',
      source_filename,
      status = 'draft',
      demand_snapshot,
      supply_snapshot,
      metrics,
      notes,
    } = body

    if (!name || !year) {
      return NextResponse.json({ error: 'Nombre y año son requeridos' }, { status: 400 })
    }

    const result = await serviceMutate(
      `INSERT INTO season_plans (
        org_id, name, season_type, year,
        start_date, end_date,
        no_growth_from, no_growth_to,
        drought_reserve_days, daily_allocation_kg,
        cell_name, total_ha,
        source, source_filename, status,
        demand_snapshot, supply_snapshot, metrics,
        notes, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING
        id, created_at,
        org_id, name, season_type, year,
        TO_CHAR(start_date,     'YYYY-MM-DD') AS start_date,
        TO_CHAR(end_date,       'YYYY-MM-DD') AS end_date,
        TO_CHAR(no_growth_from, 'YYYY-MM-DD') AS no_growth_from,
        TO_CHAR(no_growth_to,   'YYYY-MM-DD') AS no_growth_to,
        drought_reserve_days, daily_allocation_kg,
        cell_name, total_ha, source, source_filename, status,
        demand_snapshot, supply_snapshot, metrics, notes`,
      [
        auth.orgId, name, season_type, year,
        start_date || null, end_date || null,
        no_growth_from || null, no_growth_to || null,
        drought_reserve_days, daily_allocation_kg,
        cell_name || null, total_ha || null,
        source, source_filename || null, status,
        demand_snapshot ? JSON.stringify(demand_snapshot) : null,
        supply_snapshot ? JSON.stringify(supply_snapshot) : null,
        metrics ? JSON.stringify(metrics) : null,
        notes || null,
        auth.profileId,
      ]
    )

    // Return the full row so the frontend can use metrics.suggested_sequence immediately
    return NextResponse.json(
      result.rows[0] ?? { error: 'No se pudo crear el plan' },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('POST /api/season-plans error:', err)
    require('fs').appendFileSync('/tmp/rodeo_api_error.log', new Date().toISOString() + ' ' + err.message + '\n' + err.stack + '\n')
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}

