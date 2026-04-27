#!/bin/bash

# Script para levantar todo el entorno de RODEO localmente

echo "🚀 Iniciando entorno RODEO..."

# 1. Frontend
echo "📂 Iniciando Frontend en localhost:3000..."
cd frontend && npm run dev &

# 2. Backend
echo "📂 Iniciando Backend en localhost:3001..."
cd ../backend && node index.js &

# 3. Parser Service
echo "📂 Iniciando Parser Service en localhost:8000..."
cd ../parser_service
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

echo "✅ Todos los servicios se están iniciando en segundo plano."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Parser: http://localhost:8000"

wait
