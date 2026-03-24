CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Subscription Plans
CREATE TABLE subscriptions_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    paddocks_limit INT DEFAULT 5,
    herds_limit INT DEFAULT 1,
    has_ai_analysis BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL, -- references auth.users(id)
    name VARCHAR(255) NOT NULL,
    total_area_ha DECIMAL(10, 2),
    boundaries GEOMETRY(POLYGON, 4326),
    region_id VARCHAR(50),
    drought_plan_buffer INT DEFAULT 20,
    subscription_plan_id UUID REFERENCES subscriptions_plans(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- references auth.users(id) ON DELETE CASCADE
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('OWNER', 'MANAGER', 'OPERATOR')),
    is_active BOOLEAN DEFAULT true,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Paddocks (Lotes)
CREATE TABLE paddocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    area_ha DECIMAL(10, 2),
    geom GEOMETRY(POLYGON, 4326),
    is_grazable BOOLEAN DEFAULT true,
    current_status VARCHAR(50) CHECK (current_status IN ('RESTING', 'GRAZING')) DEFAULT 'RESTING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Herds (Rodeos)
CREATE TABLE herds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(100) DEFAULT 'Bovine',
    breed VARCHAR(100),
    category VARCHAR(100),
    head_count INT NOT NULL DEFAULT 0,
    avg_weight_kg DECIMAL(10, 2),
    total_ev DECIMAL(10, 2), -- Equivalente Vaca
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Grazing Plans (Carta de Pastoreo)
CREATE TABLE grazing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paddock_id UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    herd_id UUID REFERENCES herds(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    exit_date DATE,
    planned_recovery_days INT,
    status VARCHAR(50) CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')) DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Biological Monitoring
CREATE TABLE biological_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paddock_id UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    observer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    photo_url TEXT,
    ground_cover_pct DECIMAL(5, 2),
    grass_height_cm DECIMAL(10, 2),
    dry_matter_estimate_kg DECIMAL(10, 2),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Rainfall Logs
CREATE TABLE rainfall_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recorder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    mm_count DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Setup
ALTER TABLE subscriptions_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE paddocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE herds ENABLE ROW LEVEL SECURITY;
ALTER TABLE grazing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE biological_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainfall_logs ENABLE ROW LEVEL SECURITY;

-- Creating functions to handle RLS effectively.
-- The current user must be associated with the organization.
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Policies for Organizations (Users can read/update their own organization)
CREATE POLICY "Users view their own organization" ON organizations
FOR SELECT USING (id = get_user_org_id());

CREATE POLICY "Owners update their organization" ON organizations
FOR UPDATE USING (id = get_user_org_id());

-- Policies for Profiles
CREATE POLICY "Users view profiles from their organization" ON profiles
FOR SELECT USING (organization_id = get_user_org_id());

-- Policies for Paddocks
CREATE POLICY "Users view paddocks in their org" ON paddocks
FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Users manage paddocks in their org" ON paddocks
FOR ALL USING (org_id = get_user_org_id());

-- Policies for Herds
CREATE POLICY "Users view herds in their org" ON herds
FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Users manage herds in their org" ON herds
FOR ALL USING (org_id = get_user_org_id());

-- Policies for Grazing Plans
-- (Since paddocks org_id determines organization)
CREATE POLICY "Users view grazing plans via paddock" ON grazing_plans
FOR SELECT USING (
    paddock_id IN (SELECT id FROM paddocks WHERE org_id = get_user_org_id())
);
CREATE POLICY "Users manage grazing plans via paddock" ON grazing_plans
FOR ALL USING (
    paddock_id IN (SELECT id FROM paddocks WHERE org_id = get_user_org_id())
);

-- Policies for Biological monitoring
CREATE POLICY "Users view monitoring logs via paddock" ON biological_monitoring
FOR SELECT USING (
    paddock_id IN (SELECT id FROM paddocks WHERE org_id = get_user_org_id())
);
CREATE POLICY "Users manage monitoring logs via paddock" ON biological_monitoring
FOR ALL USING (
    paddock_id IN (SELECT id FROM paddocks WHERE org_id = get_user_org_id())
);

-- Policies for Rainfall Logs
CREATE POLICY "Users view rainfall logs in their org" ON rainfall_logs
FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Users manage rainfall logs in their org" ON rainfall_logs
FOR ALL USING (org_id = get_user_org_id());
