# learning-record-current-projections Specification

## Purpose
LearningFact remains append-only evidence. Immutable snapshots, role-safe current read models and fenced current pointers are published separately so stale or conflicting candidates cannot overwrite a qualified current, and page responses do not scan raw events.
## Requirements
### Requirement: Facts, snapshots and read models are distinct

LearningFact SHALL remain the append-only evidence input. Immutable snapshots SHALL represent a qualified calculation version, while role-specific read models and current pointers SHALL be rebuildable projections. Raw events MUST NOT be the normal source for a student, teacher, AI or Personalization page response.

#### Scenario: Read model is rebuilt

- **WHEN** a projection is rebuilt from its recorded fact watermark
- **THEN** its output is derived from governed LearningFacts and its revision/provenance is retained

### Requirement: Projection qualification is revision-bound

Every candidate projection SHALL record subject/scope, source fact watermark, processing watermark, state watermark, calculation/revision, generation, input digest, coverage, freshness, confidence and qualification/status before publication.

#### Scenario: Candidate has incomplete evidence

- **WHEN** the candidate lacks the minimum trusted evidence or has an input digest mismatch
- **THEN** it remains unqualified/partial and cannot become current

#### Scenario: Qualified candidate is published

- **WHEN** a candidate satisfies schema, authority, privacy, quality and fence checks
- **THEN** the system records a revision-bound qualified version before exposing it through a read port

### Requirement: Current pointer publication is atomic and fenced
The system SHALL publish the immutable version and current pointer with an atomic transaction or equivalent durable compare-and-set receipt. A pointer MUST NOT move backward across generation, watermark, revision or cutover fence, and an ordinary backfill MUST NOT move the online current pointer; only the existing explicitly authorized migration/cutover contract may do so.

#### Scenario: Out-of-order candidate arrives
- **WHEN** an older or lower-generation candidate or an ordinary backfill result races with a newer current
- **THEN** the older result is retained only as history/conflict and current remains unchanged

#### Scenario: Concurrent publication
- **WHEN** two qualified candidates publish concurrently for one subject
- **THEN** exactly one fence-valid current pointer is visible and the losing result is auditable

#### Scenario: Authorized calculation version cutover
- **WHEN** a fence-valid candidate records a new `calculationVersion` together with a strictly newer generation or cutover fence and an explicit migration receipt
- **THEN** current advances to that candidate
- **AND** a same-fence version split or ordinary backfill result remains a conflict and does not overwrite current

### Requirement: Failure preserves qualified current

Projection failure, stale input, insufficient evidence, unavailable dependency or conflict SHALL preserve the previous qualified current and expose an explicit status/reason. If no qualified current exists, the read port SHALL return unavailable rather than scanning raw events or fabricating zero values.

#### Scenario: Refresh crashes before pointer commit

- **WHEN** a worker crashes after writing a candidate version but before pointer publication
- **THEN** the prior qualified current remains visible and the candidate is retryable or marked failed

#### Scenario: Current becomes stale

- **WHEN** a newer fact exists but refresh has not qualified a replacement
- **THEN** the read port reports stale/partial metadata and does not present the previous value as fresh

### Requirement: Role and privacy projections are minimal

Student, teacher, AI and Personalization read ports SHALL expose only fields permitted by the caller's server-derived scope and role. Teacher aggregate suppression SHALL use independent learner counts; student-safe and Copilot contexts MUST exclude teacher/admin data and raw private payloads.

#### Scenario: Small teacher cohort

- **WHEN** a teacher request covers fewer than the configured independent learners
- **THEN** sensitive aggregate values are suppressed while status/coverage remains truthful

#### Scenario: Student requests another subject

- **WHEN** a student attempts to read another learner's projection
- **THEN** authorization fails closed before current data is returned

#### Scenario: Teacher or AI request lacks bound scope

- **WHEN** a teacher, AI or Personalization caller has no server-derived class or subject scope for the requested learner
- **THEN** authorization fails closed before current data is returned

### Requirement: Projection traceability is closed

Each exposed projection field or aggregate SHALL be traceable to the contributing LearningFact set, source/revision and current status. Projection receipts SHALL record denominator, skipped/invalid inputs, replay and privacy validation outcomes.

#### Scenario: Consumer asks for provenance

- **WHEN** an authorized consumer requests evidence metadata
- **THEN** the read port returns permitted source coverage, freshness/confidence and revision-bound provenance without exposing restricted raw payloads

### Requirement: Published projections preserve input anchors

Every snapshot, current read model and publication receipt SHALL preserve its contributing `sourceEventId`, applicable `sourceLogId`, canonical knowledge/resource/activity identity, `revision`/`captureRevision`, `schemaVersion`, `decoderVersion` and `materializerVersion`. Correction, replay, backfill and rematerialization MUST add an explicit derived relation without mutating the original anchor or historical version.

#### Scenario: Projection is refreshed from a replay

- **WHEN** an existing fact set is replayed into a projection
- **THEN** the published result retains the original anchors and server times, with any new decoder/materializer represented as explicit rematerialization metadata

### Requirement: Projection input and output are deterministic

For the same immutable anchors, stable ordering, trusted fact set and revision, the projection SHALL produce the same input digest, trusted-set digest and output independent of delivery order or replay count. Cross-revision input SHALL be rejected unless an authorized explicit rebase is recorded.

#### Scenario: Delayed fact arrives out of order

- **WHEN** the same trusted facts are delivered in a different order or a late event is replayed
- **THEN** digest and qualified output are unchanged for the same input set, while late/stale status and receipt remain explicit

#### Scenario: Decoder version changes

- **WHEN** a decoder or materializer is changed
- **THEN** the system runs explicit rematerialization with a new version and does not relabel it as an original replay

### Requirement: Projection trust boundary is allowlisted and isolated

Projection transport SHALL accept only normalized values, anchor/version/time references, opaque subject/scope references, digest, generation/revision, coverage/confidence/status and materialization metadata. It MUST reject generic payload JSON, raw answers, free text, prompts, model/parser text, direct user IDs and exception/stack echo. Restricted raw artifacts SHALL default off and, when approved, SHALL remain in separate physical storage, key and ACL domains; projection, queue and consumer permissions MUST NOT inherit access.

#### Scenario: Forbidden projection field appears

- **WHEN** a candidate includes a raw answer, prompt, direct user identifier or serialized exception
- **THEN** the boundary rejects or sanitizes it before snapshot/read-model persistence and records only a redacted fingerprint

#### Scenario: Approved raw reference is used

- **WHEN** an authorized audit operation supplies a minimal raw artifact reference
- **THEN** only the opaque reference and digest/expiry/policy metadata enter the projection receipt, and no projection role can read the artifact itself

### Requirement: Projection retention and deletion are bounded

Projection transport SHALL use a replay default of 72 hours and a hard maximum of 7 days; successful payloads SHALL be deleted within 24 hours; failure receipts SHALL default to 30 days and be capped at 90 days; restricted raw SHALL default off and be capped at 7 days after approval; public audit SHALL be minimal aggregation with a default 90-day bound. LearningFact SHALL use a course-validity-plus-365-day default retention subject to governance profile and deletion requests, while historical snapshots remain preserved. Terminal/deletion receipts MUST commit before cleanup, and cleanup SHALL verify object, index, cache and replica unreadability without deleting historical facts or snapshots.

#### Scenario: Candidate cleanup races failure

- **WHEN** cleanup runs before terminalization or deletion verification completes
- **THEN** the candidate is retained and cleanup is retried; no non-terminal input is silently discarded

