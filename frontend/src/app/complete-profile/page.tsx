'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Globe, ArrowRight, Loader2, Phone, AlertCircle, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '@/lib/firebase/client'
import { updateProfile, signOut } from 'firebase/auth'
import { useAuth } from '@/components/AuthProvider'

interface Country {
  name: { common: string }
  cca2: string
  idd?: { root?: string; suffixes?: string[] }
}

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

export default function CompleteProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const router = useRouter()

  const [firstName,        setFirstName]        = useState('')
  const [lastName,         setLastName]         = useState('')
  const [phoneLocal,       setPhoneLocal]       = useState('')
  const [country,          setCountry]          = useState('')
  const [countryCode,      setCountryCode]      = useState('AR')
  const [dialCode,         setDialCode]         = useState('+54')
  const [countries,        setCountries]        = useState<Country[]>([])
  const [loading,          setLoading]          = useState(false)
  const [serverError,      setServerError]      = useState<string | null>(null)
  const [termsAccepted,    setTermsAccepted]    = useState(false)
  const [activeTerms,      setActiveTerms]      = useState<any>(null)
  const [showTermsModal,   setShowTermsModal]   = useState(false)

  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const setError = (field: string, msg: string | null) => setErrors(prev => ({ ...prev, [field]: msg }))
  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }))
  const fieldError = (field: string) => touched[field] ? errors[field] ?? null : null

  // If they already have a profile, send them to dashboard
  useEffect(() => {
    if (profile) {
      router.push('/dashboard')
    }
  }, [profile, router])

  // If not logged into Firebase at all, send them to login
  useEffect(() => {
    if (user === null) {
      router.push('/login')
    } else if (user?.displayName) {
      const parts = user.displayName.split(' ')
      if (!firstName && parts.length > 0) setFirstName(parts[0])
      if (!lastName && parts.length > 1) setLastName(parts.slice(1).join(' '))
    }
  }, [user, router, firstName, lastName])

  useEffect(() => {
    fetch('/api/countries')
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
        const fallbackAR = { name: { common: 'Argentina' }, cca2: 'AR', idd: { root: '+5', suffixes: ['4'] } }
        setCountries([fallbackAR as unknown as Country])
        setCountry('Argentina')
        setCountryCode('AR')
        setDialCode('+54')
      })

    fetch('/api/terms/active')
      .then(r => r.json())
      .then(res => { if (res.success) setActiveTerms(res.data) })
      .catch(() => {})
  }, [])

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    setCountry(name)
    const found = countries.find(c => c.name.common === name)
    if (found) { setCountryCode(found.cca2); setDialCode(getDialCode(found.cca2, found.idd)) }
  }

  const fullPhone = dialCode && phoneLocal ? `${dialCode} ${phoneLocal.replace(/^0+/, '')}` : phoneLocal

  const onBlur = useCallback((field: string, value: string) => {
    touch(field)
    switch (field) {
      case 'firstName': setError(field, validateName(value, 'nombre')); break
      case 'lastName':  setError(field, validateName(value, 'apellido')); break
      case 'phone':     setError(field, validatePhone(value)); break
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setServerError(null)

    const allTouched = ['firstName','lastName','phone']
    setTouched(Object.fromEntries(allTouched.map(f => [f, true])))
    const newErrors = {
      firstName: validateName(firstName, 'nombre'),
      lastName:  validateName(lastName, 'apellido'),
      phone:     validatePhone(phoneLocal),
    }
    setErrors(newErrors)
    if (Object.values(newErrors).some(Boolean)) return

    if (!termsAccepted) {
      setServerError('Debes aceptar los Términos y Condiciones para continuar.')
      return
    }

    setLoading(true)
    try {
      await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() })
      const idToken = await user.getIdToken(true) // Force refresh to ensure valid

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
        setServerError(data.error || 'Error al completar el perfil.')
        return
      }

      // Success! Refresh the AuthProvider profile to let them into the dashboard
      await refreshProfile()
      router.push('/dashboard')

    } catch (err: any) {
      setServerError('Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (profile) return null // Let the useEffect redirect
  if (!user) return null // Let the useEffect redirect

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row bg-white font-sans text-gray-900">
      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-700 items-center justify-center overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)] relative">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative z-10 w-[55%] flex items-center justify-center">
          <Image src="/LogoLoginBlanco.svg" alt="RODEO" width={800} height={800} className="w-full h-auto object-contain" priority />
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 overflow-y-auto">
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Completar Perfil</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Vemos que ya tienes una cuenta de Rodeo ({user.email}). Solo necesitamos unos datos más para configurar tu espacio de trabajo en este ambiente.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nombre</label>
                <input
                  type="text"
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
                  placeholder="García"
                  className={inputCls(!!fieldError('lastName'))}
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); if (touched.lastName) setError('lastName', validateName(e.target.value, 'apellido')) }}
                  onBlur={() => onBlur('lastName', lastName)}
                />
                <FieldError msg={fieldError('lastName')} />
              </div>
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

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1">
                <Phone className="w-3 h-3" /> Teléfono WhatsApp
              </label>
              <div className="flex gap-2">
                <div className={`flex items-center justify-center px-3 py-2.5 border rounded-lg text-sm font-black shrink-0 min-w-[64px] transition-all
                  ${fieldError('phone') ? 'border-red-300 bg-red-50/30 text-red-600' : 'border-gray-200 bg-gray-100 text-gray-700'}`}>
                  {dialCode || '—'}
                </div>
                <div className="flex-1">
                  <input
                    type="tel"
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
                de Rodeo en este ambiente.
              </label>
            </div>

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

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-green-600/20 hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Configurando...</> : 'Ingresar a Rodeo'}
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => { signOut(auth); router.push('/login') }}
              className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 mt-4"
            >
              Cerrar sesión
            </button>
          </form>

        </div>
      </div>

      {/* Terms Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6 md:p-8 backdrop-blur-sm" onClick={() => setShowTermsModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Términos y Condiciones</h2>
                <button onClick={() => setShowTermsModal(false)} className="text-gray-500 font-semibold hover:text-gray-900 transition-colors">Cerrar</button>
              </div>
              <div className="p-6 md:p-10 overflow-y-auto flex-1 prose prose-gray max-w-none text-gray-600"
                   dangerouslySetInnerHTML={{ __html: activeTerms?.content || 'Cargando...' }} />
              <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 z-10">
                <button onClick={() => setShowTermsModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-200 transition-colors">Cancelar</button>
                <button onClick={() => { setTermsAccepted(true); setShowTermsModal(false) }} className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors">Aceptar y cerrar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
