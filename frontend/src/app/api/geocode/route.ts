import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 3) {
    return NextResponse.json([], { status: 200 })
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`
    
    // Simplest possible fetch to minimize proxy overhead
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RODEO_Setup_Wizard_Crawler_1.0'
      },
      next: { revalidate: 3600 } // Cache results for 1 hour
    })

    if (!res.ok) {
      throw new Error(`Nominatim responded with ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Geocode Proxy Error:', err.message)
    // Return empty array instead of 500 to keep UI stable
    return NextResponse.json([], { status: 200 })
  }
}
