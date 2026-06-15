import { NextRequest, NextResponse } from 'next/server'
import { mutate } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const res = await mutate(`DELETE FROM profiles WHERE email IN ('javi.osorio.1@gmail.com', 'javo.oso.m@gmail.com', 'josorio@rodeoagtech.com')`)
    return NextResponse.json({ success: true, message: 'Perfiles borrados de la base de datos SQL de producción.' })
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
