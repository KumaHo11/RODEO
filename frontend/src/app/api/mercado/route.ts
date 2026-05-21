import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Types ──────────────────────────────────────────────────────────────────────
interface MercadoResponse {
  argentina: {
    insc_kg_vivo: number | null
    categorias: Record<string, number>
    fecha: string | null
    fuente: string
    error?: string
    history: Array<{ date: string; price: number }>  // real daily prices accumulated
  }
  global: {
    LE_usd_cwt: number | null   // CME Live Cattle (gordo)
    GF_usd_cwt: number | null   // CME Feeder Cattle (de reposición)
    usd_ars: number | null       // Tipo de cambio oficial
    fecha: string
    leHistory: number[]          // últimos cierres reales de LE=F (USD/cwt)
    error?: string
  }
  cachedAt: string
}

// ── In-memory cache ─────────────────────────────────────────────────────────────
let cache: { data: MercadoResponse; ts: number; ttl: number } | null = null
const CACHE_TTL = 6 * 60 * 60 * 1000

// ── Argentine price history — persists while server is running ─────────────────
// One entry per day max (keyed by ISO date), up to 7 entries
const argentineHistory: Array<{ date: string; price: number }> = []

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

import fs from 'fs'
import path from 'path'

// ── Persistent fallback cache (survives dev server restarts) ───────────────────
const FALLBACK_CACHE_PATH = path.join(process.cwd(), '.mercado_cache.json')

function getPersistentFallback() {
  try {
    if (fs.existsSync(FALLBACK_CACHE_PATH)) {
      const data = JSON.parse(fs.readFileSync(FALLBACK_CACHE_PATH, 'utf8'))
      if (data && data.price && data.date) {
        return { insc: data.price, date: data.date }
      }
    }
  } catch(e) {}
  // Default if no cache exists
  return { insc: 4330, date: new Date().toISOString().split('T')[0] }
}

function savePersistentFallback(price: string | number, date: string) {
  try {
    fs.writeFileSync(FALLBACK_CACHE_PATH, JSON.stringify({ price, date }), 'utf8')
  } catch(e) {}
}

const defaultFallback = getPersistentFallback()
const FALLBACK_INSC = defaultFallback.insc
const FALLBACK_DATE = defaultFallback.date

// ── Utilitario para parsear números con formato argentino (ej. "4.329,89") ────
function parseArgNumber(str: string): number {
  if (!str) return 0;
  const cleanStr = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanStr);
}

// ── Fetch INSC / INMAG prices ───────────────────────────────────────────────
async function fetchArgentinaPrices(): Promise<Omit<MercadoResponse['argentina'], 'history'>> {
  const today = new Date().toISOString().split('T')[0]

  // ── Strategy 1: Mercado Agroganadero (Cañuelas) - INMAG ────────────────────
  try {
    const MAG_URL = 'https://www.mercadoagroganadero.com.ar/dll/inicio.dll';
    const res = await fetch(MAG_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (res.ok) {
      const text = await res.text()
      // Extract INMAG index (e.g. "INMAG 4.329,89")
      const inmagMatch = text.match(/INMAG\s*(?:<[^>]+>)*\s*([\d\.,]+)/i);
      
      if (inmagMatch && inmagMatch[1]) {
        const insc = parseArgNumber(inmagMatch[1])
        if (insc > 500) {
          const categorias: Record<string, number> = {}
          for (const [cat, ratio] of Object.entries(CATEGORIA_RATIOS)) {
            categorias[cat] = Math.round(insc * ratio)
          }
          return { insc_kg_vivo: insc, categorias, fecha: today, fuente: 'MAG Cañuelas (INMAG)' }
        }
      }
    }
  } catch (err: any) {
    console.warn('[mercado] MAG Cañuelas fetch failed:', err.message)
  }

  // ── Strategy 2: Try the SIO Carnes website scrape (JSON endpoint) ──────────
  try {
    const res = await fetch('https://www.siocarnes.magyp.gob.ar/php/webservice.php?accion=carnesBovina', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Rodeo/1.0)' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (res.ok) {
      const json = await res.json()
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
        const fecha = novillo?.fecha?.split('T')[0] ?? today
        return { insc_kg_vivo: insc, categorias, fecha, fuente: 'SIO Carnes web' }
      }
    }
  } catch (err2: any) {
    console.warn('[mercado] SIO Carnes web fetch failed:', err2.message)
  }

  // ── Strategy 3: Use the fallback (known approximate value) ─────────────────
  console.warn('[mercado] Using hardcoded INMAG/INSC fallback value')
  const categorias: Record<string, number> = {}
  for (const [cat, ratio] of Object.entries(CATEGORIA_RATIOS)) {
    categorias[cat] = Math.round(FALLBACK_INSC * ratio)
  }
  return {
    insc_kg_vivo: FALLBACK_INSC,
    categorias,
    fecha: FALLBACK_DATE,
    fuente: 'MAG Cañuelas (Último cierre válido)',
    error: 'Mercados no disponibles — usando referencia manual'
  }
}

// ── Fetch CME Futures via Yahoo Finance proxy ──────────────────────────────────
async function fetchGlobalPrices(): Promise<MercadoResponse['global']> {
  const today = new Date().toISOString().split('T')[0]
  try {
    const [leRes, gfRes, fxRes] = await Promise.all([
      // 10d range so we reliably get 5-7 trading days of real closes
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/LE=F?interval=1d&range=10d', {
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

    // ── LE=F: extract full close history ─────────────────────────────────────
    let LE: number | null = null
    let leHistory: number[] = []
    if (leRes.ok) {
      const leJson = await leRes.json()
      const closes: number[] = leJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      const valid = closes
        .filter((c: number | null) => c != null && c > 0)
        .map((c: number) => parseFloat(c.toFixed(2)))
      leHistory = valid.slice(-7) // last 7 real closes
      LE = valid.length > 0 ? valid[valid.length - 1] : null
    }

    // ── GF=F: last close only ─────────────────────────────────────────────────
    let GF: number | null = null
    if (gfRes.ok) {
      const gfJson = await gfRes.json()
      const closes: number[] = gfJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      const valid = closes.filter((c: number | null) => c != null && c > 0)
      GF = valid.length > 0 ? parseFloat((valid[valid.length - 1] as number).toFixed(2)) : null
    }

    // ── USD/ARS ───────────────────────────────────────────────────────────────
    let usdArs: number | null = null
    if (fxRes.ok) {
      const fxJson = await fxRes.json()
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

    return { LE_usd_cwt: LE, GF_usd_cwt: GF, usd_ars: usdArs, fecha: today, leHistory }
  } catch (err: any) {
    console.error('[mercado] Global fetch error:', err.message)
    return { LE_usd_cwt: null, GF_usd_cwt: null, usd_ars: null, fecha: today, leHistory: [], error: err.message }
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  // Force refresh if ?bust= param is present
  const url = new URL(req.url)
  const forceBust = url.searchParams.has('bust')

  if (!forceBust && cache && Date.now() - cache.ts < cache.ttl) {
    return NextResponse.json(cache.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=3600' }
    })
  }

  const [argBase, global] = await Promise.all([
    fetchArgentinaPrices(),
    fetchGlobalPrices(),
  ])

  // ── Accumulate real Argentine price history ─────────────────────────────────
  // One entry per calendar day (de-duplicated by date). Max 7 days retained.
  const today = new Date().toISOString().split('T')[0]
  if (argBase.insc_kg_vivo && argBase.insc_kg_vivo > 500 && !argBase.error) {
    savePersistentFallback(argBase.insc_kg_vivo, today)
    const existingToday = argentineHistory.find(h => h.date === today)
    if (!existingToday) {
      argentineHistory.push({ date: today, price: argBase.insc_kg_vivo })
      if (argentineHistory.length > 7) argentineHistory.shift()
    }
  }

  const response: MercadoResponse = {
    argentina: {
      ...argBase,
      history: [...argentineHistory],
    },
    global,
    cachedAt: new Date().toISOString(),
  }

  // Use a shorter cache TTL (5 mins) if we had to use the fallback due to errors
  const hasError = !!argBase.error || !!global.error
  const ttlToUse = hasError ? 5 * 60 * 1000 : CACHE_TTL

  cache = { data: response, ts: Date.now(), ttl: ttlToUse }

  return NextResponse.json(response, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=3600' }
  })
}
