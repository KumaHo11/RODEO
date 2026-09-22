-- v26_whatsapp_feature_flags.sql
-- Feature flagging para el módulo de Bitácora por WhatsApp.
-- Cubre:
--   1. Override por tenant (organization): anula el plan cuando el SuperAdmin lo fuerza.
--   2. Permiso por perfil (profile): el Admin de campo puede bloquear WA a un miembro.

SET search_path TO public;

-- ── 1. Override de módulo WhatsApp por tenant (organization) ─────────────────
--  NULL  → hereda el flag del plan activo (has_feature 'whatsapp_bitacora').
--  TRUE  → forzado ON  por el SuperAdmin (modo prueba / beneficio exclusivo).
--  FALSE → forzado OFF por el SuperAdmin (suspensión, downgrade manual).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.organizations.whatsapp_enabled IS
  'Override manual del módulo WhatsApp por tenant. NULL = hereda del plan.';

-- ── 2. Permiso por miembro (profile) ────────────────────────────────────────
--  TRUE  (default) → el miembro puede usar WA para la bitácora.
--  FALSE           → el Admin del campo revocó el acceso WA de este miembro.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_bitacora_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.profiles.whatsapp_bitacora_enabled IS
  'Flag individual: el Admin de campo puede deshabilitar WA para un miembro específico.';

-- Index liviano para el webhook (lookup selectivo de miembros bloqueados)
CREATE INDEX IF NOT EXISTS idx_profiles_wa_disabled
  ON public.profiles(whatsapp_bitacora_enabled)
  WHERE whatsapp_bitacora_enabled = FALSE;
