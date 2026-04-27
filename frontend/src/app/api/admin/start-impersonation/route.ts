/**
 * GET /api/admin/start-impersonation
 *
 * Reads the custom token from the request cookie/sessionStorage handoff
 * and redirects to the app with the session established.
 *
 * Flow:
 *  1. Admin clicks "Acceder como usuario" → POST /api/admin/users/[id]/impersonate
 *     → returns { customToken }
 *  2. Frontend stores customToken in sessionStorage key "impersonation_token"
 *  3. Frontend opens this route in a new tab
 *  4. This page serves a small HTML+JS snippet that:
 *     - Reads the token from sessionStorage
 *     - Uses Firebase JS SDK signInWithCustomToken
 *     - Redirects to /app/dashboard on success
 */
import { NextRequest, NextResponse } from 'next/server'

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Accediendo como usuario…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .box { text-align: center; max-width: 360px; padding: 2rem; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e5e7eb;
               border-top-color: #16a34a; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { color: #111827; font-size: 1rem; margin-bottom: 0.5rem; }
    p  { color: #6b7280; font-size: 0.875rem; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner" id="spinner"></div>
    <h2 id="title">Iniciando sesión de soporte…</h2>
    <p id="subtitle">Aguardá un momento.</p>
  </div>

  <!-- Firebase App + Auth from CDN (compat) -->
  <script type="module">
    import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
    import { getAuth, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'

    const token = sessionStorage.getItem('impersonation_token')
    const email = sessionStorage.getItem('impersonation_email')

    if (!token) {
      document.getElementById('spinner').style.display = 'none'
      document.getElementById('title').textContent = 'Token no encontrado'
      document.getElementById('subtitle').innerHTML =
        '<span class="error">Cerrá esta pestaña e intentá de nuevo desde el panel.</span>'
    } else {
      // Clean up storage immediately
      sessionStorage.removeItem('impersonation_token')
      sessionStorage.removeItem('impersonation_email')

      // Firebase config — injected server-side via meta tag
      const cfg = JSON.parse(document.getElementById('fb-config').textContent)

      const app = getApps().length ? getApps()[0] : initializeApp(cfg)
      const auth = getAuth(app)

      signInWithCustomToken(auth, token)
        .then(() => {
          document.getElementById('subtitle').textContent =
            email ? 'Sesión iniciada como ' + email : 'Redirigiendo…'
          // Redirect to app dashboard
          setTimeout(() => { window.location.href = '/app/dashboard' }, 800)
        })
        .catch(err => {
          document.getElementById('spinner').style.display = 'none'
          document.getElementById('title').textContent = 'Error al iniciar sesión'
          document.getElementById('subtitle').innerHTML =
            '<span class="error">' + (err.message || 'Token inválido o expirado') + '</span>'
        })
    }
  </script>
</body>
</html>`

export async function GET(req: NextRequest) {
  // Inject the Firebase project config so the CDN SDK can connect to the right project
  const firebaseConfig = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  // Inject config as a JSON script tag in the HTML
  const html = HTML.replace(
    '<script type="module">',
    `<script type="application/json" id="fb-config">${JSON.stringify(firebaseConfig)}</script>\n  <script type="module">`
  )

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
