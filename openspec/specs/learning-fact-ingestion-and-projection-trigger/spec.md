# learning-fact-ingestion-and-projection-trigger Specification

## Purpose
Canonical LearningFact ingestion owns normalization, authority checks, identity, deduplication, persistence and projection-trigger derivation. Direct same-transaction producers and cross-process workers share one API; Redis delivery uses claim/lease and acks only after success.
## Requirements
### Requirement: One canonical fact-ingestion API

All supported LearningFact producers SHALL use one application-level ingestion API for normalization, authority/quality validation, canonical identity, deduplication, persistence and projection-trigger derivation. A producer MUST NOT independently perform a direct fact write and an outbox materialization for the same logical input.

#### Scenario: Direct same-transaction input

- **WHEN** a trusted producer and fact write share one transaction
- **THEN** the producer calls the canonical API and the fact plus its idempotent trigger intent commit as one logical operation

#### Scenario: Cross-process input

- **WHEN** a producer crosses a process boundary
- **THEN** it stages one outbox input that a worker submits to the same API, without a second direct fact write

### Requirement: Durable idempotent state transitions

Ingestion SHALL expose deterministic `staged`, `deduplicated`, `applied`, retryable-failure and terminal-failure outcomes. Unique logical identity and input digest SHALL prevent concurrent delivery or replay from creating a second fact or trigger.

#### Scenario: Concurrent replay

- **WHEN** two workers process the same logical input concurrently
- **THEN** one fact and one effective trigger result are retained and both workers receive a deterministic applied/duplicate outcome

#### Scenario: Conflicting replay

- **WHEN** a dedupe identity is replayed with a different immutable payload or authority
- **THEN** ingestion records a conflict and refuses the conflicting input

### Requirement: Ack only after recoverable success

The cross-process worker SHALL use non-destructive claim/lease or equivalent delivery semantics. It MUST acknowledge an input only after the fact transaction and projection-trigger intent are durably committed; failures before acknowledgement SHALL remain recoverable.

#### Scenario: Crash before acknowledgement

- **WHEN** a worker crashes after staging or after a transaction but before acknowledgement
- **THEN** the input becomes visible for retry and dedupe prevents double counting after replay

#### Scenario: Processing failure

- **WHEN** validation, persistence or trigger derivation fails
- **THEN** the input remains pending/retryable or is recorded as terminal failure with a reason and replay metadata, rather than being silently removed

### Requirement: One projection-trigger derivation

Every newly applied, corrected or revoked LearningFact SHALL produce the canonical trigger descriptor for its affected learner/class and revision. Direct, worker, Assessment, Personalization and backfill paths MUST share this derivation and preserve the distinction between processing watermark and state watermark.

#### Scenario: Direct core fact schedules projection

- **WHEN** a core fact is accepted through the direct route
- **THEN** the same ingestion result records a durable projection trigger and the fact cannot be left silently without scheduling evidence

#### Scenario: Duplicate fact does not advance state

- **WHEN** an already applied fact is replayed
- **THEN** no duplicate trigger or state-watermark advance is created, although processing receipt may be recorded

### Requirement: Batch and backfill denominator closure

Batch, outbox and backfill processing SHALL retain per-input acceptance, duplicate, invalid, retryable and terminal outcomes. A successful batch marker MUST NOT hide an invalid or unprocessed fact from the denominator.

#### Scenario: Partially invalid batch

- **WHEN** a batch contains both valid and invalid inputs
- **THEN** valid facts use the canonical API and each invalid input has a separate auditable failure outcome

### Requirement: Privacy and authority at ingestion

The canonical API and staging transport SHALL enforce the event contract's server-derived subject, tenant, scope, authority and privacy classification before writing facts or failure payloads. Raw answers, prompts, model output and unauthorized identifiers MUST NOT leak into public or cross-role records.

#### Scenario: Unauthorized staging payload

- **WHEN** a producer attempts to stage a learner or teacher-private payload outside its authority
- **THEN** the input is rejected before fact persistence and the failure record is minimized to permitted diagnostic fields

### Requirement: Ingestion preserves immutable anchors and timestamps

The canonical API SHALL preserve `sourceEventId`, applicable `sourceLogId`, canonical knowledge/resource/activity identity, `revision`/`captureRevision`, `schemaVersion`, `decoderVersion` and `materializerVersion` for direct, outbox, correction, replay and backfill inputs. It SHALL distinguish trusted `trustedOccurredAt`, server `receivedAt`, and successful `materializedAt`; client time MAY remain only as `reportedClientAt`.

#### Scenario: Direct and outbox ingestion converge

- **WHEN** one logical input is submitted synchronously or through staging
- **THEN** the resulting fact/receipt keeps the same immutable anchors and trusted occurrence, with server receipt/materialization times recorded separately

#### Scenario: Replay does not rewrite history

- **WHEN** an applied input is replayed or corrected
- **THEN** the original anchor and three server times remain unchanged, and any new correction/rematerialization references the original explicitly

### Requirement: Source trust, skew and stable ordering are explicit

Each source SHALL declare its trust class, clock-skew window and late-input policy. Inputs SHALL be ordered by trusted occurrence and trusted source sequence with immutable source/dedupe tie-breakers, not by Redis arrival order or `reportedClientAt`.

#### Scenario: Late or out-of-order input arrives

- **WHEN** a trusted event arrives after a later event or outside its declared clock-skew window
- **THEN** the system applies the source's late/clock-skew failure policy and preserves deterministic stable ordering without rewriting prior timestamps

### Requirement: Revision changes and rematerialization are explicit

Cross-`revision`/`captureRevision` input SHALL be rejected by default. An authorized rebase MUST declare its source and target revisions, reason and receipt. A decoder/materializer change MUST create explicit rematerialization metadata rather than masquerading as replay.

#### Scenario: Cross-revision input lacks rebase

- **WHEN** an input's capture revision does not match the target contract and no rebase receipt exists
- **THEN** ingestion fails closed without silently remapping its canonical identity

### Requirement: Ingestion and trigger derivation are deterministic

Canonical input digest, trusted-set digest and projection trigger descriptor SHALL be functions of the normalized immutable anchors, stable ordering, trusted set and materializer version. The same input set MUST yield the same values under direct delivery, replay, backfill or out-of-order delivery.

#### Scenario: Permuted replay

- **WHEN** the same facts are replayed in different delivery orders
- **THEN** the effective fact set, digest and projection trigger are identical and state watermark advances at most once

### Requirement: Transport, fact and failure payloads use a minimal allowlist

Transport/outbox SHALL allow only event/version/time, non-personal producer/scope refs, partition/sequence/idempotency, materialization-required enums/normalized values, capture/decoder versions, optional non-guessable raw artifact reference plus digest/expiry/access policy, and delivery status. LearningFact SHALL contain only minimal canonical/opaque subject/object identity, normalized result/quality/time/revision/source summary, status/revocation and governance receipt, and SHALL follow the course-validity-plus-365-day default retention subject to governance profile and deletion requests. Failure/DLQ SHALL contain only stage, redacted error code/fingerprint, counts/times/final state, artifact deletion status and authorized operation reference.

#### Scenario: Recursive forbidden field is found

- **WHEN** generic payload JSON, raw answer, free text, prompt, model/parser text, direct user ID, full exception or stack appears at any ingestion boundary
- **THEN** versioned sanitizer/allowlist rejects it before persistence and emits only a permitted fingerprint

### Requirement: Raw artifact access and retention are isolated

Restricted raw artifacts SHALL default to disabled and, when approved, SHALL use separate physical storage, encryption key, ACL and audit. Queue/fact/consumer permissions MUST NOT inherit raw access. Retention SHALL use hard upper bounds of replay transport 72 hours by default/7 days maximum, successful payload 24 hours, failure receipt 30 days by default/90 days maximum, approved raw 24 hours by default/7 days maximum, and minimal public audit 90 days by default. Terminal receipt MUST be durable before deletion; non-terminal transport MUST NOT be silently dropped.

#### Scenario: Terminalization and expiry race

- **WHEN** deletion runs while terminalization or raw expiry is incomplete
- **THEN** deletion waits for an atomic terminal/deletion receipt and verifies object, index, cache and replica unreadability

### Requirement: Replay and export cannot inherit raw authority

Replay SHALL require scope, purpose, ticket, short-lived elevated authority and two-person or equivalent control, and SHALL reuse original idempotency/schema/decoder/anchor. Exports MUST exclude raw answers, prompts, model/parser text, reversible user IDs, raw artifacts, tokens, addresses, local paths and identifiable small samples.

#### Scenario: Normal worker attempts unauthorized replay

- **WHEN** a queue, fact or consumer role invokes restricted replay or raw artifact access without the approved operation
- **THEN** authorization fails closed and no raw payload or replay capability is granted

