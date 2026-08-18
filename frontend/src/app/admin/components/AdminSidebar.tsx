'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import Image from 'next/image'

import { ToggleLeft } from 'lucide-react'

const NAV_ITEMS = [
  {
    group: 'PANEL',
    items: [{ href: '/admin/dashboard', label: 'Dashboard' }],
  },
  {
    group: 'USUARIOS',
    items: [
      { href: '/admin/users',       label: 'Usuarios'     },
      { href: '/admin/admin-users', label: 'Super Admins' },
    ],
  },
  {
    group: 'SUSCRIPCIONES',
    items: [{ href: '/admin/plans', label: 'Planes' }],
  },
  {
    group: 'SISTEMA',
    items: [
      { href: '/admin/audit-logs', label: 'Auditoría'     },
      { href: '/admin/config',     label: 'Configuración' },
      { href: '/admin/features',   label: 'Feature Flags', icon: ToggleLeft },
      { href: '/admin/terms',      label: 'Términos'      },
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`relative flex flex-col bg-white border-r border-gray-100 transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-14' : 'w-52'}`}>

      {/* Logo */}
      <div className={`flex items-center px-4 h-16 border-b border-gray-100 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <Link href="/admin/dashboard" className="flex flex-col justify-center mt-1">
            <Image src="/LogoHeaderVerde_1.svg" alt="RODEO" width={120} height={26} className="h-6 w-auto object-contain object-left mb-1" priority />
            <div className="text-[9px] text-green-700 font-bold tracking-widest leading-none ml-1">SUPER ADMIN</div>
          </Link>
        ) : (
          <Link href="/admin/dashboard" className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <Image src="/FaviconFondoVerde.svg" alt="R" width={28} height={28} className="w-full h-full rounded-md" />
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(group => (
          <div key={group.group} className="mb-4">
            {!collapsed && (
              <div className="px-4 mb-1 text-[9px] font-bold text-gray-400 tracking-widest">
                {group.group}
              </div>
            )}
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center mx-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5 ${
                    active
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  } ${collapsed ? 'justify-center' : 'gap-2'}`}
                >
                  {collapsed ? (
                    <span className="text-[11px] font-black text-gray-400">{item.label.charAt(0)}</span>
                  ) : (
                    <>
                      {item.icon && <item.icon className="w-4 h-4 mr-1 opacity-70" />}
                      <span className="flex-1">{item.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                    </>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 shadow-sm transition-colors z-10"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        <span className="text-[10px] font-bold">{collapsed ? '›' : '‹'}</span>
      </button>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <button
          onClick={() => {
            document.cookie = '__session=; path=/; max-age=0'
            window.location.href = '/login'
          }}
          className={`flex items-center w-full px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all ${collapsed ? 'justify-center' : 'gap-2'}`}
        >
          {collapsed ? '↩' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}
