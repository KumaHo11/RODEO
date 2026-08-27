#!/usr/bin/env bash
# ============================================================
# migrate_v26_staging.sh
# Migración EUDR v26 → STAGING únicamente
# Instancia: rodeo-app-fac50:southamerica-east1:rodeo-db-preprod
#
# Ejecuta en orden:
#   PASO 1: v26_paddocks_eudr_columns.sql  (requiere superuser postgres)
#   PASO 2: v26_eudr_main.sql             (crea tablas, vista, RLS como rodeo_service)
#
# USO: bash migrate_v26_staging.sh
# ============================================================

set -euo pipefail

PROJECT="rodeo-app-fac50"
INSTANCE="rodeo-db-preprod"
DATABASE="rodeo"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "══════════════════════════════════════════════════════"
echo "🐄 RODEO — Migración v26 EUDR → STAGING"
echo "   Proyecto: $PROJECT"
echo "   Instancia: $INSTANCE"
echo "   Base de datos: $DATABASE"
echo "══════════════════════════════════════════════════════"
echo ""
echo "⚠️  Este script modifica ÚNICAMENTE la instancia de STAGING."
echo "   Producción (rodeo-db-prod) NO será tocada."
echo ""

# ──────────────────────────────────────────────
# Verificar archivos SQL
# ──────────────────────────────────────────────
SQL_PADDOCKS="$SCRIPT_DIR/v26_paddocks_eudr_columns.sql"
SQL_MAIN="$SCRIPT_DIR/v26_eudr_main.sql"

if [ ! -f "$SQL_PADDOCKS" ]; then
  echo "❌ No se encontró: $SQL_PADDOCKS"
  exit 1
fi
if [ ! -f "$SQL_MAIN" ]; then
  echo "❌ No se encontró: $SQL_MAIN"
  exit 1
fi

echo "✅ Archivos SQL encontrados."
echo ""

# ──────────────────────────────────────────────
# PASO 1: ALTER TABLE paddocks (requiere postgres)
# ──────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 1/2: Agregando columnas EUDR a tabla paddocks"
echo "          Usuario: postgres (superuser)"
echo "          SQL: v26_paddocks_eudr_columns.sql"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👉 Ingresarás a psql como 'postgres'. Cuando aparezca el prompt"
echo "   'rodeo=#', pega el siguiente comando y presiona ENTER:"
echo ""
echo "   \\i /dev/stdin"
echo ""
echo "   El script se ejecutará automáticamente vía stdin pipe."
echo ""

gcloud sql connect "$INSTANCE" \
  --user=postgres \
  --database="$DATABASE" \
  --project="$PROJECT" \
  < "$SQL_PADDOCKS"

echo ""
echo "✅ PASO 1 completado — columnas EUDR agregadas a paddocks."
echo ""

# ──────────────────────────────────────────────
# PASO 2: Tablas EUDR + Vista + RLS
# ──────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 2/2: Creando tablas EUDR, vista y políticas RLS"
echo "          Usuario: rodeo_service"
echo "          SQL: v26_eudr_main.sql"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

gcloud sql connect "$INSTANCE" \
  --user=rodeo_service \
  --database="$DATABASE" \
  --project="$PROJECT" \
  < "$SQL_MAIN"

echo ""
echo "══════════════════════════════════════════════════════"
echo "✅ MIGRACIÓN v26 EUDR COMPLETADA EXITOSAMENTE en STAGING"
echo ""
echo "Tablas creadas:"
echo "  ✓ eudr_documents        (bóveda documental)"
echo "  ✓ feed_batches          (trazabilidad de insumos)"
echo "  ✓ eudr_dds_submissions  (historial de DDS)"
echo ""
echo "Columnas agregadas a paddocks:"
echo "  ✓ eudr_area_ha"
echo "  ✓ eudr_geom_type"
echo "  ✓ eudr_validated_at"
echo "  ✓ eudr_notes"
echo ""
echo "Vista creada:"
echo "  ✓ animal_custody_timeline"
echo ""
echo "Funciones y triggers:"
echo "  ✓ update_paddock_eudr_gis()"
echo "  ✓ trg_paddock_eudr (trigger en paddocks.geom)"
echo ""
echo "RLS habilitado en las 3 tablas EUDR."
echo ""
echo "👉 Próximo paso: verificar en staging.rodeoagtech.com/dashboard/eudr"
echo "══════════════════════════════════════════════════════"
