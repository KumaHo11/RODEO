-- v25: Carbon Accounting — Huella de carbono por potrero y estancia

-- Tabla principal de estimaciones de carbono por potrero × mes
CREATE TABLE IF NOT EXISTS carbon_estimates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    paddock_id      UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    period_month    DATE NOT NULL,      -- primer día del mes, ej. 2026-08-01
    
    -- Emisiones ganaderas (Scope 1 directo)
    head_count      INTEGER,            -- cabezas promedio en el potrero ese mes (de animal_events MOVIMIENTO)
    days_in_paddock NUMERIC(8,2),       -- días-animal totales en el potrero ese mes
    ch4_enteric_kg  NUMERIC(12,4),      -- kg CH4 fermentación entérica (IPCC Tier 1)
    ch4_manure_kg   NUMERIC(12,4),      -- kg CH4 manejo de estiércol
    n2o_manure_kg   NUMERIC(12,4),      -- kg N2O estiércol en pastoreo
    
    -- Remociones satelitales (SOC proxy)
    soc_proxy       NUMERIC(8,4),       -- SOC_ESTIMATED del último snapshot del mes
    ndvi_mean       NUMERIC(8,4),       -- NDVI promedio del mes
    biomass_above_t NUMERIC(12,4),      -- Biomasa aérea estimada (t/ha)
    paddock_ha      NUMERIC(10,2),      -- Área del potrero en hectáreas
    
    -- Balance final
    gross_emissions_tco2e  NUMERIC(12,4),  -- Emisiones brutas (CH4 + N2O → CO2e, GWP100)
    soc_sequestration_tco2e NUMERIC(12,4), -- Secuestro de SOC estimado (tCO2e)
    net_balance_tco2e      NUMERIC(12,4),  -- Balance neto: emisiones - secuestro
    
    -- Metadata
    methodology     VARCHAR(50) DEFAULT 'IPCC_TIER1_SOC_PROXY',
    confidence      VARCHAR(20) DEFAULT 'MEDIUM' CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (org_id, paddock_id, period_month)
);

CREATE INDEX idx_carbon_estimates_org_period ON carbon_estimates (org_id, period_month);
CREATE INDEX idx_carbon_estimates_paddock_period ON carbon_estimates (paddock_id, period_month);

ALTER TABLE carbon_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their carbon estimates"
    ON carbon_estimates FOR ALL
    USING (org_id = get_user_org_id());
