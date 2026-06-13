#!/bin/bash
set -e

# Configuración de Entorno de Producción
PROJECT_ID="rodeo-app-prod"
REGION="southamerica-east1"
DB_INSTANCE="rodeo-db-prod"

echo "====================================================="
echo "Configurando Entorno Productivo: $PROJECT_ID"
echo "====================================================="

# 1. Habilitar APIs necesarias
echo "[1/4] Habilitando APIs..."
gcloud services enable sqladmin.googleapis.com monitoring.googleapis.com secretmanager.googleapis.com --project=$PROJECT_ID

# 2. Configurar Backups Automatizados y PITR en Cloud SQL
echo "[2/4] Configurando Backups y PITR en Cloud SQL ($DB_INSTANCE)..."
# Asumimos que la instancia ya existe. Si no, habría que crearla.
gcloud sql instances patch $DB_INSTANCE \
    --project=$PROJECT_ID \
    --backup-start-time="03:00" \
    --enable-bin-log \
    --enable-point-in-time-recovery || echo "Advertencia: No se pudo configurar PITR. Asegúrese de que la instancia $DB_INSTANCE existe."

# 3. Configurar Alertas de Monitoreo Básico (Cloud Monitoring)
echo "[3/4] Configurando Alertas de Monitoreo..."

# Alerta: Alto uso de CPU en la BD (> 80%)
gcloud alpha monitoring policies create \
    --project=$PROJECT_ID \
    --display-name="High CPU Usage - DB Prod" \
    --condition-filter="metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" AND resource.type=\"cloudsql_database\"" \
    --condition-threshold-value=0.8 \
    --condition-threshold-duration="300s" \
    --combiner="OR" || true

# Alerta: Errores HTTP 5xx en Cloud Run
gcloud alpha monitoring policies create \
    --project=$PROJECT_ID \
    --display-name="High 5xx Error Rate - Cloud Run Prod" \
    --condition-filter="metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND metric.labels.response_code_class=\"5xx\"" \
    --condition-threshold-value=10 \
    --condition-threshold-duration="300s" \
    --combiner="OR" || true

# 4. Configurar Retención en Cloud Storage (Opcional para backups de media)
echo "[4/4] Configurando ciclo de vida en Storage..."
echo '{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365}
    }
  ]
}' > /tmp/lifecycle.json
gcloud storage buckets update gs://rodeo-media-prod --lifecycle-file=/tmp/lifecycle.json --project=$PROJECT_ID || true

echo "====================================================="
echo "Configuración de infraestructura productiva finalizada."
echo "====================================================="
