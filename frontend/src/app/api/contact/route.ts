import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, email, asunto, mensaje } = body

    if (!nombre || !email || !asunto || !mensaje) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
    }

    // Forward to Resend / email service
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const TO_EMAIL = 'soporte@rodeoagtech.com'

    if (!RESEND_API_KEY) {
      console.error('[contact] RESEND_API_KEY not configured')
      return NextResponse.json({ error: 'Servicio de correo no configurado.' }, { status: 500 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rodeo Contacto <no-reply@rodeoagtech.com>',
        to: [TO_EMAIL],
        reply_to: email,
        subject: `[Contacto Rodeo] ${asunto} — ${nombre}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff;">
            <div style="background: #16a34a; padding: 16px 24px; border-radius: 12px; margin-bottom: 24px;">
              <h1 style="color: #fff; font-size: 18px; font-weight: 800; margin: 0;">Nuevo mensaje desde Rodeo</h1>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px;">Nombre</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${nombre}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Correo</td>
                <td style="padding: 8px 0; font-size: 13px;"><a href="mailto:${email}" style="color: #16a34a;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Motivo</td>
                <td style="padding: 8px 0; color: #111827; font-size: 13px; font-weight: 600;">${asunto}</td>
              </tr>
            </table>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${mensaje}</p>
            </div>
            <p style="margin-top: 24px; color: #9ca3af; font-size: 11px;">
              Enviado desde el formulario de contacto de rodeoagtech.com
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[contact] Resend error:', err)
      return NextResponse.json({ error: 'Error al enviar el correo.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact]', err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
