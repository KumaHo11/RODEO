#!/bin/bash
set -e

echo "🚀 Iniciando build en GCP Cloud Build para PRODUCCIÓN..."
gcloud builds submit --config cloudbuild_prod.yaml \
  --project rodeo-app-prod-v1 \
  --region southamerica-east1 \
  --timeout 1h \
  --substitutions _NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyByVN_Lr8nn32_21DbspDAhdup3WUmbO7U",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="rodeo-app-prod-v1.firebaseapp.com",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="rodeo-app-prod-v1",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="rodeo-app-prod-v1.firebasestorage.app",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="742778588748",_NEXT_PUBLIC_FIREBASE_APP_ID="1:742778588748:web:194508070e2cc46cfbaee9",_NEXT_PUBLIC_APP_URL="https://rodeoagtech.com"

echo "✅ Build exitoso. Iniciando deploy a Cloud Run PRODUCCIÓN..."

gcloud run deploy rodeo-prod \
  --image southamerica-east1-docker.pkg.dev/rodeo-app-prod-v1/rodeo-images/frontend:latest \
  --region southamerica-east1 \
  --platform managed \
  --project rodeo-app-prod-v1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_APP_URL=https://rodeoagtech.com" \
  --update-secrets="DATABASE_URL=projects/rodeo-app-prod-v1/secrets/rodeo-db-url:latest,RESEND_API_KEY=projects/rodeo-app-prod-v1/secrets/resend-api-key:latest,FIREBASE_ADMIN_CREDENTIALS_BASE64=projects/rodeo-app-prod-v1/secrets/firebase-sa-key:latest,GEMINI_API_KEY=projects/rodeo-app-prod-v1/secrets/gemini-api-key:latest,EMAIL_VERIFY_JWT_SECRET=projects/rodeo-app-prod-v1/secrets/EMAIL_VERIFY_JWT_SECRET:latest"

echo "🎉 Deploy de PRODUCCIÓN completado con éxito."
