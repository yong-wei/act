# control-correction-learning-record-adapter Specification

## ADDED Requirements

### Requirement: Course-specific mapping belongs to an explicit adapter

Control-correction goal, lesson, resource and Arena identity mapping SHALL be owned by an explicit course/plugin adapter registered through the existing Personalization plugin boundary. Generic Learning Record, snapshots, reducers and read ports MUST NOT contain control-correction course identifiers or keyword-based mapping.

#### Scenario: Generic ingestion receives mapped evidence

- **WHEN** a registered control-correction adapter returns a normalized mapping
- **THEN** generic ingestion stores only the permitted normalized identity, source, quality and provenance fields

#### Scenario: Generic code lacks course context

- **WHEN** generic Learning Record code processes a fact for an unrelated goal
- **THEN** it remains course-agnostic and does not inspect lesson titles, resource strings or course IDs

### Requirement: Goal resolution is explicit and versioned

The adapter SHALL require explicit `goalId=control-correction` or its registered plugin identifier plus adapter schema, course/release/capture revision and canonical lesson/resource identity. Missing, ambiguous, stale or mismatched identity MUST fail closed.

#### Scenario: Missing goal identifier

- **WHEN** a client or producer omits the explicit goal identifier
- **THEN** no control-correction mapping is inferred from keywords or default course values

#### Scenario: Revision mismatch

- **WHEN** the adapter revision does not match the fact's release/capture identity
- **THEN** mapping is rejected with a recoverable diagnostic and no cross-revision contribution is emitted

### Requirement: Arena official authority is preserved

The adapter and Learning Record SHALL treat Arena official submission/result authority as authoritative for official scoring and leaderboard outcomes. LearningFact MAY preserve auxiliary learning evidence, but MUST NOT overwrite, reinterpret or promote it above the official Arena result.

#### Scenario: Auxiliary evidence conflicts with official result

- **WHEN** a LearningFact-derived contribution conflicts with an Arena official result
- **THEN** the official result remains authoritative and the conflict is retained as auditable provenance

### Requirement: Personalization receives normalized plugin output

Personalization SHALL continue using its existing plugin interface and receive only adapter-authorized goal/mastery/quality/coverage/provenance fields. The adapter MUST NOT become a second recommendation algorithm or fact store.

#### Scenario: Adapter output is consumed by Personalization

- **WHEN** Personalization requests control-correction evidence
- **THEN** it receives normalized, revision-bound fields through the plugin port and cannot query generic raw course mappings

### Requirement: Adapter failure is safe and observable

Missing plugin, malformed mapping, unsupported revision, authority conflict or privacy violation SHALL produce an explicit failure/unavailable result with minimized diagnostic data. The system MUST NOT fall back to a guessed course, zero contribution or unauthorized raw payload.

#### Scenario: Adapter is unavailable

- **WHEN** the registered adapter cannot load or validate a mapping
- **THEN** consumers see truthful unavailable/partial status and the failure remains replayable without changing official scores

### Requirement: Adapter migration has a closed denominator

The migration ledger SHALL enumerate all generic hardcodes, producers, consumers, state reducers, snapshot writers, backfills, reports and tests, with an adapter replacement, owner, revision evidence and deletion condition.

#### Scenario: Hardcoded branch is deleted

- **WHEN** a generic control-correction branch is removed
- **THEN** the ledger proves all required callers use the adapter and parity/authority/privacy tests pass at the intended revision

### Requirement: Adapter mappings preserve immutable anchors

Every adapter mapping and its normalized LearningFact/projection output SHALL preserve `sourceEventId`, applicable `sourceLogId`, canonical knowledge/resource/activity identity, `revision`/`captureRevision`, `schemaVersion`, `decoderVersion` and `materializerVersion`. Direct, outbox, correction, replay and backfill MUST retain the source anchor; new derivations MUST reference rather than mutate it.

#### Scenario: Control evidence is replayed

- **WHEN** a control-correction event is replayed or corrected
- **THEN** the adapter returns the same anchor and trusted set, with a new explicit derivation/rematerialization relation when applicable

### Requirement: Adapter output is deterministic and revision-bound

For the same explicit goal, canonical identities, trusted set and adapter revision, mapping, input digest and projection output SHALL be deterministic regardless of delivery order. Cross-revision/captureRevision input SHALL be rejected unless an authorized rebase is recorded.

#### Scenario: Ambiguous or stale mapping

- **WHEN** a lesson/resource/Arena identity is ambiguous or its capture revision is stale
- **THEN** the adapter fails closed and does not guess a course, map to a default or emit a zero contribution

### Requirement: Adapter payload uses a minimum allowlist

Adapter transport SHALL allow only explicit goal/plugin and schema/release/capture revisions, canonical lesson/resource/activity and Arena references, normalized values/quality, trusted/server times, opaque subject/scope refs, idempotency and required materialization enums, plus optional non-guessable raw artifact reference with digest/expiry/access policy. Generic payload JSON, raw answers, free text, prompts, model/parser text, direct user IDs, tokens and exception/stack text MUST be rejected.

#### Scenario: Forbidden raw field reaches adapter

- **WHEN** an input includes an answer, prompt, model output, direct identifier or serialized exception
- **THEN** the versioned sanitizer rejects it before adapter or fact persistence and emits only a redacted fingerprint

### Requirement: Raw artifact and retention permissions are isolated

Restricted raw artifacts SHALL default off and, when explicitly approved, SHALL use separate physical storage, encryption key, ACL and audit. Learning Record, Personalization, queue, consumer and public-audit permissions MUST NOT inherit raw access. Retention SHALL cap replay transport at 7 days, successful payload at 24 hours, failure receipts at 90 days, approved raw at 7 days and minimal public audit at its declared bound; terminal/deletion receipt MUST precede cleanup.

#### Scenario: Adapter raw reference expires

- **WHEN** an approved raw artifact reaches expiry
- **THEN** deletion records an original-free receipt and verifies its object, index, cache and replica are unreadable

### Requirement: Adapter replay and export are separately authorized

Replay SHALL require scope, purpose, ticket, short-lived elevated authority and two-person or equivalent control, reusing original idempotency/schema/decoder/anchor. Adapter and public exports MUST exclude raw answers, prompts, model/parser text, reversible user IDs, raw artifacts, tokens, addresses, local paths and identifying small samples.

#### Scenario: Personalization requests raw replay

- **WHEN** a normal Personalization or consumer role requests adapter raw replay without the approved operation
- **THEN** authorization fails closed and no raw payload or replay capability is granted
