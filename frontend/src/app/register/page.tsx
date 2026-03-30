'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'

interface Province {
  id: string
  nombre: string
}

interface HerdInput {
  species: string
  head_count: number
}

const SIZE_CATEGORIES = [
  "Menos de 50 hectáreas",
  "50 a 100 hectáreas",
  "100 a 200 hectáreas",
  "200 a 500 hectáreas",
  "500 a 2000 hectáreas",
  "Más de 2000 hectáreas"
]

const ANIMAL_TYPES = [
  "vacas",
  "vaquillonas",
  "ovejas",
  "cabras",
  "caballos"
]

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  
  // Step 1 State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Step 2 State
  const [orgName, setOrgName] = useState('')
  const [sizeCategory, setSizeCategory] = useState(SIZE_CATEGORIES[0])
  const [region, setRegion] = useState('')
  const [provinces, setProvinces] = useState<Province[]>([])
  const [herds, setHerds] = useState<HerdInput[]>([{ species: 'vacas', head_count: 0 }])

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    fetch('https://apis.datos.gob.ar/georef/api/provincias')
      .then(res => res.json())
      .then(data => {
        if (data && data.provincias) {
          const sorted = data.provincias.sort((a: Province, b: Province) => a.nombre.localeCompare(b.nombre))
          setProvinces(sorted)
          if (sorted.length > 0) setRegion(sorted[0].nombre)
        }
      })
      .catch(err => console.error("Error fetching provinces", err))
  }, [])

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.")
      return
    }
    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    
    setStep(2)
  }

  const handleAddHerd = () => {
    setHerds([...herds, { species: ANIMAL_TYPES[0], head_count: 0 }])
  }

  const handleRemoveHerd = (index: number) => {
    const newHerds = [...herds]
    newHerds.splice(index, 1)
    setHerds(newHerds)
  }

  const handleHerdChange = (index: number, field: keyof HerdInput, value: string | number) => {
    const newHerds = [...herds]
    newHerds[index] = { ...newHerds[index], [field]: value }
    setHerds(newHerds)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          org_name: orgName,
          size_category: sizeCategory,
          region_id: region,
          herds: herds
        }
      }
    })

    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    if (data.user?.identities?.length === 0) {
      setErrorMsg("Este correo ya está registrado. Por favor, inicia sesión.")
      return
    }

    setSuccessMsg("¡Cuenta y campo creados con éxito! Revisa tu bandeja de entrada o spam para confirmar tu correo y activar la cuenta.")
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-10 text-center text-3xl font-bold leading-9 tracking-tight text-gray-900">
          Crea tu cuenta
        </h2>
        
        {/* Progress Stepper */}
        {!successMsg && (
          <div className="mt-6">
            <div className="overflow-hidden rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-green-600" style={{ width: step === 1 ? '50%' : '100%' }} />
            </div>
            <div className="mt-2 hidden sm:flex justify-between text-xs font-medium text-gray-500">
              <div className={step === 1 ? 'text-green-600' : ''}>1. Datos del usuario</div>
              <div className={step === 2 ? 'text-green-600' : ''}>2. Datos del campo</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-6 shadow sm:rounded-lg sm:px-10">
        {successMsg ? (
          <div>
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 text-sm">
              {successMsg}
            </div>
            <div className="mt-6 text-center">
              <Link href="/" className="font-semibold text-green-600 hover:text-green-500">
                Volver a Iniciar Sesión
              </Link>
            </div>
          </div>
        ) : step === 1 ? (
          <form className="space-y-6" onSubmit={handleNextStep}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Nombre *</label>
                <div className="mt-2">
                  <input type="text" required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Apellido *</label>
                <div className="mt-2">
                  <input type="text" required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Correo electrónico *</label>
              <div className="mt-2">
                <input type="email" required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Teléfono (opcional)</label>
              <div className="mt-2">
                <input type="tel" className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Contraseña *</label>
              <div className="mt-2">
                <input type="password" required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Confirmar Contraseña *</label>
              <div className="mt-2">
                <input type="password" required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>

            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

            <div>
              <button type="submit" className="flex w-full justify-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                Siguiente paso
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleRegister}>
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Nombre del campo *</label>
              <div className="mt-2">
                <input type="text" required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" placeholder="Ej. Estancia La Paz" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Tamaño del campo *</label>
              <div className="mt-2">
                <select required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={sizeCategory} onChange={(e) => setSizeCategory(e.target.value)}>
                  {SIZE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Región (Provincia) *</label>
              <div className="mt-2">
                <select required className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={region} onChange={(e) => setRegion(e.target.value)}>
                  {provinces.length === 0 ? <option value="Cargando...">Cargando provincias...</option> : provinces.map(prov => <option key={prov.id} value={prov.nombre}>{prov.nombre}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium leading-6 text-gray-900">Animales *</label>
                <button type="button" onClick={handleAddHerd} className="text-sm text-green-600 flex items-center hover:text-green-500 font-semibold">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar animal
                </button>
              </div>
              
              <div className="space-y-3">
                {herds.map((herd, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select className="block w-1/2 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6 capitalize" value={herd.species} onChange={(e) => handleHerdChange(index, 'species', e.target.value)}>
                      {ANIMAL_TYPES.map(type => <option key={type} value={type} className="capitalize">{type}</option>)}
                    </select>
                    <input type="number" min="0" required placeholder="Cantidad" className="block w-1/3 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" value={herd.head_count || ''} onChange={(e) => handleHerdChange(index, 'head_count', parseInt(e.target.value) || 0)} />
                    {herds.length > 1 && (
                      <button type="button" onClick={() => handleRemoveHerd(index)} className="p-2 text-red-500 hover:text-red-700 bg-red-50 rounded-md">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex w-1/3 justify-center rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm font-semibold leading-6 text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                Atrás
              </button>
              <button type="submit" disabled={loading} className="flex w-2/3 justify-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50">
                {loading ? 'Finalizando...' : 'Finalizar Registro'}
              </button>
            </div>
          </form>
        )}

        {!successMsg && (
          <p className="mt-10 text-center text-sm text-gray-500">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/" className="font-semibold leading-6 text-green-600 hover:text-green-500">
              Inicia sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
