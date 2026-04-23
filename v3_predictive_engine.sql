-- ============================================================
-- RODEO — Migration v3: Predictive & Financial Engine
-- ============================================================

-- 1. Market Prices
CREATE TABLE IF NOT EXISTS market_prices (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    category    TEXT        NOT NULL, -- e.g., 'Vaca Refugo', 'Ternero', 'Maíz', 'Rollo'
    price_ars   DECIMAL(12,2) NOT NULL,
    unit        TEXT        NOT NULL DEFAULT 'KG_VIVO', -- 'KG_VIVO', 'TON', 'UNIDAD'
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE, -- Optional: custom prices per org
    source      TEXT        DEFAULT 'MAG' -- 'MAG', 'Manual', 'Cereales'
);

-- 2. NDVI Logs (Satellite History)
CREATE TABLE IF NOT EXISTS ndvi_logs (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    paddock_id  UUID        NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    ndvi_value  DECIMAL(6,4) NOT NULL,
    recorded_at DATE        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add WUE (Water Use Efficiency) to Paddocks technical data if not present
-- This will be a coefficient: kg MS / ha / mm rain
-- We store it in technical_data JSONB, but we can initialize a default.
UPDATE paddocks 
SET technical_data = technical_data || '{"wue_coefficient": 15.0}'::jsonb
WHERE technical_data->>'wue_coefficient' IS NULL;

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_market_prices_category ON market_prices(category);
CREATE INDEX IF NOT EXISTS idx_ndvi_logs_paddock ON ndvi_logs(paddock_id);
CREATE INDEX IF NOT EXISTS idx_ndvi_logs_date ON ndvi_logs(recorded_at);
