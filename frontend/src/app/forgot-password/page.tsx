'use client'

import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { sendPasswordResetEmail } from 'firebase/auth'
import Link from 'next/link'
import RodeoLogo from '@/components/RodeoLogo'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [emailSent, setEmailSent]   = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
      })
      setEmailSent(true)
    } catch (err: any) {
      const code = err.code || ''
      if (code === 'auth/user-not-found') {
        // Por seguridad mostramos mensaje de éxito igual
        setEmailSent(true)
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('El correo electrónico no es válido.')
      } else {
        setErrorMsg('Error al enviar el correo. Intentá nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-white font-sans text-gray-900">
      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-700 items-center justify-center p-12 overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] relative">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <RodeoLogo variant="dark" size="xl" showTagline={true} />
          <p className="text-green-200 font-medium text-sm tracking-wide text-center">La plataforma de ganadería de precisión</p>
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24">
        <div className="w-full max-w-sm">

          {emailSent ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-green-900 text-sm font-black mb-1">¡Revisá tu casilla!</p>
                  <p className="text-green-700 text-xs leading-relaxed">
                    Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña. Revisá también la carpeta spam.
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
              >
                Volver al inicio de sesión
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-10">
                <Link href="/login" className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors mb-6">
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
                </Link>
                <h2 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Recuperar contraseña</h2>
                <p className="text-gray-500 text-sm">Ingresá tu correo y te enviaremos un link para restablecer tu contraseña.</p>
              </div>

              <form className="space-y-5" onSubmit={handleReset}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Correo electrónico</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="tu@email.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-1 focus:ring-green-600 outline-none transition-all placeholder:text-gray-300 font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  </div>
                </div>

                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-red-600 text-[11px] font-medium bg-red-50 p-3 rounded-xl border border-red-100"
                  >
                    ⚠️ {errorMsg}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                    : 'Enviar enlace de recuperación'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
