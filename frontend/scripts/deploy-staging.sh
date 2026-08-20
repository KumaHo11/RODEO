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
STAGING_URL="https://staging.rodeoagtech.com"

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

# ── Generar env vars YAML (evita truncado de = en base64 con --set-env-vars) ──
echo "▶ Generando env vars YAML..."
python3 - <<PYEOF
import os, json
def q(v): return json.dumps(str(v))
# NOTA: FIREBASE_ADMIN_CREDENTIALS_BASE64 se omite aquí porque está
# almacenado como Secret Manager reference en Cloud Run (no como literal).
# Se mantiene via --update-secrets en el gcloud run deploy.
lines = [
  f'NODE_ENV: production',
  f'NEXT_PUBLIC_APP_URL: {q("$STAGING_URL")}',
  f'DATABASE_URL: {q(os.environ.get("DATABASE_URL",""))}',
  f'DATABASE_URL_SERVICE: {q(os.environ.get("DATABASE_URL_SERVICE",""))}',
  f'FIREBASE_ADMIN_PROJECT_ID: {q(os.environ.get("FIREBASE_ADMIN_PROJECT_ID",""))}',
  f'FIREBASE_ADMIN_IMPERSONATE_SA: {q(os.environ.get("FIREBASE_ADMIN_IMPERSONATE_SA",""))}',
  f'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: {q(os.environ.get("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",""))}',
  f'GCS_BUCKET_NAME: {q("rodeo-media")}',
  f'GCS_EUDR_BUCKET_NAME: {q("rodeo-eudr-docs")}',
  f'GEMINI_API_KEY: {q(os.environ.get("GEMINI_API_KEY",""))}',
  f'RESEND_API_KEY: {q(os.environ.get("RESEND_API_KEY",""))}',
  f'RESEND_FROM_EMAIL: {q(os.environ.get("RESEND_FROM_EMAIL",""))}',
  f'TITILER_URL: {q(os.environ.get("TITILER_URL",""))}',
  f'EMAIL_VERIFY_JWT_SECRET: {q(os.environ.get("EMAIL_VERIFY_JWT_SECRET",""))}',
  f'NEXT_PUBLIC_SUPPORT_EMAIL: {q(os.environ.get("NEXT_PUBLIC_SUPPORT_EMAIL",""))}',
  f'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: {q(os.environ.get("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",""))}',
  f'MERCADOPAGO_ACCESS_TOKEN: {q(os.environ.get("MERCADOPAGO_ACCESS_TOKEN",""))}',
  f'MERCADOPAGO_WEBHOOK_SECRET: {q(os.environ.get("MERCADOPAGO_WEBHOOK_SECRET",""))}',
  f'CONTACT_FORM_DESTINATION_EMAILS: {q(os.environ.get("CONTACT_FORM_DESTINATION_EMAILS",""))}',
]
with open('/tmp/rodeo-staging-env.yaml','w') as f: f.write('\n'.join(lines))
print('  ✓ /tmp/rodeo-staging-env.yaml generado')
PYEOF

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
  --env-vars-file=/tmp/rodeo-staging-env.yaml \
  --update-secrets=FIREBASE_ADMIN_CREDENTIALS_BASE64=FIREBASE_ADMIN_CREDENTIALS_BASE64:latest \
  --quiet

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deploy completado!"
echo "  🌐 URL: $STAGING_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
