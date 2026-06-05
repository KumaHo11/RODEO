import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const revalidate = 60 // Cache for 60 seconds

export async function GET() {
  try {
    const configs = await query<{ key: string; value: string }>(
      `SELECT key, value FROM system_config WHERE category = 'menu'`
    )
    
    const menuConfig: Record<string, boolean> = {}
    for (const c of configs) {
      menuConfig[c.key] = c.value === 'true'
    }

    return NextResponse.json(menuConfig)
  } catch (err) {
    console.error('GET /api/config/menu error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
