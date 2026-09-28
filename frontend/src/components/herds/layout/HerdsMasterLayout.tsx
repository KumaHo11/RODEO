'use client'

/**
 * HerdsMasterLayout — Shell Master-Detail para la sección Rodeos.
 *
 * El DashboardLayout usa: fixed inset-0 flex > [aside nav w-60] > [flex-1 main > header h-16 + content]
 * Este componente vive DENTRO del <main> del DashboardLayout.
 *
 * El <main> ya tiene:
 *   - `flex-1 overflow-y-auto flex flex-col min-h-0`
 * Y cuando no es isHerds, envuelve con:
 *   - `px-3 sm:px-6 lg:px-8 py-4`
 *
 * Para la vista de Rodeos, el DashboardLayout aplica la rama `isMiCampo`:
 *   `flex-1 flex flex-col md:overflow-hidden md:h-full`
 * que NO tiene paddings laterales → el HerdsMasterLayout ocupa todo el espacio disponible.
 *
 * NUNCA usar márgenes negativos (-mx) porque rompen el layout cuando el sidebar
 * de navegación está colapsado/expandido y tiene ancho dinámico.
 */

import React, { useEffect, useState } from 'react'

interface HerdsMasterLayoutProps {
  children: React.ReactNode
}

export function HerdsMasterLayout({ children }: HerdsMasterLayoutProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return (
    /*
     * flex h-full overflow-hidden:
     *   - h-full → ocupa todo el alto disponible dentro del main
     *   - overflow-hidden → evita scroll doble (cada panel tiene su propio scroll)
     *
     * NO usamos -mx / -my: el DashboardLayout ya maneja el espaciado externo.
     */
    <div className="flex h-full overflow-hidden w-full">

      {/* ── Sidebar (Master) — ancho fijo 300px, siempre visible en md+ ── */}
      <aside className="
        hidden md:flex shrink-0 flex-col
        w-[300px]
        bg-white
        border-r border-gray-200
        shadow-[1px_0_6px_0_rgba(0,0,0,0.04)]
        overflow-hidden
      ">
        {/* Portal target: HerdsLayout inyecta HerdsSidebar aquí */}
        <div id="herds-sidebar-slot" className="flex flex-col h-full w-full overflow-hidden" />
      </aside>

      {/* ── Panel derecho (Detail) — flex-1, nunca se solapa ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 min-w-0">
        {children}
      </main>
    </div>
  )
}
