# oss-runtime-deployment-bridge Specification

## Purpose
Define how production mounts a verified v1 prefix or v2 blob-view, separates desired from active selection, and keeps the ECS serving role read-only.
## Requirements
### Requirement: Runtime consumers mount one verified immutable release read-only
The production deployment SHALL mount exactly one selected v1 `runtime/releases/<release-id>/` prefix through ossfs 2.0 at a host path dedicated to that release, or a verified v2 blob namespace through ossfs 2.0 plus a host-owned materialized logical view at a host path dedicated to that release. It SHALL bind only that selected logical view read-only to `/app/course-content/runtime`, use the China Hangzhou internal OSS endpoint and the ECS read-only RAM role authentication, and keep blob paths outside the application contract. Normal ECS serving, materialization and smoke commands SHALL not require OSS PutObject, DeleteObject or AbortMultipartUpload permission. When a v2 activation restores host control-plane overlays, it SHALL perform the overlay restoration and its manifest-aware verification before it replaces runtime consumers; a failed post-restoration verification SHALL retain the prior active mount and containers.

#### Scenario: Candidate release is prepared
- **WHEN** a v1 release has passed remote OSS verification, or a v2 release has also passed materialization qualification
- **THEN** deployment SHALL mount its fixed v1 prefix or build and validate a temporary v2 logical view against its manifest, and only then allow Podman to use that exact read-only path as `RUNTIME_CONTENT_DIR`

#### Scenario: Mount or mounted verification fails
- **WHEN** ossfs cannot mount, a blob is missing or mismatched, materialization differs from the manifest, required runtime smoke checks fail, or post-overlay verification detects a non-control-plane drift
- **THEN** deployment SHALL retain the prior running container and active mount and SHALL report the candidate as failed

#### Scenario: Control-plane overlay is restored for a v2 candidate
- **WHEN** a v2 candidate must retain persisted host control-plane state from its parent view
- **THEN** deployment SHALL restore only the declared control-plane paths, verify the resulting candidate before selecting or restarting consumers, and SHALL NOT treat a successful pre-overlay verification or `/api/readyz` identity response as sufficient evidence of cache integrity

### Requirement: Host selection distinguishes desired and active releases
The host SHALL persist a desired release selector and a separate active receipt on local durable storage. For v2 it SHALL also persist a journaled durable lifecycle record holding normalized desired, active, rollback, publishing and retained identities plus a monotonic generation, and an authority marker with exactly `v2` or explicit `v1-rollback` modes. Selection writes SHALL use a host-local exclusive lock and a monotonic generation; a desired selector SHALL not be treated as evidence that a container actually activated it. An absent authority marker permits validated v1 selector/receipt state as the authority only before the first v2 migration. A `v2` marker with missing or invalid lifecycle state SHALL recover only from a matching committed journal and otherwise fail closed; it SHALL not fall back to a v1 projection. A v2 candidate view with an exact matching receipt MAY be reused after identity, generation, helper mount and read-only state checks; select and host verification SHALL not rehash every inherited logical file.

#### Scenario: Container activation succeeds
- **WHEN** the selected release mount, container restart, and health checks succeed
- **THEN** deployment SHALL write an active receipt binding the release id, manifest identity, mount path, selector generation and verified application revision, and record the prior active identity as rollback in the v2 lifecycle record

#### Scenario: Container activation fails after selection
- **WHEN** a desired release has been selected but container restart or health verification fails
- **THEN** deployment SHALL keep or restore the previous active release, retain its rollback identity, leave an explicit desired-versus-active divergence record, and SHALL not delete either release, mount or reachable blob

#### Scenario: Explicit v2-to-v1 rollback succeeds
- **WHEN** a verified v1 release has been mounted, activated and recorded through the lifecycle journal
- **THEN** deployment SHALL persist the verified v1 selector and active receipt, atomically mark authority mode as `v1-rollback`, and keep the marker rather than inferring authority from file absence

#### Scenario: Runtime-only deployment has no application-image side effects
- **WHEN** an operator invokes runtime-only deployment for an immutable v2 release
- **THEN** the operation SHALL publish/materialize/smoke/select that release without building or transferring an application image, importing data, migrating a database or changing Nginx/systemd configuration

### Requirement: Runtime role cannot mutate releases
The ECS runtime role SHALL have only the prefix-scoped OSS read operations needed to list and fetch selected runtime release objects. It SHALL not possess OSS release upload, selector write, or object deletion permissions.

#### Scenario: Runtime credential is used for mutation
- **WHEN** an operation attempts to upload, overwrite, or delete an object with the runtime role
- **THEN** the deployment verification SHALL treat successful mutation as a least-privilege violation and fail the readiness check.

### Requirement: Textbook retrieval preserves bounded local performance evidence
The deployment SHALL measure `resources/textbook-retrieval` startup and representative lookup latency from the selected mount. It SHALL permit a bounded local read-only hot cache only when recorded evidence shows ossfs latency exceeds the agreed threshold.

#### Scenario: Mounted retrieval index is materially slower
- **WHEN** the recorded benchmark shows the mounted vectors, bodies, or lexical postings fail the configured performance threshold
- **THEN** deployment MAY use a content-addressed local hot cache bound to the selected manifest digest and SHALL reject a cache whose digest differs from the active release.

