-- v23: Animal Individual Registry — animals, animal_events

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. animals
--    Individual animal registry with lineage, RFID, and paddock/herd linkage.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE animals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
    rfid_code           VARCHAR(20) UNIQUE,             -- ISO 11784/11785 15-digit EID (nullable until applied)
    visual_tag          VARCHAR(50),                    -- Visual ear tag number
    name                VARCHAR(100),                   -- Optional name
    sex                 VARCHAR(10) CHECK (sex IN ('MACHO','HEMBRA')),
    breed               VARCHAR(100),
    birth_date          DATE,
    mother_id           UUID REFERENCES animals(id) ON DELETE SET NULL,
    father_id           UUID REFERENCES animals(id) ON DELETE SET NULL,
    current_paddock_id  UUID REFERENCES paddocks(id) ON DELETE SET NULL,
    current_herd_id     UUID REFERENCES herds(id) ON DELETE SET NULL,
    status              VARCHAR(20) DEFAULT 'VIVO' CHECK (status IN (
                            'VIVO','VENDIDO','FAENADO','MUERTO','TRANSFERIDO'
                        )),
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_animals_org_status
    ON animals (org_id, status);

CREATE INDEX idx_animals_rfid_code
    ON animals (rfid_code)
    WHERE rfid_code IS NOT NULL;

CREATE INDEX idx_animals_org_herd
    ON animals (org_id, current_herd_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. animal_events
--    Individual event log (bitácora animal) — immutable append-only records.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE animal_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    animal_id   UUID REFERENCES animals(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL CHECK (event_type IN (
                    'NACIMIENTO','DESTETE','VACUNACION','TRATAMIENTO','PESAJE',
                    'PRENEZ_CONFIRMADA','PARTO','MOVIMIENTO','VENTA','FAENA',
                    'MUERTE','LECTURA_RFID','OBSERVACION'
                )),
    event_date  TIMESTAMPTZ NOT NULL,
    details     JSONB,                          -- Flexible payload per event_type
    location    GEOMETRY(POINT, 4326),          -- GPS coordinates of event
    photo_urls  TEXT[],
    recorded_by UUID REFERENCES profiles(id),
    source      VARCHAR(30) DEFAULT 'APP' CHECK (source IN (
                    'APP','BLUETOOTH_RFID','USB_IMPORT','WHATSAPP','API'
                )),
    device_info JSONB,                          -- {reader_model, firmware, battery_pct}
    synced_at   TIMESTAMPTZ,                    -- NULL = pending sync
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_animal_events_org_animal_date
    ON animal_events (org_id, animal_id, event_date DESC);

CREATE INDEX idx_animal_events_type_date
    ON animal_events (event_type, event_date);

CREATE INDEX idx_animal_events_org_type
    ON animal_events (org_id, event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE animals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_events ENABLE ROW LEVEL SECURITY;

-- animals
CREATE POLICY "Users view animals in their org"
    ON animals FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage animals in their org"
    ON animals FOR ALL
    USING (org_id = get_user_org_id());

-- animal_events
CREATE POLICY "Users view animal_events in their org"
    ON animal_events FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage animal_events in their org"
    ON animal_events FOR ALL
    USING (org_id = get_user_org_id());
