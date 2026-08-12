## ADDED Requirements

### Requirement: Runtime consumers mount one verified immutable release read-only
The production deployment SHALL mount exactly one selected `runtime/releases/<release-id>/` prefix through ossfs 2.0 at a host path dedicated to that release, and SHALL bind that path read-only to `/app/course-content/runtime`. It SHALL use the China Hangzhou internal OSS endpoint and ECS RAM role authentication.

#### Scenario: Candidate release is prepared
- **WHEN** a release has passed remote OSS verification
- **THEN** deployment SHALL mount its fixed prefix at a candidate path, verify the mounted manifest and representative runtime files, and only then allow Podman to use that exact path as `RUNTIME_CONTENT_DIR`.

#### Scenario: Mount or mounted verification fails
- **WHEN** ossfs cannot mount, exposes a different manifest, or fails the required runtime smoke checks
- **THEN** deployment SHALL retain the prior running container and active mount and SHALL report the candidate as failed.

### Requirement: Host selection distinguishes desired and active releases
The host SHALL persist a desired release selector and a separate active receipt on local durable storage. Selection writes SHALL use a host-local exclusive lock and a monotonic generation; a desired selector SHALL not be treated as evidence that a container actually activated it.

#### Scenario: Container activation succeeds
- **WHEN** the selected release mount, container restart, and health checks succeed
- **THEN** deployment SHALL write an active receipt binding the release id, manifest digest, mount path, selector generation and verified application revision.

#### Scenario: Container activation fails after selection
- **WHEN** a desired release has been selected but container restart or health verification fails
- **THEN** deployment SHALL keep or restore the previous active release, leave an explicit desired-versus-active divergence record, and SHALL not delete either release or mount.

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
