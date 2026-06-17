/**
 * GET /api/debug/auth-config
 * TEMPORARY — Remove after debugging registration flow
 */
import { NextResponse } from 'next/server'

export async function GET() {
  const credBase64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || ''
  let saProjectId = 'NOT_PARSEABLE'
  let saClientEmail = 'NOT_PARSEABLE'
  
  if (credBase64) {
    try {
      const saJson = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf8'))
      saProjectId = saJson.project_id || 'MISSING_IN_SA'
      saClientEmail = saJson.client_email || 'MISSING_IN_SA'
    } catch {
      saProjectId = 'PARSE_ERROR'
    }
  } else {
    saProjectId = 'NO_CREDENTIALS_BASE64'
  }

  return NextResponse.json({
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT_SET',
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT_SET',
    SA_PROJECT_ID: saProjectId,
    SA_CLIENT_EMAIL: saClientEmail,
    EMAIL_VERIFY_JWT_SECRET_SET: !!process.env.EMAIL_VERIFY_JWT_SECRET,
    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'NOT_SET',
    PROJECTS_MATCH: saProjectId === (process.env.FIREBASE_ADMIN_PROJECT_ID || ''),
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
  })
}
