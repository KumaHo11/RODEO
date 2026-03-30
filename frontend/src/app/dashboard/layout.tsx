'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'
import { LayoutDashboard, Map as MapIcon, Calendar, User, Settings, LogOut, TestTube, Lightbulb, MapPin, Menu, X, List } from 'lucide-react'
import clsx from 'clsx'

const CowIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M11.5 19C10 19 8.5 18 8 16V13L6 10V7L8 5H16L18 7V10L16 13V16C15.5 18 14 19 12.5 19H11.5Z" />
    <path d="M6 7C4 7 3 8 3 10C3 11.5 4.5 12 5.5 11" />
    <path d="M18 7C20 7 21 8 21 10C21 11.5 19.5 12 18.5 11" />
    <path d="M9 7L10 3L11.5 5" />
    <path d="M15 7L14 3L12.5 5" />
    <circle cx="10" cy="11" r="1" />
    <circle cx="14" cy="11" r="1" />
  </svg>
)

const navigation = [
  { name: 'Panel', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mapa', href: '/dashboard/map', icon: MapIcon },
  { name: 'Potreros', href: '/dashboard/paddocks-list', icon: List },
  { name: 'Rebaños', href: '/dashboard/herds', icon: CowIcon },
  { name: 'Planificador', href: '/dashboard/grazing', icon: Calendar },
  { name: 'Insights', href: '/dashboard/insights', icon: Lightbulb },
  { name: 'Perfil', href: '/dashboard/profile', icon: User },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Cargando tablero...</div>
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center text-2xl font-bold text-green-700">
            RODEO
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={clsx(
                          pathname === item.href
                            ? 'bg-gray-50 text-green-600'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-green-600',
                          'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6'
                        )}
                      >
                        <item.icon
                          className={clsx(
                            pathname === item.href ? 'text-green-600' : 'text-gray-400 group-hover:text-green-600',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <button
                  onClick={handleSignOut}
                  className="group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-red-600 w-full"
                >
                  <LogOut
                    className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-red-600"
                    aria-hidden="true"
                  />
                  Cerrar sesión
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
