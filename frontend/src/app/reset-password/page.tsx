'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { Suspense } from 'react'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const oobCode = searchParams.get('oobCode')

  // Verify the reset code on mount
  useEffect(() => {
    if (!oobCode) {
      setErrorMsg('Enlace inválido o expirado. Por favor solicita un nuevo restablecimiento de contraseña.')
      return
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(email => setEmail(email))
      .catch(() => setErrorMsg('Enlace inválido o expirado. Por favor solicita un nuevo restablecimiento de contraseña.'))
  }, [oobCode])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (!oobCode) return

    setLoading(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setSuccessMsg('¡Contraseña actualizada! Redirigiendo...')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar la contraseña.')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Actualiza tu contraseña
        </h2>
        {email && (
          <p className="mt-2 text-center text-sm text-gray-500">
            Para <strong>{email}</strong>
          </p>
        )}
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {successMsg ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 text-sm text-center">
            {successMsg}
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleUpdate}>
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Nueva Contraseña</label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  disabled={!!errorMsg && !email}
                  className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Confirmar Nueva Contraseña</label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  disabled={!!errorMsg && !email}
                  className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

            <div>
              <button
                type="submit"
                disabled={loading || (!!errorMsg && !email)}
                className="flex w-full justify-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
