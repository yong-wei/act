## MODIFIED Requirements

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
