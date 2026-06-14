import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,idd')
    if (!res.ok) {
      throw new Error('Failed to fetch from restcountries')
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Failed to fetch countries', err)
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 })
  }
}
