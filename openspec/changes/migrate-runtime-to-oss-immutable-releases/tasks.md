## 1. Release identity and local verification

- [x] 1.1 Add `act-runtime-release.v1` types, canonical manifest generation, tree digest, path validation and manifest parsing.
- [x] 1.2 Add deterministic manifest, incomplete input, SHA/size mismatch and traversal regression tests.
- [x] 1.3 Add runtime/media inventory command that distinguishes local, processed, legacy URL and unresolved inputs without exposing signed URL query data.

## 2. Immutable OSS publishing

- [x] 2.1 Add publish, verify and inspect CLI commands around a testable OSS transport, with exclusive release prefixes and full remote revalidation.
- [x] 2.2 Add publish failure, existing-release, missing/unexpected object and no-selector-on-incomplete tests.
- [x] 2.3 Add a credential-free operator contract for the separate publisher identity and its minimum OSS permissions.

## 3. ECS read-only deployment bridge

- [x] 3.1 Add release-id validation, durable host selector/active-receipt serialization, expected-active fencing and recovery helpers.
- [x] 3.2 Add ossfs 2.0 systemd template and host activation/rollback commands that use fixed release prefixes, read-only mounts and a host-local lock.
- [x] 3.3 Replace production runtime rsync/staging/previous behavior in `scripts/remote-deploy.sh` with release verification, selection and container restart while retaining explicit legacy fallback until activation is authorized.
- [x] 3.4 Add deployment contract, concurrent selection, failed candidate/health-check, rollback and runtime-role least-privilege tests.

## 4. Media resolver and runtime compatibility

- [x] 4.1 Project manifest-bound `objectKey`, SHA-256, size and legacy URL into runtime lesson media resources while preserving legacy filesystem behavior.
- [x] 4.2 Add private OSS media signer and resolver route using ECS RAM-role temporary credentials, strict manifest allowlisting and short-lived redirects.
- [x] 4.3 Add media legacy fallback, object resolution, private URL, traversal and missing-manifest regression tests.

## 5. Evidence, skills and verification

- [x] 5.1 Add textbook retrieval mount/cache benchmark and digest-pinned hot-cache guard.
- [x] 5.2 Add migration and rollback checklists, Phase 0 disk/media/role evidence, estimated reclaim calculation and unresolved-risk report.
- [x] 5.3 Update `server-ops` skill with verified OSS/RAM-role/ossfs operational lessons and extend its contract test when needed.
- [x] 5.4 Run targeted tests, typecheck, lint, runtime/deploy tests and build; record production-only evidence still pending RAM Role, ossfs candidate mount and user-authorized cutover.
