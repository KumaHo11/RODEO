#!/bin/bash
# ── Deploy a Staging ────────────────────────────────────────────────────────
# Uso: ./build.sh
#
# REGLA CLAVE:
#   - NEXT_PUBLIC_FIREBASE_* → build args (se hornean en el bundle del cliente)
#   - Todo lo demás (DATABASE_URL, SENDGRID, FIREBASE_ADMIN, etc.) → runtime env vars
#   - LOCAL usa .env.local / STAGING usa Cloud Run env vars
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Cargar vars del entorno local (para las Firebase client keys del build)
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)

STAGING_IMAGE="southamerica-east1-docker.pkg.dev/rodeo-app-fac50/rodeo-staging/frontend:latest"
STAGING_URL="https://rodeo-staging-h5m2n7txya-rj.a.run.app"

echo "▶ Building image con Firebase client keys..."
docker build --platform linux/amd64 \
  -t "$STAGING_IMAGE" \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  --build-arg NEXT_PUBLIC_APP_URL="${STAGING_URL}" \
  -f Dockerfile .

echo "▶ Pushing image to Artifact Registry..."
docker push "$STAGING_IMAGE"

FIREBASE_ADMIN_CREDENTIALS_B64=$(python3 -c "
import base64, json
with open('firebase-sa-key.json') as f:
    data = json.load(f)
print(base64.b64encode(json.dumps(data).encode()).decode())
")

echo "▶ Deploying to Cloud Run con todas las env vars de runtime..."
gcloud run deploy rodeo-staging \
  --image "$STAGING_IMAGE" \
  --region southamerica-east1 \
  --platform managed \
  --set-env-vars \
"NEXT_PUBLIC_APP_URL=${STAGING_URL},\
DATABASE_URL=postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo,\
SENDGRID_API_KEY=${SENDGRID_API_KEY},\
SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL},\
FIREBASE_ADMIN_PROJECT_ID=${FIREBASE_ADMIN_PROJECT_ID},\
FIREBASE_ADMIN_IMPERSONATE_SA=${FIREBASE_ADMIN_IMPERSONATE_SA},\
GEMINI_API_KEY=${GEMINI_API_KEY},\
FIREBASE_ADMIN_CREDENTIALS_BASE64=${FIREBASE_ADMIN_CREDENTIALS_B64}"

echo "✅ Deploy completado!"
echo "   URL: ${STAGING_URL}"
