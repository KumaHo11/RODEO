'use client'

import React, { useState } from 'react'
import { useDeforestationGuard } from '@/hooks/useDeforestationGuard'
import { Loader2 } from 'lucide-react'

type Props = {
  paddockId: string
  showLabel?: boolean
  className?: string
}

export default function DeforestationBadge({ paddockId, showLabel = true, className = '' }: Props) {
  const { getStatusForPaddock, checkPaddock } = useDeforestationGuard()
  const statusInfo = getStatusForPaddock(paddockId)
  const [checking, setChecking] = useState(false)

  const handleCheck = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setChecking(true)
    try {
      await checkPaddock(paddockId)
    } catch (err) {
      console.error(err)
    } finally {
      setChecking(false)
    }
  }

  if (checking) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {showLabel && <span>Verificando...</span>}
      </div>
    )
  }

  if (!statusInfo || statusInfo.status === 'PENDING' || statusInfo.status === 'ERROR') {
    return (
      <button 
        onClick={handleCheck}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer ${className}`}
      >
        <span>🔍</span>
        {showLabel && <span>Sin verificar</span>}
      </button>
    )
  }

  if (statusInfo.status === 'CLEAN') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 ${className}`}>
        <span>🌱</span>
        {showLabel && <span>Verificado EUDR</span>}
      </div>
    )
  }

  if (statusInfo.status === 'AT_RISK') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 ${className}`}>
        <span>⚠️</span>
        {showLabel && <span>Verificar zona</span>}
      </div>
    )
  }

  if (statusInfo.status === 'DEFORESTED') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 ${className}`}>
        <span>🚨</span>
        {showLabel && <span>Deforestación detectada</span>}
      </div>
    )
  }

  return null
}
