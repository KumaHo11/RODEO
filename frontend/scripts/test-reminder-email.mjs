// Script de prueba: envía email de recordatorio de movimiento
// Ejecutar con: node scripts/test-reminder-email.mjs

const RESEND_API_KEY = 're_7VPFTibe_6fS8fbewG9hS9YZqXvcaswd8'
const FROM_EMAIL     = 'onboarding@resend.dev'   // dominio de prueba verificado por Resend
const TO_EMAIL       = 'josorio@rodeoagtech.com'

function baseLayout(body) {
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

// Datos de prueba: simulamos 2 movimientos para mañana
const testData = {
  ownerName: 'Javier',
  orgName: 'La Estancia Los Ombúes',
  moves: [
    {
      paddockName: 'Potrero Norte 3',
      herdName: 'Vacas CUT',
      headCount: 148,
      exitDate: new Date(Date.now() + 86400000).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric',
      }),
      recoveryDays: 45,
    },
    {
      paddockName: 'Lote Sur 7',
      herdName: 'Novillos F1',
      headCount: 92,
      exitDate: new Date(Date.now() + 86400000).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric',
      }),
      recoveryDays: 38,
    },
  ],
  dashboardUrl: 'https://app.rodeoagtech.com/dashboard/grazing',
}

const movesHtml = testData.moves.map(m => `
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
`).join('')

const html = baseLayout(`
  <h2 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:900">Mañana hay movimientos programados 🐄</h2>
  <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
    Hola <strong>${testData.ownerName}</strong>, te recordamos que mañana tenés
    <strong>${testData.moves.length} movimientos</strong>
    de animales planificados en <strong>${testData.orgName}</strong>.
  </p>
  <div style="margin-bottom:28px">
    ${movesHtml}
  </div>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:28px">
    <p style="margin:0;color:#92400e;font-size:13px;font-weight:600">
      💡 Recordá preparar el potrero receptor, controlar el agua y el alambrado antes del movimiento.
    </p>
  </div>
  <div style="text-align:center;margin-bottom:20px">
    <a href="${testData.dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:800;text-decoration:none">
      Ver planificador →
    </a>
  </div>
  <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center">
    Accedé desde: <a href="${testData.dashboardUrl}" style="color:#16a34a">${testData.dashboardUrl}</a>
  </p>
`)

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: `RODEO <${FROM_EMAIL}>`,
    to: TO_EMAIL,
    subject: `🐄 [PRUEBA] Recordatorio: 2 movimientos mañana — ${testData.orgName}`,
    html,
  }),
})

const data = await res.json()
if (res.ok) {
  console.log('✅ Email enviado correctamente:', data.id)
} else {
  console.error('❌ Error al enviar:', data)
}
