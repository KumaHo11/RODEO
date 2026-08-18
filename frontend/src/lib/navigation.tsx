'use client'

import {
  LayoutDashboard, CalendarDays, Lightbulb, NotebookPen,
  Users, CheckSquare, Fence, Calendar, Cloud, BookOpen, Leaf, MessageCircle, CreditCard, Beef,
  Calculator, FlaskConical
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
      { name: 'Animales', href: '/dashboard/animals',   icon: Beef,         permissionKey: 'animal_registry' },
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
      { name: 'Metrics',       href: '/dashboard/metrics',    icon: FlaskConical, permissionKey: 'metrics'      },
      { name: 'Huella de Carbono', href: '/dashboard/metrics/carbon', icon: Leaf, permissionKey: 'metrics_module' },
      { name: 'Insights',      href: '/dashboard/insights',   icon: Lightbulb,    permissionKey: 'insights'     },
      { name: 'Calculadora',   href: '/dashboard/calculadora',icon: Calculator,   permissionKey: 'calculadora'  },
    ],
  },
  {
    label: 'EMPRESA',
    items: [
      { name: 'Report Builder', href: '/dashboard/metrics/reports', icon: NotebookPen, permissionKey: 'metrics' },
      { name: 'Marketplace',    href: '/dashboard/metrics/marketplace', icon: Cloud, permissionKey: 'api_access' },
      { name: 'API Docs',       href: '/dashboard/metrics/api-docs', icon: FlaskConical, permissionKey: 'api_access' },
    ],
  },
]

/**
 * Flat list for backward-compat (mobile nav, permission checks, etc.)
 */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items)

/** Mobile bottom nav: up to 5 priority items */
export const MOBILE_NAV_KEYS = ['dashboard', 'mi_campo', 'clima', 'planificador', 'metrics']

/**
 * Map route → permission key for middleware checks.
 */
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard/mi-campo':  'mi_campo',
  '/dashboard/herds':     'rebanhos',
  '/dashboard/animals':   'animal_registry',
  '/dashboard/agenda':    'agenda',
  '/dashboard/clima':     'clima',
  '/dashboard/grazing':   'planificador',
  '/dashboard/bitacora':          'bitacora',
  '/dashboard/bitacora/bandeja':  'bitacora',
  '/dashboard/insights':  'insights',
  '/dashboard/tareas':    'tareas',
  '/dashboard/metrics/carbon': 'metrics_module',
  '/dashboard/metrics':   'metrics',
  '/dashboard/metrics/reports': 'metrics',
  '/dashboard/metrics/marketplace': 'api_access',
  '/dashboard/metrics/api-docs': 'api_access',
}
