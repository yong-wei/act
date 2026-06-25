# Base image
FROM node:20-alpine AS base
ARG APK_MIRROR=https://mirrors.aliyun.com/alpine
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories \
  && apk add --no-cache libc6-compat openssl curl

# Dependencies stage
FROM base AS deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ARG PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/root/.cache/prisma \
  npm config set registry ${NPM_REGISTRY} \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && if [ -n "${PRISMA_ENGINES_MIRROR}" ]; then export PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}; fi \
  && if [ -n "${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING}" ]; then export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING}; fi \
  && npm config get registry \
  && echo "PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}" \
  && echo "PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING}" \
  && (npm ci --prefer-offline \
    || (npm config set registry https://registry.npmjs.org && npm ci --prefer-offline))

# Production dependencies stage
FROM base AS prod-deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
ARG PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/root/.cache/prisma \
  npm config set registry ${NPM_REGISTRY} \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && if [ -n "${PRISMA_ENGINES_MIRROR}" ]; then export PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}; fi \
  && if [ -n "${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING}" ]; then export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING}; fi \
  && (npm ci --omit=dev --prefer-offline \
    || (npm config set registry https://registry.npmjs.org && npm ci --omit=dev --prefer-offline))

# Builder stage
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache python3
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_WASM_BUILD=1

# Build the application
RUN --mount=type=secret,id=database_url,required=false \
  DATABASE_URL="$(cat /run/secrets/database_url 2>/dev/null || true)" \
  && DATABASE_URL="${DATABASE_URL:-postgresql://prisma-generate:prisma-generate@localhost:5432/prisma_generate}" npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV RUN_MIGRATIONS_ON_START=1

RUN apk add --no-cache chromium

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts/db ./scripts/db
COPY --from=builder /app/scripts/lib ./scripts/lib
COPY --from=builder /app/scripts/workers ./scripts/workers

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
