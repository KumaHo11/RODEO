/**
 * GET /api/admin/run-migrations
 * Runs critical DB schema fixes directly on production DB
 * Protected: requires X-Migration-Secret header
 * DELETE THIS FILE AFTER USE
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServicePool } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'rodeo-migration-2026'

const MIGRATIONS = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // Fix UUID defaults on ALL tables
  `DO $$ DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
      'audit_logs','biological_monitoring','climate_projections','farm_events',
      'field_notes','grazing_plan_entries','grazing_plans','herds','invitations',
      'movements','notifications','organizations','paddocks','payments',
      'plan_feature_flags','profiles','rainfall_logs','subscriptions_plans',
      'system_feature_flags','tasks','terms_and_conditions_versions',
      'user_terms_acceptances','weather_events'
    ];
  BEGIN
    FOREACH tbl IN ARRAY tables LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=tbl
          AND column_name='id' AND data_type='uuid'
          AND column_default IS NULL
      ) THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', tbl);
        RAISE NOTICE 'UUID default set on: %', tbl;
      END IF;
    END LOOP;
  END $$`,

  // farm_events missing columns
  `ALTER TABLE farm_events
    ADD COLUMN IF NOT EXISTS herd_id         UUID REFERENCES herds(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS herd_ids        JSONB,
    ADD COLUMN IF NOT EXISTS paddock_id      UUID REFERENCES paddocks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS description     TEXT,
    ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'SCHEDULED',
    ADD COLUMN IF NOT EXISTS assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bulls_count     INTEGER,
    ADD COLUMN IF NOT EXISTS bulls_weight    NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'agenda',
    ADD COLUMN IF NOT EXISTS photo_url       TEXT,
    ADD COLUMN IF NOT EXISTS audio_url       TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS end_date        DATE`,

  // notifications missing columns
  `ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS body        TEXT,
    ADD COLUMN IF NOT EXISTS entity_id   UUID,
    ADD COLUMN IF NOT EXISTS entity_type TEXT,
    ADD COLUMN IF NOT EXISTS is_read     BOOLEAN DEFAULT false`,
]

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pool = getServicePool()
  const client = await pool.connect()
  const results: { sql: string; ok: boolean; error?: string }[] = []

  try {
    for (const sql of MIGRATIONS) {
      try {
        await client.query(sql)
        results.push({ sql: sql.slice(0, 80) + '...', ok: true })
      } catch (err: any) {
        results.push({ sql: sql.slice(0, 80) + '...', ok: false, error: err.message })
      }
    }

    // Verify UUID defaults
    const verifyRes = await client.query(`
      SELECT table_name, column_default
      FROM information_schema.columns
      WHERE column_name = 'id' AND data_type = 'uuid' AND table_schema = 'public'
      ORDER BY table_name
    `)
    const withDefault = verifyRes.rows.filter(r => r.column_default?.includes('gen_random_uuid'))
    const withoutDefault = verifyRes.rows.filter(r => !r.column_default?.includes('gen_random_uuid'))

    // Verify farm_events columns
    const farmEventsRes = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'farm_events' AND table_schema = 'public'
      ORDER BY column_name
    `)
    
    return NextResponse.json({
      ok: true,
      migrations: results,
      uuid_defaults: {
        fixed: withDefault.map(r => r.table_name),
        missing: withoutDefault.map(r => r.table_name),
      },
      farm_events_columns: farmEventsRes.rows.map(r => r.column_name),
    })
  } finally {
    client.release()
  }
}
