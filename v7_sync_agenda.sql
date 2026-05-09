-- ══════════════════════════════════════════════════════════════════
-- RODEO — v7 Migration: Agenda & Optimistic Locking
-- ══════════════════════════════════════════════════════════════════

-- 1. Añadir columnas de version a las tablas críticas para Optimistic Locking
ALTER TABLE paddocks ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE grazing_plans ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 2. Crear tabla farm_events (Agenda)
CREATE TABLE IF NOT EXISTS farm_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    related_herd_id UUID REFERENCES herds(id) ON DELETE SET NULL,
    related_paddock_id UUID REFERENCES paddocks(id) ON DELETE SET NULL,
    impacts JSONB,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para farm_events
ALTER TABLE farm_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view farm_events in their org" ON farm_events
FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Users manage farm_events in their org" ON farm_events
FOR ALL USING (org_id = get_user_org_id());

-- 3. Crear tabla tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view tasks in their org" ON tasks
FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Users manage tasks in their org" ON tasks
FOR ALL USING (org_id = get_user_org_id());

-- 4. Índice para búsquedas frecuentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_farm_events_org_date ON farm_events(org_id, event_date);
