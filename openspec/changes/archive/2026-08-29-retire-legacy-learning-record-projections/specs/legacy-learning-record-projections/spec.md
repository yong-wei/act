# legacy-learning-record-projections Specification

## ADDED Requirements

### Requirement: Retirement is gated by a closed denominator

Legacy Learning Record runtime SHALL be retired only after a revision-bound ledger enumerates every producer, consumer, worker, backfill, report, queue, materializer, raw aggregator and test, with a migrated replacement, owner, watermark/digest receipt, privacy validation and rollback condition.

#### Scenario: Missing ledger row

- **WHEN** a legacy component has an unknown caller or missing replacement receipt
- **THEN** retirement fails closed and the component remains available for safe operation

#### Scenario: All callers are migrated

- **WHEN** zero required runtime callers are proven and all replacement receipts are valid
- **THEN** the component becomes eligible for the explicitly ordered deletion step

### Requirement: Queue retirement cannot lose inputs

The old Redis destructive queue SHALL NOT be deleted or treated as drained until producers have stopped writing it, each pending input has an applied/duplicate/retryable/terminal receipt, and processing/state watermark parity is verified. Retirement MUST NOT rely on pre-processing destructive pop.

#### Scenario: Crash during drain

- **WHEN** a drain worker crashes before acknowledging a message
- **THEN** the message remains recoverable for retry/replay and its logical fact cannot be double counted

#### Scenario: Unconfirmed message remains

- **WHEN** any queue message lacks an applied, duplicate or explicit failure receipt
- **THEN** queue retirement is blocked and the message is retained for authorized recovery

### Requirement: Duplicate materialization and raw aggregators are removed only after replacement

Duplicate fact materializers, legacy projection services and normal-page raw event aggregators SHALL be deleted only after canonical ingestion/current projection and stable read ports have revision-bound parity and zero required callers. Authorized audit/debug/migration/drilldown operations MAY retain constrained historical access.

#### Scenario: Page loses current projection

- **WHEN** a normal page cannot obtain a qualified current projection after legacy removal
- **THEN** it returns governed stale/unavailable status and does not aggregate raw events as fallback

### Requirement: Historical evidence and official authority are preserved

Retirement MUST NOT delete or rewrite historical LearningFacts, snapshots, transitions, outbox receipts or Arena official results. Code/pointer rollback SHALL preserve append-only history and SHALL NOT change official scores, leaderboards or Personalization ownership.

#### Scenario: Retirement is rolled back

- **WHEN** parity or deployment evidence reveals a regression
- **THEN** the system restores the previous qualified current or runtime path while retaining all historical facts and failure receipts

### Requirement: Deletion is concurrency- and privacy-safe

Each deletion step SHALL have concurrency, replay, crash, cross-user authorization, privacy and zero-caller verification. Failure records, drain receipts and audit operations MUST contain only minimized permitted fields and MUST NOT expose raw answers, prompts, model output or unauthorized identifiers.

#### Scenario: Unauthorized audit request

- **WHEN** a normal student or teacher request attempts to invoke a retirement-era raw audit operation
- **THEN** authorization fails closed and no historical raw payload is returned

### Requirement: Retirement does not change active authority contracts

Legacy deletion SHALL preserve the server-authorized ground-evidence-copilot context contract, Arena official authority, Assessment direct fact semantics and Personalization plugin boundary.

#### Scenario: Copilot remains active after retirement

- **WHEN** Evidence Copilot requests governed student context after legacy readers are removed
- **THEN** it uses the existing server-authorized read path with advisory-only behavior and no duplicated permission contract

### Requirement: Legacy raw material is sanitized and physically isolated before deletion

Legacy raw JSON, Redis/batch/outbox payloads and failure/DLQ material SHALL pass through a versioned allowlist sanitizer before any retirement operation. Transport, LearningFact, failure/DLQ, restricted raw artifact and public audit SHALL use separate physical/key/ACL domains; ordinary queue/fact/consumer permissions MUST NOT inherit restricted raw access.

#### Scenario: Unknown legacy field is encountered

- **WHEN** an old payload contains an unknown field, schema/version, digest, retention or artifact reference
- **THEN** the sanitizer fails closed and retirement preserves the payload for authorized recovery without exposing it to a normal consumer

#### Scenario: Raw artifact is approved for replay

- **WHEN** a ticketed authorized operation needs a minimal raw fragment
- **THEN** only an opaque reference and digest/purpose/schema/expiry/policy metadata cross the boundary, while the fragment remains separately ACL-protected

### Requirement: Retirement obeys hard retention and deletion receipts

Retirement SHALL enforce hard upper bounds: non-terminal transport replay defaults to 72 hours and is capped at 7 days, successful payloads are deleted within 24 hours, failure receipts default to 30 days and are capped at 90 days, restricted raw defaults off and is capped at 7 days after approval, and public audit is minimal aggregation with a default 90-day bound. Terminal/deletion receipts MUST commit before cleanup, and cleanup MUST verify object, index, cache and replica unreadability.

#### Scenario: Cleanup races terminalization

- **WHEN** deletion begins while a transport item is not durably terminal or its deletion receipt is incomplete
- **THEN** cleanup waits or retries and the item remains recoverable; it is never silently discarded

### Requirement: Retirement verification covers every path

Before deletion, verification SHALL cover recursive forbidden-field and encoding/exception-echo checks, all-path canaries, mixed schema/version and unknown-reference failures, kill/restart/duplicate/out-of-order delivery, atomic terminalization, ACL/replay audit, public-export negatives and Postgres/Redis/queue/deployment integration. Rollback MUST restore only code or a qualified pointer and MUST NOT restore broad raw JSON or ACL.

#### Scenario: Deleted legacy path is invoked

- **WHEN** a stale producer, page, worker or report invokes a removed raw/materializer path
- **THEN** the call fails closed or routes to the governed replacement and leaves an auditable zero-caller/retirement failure receipt
