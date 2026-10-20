FROM node:22-slim

# Chromium + fonts for Puppeteer PDF export (workflow builder)
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_NO_SANDBOX=1 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts reads DATABASE_URL; a placeholder is enough for `prisma generate` at build time
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci

COPY . .

# NEXT_PUBLIC_* values are inlined at build time; Railway passes service variables as build args
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply pending (additive) workflow-builder migrations, then start. A failed migration is logged
# but does not stop the portal from starting.
CMD ["sh", "-c", "npm run db:deploy || echo 'WARNING: prisma migrate deploy failed; continuing'; exec npm start"]
