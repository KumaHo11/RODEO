import { NextResponse } from 'next/server'

// ── Types ──────────────────────────────────────────────────────────────────────
interface MercadoResponse {
  argentina: {
    insc_kg_vivo: number | null
    categorias: Record<string, number>
    fecha: string | null
    fuente: string
    error?: string
  }
  global: {
    LE_usd_cwt: number | null   // CME Live Cattle (gordo)
    GF_usd_cwt: number | null   // CME Feeder Cattle (de reposición)
    usd_ars: number | null       // Tipo de cambio oficial
    fecha: string
    error?: string
  }
  cachedAt: string
}

// ── In-memory cache (6 hours) ─────────────────────────────────────────────────
let cache: { data: MercadoResponse; ts: number } | null = null
const CACHE_TTL = 6 * 60 * 60 * 1000

// ── Categoria price map (relative to INSC) ─────────────────────────────────────
const CATEGORIA_RATIOS: Record<string, number> = {
  NOVILLOS:    1.00,
  NOVILLITOS:  0.98,
  VAQUILLONAS: 0.90,
  TERNEROS:    1.08,
  TERNERAS:    1.04,
  VACAS:       0.82,
  TOROS:       0.70,
  MEJ:         0.78,
  BUBALINOS:   0.85,
}

// ── Fallback prices (last known good — updated manually) ──────────────────────
// INSC al ~2026-04 según cotizaciones de referencia Liniers/ROSGAN
const FALLBACK_INSC = 2800   // ARS/kg vivo — referencia aproximada
const FALLBACK_DATE = '2026-04-07'

// ── Parse CSV text for INSC ────────────────────────────────────────────────────
function parseInscCsv(text: string): { insc: number; fecha: string } | null {
  try {
    const lines = text.split('\n').map(l => l.replace(/\r/g, '').trim()).filter(Boolean)
    if (lines.length < 2) return null

    // Header line → find column indices
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const fechaIdx = header.findIndex(h => h.toLowerCase().includes('fecha'))
    const inscIdx  = header.findIndex(h => h.toLowerCase().includes('insc'))
    if (fechaIdx < 0 || inscIdx < 0) return null

    // Sort remaining lines by date descending to get latest
    const rows = lines.slice(1)
      .map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        return { fecha: cols[fechaIdx] ?? '', insc: parseFloat(cols[inscIdx] ?? '0') }
      })
      .filter(r => r.insc > 0 && r.fecha)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    if (rows.length === 0) return null
    return { insc: rows[0].insc, fecha: rows[0].fecha.split('T')[0] }
  } catch {
    return null
  }
}

// ── Fetch INSC from SIO Carnes CSV ────────────────────────────────────────────
async function fetchArgentinaPrices(): Promise<MercadoResponse['argentina']> {
  const CSV_URL = 'https://datos.magyp.gob.ar/dataset/175f48c6-312c-486a-b533-91f80de4ebbe/resource/f599d23f-2be9-4738-855e-205d2e064b6a/download/indice-novillo-sio-carnes.csv'

  // ── Strategy 1: SIO Carnes INSC CSV from datos.gob.ar ──────────────────────
  try {
    const res = await fetch(CSV_URL, {
      headers: { 'User-Agent': 'Rodeo-App/1.0' },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`CSV responded ${res.status}`)

    const text = await res.text()
    const parsed = parseInscCsv(text)

    if (parsed && parsed.insc > 0) {
      // If data is old (pre-2024), it means the CSV only has historical data
      // The INSC in 2018 was ~$32/kg, in 2025+ it's in the thousands
      // Detect if this is stale data and normalize accordingly
      const year = parseInt(parsed.fecha.slice(0, 4))
      let insc = parsed.insc

      if (year < 2022 && insc < 500) {
        // Old data — use fallback instead (data is clearly stale)
        throw new Error(`CSV data is stale (${parsed.fecha}, $${insc}/kg) — using fallback`)
      }

      const categorias: Record<string, number> = {}
      for (const [cat, ratio] of Object.entries(CATEGORIA_RATIOS)) {
        categorias[cat] = Math.round(insc * ratio)
      }
      return { insc_kg_vivo: insc, categorias, fecha: parsed.fecha, fuente: 'SIO Carnes INSC / datos.gob.ar' }
    }

    throw new Error('No valid INSC record in CSV')
  } catch (err1: any) {
    console.warn('[mercado] CSV primary fetch failed:', err1.message)
  }

  // ── Strategy 2: Try the SIO Carnes website scrape (JSON endpoint) ──────────
  try {
    // Try fetching the public SIO Carnes API endpoint
    const res = await fetch('https://www.siocarnes.magyp.gob.ar/php/webservice.php?accion=carnesBovina', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Rodeo/1.0)' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (res.ok) {
      const json = await res.json()
      // The response structure varies — look for novillo/INSC value
      const items: any[] = Array.isArray(json) ? json : (json?.data ?? json?.rows ?? [])
      const novillo = items.find((r: any) =>
        (r.categoria ?? r.Categoria ?? '').toLowerCase().includes('novillo') ||
        (r.nombre ?? '').toLowerCase().includes('novillo')
      )
      const insc = novillo ? parseFloat(novillo.precio_kg ?? novillo.precio ?? novillo.valor ?? '0') : 0
      if (insc > 500) {
        const categorias: Record<string, number> = {}
        for (const [cat, ratio] of Object.entries(CATEGORIA_RATIOS)) {
          categorias[cat] = Math.round(insc * ratio)
        }
        const fecha = novillo?.fecha?.split('T')[0] ?? new Date().toISOString().split('T')[0]
        return { insc_kg_vivo: insc, categorias, fecha, fuente: 'SIO Carnes web' }
      }
    }
  } catch (err2: any) {
    console.warn('[mercado] SIO Carnes web fetch failed:', err2.message)
  }

  // ── Strategy 3: Use the fallback (known approximate value) ─────────────────
  console.warn('[mercado] Using hardcoded INSC fallback value')
  const categorias: Record<string, number> = {}
  for (const [cat, ratio] of Object.entries(CATEGORIA_RATIOS)) {
    categorias[cat] = Math.round(FALLBACK_INSC * ratio)
  }
  return {
    insc_kg_vivo: FALLBACK_INSC,
    categorias,
    fecha: FALLBACK_DATE,
    fuente: 'Referencia aproximada (Liniers/ROSGAN ~2026-04)',
    error: 'API SIO Carnes no disponible — usando referencia manual'
  }
}

// ── Fetch CME Futures via Yahoo Finance proxy ──────────────────────────────────
async function fetchGlobalPrices(): Promise<MercadoResponse['global']> {
  const today = new Date().toISOString().split('T')[0]
  try {
    const [leRes, gfRes, fxRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/LE=F?interval=1d&range=5d', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/GF=F?interval=1d&range=5d', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      }),
      // USD/ARS via exchangerate.host (free, no key needed)
      fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      }),
    ])

    const extractLastClose = async (r: Response): Promise<number | null> => {
      if (!r.ok) return null
      const j = await r.json()
      const closes: number[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      const valid = closes.filter((c: number | null) => c != null && c > 0)
      return valid.length > 0 ? parseFloat(valid[valid.length - 1].toFixed(2)) : null
    }

    const [LE, GF] = await Promise.all([extractLastClose(leRes), extractLastClose(gfRes)])

    let usdArs: number | null = null
    if (fxRes.ok) {
      const fxJson = await fxRes.json()
      // open.er-api format: { rates: { ARS: ... } }
      usdArs = fxJson?.rates?.ARS ?? null
    }

    // Secondary FX fallback if needed
    if (!usdArs) {
      try {
        const fx2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        })
        if (fx2.ok) {
          const fxJson2 = await fx2.json()
          usdArs = fxJson2?.rates?.ARS ?? null
        }
      } catch {}
    }

    return { LE_usd_cwt: LE, GF_usd_cwt: GF, usd_ars: usdArs, fecha: today }
  } catch (err: any) {
    console.error('[mercado] Global fetch error:', err.message)
    return { LE_usd_cwt: null, GF_usd_cwt: null, usd_ars: null, fecha: today, error: err.message }
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  // Force refresh if ?bust= param is present
  const url = new URL(req.url)
  const forceBust = url.searchParams.has('bust')

  if (!forceBust && cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=3600' }
    })
  }

  const [argentina, global] = await Promise.all([
    fetchArgentinaPrices(),
    fetchGlobalPrices(),
  ])

  const response: MercadoResponse = {
    argentina,
    global,
    cachedAt: new Date().toISOString(),
  }

  cache = { data: response, ts: Date.now() }

  return NextResponse.json(response, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=3600' }
  })
}
