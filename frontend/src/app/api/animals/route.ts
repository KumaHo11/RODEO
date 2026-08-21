import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query, serviceMutate } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const herd_id = searchParams.get('herd_id')
    const search = searchParams.get('search')

    let sql = `
      SELECT a.*, 
             p.name as paddock_name, 
             h.name as herd_name
      FROM animals a
      LEFT JOIN paddocks p ON a.current_paddock_id = p.id
      LEFT JOIN herds h ON a.current_herd_id = h.id
      WHERE a.org_id = $1
    `
    const params: any[] = [auth.orgId]
    let paramIndex = 2

    if (status && status !== 'Todos') {
      sql += ` AND a.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }
    if (herd_id) {
      sql += ` AND a.current_herd_id = $${paramIndex}`
      params.push(herd_id)
      paramIndex++
    }
    if (search) {
      sql += ` AND (a.visual_tag ILIKE $${paramIndex} OR a.rfid_code ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    sql += ` ORDER BY a.created_at DESC`

    const result = await query(sql, params)

    return NextResponse.json({ animals: result })
  } catch (err: any) {
    console.error('GET /api/animals error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 })
    }

    const {
      rfid_code, visual_tag, name, sex, breed, birth_date,
      mother_id, father_id, current_paddock_id, current_herd_id, notes
    } = body

    // Al menos un identificador es requerido
    if (!rfid_code && !visual_tag && !name) {
      return NextResponse.json({
        error: 'Se requiere al menos un identificador: RFID (rfid_code), caravana (visual_tag) o nombre (name)',
      }, { status: 400 })
    }

    // Sanitizar fecha de nacimiento — string vacío → null para evitar error de PostgreSQL
    const safeBirthDate = birth_date && String(birth_date).trim() !== '' ? birth_date : null

    const result = await serviceMutate(
      `INSERT INTO animals (
        org_id, rfid_code, visual_tag, name, sex, breed, birth_date,
        mother_id, father_id, current_paddock_id, current_herd_id, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'VIVO')
      RETURNING *`,
      [
        auth.orgId,
        rfid_code || null,
        visual_tag || null,
        name || null,
        sex || null,
        breed || null,
        safeBirthDate,
        mother_id || null,
        father_id || null,
        current_paddock_id || null,
        current_herd_id || null,
        notes || null
      ]
    )

    const newAnimal = result.rows ? result.rows[0] : null
    return NextResponse.json({ animal: newAnimal }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/animals error:', err)
    return NextResponse.json({
      error: 'Error interno del servidor',
      detail: err?.message ?? 'Error desconocido',
    }, { status: 500 })
  }
}
