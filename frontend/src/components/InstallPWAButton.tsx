'use client'

/**
 * InstallPWAButton — Botón minimalista de instalación PWA.
 *
 * Variantes:
 *  - `full`:    Botón con texto "Instalar Rodeo" (sidebar)
 *  - `compact`: Ícono solo (header)
 *
 * En iOS/iPad muestra una instrucción simple:
 *   "Presiona Compartir ↑ y luego Agregar a pantalla de inicio"
 *
 * Se oculta automáticamente si la app ya está instalada (standalone mode).
 */

import { useEffect, useState, useCallback } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    /iphone|ipad|ipod/.test(ua) ||
    (/macintosh/.test(ua) && 'ontouchend' in document)
  ) && !(window as any).MSStream
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent.toLowerCase())
}

// Cooldown de 7 días para no molestar
const DISMISS_KEY = 'rodeo_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return (Date.now() - parseInt(ts, 10)) < DISMISS_COOLDOWN_MS
  } catch { return false }
}

function markDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function InstallPWAButton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const [isAndroidDevice, setIsAndroidDevice] = useState(false)

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return }
    if (isDismissed()) setDismissed(true)
    setIsIOSDevice(isIOS())
    setIsAndroidDevice(isAndroid())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installHandler = () => { setInstalled(true); setDeferredPrompt(null) }
    window.addEventListener('appinstalled', installHandler)

    const mq = window.matchMedia('(display-mode: standalone)')
    const mqHandler = (e: MediaQueryListEvent) => { if (e.matches) setInstalled(true) }
    mq.addEventListener('change', mqHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installHandler)
      mq.removeEventListener('change', mqHandler)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    // iOS/iPad: mostrar guía simple
    if (isIOSDevice) {
      setShowGuide(true)
      return
    }

    // Chrome/Edge: usar prompt nativo
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setInstalled(true)
        setDeferredPrompt(null)
      } catch (err) {
        console.warn('[InstallPWA] prompt error:', err)
      }
      return
    }

    // Fallback/Android sin prompt: mostrar guía
    setShowGuide(true)
  }, [deferredPrompt, isIOSDevice])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    markDismissed()
  }, [])

  // No mostrar si ya instalada o dismiss activo
  if (installed || dismissed) return null

  // Mostrar si tenemos prompt, si es iOS, O si es Android (para mostrar la guía si falla el prompt)
  if (!deferredPrompt && !isIOSDevice && !isAndroidDevice) return null

  // ── Compact variant (header icon) ────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstall}
          title="Instalar Rodeo"
          id="pwa-install-compact"
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-green-50 hover:text-green-600 transition-all"
        >
          <Download className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </button>

        {showGuide && (
          <InstallGuideOverlay
            isIOS={isIOSDevice}
            isAndroid={isAndroidDevice}
            onClose={() => setShowGuide(false)}
          />
        )}
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
          <Download className="h-5 w-5 text-green-600 shrink-0" />
          <span className="flex-1 text-left truncate">Instalar Rodeo</span>
        </button>
        <button
          onClick={handleDismiss}
          className="absolute -top-1 -right-1 w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Ocultar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {showGuide && (
        <InstallGuideOverlay
          isIOS={isIOSDevice}
          isAndroid={isAndroidDevice}
          onClose={() => setShowGuide(false)}
        />
      )}
    </>
  )
}

// ── Install Guide Overlay (minimalista) ────────────────────────────────────

import { MoreVertical } from 'lucide-react'

function InstallGuideOverlay({ isIOS, isAndroid, onClose }: { isIOS: boolean; isAndroid: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — mínimo, una sola instrucción */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm mx-auto p-6 shadow-2xl animate-in slide-in-from-bottom-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center">
          {/* Icono de la app */}
          <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
            <span className="text-white text-2xl font-black">R</span>
          </div>

          <h3 className="text-lg font-black text-gray-900 mb-1">Instalar Rodeo</h3>

          {isIOS ? (
            <p className="text-sm text-gray-500 leading-relaxed mt-3">
              Presioná <span className="inline-flex items-center gap-1 font-bold text-gray-800">Compartir <span className="text-blue-500 text-base">↑</span></span>{' '}
              y luego <span className="font-bold text-gray-800">&quot;Agregar a pantalla de inicio&quot;</span>
            </p>
          ) : isAndroid ? (
            <div className="text-sm text-gray-500 leading-relaxed mt-3 flex flex-col gap-3">
              <p>
                Tocá el menú de opciones <span className="inline-flex items-center mx-1 bg-gray-100 rounded px-1"><MoreVertical className="w-4 h-4 text-gray-600" /></span> en la esquina superior de Chrome.
              </p>
              <p>
                Luego seleccioná <span className="font-bold text-gray-800">&quot;Instalar aplicación&quot;</span> o <span className="font-bold text-gray-800">&quot;Agregar a la pantalla principal&quot;</span>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 leading-relaxed mt-3">
              Buscá el ícono de <span className="font-bold text-gray-800">instalación</span> en la barra de tu navegador
              o usá <span className="font-bold text-gray-800">Chrome / Edge</span> para instalar.
            </p>
          )}
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

export default InstallPWAButton
