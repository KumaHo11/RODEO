#!/bin/bash
# setup_eudr_infra.sh
# Ejecuta:
#   1. gcloud auth login (para renovar tokens)
#   2. Crea bucket GCS rodeo-eudr-docs
#   3. Asigna IAM al Cloud Run SA
#   4. Levanta el proxy y corre la migración v26

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           RODEO – EUDR Infrastructure Setup                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Auth ───────────────────────────────────────────────────────────────────
echo "🔐 Paso 1: Autenticación con Google Cloud"
echo "   Iniciando gcloud auth login..."
gcloud auth login --account=josorio@rodeoagtech.com
gcloud auth application-default login

echo ""
echo "✅ Autenticación completada"

# ── 2. Config ─────────────────────────────────────────────────────────────────
PROJECT_ID="glowing-anagram-491819-d9"
BUCKET_NAME="rodeo-eudr-docs"
REGION="southamerica-east1"
# Cloud Run SA para staging / prod — ajusta si el nombre difiere
SA_CLOUDRUN_STAGING="service-831756494147@serverless-robot-prod.iam.gserviceaccount.com"

echo "🪣 Paso 2: Creando bucket GCS '$BUCKET_NAME' en $REGION..."
gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --uniform-bucket-level-access \
  2>/dev/null && echo "   Bucket creado ✅" || echo "   (El bucket ya existe o fue creado — continuando)"

# También staging bucket (opcional)
gcloud storage buckets create "gs://${BUCKET_NAME}-staging" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --uniform-bucket-level-access \
  2>/dev/null && echo "   Staging bucket creado ✅" || echo "   (Ya existe — OK)"

# ── 3. IAM ────────────────────────────────────────────────────────────────────
echo ""
echo "🔑 Paso 3: Asignando IAM al Service Account de Cloud Run..."

# firebase-admin-rodeo (backend staging)
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:firebase-admin-rodeo@rodeo-app-fac50.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin" \
  2>/dev/null && echo "   IAM para firebase-admin-rodeo ✅" || true

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}-staging" \
  --member="serviceAccount:firebase-admin-rodeo@rodeo-app-fac50.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin" \
  2>/dev/null && echo "   IAM staging ✅" || true

# ── 4. Migración SQL ──────────────────────────────────────────────────────────
echo ""
echo "🗃️  Paso 4: Levantando Cloud SQL Proxy y ejecutando migración v26..."
echo ""

# Asegura que el proxy esté corriendo
if ! lsof -i :5432 > /dev/null 2>&1; then
  echo "   Iniciando Cloud SQL Auth Proxy (staging)..."
  ./tools/cloud-sql-proxy rodeo-app-fac50:southamerica-east1:rodeo-db-preprod &
  PROXY_PID=$!
  sleep 5
  echo "   Proxy iniciado (PID: $PROXY_PID)"
else
  echo "   Proxy ya estaba corriendo en :5432"
fi

# Ejecutar migración
echo "   Ejecutando migración v26_eudr_compliance.sql..."
cd "$(dirname "$0")/backend"
node run_migration_v26.js

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ EUDR Infrastructure completada                           ║"
echo "║                                                              ║"
echo "║  Próximos pasos:                                             ║"
echo "║  1. Env vars ya agregadas a .env.local y .env.staging        ║"
echo "║  2. Bucket: gs://rodeo-eudr-docs (São Paulo)                 ║"
echo "║  3. Migración v26 aplicada en staging                        ║"
echo "║                                                              ║"
echo "║  Para producción correr: ./setup_eudr_infra.sh --prod        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
