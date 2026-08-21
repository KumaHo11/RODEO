'use client'

import {
  LayoutDashboard, CalendarDays, Lightbulb, FileBarChart2,
  Users, CheckSquare, Fence, Calendar, Cloud, BookOpen, Leaf, PawPrint, CreditCard,
  Calculator, BarChart3, ShieldCheck, Store, Code2
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
 * PRINCIPAL / REGISTROS / PLANIFICACIÓN / INTELIGENCIA / EMPRESA
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
      { name: 'Potreros', href: '/dashboard/mi-campo',  icon: Fence,        permissionKey: 'mi_campo'        },
      { name: 'Rodeos',   href: '/dashboard/herds',     icon: IconoRodeos,  permissionKey: 'rebanhos'        },
      { name: 'Animales', href: '/dashboard/animals',   icon: PawPrint,     permissionKey: 'animal_registry' },
      { name: 'Agenda',   href: '/dashboard/agenda',    icon: CalendarDays, permissionKey: 'agenda'          },
      { name: 'Bitácora', href: '/dashboard/bitacora',  icon: BookOpen,     permissionKey: 'bitacora'        },
      { name: 'Clima',    href: '/dashboard/clima',     icon: Cloud,        permissionKey: 'clima'           },
    ],
  },
  {
    label: 'PLANIFICACIÓN',
    items: [
      { name: 'Planificador', href: '/dashboard/grazing',  icon: Calendar,    permissionKey: 'planificador' },
      { name: 'Tareas',       href: '/dashboard/tareas',   icon: CheckSquare, permissionKey: 'tareas'       },
      { name: 'Equipo',       href: '/dashboard/equipo',   icon: Users,       permissionKey: 'equipo'       },
    ],
  },
  {
    label: 'INTELIGENCIA',
    items: [
      { name: 'Métricas',          href: '/dashboard/metrics',       icon: BarChart3,    permissionKey: 'metrics'        },
      { name: 'Huella de Carbono', href: '/dashboard/metrics/carbon',icon: Leaf,         permissionKey: 'metrics_module' },
      { name: 'EUDR',              href: '/dashboard/eudr',          icon: ShieldCheck,  permissionKey: 'metrics'        },
      { name: 'Insights',          href: '/dashboard/insights',      icon: Lightbulb,    permissionKey: 'insights'       },
      { name: 'Calculadora',       href: '/dashboard/calculadora',   icon: Calculator,   permissionKey: 'calculadora'    },
    ],
  },
  {
    label: 'EMPRESA',
    items: [
      { name: 'Informes',          href: '/dashboard/metrics/reports',      icon: FileBarChart2, permissionKey: 'metrics'    },
      { name: 'Mercado B2B',       href: '/dashboard/metrics/marketplace',  icon: Store,         permissionKey: 'api_access' },
      { name: 'Documentación API', href: '/dashboard/metrics/api-docs',     icon: Code2,         permissionKey: 'api_access' },
    ],
  },
]

/**
 * Flat list para compatibilidad hacia atrás (nav móvil, verificación de permisos, etc.)
 */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items)

/** Nav inferior móvil: hasta 5 ítems prioritarios */
export const MOBILE_NAV_KEYS = ['dashboard', 'mi_campo', 'clima', 'planificador', 'metrics']

/**
 * Mapa ruta → clave de permiso para verificaciones en middleware.
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
  '/dashboard/eudr':             'metrics',
  '/dashboard/eudr/documentos':  'metrics',
  '/dashboard/eudr/insumos':     'metrics',
  '/dashboard/eudr/exportar':    'metrics',
}
