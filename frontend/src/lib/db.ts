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
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

  pool.on('error', (err) => {
    console.error('DB Pool error:', err)
  })

  return pool
}

// Singleton para evitar múltiples pools en desarrollo (hot reload)
export const pool = globalThis._pgPool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgPool = pool
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
  const result = await pool.query(sql, params)
  return result.rows as T[]
}

/**
 * Obtiene una sola fila — lanza error si no existe
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
  const result = await pool.query(sql, params)
  return {
    rowCount: result.rowCount ?? 0,
    rows: result.rows,
  }
}

export default pool
