'use client'

/**
 * /terms-accept
 * Página standalone de aceptación de Términos y Condiciones.
 * Aparece después del login si el usuario no ha aceptado la versión activa.
 * Redirige al parámetro ?next= (o /dashboard) tras la aceptación.
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

function TermsAcceptContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'

  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [activeTerms, setActiveTerms]   = useState<any>(null)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/terms/check', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()

        if (!data.needsAcceptance) {
          // No hay términos pendientes — ir directo al destino
          router.replace(nextPath)
          return
        }

        setActiveTerms(data.activeTerms)
      } catch (err) {
        console.error('Error fetching terms:', err)
        setError('No se pudieron cargar los términos. Intentá de nuevo.')
      } finally {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleAccept = async () => {
    if (!termsAccepted || !activeTerms) return
    setSaving(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ versionId: activeTerms.id })
      })

      if (res.ok) {
        try {
          localStorage.setItem('rodeo_accepted_terms_version', activeTerms.id)
          sessionStorage.setItem('rodeo_terms_checked_ok', activeTerms.id)
        } catch {}
        router.replace(nextPath)
      } else {
        setError('Error al guardar la aceptación. Intentá de nuevo.')
      }
    } catch (err) {
      console.error('Error accepting terms:', err)
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          <p className="text-gray-400 font-bold tracking-widest text-[10px]">Cargando términos...</p>
        </div>
      </div>
    )
  }

  if (!activeTerms) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white p-4 sm:p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative"
      >
        <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col gap-1 bg-white z-10 shrink-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Actualización de Términos y Condiciones</h1>
          <p className="text-sm text-gray-500 font-medium">
            Hemos actualizado nuestros Términos y Condiciones. Debés aceptarlos para continuar usando Rodeo.
          </p>
        </div>

        <div
          className="p-6 md:p-10 overflow-y-auto flex-1 prose prose-gray max-w-none text-gray-600 prose-headings:font-semibold prose-headings:text-gray-800 prose-p:leading-relaxed prose-a:text-green-600 focus:outline-none"
          dangerouslySetInnerHTML={{ __html: activeTerms.content }}
        />

        {error && (
          <div className="px-6 py-2 bg-red-50 text-red-600 text-xs font-bold text-center border-t border-red-100">
            {error}
          </div>
        )}

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 z-10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="checkbox"
              id="accept-terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-5 h-5 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500 cursor-pointer shadow-sm"
            />
            <label htmlFor="accept-terms" className="text-sm text-gray-700 font-medium cursor-pointer select-none">
              He leído y acepto los nuevos Términos.
            </label>
          </div>
          <button
            onClick={handleAccept}
            disabled={!termsAccepted || saving}
            className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Aceptar y Continuar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function TermsAcceptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    }>
      <TermsAcceptContent />
    </Suspense>
  )
}
