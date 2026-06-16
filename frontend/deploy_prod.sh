#!/bin/bash
# ── Deploy a Production ──────────────────────────────────────────────────────
# Uso: ./deploy_prod.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Cargar vars del entorno (idealmente desde Google Cloud Secret Manager en CI/CD)
# Para este script asumimos que se tienen localmente en .env.prod
if [ -f .env.prod ]; then
  export $(grep -v '^#' .env.prod | grep -v '^$' | xargs)
fi

PROD_IMAGE="southamerica-east1-docker.pkg.dev/${GCP_PROJECT_ID:-rodeo-app-prod-v1}/rodeo-prod/frontend:latest"
PROD_URL="https://rodeoagtech.com"

echo "▶ Building image con Firebase client keys..."
docker build --platform linux/amd64 \
  -t "$PROD_IMAGE" \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --build-arg NEXT_PUBLIC_APP_URL="${PROD_URL}" \
  -f Dockerfile .

echo "▶ Pushing image to Artifact Registry..."
docker push "$PROD_IMAGE"

# IMPORTANTE: Seguridad al máximo en producción.
# Uso estricto de Google Secret Manager del proyecto de producción (rodeo-app-prod-v1).
# Cada secret usa la ruta completa: projects/<project>/secrets/<name>:latest
echo "▶ Deploying to Cloud Run usando Secret Manager..."
gcloud run deploy rodeo-prod \
  --image "$PROD_IMAGE" \
  --region southamerica-east1 \
  --platform managed \
  --project rodeo-app-prod-v1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_APP_URL=${PROD_URL}" \
  --update-secrets="DATABASE_URL=projects/rodeo-app-prod-v1/secrets/rodeo-db-url:latest,RESEND_API_KEY=projects/rodeo-app-prod-v1/secrets/resend-api-key:latest,FIREBASE_ADMIN_CREDENTIALS_BASE64=projects/rodeo-app-prod-v1/secrets/firebase-sa-key:latest,GEMINI_API_KEY=projects/rodeo-app-prod-v1/secrets/gemini-api-key:latest,EMAIL_VERIFY_JWT_SECRET=projects/rodeo-app-prod-v1/secrets/EMAIL_VERIFY_JWT_SECRET:latest"

# ── Configurar Mapeo de Dominio Personalizado ──
# gcloud beta run domain-mappings create --service rodeo-prod --domain rodeoagtech.com --region southamerica-east1
# gcloud beta run domain-mappings create --service rodeo-prod --domain www.rodeoagtech.com --region southamerica-east1

echo "✅ Deploy de Producción completado!"
echo "   URL: ${PROD_URL}"
