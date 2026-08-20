-- v26: EUDR Compliance Module
-- Reglamento UE 2023/1115 — Due Diligence Statements, TRACES-NT, VISEC
--
-- Prerequisitos: v22 (metric_snapshots, deforestation_checks), v23 (animals, animal_events)
-- Bucket GCS para documentos: rodeo-eudr-docs (separado de rodeo-media)
--   → Set env var: GCS_EUDR_BUCKET_NAME=rodeo-eudr-docs (prod) / rodeo-eudr-docs-staging (staging)
--   → IAM: Cloud Run SA necesita roles/storage.objectAdmin en ese bucket

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. eudr_documents
--    Bóveda documental legal por organización/potrero.
--    Todos los uploads pasan por /api/upload (server-side) usando GCS_EUDR_BUCKET_NAME.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE eudr_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_type            VARCHAR(50) NOT NULL CHECK (doc_type IN (
                            'TITLE_DEED',           -- Título de propiedad / Escritura
                            'LEASE_CONTRACT',       -- Contrato de arrendamiento
                            'ENVIRONMENTAL_PERMIT', -- Permiso ambiental / Habilitación
                            'DTE',                  -- Guía de Traslado Electrónica
                            'ORIGIN_CERTIFICATE',   -- Certificado de origen SENASA
                            'FISCAL_CERTIFICATE',   -- Constancia AFIP / Monotributo
                            'FEED_INVOICE',         -- Remito de insumos (soja, etc.)
                            'DEFORESTATION_AUDIT',  -- Auditoría de deforestación externa
                            'OTHER'
                        )),
    paddock_id          UUID REFERENCES paddocks(id) ON DELETE SET NULL,  -- Vinculable a un potrero específico (nullable = nivel org)
    file_url            TEXT NOT NULL,              -- URL pública en GCS (rodeo-eudr-docs)
    file_name           VARCHAR(255),               -- Nombre original del archivo
    file_hash           VARCHAR(64),                -- SHA-256 del archivo para integridad
    file_size_bytes     BIGINT,
    issued_date         DATE,
    expiry_date         DATE,                       -- Para alertas de vencimiento
    issuer              VARCHAR(255),               -- Ente emisor (SENASA, Catastro, etc.)
    reference_number    VARCHAR(100),               -- Nro de expediente/documento
    verified            BOOLEAN DEFAULT false,
    verified_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at         TIMESTAMPTZ,
    notes               TEXT,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eudr_documents_org ON eudr_documents (org_id);
CREATE INDEX idx_eudr_documents_org_type ON eudr_documents (org_id, doc_type);
CREATE INDEX idx_eudr_documents_paddock ON eudr_documents (paddock_id) WHERE paddock_id IS NOT NULL;
CREATE INDEX idx_eudr_documents_expiry ON eudr_documents (expiry_date) WHERE expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. feed_batches
--    Trazabilidad de insumos suplementarios (soja, maíz, etc.)
--    Permite verificar que la dieta del rodeo es libre de deforestación.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE feed_batches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feed_type           VARCHAR(50) NOT NULL CHECK (feed_type IN (
                            'SOJA', 'MAIZ', 'SORGO', 'ALFALFA', 'SILAJE',
                            'NUCLEO_MINERAL', 'BALANCEADO', 'HENO', 'OTRO'
                        )),
    supplier_name       VARCHAR(255),
    supplier_cuit       VARCHAR(20),
    supplier_country    CHAR(3) DEFAULT 'ARG',
    eudr_compliant      BOOLEAN DEFAULT false,      -- Proveedor certifica libre de deforestación
    compliance_cert_url TEXT,                       -- Certificación del proveedor en GCS
    invoice_url         TEXT,                       -- Remito/factura en GCS
    invoice_hash        VARCHAR(64),
    lot_number          VARCHAR(100),               -- Número de lote del insumo
    quantity_kg         NUMERIC(12, 2),
    received_date       DATE NOT NULL,
    expiry_date         DATE,
    herd_ids            UUID[],                     -- Rodeos que consumieron este lote
    paddock_ids         UUID[],                     -- Potreros donde se suplementó
    notes               TEXT,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feed_batches_org ON feed_batches (org_id);
CREATE INDEX idx_feed_batches_org_type ON feed_batches (org_id, feed_type);
CREATE INDEX idx_feed_batches_received ON feed_batches (org_id, received_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. eudr_dds_submissions
--    Registro de Due Diligence Statements (DDS) generados y enviados.
--    Preserva el payload exacto para auditoría y re-envío.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE eudr_dds_submissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    submission_type     VARCHAR(20) NOT NULL CHECK (submission_type IN (
                            'TRACES_NT',    -- Plataforma oficial UE
                            'VISEC',        -- Plataforma sectorial Argentina
                            'MANUAL_PDF'    -- Exportación manual (dossier PDF)
                        )),
    -- Entidades incluidas en esta DDS
    animal_ids          UUID[],
    herd_ids            UUID[],
    paddock_ids         UUID[],
    -- Archivos generados
    geojson_url         TEXT,               -- URL del .geojson exportado en GCS
    pdf_url             TEXT,               -- URL del dossier PDF en GCS
    pdf_hash            VARCHAR(64),        -- SHA-256 del PDF para QR de verificación
    -- Payload completo
    payload             JSONB NOT NULL,     -- El JSON/GeoJSON exacto enviado
    -- Estado del ciclo de vida
    status              VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                            'DRAFT',        -- Generado pero no enviado
                            'SUBMITTED',    -- Enviado a la plataforma
                            'ACCEPTED',     -- Aceptado por la plataforma
                            'REJECTED',     -- Rechazado (ver rejection_reason)
                            'EXPIRED'       -- Expirado (DDS tiene validez temporal)
                        )),
    external_ref        VARCHAR(100),       -- Nro de referencia TRACES-NT o VISEC
    rejection_reason    TEXT,
    submitted_at        TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    response_data       JSONB,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eudr_dds_org_status ON eudr_dds_submissions (org_id, status);
CREATE INDEX idx_eudr_dds_org_created ON eudr_dds_submissions (org_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Columnas EUDR en paddocks (validación GIS)
--    eudr_area_ha: calculado desde PostGIS (más preciso que area_ha manual)
--    eudr_geom_type: 'POLYGON' (≥4ha) o 'POINT' (<4ha) según TRACES-NT
--    eudr_validated_at: última vez que se ejecutó la validación GIS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE paddocks
    ADD COLUMN IF NOT EXISTS eudr_area_ha        NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS eudr_geom_type      VARCHAR(10) CHECK (eudr_geom_type IN ('POLYGON', 'POINT', 'INVALID')),
    ADD COLUMN IF NOT EXISTS eudr_validated_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS eudr_notes          TEXT;

-- Función para recalcular las columnas EUDR de un paddock
CREATE OR REPLACE FUNCTION update_paddock_eudr_gis(p_paddock_id UUID)
RETURNS void AS $$
DECLARE
    v_area    NUMERIC;
    v_valid   BOOLEAN;
    v_type    VARCHAR(10);
BEGIN
    SELECT
        ST_Area(geom::geography) / 10000.0,  -- m² → ha
        ST_IsValid(geom)
    INTO v_area, v_valid
    FROM paddocks
    WHERE id = p_paddock_id AND geom IS NOT NULL;

    IF v_area IS NULL THEN
        -- Sin geometría aún — no actualizar
        RETURN;
    END IF;

    IF NOT v_valid THEN
        v_type := 'INVALID';
    ELSIF v_area >= 4.0 THEN
        v_type := 'POLYGON';  -- Requiere polígono completo en TRACES-NT
    ELSE
        v_type := 'POINT';    -- Puede usar coordenada centroide en TRACES-NT
    END IF;

    UPDATE paddocks SET
        eudr_area_ha      = v_area,
        eudr_geom_type    = v_type,
        eudr_validated_at = NOW()
    WHERE id = p_paddock_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: recalcular automáticamente cuando se actualiza la geometría
CREATE OR REPLACE FUNCTION trg_paddock_eudr_gis()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.geom IS DISTINCT FROM OLD.geom OR OLD.geom IS NULL THEN
        PERFORM update_paddock_eudr_gis(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paddock_eudr ON paddocks;
CREATE TRIGGER trg_paddock_eudr
    AFTER INSERT OR UPDATE OF geom ON paddocks
    FOR EACH ROW EXECUTE FUNCTION trg_paddock_eudr_gis();

-- Backfill inmediato para paddocks existentes con geometría
DO $$
DECLARE rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM paddocks WHERE geom IS NOT NULL LOOP
        PERFORM update_paddock_eudr_gis(rec.id);
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista: animal_custody_timeline
--    Consolida la línea de vida de cada animal desde grazing_plans + animal_events.
--    Fuente principal para reconstruir la cadena de custodia EUDR.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW animal_custody_timeline AS

-- Eventos individuales registrados en la bitácora del animal
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

-- Pastoreos registrados en grazing_plans (nivel rodeo → se expande a animales del rodeo)
SELECT
    a.id                        AS animal_id,
    a.rfid_code,
    a.visual_tag,
    a.org_id,
    'GRAZING_PLAN'              AS source_type,
    'PASTOREO'                  AS event_name,
    COALESCE(
        gp.actual_entry_date::TIMESTAMPTZ,
        gp.entry_date::TIMESTAMPTZ
    )                           AS occurred_at,
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
-- Expandir cada grazing_plan a los animales individuales que pertenecen a ese rodeo
JOIN animals a ON (
    a.current_herd_id = h.id
    OR a.org_id = gp.org_id  -- Fallback: animales de la org sin rodeo asignado
)
LEFT JOIN deforestation_checks dc ON dc.paddock_id = p.id
WHERE gp.status IN ('COMPLETED', 'ACTIVE', 'HISTORY', 'CANCELLED');

COMMENT ON VIEW animal_custody_timeline IS
'Línea de vida consolidada por animal. Combina animal_events y grazing_plans.
Usar para reconstruir la cadena de custodia EUDR: qué paddocks recorrió cada animal
y cuál era el estado de deforestación de cada uno.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE eudr_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eudr_dds_submissions ENABLE ROW LEVEL SECURITY;

-- eudr_documents
CREATE POLICY "Users view eudr_documents in their org"
    ON eudr_documents FOR SELECT
    USING (org_id = get_user_org_id());
CREATE POLICY "Users manage eudr_documents in their org"
    ON eudr_documents FOR ALL
    USING (org_id = get_user_org_id());

-- feed_batches
CREATE POLICY "Users view feed_batches in their org"
    ON feed_batches FOR SELECT
    USING (org_id = get_user_org_id());
CREATE POLICY "Users manage feed_batches in their org"
    ON feed_batches FOR ALL
    USING (org_id = get_user_org_id());

-- eudr_dds_submissions
CREATE POLICY "Users view eudr_dds in their org"
    ON eudr_dds_submissions FOR SELECT
    USING (org_id = get_user_org_id());
CREATE POLICY "Users manage eudr_dds in their org"
    ON eudr_dds_submissions FOR ALL
    USING (org_id = get_user_org_id());
