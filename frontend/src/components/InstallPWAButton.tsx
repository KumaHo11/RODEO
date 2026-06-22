'use client'

/**
 * InstallPWAButton — Botón de instalación PWA con detección de dispositivo.
 *
 * Variantes:
 *  - `full`:    Botón grande con texto "Descargar para teléfono/escritorio" (sidebar)
 *  - `compact`: Ícono solo con tooltip (header)
 *  - `ios`:     Instrucciones para iOS Safari (no soporta beforeinstallprompt)
 *
 * Se oculta automáticamente si:
 *  - La app ya está instalada (standalone mode)
 *  - El browser no soporta instalación y no es iOS Safari
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Download, Smartphone, Monitor, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type DeviceType = 'mobile' | 'desktop' | 'ios'

function detectDevice(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop'

  const ua = navigator.userAgent.toLowerCase()

  // iOS detection (Safari — no soporta beforeinstallprompt)
  const isIOS = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream
  if (isIOS) return 'ios'

  // Android y otros móviles
  const isMobile = /android|webos|blackberry|opera mini|mobile/.test(ua) ||
    ('ontouchstart' in window && window.innerWidth < 768)
  if (isMobile) return 'mobile'

  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function InstallPWAButton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop')
  const [installed, setInstalled] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (isStandalone()) {
      setInstalled(true)
      return
    }

    setDeviceType(detectDevice())

    // Check if user dismissed before (per session)
    const wasDismissed = sessionStorage.getItem('rodeo_install_dismissed')
    if (wasDismissed) setDismissed(true)

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
    if (deviceType === 'ios') {
      setShowIOSGuide(true)
      return
    }

    if (!deferredPrompt) return

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
  }, [deferredPrompt, deviceType])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    sessionStorage.setItem('rodeo_install_dismissed', 'true')
  }, [])

  // Don't show if already installed or dismissed
  if (installed || dismissed) return null

  // Don't show if no prompt available and not iOS
  if (!deferredPrompt && deviceType !== 'ios') return null

  const label = deviceType === 'mobile' || deviceType === 'ios'
    ? 'Descargar para teléfono'
    : 'Descargar para escritorio'

  const DeviceIcon = deviceType === 'mobile' || deviceType === 'ios' ? Smartphone : Monitor

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

        {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
      </>
    )
  }

  // ── Full variant (sidebar) ───────────────────────────────────────────────
  return (
    <>
      <div className="relative">
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

      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
    </>
  )
}

// ── iOS Install Guide Modal ─────────────────────────────────────────────────

function IOSInstallGuide({ onClose }: { onClose: () => void }) {
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
          <h3 className="text-lg font-black text-gray-900">Instalar RODEO</h3>
          <p className="text-xs text-gray-500 mt-1">Seguí estos pasos para instalar la app en tu iPhone</p>
        </div>

        <div className="space-y-4">
          <Step number={1} icon={<Share className="w-5 h-5" />}>
            Tocá el botón <strong>Compartir</strong> en la barra de Safari
          </Step>
          <Step number={2} icon={<span className="text-lg">➕</span>}>
            Seleccioná <strong>&quot;Agregar a pantalla de inicio&quot;</strong>
          </Step>
          <Step number={3} icon={<span className="text-lg">✅</span>}>
            Tocá <strong>&quot;Agregar&quot;</strong> para confirmar
          </Step>
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
