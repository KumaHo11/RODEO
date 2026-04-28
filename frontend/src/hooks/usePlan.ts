'use client'

import { useAuth } from '@/components/AuthProvider'

// ─── Tipos ─────────────────────────────────────────────────────────────────
export type PlanType = 'BROTE' | 'PLANIFICADOR' | 'HOLISTICO' | 'LATIFUNDIO'

export type FeatureKey =
  | 'ndvi_access'           // NDVI satelital
  | 'ai_insights'           // Módulo Insights IA (Gemini)
  | 'offline_mode'          // App offline / caché
  | 'voice_bitacora'        // Audio en Bitácora
  | 'advanced_reports'      // Reportes avanzados
  | 'api_access'            // Acceso API corporativa
  | 'carbon_module'         // Módulo Carbono (MRV)
  | 'grazing_planner'       // Planificador de pastoreo
  | 'tareas'                // Módulo tareas
  | 'equipo'                // Gestión de equipo
  | 'agenda'                // Agenda / eventos
  | 'clima'                 // Módulo clima
  | 'map'                   // Mapa de campo
  | 'climate_adjustment'    // Ajuste Clima (NDVI × lluvia × sequía)

// ─── Mapeo plan-slug → PlanType ────────────────────────────────────────────
const SLUG_TO_PLAN: Record<string, PlanType> = {
  'campo_libre':    'BROTE',
  'brote':          'BROTE',
  'planificador':   'PLANIFICADOR',
  'pro_ganadero':   'PLANIFICADOR',
  'pro_ganadero+':  'HOLISTICO',
  'holistico':      'HOLISTICO',
  'latifundio':     'LATIFUNDIO',
  'enterprise':     'LATIFUNDIO',
}

// ─── Qué incluye cada plan por defecto (si no hay flags en DB) ─────────────
// Esto actúa como fallback cuando los flags de DB no están cargados aún.
const PLAN_DEFAULTS: Record<PlanType, Record<FeatureKey, boolean>> = {
  BROTE: {
    ndvi_access:          false,
    ai_insights:          false,
    offline_mode:         false,
    voice_bitacora:       false,
    advanced_reports:     false,
    api_access:           false,
    carbon_module:        false,
    grazing_planner:      false,
    tareas:               false,
    equipo:               false,
    agenda:               true,
    clima:                true,
    map:                  true,
    climate_adjustment:   false,
  },
  PLANIFICADOR: {
    ndvi_access:          false,
    ai_insights:          false,
    offline_mode:         false,
    voice_bitacora:       true,
    advanced_reports:     false,
    api_access:           false,
    carbon_module:        false,
    grazing_planner:      true,
    tareas:               true,
    equipo:               true,
    agenda:               true,
    clima:                true,
    map:                  true,
    climate_adjustment:   true,
  },
  HOLISTICO: {
    ndvi_access:          false,  // requiere Sentinel Hub contratado
    ai_insights:          true,
    offline_mode:         true,
    voice_bitacora:       true,
    advanced_reports:     true,
    api_access:           false,
    carbon_module:        true,
    grazing_planner:      true,
    tareas:               true,
    equipo:               true,
    agenda:               true,
    clima:                true,
    map:                  true,
    climate_adjustment:   true,
  },
  LATIFUNDIO: {
    ndvi_access:          true,
    ai_insights:          true,
    offline_mode:         true,
    voice_bitacora:       true,
    advanced_reports:     true,
    api_access:           true,
    carbon_module:        true,
    grazing_planner:      true,
    tareas:               true,
    equipo:               true,
    agenda:               true,
    clima:                true,
    map:                  true,
    climate_adjustment:   true,
  },
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function usePlan() {
  const { profile } = useAuth()

  // Plan real desde la DB (via profile.plan_slug devuelto por /api/auth/profile)
  const rawSlug = profile?.plan_slug?.toLowerCase() ?? ''
  const currentPlan: PlanType = SLUG_TO_PLAN[rawSlug] ?? 'BROTE'

  // Feature flags reales desde la DB (via profile.plan_feature_flags)
  // Si están disponibles los usamos; si no, caemos al mapa estático PLAN_DEFAULTS.
  const dbFlags: Record<string, boolean> = {}
  if (profile?.plan_feature_flags && Array.isArray(profile.plan_feature_flags)) {
    for (const flag of profile.plan_feature_flags as any[]) {
      if (flag.flag_type === 'boolean') {
        dbFlags[flag.flag_key] = flag.flag_value === true || flag.flag_value === 'true'
      }
    }
  }

  const hasDbFlags = Object.keys(dbFlags).length > 0
  const defaultsForPlan = PLAN_DEFAULTS[currentPlan]

  const hasFeature = (feature: FeatureKey): boolean => {
    if (hasDbFlags && feature in dbFlags) return dbFlags[feature]
    return defaultsForPlan[feature] ?? false
  }

  // Límites numéricos del plan
  const getLimit = (key: 'max_paddocks' | 'max_herds' | 'max_team_members'): number => {
    if (profile?.plan_feature_flags && Array.isArray(profile.plan_feature_flags)) {
      const flag = (profile.plan_feature_flags as any[]).find(f => f.flag_key === key)
      if (flag) return Number(flag.flag_value)
    }
    // Fallback por plan
    const limits: Record<PlanType, Record<string, number>> = {
      BROTE:        { max_paddocks: 5,    max_herds: 1, max_team_members: 1 },
      PLANIFICADOR: { max_paddocks: 20,   max_herds: 3, max_team_members: 3 },
      HOLISTICO:    { max_paddocks: 100,  max_herds: 10, max_team_members: 10 },
      LATIFUNDIO:   { max_paddocks: 9999, max_herds: 9999, max_team_members: 9999 },
    }
    return limits[currentPlan][key] ?? 5
  }

  return {
    currentPlan,
    planSlug: rawSlug,
    planName: profile?.plan_name ?? null,
    hasFeature,
    getLimit,
    // Legacy — compatibilidad con código anterior que usaba feature strings distintos
    hasLegacyFeature: (feature: 'NDVI' | 'CARBONO' | 'SAVORY' | 'OFFLINE') => {
      switch (feature) {
        case 'NDVI':   return hasFeature('ndvi_access')
        case 'CARBONO': return hasFeature('carbon_module')
        case 'SAVORY': return hasFeature('advanced_reports')
        case 'OFFLINE': return hasFeature('offline_mode')
        default: return false
      }
    },
  }
}
