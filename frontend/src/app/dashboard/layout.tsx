'use client'

export const dynamic = 'force-dynamic'

import { useAuth } from '@/components/AuthProvider'
import { usePermissions, ROLE_LABELS, ROLE_COLORS } from '@/lib/usePermissions'
import { ALL_NAV_ITEMS, NAV_GROUPS, type NavItem, type NavGroup } from '@/lib/navigation'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  LogOut, ChevronLeft, ChevronRight, Menu,
  Bell, X, Check, AlertCircle, ClipboardList, WifiOff,
  CalendarDays, Users, Trash2, Sparkles
} from 'lucide-react'
import clsx from 'clsx'
import Image from 'next/image'
import RodeoLogo from '@/components/RodeoLogo'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { WeatherProvider } from '@/lib/context/WeatherContext'
import { ClimateAnalyticsProvider } from '@/lib/context/ClimateAnalyticsContext'
import { InstallPWAButton } from '@/components/InstallPWAButton'
import { useOfflineStatus } from '@/components/OfflineManager'

const NOTIF_ICONS: Record<string, React.ComponentType<any>> = {
  EVENTO:    CalendarDays,
  TAREA:     ClipboardList,
  ALERTA:    AlertCircle,
  INVITACION: Users,
  SISTEMA:   Bell,
}

const NOTIF_COLORS: Record<string, string> = {
  EVENTO:    'bg-blue-100 text-blue-700',
  TAREA:     'bg-green-100 text-green-700',
  ALERTA:    'bg-amber-100 text-amber-700',
  INVITACION:'bg-violet-100 text-violet-700',
  SISTEMA:   'bg-gray-100 text-gray-600',
}

const PAGE_NAMES: Record<string, string> = {
  '/dashboard':              'Panel principal',
  '/dashboard/mi-campo':     'Potreros',
  '/dashboard/herds':        'Rodeos',
  '/dashboard/animals':      'Animales',
  '/dashboard/agenda':       'Agenda',
  '/dashboard/clima':        'Clima',
  '/dashboard/grazing':      'Planificador',
  '/dashboard/bitacora':          'Bitácora de potreros',
  '/dashboard/bitacora/bandeja':  'Bandeja WhatsApp',
  '/dashboard/insights':     'Insights',
  '/dashboard/profile':      'Mi perfil',
  '/dashboard/equipo':       'Equipo',
  '/dashboard/tareas':       'Tareas',
  '/dashboard/guest-setup':  'Configuración de cuenta',
  '/dashboard/calculadora':  'Calculadora',
  '/dashboard/metrics':      'Métricas Satelitales',
  '/dashboard/metrics/carbon': 'Huella de Carbono',
}

// ── Layout ─────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut, profile: authProfile } = useAuth()
  const { can, isOwner, teamRole, roleLabel, roleColors } = usePermissions()
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen]       = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications]   = useState<any[]>([])
  const [notifOpen, setNotifOpen]           = useState(false)
  const [pendingTasks, setPendingTasks]     = useState(0)
  const { isOffline }                       = useOfflineStatus()
  const [showWelcome, setShowWelcome]       = useState(false)
  const [menuConfig, setMenuConfig]         = useState<Record<string, boolean>>({})
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/config/menu')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setMenuConfig(data)
      })
      .catch(err => console.error('Error fetching menu config:', err))
  }, [])

  // ── Guard: redirect to onboarding (in useEffect — never during render) ───────
  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (authProfile === null) return

    const isGuest = !!(authProfile.team_role)
    const isSuperAdmin = authProfile.system_role === 'SUPER_ADMIN' || authProfile.system_role === 'SUPPORT_AGENT'
    const onboardingDone = (authProfile.onboarding_step ?? 0) >= 4

    // Super Admins and Guests skip owner onboarding entirely
    if (!isGuest && !isSuperAdmin && !onboardingDone) {
      router.push('/onboarding')
    }
  }, [isLoading, user, authProfile, router])

  // ── Build filtered navigation based on user permissions ────────────────────
  const getMenuConfigKey = (item: NavItem) => {
    if (item.name === 'Panel') return 'menu_panel'
    if (item.name === 'Calculadora') return 'menu_calculadora'
    return `menu_${item.permissionKey}`
  }

  // Items that are explicitly disabled until ready for production
  const FORCE_DISABLED_KEYS = ['menu_insights', 'menu_carbono']

  const isMenuEnabled = (item: NavItem) => {
    const key = getMenuConfigKey(item)
    // Force-disabled items are always hidden
    if (FORCE_DISABLED_KEYS.includes(key)) return false
    // If we haven't loaded config yet or it's not set, default to true
    if (Object.keys(menuConfig).length > 0 && menuConfig[key] === false) {
      return false
    }
    return true
  }

  const filteredNav = useMemo<NavItem[]>(() => {
    return ALL_NAV_ITEMS.filter(item => {
      // Menu config (super admin) takes priority over owner status
      if (!isMenuEnabled(item)) return false
      if (isOwner) return true // owners see everything that's enabled
      if (item.permissionKey === null) return true // always visible (Panel, Equipo)
      return can(item.permissionKey as any)
    })
  }, [isOwner, can, menuConfig])

  // Groups with items filtered by permissions
  const filteredGroups = useMemo<NavGroup[]>(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!isMenuEnabled(item)) return false
        if (isOwner) return true
        if (item.permissionKey === null) return true
        return can(item.permissionKey as any)
      }),
    })).filter(g => g.items.length > 0)
  }, [isOwner, can, menuConfig])


  // ── Sidebar persistence ────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('rodeo_sidebar')
    if (saved !== null) setSidebarOpen(saved === 'true')
  }, [])

  const toggleSidebar = () => {
    const next = !sidebarOpen
    setSidebarOpen(next)
    localStorage.setItem('rodeo_sidebar', String(next))
  }

  // ── Load profile (from AuthProvider) ───────────────────────────
  const profile = authProfile

  // ── Load notifications + pending tasks ──────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user) return
    // Guard: si no hay conexión real, no bloquear la UI esperando la API
    // navigator.onLine puede ser true en iOS aunque no haya red — igual intentamos
    // pero con timeout muy corto (3s) para no bloquear la navegación
    try {
      const idToken = await user.getIdToken()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      let res: Response
      try {
        res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setPendingTasks(data.pendingTasks || 0)
      }
    } catch (err: any) {
      // AbortError (timeout) o TypeError (red caída) → fallar silenciosamente
      if (err?.name !== 'AbortError') {
        console.warn('[Layout] loadNotifications failed (possibly offline):', err?.message)
      }
      // Mantener notificaciones cacheadas en estado (no limpiar)
    }
  }, [user])


  useEffect(() => { loadNotifications() }, [loadNotifications])

  // ── Close notif panel on outside click ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const markAllRead = async () => {
    if (!user) return
    try {
      const idToken = await user.getIdToken()
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking notifications as read:', err)
    }
  }

  const deleteReadNotifications = async () => {
    if (!user) return
    try {
      const idToken = await user.getIdToken()
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyRead: true }),
      })
      setNotifications(prev => prev.filter(n => !n.is_read))
    } catch (err) {
      console.error('Error deleting notifications:', err)
    }
  }

  const deleteOneNotification = async (id: string) => {
    if (!user) return
    try {
      const idToken = await user.getIdToken()
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isMiCampo = pathname === '/dashboard/mi-campo'
  const currentPageName = Object.entries(PAGE_NAMES).find(
    ([path]) => pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
  )?.[1] ?? 'Rodeo'

  if (isLoading) return null

  if (!user) return null

  // Mientras el perfil sigue cargando, mostrar spinner (nunca redirigir)
  // Esto evita la pantalla en blanco + falsa redirección cuando el perfil aún no fue consultado
  if (authProfile === null && !isLoading) {
    // Si estamos offline, intentar leer el perfil cacheado del localStorage
    if (isOffline) {
      try {
        const cached = localStorage.getItem('rodeo_cached_profile')
        if (!cached) {
          // Sin caché y sin conexión → mostrar aviso
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-gray-800 font-black text-sm">Sin conexión</p>
                <p className="text-gray-400 text-xs mt-1">No se pudo cargar tu perfil. Conectate a internet para continuar.</p>
              </div>
            </div>
          )
        }
        // Si hay caché, AuthProvider ya debería haberlo restaurado. Mostrar spinner breve.
      } catch { /* ignore */ }
    }
    // Profile fetch finalizó pero retornó null (caso edge) — No redirigir aquí
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-bold tracking-widest text-[10px]">Cargando perfil...</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const isGuest = !!(authProfile?.team_role)
  const isSuperAdmin = authProfile?.system_role === 'SUPER_ADMIN' || authProfile?.system_role === 'SUPPORT_AGENT'
  const onboardingDone = (authProfile?.onboarding_step ?? 0) >= 4
  // Show spinner (not blank) while profile loads or redirect is pending
  if (!isGuest && !isSuperAdmin && !onboardingDone && authProfile !== null) return null

  // ── Welcome screen for first-time guests ─────────────────────────────────────
  const shouldShowWelcome = isGuest && authProfile?.is_first_login === true

  const handleSignOut = async () => { await signOut(); router.push('/login') }

  const avatarInitials = profile?.first_name
    ? profile.first_name[0].toUpperCase()
    : (user.email?.[0]?.toUpperCase() ?? 'U')

  // ── Nav item renderer (single item) ─────────────────────────────────────────
  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    const showBadge = item.href === '/dashboard/tareas' && pendingTasks > 0
    return (
      <li key={item.name}>
        <Link
          href={item.href}
          title={!sidebarOpen ? item.name : undefined}
          className={clsx(
            isActive ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50 hover:text-green-700',
            'group flex items-center gap-x-3 rounded-xl p-2.5 text-sm font-bold leading-6 transition-all duration-200',
            !sidebarOpen && 'justify-center'
          )}
        >
          {/* Icon: always visible */}
          <div className="relative shrink-0">
            <item.icon className={clsx(isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-green-600', 'h-5 w-5')} aria-hidden="true" />
            {showBadge && !sidebarOpen && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">
                {pendingTasks > 9 ? '9+' : pendingTasks}
              </span>
            )}
          </div>
          {sidebarOpen && (
            <span className="flex-1 truncate flex items-center justify-between">
              {item.name}
              {showBadge && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shrink-0">
                  {pendingTasks > 9 ? '9+' : pendingTasks}
                </span>
              )}
            </span>
          )}
        </Link>
      </li>
    )
  }

  // ── Nav group renderer (label + items) ─────────────────────────────────────
  const renderNavGroup = (group: NavGroup) => (
    <li key={group.label}>
      {sidebarOpen && (
        <p className="px-2.5 pt-4 pb-1 text-[9px] font-black tracking-widest text-gray-400 uppercase select-none">
          {group.label}
        </p>
      )}
      {!sidebarOpen && <div className="pt-3" />}
      <ul className="space-y-0.5">
        {group.items.map(renderNavItem)}
      </ul>
    </li>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <WeatherProvider>
      <ClimateAnalyticsProvider>
    <div className="fixed inset-0 flex bg-gray-50 overflow-hidden">

      {/* ── Welcome overlay (first login of guests) ───────────────────────── */}
      {shouldShowWelcome && (
        <WelcomeScreen
          orgName={profile?.organization_id ? undefined : undefined}
          onDismiss={() => {
            // WelcomeScreen handles the API call + refreshProfile internally
          }}
        />
      )}

      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className={clsx(
        'hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out relative',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        <div className="flex grow flex-col bg-white border-r border-gray-100 h-full overflow-hidden">

          {/* Logo + collapse toggle */}
          <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-gray-100">
            {sidebarOpen && (
              <Link href="/landing" className="flex items-center w-[259px] h-[56px] justify-start">
                <Image src="/LogoHeaderVerde_1.svg" alt="RODEO" width={259} height={56} className="h-full w-full object-contain" priority />
              </Link>
            )}
            <button
              onClick={toggleSidebar}
              className={clsx(
                'w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-green-700 transition-colors',
                !sidebarOpen && 'mx-auto'
              )}
              aria-label={sidebarOpen ? 'Colapsar menú' : 'Expandir menú'}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Guest role badge */}
          {!isOwner && sidebarOpen && teamRole && (
            <div className="px-4 pt-3 pb-0">
              <span className={clsx('inline-flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full', roleColors.badge)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', roleColors.dot)} />
                {roleLabel}
              </span>
            </div>
          )}

          {/* "Menú" label removed — groups have their own labels */}

          {/* Nav items grouped */}
          <nav className="flex flex-1 flex-col px-2 py-2 overflow-y-auto">
            <ul role="list" className="flex flex-1 flex-col gap-y-0">
              {filteredGroups.map(renderNavGroup)}

              {/* Install PWA — antes de cerrar sesión */}
              <li className="pt-2">
                {sidebarOpen ? (
                  <InstallPWAButton variant="full" />
                ) : (
                  <InstallPWAButton variant="compact" />
                )}
              </li>

              {/* Sign out — bottom */}
              <li className="mt-auto pt-2 border-t border-gray-100">
                <button
                  onClick={handleSignOut}
                  title={!sidebarOpen ? 'Cerrar sesión' : undefined}
                  className={clsx(
                    'group flex items-center gap-x-3 rounded-xl p-2.5 text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors',
                    !sidebarOpen && 'justify-center'
                  )}
                >
                  <LogOut className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-red-500" />
                  {sidebarOpen && <span>Cerrar sesión</span>}
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* ── Mobile drawer overlay ──────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
            <div className="flex h-14 items-center justify-between px-4 border-b border-gray-100">
              <Link href="/landing" className="flex items-center w-[259px] h-[56px] justify-start">
                <Image src="/LogoHeaderVerde_1.svg" alt="RODEO" width={259} height={56} className="h-full w-full object-contain" priority />
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guest badge in mobile drawer */}
            {!isOwner && teamRole && (
              <div className="px-4 pt-3 pb-0">
                <span className={clsx('inline-flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full', roleColors.badge)}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', roleColors.dot)} />
                  {roleLabel}
                </span>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {filteredGroups.map(group => (
                <div key={group.label} className="mb-1">
                  <p className="px-3 pt-4 pb-1 text-[9px] font-black tracking-widest text-gray-400 uppercase select-none">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={clsx(
                              isActive ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50',
                              'flex items-center gap-3 rounded-xl p-3 text-sm font-bold transition-all'
                            )}
                          >
                            <item.icon className={clsx(isActive ? 'text-green-600' : 'text-gray-400', 'h-5 w-5')} />
                            {item.name}
                            {item.href === '/dashboard/tareas' && pendingTasks > 0 && (
                              <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                {pendingTasks}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="px-2 pb-4 border-t border-gray-100 pt-3">
              {/* Install PWA */}
              <div className="mb-2">
                <InstallPWAButton variant="full" />
              </div>
              <Link
                href="/dashboard/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-gray-500 hover:bg-gray-50"
              >
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt="Avatar" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-black">
                    {avatarInitials}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-800">{profile?.first_name || user.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-gray-400">Ver perfil</p>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full mt-2 flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main column ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* ── Top header ──────────────────────────────────────────────────── */}
        <header className="h-14 shrink-0 bg-white border-b border-gray-100 flex items-center justify-between px-3 sm:px-6 z-[2000]">
          {/* Left: mobile hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 shrink-0"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Right: offline badge + role badge (desktop) + bell + avatar */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0" ref={notifRef}>

            {/* Trial Info */}
            {profile?.plan_status === 'trialing' && (
              <span className="hidden md:flex items-center text-[11px] font-bold text-gray-500 mr-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                <Sparkles className="w-3 h-3 text-green-500 mr-1.5" />
                Estás en tu período de prueba ({
                  Math.max(0, (profile.plan_trial_days || 45) - Math.floor((Date.now() - new Date(profile.org_created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)))
                } días restantes).
                <Link href="/dashboard/planes" className="text-green-600 hover:text-green-700 underline ml-1.5">
                  Ver planes
                </Link>
              </span>
            )}

            {/* Offline indicator */}
            {isOffline && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                <WifiOff className="w-3 h-3" /> Sin conexión
              </span>
            )}

            {/* Install PWA compact */}
            <InstallPWAButton variant="compact" />

            {/* Guest role badge in header (desktop) */}
            {!isOwner && teamRole && (
              <span className={clsx('hidden sm:flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full', roleColors.badge)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', roleColors.dot)} />
                {roleLabel}
              </span>
            )}

            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {/* Notification panel */}
              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-600" />
                      <h3 className="text-sm font-black text-gray-900">Notificaciones</h3>
                      {unreadCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[10px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Leídas
                        </button>
                      )}
                      {notifications.some(n => n.is_read) && (
                        <button
                          onClick={deleteReadNotifications}
                          className="text-[10px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                          title="Eliminar notificaciones leídas"
                        >
                          <Trash2 className="w-3 h-3" /> Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-10">
                        <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm font-bold text-gray-400">Sin notificaciones</p>
                      </div>
                    ) : (
                      notifications.map(notif => {
                        const Icon = NOTIF_ICONS[notif.type] || Bell
                        const colorClass = NOTIF_COLORS[notif.type] || NOTIF_COLORS.SISTEMA
                        const date = new Date(notif.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        const cleanText = (text: string) => text.replace(/[🚨⚠️🐄⛔]/g, '').trim()
                        
                        // Default link behavior based on type if data.link is missing
                        let notifLink = notif.data?.link
                        if (!notifLink) {
                          if (notif.type === 'TAREA') notifLink = '/dashboard/tareas'
                          else if (notif.type === 'EVENTO') notifLink = '/dashboard/agenda'
                          else if (notif.type === 'INVITACION') notifLink = '/dashboard/equipo'
                        }
                        
                        const Container = notifLink ? Link : 'div'
                        
                        return (
                          <Container
                            key={notif.id}
                            href={notifLink || '#'}
                            className={clsx(
                              'group flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                              !notif.is_read && 'bg-green-50/40'
                            )}
                            onClick={(e) => {
                              // If it has a link, close the panel
                              if (notifLink) setNotifOpen(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                              <Bell className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 leading-snug">{cleanText(notif.title)}</p>
                              {notif.body && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{cleanText(notif.body)}</p>}
                              <p className="text-[9px] text-gray-400 mt-1">{date}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              {!notif.is_read && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteOneNotification(notif.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                title="Eliminar notificación"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </Container>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar → profile link */}
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-gray-50 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-800 leading-none">{profile?.first_name || user.email?.split('@')[0]}</p>
                <p className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[100px]">{user.email}</p>
              </div>
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Avatar"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-green-100 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-black ring-2 ring-green-100 shrink-0">
                  {avatarInitials}
                </div>
              )}
            </Link>
          </div>
        </header>

        {/* ── Page content ───────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto flex flex-col min-h-0 focus:outline-none" tabIndex={-1}>
            {isMiCampo ? (
              <div className="flex-1 flex flex-col md:overflow-hidden md:h-full focus:outline-none">{children}</div>
            ) : (
              <div className="flex flex-col min-h-full px-3 sm:px-6 lg:px-8 py-4 pb-6 max-w-[1800px] w-full mx-auto focus:outline-none">
                {children}
              </div>
            )}
        </main>


      </div>
    </div>
      </ClimateAnalyticsProvider>
    </WeatherProvider>
  )
}
