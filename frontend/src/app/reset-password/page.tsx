'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Verify the user is actually in a recovery session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If no session, they probably didn't use the link correctly
      if (!session) {
        setErrorMsg("Session expired or invalid link. Please request a new password reset.")
      }
    })
  }, [supabase.auth])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    // Unhappy paths
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    // Happy path
    setSuccessMsg("Password updated successfully! Redirecting...")
    setTimeout(() => {
      router.push('/dashboard')
    }, 2000)
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Actualiza tu contraseña
        </h2>
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
                disabled={loading || errorMsg === "Session expired or invalid link. Please request a new password reset."}
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
