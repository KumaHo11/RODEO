'use client'

/**
 * /auth/action — Custom Firebase email action handler.
 *
 * Firebase sends users to this URL when they click the verification link:
 *   https://your-app.com/auth/action?mode=verifyEmail&oobCode=XXX&continueUrl=...
 *
 * We handle `mode=verifyEmail` here with on-brand UI instead of Firebase's
 * generic "Your email has been verified" screen.
 *
 * To use this page, set the "Action URL" in Firebase Console →
 * Authentication → Templates → Edit template → Customize action URL
 * to: https://your-app.com/auth/action
 *
 * NOTE: The API key from the URL (?apiKey=...) is the public Firebase web API key.
 */

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { applyActionCode, getAuth } from 'firebase/auth'
import app from '@/lib/firebase/client'
import RodeoLogo from '@/components/RodeoLogo'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, ArrowRight, Mail } from 'lucide-react'

type Stage = 'loading' | 'success' | 'error' | 'unsupported'

function ActionContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const mode     = searchParams.get('mode')
  const oobCode  = searchParams.get('oobCode')
  const token    = searchParams.get('token')
  const verified = searchParams.get('verified') // ?verified=1 → Firebase ya verificó el email

  const [stage,   setStage]   = useState<Stage>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Caso 1: Firebase verificó el email en su servidor y nos redirigió con ?verified=1
    // (handleCodeInApp: false — el email ya está marcado como verified en Firebase)
    if (verified === '1' && !oobCode && !token) {
      setStage('success')
      return
    }

    // Caso 2: Custom JWT Verification (bypasses Firebase Identity Platform restrictions)
    if (mode === 'verifyCustom') {
      if (!token) {
        setStage('error')
        setMessage('El enlace de verificación es inválido o está incompleto.')
        return
      }

      fetch('/api/auth/verify-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.success) {
          const auth = getAuth(app)
          try {
            const currentUser = auth.currentUser
            if (currentUser) await currentUser.reload()
          } catch { /* ignore */ }
          document.cookie = '__session=; path=/; max-age=0'
          try { localStorage.removeItem('rodeo_cached_profile') } catch { /* ignore */ }
          setStage('success')
        } else {
          throw new Error(data.error || 'Error verificando email')
        }
      })
      .catch((err) => {
        console.error('[auth/action] verify-custom error:', err)
        setMessage('El enlace de verificación es inválido o ya expiró. Por favor, pedí un nuevo enlace.')
        setStage('error')
      })

      return
    }

    // Caso 3: handleCodeInApp:true (legacy) — recibimos oobCode, verificamos acá
    if (mode !== 'verifyEmail') {
      setStage('unsupported')
      setMessage(`Acción desconocida: "${mode}". Intentá desde el enlace original.`)
      return
    }
    if (!oobCode) {
      setStage('error')
      setMessage('El enlace de verificación es inválido o ya fue utilizado. Intentá registrarte nuevamente o pedí otro correo.')
      return
    }

    const auth = getAuth(app)

    applyActionCode(auth, oobCode)
      .then(async () => {
        // CRÍTICO: Recargar el usuario actual para actualizar emailVerified en el SDK.
        // Sin esto, el SDK cliente mantiene emailVerified=false en memoria aunque
        // Firebase ya lo marcó como verified en el servidor.
        try {
          const currentUser = auth.currentUser
          if (currentUser) {
            await currentUser.reload()
          }
        } catch {
          // Si no hay sesión activa en este browser, está bien — el login fresco
          // obtendrá el estado actualizado directamente de Firebase.
        }
        // Limpiar cookies de sesión obsoletas para forzar token fresco en el login
        document.cookie = '__session=; path=/; max-age=0'
        try { localStorage.removeItem('rodeo_cached_profile') } catch { /* ignore */ }
        setStage('success')
      })
      .catch((err: any) => {
        console.error('[auth/action] applyActionCode error:', err)
        if (err.code === 'auth/invalid-action-code' || err.code === 'auth/expired-action-code') {
          setMessage('El enlace de verificación ya fue usado o expiró. Registrate nuevamente para recibir un nuevo correo.')
        } else if (err.code === 'auth/user-disabled') {
          setMessage('Tu cuenta fue deshabilitada. Contactá a soporte en soporte@rodeoagtech.com.')
        } else {
          setMessage('Ocurrió un error al verificar tu cuenta. Intentá nuevamente o contactá a soporte.')
        }
        setStage('error')
      })
  }, [mode, oobCode, token, verified])

  return (
    <main className="flex min-h-screen bg-white">
      {/* Visual side */}
      <div className="hidden lg:flex w-1/2 bg-green-700 items-center justify-center relative overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)]">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative z-10 w-[55%] flex items-center justify-center">
          <Image 
            src="/LogoLoginBlanco.svg" 
            alt="RODEO Ganadería Regenerativa" 
            width={800} 
            height={800} 
            className="w-full h-auto object-contain" 
            priority 
          />
        </div>
      </div>

      {/* Content side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24">
        <div className="w-full max-w-sm">

          {/* Loading */}
          {stage === 'loading' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Verificando tu cuenta</p>
                <h1 className="text-xl font-black text-gray-900">Un momento...</h1>
                <p className="text-gray-500 text-sm mt-1">Estamos procesando tu verificación.</p>
              </div>
            </motion.div>
          )}

          {/* Success */}
          {stage === 'success' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="w-16 h-16 rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </motion.div>
                <p className="text-[10px] font-black text-green-600 tracking-widest uppercase mb-1">¡Éxito!</p>
                <h1 className="text-2xl font-black text-gray-900 mb-2">Email verificado</h1>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Tu cuenta está activa. Podés ingresar a RODEO con tus credenciales.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                <Mail className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-green-700 text-xs leading-relaxed">
                  Tu cuenta de RODEO quedó activa y podés empezar a gestionar tu campo.
                  Te enviamos un correo de bienvenida con más información.
                </p>
              </div>

              <Link
                href="/login?verified=1"
                className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-600/20"
              >
                Ingresar a mi cuenta <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

          {/* Error or unsupported */}
          {(stage === 'error' || stage === 'unsupported') && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-[10px] font-black text-red-500 tracking-widest uppercase mb-1">Error</p>
                <h1 className="text-2xl font-black text-gray-900 mb-2">Enlace inválido</h1>
                <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
              </div>

              <div className="space-y-2">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Registrarme nuevamente
                </Link>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                >
                  Iniciar sesión
                </Link>
              </div>

              <p className="text-center text-xs text-gray-400">
                ¿Necesitás ayuda?{' '}
                <a href="mailto:josorio@rodeoagtech.com" className="text-green-600 font-bold hover:underline">
                  soporte@rodeoagtech.com
                </a>
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white flex-col gap-4">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        <p className="text-gray-400 font-bold tracking-widest text-[10px]">Cargando...</p>
      </div>
    }>
      <ActionContent />
    </Suspense>
  )
}
