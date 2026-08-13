## 1. Contract convergence and baseline evidence

- [x] 1.1 Archive `migrate-runtime-to-oss-immutable-releases` into its main specs before applying this change's three modified capability deltas; verify the resulting main specs have one v1/v2 migration contract.
- [x] 1.2 Record a frozen active/rollback release inventory, unique-byte analysis, release cadence and measured peak-space budget for the production Bucket.
- [x] 1.3 Audit all production runtime filesystem consumers for `lstat`, `readlink`, `realpath`, containment, directory traversal, watch and inode-sensitive behavior; define the materialization equivalence test matrix.

## 2. Blob-backed release format and verification

- [ ] 2.1 Add versioned blob-backed manifest types, canonical serialization, path/aggregate validation, logical tree digest and release identity tests alongside v1 compatibility parsing, including same-tree same-revision, same-tree different-revision and different-tree same-revision vectors.
- [ ] 2.2 Add deterministic blob-key derivation and read-only manifest/blob verification that rejects unsupported versions, arbitrary keys, unsafe paths, duplicate paths and digest drift.
- [ ] 2.3 Extend release inspection and locator/media parsing so the active manifest remains the sole allowlist for logical files and private media blob keys.

## 3. Append-only publishing and recovery

- [ ] 3.1 Extend the single ECS streaming bridge to conditionally publish and independently verify content-addressed blobs, then write the immutable manifest last.
- [ ] 3.2 Add exact-resume, interrupted-publish, pre-existing same/different blob, malformed remote listing and manifest-terminal regression tests.
- [ ] 3.3 Preserve the publisher/read-role separation and update credential-free publish/verify/inspect contracts without storing permanent credentials.

## 4. Candidate materialization and selection proof

- [ ] 4.1 Implement a host-locked temporary materializer that creates a read-only logical runtime view solely from one verified blob-backed manifest and atomically selects it only after validation.
- [ ] 4.2 Build and execute the symlink-forest equivalence harness against the audited filesystem APIs, runtime routes, media resolver and representative published courses; stop the production path if an incompatible observation is found.
- [ ] 4.3 Run cold, warm and concurrent `resources/textbook-retrieval` benchmarks for `vectors.f32`, `bodies.utf8` and `lexical-postings.bin`; implement a bounded digest-pinned hot cache only when measured evidence requires it.
- [ ] 4.4 Add a journaled durable v2 lifecycle record for normalized desired, active, rollback, publishing and retained identities; persist a v1/v2 authority marker and keep valid v1 selector/receipt reads authoritative only before migration or after explicit `v1-rollback`; bind materialized view, readiness and media signing only to active identity.
- [ ] 4.5 Prove v1 startup and import of desired-active divergence, crash boundaries before/during/after v2 marker commit, v2 lifecycle corruption recovery/fail-closed behavior, `A active → B active/A rollback → C desired candidate`, failed candidate divergence, v2 rollback and v2-to-v1 rollback without changing production selection.

## 5. Reachability-based retention and garbage collection

- [ ] 5.1 Implement locked protected-manifest snapshotting from the durable desired/active/rollback/publishing/retained lifecycle record, including signed-media URL grace protection and explicit desired cancellation/replacement transitions.
- [ ] 5.2 Implement dry-run GC plan, selector-generation fencing, per-object revalidation, deletion receipt and fail-closed malformed/paginated-list handling.
- [ ] 5.3 Add concurrency, interrupted lifecycle, rollback and protected-blob regression coverage; prove that ordinary GC cannot delete a reachable blob or any manifest.

## 6. Migration evidence and operational handoff

- [ ] 6.1 Publish disposable v2 candidate releases and verify dedupe savings, blob closure, candidate mount and rollback materialization with immutable receipts.
- [ ] 6.2 Update OSS release runbooks and `server-ops` skill with measured role, mount, materialization, GC, rollback and capacity evidence.
- [ ] 6.3 Complete targeted tests, typecheck, lint, runtime/deploy suites and build; prepare separate production-switch and v1-retirement checklists for explicit user authorization.
