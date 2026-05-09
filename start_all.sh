#!/bin/bash

# Script para levantar todo el entorno de RODEO localmente
# Asegurarse de que el script se ejecute desde la raíz del proyecto

ROOT_DIR=$(pwd)
echo "🚀 Iniciando entorno RODEO en $ROOT_DIR..."

# 1. Frontend
echo "📂 Iniciando Frontend en localhost:3000..."
(cd "$ROOT_DIR/frontend" && npm run dev) &

# 2. Backend
echo "📂 Iniciando Backend en localhost:3001..."
(cd "$ROOT_DIR/backend" && node index.js) &

# 3. Parser Service
echo "📂 Iniciando Parser Service en localhost:8000..."
if [ -d "$ROOT_DIR/parser_service" ]; then
    (
        cd "$ROOT_DIR/parser_service"
        if [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
            uvicorn app.main:app --host 0.0.0.0 --port 8000
        else
            echo "⚠️ No se encontró el venv en parser_service"
        fi
    ) &
else
    echo "⚠️ No se encontró el directorio parser_service"
fi

echo "✅ Todos los servicios se están iniciando en segundo plano."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Parser: http://localhost:8000"

wait
