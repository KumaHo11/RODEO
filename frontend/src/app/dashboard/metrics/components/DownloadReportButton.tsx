'use client'

import { useState } from 'react'
import { FileText, Download, Loader2, CheckCircle } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

interface Props {
  orgId: string
  orgName?: string
  className?: string
}

/**
 * Botón para descargar el reporte MRV en PDF.
 * El PDF se genera completamente en el servidor (/api/reports/mrv).
 * Este componente NO importa @react-pdf/renderer — es 100% cliente seguro.
 */
export function DownloadReportButton({ orgId, orgName = 'Estancia', className = '' }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [fileSize, setFileSize] = useState<string | null>(null)

  const handleDownload = async () => {
    try {
      setStatus('loading')
      setFileSize(null)

      const res = await apiFetch(`/api/reports/mrv?org_id=${encodeURIComponent(orgId)}`)

      if (!res.ok) {
        const err = await res.text()
        console.error('[DownloadReportButton] API error:', err)
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
        return
      }

      const blob = await res.blob()
      const mb = (blob.size / 1024 / 1024).toFixed(2)
      setFileSize(`${mb} MB`)

      // Disparar descarga en el browser
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rodeo-mrv-${orgName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setStatus('done')
      // Volver a idle después de 4 segundos
      setTimeout(() => { setStatus('idle'); setFileSize(null) }, 4000)
    } catch (err) {
      console.error('[DownloadReportButton]', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const baseClass =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:cursor-not-allowed'

  if (status === 'loading') {
    return (
      <button disabled className={`${baseClass} bg-green-700/50 text-white/70 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Generando PDF…
      </button>
    )
  }

  if (status === 'done') {
    return (
      <button disabled className={`${baseClass} bg-green-600 text-white ${className}`}>
        <CheckCircle className="w-4 h-4" />
        Descargado {fileSize && <span className="text-green-200 text-xs">({fileSize})</span>}
      </button>
    )
  }

  if (status === 'error') {
    return (
      <button disabled className={`${baseClass} bg-red-700/80 text-white ${className}`}>
        <FileText className="w-4 h-4" />
        Error al generar — intentá de nuevo
      </button>
    )
  }

  return (
    <button
      onClick={handleDownload}
      className={`${baseClass} bg-green-700 hover:bg-green-600 text-white shadow-sm hover:shadow-green-700/30 ${className}`}
    >
      <Download className="w-4 h-4" />
      Descargar Reporte MRV
    </button>
  )
}
