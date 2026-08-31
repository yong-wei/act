# learning-record-event-contract Specification

## Purpose

Define the versioned Learning Record event registry, envelope, privacy allowlist,
and compatibility adapter that subsequent ingestion and projection changes consume.
## Requirements
### Requirement: Versioned event registry

The Learning Record boundary SHALL resolve every supported event through one versioned registry containing a unique discriminator, schema version, source/action version, owner, authority, privacy classification, and payload schema. The database event dictionary MAY expose a queryable projection, but it MUST NOT become a conflicting protocol source of truth.

#### Scenario: Supported event resolves to one contract

- **WHEN** a producer submits a registered discriminator and schema version
- **THEN** the server resolves exactly one payload schema, authority and privacy policy before accepting it

#### Scenario: Unknown contract is rejected

- **WHEN** a producer submits an unknown discriminator or unsupported schema version
- **THEN** the boundary rejects it with a recoverable, auditable contract error and does not materialize a LearningFact

### Requirement: Provenance and idempotency identity

Each accepted event SHALL carry immutable event identity, source/action, causation and dedupe metadata. A dedupe key SHALL represent one logical event and MUST NOT be guessed from an arbitrary business payload field. Replaying the same accepted event SHALL be deterministic and SHALL NOT create a second logical fact.

#### Scenario: Duplicate delivery is safe

- **WHEN** the same event is delivered concurrently or replayed after a worker crash
- **THEN** the system returns the existing acceptance/materialization result or a deterministic duplicate result without double counting

#### Scenario: Dedupe collision fails closed

- **WHEN** one dedupe key is reused with a different immutable source, subject or payload digest
- **THEN** the system records a conflict and refuses the second event rather than merging the two meanings

### Requirement: Server-owned subject and scope

The server SHALL derive authenticated subject, tenant, role, course/session scope and producer authority from trusted runtime context. Client-provided identity or scope fields MAY be hints for validation, but MUST NOT expand or replace the derived values.

#### Scenario: Tampered scope cannot cross a boundary

- **WHEN** a client submits another learner, tenant, course or class identifier
- **THEN** the event is rejected or constrained to the server-derived scope and no cross-user record is accepted

#### Scenario: Authority is checked before acceptance

- **WHEN** a producer lacks the registry authority required for an event discriminator
- **THEN** the boundary fails closed before persistence or downstream projection

### Requirement: Privacy-minimized payloads

The registry SHALL classify event fields and define role-appropriate minimum projections. Raw answers, prompts, model output, user identifiers and teacher-scoped data MUST NOT be emitted to a consumer or report whose authority does not include them.

#### Scenario: Public projection is minimized

- **WHEN** an event is projected for a student-safe or public consumer
- **THEN** only fields allowed by its classification are returned and unavailable fields remain unavailable rather than being fabricated

### Requirement: Explicit compatibility and internal-call boundary

Legacy events SHALL be converted only through an explicit compatibility adapter that preserves legacy provenance and rejects unsafe inference. The contract MUST NOT require every internal same-transaction application call to emit an event.

#### Scenario: Legacy event lacks trustworthy identity

- **WHEN** a legacy payload cannot safely establish subject, scope, causation or dedupe
- **THEN** the adapter records a recoverable compatibility failure and does not invent missing values

#### Scenario: Internal fact operation remains an API call

- **WHEN** a trusted application service performs a same-transaction operation covered by the Learning Record ingestion API
- **THEN** it uses the application boundary directly without producing a duplicate event solely to satisfy this contract

### Requirement: Closed characterization denominator

The migration ledger SHALL enumerate all known event producers, consumers, workers, backfills, reports, tests and callers, together with current behavior, owner, authority, privacy boundary and deletion condition before claiming contract adoption.

#### Scenario: New producer is registered

- **WHEN** a producer is added or migrated
- **THEN** its discriminator, owner, authority, privacy classification, characterization evidence and focused tests are recorded before it is treated as supported

### Requirement: Immutable source anchors are preserved

Every accepted event, LearningFact, correction, replay and backfill SHALL preserve an immutable anchor set containing `sourceEventId`, `sourceLogId` when applicable, canonical knowledge/resource/activity identity, `revision`/`captureRevision`, `schemaVersion`, `decoderVersion` and `materializerVersion`. A correction or rematerialization MAY add a new derived identity, but MUST reference rather than overwrite the original anchor.

#### Scenario: Direct and outbox paths share an anchor

- **WHEN** one logical input is handled through a direct transaction or a cross-process outbox
- **THEN** both paths retain the same source and canonical anchors and cannot create a second semantic event

#### Scenario: Correction and backfill preserve history

- **WHEN** a correction, replay or backfill derives a new result
- **THEN** the original anchor/version remains immutable and the new record contains an explicit relation and derivation version

### Requirement: Trusted temporal fields are distinct

The contract SHALL distinguish trusted `trustedOccurredAt`, server `receivedAt`, and successful `materializedAt`. Client time MAY be retained only as `reportedClientAt`; it MUST NOT become trusted occurrence time or a primary ordering key. Each source SHALL declare its trust class, clock-skew policy and late-input behavior.

#### Scenario: Client clock is skewed

- **WHEN** `reportedClientAt` falls outside the source clock-skew window
- **THEN** it remains untrusted diagnostic metadata and the event is rejected or marked late/clock-skew according to the source policy

#### Scenario: Trusted occurrence is delayed

- **WHEN** a trusted event arrives after newer events have been received
- **THEN** it is ordered by trusted occurrence plus stable source identity and does not rewrite any previously recorded server time

### Requirement: Ordering and derivation are deterministic

The system SHALL use a documented stable ordering composed of trusted occurrence/source sequence and immutable source/dedupe tie-breakers. For the same anchors and trusted input set, input digest, trusted set digest and projection output MUST be identical independent of delivery order or replay count.

#### Scenario: Same events arrive in different orders

- **WHEN** an identical set of events is delivered in two permutations
- **THEN** canonical ordering, digest and derived output are equal

#### Scenario: Replay uses the original timestamps

- **WHEN** an accepted event is replayed
- **THEN** its trusted occurrence, received and original materialized times and anchors are unchanged; a decoder change is recorded only as explicit rematerialization

### Requirement: Revision changes require explicit rebase

An event or fact whose canonical identity, `revision` or `captureRevision` does not match the active contract SHALL be rejected by default. A cross-revision rebase MUST be explicit, authorized, reasoned, target-versioned and recorded without erasing the source anchor.

#### Scenario: Cross-revision input is submitted

- **WHEN** a producer submits an input captured under an incompatible revision without a rebase receipt
- **THEN** the boundary fails closed and does not silently reinterpret or materialize it

### Requirement: Trust-boundary payloads use a physical allowlist

Transport/outbox SHALL allow only event/version/time, non-personal producer/scope references, partition/sequence/idempotency, materialization-required enums/normalized values, capture/decoder versions, optional non-guessable raw artifact reference plus digest/expiry/access policy, and delivery status. LearningFact SHALL contain only minimal canonical/opaque subject/object identity, normalized result/quality/time/revision/source summary, status/revocation and governance receipt. Failure/DLQ SHALL contain only stage, redacted error code/fingerprint, counts/times/final state, artifact deletion status and authorized operation reference.

#### Scenario: Forbidden payload is submitted

- **WHEN** an input contains generic payload JSON, raw answer, free text, prompt, model/parser output, direct user identifier or exception text
- **THEN** the allowlist/sanitizer rejects or strips it before persistence and records only a permitted failure fingerprint

#### Scenario: Raw artifact is approved

- **WHEN** an authorized operation requires a minimal raw fragment
- **THEN** it is stored separately under an independent key/ACL with digest, purpose, schema and expiry, and its access is not inherited by queue/fact/consumer roles

### Requirement: Retention and deletion are fail-closed

Retention SHALL enforce hard upper bounds: replay transport defaults to 72 hours and is capped at 7 days, successful payloads are deleted within 24 hours, failure receipts default to 30 days and are capped at 90 days, restricted raw artifacts default off and are capped at 7 days after approval, and public audit is minimal aggregation with a default 90-day bound. Terminal receipts MUST be atomically recorded before deletion; non-terminal transport MUST NOT be silently discarded.

#### Scenario: Terminalization races deletion

- **WHEN** a transport item is eligible for deletion while terminalization is still in progress
- **THEN** deletion waits for the durable terminal receipt and preserves the item if terminalization cannot commit

#### Scenario: Expired raw artifact is removed

- **WHEN** a restricted raw artifact reaches expiry
- **THEN** a deletion receipt verifies that its object, index, cache and replica are unreadable

### Requirement: Replay and export are separately authorized

Replay SHALL require scope, purpose, ticket, short-lived elevated authority and two-person or equivalent control, and SHALL reuse the original idempotency/schema/decoder/anchor contract. Exports MUST exclude raw answers, prompts, model/parser text, reversible user IDs, raw artifacts, tokens, addresses, local paths and identifying small samples.

#### Scenario: Normal consumer requests replay or raw

- **WHEN** a queue, fact or normal consumer role requests restricted replay or raw artifact access
- **THEN** authorization fails closed and no raw payload or replay capability is inherited

