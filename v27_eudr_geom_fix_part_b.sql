-- v27_eudr_geom_fix_part_b.sql
-- PARTE B: DDL que requiere ser owner de la tabla paddocks (usuario: postgres)
-- Ejecutar via: bash run_v27_migration.sh
-- (o: gcloud sql connect rodeo-db-preprod --user=postgres --database=rodeo --project=rodeo-app-fac50 < v27_eudr_geom_fix_part_b.sql)

-- ── 1. Índice espacial GiST ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_paddocks_geom_gist
    ON paddocks USING GIST (geom)
    WHERE geom IS NOT NULL;

-- ── 2. Nueva columna eudr_risk_status ───────────────────────────────────────
ALTER TABLE paddocks
    ADD COLUMN IF NOT EXISTS eudr_risk_status VARCHAR(20)
        CHECK (eudr_risk_status IN ('CLEAN', 'AT_RISK', 'DEFORESTED', 'PENDING'))
        DEFAULT 'PENDING';

-- ── 3. Función + trigger de sincronización desde deforestation_checks ───────
CREATE OR REPLACE FUNCTION trg_sync_paddock_eudr_risk()
RETURNS TRIGGER AS $$
BEGIN
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

-- ── 4. Backfill eudr_risk_status desde deforestation_checks existentes ──────
UPDATE paddocks p
SET eudr_risk_status = dc.status
FROM (
    SELECT DISTINCT ON (paddock_id) paddock_id, status
    FROM deforestation_checks
    ORDER BY paddock_id, checked_at DESC
) dc
WHERE p.id = dc.paddock_id
  AND dc.status IN ('CLEAN', 'AT_RISK', 'DEFORESTED');

-- ── 5. Permisos para rodeo_service y rodeo_app ──────────────────────────────
GRANT SELECT, UPDATE ON paddocks TO rodeo_service, rodeo_app;
GRANT EXECUTE ON FUNCTION trg_sync_paddock_eudr_risk() TO rodeo_service;

-- ── Verificación final ───────────────────────────────────────────────────────
SELECT
    'OK: v27 Part B completado' AS resultado,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename='paddocks' AND indexname='idx_paddocks_geom_gist') AS gist_idx,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='paddocks' AND column_name='eudr_risk_status') AS risk_col,
    (SELECT COUNT(*) FROM pg_trigger WHERE tgname='trg_deforestation_check_sync') AS trigger_sync,
    (SELECT COUNT(*) FROM paddocks WHERE eudr_risk_status = 'DEFORESTED') AS potreros_no_conformes,
    (SELECT COUNT(*) FROM paddocks WHERE eudr_risk_status = 'CLEAN') AS potreros_limpios,
    (SELECT COUNT(*) FROM paddocks WHERE geom IS NOT NULL) AS paddocks_con_geometria;
