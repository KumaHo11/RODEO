'use client'

import { useAuth } from '@/components/AuthProvider'

/**
 * Permission keys must match the `permissions` jsonb field in profiles.
 * Keys: dashboard | mi_campo | rebanhos | agenda | planificador | bitacora | insights | equipo | tareas
 */
export type PermissionKey =
  | 'dashboard'
  | 'mi_campo'
  | 'rebanhos'
  | 'agenda'
  | 'planificador'
  | 'bitacora'
  | 'insights'
  | 'valuacion'
  | 'equipo'
  | 'tareas'

export type TeamRole = 'OWNER' | 'ADMIN' | 'CAPATAZ' | 'VETERINARIO' | 'AYUDANTE'

export const ROLE_LABELS: Record<TeamRole | string, string> = {
  OWNER:       'Propietario',
  ADMIN:       'Administrador',
  CAPATAZ:     'Capataz',
  VETERINARIO: 'Veterinario',
  AYUDANTE:    'Ayudante',
}

export const ROLE_COLORS: Record<TeamRole | string, { badge: string; dot: string }> = {
  OWNER:       { badge: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400' },
  ADMIN:       { badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  CAPATAZ:     { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  VETERINARIO: { badge: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500' },
  AYUDANTE:    { badge: 'bg-gray-100 text-gray-700',     dot: 'bg-gray-400' },
}

/**
 * Hook to check the current user's permissions.
 *
 * - Owners (team_role === null or 'OWNER') always have full access.
 * - Guest users get access only to the modules explicitly enabled in their permissions object.
 */
export function usePermissions() {
  const { profile } = useAuth()

  const teamRole = (profile?.team_role ?? null) as TeamRole | null

  // Owner: no team_role or team_role === 'OWNER'
  const isOwner = !teamRole || teamRole === 'OWNER'

  /**
   * Returns true if the current user can access the given module.
   * Owners can always access everything.
   */
  const can = (key: PermissionKey): boolean => {
    if (isOwner) return true
    const perms = profile?.permissions as Record<string, any> | null
    if (!perms) return key === 'dashboard' || key === 'equipo' // minimal fallback
    return Boolean(perms[key]) === true
  }

  /**
   * Returns true if the user has AT LEAST VIEW access to the equipo module.
   * (All authenticated users can view the team page, but only owners/admins can manage.)
   */
  const canManageTeam = isOwner || (profile?.permissions as any)?.equipo === true

  return {
    can,
    isOwner,
    canManageTeam,
    teamRole,
    roleLabel: teamRole ? (ROLE_LABELS[teamRole] ?? teamRole) : 'Propietario',
    roleColors: teamRole ? (ROLE_COLORS[teamRole] ?? ROLE_COLORS.OWNER) : ROLE_COLORS.OWNER,
    permissions: (profile?.permissions as Record<string, boolean>) ?? null,
  }
}
