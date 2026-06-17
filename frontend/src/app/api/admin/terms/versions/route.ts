import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceMutate } from '@/lib/db'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded || decoded.system_role !== 'SUPER_ADMIN') return null
  return decoded
}

// Obtener todas las versiones (historial)
export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const versions = await serviceQuery(
      `SELECT id, version_number, content, is_active, created_at 
       FROM terms_and_conditions_versions
       ORDER BY created_at DESC`
    )
    return NextResponse.json({ success: true, versions })
  } catch (err: any) {
    console.error('Error in GET /api/admin/terms/versions:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Crear una nueva versión y activarla
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const { versionNumber, content } = body

    if (!versionNumber || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Desactivar todas las versiones actuales
    await serviceMutate(`UPDATE terms_and_conditions_versions SET is_active = false`)

    // 2. Insertar nueva versión activa
    const result = await serviceMutate(
      `INSERT INTO terms_and_conditions_versions (version_number, content, is_active)
       VALUES ($1, $2, true)
       RETURNING id, version_number, is_active, created_at`,
      [versionNumber, content]
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/admin/terms/versions:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
