/**
 * POST /api/herds/[id]/animals — Sube el padrón individual de un rodeo.
 *
 * Body: { rows: AnimalCSVRow[], resolution: CSVResolutionAction, justification: string }
 *
 * Flujo:
 *  1. Valida token + ownership del rodeo
 *  2. Según resolution, actualiza head_count si corresponde
 *  3. Registra evento en farm-events (auditoría)
 *  4. Upsert de animales individuales en tabla animal_padron
 *     (crea la tabla si no existe — migration-safe)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate, serviceQuery } from '@/lib/db'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const herdId = (await params).id
    const body   = await req.json()
    const { rows = [], resolution, justification = '' } = body

    // Validate justification
    if (!justification || justification.trim().length < 10) {
      return NextResponse.json({ error: 'Justificación requerida (mín. 10 caracteres)' }, { status: 400 })
    }
    if (!resolution) {
      return NextResponse.json({ error: 'Resolución requerida' }, { status: 400 })
    }

    // Verify herd ownership
    const herd = await serviceQueryOne<{ id: string; head_count: number }>(
      'SELECT id, head_count FROM herds WHERE id = $1 AND org_id = $2',
      [herdId, auth.orgId]
    )
    if (!herd) return NextResponse.json({ error: 'Rodeo no encontrado' }, { status: 404 })

    const csvRowCount = rows.length

    // Apply head_count resolution
    if (resolution === 'actualizar_stock' && csvRowCount !== herd.head_count) {
      await serviceMutate(
        'UPDATE herds SET head_count = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3',
        [csvRowCount, herdId, auth.orgId]
      )
    }

    // Register audit event in farm-events
    const diffStr = csvRowCount - herd.head_count
    await serviceMutate(
      `INSERT INTO farm_events
         (org_id, title, event_type, event_date, herd_id, herd_ids, description, status, source, created_at, updated_at)
       VALUES ($1,$2,'csv_upload',NOW(),$3,$4,$5,'completado','rodeo',NOW(),NOW())`,
      [
        auth.orgId,
        `Padrón INTA cargado: ${csvRowCount} animales`,
        herdId,
        JSON.stringify([herdId]),
        `${csvRowCount} animales. Diferencia: ${diffStr > 0 ? '+' : ''}${diffStr}. Resolución: ${resolution}. ${justification.trim()}`,
      ]
    ).catch(e => console.warn('farm-events insert skipped:', e.message))

    // Upsert animal_padron (migration-safe: create table if not exists)
    let uploadedCount = 0
    if (rows.length > 0) {
      try {
        // Ensure table exists (idempotent)
        await serviceMutate(`
          CREATE TABLE IF NOT EXISTS animal_padron (
            id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            org_id          UUID NOT NULL,
            herd_id         UUID NOT NULL,
            caravana        TEXT NOT NULL,
            rp              TEXT,
            sexo            CHAR(1),
            categoria       TEXT,
            fecha_nacimiento DATE,
            peso_kg         NUMERIC(6,1),
            raza            TEXT,
            observaciones   TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(org_id, caravana)
          )
        `, [])

        // Batch upsert in chunks of 100
        const CHUNK = 100
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK)
          // Build parameterized query
          const valuePlaceholders = (chunk as any[]).map((_: any, j: number) => {
            const base = j * 8
            return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`
          }).join(',')
          const vals: any[] = []
          ;(chunk as any[]).forEach((row: any) => {
            vals.push(
              auth.orgId,
              herdId,
              row.caravana,
              row.rp || null,
              row.sexo || null,
              row.categoria || null,
              row.peso_kg || null,
              row.raza || null,
            )
          })
          await serviceMutate(`
            INSERT INTO animal_padron
              (org_id, herd_id, caravana, rp, sexo, categoria, peso_kg, raza)
            VALUES ${valuePlaceholders}
            ON CONFLICT (org_id, caravana) DO UPDATE SET
              herd_id = EXCLUDED.herd_id,
              rp = EXCLUDED.rp,
              sexo = EXCLUDED.sexo,
              categoria = EXCLUDED.categoria,
              peso_kg = EXCLUDED.peso_kg,
              raza = EXCLUDED.raza,
              updated_at = NOW()
          `, vals)
          uploadedCount += chunk.length
        }
      } catch (padronErr: any) {
        // Non-critical: log but don't fail the request
        console.warn('animal_padron upsert skipped:', padronErr.message)
      }
    }

    return NextResponse.json({
      success: true,
      uploaded: uploadedCount,
      resolution,
      new_head_count: resolution === 'actualizar_stock' ? csvRowCount : herd.head_count,
    })
  } catch (err: any) {
    console.error('POST /api/herds/[id]/animals error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const herdId = (await params).id
    const url = new URL(req.url)
    const limit  = parseInt(url.searchParams.get('limit')  ?? '500', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    let animals: any[] = []
    let total = 0
    try {
      const countRes = await serviceQueryOne<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM animal_padron WHERE herd_id = $1 AND org_id = $2',
        [herdId, auth.orgId]
      )
      total = parseInt(countRes?.count ?? '0', 10)
      animals = await serviceQuery(
        `SELECT caravana, rp, sexo, categoria, fecha_nacimiento, peso_kg, raza, observaciones, updated_at
         FROM animal_padron
         WHERE herd_id = $1 AND org_id = $2
         ORDER BY caravana
         LIMIT $3 OFFSET $4`,
        [herdId, auth.orgId, limit, offset]
      )
    } catch {
      // Table doesn't exist yet — return empty
    }

    return NextResponse.json({ animals, total, limit, offset })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
