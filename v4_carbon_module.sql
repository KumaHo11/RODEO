-- 9. Carbon Assessments
CREATE TABLE carbon_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    paddock_id UUID REFERENCES paddocks(id) ON DELETE SET NULL, -- Null if whole farm assessment
    assessment_date DATE NOT NULL,
    soil_organic_carbon_pct DECIMAL(5, 2) NOT NULL, -- SOC %
    total_carbon_tons DECIMAL(10, 2) NOT NULL,
    methodology VARCHAR(100) DEFAULT 'EOV Savory',
    assessor_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Carbon Certificates
CREATE TABLE carbon_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES carbon_assessments(id) ON DELETE CASCADE,
    issue_date DATE NOT NULL,
    vintage_year INT NOT NULL,
    tons_issued DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('PENDING', 'ISSUED', 'RETIRED', 'CANCELLED')) DEFAULT 'PENDING',
    certificate_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE carbon_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view carbon assessments in their org" ON carbon_assessments
FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Users manage carbon assessments in their org" ON carbon_assessments
FOR ALL USING (org_id = get_user_org_id());

CREATE POLICY "Users view carbon certificates in their org" ON carbon_certificates
FOR SELECT USING (org_id = get_user_org_id());
CREATE POLICY "Users manage carbon certificates in their org" ON carbon_certificates
FOR ALL USING (org_id = get_user_org_id());
