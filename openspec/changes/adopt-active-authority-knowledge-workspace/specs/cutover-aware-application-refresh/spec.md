## ADDED Requirements

### Requirement: Post-cutover application refresh preserves committed selector state
The system SHALL provide a dedicated application refresh transaction for a host with a committed production knowledge cutover. Under the shared deployment lock, it SHALL verify and record immutable digests of the committed marker, receipt, journal, all four selectors and their identities before replacing application containers, and SHALL not write, delete, copy or rewrite any selector, Authority artifact, production cutover marker, receipt or journal. It SHALL atomically normalize the existing runtime env file to exactly one durable `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover` key while preserving other env content, file ownership and permissions; that durable file SHALL be the single mode source for app, worker, manual and systemd-equivalent starts. An ambient process value SHALL NOT downgrade a committed cutover to legacy.

For an application-only refresh using an already frozen external textbook runtime, the release provenance SHALL record `appRevision`, `runtimeSourceRevision` and `indexSourceRevision` as independent 40-character revisions. The build SHALL validate the external runtime and retrieval index internally and SHALL require the runtime and index source revisions to match each other, but SHALL NOT require either external source revision to equal the application revision. This allowance SHALL NOT bypass textbook input provenance, schema, media-closure, digest or image-tar validation.

#### Scenario: Refresh preflight succeeds
- **WHEN** the remote host has a valid committed cutover marker, matching receipt, four regular selector files and consistent Authority/Projection/consumer identities
- **THEN** the refresh transaction MAY proceed with the declared application image
- **AND** it SHALL record the prior image and the verified cutover identities plus marker/receipt/journal digests in its refresh receipt
- **AND** a clean shell and systemd-equivalent `--app-only` start SHALL resolve `cutover` from the persisted runtime env without an ambient mode override

#### Scenario: Application-only refresh retains the frozen external textbook runtime
- **WHEN** the declared application revision differs from the already frozen external textbook runtime/index source revision, while the runtime and retrieval index are internally valid and share the same source revision
- **THEN** the build and provenance validation SHALL accept the independent revisions and record all three identities
- **AND** it SHALL continue to reject any runtime/index revision mismatch, invalid revision, input or content digest mismatch, tar SHA mismatch or other provenance inconsistency

#### Scenario: Cutover evidence is missing or inconsistent
- **WHEN** any committed marker, receipt, selector, pointer identity or consumer readiness prerequisite is absent, corrupt or mismatched
- **THEN** the refresh transaction SHALL fail before stopping app or worker containers
- **AND** it SHALL not use the ordinary Legacy deployment path as a substitute

#### Scenario: Refresh implementation touches cutover control state
- **WHEN** the refresh script or its invoked transport would remove, replace, copy or modify a knowledge `current.json`, production cutover marker, receipt or journal
- **THEN** static and behavior validation SHALL reject the implementation

### Requirement: Refresh launches a single consistent cutover application revision
The system SHALL rebuild app and worker from the same verified image digest and durable `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover` after verifying the transferred image identity. It SHALL reject mixed image revisions or mixed knowledge deployment modes. If replacement or postflight fails, it SHALL restore both app and worker to the recorded preceding image digest in cutover mode; it SHALL not restore the runtime env to legacy.

#### Scenario: New image is accepted
- **WHEN** the staged image tar, provenance and OCI config digest match the declared refresh input
- **THEN** the remote refresh SHALL load that image and replace both app and worker with that exact image in cutover mode
- **AND** it SHALL retain the already committed selector set unchanged

#### Scenario: Post-replacement verification fails
- **WHEN** app/worker health, image identity, cutover mode, selector identity or named consumer readiness fails after replacement
- **THEN** the transaction SHALL restore the recorded preceding image in cutover mode
- **AND** it SHALL preserve the selector, marker, receipt and journal state and report the failed refresh without claiming success

### Requirement: Refresh completion is independently verifiable
The system SHALL retain one unique, non-overwritable refresh receipt at `data/runtime/knowledge-cutover/app-refresh/<refreshId>.json`, separate from first-cutover evidence. The receipt SHALL contain its schema/version, refreshId, timestamps, target/previous/final app/worker image digests, mode before/after, runtime-env pre/post hash and whitelisted key status, verified selector identities, pre/post marker/receipt/journal/four-selector digests, result and failure phase when applicable. It SHALL NOT contain runtime env contents, credentials, absolute host paths or selector raw contents.

#### Scenario: Refresh completes
- **WHEN** app and worker are running after a refresh
- **THEN** verification SHALL prove the same image and cutover mode for both containers, the unchanged four existing selectors, unchanged marker/receipt/journal digests, all required named consumers and local/public readiness
- **AND** it SHALL run an active Authority read that correlates with the committed selector identity
- **AND** it SHALL prove that the normal Legacy deployment guard still rejects the committed marker

#### Scenario: Runtime env or protected state is not safe to refresh
- **WHEN** the runtime env cannot be safely parsed or normalized, a protected marker/receipt/journal/selector digest drifts, or the unique refresh receipt path already exists
- **THEN** the transaction SHALL fail before replacing app or worker containers
- **AND** it SHALL leave the committed cutover control plane unchanged
