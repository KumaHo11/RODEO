'use client'

/**
 * SuccessModal — "Dashboard Activo" modal shown after completing onboarding.
 * Replaces the old Step4Confirm static screen.
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowRight, Map, Users, Satellite, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  isOpen: boolean
  fieldName: string
  totalHa: number
  totalAnimals: number
  totalEV: number
  paddocksCount: number
  isRedirecting?: boolean
}

export default function SuccessModal({
  isOpen,
  fieldName,
  totalHa,
  totalAnimals,
  totalEV,
  paddocksCount,
  isRedirecting,
}: Props) {
  const router = useRouter()
  const [dots, setDots] = useState('.')

  // Animated dots while redirecting
  useEffect(() => {
    if (!isRedirecting) return
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 400)
    return () => clearInterval(t)
  }, [isRedirecting])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Green header with celebration */}
            <div className="bg-gradient-to-br from-green-600 to-green-700 px-8 py-8 text-white relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute top-4 -right-2 w-12 h-12 bg-white/10 rounded-full" />
              <div className="absolute -bottom-4 left-8 w-16 h-16 bg-white/5 rounded-full" />

              {/* Check icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
                className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="w-7 h-7 text-white" />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <p className="text-green-200 text-[11px] font-black tracking-widest uppercase mb-1">¡Campo configurado!</p>
                <h2 className="text-2xl font-black text-white leading-tight">{fieldName}</h2>
                <p className="text-green-200 text-sm font-normal mt-1">Tu campo está listo en RODEO</p>
              </motion.div>
            </div>

            {/* Stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="px-6 py-5"
            >
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                  <Map className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-blue-700 leading-none">
                    {totalHa > 0 ? totalHa.toFixed(0) : '—'}
                  </p>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-0.5">hectáreas</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
                  <Satellite className="w-4 h-4 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-green-700 leading-none">{paddocksCount}</p>
                  <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mt-0.5">potreros</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                  <Users className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-amber-700 leading-none">{totalAnimals}</p>
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-0.5">animales</p>
                </div>
              </div>

              {/* NDVI note */}
              {paddocksCount > 0 && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl mb-4">
                  <Satellite className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-emerald-700">Análisis satelital listo</p>
                    <p className="text-[10px] text-emerald-500 font-normal mt-0.5">
                      El índice NDVI se cargará automáticamente en tu Dashboard.
                    </p>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </div>
              )}

              {/* CTA */}
              <motion.button
                onClick={() => router.replace('/dashboard')}
                disabled={isRedirecting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 disabled:opacity-70"
              >
                {isRedirecting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Accediendo al Dashboard{dots}</>
                  : <>Ver mi Dashboard <ArrowRight className="w-4 h-4" /></>}
              </motion.button>

              <p className="text-center text-[10px] text-gray-400 mt-3">Todos los datos quedan guardados de forma segura</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
