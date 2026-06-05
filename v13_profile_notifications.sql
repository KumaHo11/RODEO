-- ============================================================
-- RODEO — Migración: Notificaciones de Perfil
-- Agrega preferencias de notificaciones a los perfiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"reminders": true, "weekly_summary": true}'::jsonb;

-- Verificación
SELECT id, email, notification_preferences FROM profiles LIMIT 5;
