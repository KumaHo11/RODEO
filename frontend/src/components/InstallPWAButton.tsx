'use client'

/**
 * InstallPWAButton — Botón de instalación PWA con detección de dispositivo mejorada.
 *
 * Variantes:
 *  - `full`:    Botón grande con texto "Descargar para teléfono/escritorio" (sidebar)
 *  - `compact`: Ícono solo con tooltip (header)
 *
 * Mejoras v2:
 *  - Detección de iPad (reporta como desktop en Safari 13+)
 *  - Detección de Samsung Internet y Firefox Android
 *  - Instrucciones diferentes por SO + Browser
 *  - Banner flotante en primera visita (dismissable con cooldown 7 días)
 *  - Persistencia en localStorage (no sessionStorage)
 *
 * Se oculta automáticamente si:
 *  - La app ya está instalada (standalone mode)
 *  - El browser no soporta instalación y no es iOS/Firefox
 */

import { useEffect, useState, useCallback } from 'react'
import { Download, Smartphone, Monitor, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type DeviceType = 'mobile' | 'desktop' | 'ios' | 'ipad'
type BrowserType = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other'

function detectDevice(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop'

  const ua = navigator.userAgent.toLowerCase()

  // iPad detection — iPadOS 13+ reports as Mac
  const isIPad = /ipad/.test(ua) || (/macintosh/.test(ua) && 'ontouchend' in document)
  if (isIPad) return 'ipad'

  // iOS detection (Safari — no soporta beforeinstallprompt)
  const isIOS = /iphone|ipod/.test(ua) && !(window as any).MSStream
  if (isIOS) return 'ios'

  // Android y otros móviles
  const isMobile = /android|webos|blackberry|opera mini|mobile/.test(ua) ||
    ('ontouchstart' in window && window.innerWidth < 768)
  if (isMobile) return 'mobile'

  return 'desktop'
}

function detectBrowser(): BrowserType {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()

  if (/samsungbrowser/.test(ua)) return 'samsung'
  if (/edg/.test(ua)) return 'edge'
  if (/crios/.test(ua) || (/chrome/.test(ua) && !/edg/.test(ua))) return 'chrome'
  if (/fxios/.test(ua) || /firefox/.test(ua)) return 'firefox'
  if (/safari/.test(ua) && !/chrome/.test(ua)) return 'safari'
  return 'other'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

// Cooldown de 7 días para no molestar
const DISMISS_KEY = 'rodeo_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    const elapsed = Date.now() - parseInt(ts, 10)
    return elapsed < DISMISS_COOLDOWN_MS
  } catch { return false }
}

function markDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function InstallPWAButton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop')
  const [browserType, setBrowserType] = useState<BrowserType>('other')
  const [installed, setInstalled] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (isStandalone()) {
      setInstalled(true)
      return
    }

    setDeviceType(detectDevice())
    setBrowserType(detectBrowser())

    // Check cooldown dismiss
    if (isDismissed()) setDismissed(true)

    // Listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for successful install
    const installHandler = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', installHandler)

    // Listen for display-mode changes
    const mq = window.matchMedia('(display-mode: standalone)')
    const mqHandler = (e: MediaQueryListEvent) => {
      if (e.matches) setInstalled(true)
    }
    mq.addEventListener('change', mqHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installHandler)
      mq.removeEventListener('change', mqHandler)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    // iOS/iPad/Firefox: show guide with instructions
    if (deviceType === 'ios' || deviceType === 'ipad' || (browserType === 'firefox' && deviceType === 'mobile')) {
      setShowGuide(true)
      return
    }

    if (!deferredPrompt) {
      // No prompt available — show guide
      setShowGuide(true)
      return
    }

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setInstalled(true)
      }
      setDeferredPrompt(null)
    } catch (err) {
      console.warn('[InstallPWA] prompt error:', err)
    }
  }, [deferredPrompt, deviceType, browserType])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    markDismissed()
  }, [])

  // Don't show if already installed or dismissed
  if (installed || dismissed) return null

  // Don't show if no prompt and not a case where we show guide
  const showsGuide = deviceType === 'ios' || deviceType === 'ipad' ||
    browserType === 'firefox' || browserType === 'safari'
  if (!deferredPrompt && !showsGuide) return null

  const label = deviceType === 'mobile' || deviceType === 'ios'
    ? 'Descargar para teléfono'
    : deviceType === 'ipad'
      ? 'Descargar para tablet'
      : 'Descargar para escritorio'

  const DeviceIcon = deviceType === 'mobile' || deviceType === 'ios' || deviceType === 'ipad' ? Smartphone : Monitor

  // ── Compact variant (header icon) ────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstall}
          title={label}
          id="pwa-install-compact"
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-green-50 hover:text-green-600 transition-all group"
        >
          <Download className="w-5 h-5" />
          {/* Pulse indicator */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </button>

        {showGuide && <InstallGuideModal device={deviceType} browser={browserType} onClose={() => setShowGuide(false)} />}
      </>
    )
  }

  // ── Full variant (sidebar) ───────────────────────────────────────────────
  return (
    <>
      <div className="relative group">
        <button
          onClick={handleInstall}
          id="pwa-install-full"
          className="group flex items-center gap-x-3 rounded-xl p-2.5 text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 w-full transition-all border border-green-100"
        >
          <div className="relative shrink-0">
            <DeviceIcon className="h-5 w-5 text-green-600" />
            <Download className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 text-green-700" />
          </div>
          <span className="flex-1 text-left truncate">{label}</span>
        </button>
        <button
          onClick={handleDismiss}
          className="absolute -top-1 -right-1 w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Ocultar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {showGuide && <InstallGuideModal device={deviceType} browser={browserType} onClose={() => setShowGuide(false)} />}
    </>
  )
}

// ── Install Guide Modal ─────────────────────────────────────────────────────

function InstallGuideModal({ device, browser, onClose }: {
  device: DeviceType
  browser: BrowserType
  onClose: () => void
}) {
  const steps = getInstallSteps(device, browser)
  const title = getGuideTitle(device, browser)
  const subtitle = getGuideSubtitle(device, browser)

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm mx-auto p-6 shadow-2xl animate-in slide-in-from-bottom-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Smartphone className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-lg font-black text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <Step key={i} number={i + 1} icon={step.icon}>
              {step.text}
            </Step>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}

// ── Install steps by device + browser ────────────────────────────────────────

interface InstallStep {
  icon: React.ReactNode
  text: React.ReactNode
}

function getGuideTitle(device: DeviceType, browser: BrowserType): string {
  if (device === 'ios' || device === 'ipad') {
    if (browser === 'chrome') return 'Abrí en Safari'
    return 'Instalar RODEO'
  }
  if (browser === 'firefox') return 'Instalar RODEO'
  if (browser === 'safari' && device === 'desktop') return 'Navegador no compatible'
  return 'Instalar RODEO'
}

function getGuideSubtitle(device: DeviceType, browser: BrowserType): string {
  if (device === 'ios' && browser === 'chrome') {
    return 'Chrome en iOS no permite instalar apps. Abrí RODEO en Safari para instalarla.'
  }
  if (device === 'ios' || device === 'ipad') {
    return `Seguí estos pasos para instalar la app en tu ${device === 'ipad' ? 'iPad' : 'iPhone'}`
  }
  if (browser === 'firefox' && device === 'mobile') {
    return 'Seguí estos pasos para instalar la app desde Firefox'
  }
  if (browser === 'firefox' && device === 'desktop') {
    return 'Firefox de escritorio no soporta instalación de apps web. Usá Chrome o Edge.'
  }
  if (browser === 'safari' && device === 'desktop') {
    return 'Safari de escritorio no soporta instalación de apps web. Usá Chrome o Edge.'
  }
  return 'Seguí estos pasos para instalar la app'
}

function getInstallSteps(device: DeviceType, browser: BrowserType): InstallStep[] {
  // iOS Chrome — redirect to Safari
  if ((device === 'ios' || device === 'ipad') && browser === 'chrome') {
    return [
      { icon: <span className="text-lg">🌐</span>, text: <span>Abrí <strong>Safari</strong> en tu dispositivo</span> },
      { icon: <span className="text-lg">🔗</span>, text: <span>Navegá a <strong>rodeo.app</strong></span> },
      { icon: <span className="text-lg">📤</span>, text: <span>Tocá el botón <strong>Compartir</strong> (ícono con flecha hacia arriba)</span> },
      { icon: <span className="text-lg">➕</span>, text: <span>Seleccioná <strong>&quot;Agregar a pantalla de inicio&quot;</strong></span> },
    ]
  }

  // iOS/iPad Safari
  if (device === 'ios' || device === 'ipad') {
    return [
      { icon: <span className="text-lg">📤</span>, text: <span>Tocá el botón <strong>Compartir</strong> en la barra de Safari</span> },
      { icon: <span className="text-lg">➕</span>, text: <span>Seleccioná <strong>&quot;Agregar a pantalla de inicio&quot;</strong></span> },
      { icon: <span className="text-lg">✅</span>, text: <span>Tocá <strong>&quot;Agregar&quot;</strong> para confirmar</span> },
    ]
  }

  // Firefox mobile
  if (browser === 'firefox' && device === 'mobile') {
    return [
      { icon: <span className="text-lg">⋮</span>, text: <span>Tocá los <strong>tres puntos</strong> (menú) en la esquina</span> },
      { icon: <span className="text-lg">📥</span>, text: <span>Seleccioná <strong>&quot;Instalar&quot;</strong> o <strong>&quot;Agregar a pantalla de inicio&quot;</strong></span> },
      { icon: <span className="text-lg">✅</span>, text: <span>Confirmá la instalación</span> },
    ]
  }

  // Firefox/Safari desktop — no support
  if ((browser === 'firefox' || browser === 'safari') && device === 'desktop') {
    return [
      { icon: <span className="text-lg">💻</span>, text: <span>Abrí <strong>rodeo.app</strong> en Google Chrome o Microsoft Edge</span> },
      { icon: <span className="text-lg">📥</span>, text: <span>Hacé click en el ícono de <strong>instalación</strong> en la barra de direcciones</span> },
      { icon: <span className="text-lg">✅</span>, text: <span>Confirmá la instalación</span> },
    ]
  }

  // Samsung Internet
  if (browser === 'samsung') {
    return [
      { icon: <span className="text-lg">≡</span>, text: <span>Tocá el ícono del <strong>menú</strong> (tres líneas)</span> },
      { icon: <span className="text-lg">➕</span>, text: <span>Seleccioná <strong>&quot;Agregar página a&quot;</strong> → <strong>&quot;Pantalla de inicio&quot;</strong></span> },
      { icon: <span className="text-lg">✅</span>, text: <span>Confirmá la instalación</span> },
    ]
  }

  // Generic fallback
  return [
    { icon: <span className="text-lg">📥</span>, text: <span>Buscá el ícono de <strong>instalación</strong> en tu navegador</span> },
    { icon: <span className="text-lg">✅</span>, text: <span>Seguí las instrucciones para instalar</span> },
  ]
}

function Step({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Paso {number}</p>
        <p className="text-xs text-gray-700 font-medium mt-0.5">{children}</p>
      </div>
    </div>
  )
}

export default InstallPWAButton
