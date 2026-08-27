import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const paddock_id = searchParams.get('paddock_id')

    if (paddock_id) {
      // Usamos query() que automáticamente aplica RLS
      const rows = await query(
        `SELECT * FROM deforestation_checks WHERE paddock_id = $1 ORDER BY checked_at DESC LIMIT 1`,
        [paddock_id]
      )
      return NextResponse.json(rows[0] || null)
    } else {
      // Obtenemos el último check de cada potrero usando DISTINCT ON
      const rows = await query(
        `SELECT DISTINCT ON (paddock_id) * FROM deforestation_checks ORDER BY paddock_id, checked_at DESC`
      )
      return NextResponse.json(rows)
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
