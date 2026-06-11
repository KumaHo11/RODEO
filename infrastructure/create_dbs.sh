#!/bin/bash
set -e

# Configuración
REGION="southamerica-east1"
DB_PREPROD="rodeo-db-preprod"
DB_PROD="rodeo-db-prod"
DB_USER="postgres"
# Generar passwords aleatorios seguros
PREPROD_PASS=$(openssl rand -base64 12)
PROD_PASS=$(openssl rand -base64 12)

echo "▶ Creando instancia de Pre-producción ($DB_PREPROD)..."
gcloud sql instances create $DB_PREPROD --database-version=POSTGRES_15 --cpu=1 --memory=3840MB --region=$REGION --root-password="$PREPROD_PASS"
gcloud sql databases create rodeo --instance=$DB_PREPROD

echo "▶ Creando instancia de Producción ($DB_PROD)..."
gcloud sql instances create $DB_PROD --database-version=POSTGRES_15 --cpu=2 --memory=7680MB --region=$REGION --root-password="$PROD_PASS"
gcloud sql databases create rodeo --instance=$DB_PROD

echo "✅ Bases de datos creadas exitosamente."
echo "============================================="
echo "PRE-PRODUCCIÓN PASSWORD: $PREPROD_PASS"
echo "PRODUCCIÓN PASSWORD: $PROD_PASS"
echo "============================================="
echo "Por favor, guarda estas contraseñas en un lugar seguro (Google Secret Manager)."
