-- ============================================================
-- RODEO — Pricing Strategy Migration v1
-- Implementa los 4 planes definitivos (Brote, Planificador,
-- Holístico, Latifundio) con trial de 45 días configurable.
-- No destructivo: usa ON CONFLICT para no pisar datos existentes.
-- ============================================================

-- ── 1. Agregar trial_days a subscriptions_plans ───────────────────────────
ALTER TABLE subscriptions_plans
  ADD COLUMN IF NOT EXISTS trial_days INT DEFAULT 0;

-- ── 2. Desactivar planes viejos (no eliminar, preservar historial) ─────────
UPDATE subscriptions_plans
  SET is_active = false
  WHERE slug IN ('campo_libre', 'pro_ganadero', 'pro_ganadero+');

-- ── 3. Insertar los 4 planes definitivos ──────────────────────────────────
INSERT INTO subscriptions_plans
  (name, slug, price, price_yearly, description, color, is_popular, sort_order,
   paddocks_limit, herds_limit, has_ai_analysis, trial_days, is_active)
VALUES
  (
    'Brote',       'brote',
    0,             0,
    'Para empezar a digitalizar tu campo. Gratis para siempre.',
    '#6B7280',     false, 1, 5, 1, false, 0, true
  ),
  (
    'Planificador', 'planificador',
    79,            65,
    'Para el productor comercial que quiere digitalizar su gestión diaria.',
    '#22C55E',     false, 2, -1, -1, false, 45, true
  ),
  (
    'Holístico',   'holistico',
    199,           165,
    'Para el productor regenerativo con IA, Savory y satélite.',
    '#16A34A',     true,  3, -1, -1, true,  45, true
  ),
  (
    'Latifundio',  'latifundio',
    0,             0,
    'Para grupos inversores y campos corporativos. Precio a medida.',
    '#111827',     false, 4, -1, -1, true,  45, true
  )
ON CONFLICT (slug) DO UPDATE SET
  name             = EXCLUDED.name,
  price            = EXCLUDED.price,
  price_yearly     = EXCLUDED.price_yearly,
  description      = EXCLUDED.description,
  color            = EXCLUDED.color,
  is_popular       = EXCLUDED.is_popular,
  sort_order       = EXCLUDED.sort_order,
  paddocks_limit   = EXCLUDED.paddocks_limit,
  herds_limit      = EXCLUDED.herds_limit,
  has_ai_analysis  = EXCLUDED.has_ai_analysis,
  trial_days       = EXCLUDED.trial_days,
  is_active        = EXCLUDED.is_active,
  updated_at       = NOW();

-- ── 4. Feature Flags: Brote (plan libre) ─────────────────────────────────
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '20',     'Máx. potreros',              'number'),
  ('max_herds',        '1',      'Máx. rodeos',                'number'),
  ('max_team_members', '1',      'Miembros de equipo',         'number'),
  ('map',              'true',   'Mapa de campo + potreros',   'boolean'),
  ('clima',            'true',   'Módulo clima y alertas',     'boolean'),
  ('agenda',           'true',   'Agenda / eventos',           'boolean'),
  ('grazing_planner',  'false',  'Planificador de pastoreo',   'boolean'),
  ('tareas',           'false',  'Gestión de tareas',          'boolean'),
  ('equipo',           'false',  'Gestión de equipo',          'boolean'),
  ('voice_bitacora',   'false',  'Bitácora de voz + IA',       'boolean'),
  ('ai_insights',      'false',  'Insights IA (Gemini)',       'boolean'),
  ('advanced_reports', 'false',  'Reportes avanzados',         'boolean'),
  ('carbon_module',    'false',  'Módulo Carbono (MRV)',       'boolean'),
  ('offline_mode',     'false',  'App móvil offline',          'boolean'),
  ('ndvi_access',      'false',  'NDVI satelital (Sentinel)',  'boolean'),
  ('api_access',       'false',  'Acceso API corporativa',     'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'brote'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET
  flag_value = EXCLUDED.flag_value,
  label      = EXCLUDED.label;

-- ── 5. Feature Flags: Planificador ───────────────────────────────────────
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '-1',     'Máx. potreros (ilimitado)',  'number'),
  ('max_herds',        '5',      'Máx. rodeos',                'number'),
  ('max_team_members', '3',      'Miembros de equipo',         'number'),
  ('map',              'true',   'Mapa de campo + potreros',   'boolean'),
  ('clima',            'true',   'Módulo clima y alertas',     'boolean'),
  ('agenda',           'true',   'Agenda / eventos',           'boolean'),
  ('grazing_planner',  'true',   'Planificador de pastoreo',   'boolean'),
  ('tareas',           'true',   'Gestión de tareas',          'boolean'),
  ('equipo',           'true',   'Gestión de equipo',          'boolean'),
  ('voice_bitacora',   'false',  'Bitácora de voz + IA',       'boolean'),
  ('ai_insights',      'false',  'Insights IA (Gemini)',       'boolean'),
  ('advanced_reports', 'false',  'Reportes avanzados',         'boolean'),
  ('carbon_module',    'false',  'Módulo Carbono (MRV)',       'boolean'),
  ('offline_mode',     'true',   'App móvil offline',          'boolean'),
  ('ndvi_access',      'false',  'NDVI satelital (Sentinel)',  'boolean'),
  ('api_access',       'false',  'Acceso API corporativa',     'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'planificador'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET
  flag_value = EXCLUDED.flag_value,
  label      = EXCLUDED.label;

-- ── 6. Feature Flags: Holístico ───────────────────────────────────────────
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '-1',     'Máx. potreros (ilimitado)',  'number'),
  ('max_herds',        '-1',     'Máx. rodeos (ilimitado)',    'number'),
  ('max_team_members', '-1',     'Miembros de equipo',         'number'),
  ('map',              'true',   'Mapa de campo + potreros',   'boolean'),
  ('clima',            'true',   'Módulo clima y alertas',     'boolean'),
  ('agenda',           'true',   'Agenda / eventos',           'boolean'),
  ('grazing_planner',  'true',   'Planificador de pastoreo',   'boolean'),
  ('tareas',           'true',   'Gestión de tareas',          'boolean'),
  ('equipo',           'true',   'Gestión de equipo',          'boolean'),
  ('voice_bitacora',   'true',   'Bitácora de voz + IA',       'boolean'),
  ('ai_insights',      'true',   'Insights IA (Gemini)',       'boolean'),
  ('advanced_reports', 'true',   'Reportes avanzados',         'boolean'),
  ('carbon_module',    'false',  'Módulo Carbono (MRV)',       'boolean'),
  ('offline_mode',     'true',   'App móvil offline',          'boolean'),
  ('ndvi_access',      'true',   'NDVI satelital (Sentinel)',  'boolean'),
  ('api_access',       'false',  'Acceso API corporativa',     'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'holistico'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET
  flag_value = EXCLUDED.flag_value,
  label      = EXCLUDED.label;

-- ── 7. Feature Flags: Latifundio (todo habilitado) ───────────────────────
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '-1',    'Máx. potreros (ilimitado)',   'number'),
  ('max_herds',        '-1',    'Máx. rodeos (ilimitado)',     'number'),
  ('max_team_members', '-1',    'Miembros de equipo',          'number'),
  ('map',              'true',  'Mapa de campo + potreros',    'boolean'),
  ('clima',            'true',  'Módulo clima y alertas',      'boolean'),
  ('agenda',           'true',  'Agenda / eventos',            'boolean'),
  ('grazing_planner',  'true',  'Planificador de pastoreo',    'boolean'),
  ('tareas',           'true',  'Gestión de tareas',           'boolean'),
  ('equipo',           'true',  'Gestión de equipo',           'boolean'),
  ('voice_bitacora',   'true',  'Bitácora de voz + IA',        'boolean'),
  ('ai_insights',      'true',  'Insights IA (Gemini)',        'boolean'),
  ('advanced_reports', 'true',  'Reportes avanzados',          'boolean'),
  ('carbon_module',    'true',  'Módulo Carbono (MRV)',        'boolean'),
  ('offline_mode',     'true',  'App móvil offline',           'boolean'),
  ('ndvi_access',      'true',  'NDVI satelital (Sentinel)',   'boolean'),
  ('api_access',       'true',  'Acceso API corporativa',      'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'latifundio'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET
  flag_value = EXCLUDED.flag_value,
  label      = EXCLUDED.label;

-- ── 8. Audit log de la migración ──────────────────────────────────────────
INSERT INTO audit_logs (actor_email, action, entity_type, new_value)
VALUES (
  'system@rodeo.ag',
  'PRICING_STRATEGY_MIGRATION_V1',
  'system',
  '{"plans": ["brote","planificador","holistico","latifundio"], "trial_days": 45}'::jsonb
);

-- ── Verificación ──────────────────────────────────────────────────────────
SELECT
  sp.name,
  sp.slug,
  sp.price        AS "$/mes",
  sp.price_yearly AS "$/mes anual",
  sp.trial_days   AS "días trial",
  COUNT(pff.id)   AS "num flags"
FROM subscriptions_plans sp
LEFT JOIN plan_feature_flags pff ON pff.plan_id = sp.id
WHERE sp.slug IN ('brote','planificador','holistico','latifundio')
GROUP BY sp.id, sp.name, sp.slug, sp.price, sp.price_yearly, sp.trial_days
ORDER BY sp.sort_order;
