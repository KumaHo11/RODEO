'use client'

import { useAuth } from '@/components/AuthProvider'
import { auth } from '@/lib/firebase/client'
import {
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import RodeoLogo from '@/components/RodeoLogo'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Eye, EyeOff, Mail, CheckCircle } from 'lucide-react'

function LoginContent() {
  const { user, isLoading, profile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [errorMSG, setError]            = useState<string | null>(null)
  const [loading, setLoading]           = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [resendSuccess, setResendSuccess]   = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const justVerified = searchParams.get('verified') === '1'
  const isDisabled   = searchParams.get('disabled') === '1'

  useEffect(() => {
    if (searchParams.get('error') === 'not_found') {
      setError('El usuario o contraseña son incorrectos.')
    }
    // Solo redirigir si ya hay sesión activa al montar (refresh de página, sesión persistida)
    // No interferir si el loading manual del handleLogin está activo
    if (!isLoading && !loading && user && user.emailVerified) {
      redirectAfterAuth()
    }
  }, [user, isLoading, loading, profile, searchParams])

  async function redirectAfterAuth() {
    try {
      if (user) {
        // Force token refresh to ensure middleware sees a valid token, preventing redirect loops
        const token = await user.getIdToken(true)
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax${isHttps ? '; Secure' : ''}`
      }
    } catch { /* ignore */ }

    if (nextPath && nextPath !== '/login') {
      router.replace(nextPath)
      return
    }
    // Redirect to onboarding if not completed (step 4 = complete)
    if (profile && (profile.onboarding_step ?? 0) < 4) {
      router.replace('/onboarding')
    } else {
      router.replace('/dashboard')
    }
  }

  if (isLoading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white flex-col gap-4">
      <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      <p className="text-gray-400 font-bold tracking-widest text-[10px]">Verificando sesión...</p>
    </div>
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setUnverifiedEmail(null)
    setLoading(true)

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const firebaseUser = credential.user

      // Force refresh the token to get the absolute latest claims from the server
      // (the cached credential.user may still show emailVerified=false even after clicking the link)
      const tokenResult = await firebaseUser.getIdTokenResult(true)
      const isVerified = tokenResult.claims.email_verified === true || firebaseUser.emailVerified

      // Block login if email is not verified
      if (!isVerified) {
        import('@/lib/analytics').then(({ event }) => {
          event({ action: 'login_error', category: 'auth', error_type: 'unverified_email' })
        })
        await auth.signOut() // sign them back out
        setUnverifiedEmail(email)
        setLoading(false)
        return
      }

      const refreshedUser = auth.currentUser!

      import('@/lib/analytics').then(({ event }) => {
        event({ action: 'login', category: 'auth', method: 'email' })
      })

      // Set cookie BEFORE redirecting to prevent middleware bounce
      try {
        const token = await refreshedUser.getIdToken(true)
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax${isHttps ? '; Secure' : ''}`
      } catch (e) {
        console.error('Error setting session cookie:', e)
      }

      // Email verificado: obtener el perfil activamente antes de redirigir
      // para eliminar la race condition con AuthProvider (profile puede ser null aún)
      if (nextPath && nextPath !== '/login') {
        router.replace(nextPath)
      } else {
        let targetProfile = profile
        if (!targetProfile) {
          try {
            const freshToken = await refreshedUser.getIdToken(true)
            const res = await fetch('/api/auth/profile', {
              headers: { Authorization: `Bearer ${freshToken}` },
            })
            if (res.ok) {
              const data = await res.json()
              targetProfile = data.profile
            }
          } catch { /* fallback to dashboard */ }
        }
        if (targetProfile && (targetProfile.onboarding_step ?? 0) < 4) {
          router.replace('/onboarding')
        } else {
          router.replace('/dashboard')
        }
      }
    } catch (err: any) {
      setLoading(false)
      const code = err.code
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Correo electrónico o contraseña incorrectos.')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Por favor, intenta más tarde.')
      } else if (code === 'auth/user-disabled') {
        setError('Tu cuenta fue suspendida. Contactá a soporte en soporte@rodeoagtech.com')
      } else if (code === 'auth/network-request-failed') {
        setError('No hay conexión a internet. Para iniciar sesión por primera vez o si cerraste sesión, necesitás conectividad. Si ya habías iniciado sesión, verificá tu conexión e intentá recargar la página.')
      } else {
        setError('Ocurrió un error al iniciar sesión. Intenta de nuevo.')
      }
    }
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return
    setResendingEmail(true)
    setError(null)
    try {
      const credential = await signInWithEmailAndPassword(auth, unverifiedEmail, password)
      const token = await credential.user.getIdToken()
      
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      await auth.signOut()
      
      if (!res.ok) {
        throw new Error('Error desde el servidor')
      }
      
      setResendSuccess(true)
    } catch (err: any) {
      console.error(err)
      setError('Ocurrió un error al reenviar el correo. Intenta de nuevo.')
    } finally {
      setResendingEmail(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] bg-white">
      {/* Visual Side */}
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

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="mb-12">
            <h1 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Inicia sesión</h1>
            <p className="text-gray-500 text-sm">Ingresa a tu cuenta para gestionar tu campo.</p>
          </div>

          {/* Account disabled banner */}
          {isDisabled && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
            >
              <span className="text-red-500 text-base leading-none mt-0.5">⛔</span>
              <div>
                <p className="text-red-900 text-xs font-black mb-0.5">Cuenta suspendida</p>
                <p className="text-red-700 text-xs">Tu acceso fue deshabilitado por un administrador. Contactá a soporte en <strong>josorio@rodeoagtech.com</strong></p>
              </div>
            </motion.div>
          )}

          {/* Email verified success banner */}
          {justVerified && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3"
            >
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-green-900 text-xs font-black mb-0.5">¡Email verificado!</p>
                <p className="text-green-700 text-xs">Tu cuenta está activa. Ingresá con tus credenciales para continuar.</p>
              </div>
            </motion.div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Correo electrónico</label>
              <input
                type="email" required
                placeholder="tu@email.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300 font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Contraseña</label>
                <Link href="/forgot-password" className="text-[10px] font-bold text-green-600 hover:text-green-700">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300 font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Email not verified warning */}
            {unverifiedEmail && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3"
              >
                <Mail className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-800 text-xs font-black mb-0.5">Email no verificado</p>
                  <p className="text-amber-700 text-xs mb-3">
                    Revisá tu casilla <strong>{unverifiedEmail}</strong> y hacé clic en el link de verificación antes de ingresar.
                  </p>
                  {resendSuccess ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-100/50 px-2.5 py-1.5 rounded-lg border border-green-200 w-fit">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>¡Correo enviado!</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingEmail}
                      className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {resendingEmail && <Loader2 className="w-3 h-3 animate-spin" />}
                      Reenviar correo
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Login error */}
            {errorMSG && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold p-4 rounded-xl flex items-center gap-2"
              >
                <span>⚠️ {errorMSG}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando...</>
                : <>Ingresar <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-gray-500 font-medium">
            ¿No tienes una cuenta?{' '}
            <Link href="/register" className="text-green-600 hover:text-green-700 font-bold">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-white flex-col gap-4">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        <p className="text-gray-400 font-bold tracking-widest text-[10px]">Cargando...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
