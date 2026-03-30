import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Use the verified Resend testing domain while in development / free plan
const FROM = 'RODEO <onboarding@resend.dev>'

// ── Email HTML templates ─────────────────────────────────────────────────────
function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
          <!-- Header -->
          <tr>
            <td style="background:#16a34a;padding:28px 40px;text-align:center">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1px">Rodeo</h1>
              <p style="margin:4px 0 0;color:#bbf7d0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Gestión Ganadera Regenerativa</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:11px">© ${new Date().getFullYear()} RODEO · Gestión Ganadera Regenerativa</p>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:10px">Este email fue enviado automáticamente. No respondas a este mensaje.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function invitationTemplate(params: { orgName: string; inviterName: string; role: string; joinUrl: string }) {
  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador', CAPATAZ: 'Capataz',
    VETERINARIO: 'Veterinario', AYUDANTE: 'Ayudante',
  }
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:900">Fuiste invitado al equipo 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
      <strong>${params.inviterName}</strong> te invitó a unirte a <strong>${params.orgName}</strong> en RODEO
      como <strong>${roleLabels[params.role] || params.role}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:28px">
      <p style="margin:0;color:#166534;font-size:13px;font-weight:600">
        📋 Tu rol: ${roleLabels[params.role] || params.role}<br/>
        🌿 Campo: ${params.orgName}<br/>
        ⏰ La invitación expira en 7 días
      </p>
    </div>
    <a href="${params.joinUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:-0.3px">
      Aceptar invitación →
    </a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">
      O copiá este link en tu navegador:<br/>
      <a href="${params.joinUrl}" style="color:#16a34a;word-break:break-all">${params.joinUrl}</a>
    </p>`
  return baseTemplate('Invitación a RODEO', body)
}

function eventReminderTemplate(params: { eventName: string; eventDate: string; herdName?: string; paddockName?: string }) {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:900">Recordatorio de evento 📅</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
      Tenés un evento próximo agendado para mañana.
    </p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:28px">
      <p style="margin:0 0 6px;color:#1e40af;font-size:20px;font-weight:900">${params.eventName}</p>
      <p style="margin:0;color:#3b82f6;font-size:13px;font-weight:600">
        📅 Fecha: ${params.eventDate}
        ${params.herdName ? `<br/>🐄 Rebaño: ${params.herdName}` : ''}
        ${params.paddockName ? `<br/>📍 Potrero: ${params.paddockName}` : ''}
      </p>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/agenda" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
      Ver en la Agenda →
    </a>`
  return baseTemplate('Recordatorio de evento — RODEO', body)
}

function taskCompletedTemplate(params: { taskTitle: string; completedBy: string; orgName: string }) {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:900">Tarea completada ✅</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
      Un miembro de tu equipo completó una tarea asignada.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:28px">
      <p style="margin:0 0 4px;color:#166534;font-size:16px;font-weight:900">${params.taskTitle}</p>
      <p style="margin:0;color:#16a34a;font-size:13px;font-weight:600">
        ✓ Completada por: ${params.completedBy}
      </p>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/tareas" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
      Ver Tareas →
    </a>`
  return baseTemplate('Tarea completada — RODEO', body)
}

function grazingAlertTemplate(params: { paddockName: string; restDays: number; message: string }) {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:900">Alerta de pastoreo ⚠️</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
      Hay una alerta en uno de tus potreros que requiere atención.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-bottom:28px">
      <p style="margin:0 0 4px;color:#92400e;font-size:16px;font-weight:900">${params.paddockName}</p>
      <p style="margin:0;color:#b45309;font-size:13px;font-weight:600">
        ⏱ Días de descanso: ${params.restDays} días<br/>
        📝 ${params.message}
      </p>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/grazing" style="display:inline-block;background:#d97706;color:#ffffff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
      Ver Planificador →
    </a>`
  return baseTemplate('Alerta de pastoreo — RODEO', body)
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { type, to, params } = await req.json()

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing type or to' }, { status: 400 })
    }

    let subject = ''
    let html = ''

    switch (type) {
      case 'invitation':
        subject = `Te invitaron a unirte a ${params.orgName} en RODEO`
        html = invitationTemplate(params)
        break
      case 'event_reminder':
        subject = `Recordatorio: ${params.eventName} — mañana`
        html = eventReminderTemplate(params)
        break
      case 'task_completed':
        subject = `Tarea completada: ${params.taskTitle}`
        html = taskCompletedTemplate(params)
        break
      case 'grazing_alert':
        subject = `⚠️ Alerta de pastoreo: ${params.paddockName}`
        html = grazingAlertTemplate(params)
        break
      default:
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    if (error) {
      console.error('[Resend error]', error)
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    console.error('[Email API error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
