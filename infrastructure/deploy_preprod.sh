#!/bin/bash
set -e

# Deploy script for Pre-Production (Staging) - Fort Knox Architecture
# Deploys Backend (Internal), Parser (Internal), and Frontend (Public)

REGION="southamerica-east1"
PROJECT_ID="rodeo-app-fac50"
PREPROD_DOMAIN="staging.rodeoagtech.com"

# 1. BUILD AND DEPLOY EXPRESS BACKEND (INTERNAL ONLY)
echo "▶ Construyendo y desplegando Backend (Express) en Cloud Run [Internal]..."
gcloud builds submit ./backend --tag gcr.io/$PROJECT_ID/rodeo-backend-preprod
gcloud run deploy rodeo-backend-preprod \
  --image gcr.io/$PROJECT_ID/rodeo-backend-preprod \
  --region $REGION \
  --platform managed \
  --ingress internal \
  --no-allow-unauthenticated \
  --update-secrets="DATABASE_URL=rodeo-db-url-preprod:latest"

# Obtener la URL interna del backend
BACKEND_INTERNAL_URL=$(gcloud run services describe rodeo-backend-preprod --region $REGION --format 'value(status.url)')

# 2. BUILD AND DEPLOY PYTHON PARSER (INTERNAL ONLY)
echo "▶ Construyendo y desplegando Parser (Python) en Cloud Run [Internal]..."
gcloud builds submit ./parser_service --tag gcr.io/$PROJECT_ID/rodeo-parser-preprod
gcloud run deploy rodeo-parser-preprod \
  --image gcr.io/$PROJECT_ID/rodeo-parser-preprod \
  --region $REGION \
  --platform managed \
  --ingress internal \
  --no-allow-unauthenticated

# Obtener la URL interna del parser
PARSER_INTERNAL_URL=$(gcloud run services describe rodeo-parser-preprod --region $REGION --format 'value(status.url)')

# 3. BUILD AND DEPLOY NEXT.JS FRONTEND (PUBLIC)
echo "▶ Construyendo y desplegando Frontend (Next.js) en Cloud Run [Public]..."
gcloud builds submit ./frontend --tag gcr.io/$PROJECT_ID/rodeo-frontend-preprod
gcloud run deploy rodeo-frontend-preprod \
  --image gcr.io/$PROJECT_ID/rodeo-frontend-preprod \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="BACKEND_URL=${BACKEND_INTERNAL_URL},PARSER_URL=${PARSER_INTERNAL_URL},NEXT_PUBLIC_APP_URL=https://${PREPROD_DOMAIN}" \
  --update-secrets="DATABASE_URL=rodeo-db-url-preprod:latest,RESEND_API_KEY=resend-api-key-preprod:latest,FIREBASE_ADMIN_CREDENTIALS_BASE64=firebase-sa-key-preprod:latest"

# 4. CONFIGURAR DOMINIO
echo "▶ Configurando mapeo de dominio..."
gcloud beta run domain-mappings create --service rodeo-frontend-preprod --domain $PREPROD_DOMAIN --region $REGION || true

echo "✅ Despliegue de Pre-Producción completado exitosamente con Arquitectura Zero Trust."
