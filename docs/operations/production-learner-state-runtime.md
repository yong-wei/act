# Production Learner-State Runtime Verification

This checklist separates PR-contained evidence from post-merge production operations. Do not mark the production operations complete until the merged integration build is deployed.

## PR Evidence

- `.env.example` and `deploy/podman/.env.server.example` declare `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true`.
- `deploy/podman/deploy.sh` defaults `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED` to `true` and injects it through `SHARED_ENV_ARGS` so both app and worker containers receive the same value.
- The flag is not persisted to the generated runtime env file, so operators can still set `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=false` in `/home/projects/act/.env` for emergency rollback.
- Existing generated runtime env files that still contain the flag are ignored for this setting; `/home/projects/act/.env` remains the rollback source of truth.
- Focused tests verify deploy-script injection, learner-state route disabled/sparse/read-failure states, learner-state service no-data/stale path states, and Konling sparse-personalization behavior.

## Post-Merge Operations

1. Update the production env file before redeploy:

   ```bash
   grep -q '^ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true$' /home/projects/act/.env || \
     printf '\nADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true\n' >> /home/projects/act/.env
   ```

2. Redeploy app and worker from the merged integration artifact:

   ```bash
   cd /home/projects/act
   ./deploy/podman/deploy.sh --all
   ```

3. Verify both containers received the flag:

   ```bash
   podman exec act-obe-app env | grep '^ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true$'
   podman exec act-obe-worker env | grep '^ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true$'
   ```

4. Verify readiness after redeploy:

   ```bash
   curl -fsS http://127.0.0.1:8083/api/readyz
   ```

5. Verify learner-state route behavior with an authenticated production session:

   - `/api/adaptive/learner-state?goal=control-correction` returns a server-owned payload when evidence exists.
   - Sparse learners return explicit low-confidence or missing-source markers instead of `LEARNER_STATE_SERVICE_DISABLED`.
   - Read failures return an operational error and do not look like sparse learner data.

6. Verify Konling sparse-data behavior:

   - A graph or concept explanation with teaching content available returns cited content.
   - Missing learner-state or path-execution is recorded as limited personalization metadata.
   - The visible answer does not expose raw diagnostic tokens.
