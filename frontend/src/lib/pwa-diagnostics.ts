/**
 * lib/pwa-diagnostics.ts
 * Diagnóstico de carga inicial para PWA — especialmente Safari standalone (iOS).
 *
 * Captura:
 *  - Errores de recursos (scripts, CSS) que impiden el render
 *  - Errores no manejados y promesas rechazadas
 *  - Estado de red, cookies, y tokens al arrancar
 *
 * Persiste logs en IndexedDB (store 'meta' con key 'pwa_boot_log')
 * y muestra un overlay de recuperación si detecta falla crítica.
 */

// ── Detección de modo standalone ──────────────────────────────────────────────

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) && /safari/.test(ua) && !/crios|fxios|opios|edgios/.test(ua)
}

// ── Boot log ──────────────────────────────────────────────────────────────────

interface BootLog {
  timestamp: string
  standalone: boolean
  iosSafari: boolean
  online: boolean
  hasCookie: boolean
  hasIdbToken: boolean
  errors: string[]
  recovered: boolean
}

let _bootLog: BootLog | null = null
const _errors: string[] = []

function getBootLog(): BootLog {
  if (!_bootLog) {
    _bootLog = {
      timestamp: new Date().toISOString(),
      standalone: isStandalone(),
      iosSafari: isIOSSafari(),
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      hasCookie: typeof document !== 'undefined' ? document.cookie.includes('__session') : false,
      hasIdbToken: false, // updated async
      errors: _errors,
      recovered: false,
    }
  }
  return _bootLog
}

// ── Persistir log ─────────────────────────────────────────────────────────────

async function persistBootLog(): Promise<void> {
  try {
    const { metaSet } = await import('./offline/db')
    const log = getBootLog()
    await metaSet('pwa_boot_log', log)

    // Keep last 10 boot logs for debugging
    const { metaGet } = await import('./offline/db')
    const history: BootLog[] = (await metaGet('pwa_boot_history')) ?? []
    history.unshift(log)
    if (history.length > 10) history.length = 10
    await metaSet('pwa_boot_history', history)
  } catch {
    // IndexedDB no disponible — no es crítico
  }
}

// ── Cookie restoration from IndexedDB ─────────────────────────────────────────

/**
 * Si la cookie __session no existe pero hay un token cacheado en IndexedDB
 * que aún no expiró, lo restaura como cookie.
 * Esto es CRÍTICO para iOS standalone donde las cookies pueden perderse.
 */
async function restoreCookieFromCache(): Promise<boolean> {
  try {
    const hasCookie = document.cookie.includes('__session')
    if (hasCookie) return true // Cookie exists, nothing to do

    const { getCachedAuthToken } = await import('./offline/auth-cache')
    const cachedToken = await getCachedAuthToken()
    if (!cachedToken) return false

    // Restore the cookie
    const isHttps = window.location.protocol === 'https:'
    document.cookie = `__session=${cachedToken}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`
    
    console.log('[pwa-diag] Cookie __session restaurada desde IndexedDB cache')
    getBootLog().recovered = true
    return true
  } catch (err) {
    console.warn('[pwa-diag] Error restaurando cookie:', err)
    return false
  }
}

// ── Error overlay ─────────────────────────────────────────────────────────────

function showRecoveryOverlay(errorMsg: string): void {
  // Only show in standalone mode — in browser, errors show naturally
  if (!isStandalone()) return

  // Don't show if the page already has meaningful content
  if (document.querySelector('#__next')?.children?.length ?? 0 > 0) return

  const existing = document.getElementById('pwa-recovery-overlay')
  if (existing) return

  const overlay = document.createElement('div')
  overlay.id = 'pwa-recovery-overlay'
  overlay.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      background:#f9fafb;font-family:-apple-system,system-ui,sans-serif;
    ">
      <div style="text-align:center;padding:2rem;max-width:320px;">
        <div style="
          width:64px;height:64px;border-radius:16px;
          background:#fef3c7;border:1px solid #fde68a;
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 1.5rem;font-size:28px;
        ">⚠️</div>
        <h2 style="font-size:18px;font-weight:900;color:#111827;margin:0 0 8px;">
          Error de carga
        </h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 24px;line-height:1.5;">
          La app no pudo cargar correctamente. Esto puede deberse a una conexión inestable.
        </p>
        <button onclick="location.reload()" style="
          width:100%;padding:12px;border:none;border-radius:12px;
          background:#16a34a;color:white;font-weight:700;font-size:14px;
          cursor:pointer;margin-bottom:8px;
        ">Reintentar</button>
        <button onclick="
          document.cookie='__session=;path=/;max-age=0';
          location.href='/login';
        " style="
          width:100%;padding:12px;border:none;border-radius:12px;
          background:#f3f4f6;color:#6b7280;font-weight:700;font-size:14px;
          cursor:pointer;
        ">Ir al login</button>
        <p style="font-size:10px;color:#d1d5db;margin-top:16px;">
          ${errorMsg.slice(0, 100)}
        </p>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Inicializa el sistema de diagnóstico PWA.
 * Debe llamarse lo antes posible en el ciclo de vida de la app.
 */
export async function initPWADiagnostics(): Promise<void> {
  if (typeof window === 'undefined') return

  const log = getBootLog()

  // 1. Capturar errores de carga de recursos
  window.addEventListener('error', (event) => {
    // Script/CSS load error (not runtime JS error)
    if (event.target && (event.target as any).tagName) {
      const tag = (event.target as any).tagName
      const src = (event.target as any).src || (event.target as any).href || 'unknown'
      const msg = `[resource] ${tag} failed: ${src}`
      _errors.push(msg)
      console.warn('[pwa-diag]', msg)

      // Si es un script crítico de Next.js, mostrar overlay
      if (src.includes('/_next/') && tag === 'SCRIPT') {
        showRecoveryOverlay(msg)
      }
    }
  }, true) // capture phase to catch resource errors

  // 2. Capturar promesas rechazadas no manejadas
  window.addEventListener('unhandledrejection', (event) => {
    const msg = `[unhandled] ${event.reason?.message || event.reason || 'unknown'}`
    _errors.push(msg)
    console.warn('[pwa-diag]', msg)
  })

  // 3. En modo standalone: restaurar cookie y verificar token
  if (log.standalone) {
    console.log('[pwa-diag] Standalone mode detected — running boot checks')

    // Intentar restaurar cookie desde IndexedDB
    const restored = await restoreCookieFromCache()
    log.hasCookie = document.cookie.includes('__session')
    log.recovered = restored

    // Verificar si hay token en IndexedDB
    try {
      const { getCachedAuthToken } = await import('./offline/auth-cache')
      log.hasIdbToken = !!(await getCachedAuthToken())
    } catch {
      log.hasIdbToken = false
    }

    // Safety net: si después de 8 segundos la página sigue en blanco, mostrar overlay
    setTimeout(() => {
      const nextRoot = document.getElementById('__next')
      const hasContent = nextRoot && nextRoot.innerHTML.length > 100
      if (!hasContent && log.errors.length > 0) {
        showRecoveryOverlay(log.errors[0] || 'Timeout de carga')
      }
    }, 8000)
  }

  // 4. Persistir log
  await persistBootLog()
}

/**
 * Elimina el overlay de recuperación (llamar cuando la app carga exitosamente).
 */
export function dismissRecoveryOverlay(): void {
  const overlay = document.getElementById('pwa-recovery-overlay')
  if (overlay) overlay.remove()
}
