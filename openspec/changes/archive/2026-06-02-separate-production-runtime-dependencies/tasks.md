## 1. Runtime Boundary

- [x] 1.1 Audit production entrypoints for direct development-tool usage.
- [x] 1.2 Decide whether worker/scheduler should run compiled JavaScript or keep `tsx` as a production dependency.
- [x] 1.3 Update Docker and Podman startup paths to match the selected contract.
- [x] 1.4 Reclassify dependencies only when runtime evidence supports the move.

## 2. Production Validation

- [x] 2.1 Run `rtk npm run test`.
- [x] 2.2 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 2.3 Run the production build path, including `rtk npm run build` or the repository Docker build wrapper.
- [x] 2.4 Validate worker and scheduler startup through the available local Podman/Docker readiness checks.
- [x] 2.5 If production-only install is supported, verify the selected `npm ci --omit=dev` path; otherwise document the blocker.

## 3. OpenSpec Validation

- [x] 3.1 Run `rtk openspec validate separate-production-runtime-dependencies --strict`.

## Evidence

- Runtime entrypoints audited: `deploy/podman/container-start-wrapper.sh` starts the worker through `./node_modules/.bin/tsx scripts/workers/data-governance-worker.ts`; `deploy/podman/deploy.sh` initializes the scheduler through `./node_modules/.bin/tsx scripts/workers/scheduler.ts`; `docker-entrypoint.sh` runs `node ./node_modules/prisma/build/index.js migrate deploy`.
- Selected contract: keep `tsx` and `prisma` as explicit production runtime dependencies for this change. A compiled JavaScript worker path would require a new script bundling and path-alias resolution chain, so it is not the minimal safe migration step.
- Docker runner boundary: `Dockerfile` now builds production `node_modules` with `npm ci --omit=dev --prefer-offline` in `prod-deps` and copies that dependency tree into the runner image.
- Dependency classification: `tsx` and `prisma` moved from `devDependencies` to `dependencies` because production worker, scheduler, and migration entrypoints use them.
- Validation passed: `rtk npm run test`, `rtk npx tsc --noEmit --pretty false`, `rtk npm run build`, `rtk npm run test:docker-migration-readiness`, `rtk node ./scripts/tests/test-podman-dns-readiness-guard.mjs`, `rtk node ./scripts/tests/test-data-governance-deploy-guardrails.mjs`.
- Production-only install passed in a temporary directory with `npm ci --omit=dev --ignore-scripts --prefer-offline`; verified `./node_modules/.bin/tsx --version`, `node ./node_modules/prisma/build/index.js --version`, and `npm ls --omit=dev --depth=0 prisma tsx`.
- Local Docker/Podman runtime checks are unavailable in this worktree environment because neither `docker` nor `podman` is installed.
