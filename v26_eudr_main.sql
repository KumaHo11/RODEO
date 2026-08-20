-- v26_eudr_main.sql
-- PARTE rodeo_service: tablas nuevas + vista + RLS.
-- La parte de ALTER TABLE paddocks se hace via v26_paddocks_eudr_columns.sql (requiere postgres).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. eudr_documents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eudr_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_type            VARCHAR(50) NOT NULL CHECK (doc_type IN (
                            'TITLE_DEED', 'LEASE_CONTRACT', 'ENVIRONMENTAL_PERMIT',
                            'DTE', 'ORIGIN_CERTIFICATE', 'FISCAL_CERTIFICATE',
                            'FEED_INVOICE', 'DEFORESTATION_AUDIT', 'OTHER'
                        )),
    paddock_id          UUID REFERENCES paddocks(id) ON DELETE SET NULL,
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(255),
    file_hash           VARCHAR(64),
    file_size_bytes     BIGINT,
    issued_date         DATE,
    expiry_date         DATE,
    issuer              VARCHAR(255),
    reference_number    VARCHAR(100),
    verified            BOOLEAN DEFAULT false,
    verified_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at         TIMESTAMPTZ,
    notes               TEXT,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eudr_documents_org      ON eudr_documents (org_id);
CREATE INDEX IF NOT EXISTS idx_eudr_documents_org_type ON eudr_documents (org_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_eudr_documents_paddock  ON eudr_documents (paddock_id) WHERE paddock_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eudr_documents_expiry   ON eudr_documents (expiry_date) WHERE expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. feed_batches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_batches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feed_type           VARCHAR(50) NOT NULL CHECK (feed_type IN (
                            'SOJA', 'MAIZ', 'SORGO', 'ALFALFA', 'SILAJE',
                            'NUCLEO_MINERAL', 'BALANCEADO', 'HENO', 'OTRO'
                        )),
    supplier_name       VARCHAR(255),
    supplier_cuit       VARCHAR(20),
    supplier_country    CHAR(3) DEFAULT 'ARG',
    eudr_compliant      BOOLEAN DEFAULT false,
    compliance_cert_url TEXT,
    invoice_url         TEXT,
    invoice_hash        VARCHAR(64),
    lot_number          VARCHAR(100),
    quantity_kg         NUMERIC(12, 2),
    received_date       DATE NOT NULL,
    expiry_date         DATE,
    herd_ids            UUID[],
    paddock_ids         UUID[],
    notes               TEXT,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_batches_org      ON feed_batches (org_id);
CREATE INDEX IF NOT EXISTS idx_feed_batches_org_type ON feed_batches (org_id, feed_type);
CREATE INDEX IF NOT EXISTS idx_feed_batches_received ON feed_batches (org_id, received_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. eudr_dds_submissions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eudr_dds_submissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    submission_type     VARCHAR(20) NOT NULL CHECK (submission_type IN ('TRACES_NT', 'VISEC', 'MANUAL_PDF')),
    animal_ids          UUID[],
    herd_ids            UUID[],
    paddock_ids         UUID[],
    geojson_url         TEXT,
    pdf_url             TEXT,
    pdf_hash            VARCHAR(64),
    payload             JSONB NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                            'DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'
                        )),
    external_ref        VARCHAR(100),
    rejection_reason    TEXT,
    submitted_at        TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    response_data       JSONB,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eudr_dds_org_status  ON eudr_dds_submissions (org_id, status);
CREATE INDEX IF NOT EXISTS idx_eudr_dds_org_created ON eudr_dds_submissions (org_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Vista: animal_custody_timeline
--    Nota: usa eudr_area_ha y eudr_geom_type de paddocks — esas columnas
--    deben existir ANTES de crear esta vista (v26_paddocks_eudr_columns.sql)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW animal_custody_timeline AS
SELECT
    ae.animal_id,
    a.rfid_code,
    a.visual_tag,
    a.org_id,
    'ANIMAL_EVENT'              AS source_type,
    ae.event_type               AS event_name,
    ae.event_date               AS occurred_at,
    ae.details,
    p.id                        AS paddock_id,
    p.name                      AS paddock_name,
    p.eudr_area_ha,
    p.eudr_geom_type,
    p.eudr_validated_at,
    dc.status                   AS deforestation_status,
    dc.confidence               AS deforestation_confidence,
    dc.checked_at               AS deforestation_checked_at
FROM animal_events ae
JOIN animals a         ON a.id = ae.animal_id
LEFT JOIN paddocks p   ON p.id = (ae.details->>'paddock_id')::UUID
LEFT JOIN deforestation_checks dc ON dc.paddock_id = p.id

UNION ALL

SELECT
    a.id                        AS animal_id,
    a.rfid_code,
    a.visual_tag,
    a.org_id,
    'GRAZING_PLAN'              AS source_type,
    'PASTOREO'                  AS event_name,
    COALESCE(gp.actual_entry_date::TIMESTAMPTZ, gp.entry_date::TIMESTAMPTZ) AS occurred_at,
    jsonb_build_object(
        'paddock_id',   gp.paddock_id,
        'paddock_name', p.name,
        'entry',        COALESCE(gp.actual_entry_date, gp.entry_date),
        'exit',         COALESCE(gp.actual_exit_date, gp.exit_date),
        'days',         (COALESCE(gp.actual_exit_date, gp.exit_date) - COALESCE(gp.actual_entry_date, gp.entry_date)),
        'status',       gp.status,
        'cycle_id',     gp.cycle_id
    )                           AS details,
    p.id                        AS paddock_id,
    p.name                      AS paddock_name,
    p.eudr_area_ha,
    p.eudr_geom_type,
    p.eudr_validated_at,
    dc.status                   AS deforestation_status,
    dc.confidence               AS deforestation_confidence,
    dc.checked_at               AS deforestation_checked_at
FROM grazing_plans gp
JOIN paddocks p ON p.id = gp.paddock_id
JOIN herds h ON h.id = gp.herd_id
JOIN animals a ON (a.current_herd_id = h.id OR a.org_id = gp.org_id)
LEFT JOIN deforestation_checks dc ON dc.paddock_id = p.id
WHERE gp.status IN ('COMPLETED', 'ACTIVE', 'HISTORY', 'CANCELLED');

COMMENT ON VIEW animal_custody_timeline IS
'Línea de vida consolidada por animal. Combina animal_events y grazing_plans.
Usar para reconstruir la cadena de custodia EUDR.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE eudr_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eudr_dds_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- eudr_documents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eudr_documents' AND policyname='Users view eudr_documents in their org') THEN
        CREATE POLICY "Users view eudr_documents in their org"
            ON eudr_documents FOR SELECT USING (org_id = get_user_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eudr_documents' AND policyname='Users manage eudr_documents in their org') THEN
        CREATE POLICY "Users manage eudr_documents in their org"
            ON eudr_documents FOR ALL USING (org_id = get_user_org_id());
    END IF;
    -- feed_batches
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feed_batches' AND policyname='Users view feed_batches in their org') THEN
        CREATE POLICY "Users view feed_batches in their org"
            ON feed_batches FOR SELECT USING (org_id = get_user_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feed_batches' AND policyname='Users manage feed_batches in their org') THEN
        CREATE POLICY "Users manage feed_batches in their org"
            ON feed_batches FOR ALL USING (org_id = get_user_org_id());
    END IF;
    -- eudr_dds_submissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eudr_dds_submissions' AND policyname='Users view eudr_dds in their org') THEN
        CREATE POLICY "Users view eudr_dds in their org"
            ON eudr_dds_submissions FOR SELECT USING (org_id = get_user_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eudr_dds_submissions' AND policyname='Users manage eudr_dds in their org') THEN
        CREATE POLICY "Users manage eudr_dds in their org"
            ON eudr_dds_submissions FOR ALL USING (org_id = get_user_org_id());
    END IF;
END $$;

SELECT 'OK: tablas EUDR creadas exitosamente' as result;
