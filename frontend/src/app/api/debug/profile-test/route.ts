/**
 * GET /api/debug/profile-test
 * Temporary endpoint to diagnose the profile 404 issue
 * REMOVE AFTER DEBUGGING
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery } from '@/lib/db'
import { Pool } from 'pg'

export async function GET(req: NextRequest) {
  const result: Record<string, unknown> = {}
  
  try {
    // 1. Check token
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
    result.HAS_TOKEN = !!token
    
    if (token) {
      const decoded = await verifyFirebaseToken(token)
      result.TOKEN_VALID = !!decoded
      result.TOKEN_UID = decoded?.uid
      result.TOKEN_EMAIL = decoded?.email
      
      if (decoded?.uid) {
        // 2. Try serviceQueryOne (what profile route uses)
        try {
          const profile = await serviceQueryOne(
            'SELECT id, firebase_uid, email, organization_id, onboarding_step FROM profiles WHERE firebase_uid = $1',
            [decoded.uid]
          )
          result.SERVICE_QUERY_RESULT = profile
          result.SERVICE_QUERY_FOUND = !!profile
        } catch (e: any) {
          result.SERVICE_QUERY_ERROR = e.message
        }
        
        // 3. Try direct pool query (no RLS context at all)
        try {
          const dbUrl = process.env.DATABASE_URL || ''
          const url = new URL(dbUrl.replace('postgresql://', 'http://'))
          const pool = new Pool({
            host: url.hostname, port: parseInt(url.port || '5432'),
            user: url.username, password: decodeURIComponent(url.password),
            database: url.pathname.slice(1).split('?')[0],
            ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000,
          })
          const directResult = await pool.query(
            'SELECT id, firebase_uid, email, organization_id FROM profiles WHERE firebase_uid = $1',
            [decoded.uid]
          )
          result.DIRECT_QUERY_FOUND = directResult.rows.length > 0
          result.DIRECT_QUERY_RESULT = directResult.rows[0]
          
          // 4. Check RLS status
          const rlsCheck = await pool.query(
            "SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles'"
          )
          result.RLS_ENABLED = rlsCheck.rows[0]?.relrowsecurity
          
          // 5. Check current user
          const whoami = await pool.query('SELECT current_user, current_setting($$is_superuser$$) as is_super')
          result.DB_USER = whoami.rows[0]
          
          await pool.end()
        } catch (e: any) {
          result.DIRECT_QUERY_ERROR = e.message
        }
      }
    }
    
    // 6. Env check
    result.DATABASE_URL_SET = !!process.env.DATABASE_URL
    result.DATABASE_URL_SERVICE_SET = !!process.env.DATABASE_URL_SERVICE
    result.FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    
  } catch (e: any) {
    result.ERROR = e.message
  }
  
  return NextResponse.json(result)
}
