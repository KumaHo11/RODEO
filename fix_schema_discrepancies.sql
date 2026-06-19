-- Fixes para la Base de Datos

-- 1. Asegurar que owner_id sea nullable
ALTER TABLE organizations ALTER COLUMN owner_id DROP NOT NULL;

-- 2. Asegurar que perfiles tenga ID autogenerado
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. Crear la función get_user_org_id() para que el RLS funcione en paddocks/herds
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.org_id', true), '')::UUID;
$$ LANGUAGE SQL SECURITY DEFINER;
