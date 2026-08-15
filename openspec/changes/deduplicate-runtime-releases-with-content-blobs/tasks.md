## 1. Baseline retained from the v2 candidate

- [x] 1.1 Archive the v1 migration change into main specs and record the frozen v1 active/rollback inventory and capacity analysis.
- [x] 1.2 Implement canonical v2 blob manifests, path safety, receipt/wire identity, media allowlisting and deterministic blob-key validation.
- [x] 1.3 Implement and record the fixed v1 import, complete v1/v2 equivalence proof and non-selected blob candidate.
- [x] 1.4 Implement a read-only helper-mounted candidate view, lifecycle/authority marker, protected-root GC plan and bounded textbook index cache.

## 2. Parent-manifest incremental publication

- [x] 2.1 Extend v2 semantic manifest entries with Git blob source identity, validate Git/object format identity and build parent-manifest OID-to-blob lookup.
- [x] 2.2 Implement a delta planner that reads only the target Git tree metadata and rejects non-Git or generated runtime inputs lacking a Git-tracked stable source identity.
- [x] 2.3 Implement changed/unknown-only body hashing, SHA/size de-duplication, no-overwrite blob upload, metadata HEAD verification, terminal receipt/manifest publication and exact resumability.
- [x] 2.4 Implement the local `act-runtime-oss-release-operator` publisher adapter with principal/Bucket/Region/prefix preflight, local single-publisher lock and credential-redacting diagnostics; remove ECS writer authority from the daily path.
- [x] 2.5 Add no-op, rename, repeated OID, three-file delta, identical-different-OID, clean-clone-without-cache, missing identity, existing-metadata-mismatch, interrupted upload and manifest-last tests with exact body/HEAD/upload counters.
- [x] 2.6 Add fail-closed first compatibility reads for metadata-less legacy v2 blobs: require the SHA-addressed key, HEAD size and valid ETag, stream one `get-object --if-match` readback, forbid writes, and report metadata reuse, new uploads, legacy readback bytes and the deterministic verified-blob audit digest/entries.
- [x] 2.7 Bind daily publish to a versioned source-provenance proof and canonical planning receipt; validate origin/integration ancestry, exact Git tree identities, parent/external bindings and metadata-only reopen; snapshot external bytes once for the transfer stream and cover proof, drift, missing/unknown-version and no-second-body-hash regressions.

## 3. Fast materialization and runtime-only deployment

- [x] 3.1 Implement parent-view clone plus manifest-delta application, receipt-bound idempotent view reuse, local atomic rename and changed hot-cache update.
- [x] 3.2 Replace repeated prepare/select/host body verification with manifest/receipt, topology, helper mount, changed-blob and representative-read checks; keep `audit --sample` and `audit --full` as independent read-only commands.
- [x] 3.3 Implement `deploy:runtime`, `deploy:app` and `deploy:all`; ensure runtime-only deployment cannot build images, transfer image tar, manipulate database, Prisma, Nginx/systemd or copy a full runtime tree.
- [ ] 3.4 Prove candidate filesystem/route/media/knowledge/textbook/worker compatibility, helper-path 404, one runtime bind, cold/warm/concurrent index behavior and rollback from a small v2 increment.

## 4. Operational safety and handoff

- [x] 4.5 Record Sol DECIDE B: admit a current-runtime external bundle only when a precise Git declaration and output source identity bind it; keep this change candidate-only with no selection or deletion.

- [ ] 4.1 Keep ECS on `act-runtime-oss-read` for normal serving; verify its Put/Delete/Abort denial and record the separate local publisher credential-provider setup without committing credentials.
- [x] 4.2 Produce daily, sample and full audit reports with release identity, parent identity, changed counts, body bytes hashed, metadata requests, uploaded bytes, materialization/smoke timing and capacity projection.
- [x] 4.3 Update runtime deployment and server-ops runbooks with local-publisher/ECS-reader separation, recovery, GC, audit and rollback evidence.
- [ ] 4.4 Run targeted tests, typecheck, lint, runtime/deploy suites and build; prepare a separate production-selection and v1-retirement checklist for explicit authorization.
