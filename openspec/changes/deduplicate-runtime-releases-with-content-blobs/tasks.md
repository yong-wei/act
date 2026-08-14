## 1. Baseline retained from the v2 candidate

- [x] 1.1 Archive the v1 migration change into main specs and record the frozen v1 active/rollback inventory and capacity analysis.
- [x] 1.2 Implement canonical v2 blob manifests, path safety, receipt/wire identity, media allowlisting and deterministic blob-key validation.
- [x] 1.3 Implement and record the fixed v1 import, complete v1/v2 equivalence proof and non-selected blob candidate.
- [x] 1.4 Implement a read-only helper-mounted candidate view, lifecycle/authority marker, protected-root GC plan and bounded textbook index cache.

## 2. Parent-manifest incremental publication

- [x] 2.1 Extend v2 semantic manifest entries with Git blob source identity, validate Git/object format identity and build parent-manifest OID-to-blob lookup.
- [x] 2.2 Implement a delta planner that reads only the target Git tree metadata and rejects non-Git or generated runtime inputs lacking a Git-tracked stable source identity.
- [ ] 2.3 Implement changed/unknown-only body hashing, SHA/size de-duplication, no-overwrite blob upload, metadata HEAD verification, terminal receipt/manifest publication and exact resumability.
- [ ] 2.4 Implement the local `act-runtime-oss-release-operator` publisher adapter with principal/Bucket/Region/prefix preflight, local single-publisher lock and credential-redacting diagnostics; remove ECS writer authority from the daily path.
- [ ] 2.5 Add no-op, rename, repeated OID, three-file delta, identical-different-OID, clean-clone-without-cache, missing identity, existing-metadata-mismatch, interrupted upload and manifest-last tests with exact body/HEAD/upload counters.

## 3. Fast materialization and runtime-only deployment

- [ ] 3.1 Implement parent-view clone plus manifest-delta application, receipt-bound idempotent view reuse, local atomic rename and changed hot-cache update.
- [ ] 3.2 Replace repeated prepare/select/host body verification with manifest/receipt, topology, helper mount, changed-blob and representative-read checks; keep `audit --sample` and `audit --full` as independent read-only commands.
- [ ] 3.3 Implement `deploy:runtime`, `deploy:app` and `deploy:all`; ensure runtime-only deployment cannot build images, transfer image tar, manipulate database, Prisma, Nginx/systemd or copy a full runtime tree.
- [ ] 3.4 Prove candidate filesystem/route/media/knowledge/textbook/worker compatibility, helper-path 404, one runtime bind, cold/warm/concurrent index behavior and rollback from a small v2 increment.

## 4. Operational safety and handoff

- [ ] 4.1 Keep ECS on `act-runtime-oss-read` for normal serving; verify its Put/Delete/Abort denial and record the separate local publisher credential-provider setup without committing credentials.
- [ ] 4.2 Produce daily, sample and full audit reports with release identity, parent identity, changed counts, body bytes hashed, metadata requests, uploaded bytes, materialization/smoke timing and capacity projection.
- [ ] 4.3 Update runtime deployment and server-ops runbooks with local-publisher/ECS-reader separation, recovery, GC, audit and rollback evidence.
- [ ] 4.4 Run targeted tests, typecheck, lint, runtime/deploy suites and build; prepare a separate production-selection and v1-retirement checklist for explicit authorization.
