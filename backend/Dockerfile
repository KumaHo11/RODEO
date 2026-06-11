FROM node:18-alpine

WORKDIR /app

# Copiamos primero package.json para aprovechar caché de capas
COPY package*.json ./

# Instalamos dependencias de producción
RUN npm ci --only=production

# Copiamos el código fuente
COPY . .

# Puerto expuesto por defecto en Cloud Run
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
