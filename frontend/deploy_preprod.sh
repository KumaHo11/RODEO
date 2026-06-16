#!/bin/bash
# ── Deploy a Pre-Production ──────────────────────────────────────────────────
# Uso: ./deploy_preprod.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Cargar vars del entorno (idealmente desde Google Cloud Secret Manager en CI/CD)
# Para este script asumimos que se tienen localmente en .env.preprod
if [ -f .env.preprod ]; then
  export $(grep -v '^#' .env.preprod | grep -v '^$' | xargs)
fi

PREPROD_IMAGE="southamerica-east1-docker.pkg.dev/rodeo-app-fac50/rodeo-preprod/frontend:latest"
PREPROD_URL="https://preprod.rodeoagtech.com"

echo "▶ Building image con Firebase client keys..."
docker build --platform linux/amd64 \
  -t "$PREPROD_IMAGE" \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --build-arg NEXT_PUBLIC_APP_URL="${PREPROD_URL}" \
  -f Dockerfile .

echo "▶ Pushing image to Artifact Registry..."
docker push "$PREPROD_IMAGE"

# IMPORTANTE: No hardcodear credenciales aquí.
# Deben inyectarse en Cloud Run usando Google Secret Manager del proyecto staging (rodeo-app-fac50).
echo "▶ Deploying to Cloud Run usando Secret Manager..."
gcloud run deploy rodeo-preprod \
  --image "$PREPROD_IMAGE" \
  --region southamerica-east1 \
  --platform managed \
  --project rodeo-app-fac50 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_APP_URL=${PREPROD_URL}" \
  --update-secrets="DATABASE_URL=projects/rodeo-app-fac50/secrets/rodeo-db-url:latest,RESEND_API_KEY=projects/rodeo-app-fac50/secrets/resend-api-key:latest,FIREBASE_ADMIN_CREDENTIALS_BASE64=projects/rodeo-app-fac50/secrets/firebase-sa-key:latest,GEMINI_API_KEY=projects/rodeo-app-fac50/secrets/gemini-api-key:latest,EMAIL_VERIFY_JWT_SECRET=projects/rodeo-app-fac50/secrets/EMAIL_VERIFY_JWT_SECRET:latest"

echo "✅ Deploy de Pre-Producción completado!"
echo "   URL: ${PREPROD_URL}"
