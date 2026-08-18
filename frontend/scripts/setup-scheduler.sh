#!/bin/bash
# RODEO — Cloud Scheduler setup para cron jobs del módulo Metrics
# Uso: ./scripts/setup-scheduler.sh [staging|prod]
#
# Crea o actualiza los Cloud Scheduler jobs para:
#   - metrics-ingest-weekly (nuevo)
#   - climate-adjustment-daily (verificar)
#   - paddock-reminders-daily (verificar)
#   - gap-detection-weekly (verificar)

set -e

ENV=${1:-staging}

if [ "$ENV" = "prod" ]; then
  PROJECT="rodeo-app-prod-v1"
  APP_URL="https://app.rodeoagtech.com"
  SERVICE_NAME="rodeo-prod"
  echo "⚠️  MODO PRODUCCIÓN — proyecto: $PROJECT"
else
  PROJECT="rodeo-app-fac50"
  APP_URL="https://staging.rodeoagtech.com"
  SERVICE_NAME="rodeo-staging"
  echo "🧪 MODO STAGING — proyecto: $PROJECT"
fi

REGION="southamerica-east1"
TZ="America/Argentina/Buenos_Aires"

# Obtener CRON_SECRET desde Secret Manager
echo "🔑 Obteniendo CRON_SECRET desde Secret Manager..."
CRON_SECRET=$(gcloud secrets versions access latest \
  --secret="CRON_SECRET" \
  --project="$PROJECT" \
  2>/dev/null) || {
  echo "⚠️  No se pudo leer CRON_SECRET de Secret Manager."
  echo "   Intentando leer de .env.local..."
  CRON_SECRET=$(grep "^CRON_SECRET=" frontend/.env.local 2>/dev/null | cut -d'=' -f2 | tr -d '"')
}

if [ -z "$CRON_SECRET" ]; then
  echo "❌ No se encontró CRON_SECRET. Configuralo manualmente en los headers."
  exit 1
fi

echo "✅ CRON_SECRET obtenido (${#CRON_SECRET} chars)"

# ── Función para crear o actualizar un job ─────────────────────────────────

upsert_job() {
  local JOB_NAME=$1
  local SCHEDULE=$2
  local URI=$3
  local DESCRIPTION=$4

  echo ""
  echo "📅 Configurando: $JOB_NAME"
  echo "   Schedule: $SCHEDULE"
  echo "   URI: $URI"

  # Verificar si el job ya existe
  if gcloud scheduler jobs describe "$JOB_NAME" \
      --location="$REGION" \
      --project="$PROJECT" \
      &>/dev/null; then
    echo "   ♻️  Job existe — actualizando..."
    gcloud scheduler jobs update http "$JOB_NAME" \
      --location="$REGION" \
      --project="$PROJECT" \
      --schedule="$SCHEDULE" \
      --uri="$URI" \
      --http-method=GET \
      --headers="Authorization=Bearer $CRON_SECRET,Content-Type=application/json" \
      --time-zone="$TZ" \
      --attempt-deadline=540s \
      --description="$DESCRIPTION"
  else
    echo "   ✨ Creando nuevo job..."
    gcloud scheduler jobs create http "$JOB_NAME" \
      --location="$REGION" \
      --project="$PROJECT" \
      --schedule="$SCHEDULE" \
      --uri="$URI" \
      --http-method=GET \
      --headers="Authorization=Bearer $CRON_SECRET,Content-Type=application/json" \
      --time-zone="$TZ" \
      --attempt-deadline=540s \
      --description="$DESCRIPTION"
  fi

  echo "   ✅ $JOB_NAME configurado"
}

echo ""
echo "🚀 Configurando Cloud Scheduler jobs para $ENV..."
echo "============================================================"

# ── 1. Metrics Ingest — NUEVO ──────────────────────────────────────────────
# Lunes a las 08:00 ART (11:00 UTC)
upsert_job \
  "metrics-ingest-weekly" \
  "0 11 * * 1" \
  "${APP_URL}/api/cron/metrics-ingest" \
  "RODEO Metrics: ingesta satelital semanal Sentinel-2 (NDVI/EVI/SAVI/NDMI/BSI)"

# ── 2. Climate Adjustment — ya existente, verificar ──────────────────────
# Todos los días a las 06:00 ART (09:00 UTC)
upsert_job \
  "climate-adjustment-daily" \
  "0 9 * * *" \
  "${APP_URL}/api/cron/climate-adjustment" \
  "Ajuste Clima diario: recalcula dry matter con NDVI x lluvia x sequía"

# ── 3. Paddock Reminders — ya existente, verificar ───────────────────────
# Todos los días a las 07:30 ART (10:30 UTC)
upsert_job \
  "paddock-reminders-daily" \
  "30 10 * * *" \
  "${APP_URL}/api/cron/paddock-reminders" \
  "Recordatorios de potreros: alertas de rotación y descanso"

# ── 4. Gap Detection — ya existente, verificar ───────────────────────────
# Domingo a las 07:00 ART (10:00 UTC)
upsert_job \
  "gap-detection-weekly" \
  "0 10 * * 0" \
  "${APP_URL}/api/cron/gap-detection" \
  "Detección de gaps en el Gantt: potreros sin plan asignado"

echo ""
echo "============================================================"
echo "✅ Todos los jobs configurados. Listando estado final:"
echo ""
gcloud scheduler jobs list \
  --location="$REGION" \
  --project="$PROJECT" \
  --format="table(name,schedule,state,lastAttemptTime)"
