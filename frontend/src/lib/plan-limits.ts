import { queryOne, query } from '@/lib/db'

export type FeatureKey =
  | 'ndvi_access'
  | 'ai_insights'
  | 'offline_mode'
  | 'voice_bitacora'
  | 'advanced_reports'
  | 'api_access'
  | 'carbon_module'
  | 'grazing_planner'
  | 'tareas'
  | 'equipo'
  | 'agenda'
  | 'clima'
  | 'map'

const PLAN_DEFAULTS: Record<string, Record<string, boolean>> = {
  BROTE: {
    ndvi_access:       false,
    ai_insights:       false,
    offline_mode:      false,
    voice_bitacora:    false,
    advanced_reports:  false,
    api_access:        false,
    carbon_module:     false,
    grazing_planner:   false,
    tareas:            false,
    equipo:            false,
    agenda:            true,
    clima:             true,
    map:               true,
  },
  PLANIFICADOR: {
    ndvi_access:       false,
    ai_insights:       false,
    offline_mode:      false,
    voice_bitacora:    true,
    advanced_reports:  false,
    api_access:        false,
    carbon_module:     false,
    grazing_planner:   true,
    tareas:            true,
    equipo:            true,
    agenda:            true,
    clima:             true,
    map:               true,
  },
  HOLISTICO: {
    ndvi_access:       false,
    ai_insights:       true,
    offline_mode:      true,
    voice_bitacora:    true,
    advanced_reports:  true,
    api_access:        false,
    carbon_module:     true,
    grazing_planner:   true,
    tareas:            true,
    equipo:            true,
    agenda:            true,
    clima:             true,
    map:               true,
  },
  LATIFUNDIO: {
    ndvi_access:       true,
    ai_insights:       true,
    offline_mode:      true,
    voice_bitacora:    true,
    advanced_reports:  true,
    api_access:        true,
    carbon_module:     true,
    grazing_planner:   true,
    tareas:            true,
    equipo:            true,
    agenda:            true,
    clima:             true,
    map:               true,
  },
}

const SLUG_TO_PLAN: Record<string, string> = {
  'campo_libre':    'BROTE',
  'brote':          'BROTE',
  'planificador':   'PLANIFICADOR',
  'pro_ganadero':   'PLANIFICADOR',
  'pro_ganadero+':  'HOLISTICO',
  'holistico':      'HOLISTICO',
  'latifundio':     'LATIFUNDIO',
  'enterprise':     'LATIFUNDIO',
}

export async function checkFeatureAccess(firebaseUid: string, feature: FeatureKey): Promise<boolean> {
  const profile = await queryOne(
    `SELECT p.organization_id, sp.slug AS plan_slug
     FROM profiles p
     LEFT JOIN organizations o ON p.organization_id = o.id
     LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
     WHERE p.firebase_uid = $1`,
    [firebaseUid]
  )

  if (!profile) return false

  const planSlug = (profile as any).plan_slug?.toLowerCase() || ''
  const planType = SLUG_TO_PLAN[planSlug] || 'BROTE'

  // Check DB flags first (overrides)
  if ((profile as any).organization_id) {
    const flags = await query(
      `SELECT pff.flag_key, pff.flag_value, pff.flag_type
       FROM plan_feature_flags pff
       JOIN subscriptions_plans sp ON pff.plan_id = sp.id
       JOIN organizations o ON o.subscription_plan_id = sp.id
       WHERE o.id = $1 AND pff.flag_key = $2`,
      [(profile as any).organization_id, feature]
    )

    if (flags.length > 0) {
      const f = flags[0] as any
      if (f.flag_type === 'boolean') {
        return f.flag_value === true || f.flag_value === 'true'
      }
    }
  }

  // Fallback to defaults
  return PLAN_DEFAULTS[planType]?.[feature] ?? false
}
