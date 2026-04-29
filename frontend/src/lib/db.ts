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
  
  // Durante el build de Next.js, DATABASE_URL puede estar vacía.
  // Evitamos que explote el build devolviendo un pool que no se usará.
  if (!connectionString) {
    return new Pool()
  }

  // Extraer partes de la URL para evitar errores de encoding con caracteres especiales como #
  const url = new URL(connectionString.replace('postgresql://', 'http://')) // URL() no soporta postgresql:// a veces
  
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password), // Decodificamos el %23 para que llegue como #
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
    // Scale: 20 max connections per Next.js instance (Cloud Run scales horizontally)
    // Min 2 keeps connections warm to avoid cold-start latency on first requests
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Prevent runaway queries from blocking the pool under stress
    statement_timeout: 30000, // 30s hard limit per query
  })

  console.log(`🔌 Intentando conectar a DB: user=${url.username} host=${url.hostname} pass_length=${url.password.length}`)

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
