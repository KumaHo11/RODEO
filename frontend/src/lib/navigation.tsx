'use client'

import { LayoutDashboard, Calendar, CalendarDays, Lightbulb, NotebookPen, Users, CheckSquare } from 'lucide-react'
import CowIcon from '@/components/CowIcon'



const FieldIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {/* Outer field boundary */}
    <rect x="2" y="4" width="20" height="16" rx="1.5" />
    {/* Internal fence divider — horizontal */}
    <line x1="2" y1="12" x2="22" y2="12" />
    {/* Internal fence divider — vertical right */}
    <line x1="14" y1="12" x2="14" y2="20" />
    {/* Gate post hint on top-left sub-field */}
    <line x1="8" y1="4" x2="8" y2="12" strokeWidth="1.25" strokeDasharray="2 2" />
  </svg>
)

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
  { name: 'Potreros',            href: '/dashboard/mi-campo',        icon: FieldIcon,       permissionKey: 'mi_campo'    },
  { name: 'Rodeos',             href: '/dashboard/herds',           icon: CowIcon,         permissionKey: 'rebanhos'    },
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

export { FieldIcon }
