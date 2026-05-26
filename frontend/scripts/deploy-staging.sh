#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# RODEO — Deploy a staging en GCP Cloud Run
# Uso: ./scripts/deploy-staging.sh [PROJECT_ID]
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_ID="${1:-rodeo-app-fac50}"
REGION="southamerica-east1"
SERVICE_NAME="rodeo-staging"
REGISTRY="$REGION-docker.pkg.dev"
IMAGE="$REGISTRY/$PROJECT_ID/rodeo-images/rodeo-frontend:staging"
STAGING_URL="https://rodeo-staging-831756494147.southamerica-east1.run.app"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🐄 RODEO — Deploy to Staging"
echo "  Proyecto: $PROJECT_ID | Imagen: $IMAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Config GCP ───────────────────────────────────────────────────────────────
echo "▶ [1/5] Configurando GCP..."
gcloud config set project $PROJECT_ID --quiet
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# ── Enable APIs ───────────────────────────────────────────────────────────────
echo "▶ [2/5] Habilitando APIs..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --quiet 2>/dev/null || true

# ── Artifact Registry ─────────────────────────────────────────────────────────
echo "▶ [3/5] Artifact Registry..."
gcloud artifacts repositories describe rodeo-images --location=$REGION --project=$PROJECT_ID 2>/dev/null || \
gcloud artifacts repositories create rodeo-images \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID \
  --description="RODEO Docker images" --quiet

# ── Cargar .env.local ─────────────────────────────────────────────────────────
echo "▶ [4/5] Cargando variables de .env.local..."
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
  echo "  ✓ .env.local cargado"
else
  echo "  ⚠️  No se encontró .env.local"
fi

# ── Docker Build + Push ───────────────────────────────────────────────────────
echo "▶ [5/5] Docker build + push..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --build-arg NEXT_PUBLIC_APP_URL="$STAGING_URL" \
  -t $IMAGE \
  .

docker push $IMAGE

# ── Deploy Cloud Run ──────────────────────────────────────────────────────────
echo "▶ Desplegando en Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --platform=managed \
  --region=$REGION \
  --project=$PROJECT_ID \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="NEXT_PUBLIC_APP_URL=$STAGING_URL" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --set-env-vars="FIREBASE_ADMIN_PROJECT_ID=$FIREBASE_ADMIN_PROJECT_ID" \
  --set-env-vars="FIREBASE_ADMIN_CREDENTIALS_BASE64=$FIREBASE_ADMIN_CREDENTIALS_BASE64" \
  --set-env-vars="FIREBASE_ADMIN_IMPERSONATE_SA=$FIREBASE_ADMIN_IMPERSONATE_SA" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --set-env-vars="GCS_BUCKET_NAME=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY" \
  --set-env-vars="RESEND_API_KEY=$RESEND_API_KEY" \
  --set-env-vars="RESEND_FROM_EMAIL=$RESEND_FROM_EMAIL" \
  --set-env-vars="TITILER_URL=$TITILER_URL" \
  --quiet

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deploy completado!"
echo "  🌐 URL: $STAGING_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
