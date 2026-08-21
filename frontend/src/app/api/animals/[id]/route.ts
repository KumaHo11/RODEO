import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query, queryOne, mutate } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params;

    const animal = await queryOne(
      `SELECT a.*, 
              p.name as paddock_name, 
              h.name as herd_name,
              m.visual_tag as mother_tag,
              f.visual_tag as father_tag
       FROM animals a
       LEFT JOIN paddocks p ON a.current_paddock_id = p.id
       LEFT JOIN herds h ON a.current_herd_id = h.id
       LEFT JOIN animals m ON a.mother_id = m.id
       LEFT JOIN animals f ON a.father_id = f.id
       WHERE a.id = $1 AND a.org_id = $2`,
      [id, auth.orgId]
    )

    if (!animal) return NextResponse.json({ error: 'Animal no encontrado' }, { status: 404 })

    return NextResponse.json({ animal })
  } catch (err: any) {
    console.error('GET /api/animals/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params;
    const body = await req.json()
    const allowedFields = [
      'rfid_code', 'visual_tag', 'name', 'sex', 'breed', 'birth_date',
      'mother_id', 'father_id', 'current_paddock_id', 'current_herd_id',
      'status', 'notes'
    ]

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    
    // Add auth.orgId and id to the end of values array
    values.push(id)
    const idIndex = paramIndex
    paramIndex++
    values.push(auth.orgId)
    const orgIdIndex = paramIndex

    const sql = `
      UPDATE animals 
      SET ${updates.join(', ')} 
      WHERE id = $${idIndex} AND org_id = $${orgIdIndex} 
      RETURNING *
    `

    const result = await mutate(sql, values)
    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Animal no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ animal: result.rows[0] })
  } catch (err: any) {
    console.error('PATCH /api/animals/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params;
    const body = await req.json().catch(() => ({}))
    const status = body.status === 'MUERTO' ? 'MUERTO' : 'VENDIDO'

    const result = await mutate(
      `UPDATE animals 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND org_id = $3 
       RETURNING *`,
      [status, id, auth.orgId]
    )

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Animal no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, animal: result.rows[0] })
  } catch (err: any) {
    console.error('DELETE /api/animals/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
