'use client'

import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

const UPGRADE_ROUTE = '/dashboard/planes'

interface PremiumOverlayProps {
  title: string
  description: string
  requiredPlan: string
  children?: React.ReactNode
}

export function PremiumOverlay({ title, description, requiredPlan, children }: PremiumOverlayProps) {
  const router = useRouter()

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm group">
      {/* Background Content (Blurred) */}
      {children && (
        <div className="absolute inset-0 z-0 opacity-40 blur-[4px] pointer-events-none select-none transition-all duration-500 group-hover:blur-[6px]">
          {children}
        </div>
      )}
      
      {/* Fallback solid background if no children are provided */}
      {!children && (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-50 to-gray-100/50" />
      )}

      {/* Overlay Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px] p-8 text-center bg-white/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.4, duration: 0.8 }}
          className="bg-white p-4 rounded-2xl shadow-xl shadow-green-900/5 border border-green-100 mb-6"
        >
          <Lock className="w-8 h-8 text-green-600" />
        </motion.div>
        
        <h3 className="text-xl font-black tracking-tight text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed mb-6">
          {description}
        </p>

        <button
          onClick={() => router.push(UPGRADE_ROUTE)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95"
        >
          <Sparkles className="w-4 h-4 text-green-400" />
          Ver planes y contratar
          <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
        </button>

        <p className="text-xs text-gray-400 mt-3 font-medium">
          Requiere plan <span className="font-bold text-gray-600">{requiredPlan}</span> o superior
        </p>
      </div>
    </div>
  )
}
