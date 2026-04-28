/**
 * Centralized email sender — uses Resend (https://resend.com)
 * Set RESEND_API_KEY in environment (.env.local and Cloud Run secrets)
 * Free tier: 3,000 emails/month · No credit card required
 */
import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'soporte@rodeoagtech.com'
const FROM_NAME  = 'RODEO'

// ── Template builder ───────────────────────────────────────────────────────

function baseLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <!-- Header -->
    <tr><td style="background:#16a34a;padding:28px 40px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1px">Rodeo</h1>
      <p style="margin:4px 0 0;color:#bbf7d0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Gestión Ganadera Regenerativa</p>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:36px 40px">${body}</td></tr>
    <!-- Footer -->
    <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:11px">© ${new Date().getFullYear()} RODEO · Todos los derechos reservados</p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`
}

const templates = {

  verify_email: (p: { firstName: string; verifyUrl: string }) => ({
    subject: '¡Bienvenido a RODEO! Verificá tu cuenta',
    html: baseLayout(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:900">Hola, ${p.firstName} 👋</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
        Tu cuenta en <strong>RODEO</strong> está casi lista. Solo necesitás verificar tu correo para comenzar.
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${p.verifyUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:800;text-decoration:none">
          Verificar mi cuenta →
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
        Si no creaste esta cuenta, ignorá este mensaje.<br/>
        Link: <a href="${p.verifyUrl}" style="color:#16a34a">${p.verifyUrl}</a>
      </p>
    `),
  }),

  team_invitation: (p: {
    inviterName: string; orgName: string; roleLabel: string; inviteLink: string
  }) => ({
    subject: `Te invitaron a unirte a ${p.orgName} en RODEO`,
    html: baseLayout(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:900">Fuiste invitado al equipo 🎉</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
        <strong>${p.inviterName}</strong> te invitó a unirte a <strong>${p.orgName}</strong>
        en RODEO como <strong>${p.roleLabel}</strong>.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:28px">
        <p style="margin:0;color:#166534;font-size:13px;font-weight:600;line-height:1.8">
          📋 Tu rol: ${p.roleLabel}<br/>
          🌿 Campo: ${p.orgName}<br/>
          ⏰ La invitación expira en 7 días
        </p>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${p.inviteLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 36px;border-radius:12px;font-size:16px;font-weight:800;text-decoration:none">
          Aceptar invitación →
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
        O copiá este link: <a href="${p.inviteLink}" style="color:#16a34a;word-break:break-all">${p.inviteLink}</a>
      </p>
    `),
  }),

  task_assigned: (p: {
    assigneeName: string
    creatorName: string
    taskTitle: string
    taskDescription: string
    dueDate: string
    priority: string
    dashboardUrl: string
  }) => ({
    subject: `Nueva tarea asignada: ${p.taskTitle}`,
    html: baseLayout(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:900">Tenés una nueva tarea 📋</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6">
        Hola <strong>${p.assigneeName}</strong>, <strong>${p.creatorName}</strong> te asignó la siguiente tarea en RODEO.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:28px">
        <p style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:800">${p.taskTitle}</p>
        ${p.taskDescription ? `<p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6">${p.taskDescription}</p>` : ''}
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${p.dueDate ? `<span style="background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#059669">📅 Vence: ${p.dueDate}</span>` : ''}
          <span style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#374151">
            ${p.priority === 'ALTA' ? '🔴' : p.priority === 'MEDIA' ? '🟡' : '🟢'} Prioridad ${p.priority}
          </span>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${p.dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
          Ver mis tareas →
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center">
        Accedé desde tu panel: <a href="${p.dashboardUrl}" style="color:#16a34a">${p.dashboardUrl}</a>
      </p>
    `),
  }),

  paddock_move_reminder: (p: {
    ownerName: string
    orgName: string
    moves: Array<{
      paddockName: string
      herdName: string
      headCount: number
      exitDate: string      // formatted date string e.g. "28 de abril de 2026"
      recoveryDays: number
    }>
    dashboardUrl: string
  }) => ({
    subject: `🐄 Recordatorio: ${p.moves.length > 1 ? `${p.moves.length} movimientos` : 'movimiento de animales'} mañana — ${p.orgName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:900">Mañana hay movimientos programados 🐄</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
        Hola <strong>${p.ownerName}</strong>, te recordamos que mañana tenés
        <strong>${p.moves.length} movimiento${p.moves.length !== 1 ? 's' : ''}</strong>
        de animales planificado${p.moves.length !== 1 ? 's' : ''} en <strong>${p.orgName}</strong>.
      </p>
      <div style="margin-bottom:28px">
        ${p.moves.map(m => `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="width:10px;height:10px;border-radius:50%;background:#16a34a;flex-shrink:0"></div>
              <p style="margin:0;color:#111827;font-size:16px;font-weight:800">${m.paddockName}</p>
            </div>
            <p style="margin:0 0 8px;color:#4b5563;font-size:13px;font-weight:500">
              Rodeo: <strong>${m.herdName}</strong> · <strong>${m.headCount}</strong> cab.
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span style="background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;color:#059669">
                📅 Salida: ${m.exitDate}
              </span>
              <span style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;color:#374151">
                ⏱ Descanso siguiente: ${m.recoveryDays}d
              </span>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:28px">
        <p style="margin:0;color:#92400e;font-size:13px;font-weight:600">
          💡 Recordá preparar el potrero receptor, controlar el agua y el alambrado antes del movimiento.
        </p>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${p.dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
          Ver planificador →
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center">
        Accedé desde: <a href="${p.dashboardUrl}" style="color:#16a34a">${p.dashboardUrl}</a>
      </p>
    `),
  }),

  climate_alert: (p: {
    ownerName: string
    paddockName: string
    alertLevel: 'warning' | 'critical'
    alertMessage: string
    adjustedDays: number
    originalDays: number
    deltaFromPlan: number
    dashboardUrl: string
  }) => ({
    subject: p.alertLevel === 'critical'
      ? `🚨 ALERTA CRÍTICA: Sobrepastoreo en ${p.paddockName}`
      : `⚠️ Ajuste Clima: ${p.paddockName} — estadía reducida ${Math.abs(p.deltaFromPlan)}d`,
    html: baseLayout(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:900">
        ${p.alertLevel === 'critical' ? '🚨 Alerta Crítica de Pastoreo' : '⚠️ Ajuste Climático'}
      </h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6">
        Hola <strong>${p.ownerName}</strong>, el motor de <strong>Ajuste Clima</strong> detectó
        un cambio en la estadía del potrero <strong>${p.paddockName}</strong>.
      </p>
      <div style="background:${p.alertLevel === 'critical' ? '#fef2f2' : '#fffbeb'};border:1px solid ${p.alertLevel === 'critical' ? '#fecaca' : '#fde68a'};border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 12px;color:#111827;font-size:15px;font-weight:800">${p.alertMessage}</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">
          <div style="text-align:center">
            <p style="margin:0;font-size:28px;font-weight:900;color:${p.alertLevel === 'critical' ? '#dc2626' : '#d97706'}">${p.adjustedDays}d</p>
            <p style="margin:2px 0 0;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af">Días ajustados</p>
          </div>
          <div style="text-align:center">
            <p style="margin:0;font-size:28px;font-weight:900;color:#6b7280">${p.originalDays}d</p>
            <p style="margin:2px 0 0;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af">Planificado</p>
          </div>
          <div style="text-align:center">
            <p style="margin:0;font-size:28px;font-weight:900;color:${p.deltaFromPlan < 0 ? '#dc2626' : '#16a34a'}">${p.deltaFromPlan >= 0 ? '+' : ''}${p.deltaFromPlan}d</p>
            <p style="margin:2px 0 0;font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af">Diferencia</p>
          </div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${p.dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
          Ver potrero en RODEO →
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center">
        Generado automáticamente por el motor de Ajuste Clima · RODEO AgTech
      </p>
    `),
  }),

} satisfies Record<string, (params: any) => { subject: string; html: string }>

// ── Public API ─────────────────────────────────────────────────────────────

export type EmailType = keyof typeof templates

export async function sendEmail<T extends EmailType>(
  type: T,
  to: string,
  params: Parameters<typeof templates[T]>[0]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[sendEmail] RESEND_API_KEY not set — skipping email')
    return
  }

  const resend = new Resend(apiKey)
  const tpl = (templates[type] as (p: any) => { subject: string; html: string })(params)

  const { error } = await resend.emails.send({
    to,
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    subject: tpl.subject,
    html: tpl.html,
  })

  if (error) throw new Error(`[sendEmail] Resend error: ${error.message}`)
  console.log(`[sendEmail] ✓ sent type=${type} to=${to}`)
}
