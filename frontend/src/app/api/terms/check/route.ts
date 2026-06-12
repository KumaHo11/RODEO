import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ needsAcceptance: false }) // Let other layers handle auth
    
    const decoded = await verifyFirebaseToken(token)
    if (!decoded?.uid) return NextResponse.json({ needsAcceptance: false })

    // 1. Get active terms
    const activeVersion = await queryOne<{ id: string, content: string, version_number: string }>(
      `SELECT id, content, version_number FROM terms_and_conditions_versions WHERE is_active = true LIMIT 1`
    )

    if (!activeVersion) {
      return NextResponse.json({ needsAcceptance: false })
    }

    // 2. Get profile ID
    const profile = await queryOne<{ id: string }>(
      `SELECT id FROM profiles WHERE firebase_uid = $1 LIMIT 1`,
      [decoded.uid]
    )

    if (!profile) {
      return NextResponse.json({ needsAcceptance: false })
    }

    // 3. Check if accepted
    const acceptance = await queryOne(
      `SELECT id FROM user_terms_acceptances WHERE profile_id = $1 AND version_id = $2 LIMIT 1`,
      [profile.id, activeVersion.id]
    )

    if (!acceptance) {
      return NextResponse.json({ 
        needsAcceptance: true, 
        activeTerms: activeVersion 
      })
    }

    return NextResponse.json({ needsAcceptance: false })
  } catch (error) {
    console.error('Error checking terms acceptance:', error)
    return NextResponse.json({ needsAcceptance: false })
  }
}
