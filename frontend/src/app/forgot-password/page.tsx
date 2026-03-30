'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import RodeoLogo from '@/components/RodeoLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    // Unhappy path: Account not found / invalid email handled by Supabase gracefully
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    // Happy path: Reset link sent
    setSuccessMsg("If an account exists for this email, a password reset link has been sent. Please check your inbox.")
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="flex flex-col items-center gap-3 mb-6">
        <RodeoLogo variant="light" size="lg" showTagline={false} />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-4 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Recupera tu contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Ingresa tu correo electrónico y te enviaremos un enlace para recuperar tu cuenta.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {successMsg ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 text-sm mt-4 text-center">
            {successMsg}
            <div className="mt-4">
              <Link href="/login" className="font-semibold text-green-600 hover:text-green-500">
                Volver a Iniciar Sesión
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleReset}>
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Correo electrónico</label>
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

            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
              >
                {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-10 text-center text-sm">
          <Link href="/login" className="font-semibold text-green-600 hover:text-green-500">
            &larr; Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
