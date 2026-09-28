'use client'

/**
 * app/dashboard/herds/layout.tsx
 *
 * Provee HerdsProvider (context) y el shell Master-Detail.
 * Sin modal legacy. "Nuevo rodeo" navega a /dashboard/herds/crear.
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { HerdsProvider, useHerds } from '@/lib/context/HerdsContext'
import { HerdsMasterLayout } from '@/components/herds/layout/HerdsMasterLayout'
import { HerdsSidebar } from '@/components/herds/layout/HerdsSidebar'
import { toHerdSlug } from '@/components/herds/layout/HerdDetailPanel'

export const dynamic = 'force-dynamic'

export default function HerdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <HerdsProvider>
      <HerdsShell>{children}</HerdsShell>
    </HerdsProvider>
  )
}

// ── Shell interno (necesita el contexto) ──────────────────────────────────────

function HerdsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { herds, lotes, ungrouped, loading, selectedHerdId, selectHerd } = useHerds()

  return (
    <HerdsMasterLayout>
      <HerdsLayoutSidebarPortal>
        <HerdsSidebar
          herds={herds}
          lotes={lotes}
          ungrouped={ungrouped}
          loading={loading && herds.length === 0}
          selectedHerdId={selectedHerdId}
          onSelectHerd={(id) => {
            // Buscar el nombre del herd para construir la URL limpia
            const herd = herds.find(h => h.id === id)
            const slug = herd ? toHerdSlug(herd.name) : id
            selectHerd(id)
            router.push(`/dashboard/herds/${slug}/datos`)
          }}
          onNewHerd={() => router.push('/dashboard/herds/crear')}
        />
      </HerdsLayoutSidebarPortal>

      {children}
    </HerdsMasterLayout>
  )
}

// ── Portal — inyecta el sidebar en el slot del HerdsMasterLayout ──────────────

function HerdsLayoutSidebarPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [slot, setSlot]       = useState<Element | null>(null)

  useEffect(() => {
    setMounted(true)
    setSlot(document.getElementById('herds-sidebar-slot'))
  }, [])

  if (!mounted || !slot) return null
  return createPortal(children, slot)
}
