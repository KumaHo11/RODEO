#!/bin/bash
set -e

# Load local environment variables (ignoring comments and empty lines)
export $(grep -v '^#' frontend/.env.local | grep -v '^$' | xargs)

# Function to create and add version
create_secret() {
  local SECRET_NAME=$1
  local SECRET_VALUE=$2

  if ! gcloud secrets describe $SECRET_NAME >/dev/null 2>&1; then
    echo "Creando secreto: $SECRET_NAME"
    gcloud secrets create $SECRET_NAME --replication-policy="automatic"
  fi

  echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=-
  echo "✅ Valor inyectado en $SECRET_NAME"
}

# Producción
create_secret "rodeo-db-url-prod" "$DATABASE_URL"
create_secret "resend-api-key-prod" "$RESEND_API_KEY"
create_secret "firebase-sa-key-prod" "$FIREBASE_ADMIN_CREDENTIALS_BASE64"

# Pre-producción
create_secret "rodeo-db-url-preprod" "$DATABASE_URL"
create_secret "resend-api-key-preprod" "$RESEND_API_KEY"
create_secret "firebase-sa-key-preprod" "$FIREBASE_ADMIN_CREDENTIALS_BASE64"

echo "🎉 Secretos inicializados con éxito."
