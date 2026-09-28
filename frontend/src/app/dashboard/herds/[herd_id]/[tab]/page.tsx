'use client'

/**
 * app/dashboard/herds/[herd_id]/[tab]/page.tsx
 *
 * Soporta TANTO:
 *   - UUIDs completos:   /dashboard/herds/f360b542-.../animales
 *   - Slugs por nombre:  /dashboard/herds/vacas/datos
 *   - Slug especial:     /dashboard/herds/actual/datos (usa el herd del contexto)
 *
 * La resolución slug→ID ocurre dentro de HerdDetailPanel.
 */

import React from 'react'
import { notFound } from 'next/navigation'
import { HerdDetailPanelResolved } from '@/components/herds/layout/HerdDetailPanel'
import { HERD_TABS, type HerdTab } from '@/types/herds'

export default function HerdTabPage({
  params,
}: {
  params: Promise<{ herd_id: string; tab: string }> | { herd_id: string; tab: string }
}) {
  const { herd_id, tab } = params instanceof Promise ? React.use(params) : params

  if (!HERD_TABS.includes(tab as HerdTab)) {
    notFound()
  }

  return (
    <HerdDetailPanelResolved
      herdSlugOrId={herd_id}
      activeTab={tab as HerdTab}
    />
  )
}
