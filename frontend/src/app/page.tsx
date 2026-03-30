'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMSG, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">Validating session...</div>

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    setLoading(false)

    if (error) {
      // Unhappy paths: Invalid credentials, Email not confirmed
      if (error.message.includes("Email not confirmed")) {
        setError("Please verify your email address before signing in.")
      } else {
        setError("Invalid email or password.")
      }
    } else {
      // Happy path
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h1 className="text-center text-5xl font-extrabold text-green-700 tracking-tighter mb-2">
          RODEO
        </h1>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Inicia sesión en tu cuenta
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium leading-6 text-gray-900">
              Correo electrónico
            </label>
            <div className="mt-2">
              <input
                type="email"
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium leading-6 text-gray-900">
                Contraseña
              </label>
              <div className="text-sm">
                <Link href="/forgot-password" className="font-semibold text-green-600 hover:text-green-500">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>
            <div className="mt-2">
              <input
                type="password"
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {errorMSG && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-md p-3 text-sm">
              {errorMSG}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="font-semibold leading-6 text-green-600 hover:text-green-500">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}
