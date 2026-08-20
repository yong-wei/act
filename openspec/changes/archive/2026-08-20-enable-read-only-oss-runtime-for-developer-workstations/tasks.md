## 1. Production active runtime discovery

- [x] 1.1 Add a strict runtime readiness projector that reads the existing active manifest/receipt binding and returns only required/ready state, schema, Release ID, manifest digest and tree digest.
- [x] 1.2 Integrate the runtime probe into `/api/readyz` so required blob-view drift returns 503 while ordinary local mode remains compatible and all responses remain non-cacheable.
- [x] 1.3 Add route and library tests for valid active identity, desired-versus-active divergence, missing/invalid receipt, manifest drift, unknown fields and non-required local mode.

## 2. Shared read-only workstation identity

- [x] 2.1 Add a credential-free RAM Policy template and validator covering only required v2 manifest/receipt/blob reads and prefix-scoped listing, with no Publisher, write, delete, ACL, Bucket, RAM or STS actions.
- [x] 2.2 Implement an interactive repository-external credential installer that requires an XDG parent mode of `0700`, a non-symlink credential file mode of `0600`, exact fields and no secret-bearing output.
- [x] 2.3 Implement caller-identity preflight that accepts only the configured account and `act-runtime-dev-read` RAM user and rejects Publisher, ECS operator and unknown principals before OSS access.
- [x] 2.4 Add tests proving unsafe credential paths/modes/fields and unexpected principals fail without exposing AccessKey or Secret values in stdout, stderr, logs or receipts.

## 3. Active manifest retrieval and Linux runtime preparation

- [x] 3.1 Implement strict HTTPS readiness retrieval and exact v2 manifest/receipt fetching from the public Hangzhou OSS Endpoint without listing or guessing a latest Release.
- [x] 3.2 Verify Release ID, schema, canonical manifest digest, receipt/wire binding, tree digest, normalized path set, aggregate counts and SHA-derived Blob keys before any application mount.
- [x] 3.3 Add one Linux preflight for native Linux, WSL2 and Lima/Colima covering architecture, `/dev/fuse`, ossfs2, ossutil, mount inspection, Python, Node and checkout/state paths.
- [x] 3.4 Generate an ossfs2 configuration for `runtime/blobs/sha256/` using the public regional Endpoint and enforce FUSE, prefix, read-only, uid/gid and file/dir mode checks.

## 4. Materialized view and service lifecycle

- [x] 4.1 Add a checkout-scoped locked preparation transaction that invokes the existing materializer prepare/helper/verify/select flow and stores only credential-free identity and owned-path receipts under XDG state/cache roots.
- [x] 4.2 Bind the selected view read-only over the checkout `course-content/runtime` without deleting or modifying hidden checkout content, and reject non-FUSE, writable, escaped or identity-mismatched mounts.
- [x] 4.3 Add an OSS-aware startup command that completes runtime preparation before delegating to the existing `npm run startup`, pins one Release for the running service, and idempotently reuses only an exact verified match.
- [x] 4.4 Add an OSS-aware shutdown/recovery command that stops frontend, worker and scheduler before unmounting only receipt-owned checkout and Blob mounts, and reports exact manual recovery for unknown state.

## 5. Verification and regression coverage

- [x] 5.1 Build a fake-tool contract harness for readiness failure, credential rejection, manifest/receipt drift, missing Blob, writable mount, interrupted preparation, repeated startup, cross-worktree isolation and ordered shutdown.
- [x] 5.2 Run targeted runtime active-release, readiness, materializer and developer adapter tests, then run `npm run typecheck`, related unit suites and `npm run verify:push` on the final intended revision.
- [x] 5.3 Run one credential-safe Linux fixture smoke proving course, media and textbook consumers read the selected view while writes below `course-content/runtime` fail.
- [x] 5.4 Record the WSL2 and Lima/Colima real-environment smoke matrix, including FUSE availability, public OSS reachability, startup, restart-to-refresh and cleanup results.

## 6. Operations, onboarding and user-owned rollout

- [x] 6.1 Add an operations guide for creating the custom RAM Policy, `act-runtime-dev-read` RAM user and single AccessKey, storing it immediately in a password manager, validating read/write boundaries and revoking access without recording any credential value.
- [x] 6.2 Add a collaborator guide for Linux/WSL2/Lima setup, credential installation, identity verification, OSS-aware startup/shutdown, diagnostics, cache cleanup and project-end removal; keep the guide safe for ordinary repository distribution.
- [x] 6.3 Update `docs/ProjectDescription.md` and runtime operations documentation with the development access boundary, public Endpoint cost/latency, shared-credential audit limitation and separation from Publisher/production authority.
- [ ] 6.4 After implementation review, have the user create and retain the real credential outside the repository; perform one authorized controlled OSS smoke without exposing Secret values to the agent, repository, Issue, PR or logs.
- [ ] 6.5 After Linux, WSL2 and Lima/Colima smoke succeeds, distribute the credential-free guide through project channels and let the user grant the shared credential separately through the approved password manager or end-to-end encrypted channel.
