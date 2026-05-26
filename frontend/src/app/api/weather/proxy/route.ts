import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const openMeteoUrl = new URL('https://api.open-meteo.com/v1/forecast')
    
    // Copy all query parameters to the Open-Meteo URL
    url.searchParams.forEach((val, key) => {
      openMeteoUrl.searchParams.append(key, val)
    })

    const response = await fetch(openMeteoUrl.toString(), {
      // Ensure we revalidate sometimes, or keep default
      next: { revalidate: 1800 }
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Open-Meteo error: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('[GET /api/weather/proxy]', err)
    return NextResponse.json({ error: 'Error fetching from Open-Meteo' }, { status: 500 })
  }
}
