## Why

Konling is intended to use server-owned learner state in production, but the production container currently does not receive `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true`. Even when learner data is sparse or absent, Konling must still produce cited content-grounded replies while using available learner evidence to personalize tone, scope, and recommendations.

## What Changes

- Treat the learner-state service as a production runtime requirement rather than an optional disabled feature.
- Inject `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` through production app and worker container configuration.
- Update environment examples and deployment checks so future deployments keep learner-state enabled.
- Ensure missing learner-state rows or path-execution rows are represented as personalization limitations, not answer-generation failures.
- Keep content citation generation available regardless of learner-state completeness.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learner-state-service`: Production runtime must enable server-owned learner-state reads and return explicit no-data states instead of disabling the service.
- `konling-agent-runtime`: Konling must consume learner-state when available and degrade personalization without blocking content citations when learner-state or path execution is absent.

## Impact

- Deployment scripts and env examples: `deploy/podman/deploy.sh`, `.env.example`, `deploy/podman/.env.server.example`.
- Runtime and tests: `src/lib/data-governance/adaptive-learner-state-service.ts`, `src/lib/konling-agent-runtime.ts`, production/deploy validation tests, learner-state route tests, Konling runtime tests.
- Operations: production environment must include `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` before redeploy.
