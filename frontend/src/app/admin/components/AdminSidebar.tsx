'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

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
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`relative flex flex-col bg-white border-r border-gray-100 transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-14' : 'w-52'}`}>

      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 h-16 border-b border-gray-100 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[11px] font-black tracking-tight">R</span>
        </div>
        {!collapsed && (
          <div>
            <div className="text-gray-900 font-black text-sm tracking-tight leading-none">RODEO</div>
            <div className="text-[9px] text-green-600 font-semibold tracking-widest mt-0.5">SUPER ADMIN</div>
          </div>
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
