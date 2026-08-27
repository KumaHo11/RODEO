-- Permisos de acceso de terceros a métricas de una org
CREATE TABLE IF NOT EXISTS metric_access_grants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- productor
    grantee_email   VARCHAR(255) NOT NULL,  -- email del tercero (certificador, frigorífico)
    grantee_name    VARCHAR(255),
    grantee_type    VARCHAR(50) CHECK (grantee_type IN ('CERTIFICADOR','FRIGORIFICO','BANCO','EXPORTADOR','GOBIERNO','OTRO')),
    access_level    VARCHAR(30) DEFAULT 'READ' CHECK (access_level IN ('READ','REPORT','FULL')),
    metric_types    TEXT[],  -- NULL = todas las métricas
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    key_hash        VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 del key, nunca guardar el key en claro
    key_prefix      VARCHAR(10) NOT NULL,  -- ej. 'rdeo_live_' — para identificar en logs
    name            VARCHAR(100),
    scopes          TEXT[] DEFAULT '{metrics:read}',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

ALTER TABLE metric_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their grants"
    ON metric_access_grants FOR ALL
    USING (org_id = get_user_org_id());

CREATE POLICY "Users manage their api_keys"
    ON api_keys FOR ALL
    USING (org_id = get_user_org_id());
