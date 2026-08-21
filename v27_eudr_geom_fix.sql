-- v27_eudr_geom_fix.sql
-- Correcciones de geometría para el módulo EUDR v26.
--
-- Problema raíz: Los 20 potreros del Gran Chaco fueron cargados desde un
-- GeoJSON FeatureCollection pero el bug extractGeometry() solo procesó el
-- primero, dejando paddocks sin geom o con geometría incorrecta.
--
-- Este script:
--   1. Agrega índice espacial GiST en paddocks.geom (mejora performance de
--      ST_Intersects, ST_Area, ST_Within en consultas EUDR y métricas)
--   2. Crea función normalize_geom_to_wgs84() para reproyección segura
--   3. Limpia geometrías inválidas existentes con ST_MakeValid()
--   4. Re-ejecuta el backfill de columnas EUDR (eudr_area_ha, eudr_geom_type)
--   5. Agrega columna eudr_risk_status a paddocks para persistir el resultado
--      del algoritmo sin depender de un JOIN con deforestation_checks en cada query
--
-- Ejecutar: como rodeo_service (o postgres en staging)
-- Prerequisitos: v26_paddocks_eudr_columns.sql ya ejecutado
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Índice espacial GiST (si no existe) ───────────────────────────────────
-- Mejora dramáticamente las queries de ST_Area, ST_Intersects y ST_Within
-- sobre paddocks — críticas para el pipeline de validación EUDR.
CREATE INDEX IF NOT EXISTS idx_paddocks_geom_gist
    ON paddocks USING GIST (geom)
    WHERE geom IS NOT NULL;

COMMENT ON INDEX idx_paddocks_geom_gist IS
'Índice espacial GiST para queries EUDR/métricas (ST_Area, ST_Intersects, ST_Within). v27.';

-- ── 2. Función de normalización de geometría a WGS84 ─────────────────────────
-- Maneja 3 casos:
--   a. SRID = 0 (sin declarar)   → asumir WGS84 (4326), asignar SRID
--   b. SRID = 4326 (correcto)    → sin cambios
--   c. SRID = otro (ej. POSGAR)  → reproyectar a WGS84 con ST_Transform
-- Luego aplica ST_MakeValid para corregir self-intersections del campo.
CREATE OR REPLACE FUNCTION normalize_geom_to_wgs84(input_geom geometry)
RETURNS geometry AS $$
DECLARE
    v_srid   INTEGER;
    v_geom   geometry;
BEGIN
    v_srid := ST_SRID(input_geom);

    IF v_srid = 0 THEN
        -- SRID desconocido — asumir WGS84
        v_geom := ST_SetSRID(input_geom, 4326);
    ELSIF v_srid = 4326 THEN
        -- Ya está en WGS84
        v_geom := input_geom;
    ELSE
        -- Reproyectar desde SRID declarado a WGS84
        BEGIN
            v_geom := ST_Transform(ST_SetSRID(input_geom, v_srid), 4326);
        EXCEPTION WHEN OTHERS THEN
            -- Si la reproyección falla (SRID inválido), mantener la geometría original
            RAISE WARNING 'normalize_geom_to_wgs84: ST_Transform falló para SRID=%. Manteniendo geom original.', v_srid;
            v_geom := input_geom;
        END;
    END IF;

    -- Aplicar ST_MakeValid para corregir self-intersections comunes en
    -- polígonos digitalizados a mano (ej. spike topology, ring self-intersection)
    IF NOT ST_IsValid(v_geom) THEN
        v_geom := ST_MakeValid(v_geom);
    END IF;

    RETURN v_geom;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

COMMENT ON FUNCTION normalize_geom_to_wgs84(geometry) IS
'Reproyecta una geometría a WGS84 (EPSG:4326) y corrige self-intersections con ST_MakeValid. v27.';

GRANT EXECUTE ON FUNCTION normalize_geom_to_wgs84(geometry) TO rodeo_service, rodeo_app;

-- ── 3. Limpiar geometrías inválidas existentes ───────────────────────────────
-- Aplica ST_MakeValid() sobre paddocks con geometrías inválidas.
-- NO modifica paddocks con geom = NULL ni los que ya son válidos.
DO $$
DECLARE
    v_fixed   INTEGER := 0;
    v_invalid INTEGER := 0;
    rec       RECORD;
BEGIN
    SELECT COUNT(*) INTO v_invalid
    FROM paddocks
    WHERE geom IS NOT NULL AND NOT ST_IsValid(geom);

    IF v_invalid = 0 THEN
        RAISE NOTICE 'normalize_geom: No hay geometrías inválidas. Nada que limpiar.';
        RETURN;
    END IF;

    RAISE NOTICE 'normalize_geom: Encontradas % geometrías inválidas. Aplicando ST_MakeValid...', v_invalid;

    FOR rec IN
        SELECT id FROM paddocks WHERE geom IS NOT NULL AND NOT ST_IsValid(geom)
    LOOP
        BEGIN
            UPDATE paddocks
            SET geom = ST_MakeValid(geom)
            WHERE id = rec.id;
            v_fixed := v_fixed + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'normalize_geom: No se pudo corregir paddock id=%. Error: %', rec.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'normalize_geom: % geometrías corregidas.', v_fixed;
END $$;

-- ── 4. Re-backfill de columnas EUDR ──────────────────────────────────────────
-- Re-ejecutar update_paddock_eudr_gis() sobre todos los paddocks con geometría
-- para asegurar que eudr_area_ha y eudr_geom_type estén actualizados tras la
-- corrección de geometrías del paso anterior.
DO $$
DECLARE
    rec       RECORD;
    v_count   INTEGER := 0;
BEGIN
    FOR rec IN SELECT id FROM paddocks WHERE geom IS NOT NULL LOOP
        BEGIN
            PERFORM update_paddock_eudr_gis(rec.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'eudr_backfill: error en paddock id=%. %', rec.id, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'eudr_backfill: % paddocks actualizados (eudr_area_ha, eudr_geom_type).', v_count;
END $$;

-- ── 5. Columna eudr_risk_status en paddocks ───────────────────────────────────
-- Persiste el resultado del algoritmo de deforestación directamente en paddocks
-- para evitar JOINs en cada query de validación EUDR.
-- Se actualiza vía trigger después de cada INSERT/UPDATE en deforestation_checks.
ALTER TABLE paddocks
    ADD COLUMN IF NOT EXISTS eudr_risk_status VARCHAR(20)
        CHECK (eudr_risk_status IN ('CLEAN', 'AT_RISK', 'DEFORESTED', 'PENDING'))
        DEFAULT 'PENDING';

COMMENT ON COLUMN paddocks.eudr_risk_status IS
'Estado de riesgo EUDR: CLEAN, AT_RISK, DEFORESTED o PENDING. Sincronizado desde deforestation_checks vía trigger. v27.';

-- Trigger: sincronizar eudr_risk_status cuando cambia deforestation_checks
CREATE OR REPLACE FUNCTION trg_sync_paddock_eudr_risk()
RETURNS TRIGGER AS $$
BEGIN
    -- Mapear: CLEAN→CLEAN, DEFORESTED→DEFORESTED, AT_RISK→AT_RISK, else PENDING
    UPDATE paddocks
    SET eudr_risk_status = CASE
        WHEN NEW.status IN ('CLEAN', 'AT_RISK', 'DEFORESTED') THEN NEW.status
        ELSE 'PENDING'
    END
    WHERE id = NEW.paddock_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deforestation_check_sync ON deforestation_checks;
CREATE TRIGGER trg_deforestation_check_sync
    AFTER INSERT OR UPDATE OF status ON deforestation_checks
    FOR EACH ROW EXECUTE FUNCTION trg_sync_paddock_eudr_risk();

GRANT EXECUTE ON FUNCTION trg_sync_paddock_eudr_risk() TO rodeo_service;

-- Backfill inmediato desde deforestation_checks existentes
UPDATE paddocks p
SET eudr_risk_status = dc.status
FROM (
    SELECT DISTINCT ON (paddock_id) paddock_id, status
    FROM deforestation_checks
    ORDER BY paddock_id, checked_at DESC
) dc
WHERE p.id = dc.paddock_id
  AND dc.status IN ('CLEAN', 'AT_RISK', 'DEFORESTED');

SELECT
    'OK: v27_eudr_geom_fix aplicado exitosamente' AS result,
    (SELECT COUNT(*) FROM paddocks WHERE geom IS NOT NULL)            AS paddocks_con_geometria,
    (SELECT COUNT(*) FROM paddocks WHERE NOT ST_IsValid(geom) AND geom IS NOT NULL) AS geometrias_invalidas_restantes,
    (SELECT COUNT(*) FROM paddocks WHERE eudr_risk_status = 'DEFORESTED')           AS potreros_no_conformes,
    (SELECT COUNT(*) FROM paddocks WHERE eudr_risk_status = 'CLEAN')                AS potreros_conformes;
