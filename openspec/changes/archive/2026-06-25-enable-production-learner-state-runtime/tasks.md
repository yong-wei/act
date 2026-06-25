## 1. Production Configuration

- [x] 1.1 Add `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` to `.env.example`.
- [x] 1.2 Add `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` to `deploy/podman/.env.server.example`.
- [x] 1.3 Update `deploy/podman/deploy.sh` so app and worker containers receive the learner-state flag.
- [x] 1.4 Update deploy-script tests or add a focused script check for learner-state flag injection.

## 2. Learner-State Runtime Semantics

- [x] 2.1 Verify learner-state read behavior distinguishes service disabled, no evidence, no active path, stale evidence, and read failure.
- [x] 2.2 Add tests for production-enabled learner-state reads with sparse student data.
- [x] 2.3 Ensure worker-facing evidence/cache tasks do not assume learner-state is disabled in production.

## 3. Konling Personalization Degradation

- [x] 3.1 Add Konling runtime tests for available learner-state shaping answer metadata.
- [x] 3.2 Add tests proving missing learner-state still allows teaching-content citations.
- [x] 3.3 Add tests proving missing path execution is only a personalization limitation for non-path concept explanation.
- [x] 3.4 Add tests for path advice where missing path execution is disclosed as limited personalization.

## 4. Production Verification Plan

- [x] 4.1 Document the post-merge production env update and app/worker redeploy checklist.
- [x] 4.2 Document how operators verify container env includes `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true`.
- [x] 4.3 Document how operators verify `/api/readyz` and learner-state route behavior after deployment.
- [x] 4.4 Document how operators verify Konling graph concept explanation returns cited content with sparse learner data after deployment.
- [x] 4.5 Run `rtk openspec validate enable-production-learner-state-runtime --strict`.
