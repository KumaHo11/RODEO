import { serviceQueryOne, serviceQuery } from '@/lib/db'

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
  // ── Metrics Module (v22) ────────────────────────────────────────────────────
  | 'metrics_module'       // Satellite metrics dashboard (NDVI, EVI, SAVI, NDMI, BSI, fCover)
  | 'deforestation_guard'  // EUDR deforestation detection + map overlay
  | 'animal_registry'      // Individual animal tracking + RFID/Bluetooth (v23)
  | 'polygon_import'
  | 'time_machine'
  | 'compliance_dashboard'
  | 'mrv_reports'
  | 'alert_engine'
  | 'rfid_bluetooth'
  | 'carbon_accounting'

const PLAN_DEFAULTS: Record<string, Record<string, boolean>> = {
  BROTE: {
    ndvi_access:        false,
    ai_insights:        false,
    offline_mode:       false,
    voice_bitacora:     false,
    advanced_reports:   false,
    api_access:         false,
    carbon_module:      false,
    grazing_planner:    false,
    tareas:             false,
    equipo:             false,
    agenda:             true,
    clima:              true,
    map:                true,
    metrics_module:     false,
    deforestation_guard:false,
    animal_registry:    false,
    polygon_import:     true,
    time_machine:       false,
    compliance_dashboard: false,
    mrv_reports:        false,
    alert_engine:       false,
    rfid_bluetooth:     false,
    carbon_accounting:  false,
  },
  PLANIFICADOR: {
    ndvi_access:        false,
    ai_insights:        false,
    offline_mode:       false,
    voice_bitacora:     true,
    advanced_reports:   false,
    api_access:         false,
    carbon_module:      false,
    grazing_planner:    true,
    tareas:             true,
    equipo:             true,
    agenda:             true,
    clima:              true,
    map:                true,
    metrics_module:     false,
    deforestation_guard:false,
    animal_registry:    false,
    polygon_import:     true,
    time_machine:       false,
    compliance_dashboard: false,
    mrv_reports:        false,
    alert_engine:       false,
    rfid_bluetooth:     false,
    carbon_accounting:  false,
  },
  HOLISTICO: {
    ndvi_access:        false,
    ai_insights:        true,
    offline_mode:       true,
    voice_bitacora:     true,
    advanced_reports:   true,
    api_access:         false,
    carbon_module:      true,
    grazing_planner:    true,
    tareas:             true,
    equipo:             true,
    agenda:             true,
    clima:              true,
    map:                true,
    metrics_module:     true,   // ✅ Metrics module from HOLISTICO+
    deforestation_guard:true,   // ✅ Deforestation Guard (EUDR compliance)
    animal_registry:    false,  // Animal registry requires LATIFUNDIO+
    polygon_import:     true,
    time_machine:       false,
    compliance_dashboard: false,
    mrv_reports:        false,
    alert_engine:       false,
    rfid_bluetooth:     false,
    carbon_accounting:  false,
  },
  LATIFUNDIO: {
    ndvi_access:        true,
    ai_insights:        true,
    offline_mode:       true,
    voice_bitacora:     true,
    advanced_reports:   true,
    api_access:         true,
    carbon_module:      true,
    grazing_planner:    true,
    tareas:             true,
    equipo:             true,
    agenda:             true,
    clima:              true,
    map:                true,
    metrics_module:     true,   // ✅ Full metrics module
    deforestation_guard:true,   // ✅ Full EUDR compliance
    animal_registry:    true,   // ✅ Individual animal tracking + RFID
    polygon_import:     true,
    time_machine:       true,
    compliance_dashboard: true,
    mrv_reports:        true,
    alert_engine:       true,
    rfid_bluetooth:     true,
    carbon_accounting:  true,
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
  const profile = await serviceQueryOne(
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
    const flags = await serviceQuery(
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
