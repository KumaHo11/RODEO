-- ============================================================
-- RODEO V2.0 — Migración incremental (safe to re-run)
-- ============================================================

-- Tabla de notificaciones (si no existe)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'ALERTA',
  title       TEXT        NOT NULL,
  body        TEXT,
  is_read     BOOLEAN     DEFAULT false,
  related_id  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org   ON notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_id) WHERE related_id IS NOT NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
  FOR ALL USING (
    user_id = (SELECT id FROM profiles WHERE firebase_uid = gen_random_uuid() LIMIT 1)
  );

-- Completado
SELECT 'V2.0 migration complete' AS status;
