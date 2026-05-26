#!/bin/bash
set -e

# Leer variables de entorno desde .env.local
source .env.local

echo "📝 Generando cloudbuild.yaml temporal..."
cat << 'EOF' > cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--platform'
      - 'linux/amd64'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_API_KEY=${_NEXT_PUBLIC_FIREBASE_API_KEY}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_PROJECT_ID=${_NEXT_PUBLIC_FIREBASE_PROJECT_ID}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}'
      - '--build-arg'
      - 'NEXT_PUBLIC_FIREBASE_APP_ID=${_NEXT_PUBLIC_FIREBASE_APP_ID}'
      - '--build-arg'
      - 'NEXT_PUBLIC_APP_URL=${_NEXT_PUBLIC_APP_URL}'
      - '-t'
      - 'southamerica-east1-docker.pkg.dev/rodeo-app-fac50/rodeo-images/rodeo-frontend:manual-deploy'
      - '.'
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'southamerica-east1-docker.pkg.dev/rodeo-app-fac50/rodeo-images/rodeo-frontend:manual-deploy']
images:
  - 'southamerica-east1-docker.pkg.dev/rodeo-app-fac50/rodeo-images/rodeo-frontend:manual-deploy'
EOF

echo "🚀 Iniciando build en GCP Cloud Build..."
gcloud builds submit --config cloudbuild.yaml \
  --project rodeo-app-fac50 \
  --region southamerica-east1 \
  --timeout 1h \
  --substitutions _NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",_NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}",_NEXT_PUBLIC_APP_URL="https://rodeo-staging-831756494147.southamerica-east1.run.app"

echo "✅ Build exitoso. Iniciando deploy a Cloud Run..."

gcloud run deploy rodeo-staging \
  --image=southamerica-east1-docker.pkg.dev/rodeo-app-fac50/rodeo-images/rodeo-frontend:manual-deploy \
  --platform=managed \
  --region=southamerica-east1 \
  --project=rodeo-app-fac50 \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="NEXT_PUBLIC_APP_URL=https://rodeo-staging-831756494147.southamerica-east1.run.app" \
  --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars="FIREBASE_ADMIN_PROJECT_ID=rodeo-app-fac50" \
  --set-env-vars="FIREBASE_ADMIN_CREDENTIALS_BASE64=${FIREBASE_ADMIN_CREDENTIALS_BASE64}" \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars="RESEND_API_KEY=${RESEND_API_KEY}" \
  --set-env-vars="RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}" \
  --quiet

echo "🎉 Deploy completado con éxito."
