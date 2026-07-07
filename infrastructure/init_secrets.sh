#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════
# init_secrets.sh — Inicializa secretos en Google Secret Manager
#
# IMPORTANTE: Debe ejecutarse DOS veces con diferentes .env files:
#   1. Para STAGING:    ENV_FILE=frontend/.env.local    ./infrastructure/init_secrets.sh staging
#   2. Para PRODUCCIÓN: ENV_FILE=frontend/.env.prod.local ./infrastructure/init_secrets.sh prod
#
# Si no se pasa argumento, se muestra el uso.
# ═══════════════════════════════════════════════════════════════════════

ENVIRONMENT=$1
ENV_FILE=${ENV_FILE:-}

if [ -z "$ENVIRONMENT" ] || { [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "prod" ]; }; then
  echo "Uso: ENV_FILE=<path> $0 <staging|prod>"
  echo ""
  echo "Ejemplos:"
  echo "  ENV_FILE=frontend/.env.local      $0 staging"
  echo "  ENV_FILE=frontend/.env.prod.local  $0 prod"
  exit 1
fi

if [ -z "$ENV_FILE" ] || [ ! -f "$ENV_FILE" ]; then
  echo "❌ ENV_FILE no existe: '$ENV_FILE'"
  echo "   Asegúrate de que el archivo exista con las variables DATABASE_URL, RESEND_API_KEY, etc."
  exit 1
fi

# Load environment variables
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

# Function to create and add version
create_secret() {
  local PROJECT=$1
  local SECRET_NAME=$2
  local SECRET_VALUE=$3

  if [ -z "$SECRET_VALUE" ]; then
    echo "⚠️  $SECRET_NAME: valor vacío, saltando."
    return
  fi

  if ! gcloud secrets describe $SECRET_NAME --project=$PROJECT >/dev/null 2>&1; then
    echo "Creando secreto: $SECRET_NAME en $PROJECT"
    gcloud secrets create $SECRET_NAME --replication-policy="automatic" --project=$PROJECT
  fi

  echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=- --project=$PROJECT
  echo "✅ Valor inyectado en $SECRET_NAME ($PROJECT)"
}

if [ "$ENVIRONMENT" = "staging" ]; then
  PROJECT="rodeo-app-fac50"
  echo "▶ Inicializando secretos de STAGING en proyecto $PROJECT..."
  create_secret "$PROJECT" "rodeo-db-url" "$DATABASE_URL"
  create_secret "$PROJECT" "resend-api-key" "$RESEND_API_KEY"
  create_secret "$PROJECT" "firebase-sa-key" "$FIREBASE_ADMIN_CREDENTIALS_BASE64"
  create_secret "$PROJECT" "gemini-api-key" "$GEMINI_API_KEY"
  create_secret "$PROJECT" "EMAIL_VERIFY_JWT_SECRET" "$EMAIL_VERIFY_JWT_SECRET"
elif [ "$ENVIRONMENT" = "prod" ]; then
  PROJECT="rodeo-app-prod-v1"
  echo "▶ Inicializando secretos de PRODUCCIÓN en proyecto $PROJECT..."
  create_secret "$PROJECT" "rodeo-db-url" "${DATABASE_URL_PROD:-$DATABASE_URL}"
  create_secret "$PROJECT" "resend-api-key" "$RESEND_API_KEY"
  create_secret "$PROJECT" "firebase-sa-key" "$FIREBASE_ADMIN_CREDENTIALS_BASE64"
  create_secret "$PROJECT" "gemini-api-key" "$GEMINI_API_KEY"
  create_secret "$PROJECT" "EMAIL_VERIFY_JWT_SECRET" "$EMAIL_VERIFY_JWT_SECRET"
fi

echo "🎉 Secretos de $ENVIRONMENT inicializados con éxito."
