#!/usr/bin/env bash
# ============================================================
# run_v27_migration.sh — v27 EUDR Geometry Fix → STAGING
#
# PASOS:
#   Parte A: función + backfill (rodeo_service) → ya aplicada ✅
#   Parte B: DDL — índice GiST + columna + trigger (postgres)
#
# REQUISITO: gcloud auth login activo en esta terminal
#
# USO: bash run_v27_migration.sh
# ============================================================
set -euo pipefail

PROJECT="rodeo-app-fac50"
INSTANCE="rodeo-db-preprod"
DATABASE="rodeo"

echo ""
echo "══════════════════════════════════════════════════════"
echo "🐄 RODEO — Migración v27 EUDR Geometry Fix → STAGING"
echo "   (Parte B: DDL con usuario postgres)"
echo "══════════════════════════════════════════════════════"
echo ""

# Verificar auth de gcloud
if ! gcloud auth print-access-token --project="$PROJECT" &>/dev/null; then
  echo "❌ gcloud no autenticado. Ejecutar primero:"
  echo "   gcloud auth login"
  echo "   gcloud auth application-default login"
  exit 1
fi

echo "✅ gcloud auth OK"
echo ""
echo "▶  Conectando a Cloud SQL vía gcloud sql connect..."
echo "   (si pide contraseña de postgres, presionar ENTER — Cloud SQL usa IAM)"
echo ""

gcloud sql connect "$INSTANCE" \
  --user=postgres \
  --database="$DATABASE" \
  --project="$PROJECT" \
  < v27_eudr_geom_fix_part_b.sql

echo ""
echo "══════════════════════════════════════════════════════"
echo "✅ v27 Parte B aplicada exitosamente"
echo ""
echo "Verificación rápida:"
echo "  Abrir: https://staging.rodeoagtech.com/dashboard/eudr"
echo "══════════════════════════════════════════════════════"
echo ""
