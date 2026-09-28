'use client'

/**
 * /dashboard/herds/_new/page.tsx
 *
 * Ruta de creación inline de rodeo dentro del patrón Master-Detail.
 * Renderiza HerdCreatePanel en el panel derecho, con la lista de rodeos
 * a la izquierda (desde el HerdsLayout sidebar).
 */

import { HerdCreatePanel } from '@/components/herds/HerdCreatePanel'

export default function NewHerdPage() {
  return <HerdCreatePanel />
}
