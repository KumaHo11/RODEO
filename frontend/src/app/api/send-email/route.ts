/**
 * POST /api/send-email
 * Generic email sender — delegates to the centralized SendGrid helper.
 * Body: { type: EmailType, to: string, params: object }
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, EmailType } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { type, to, params } = await req.json()

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing type or to' }, { status: 400 })
    }

    await sendEmail(type as EmailType, to, params ?? {})

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/send-email]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
