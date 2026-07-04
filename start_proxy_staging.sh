#!/bin/bash
echo "Iniciando Cloud SQL Auth Proxy para STAGING..."
echo "Asegúrate de haber iniciado sesión con: gcloud auth application-default login"
echo ""
./tools/cloud-sql-proxy rodeo-app-fac50:southamerica-east1:rodeo-db-preprod
