-- ============================================================
-- v21_season_plans.sql
-- Creación de la tabla season_plans (histórico de planes forrajeros)
-- ============================================================

CREATE TABLE IF NOT EXISTS season_plans (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  season_type             VARCHAR(50) DEFAULT 'cerrado',
  year                    INT         NOT NULL,
  start_date              DATE,
  end_date                DATE,
  no_growth_from          DATE,
  no_growth_to            DATE,
  drought_reserve_days    INT         DEFAULT 0,
  daily_allocation_kg     DECIMAL(8,2) DEFAULT 12,
  cell_name               TEXT,
  total_ha                DECIMAL(10,2),
  source                  TEXT        DEFAULT 'manual'
    CHECK (source IN ('manual', 'excel_import', 'suggested')),
  source_filename         TEXT,
  status                  VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  demand_snapshot         JSONB,
  supply_snapshot         JSONB,
  metrics                 JSONB       DEFAULT '{}',
  notes                   TEXT,
  created_by              UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index on org_id + year for fast lookups
CREATE INDEX IF NOT EXISTS idx_season_plans_org_year ON season_plans(org_id, year);
CREATE INDEX IF NOT EXISTS idx_season_plans_org_status ON season_plans(org_id, status);

-- Enable RLS
ALTER TABLE season_plans ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'season_plans' AND policyname = 'season_plans_tenant_isolation'
  ) THEN
    CREATE POLICY season_plans_tenant_isolation ON season_plans
      FOR ALL USING (
        org_id::text = NULLIF(current_setting('request.jwt.claim.org_id', true), '')
      );
  END IF;
END $$;

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE season_plans TO rodeo_app;
GRANT ALL PRIVILEGES ON TABLE season_plans TO rodeo_service;
