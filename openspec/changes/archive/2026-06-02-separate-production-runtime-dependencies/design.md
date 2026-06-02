## Production Boundary

Current production behavior:

```text
Docker deps stage
  npm ci
    |
runner stage
  copies full node_modules
    |
worker role
  ./node_modules/.bin/tsx scripts/workers/data-governance-worker.ts
    |
scheduler initialization
  ./node_modules/.bin/tsx scripts/workers/scheduler.ts
```

This change should choose one production contract:

- Preferred: compile worker and scheduler TypeScript to JavaScript during build, then run `node` in production.
- Acceptable fallback: keep `tsx` as an explicit production dependency and record why production-only install is not supported yet.

## Dependency Classification

Pure type packages, test runners, lint tooling, build-only CSS tooling, and script runners should be classified as dev dependencies unless a production entrypoint proves otherwise.

## Validation Focus

Validation should prove that:

- Local development scripts still run.
- Docker/Podman startup uses the selected runtime path.
- Worker and scheduler startup do not depend on missing dev-only packages.
- `npm ci --omit=dev` behavior is either supported or explicitly documented as unsupported.
