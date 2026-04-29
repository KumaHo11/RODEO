/**
 * GCP Cloud SQL — PostgreSQL Client
 * Reemplaza: @supabase/supabase-js (capa de base de datos)
 * Usa node-postgres (pg) directamente — sin ORM
 */
import { Pool } from 'pg'

declare global {
  var _pgPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL || ''

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
 * Lazy singleton — el pool NO se crea al importar el módulo.
 * Se crea la primera vez que se ejecuta una query real.
 * Esto evita que `new URL('')` explote durante el build de Next.js.
 */
function getPool(): Pool {
  if (process.env.NODE_ENV !== 'production') {
    // En desarrollo, usar singleton global para sobrevivir hot-reloads
    if (!globalThis._pgPool) {
      globalThis._pgPool = createPool()
    }
    return globalThis._pgPool
  }
  // En producción, crear una sola vez por instancia
  if (!globalThis._pgPool) {
    globalThis._pgPool = createPool()
  }
  return globalThis._pgPool
}

/**
 * Ejecuta una query con parámetros tipados
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
  const result = await getPool().query(sql, params)
  return result.rows as T[]
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
  const result = await getPool().query(sql, params)
  return {
    rowCount: result.rowCount ?? 0,
    rows: result.rows,
  }
}

/** Acceso directo al pool para casos que requieren transacciones */
export const getDbPool = getPool
export default getPool()
