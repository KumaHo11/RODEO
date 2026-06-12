'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export default function TermsGate({ children }: { children: React.ReactNode }) {
  const [needsAcceptance, setNeedsAcceptance] = useState(false)
  const [activeTerms, setActiveTerms] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setLoading(false)
        return
      }
      
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/terms/check', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.needsAcceptance) {
          setActiveTerms(data.activeTerms)
          setNeedsAcceptance(true)
        }
      } catch (err) {
        console.error('Error checking terms', err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleAccept = async () => {
    if (!termsAccepted) return
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
        setNeedsAcceptance(false)
      }
    } catch (err) {
      console.error('Error accepting terms', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <>
      {children}
      
      <AnimatePresence>
        {needsAcceptance && activeTerms && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative"
            >
              <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col gap-1 bg-white z-10 shrink-0">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Actualización de Términos y Condiciones</h2>
                <p className="text-sm text-gray-500 font-medium">
                  Hemos actualizado nuestros Términos y Condiciones. Debes aceptarlos para continuar usando Rodeo.
                </p>
              </div>
              
              <div 
                className="p-6 md:p-10 overflow-y-auto flex-1 prose prose-gray max-w-none text-gray-600 prose-headings:font-semibold prose-headings:text-gray-800 prose-p:leading-relaxed prose-a:text-green-600 focus:outline-none"
                dangerouslySetInnerHTML={{ __html: activeTerms.content }}
              />

              <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 z-10">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    id="gate-terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-5 h-5 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500 cursor-pointer shadow-sm"
                  />
                  <label htmlFor="gate-terms" className="text-sm text-gray-700 font-medium cursor-pointer select-none">
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
        )}
      </AnimatePresence>
    </>
  )
}
