'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useState, useRef, useEffect } from 'react'
import { User, LogOut, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/admin/dashboard':   { title: 'Dashboard',                subtitle: 'Resumen global de la plataforma' },
  '/admin/users':       { title: 'Gestión de Usuarios',      subtitle: 'Productores y acceso a la plataforma' },
  '/admin/admin-users': { title: 'Super Administradores',    subtitle: 'Gestión de acceso al panel' },
  '/admin/plans':       { title: 'Planes de Suscripción',    subtitle: 'Precios, features y pasarelas de pago' },
  '/admin/audit-logs':  { title: 'Registro de Auditoría',   subtitle: 'Historial de acciones administrativas' },
  '/admin/config':      { title: 'Configuración',            subtitle: 'API Keys y parámetros del sistema' },
  '/admin/features':    { title: 'Feature Flags',            subtitle: 'Activación global de módulos' },
}

interface AdminHeaderProps {
  /** Slot para acciones opcionales (botones) en el lado derecho */
  actions?: React.ReactNode
}

export default function AdminHeader({ actions }: AdminHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const page = PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k + '/'))?.[1] ??
    { title: 'Admin', subtitle: undefined }

  const initials = profile?.first_name
    ? `${profile.first_name[0]}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : 'SA'

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between px-6 lg:px-8 h-16 border-b border-gray-100 bg-white flex-shrink-0 z-30">
      {/* Left: title */}
      <div>
        <h1 className="text-gray-900 font-bold text-base leading-tight">{page.title}</h1>
        {page.subtitle && <p className="text-gray-400 text-xs mt-0.5 hidden sm:block">{page.subtitle}</p>}
      </div>

      {/* Right: actions + profile */}
      <div className="flex items-center gap-3">
        {actions}

        {/* Admin badge / Dropdown */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-3 border-l border-gray-100 hover:bg-gray-50 transition-colors py-1 rounded-lg group"
          >
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm shadow-green-100 group-hover:scale-105 transition-transform">
              <span className="text-[10px] text-white font-black">{initials}</span>
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-xs text-gray-900 font-bold">
                {profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}` : 'Super Admin'}
              </div>
              <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                rodeoagtech.com <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </button>

          {/* Menu Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5 animate-in fade-in zoom-in duration-100">
              <Link 
                href="/dashboard/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-green-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                  <User className="w-4 h-4 text-green-600" />
                </div>
                Mi Perfil
              </Link>
              
              <div className="h-px bg-gray-50 my-1.5 mx-2" />
              
              <button 
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
