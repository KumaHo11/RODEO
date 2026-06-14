import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const activeVersion = await queryOne(
      `SELECT id, version_number, content, created_at 
       FROM terms_and_conditions_versions 
       WHERE is_active = true 
       LIMIT 1`
    )
    
    if (!activeVersion) {
      return NextResponse.json({ error: 'No active terms version found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: activeVersion })
  } catch (error: any) {
    console.error('Error fetching active terms:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
