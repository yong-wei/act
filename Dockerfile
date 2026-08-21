# Base image
FROM node:20-alpine AS base
ARG APK_MIRROR=https://mirrors.aliyun.com/alpine
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories \
  && apk add --no-cache libc6-compat openssl curl python3 py3-pip unzip

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
ARG APP_REVISION
ARG NODE_MAX_OLD_SPACE_SIZE=12288
RUN apk add --no-cache python3
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure Authority / Teaching Projection store roots exist for runner packaging
# even when the build context has not activated a gate output yet (#1274).
RUN mkdir -p \
  course-content/authoring/knowledge/authority \
  course-content/runtime/knowledge/authority-domain-shards \
  course-content/runtime/knowledge/projection
RUN case "${APP_REVISION}" in \
    [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;; \
    *) echo "APP_REVISION must be one 40-character lowercase Git commit" >&2; exit 1 ;; \
  esac \
  && printf '%s\n' "${APP_REVISION}" > /app/.app-revision

# The cutover verifier checks this marker in the loaded immutable image. It is
# deliberately generated inside the builder from the same source tree as the
# application so a stale image cannot pass by merely carrying a matching
# revision label.
RUN test -f src/features/knowledge/active-authority-graph.tsx \
  && test -f src/features/knowledge/active-authority-shard-store.ts \
  && test -f src/lib/authority-domain-shards/materialize.ts \
  && test -f src/app/api/knowledge/shards/active/route.ts \
  && test -f course-content/runtime/knowledge/authority-learning-content-manifest.json \
  && test -f course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json \
  && grep -q '/api/knowledge/shards/active' src/features/knowledge/active-authority-graph.tsx \
  && printf '%s\n' "${APP_REVISION}" > /app/.active-authority-shards-product

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}
ENV NODE_MAX_OLD_SPACE_SIZE=${NODE_MAX_OLD_SPACE_SIZE}
ENV SKIP_WASM_BUILD=1

# Build the application
RUN --mount=type=secret,id=database_url,required=false \
  DATABASE_URL="$(cat /run/secrets/database_url 2>/dev/null || true)" \
  && DATABASE_URL="${DATABASE_URL:-postgresql://prisma-generate:prisma-generate@localhost:5432/prisma_generate}" npm run build

# Wolfram Engine 供给：只从官方镜像取可执行运行时，激活凭据不进入镜像。
FROM wolframresearch/wolframengine:15.0 AS wolfram-provider
RUN set -eu; \
  WOLFRAM_ROOT=""; \
  if [ -d /usr/local/Wolfram ]; then WOLFRAM_ROOT=/usr/local/Wolfram; \
  elif [ -d /opt/Wolfram ]; then WOLFRAM_ROOT=/opt/Wolfram; \
  else echo "Wolfram Engine not found in official wolframresearch/wolframengine image" >&2; exit 1; \
  fi; \
  mkdir -p /wolfram-runtime /wolframscript-bin; \
  cp -a "$WOLFRAM_ROOT/." /wolfram-runtime/; \
  if command -v wolframscript >/dev/null 2>&1; then \
    WOLFRAMSCRIPT_DIR="$(dirname "$(readlink -f "$(command -v wolframscript)")")"; \
    cp -a "$WOLFRAMSCRIPT_DIR/." /wolframscript-bin/; \
  fi

# Runner stage
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ARG APP_REVISION

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV RUN_MIGRATIONS_ON_START=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV APP_REVISION=${APP_REVISION}
ENV HOME=/home/nextjs

# BuildKit otherwise installs the large browser/office runtime in parallel with
# the memory-intensive Next.js build. This copy is an explicit stage barrier.
COPY --from=builder /app/package.json /tmp/builder-package.json
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl openssl unzip ca-certificates python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
RUN apt-get update \
  && (apt-get install -y --no-install-recommends chromium libreoffice libreoffice-writer \
      || apt-get install -y --no-install-recommends chromium-browser libreoffice libreoffice-writer) \
  && apt-get install -y \
    libfontconfig1 libfreetype6 libx11-6 libxcb1 libxcb-icccm4 \
    libxcb-image0 libxcb-keysyms1 libxcb-render-util0 libxcb-xfixes0 \
    libxext6 libxkbcommon0 libxkbcommon-x11-0 fonts-liberation \
  && rm /tmp/builder-package.json \
  && rm -rf /var/lib/apt/lists/*

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /home/nextjs && chown nextjs:nodejs /home/nextjs && usermod -d /home/nextjs nextjs

# Wolfram Engine 可执行运行时来自官方镜像；激活凭据只允许由运行环境 secret
# 提供，绝不写入镜像或仓库。
COPY --from=wolfram-provider /wolfram-runtime /usr/local/Wolfram
COPY --from=wolfram-provider /wolframscript-bin/. /opt/wolframscript-bin/
RUN find /usr/local/Wolfram -type f -name wolfram -exec ln -sf {} /usr/local/bin/wolfram \; ; \
  find /usr/local/Wolfram -type f -name wolframscript -exec ln -sf {} /usr/local/bin/wolframscript \; ; \
  if [ -x /opt/wolframscript-bin/wolframscript ]; then ln -sf /opt/wolframscript-bin/wolframscript /usr/local/bin/wolframscript; fi ; \
  test -x /usr/local/bin/wolframscript && test -x /usr/local/bin/wolfram

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
COPY --from=builder /app/scripts/actkg-release ./scripts/actkg-release
COPY --from=builder /app/scripts/course-coverage ./scripts/course-coverage
COPY --from=builder /app/scripts/knowledge ./scripts/knowledge
COPY --from=builder /app/scripts/assignments ./scripts/assignments
COPY --from=builder /app/scripts/lib ./scripts/lib
COPY --from=builder /app/scripts/workers ./scripts/workers
COPY --from=builder /app/scripts/math-calc ./scripts/math-calc
COPY --from=builder /app/course-content/authoring/knowledge/releases ./course-content/authoring/knowledge/releases
COPY --from=builder /app/course-content/authoring/knowledge/course-coverage ./course-content/authoring/knowledge/course-coverage
COPY --from=builder /app/course-content/runtime/resource-governance/runtime-resource-projections.jsonl ./course-content/runtime/resource-governance/runtime-resource-projections.jsonl
# Authority + Teaching Projection stores selected by activation gate (#1274).
# Builder materializes these directories (empty scaffold when no activation
# output is present) so COPY is stable; production mounts via
# ACT_AUTHORITY_STORE_ROOT / ACT_TEACHING_PROJECTION_STORE_ROOT or build-time
# packaging of current.json + releases make Konling teaching context reachable.
COPY --from=builder /app/course-content/authoring/knowledge/authority ./course-content/authoring/knowledge/authority
COPY --from=builder /app/course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json ./course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json
COPY --from=builder /app/course-content/runtime/knowledge/authority-domain-shards ./course-content/runtime/knowledge/authority-domain-shards
COPY --from=builder /app/course-content/runtime/knowledge/authority-learning-content-manifest.json ./course-content/runtime/knowledge/authority-learning-content-manifest.json
COPY --from=builder /app/course-content/runtime/knowledge/cards/authority ./course-content/runtime/knowledge/cards/authority
COPY --from=builder /app/course-content/runtime/knowledge/infographs/authority ./course-content/runtime/knowledge/infographs/authority
COPY --from=builder /app/course-content/runtime/knowledge/projection ./course-content/runtime/knowledge/projection
# Production keeps candidate releases/receipts but never packages an authority
# or teaching-projection current pointer without an explicit production cutover.
RUN rm -f \
  course-content/authoring/knowledge/authority/current.json \
  course-content/runtime/knowledge/authority-domain-shards/current.json \
  course-content/runtime/knowledge/projection/current.json \
  && test -f course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json
COPY --from=builder /app/.app-revision ./.app-revision
COPY --from=builder /app/.active-authority-shards-product ./.active-authority-shards-product

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next
RUN chmod +x scripts/math-calc/check-wolfram-ready.sh

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
