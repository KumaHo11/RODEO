'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import RodeoLogo from '@/components/RodeoLogo'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'

function LoginContent() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMSG, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  // If already authenticated, redirect away immediately
  useEffect(() => {
    if (!isLoading && user) {
      redirectAfterAuth()
    }
  }, [user, isLoading])

  const redirectAfterAuth = async () => {
    // If middleware sent a ?next param, go there
    if (nextPath && nextPath !== '/login') {
      router.replace(nextPath)
      return
    }
    // Otherwise check onboarding step
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_step')
      .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
      .single()

    if (profile && (profile.onboarding_step || 0) < 3) {
      router.replace('/onboarding')
    } else {
      router.replace('/dashboard')
    }
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white flex-col gap-4">
      <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      <p className="text-gray-400 font-bold tracking-widest text-[10px]">Verificando sesión...</p>
    </div>
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      if (error.message.includes('Email not confirmed')) {
        setError('Por favor verifica tu correo electrónico antes de ingresar.')
      } else {
        setError('Correo electrónico o contraseña incorrectos.')
      }
      return
    }

    // Login OK — redirect based on onboarding step
    await redirectAfterAuth()
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Visual Side */}
      <div className="hidden lg:flex w-1/2 bg-green-700 items-center justify-center relative overflow-hidden p-24 shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)]">
        <div className="relative z-10 text-center flex flex-col items-center gap-4">
          <RodeoLogo variant="dark" size="xl" showTagline={true} />
          <p className="text-green-200 font-medium mt-3 text-sm tracking-wide">Gestión ganadera inteligente</p>
        </div>
        {/* Background texture */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="mb-12">
            <h2 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Inicia sesión</h2>
            <p className="text-gray-500 text-sm">Ingresa a tu cuenta para gestionar tu campo.</p>
          </div>

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
              <input
                type="password" required
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300 font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

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
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white flex-col gap-4">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        <p className="text-gray-400 font-bold tracking-widest text-[10px]">Cargando...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
