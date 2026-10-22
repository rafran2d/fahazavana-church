FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
# En dev, les migrations sont lancées à la main (voir README). En prod : prisma migrate deploy.
CMD ["sh", "-c", "npx prisma migrate deploy || true; node dist/main.js"]
