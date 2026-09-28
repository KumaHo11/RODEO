'use client'

/**
 * app/dashboard/herds/page.tsx — Index de Rodeos.
 *
 * Comportamiento:
 *  - Con rodeos en IDB/API: redirige al primero automáticamente (no muestra empty state)
 *  - Sin rodeos (lista = 0): muestra solo texto centrado, sin iconografía
 *  - Si el HerdsContext ya tiene el herd seleccionado, usa ese slug primero
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { dbGetAll } from '@/lib/offline/db'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from '@/components/AuthProvider'
import type { HerdData } from '@/components/HerdModal'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default function HerdsIndexPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (!user) return

    async function redirectToFirst() {
      try {
        // 1. IDB inmediata — respuesta sin latencia
        const localHerds = await dbGetAll('herds') as HerdData[]
        if (localHerds.length > 0) {
          router.replace(`/dashboard/herds/${toSlug(localHerds[0].name)}/datos`)
          return
        }

        // 2. Fallback API (primera vez o IDB vacío)
        const res = await apiFetch('/api/herds')
        if (res.ok) {
          const data   = await res.json()
          const herds: HerdData[] = data.herds ?? data ?? []
          if (herds.length > 0) {
            router.replace(`/dashboard/herds/${toSlug(herds[0].name)}/datos`)
            return
          }
        }

        // 3. Sin rodeos reales → mostrar empty state mínimo
        setEmpty(true)
      } catch {
        setEmpty(true)
      }
    }

    redirectToFirst()
  }, [user, router])

  // Empty state: SOLO texto, sin iconos de vaca ni emojis
  if (empty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-base font-black text-gray-600 mb-1">Sin rodeos todavía</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Usá el botón &ldquo;+ Nuevo rodeo&rdquo; para empezar.
        </p>
      </div>
    )
  }

  // Spinner mientras redirige
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
    </div>
  )
}
