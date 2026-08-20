-- v26_paddocks_eudr_columns.sql
-- PARTE SUPERUSER: Agregar columnas EUDR a paddocks.
-- Ejecutar via: gcloud sql connect rodeo-db-preprod --user=postgres --database=rodeo --project=rodeo-app-fac50
-- Requiere owner de la tabla (postgres).

ALTER TABLE paddocks
    ADD COLUMN IF NOT EXISTS eudr_area_ha        NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS eudr_geom_type      VARCHAR(10) CHECK (eudr_geom_type IN ('POLYGON', 'POINT', 'INVALID')),
    ADD COLUMN IF NOT EXISTS eudr_validated_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS eudr_notes          TEXT;

-- Función para recalcular columnas EUDR de un paddock
CREATE OR REPLACE FUNCTION update_paddock_eudr_gis(p_paddock_id UUID)
RETURNS void AS $$
DECLARE
    v_area    NUMERIC;
    v_valid   BOOLEAN;
    v_type    VARCHAR(10);
BEGIN
    SELECT
        ST_Area(geom::geography) / 10000.0,
        ST_IsValid(geom)
    INTO v_area, v_valid
    FROM paddocks
    WHERE id = p_paddock_id AND geom IS NOT NULL;

    IF v_area IS NULL THEN RETURN; END IF;

    IF NOT v_valid THEN
        v_type := 'INVALID';
    ELSIF v_area >= 4.0 THEN
        v_type := 'POLYGON';
    ELSE
        v_type := 'POINT';
    END IF;

    UPDATE paddocks SET
        eudr_area_ha      = v_area,
        eudr_geom_type    = v_type,
        eudr_validated_at = NOW()
    WHERE id = p_paddock_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: recalcular cuando se actualiza la geometría
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

-- Backfill de paddocks existentes con geometría
DO $$
DECLARE rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM paddocks WHERE geom IS NOT NULL LOOP
        PERFORM update_paddock_eudr_gis(rec.id);
    END LOOP;
END $$;

-- Dar permisos a rodeo_service y rodeo_app sobre las nuevas columnas
GRANT SELECT, UPDATE ON paddocks TO rodeo_service, rodeo_app;

SELECT 'OK: columnas EUDR agregadas a paddocks' as result;
