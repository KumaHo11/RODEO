'use client'

import { useState, useEffect } from 'react'
import RodeoLogo from '@/components/RodeoLogo'
import Link from 'next/link'
import { Globe, ArrowRight, CheckCircle, Mail, Loader2, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { auth } from '@/lib/firebase/client'
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'

interface Country {
  name: { common: string }
  cca2: string
}

export default function RegisterPage() {
  const [firstName, setFirstName]           = useState('')
  const [lastName, setLastName]             = useState('')
  const [email, setEmail]                   = useState('')
  const [phone, setPhone]                   = useState('')
  const [country, setCountry]               = useState('')
  const [countryCode, setCountryCode]       = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [countries, setCountries]           = useState<Country[]>([])
  const [loading, setLoading]               = useState(false)
  const [errorMsg, setErrorMsg]             = useState<string | null>(null)
  const [successMsg, setSuccessMsg]         = useState<string | null>(null)
  const [showPassword, setShowPassword]     = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2')
      .then(res => res.json())
      .then(data => {
        const sorted = data.sort((a: Country, b: Country) =>
          a.name.common.localeCompare(b.name.common)
        )
        setCountries(sorted)
        const arg = sorted.find((c: Country) => c.cca2 === 'AR')
        if (arg) {
          setCountry(arg.name.common)
          setCountryCode(arg.cca2)
        }
      })
      .catch(err => console.error('Error fetching countries', err))
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
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

    setLoading(true)

    try {
      // 1. Crear usuario en Firebase Auth directamente (sin Admin SDK)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Actualizar displayName en Firebase
      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`.trim()
      })

      // 2. Obtener el ID Token para enviarlo a la API
      const idToken = await firebaseUser.getIdToken()

      // 3. Crear perfil en Cloud SQL via API route
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          firstName, lastName,
          phone, country, countryCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Si falla la creación del perfil, eliminar el usuario de Firebase para no dejar inconsistencias
        await firebaseUser.delete().catch(() => {})
        setErrorMsg(data.error || 'Error al configurar la cuenta.')
        return
      }

      // 4. Sign out immediately — user must verify email before logging in
      //    This prevents AuthProvider from auto-redirecting to dashboard.
      await signOut(auth)

      setSuccessMsg(
        `¡Cuenta creada! Te enviamos un correo de verificación a ${email}. Revisá tu bandeja (y la carpeta spam) y hacé clic en el link para activar tu cuenta.`
      )
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Este correo ya está registrado. Por favor, inicia sesión.')
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setErrorMsg('Error de conexión. Intenta nuevamente.')
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
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="mb-12">
            <h2 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Crea tu cuenta</h2>
            <p className="text-gray-500 text-sm">Comienza la transformación regenerativa de tu campo.</p>
          </div>

          {successMsg ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-green-900 text-sm font-black mb-1">¡Revisá tu casilla de correo!</p>
                  <p className="text-green-700 text-xs leading-relaxed">{successMsg}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <span className="text-amber-500 text-sm">⚠️</span>
                <p className="text-amber-700 text-xs font-medium">
                  Debés verificar tu email antes de poder iniciar sesión. Si no lo encontrás, revisá la carpeta de spam.
                </p>
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all"
              >
                Ir al inicio de sesión <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ) : (
            <form className="space-y-5" onSubmit={handleRegister}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest">Nombre</label>
                  <input
                    type="text" required
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600 transition-all"
                    value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest">Apellido</label>
                  <input
                    type="text" required
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600 transition-all"
                    value={lastName} onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400">Correo electrónico</label>
                <input
                  type="email" required
                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600 transition-all"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">País</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600 appearance-none"
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value)
                        const code = countries.find(c => c.name.common === e.target.value)?.cca2 || ''
                        setCountryCode(code)
                      }}
                    >
                      {countries.length === 0
                        ? <option>Cargando...</option>
                        : countries.map(c => <option key={c.cca2} value={c.name.common}>{c.name.common}</option>)
                      }
                    </select>
                    <Globe className="absolute right-3 top-2.5 w-4 h-4 text-gray-300 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400">Teléfono</label>
                  <input
                    type="tel"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600 transition-all"
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-1 focus:ring-green-600 transition-all"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'} required
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-1 focus:ring-green-600 transition-all"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <p className="text-red-600 text-[11px] font-medium bg-red-50 p-3 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-green-600/20 hover:bg-green-700 hover:scale-[1.01] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...</>
                  : 'Crear mi cuenta'
                }
              </button>
            </form>
          )}

          {!successMsg && (
            <p className="mt-8 text-center text-xs text-gray-400 font-medium">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="text-green-600 font-bold hover:underline">
                Inicia sesión
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
