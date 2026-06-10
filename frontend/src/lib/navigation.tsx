'use client'

import {
  LayoutDashboard, CalendarDays, Lightbulb, NotebookPen,
  Users, CheckSquare, Fence, Calendar, Cloud, BookOpen, Leaf, MessageCircle, CreditCard,
  Calculator
} from 'lucide-react'
import { IconoRodeos } from '@/components/icons/IconoRodeos'

export type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<any>
  permissionKey: string | null // null = always visible
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/**
 * Navegación agrupada por sección.
 * PRINCIPAL / REGISTROS / PLANIFICACIÓN / INTELIGENCIA
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { name: 'Panel', href: '/dashboard', icon: LayoutDashboard, permissionKey: 'dashboard' },
    ],
  },
  {
    label: 'REGISTROS',
    items: [
      { name: 'Potreros', href: '/dashboard/mi-campo',  icon: Fence,        permissionKey: 'mi_campo'    },
      { name: 'Rodeos',   href: '/dashboard/herds',     icon: IconoRodeos,  permissionKey: 'rebanhos'    },
      { name: 'Agenda',   href: '/dashboard/agenda',    icon: CalendarDays, permissionKey: 'agenda'      },
      { name: 'Bitácora', href: '/dashboard/bitacora', icon: BookOpen, permissionKey: 'bitacora' },
      { name: 'Clima',    href: '/dashboard/clima',    icon: Cloud,    permissionKey: 'clima'    },
    ],
  },
  {
    label: 'PLANIFICACIÓN',
    items: [
      { name: 'Planificador', href: '/dashboard/grazing',  icon: Calendar,     permissionKey: 'planificador' },
      { name: 'Tareas',       href: '/dashboard/tareas',   icon: CheckSquare,  permissionKey: 'tareas'       },
      { name: 'Equipo',       href: '/dashboard/equipo',   icon: Users,        permissionKey: 'equipo'       },
    ],
  },
  {
    label: 'INTELIGENCIA',
    items: [
      { name: 'Insights',      href: '/dashboard/insights',    icon: Lightbulb,  permissionKey: 'insights'     },
      { name: 'Carbono',       href: '/dashboard/carbono',     icon: Leaf,        permissionKey: 'carbono'      },
      { name: 'Calculadora',   href: '/dashboard/calculadora', icon: Calculator,  permissionKey: 'calculadora'  },
    ],
  },
]

/**
 * Flat list for backward-compat (mobile nav, permission checks, etc.)
 */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items)

/** Mobile bottom nav: up to 5 priority items */
export const MOBILE_NAV_KEYS = ['dashboard', 'mi_campo', 'clima', 'planificador', 'insights']

/**
 * Map route → permission key for middleware checks.
 */
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard/mi-campo':  'mi_campo',
  '/dashboard/herds':     'rebanhos',
  '/dashboard/agenda':    'agenda',
  '/dashboard/clima':     'clima',
  '/dashboard/grazing':   'planificador',
  '/dashboard/bitacora':          'bitacora',
  '/dashboard/bitacora/bandeja':  'bitacora',
  '/dashboard/insights':  'insights',
  '/dashboard/tareas':    'tareas',
  '/dashboard/carbono':   'carbono',
}
