## MODIFIED Requirements

### Requirement: Runtime consumers mount one verified immutable release read-only
The production deployment SHALL mount a verified v2 blob namespace through ossfs plus a host-owned materialized logical view. It SHALL bind only the `current` logical view read-only to `/app/course-content/runtime`, use the China Hangzhou internal OSS endpoint and the ECS read-only RAM role, and keep blob paths outside the application contract. Serving, materialization and smoke commands SHALL not require OSS PutObject, DeleteObject or AbortMultipartUpload permission.

#### Scenario: Candidate release is prepared
- **WHEN** a v2 release has visible Δ blobs and a validated materialized view
- **THEN** deployment SHALL allow Podman to use that exact read-only path as `RUNTIME_CONTENT_DIR` only after `current` switches to it

#### Scenario: Mount or mounted verification fails
- **WHEN** ossfs cannot mount, a Δ blob is missing, materialization differs from the manifest, or required runtime smoke checks fail
- **THEN** deployment SHALL retain the prior running container and `current` mount

### Requirement: Host selection distinguishes desired and active releases
The host SHALL persist exactly two durable pointers: `current` and `previous`. It SHALL NOT persist desired, staged, verified, publishing, generation or transaction-marker state for daily activation. Selection writes SHALL be atomic. `previous` SHALL NOT be treated as evidence that consumers are serving that release. Rollback SHALL swap the two pointers.

#### Scenario: Container activation succeeds
- **WHEN** the candidate mount, container restart and health checks succeed
- **THEN** deployment SHALL write `current` to the new release and `previous` to the outgoing release

#### Scenario: Container activation fails after selection attempt
- **WHEN** materialization or health verification fails before the pointer commit
- **THEN** deployment SHALL keep the previous `current` release
- **AND** it SHALL not delete either release, mount or reachable blob

#### Scenario: Runtime-only deployment has no application-image side effects
- **WHEN** an operator activates an immutable v2 release
- **THEN** the operation SHALL materialize, smoke and select that release without building or transferring an application image, importing data, migrating a database or changing Nginx/systemd configuration

### Requirement: Runtime role cannot mutate releases
The ECS runtime role SHALL have only the prefix-scoped OSS read operations needed to list and fetch selected runtime release objects. It SHALL not possess OSS release upload, selector write, or object deletion permissions.

#### Scenario: Runtime credential is used for mutation
- **WHEN** an operation attempts to upload, overwrite, or delete an object with the runtime role
- **THEN** the deployment verification SHALL treat successful mutation as a least-privilege violation and fail the readiness check

### Requirement: Textbook retrieval preserves bounded local performance evidence
The deployment SHALL measure `resources/textbook-retrieval` startup and representative lookup latency from the selected mount. It SHALL permit a bounded local read-only hot cache only when recorded evidence shows ossfs latency exceeds the agreed threshold.

#### Scenario: Mounted retrieval index is materially slower
- **WHEN** the recorded benchmark shows the mounted vectors, bodies, or lexical postings fail the configured performance threshold
- **THEN** deployment MAY use a content-addressed local hot cache bound to the selected manifest digest and SHALL reject a cache whose digest differs from the current release
