/**
 * /api/health — Health check endpoint
 * Validates database connectivity and reports system status.
 * Used for monitoring, pre-deploy validation, and incident response.
 *
 * Returns:
 * - 200: All systems operational
 * - 503: Database or service degradation detected
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {}
  let allHealthy = true

  // 1. Check DATABASE_URL is configured
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    checks.database_config = { status: 'fail', error: 'DATABASE_URL not set' }
    allHealthy = false
  } else {
    // Parse the URL to show connection target (without password)
    try {
      const parsed = new URL(dbUrl.replace('postgresql://', 'http://'))
      const socketHost = parsed.searchParams.get('host')
      checks.database_config = {
        status: 'ok',
        latencyMs: 0,
        error: undefined,
      }

      // 2. Test actual DB connectivity
      const { Pool } = await import('pg')
      const pool = new Pool({
        connectionString: dbUrl,
        // Parse connection params the same way as db.ts
        ...(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
          ? { ssl: false }
          : { ssl: { rejectUnauthorized: false } }),
        connectionTimeoutMillis: 5000,
        statement_timeout: 5000,
        max: 1,
      })

      const start = Date.now()
      try {
        const result = await pool.query('SELECT current_user, current_database(), now() as server_time')
        const latency = Date.now() - start
        const row = result.rows[0]
        checks.database_connection = {
          status: 'ok',
          latencyMs: latency,
        }
        checks.database_info = {
          status: 'ok',
          latencyMs: 0,
          error: `user=${row.current_user} db=${row.current_database}`,
        }
      } catch (dbErr: unknown) {
        const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr)
        checks.database_connection = {
          status: 'fail',
          latencyMs: Date.now() - start,
          error: errMsg,
        }
        allHealthy = false
      } finally {
        await pool.end().catch(() => {})
      }
    } catch (parseErr: unknown) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      checks.database_config = { status: 'fail', error: `Invalid DATABASE_URL: ${errMsg}` }
      allHealthy = false
    }
  }

  // 3. Check DATABASE_URL_SERVICE
  checks.service_pool_config = {
    status: process.env.DATABASE_URL_SERVICE ? 'ok' : 'warn',
    error: process.env.DATABASE_URL_SERVICE ? undefined : 'DATABASE_URL_SERVICE not set (falling back to DATABASE_URL)',
  }
  if (!process.env.DATABASE_URL_SERVICE) {
    // Not critical but worth noting
  }

  // 4. Check Firebase Admin config
  checks.firebase_admin = {
    status: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'ok' : 'fail',
    error: process.env.FIREBASE_ADMIN_PROJECT_ID ? undefined : 'FIREBASE_ADMIN_PROJECT_ID not set',
  }
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID) allHealthy = false

  // 5. Environment info
  checks.environment = {
    status: 'ok',
    error: `NODE_ENV=${process.env.NODE_ENV || 'development'}`,
  }

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
