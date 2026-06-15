import { NextRequest, NextResponse } from 'next/server'
import { mutate } from '@/lib/db'
import { adminAuth } from '@/lib/firebase/admin'

export async function GET(req: NextRequest) {
  try {
    const emails = ['javi.osorio.1@gmail.com', 'javo.oso.m@gmail.com', 'josorio@rodeoagtech.com']
    
    // Obtener IDs de perfiles
    const profilesResult = await mutate(`SELECT id FROM profiles WHERE email = ANY($1::text[])`, [emails])
    if (profilesResult.rows.length > 0) {
      const ids = profilesResult.rows.map((p: any) => p.id)
      await mutate(`DELETE FROM user_terms_acceptances WHERE profile_id = ANY($1::uuid[])`, [ids])
    }
    
    await mutate(`DELETE FROM profiles WHERE email = ANY($1::text[])`, [emails])
    
    let deletedCount = 0
    let authErrors: any[] = []
    for (const email of emails) {
      try {
        const user = await adminAuth.getUserByEmail(email)
        await adminAuth.deleteUser(user.uid)
        deletedCount++
      } catch(e: any) {
        if (e.code !== 'auth/user-not-found') {
          console.error('Firebase Auth error for', email, e)
          authErrors.push({ email, error: String(e), code: e.code })
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Perfiles SQL borrados y ${deletedCount} usuarios eliminados de Firebase Auth.`,
      authErrors
    })
  } catch(e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
