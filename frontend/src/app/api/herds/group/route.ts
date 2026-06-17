/**
 * PATCH /api/herds/group — Agrupa o desagrupa un conjunto de rodeos bajo un Lote de Manejo.
 *
 * Body:
 *   herd_ids:            string[]  — IDs de los rodeos a agrupar
 *   grupo_manejo_id?:    string    — UUID del grupo. Si null, genera uno nuevo.
 *   grupo_manejo_nombre: string    — Nombre legible del lote (ej. "Vacas Jero")
 *   action:              'group' | 'ungroup'
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceMutate } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      herd_ids,
      grupo_manejo_id: providedGroupId,
      grupo_manejo_nombre,
      action = 'group',
    } = body

    if (!herd_ids || !Array.isArray(herd_ids) || herd_ids.length === 0) {
      return NextResponse.json({ error: 'herd_ids requerido' }, { status: 400 })
    }

    if (action === 'ungroup') {
      // Remove from group
      await serviceMutate(
        `UPDATE herds
         SET grupo_manejo_id = NULL,
             grupo_manejo_nombre = NULL,
             updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND org_id = $2`,
        [herd_ids, auth.orgId]
      )
      return NextResponse.json({ success: true, action: 'ungroup' })
    }

    // Generate a new UUID if not provided (first time grouping these herds)
    const grupoId = providedGroupId || randomUUID()
    const nombre  = grupo_manejo_nombre || 'Lote sin nombre'

    await serviceMutate(
      `UPDATE herds
       SET grupo_manejo_id = $1,
           grupo_manejo_nombre = $2,
           updated_at = NOW()
       WHERE id = ANY($3::uuid[]) AND org_id = $4`,
      [grupoId, nombre, herd_ids, auth.orgId]
    )

    return NextResponse.json({ success: true, grupo_manejo_id: grupoId, grupo_manejo_nombre: nombre })
  } catch (err: any) {
    console.error('PATCH /api/herds/group error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
