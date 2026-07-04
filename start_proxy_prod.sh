#!/bin/bash
echo "Iniciando Cloud SQL Auth Proxy para Producción..."
echo "Asegúrate de haber iniciado sesión con: gcloud auth application-default login"
echo ""
./tools/cloud-sql-proxy rodeo-app-prod-v1:southamerica-east1:rodeo-db-prod
