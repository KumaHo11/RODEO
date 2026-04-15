'use client'

import { LayoutDashboard, Calendar, CalendarDays, Lightbulb, NotebookPen, Users, CheckSquare, Fence, Beef } from 'lucide-react'

export type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<any>
  permissionKey: string | null // null = always visible (owner sees all; guests see it too)
}

/**
 * Full navigation config with permission keys.
 * permissionKey === null means always visible (e.g. Panel, Equipo — equipo shows read-only for guests)
 */
export const ALL_NAV_ITEMS: NavItem[] = [
  { name: 'Panel',               href: '/dashboard',                 icon: LayoutDashboard, permissionKey: 'dashboard'   },
  { name: 'Potreros',            href: '/dashboard/mi-campo',        icon: Fence,           permissionKey: 'mi_campo'    },
  { name: 'Rodeos',              href: '/dashboard/herds',           icon: Beef,            permissionKey: 'rebanhos'    },
  { name: 'Agenda',              href: '/dashboard/agenda',          icon: CalendarDays,    permissionKey: 'agenda'      },
  { name: 'Planificador',        href: '/dashboard/grazing',         icon: Calendar,        permissionKey: 'planificador'},
  { name: 'Bitácora',            href: '/dashboard/bitacora',        icon: NotebookPen,     permissionKey: 'bitacora'    },
  { name: 'Insights',            href: '/dashboard/insights',        icon: Lightbulb,       permissionKey: 'insights'    },
  { name: 'Equipo',              href: '/dashboard/equipo',          icon: Users,           permissionKey: 'equipo'      },
  { name: 'Tareas',              href: '/dashboard/tareas',          icon: CheckSquare,     permissionKey: 'tareas'      },
]

/** Mobile bottom nav always shows these 5 (filtered by permissions) */
export const MOBILE_NAV_KEYS = ['dashboard', 'mi_campo', 'bitacora', 'planificador', 'insights']

/**
 * Map route → permission key for middleware checks.
 * Routes not in this map are always accessible if authenticated.
 */
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard/mi-campo':  'mi_campo',
  '/dashboard/herds':     'rebanhos',
  '/dashboard/agenda':    'agenda',
  '/dashboard/grazing':   'planificador',
  '/dashboard/bitacora':  'bitacora',
  '/dashboard/insights':  'insights',
  '/dashboard/tareas':    'tareas',
}
