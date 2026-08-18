-- v22: RODEO Metrics Module — metric_snapshots, metric_trends, metric_subscriptions, deforestation_checks

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. metric_snapshots
--    Stores each satellite / computed measurement per paddock.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE metric_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    paddock_id      UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    metric_type     VARCHAR(50) NOT NULL CHECK (metric_type IN (
                        'NDVI','EVI','SAVI','FCOVER','SOC_ESTIMATED','BIOMASS',
                        'NDMI','SOIL_MOISTURE','PRECIPITATION','DROUGHT_INDEX',
                        'BSI','DEFORESTATION_GUARD','COMPACTION_PROXY',
                        'SPECTRAL_HETEROGENEITY','PHENOLOGY','OCCUPATION_REST_RATIO'
                    )),
    value           DECIMAL(10,4) NOT NULL,
    unit            VARCHAR(30),
    capture_date    DATE NOT NULL,
    source          VARCHAR(50) NOT NULL CHECK (source IN (
                        'sentinel-2-l2a','sentinel-1-sar','open-meteo',
                        'gemini-vision','calculated','field-sample','estimated'
                    )),
    scene_id        VARCHAR(200),
    cloud_cover     DECIMAL(5,2),
    confidence      VARCHAR(20) DEFAULT 'HIGH' CHECK (confidence IN ('HIGH','MEDIUM','LOW','ESTIMATED')),
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metric_snapshots_org_paddock_type_date
    ON metric_snapshots (org_id, paddock_id, metric_type, capture_date DESC);

CREATE INDEX idx_metric_snapshots_date_type
    ON metric_snapshots (capture_date, metric_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. metric_trends
--    Pre-computed time-series aggregates (monthly / quarterly / yearly).
--    paddock_id is nullable: NULL means a whole-farm aggregate.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE metric_trends (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
    paddock_id          UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    metric_type         VARCHAR(50),
    period              VARCHAR(20) CHECK (period IN ('monthly','quarterly','yearly')),
    period_start        DATE,
    period_end          DATE,
    avg_value           DECIMAL(10,4),
    min_value           DECIMAL(10,4),
    max_value           DECIMAL(10,4),
    trend_direction     VARCHAR(10) CHECK (trend_direction IN ('improving','stable','declining')),
    pct_change          DECIMAL(8,4),
    data_points         INT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, paddock_id, metric_type, period, period_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. metric_subscriptions
--    Which metrics each org has enabled, with alert thresholds.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE metric_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE,
    metric_type             VARCHAR(50) NOT NULL,
    enabled                 BOOLEAN DEFAULT true,
    frequency               VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','biweekly','monthly')),
    alert_threshold_low     DECIMAL(10,4),
    alert_threshold_high    DECIMAL(10,4),
    baseline_date           DATE,
    contracted_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, metric_type)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. deforestation_checks
--    EUDR Deforestation Guard results per paddock.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE deforestation_checks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
    paddock_id          UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    status              VARCHAR(20) NOT NULL CHECK (status IN ('CLEAN','AT_RISK','DEFORESTED','PENDING','ERROR')),
    confidence          VARCHAR(10) CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
    baseline_ndvi       DECIMAL(6,4),
    current_ndvi        DECIMAL(6,4),
    ndvi_drop           DECIMAL(6,4),
    baseline_bsi        DECIMAL(6,4),
    current_bsi         DECIMAL(6,4),
    bsi_increase        DECIMAL(6,4),
    checked_at          TIMESTAMPTZ DEFAULT NOW(),
    evidence_urls       TEXT[],
    override_status     VARCHAR(20) CHECK (override_status IN ('CLEAN','AT_RISK','DEFORESTED')),
    override_reason     TEXT,
    overridden_by       UUID REFERENCES profiles(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, paddock_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE metric_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_trends         ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deforestation_checks  ENABLE ROW LEVEL SECURITY;

-- metric_snapshots
CREATE POLICY "Users view metric_snapshots in their org"
    ON metric_snapshots FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage metric_snapshots in their org"
    ON metric_snapshots FOR ALL
    USING (org_id = get_user_org_id());

-- metric_trends
CREATE POLICY "Users view metric_trends in their org"
    ON metric_trends FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage metric_trends in their org"
    ON metric_trends FOR ALL
    USING (org_id = get_user_org_id());

-- metric_subscriptions
CREATE POLICY "Users view metric_subscriptions in their org"
    ON metric_subscriptions FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage metric_subscriptions in their org"
    ON metric_subscriptions FOR ALL
    USING (org_id = get_user_org_id());

-- deforestation_checks
CREATE POLICY "Users view deforestation_checks in their org"
    ON deforestation_checks FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage deforestation_checks in their org"
    ON deforestation_checks FOR ALL
    USING (org_id = get_user_org_id());

CREATE POLICY "Service role bypass deforestation"
    ON deforestation_checks FOR ALL
    TO rodeo_service
    USING (true)
    WITH CHECK (true);
