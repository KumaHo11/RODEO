'use client'

import { LayoutDashboard, Calendar, CalendarDays, Lightbulb, NotebookPen, Users, CheckSquare } from 'lucide-react'

const FieldIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="3,12 8,4 16,4 21,12 16,20 8,20" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const HerdIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="1" y1="19" x2="23" y2="19" strokeWidth="1.5" />
    <ellipse cx="7" cy="14" rx="3.5" ry="2" />
    <line x1="4.5" y1="15.5" x2="4" y2="19" />
    <line x1="6" y1="16" x2="6" y2="19" />
    <line x1="8.5" y1="15.5" x2="9" y2="19" />
    <line x1="8" y1="14.5" x2="10" y2="13.5" />
    <circle cx="10.5" cy="13" r="1.2" />
    <ellipse cx="16" cy="14.5" rx="3.5" ry="2" />
    <line x1="13.5" y1="16" x2="13" y2="19" />
    <line x1="15" y1="16.5" x2="15" y2="19" />
    <line x1="18" y1="16" x2="18.5" y2="19" />
    <line x1="18.5" y1="14.5" x2="20.5" y2="13.5" />
    <circle cx="21" cy="13" r="1.2" />
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
  { name: 'Panel',        href: '/dashboard',           icon: LayoutDashboard, permissionKey: null        },
  { name: 'Mi campo',     href: '/dashboard/mi-campo',  icon: FieldIcon,       permissionKey: 'mi_campo'  },
  { name: 'Rebaños',      href: '/dashboard/herds',     icon: HerdIcon,        permissionKey: 'rebanhos'  },
  { name: 'Agenda',       href: '/dashboard/agenda',    icon: CalendarDays,    permissionKey: 'agenda'    },
  { name: 'Planificador', href: '/dashboard/grazing',   icon: Calendar,        permissionKey: 'planificador' },
  { name: 'Bitácora',     href: '/dashboard/bitacora',  icon: NotebookPen,     permissionKey: 'bitacora'  },
  { name: 'Insights',     href: '/dashboard/insights',  icon: Lightbulb,       permissionKey: 'insights'  },
  { name: 'Equipo',       href: '/dashboard/equipo',    icon: Users,           permissionKey: null        }, // always visible, read-only for guests
  { name: 'Tareas',       href: '/dashboard/tareas',    icon: CheckSquare,     permissionKey: 'tareas'    },
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

export { FieldIcon, HerdIcon }
