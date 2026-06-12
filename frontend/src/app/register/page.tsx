'use client'

import { useState, useEffect, useCallback } from 'react'
import RodeoLogo from '@/components/RodeoLogo'
import Link from 'next/link'
import Image from 'next/image'
import { Globe, ArrowRight, Mail, Loader2, Eye, EyeOff, Phone, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '@/lib/firebase/client'
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'

interface Country {
  name: { common: string }
  cca2: string
  idd?: { root?: string; suffixes?: string[] }
}

/** Map country code → WhatsApp dial prefix */
function getDialCode(cca2: string, idd?: Country['idd']): string {
  const KNOWN: Record<string, string> = {
    AR: '+54', UY: '+598', PY: '+595', BO: '+591', CL: '+56',
    PE: '+51', EC: '+593', CO: '+57', VE: '+58', BR: '+55',
    US: '+1',  CA: '+1',  MX: '+52', GT: '+502', HN: '+504',
    SV: '+503', NI: '+505', CR: '+506', PA: '+507', CU: '+53',
    DO: '+1',  PR: '+1',  ES: '+34', FR: '+33', DE: '+49',
    IT: '+39', PT: '+351', GB: '+44', AU: '+61', NZ: '+64', ZA: '+27',
  }
  if (KNOWN[cca2]) return KNOWN[cca2]
  if (idd?.root) return `${idd.root}${idd.suffixes?.[0] ?? ''}`
  return ''
}

// ─── Field error helper ────────────────────────────────────────────────────────
function FieldError({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 mt-1"
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          {msg}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ─── Base input class builder ──────────────────────────────────────────────────
function inputCls(hasError: boolean, extra = '') {
  return [
    'w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm outline-none',
    'transition-all duration-150 placeholder:text-gray-300 font-medium',
    hasError
      ? 'border-red-300 ring-1 ring-red-300 bg-red-50/30 focus:border-red-400 focus:ring-red-400'
      : 'border-gray-100 focus:border-green-500 focus:ring-1 focus:ring-green-500',
    extra,
  ].join(' ')
}

// ─── Validation rules ──────────────────────────────────────────────────────────
function validateEmail(v: string) {
  if (!v.trim()) return 'El correo es obligatorio'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Ingresá un correo válido'
  return null
}
function validateName(v: string, label: string) {
  if (!v.trim()) return `El ${label} es obligatorio`
  if (v.trim().length < 2) return `Mínimo 2 caracteres`
  return null
}
function validatePhone(v: string) {
  if (!v.trim()) return 'El teléfono es obligatorio'
  if (v.replace(/\D/g, '').length < 6) return 'Ingresá al menos 6 dígitos'
  return null
}
function validatePassword(v: string) {
  if (!v) return 'La contraseña es obligatoria'
  if (v.length < 6) return 'Mínimo 6 caracteres'
  return null
}
function validateConfirm(v: string, pass: string) {
  if (!v) return 'Confirmá tu contraseña'
  if (v !== pass) return 'Las contraseñas no coinciden'
  return null
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [firstName,        setFirstName]        = useState('')
  const [lastName,         setLastName]         = useState('')
  const [email,            setEmail]            = useState('')
  const [phoneLocal,       setPhoneLocal]       = useState('')
  const [country,          setCountry]          = useState('')
  const [countryCode,      setCountryCode]      = useState('AR')
  const [dialCode,         setDialCode]         = useState('+54')
  const [password,         setPassword]         = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [countries,        setCountries]        = useState<Country[]>([])
  const [loading,          setLoading]          = useState(false)
  const [successMsg,       setSuccessMsg]       = useState<string | null>(null)
  const [serverError,      setServerError]      = useState<string | null>(null)
  const [showPassword,     setShowPassword]     = useState(false)
  const [showConfirm,      setShowConfirm]      = useState(false)
  const [termsAccepted,    setTermsAccepted]    = useState(false)
  const [activeTerms,      setActiveTerms]      = useState<any>(null)
  const [showTermsModal,   setShowTermsModal]   = useState(false)

  // Per-field error state — only shown after the field is touched/blurred
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const setError = (field: string, msg: string | null) =>
    setErrors(prev => ({ ...prev, [field]: msg }))
  const touch = (field: string) =>
    setTouched(prev => ({ ...prev, [field]: true }))
  const fieldError = (field: string) => touched[field] ? errors[field] ?? null : null

  // ─── Country list ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2,idd')
      .then(async r => {
        if (!r.ok) throw new Error('Network response was not ok')
        return r.json()
      })
      .then((data: Country[]) => {
        const sorted = data.sort((a, b) => a.name.common.localeCompare(b.name.common))
        setCountries(sorted)
        const arg = sorted.find(c => c.cca2 === 'AR')
        if (arg) { setCountry(arg.name.common); setCountryCode('AR'); setDialCode(getDialCode('AR', arg.idd)) }
      })
      .catch((err) => {
        console.warn('Countries API error, falling back to Argentina:', err)
        const fallbackAR = { name: { common: 'Argentina' }, cca2: 'AR', idd: { root: '+5', suffixes: ['4'] } }
        setCountries([fallbackAR as unknown as Country])
        setCountry('Argentina')
        setCountryCode('AR')
        setDialCode('+54')
      })

    // Fetch active Terms & Conditions
    fetch('/api/terms/active')
      .then(async r => {
        if (!r.ok) throw new Error('Failed to fetch terms')
        return r.json()
      })
      .then(res => {
        if (res.success) {
          setActiveTerms(res.data)
        }
      })
      .catch(err => {
        console.warn('Could not fetch active terms:', err)
      })
  }, [])

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    setCountry(name)
    const found = countries.find(c => c.name.common === name)
    if (found) { setCountryCode(found.cca2); setDialCode(getDialCode(found.cca2, found.idd)) }
  }

  const fullPhone = dialCode && phoneLocal
    ? `${dialCode} ${phoneLocal.replace(/^0+/, '')}`
    : phoneLocal

  // ─── Blur handlers (validate on leave) ───────────────────────────────────
  const onBlur = useCallback((field: string, value: string) => {
    touch(field)
    switch (field) {
      case 'firstName':      setError(field, validateName(value, 'nombre')); break
      case 'lastName':       setError(field, validateName(value, 'apellido')); break
      case 'email':          setError(field, validateEmail(value)); break
      case 'phone':          setError(field, validatePhone(value)); break
      case 'password':       setError(field, validatePassword(value)); break
      case 'confirmPassword': setError(field, validateConfirm(value, password)); break
    }
  }, [password])

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    // Mark all fields touched and validate
    const allTouched = ['firstName','lastName','email','phone','password','confirmPassword']
    setTouched(Object.fromEntries(allTouched.map(f => [f, true])))
    const newErrors = {
      firstName:       validateName(firstName, 'nombre'),
      lastName:        validateName(lastName, 'apellido'),
      email:           validateEmail(email),
      phone:           validatePhone(phoneLocal),
      password:        validatePassword(password),
      confirmPassword: validateConfirm(confirmPassword, password),
    }
    setErrors(newErrors)
    if (Object.values(newErrors).some(Boolean)) return

    if (!termsAccepted) {
      setServerError('Debes aceptar los Términos y Condiciones para continuar.')
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user
      await updateProfile(firebaseUser, { displayName: `${firstName} ${lastName}`.trim() })
      const idToken = await firebaseUser.getIdToken()

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idToken, firstName, lastName, phone: fullPhone, country, countryCode,
          termsVersionId: activeTerms?.id
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        await firebaseUser.delete().catch(() => {})
        setServerError(data.error || 'Error al configurar la cuenta.')
        return
      }

      import('@/lib/analytics').then(({ event }) => {
        event({ action: 'sign_up', category: 'auth', method: 'email' })
      })

      await signOut(auth)
      setSuccessMsg(
        `¡Cuenta creada! Te enviamos un correo de verificación a ${email}. Revisá tu bandeja (y spam) y hacé clic en el botón para activar tu cuenta.`
      )
    } catch (err: any) {
      import('@/lib/analytics').then(({ event }) => {
        event({ action: 'sign_up_error', category: 'auth', error_type: err.code || 'unknown' })
      })
      if (err.code === 'auth/email-already-in-use') {
        setServerError('Este correo ya está registrado. Por favor, inicia sesión.')
      } else if (err.code === 'auth/weak-password') {
        setServerError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setServerError('Error de conexión. Intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-white font-sans text-gray-900">

      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-700 items-center justify-center overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] relative">
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

          <div className="mb-10">
            <h1 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Crea tu cuenta</h1>
            <p className="text-gray-500 text-sm">Comenzá la transformación regenerativa de tu campo.</p>
          </div>

          {successMsg ? (
            /* ── Success state ── */
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
            /* ── Form — noValidate disables all browser native tooltips ── */
            <form className="space-y-4" onSubmit={handleRegister} noValidate autoComplete="off">

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nombre</label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Juan"
                    className={inputCls(!!fieldError('firstName'))}
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); if (touched.firstName) setError('firstName', validateName(e.target.value, 'nombre')) }}
                    onBlur={() => onBlur('firstName', firstName)}
                  />
                  <FieldError msg={fieldError('firstName')} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Apellido</label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder="García"
                    className={inputCls(!!fieldError('lastName'))}
                    value={lastName}
                    onChange={e => { setLastName(e.target.value); if (touched.lastName) setError('lastName', validateName(e.target.value, 'apellido')) }}
                    onBlur={() => onBlur('lastName', lastName)}
                  />
                  <FieldError msg={fieldError('lastName')} />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Correo electrónico</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  className={inputCls(!!fieldError('email'))}
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (touched.email) setError('email', validateEmail(e.target.value)) }}
                  onBlur={() => onBlur('email', email)}
                />
                <FieldError msg={fieldError('email')} />
              </div>

              {/* Country */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">País</label>
                <div className="relative">
                  <select
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 appearance-none font-medium transition-all"
                    value={country}
                    onChange={handleCountryChange}
                  >
                    {countries.length === 0
                      ? <option>Cargando...</option>
                      : countries.map(c => <option key={c.cca2} value={c.name.common}>{c.name.common}</option>)
                    }
                  </select>
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                </div>
              </div>

              {/* Phone — WhatsApp with dial code */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Teléfono WhatsApp
                </label>
                <div className="flex gap-2">
                  {/* Dial badge */}
                  <div className={`flex items-center justify-center px-3 py-2.5 border rounded-lg text-sm font-black shrink-0 min-w-[64px] transition-all
                    ${fieldError('phone') ? 'border-red-300 bg-red-50/30 text-red-600' : 'border-gray-200 bg-gray-100 text-gray-700'}`}>
                    {dialCode || '—'}
                  </div>
                  <div className="flex-1">
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      placeholder="11 2345 6789"
                      className={inputCls(!!fieldError('phone'))}
                      value={phoneLocal}
                      onChange={e => {
                        const v = e.target.value.replace(/[^\d\s\-]/g, '')
                        setPhoneLocal(v)
                        if (touched.phone) setError('phone', validatePhone(v))
                      }}
                      onBlur={() => onBlur('phone', phoneLocal)}
                    />
                  </div>
                </div>
                <FieldError msg={fieldError('phone')} />
                {!fieldError('phone') && dialCode && phoneLocal && (
                  <p className="text-[10px] text-gray-400 font-medium">
                    WhatsApp: <span className="font-black text-green-600">{fullPhone}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className={inputCls(!!fieldError('password'), 'pr-10')}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (touched.password) setError('password', validatePassword(e.target.value)) }}
                    onBlur={() => onBlur('password', password)}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError msg={fieldError('password')} />
              </div>

              {/* Confirm password */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repetí tu contraseña"
                    className={inputCls(!!fieldError('confirmPassword'), 'pr-10')}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); if (touched.confirmPassword) setError('confirmPassword', validateConfirm(e.target.value, password)) }}
                    onBlur={() => onBlur('confirmPassword', confirmPassword)}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError msg={fieldError('confirmPassword')} />
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-2 py-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-gray-500 leading-tight">
                  Acepto los{' '}
                  <button 
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-green-600 font-bold hover:underline"
                  >
                    Términos y Condiciones y la Política de Privacidad
                  </button>{' '}
                  de Rodeo.
                </label>
              </div>

              {/* Server-level error */}
              <AnimatePresence>
                {serverError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-red-700 text-xs font-bold">{serverError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-green-600/20 hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
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

      {/* Terms Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <h2 className="text-lg font-black text-gray-900">Términos y Condiciones</h2>
                <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  Cerrar
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 prose prose-sm text-gray-600"
                   dangerouslySetInnerHTML={{ __html: activeTerms?.content || 'Cargando términos y condiciones...' }}
              />
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 z-10">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setTermsAccepted(true)
                    setShowTermsModal(false)
                  }}
                  className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors shadow-sm"
                >
                  Aceptar y cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
