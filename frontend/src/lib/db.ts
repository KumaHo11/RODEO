/**
 * GCP Cloud SQL — PostgreSQL Client
 * Capa de base de datos (PostgreSQL directo)
 * Usa node-postgres (pg) directamente — sin ORM
 *
 * Arquitectura de dos roles:
 *   - DATABASE_URL         → rodeo_app (sujeto a RLS, queries de usuario)
 *   - DATABASE_URL_SERVICE → rodeo_service (BYPASSRLS, registro/admin/cron)
 *
 * Las funciones query/queryOne/mutate usan el pool principal (con RLS).
 * Las funciones serviceQuery/serviceMutate usan el pool de servicio (sin RLS).
 */
import { Pool } from 'pg'
import { headers, cookies } from 'next/headers'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'

const tokenCache = new Map<string, { uid: string, orgId: string | null, expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

async function getContextUid(): Promise<{ uid: string; orgId: string | null } | null> {
  try {
    const headersList = await headers()
    let token = headersList.get('authorization')?.replace('Bearer ', '').trim()
    
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('__session')?.value?.trim()
    }

    if (!token) return null

    const cached = tokenCache.get(token)
    if (cached && Date.now() < cached.expiresAt) {
      return { uid: cached.uid, orgId: cached.orgId }
    }

    const decoded = await verifyFirebaseToken(token)
    if (decoded?.uid) {
      // Look up org_id for RLS context — use service pool to avoid RLS chicken-and-egg
      let orgId: string | null = null
      try {
        const svcPool = getServicePool()
        const orgResult = await svcPool.query(
          'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
          [decoded.uid]
        )
        orgId = orgResult.rows[0]?.organization_id ?? null
      } catch {
        // Ignore — org lookup failure should not block the request
      }

      tokenCache.set(token, { uid: decoded.uid, orgId, expiresAt: Date.now() + CACHE_TTL_MS })
      return { uid: decoded.uid, orgId }
    }
  } catch (e) {
    // Ignorar si no estamos en contexto de request
  }
  return null
}


declare global {
  var _pgPool: Pool | undefined
  var _pgUrl: string | undefined
  var _pgServicePool: Pool | undefined
  var _pgServiceUrl: string | undefined
}

function createPoolFromUrl(connectionString: string): Pool {
  if (!connectionString) {
    // Dummy pool durante el build de Next.js (DATABASE_URL no disponible en build time)
    return new Pool()
  }

  // Extraer partes de la URL para evitar errores de encoding con caracteres especiales
  const url = new URL(connectionString.replace('postgresql://', 'http://'))

  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  })

  pool.on('error', (err) => {
    console.error('DB Pool error:', err)
  })

  return pool
}

/**
 * Pool principal — queries de usuario autenticado (sujetas a RLS)
 * Usa DATABASE_URL (rol rodeo_app)
 */
function getPool(): Pool {
  const currentUrl = process.env.DATABASE_URL || ''
  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis._pgPool || globalThis._pgUrl !== currentUrl) {
      if (globalThis._pgPool) {
        globalThis._pgPool.end().catch(console.error)
      }
      globalThis._pgPool = createPoolFromUrl(currentUrl)
      globalThis._pgUrl = currentUrl
    }
    return globalThis._pgPool
  }
  if (!globalThis._pgPool) {
    globalThis._pgPool = createPoolFromUrl(currentUrl)
  }
  return globalThis._pgPool
}

/**
 * Pool de servicio — operaciones de backend confiable (BYPASSRLS)
 * Usa DATABASE_URL_SERVICE si existe, sino fallback a DATABASE_URL
 * Se usa para: registro, onboarding, cron jobs, admin, migraciones
 */
function getServicePool(): Pool {
  const currentUrl = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL || ''
  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis._pgServicePool || globalThis._pgServiceUrl !== currentUrl) {
      if (globalThis._pgServicePool) {
        globalThis._pgServicePool.end().catch(console.error)
      }
      globalThis._pgServicePool = createPoolFromUrl(currentUrl)
      globalThis._pgServiceUrl = currentUrl
    }
    return globalThis._pgServicePool
  }
  if (!globalThis._pgServicePool) {
    globalThis._pgServicePool = createPoolFromUrl(currentUrl)
  }
  return globalThis._pgServicePool
}

// ═══════════════════════════════════════════════════════════════════════
// Queries de usuario (con RLS)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ejecuta una query con parámetros tipados.
 * Setea el contexto RLS (sub + org_id) automáticamente si hay un usuario autenticado.
 * @example
 * const rows = await query('SELECT * FROM paddocks WHERE org_id = $1', [orgId])
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  if (!process.env.DATABASE_URL) {
    return []
  }
  
  const pool = getPool()
  const ctx = await getContextUid()
  
  if (ctx) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Setear claims para RLS
      const safeSub = ctx.uid.replace(/'/g, "''")
      await client.query(`SET LOCAL request.jwt.claim.sub = '${safeSub}'`)
      if (ctx.orgId) {
        const safeOrg = ctx.orgId.replace(/'/g, "''")
        await client.query(`SET LOCAL request.jwt.claim.org_id = '${safeOrg}'`)
      }
      const result = await client.query(sql, params)
      await client.query('COMMIT')
      return result.rows as T[]
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    // Fallback sin RLS para jobs internos o llamadas no autenticadas
    const result = await pool.query(sql, params)
    return result.rows as T[]
  }
}

/**
 * Obtiene una sola fila — devuelve null si no existe
 */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

/**
 * Ejecuta una mutación (INSERT, UPDATE, DELETE)
 * Retorna rowCount y rows
 */
export async function mutate(
  sql: string,
  params?: unknown[]
): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
  if (!process.env.DATABASE_URL) {
    return { rowCount: 0, rows: [] }
  }
  
  const pool = getPool()
  const ctx = await getContextUid()
  
  if (ctx) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const safeSub = ctx.uid.replace(/'/g, "''")
      await client.query(`SET LOCAL request.jwt.claim.sub = '${safeSub}'`)
      if (ctx.orgId) {
        const safeOrg = ctx.orgId.replace(/'/g, "''")
        await client.query(`SET LOCAL request.jwt.claim.org_id = '${safeOrg}'`)
      }
      const result = await client.query(sql, params)
      await client.query('COMMIT')
      return {
        rowCount: result.rowCount ?? 0,
        rows: result.rows,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    const result = await pool.query(sql, params)
    return {
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Queries de servicio (sin RLS — BYPASSRLS role)
// Para: registro, onboarding, cron jobs, admin, migraciones
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ejecuta una query usando el pool de servicio (BYPASSRLS).
 * NO setea claims RLS — el rol rodeo_service los ignora.
 * Usar para operaciones de backend confiable.
 */
export async function serviceQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const dbUrl = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
  if (!dbUrl) return []
  const pool = getServicePool()
  const result = await pool.query(sql, params)
  return result.rows as T[]
}

/**
 * Obtiene una sola fila usando el pool de servicio — devuelve null si no existe
 */
export async function serviceQueryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await serviceQuery<T>(sql, params)
  return rows[0] ?? null
}

/**
 * Ejecuta una mutación usando el pool de servicio (BYPASSRLS).
 * Usar para: registro de usuarios, operaciones admin, cron jobs.
 */
export async function serviceMutate(
  sql: string,
  params?: unknown[]
): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
  const dbUrl = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
  if (!dbUrl) return { rowCount: 0, rows: [] }
  const pool = getServicePool()
  const result = await pool.query(sql, params)
  return {
    rowCount: result.rowCount ?? 0,
    rows: result.rows,
  }
}

/** Acceso directo al pool para casos que requieren transacciones */
export const getDbPool = getPool
export { getServicePool }
