/**
 * GET /api/debug/db-check
 * Temporary diagnostic endpoint — REMOVE after debugging
 */
import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || ''
  const fbProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  const fbAdminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || ''
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || ''
  
  const result: Record<string, unknown> = {
    DATABASE_URL_SET: !!dbUrl,
    DATABASE_URL_LENGTH: dbUrl.length,
    DATABASE_URL_PREFIX: dbUrl.substring(0, 30) + '...',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: fbProjectId,
    FIREBASE_ADMIN_PROJECT_ID: fbAdminProjectId,
    FIREBASE_PROJECT_ID: firebaseProjectId,
    NODE_ENV: process.env.NODE_ENV,
  }

  // Try to query the database
  if (dbUrl) {
    try {
      const url = new URL(dbUrl.replace('postgresql://', 'http://'))
      result.DB_HOST = url.hostname
      result.DB_NAME = url.pathname.slice(1).split('?')[0]
      result.DB_USER = url.username

      const pool = new Pool({
        host: url.hostname,
        port: parseInt(url.port || '5432'),
        user: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1).split('?')[0],
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      })

      const profileCount = await pool.query('SELECT count(*) as cnt FROM profiles')
      result.PROFILE_COUNT = profileCount.rows[0].cnt

      const recentProfiles = await pool.query(
        "SELECT firebase_uid, email, created_at FROM profiles ORDER BY created_at DESC LIMIT 5"
      )
      result.RECENT_PROFILES = recentProfiles.rows

      // Check RLS status
      const rlsCheck = await pool.query(
        "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'profiles'"
      )
      result.RLS_STATUS = rlsCheck.rows[0]

      // Check RLS policies
      const policies = await pool.query(
        "SELECT policyname, cmd, qual::text, with_check::text FROM pg_policy WHERE polrelid = 'profiles'::regclass"
      )
      result.RLS_POLICIES = policies.rows

      await pool.end()
    } catch (err: any) {
      result.DB_ERROR = err.message
    }
  }

  return NextResponse.json(result, { status: 200 })
}
