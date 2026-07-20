## Context

The platform has overlapping learner-state projections: legacy `StudentCompetencySnapshot`, primary `StudentPortraitV2Snapshot`, `ClassCompetencySnapshot`, and mutable dependent projections such as feature caches, summaries, recommendations, growth records, risks, and outbox work. The intended model is long-lived state incrementally corrected by governed evidence, but current scheduling, worker, and API code also applies a rolling 30-day boundary. That boundary can enqueue learners solely because time passed, append zero-fact `no-recent-evidence` snapshots, suppress recommendations, and make teacher views discard historical class-scoped evidence.

Production-derived data contains valuable historical facts and snapshots together with newer time-only rows that can win latest-row selection. Existing portrait processing cursors are embedded in portrait snapshots, several readers select the latest physical row directly, and some dependent projections are unique mutable rows. The repair therefore requires coordinated expansion, migration, atomic activation, and later contraction; an additive snapshot alone is neither safe nor reversible.

## Goals / Non-Goals

**Goals:**

- Keep the latest valid governed state effective until new governed evidence changes it or a governed revocation causes recomputation.
- Prevent inactivity, elapsed time, scheduler cadence, and empty rolling windows from creating capability decline or replacement no-evidence state.
- Consume context-only facts exactly once without creating learner-state snapshots.
- Apply deterministic scope, authority, ordering, revocation, class-membership, and negative-evidence rules across all consumers.
- Migrate affected history through frozen inputs, shadow projections, atomic activation, verifiable rollback, and privacy-minimized audit evidence.
- Verify corrected behavior against a fresh local production import before production apply.

**Non-Goals:**

- Re-score raw submissions, invent evidence, or change competency formulas and portrait dimensions.
- Treat inactivity or revocation itself as negative capability evidence.
- Broaden teacher authorization, merge class scopes, or infer historical membership from a current `classId`.
- Delete historical snapshots needed for audit.
- Expand into unrelated data-governance or course-content backlog.

## Decisions

### 1. Effective-state selection has explicit scope, authority, and total ordering

Global portrait selection uses scope key `userId`. Class aggregate selection uses `classId`; student-in-class reconstruction uses `(classId, userId)` and requires class/session provenance. A class-scoped authorization change never revokes a global portrait, and a global portrait never substitutes for missing class-scoped evidence.

Candidates are first classified as `valid`, `superseded-time-only`, `ambiguous`, or `invalid-lineage`. Revocation is an event that triggers recomputation from remaining authorized evidence; it is not an automatically empty terminal snapshot. Selection considers only `valid` candidates in the requested scope and orders them by the total tuple `(coveredStateChangingEvidenceWatermark, authorityRank, projectionGeneration, committedAt, stableId)`. Authority rank is native portrait v2, migrated/recomputed portrait v2, then explicit legacy compatibility. `snapshotAt` is display metadata and cannot override the tuple. If scope provenance conflicts or the tuple cannot be established, selection fails closed as `unresolved`; it never falls back to a global or lower-authority baseline from another scope.

The shared selector and active projection version are mandatory for profile, student competency, Konling context, planner, recommendation, teacher insight, dashboard, control-correction reports, session/reporting, feature cache, summary, and admin governance consumers. A repository gate rejects new lifecycle-sensitive direct latest-row selection.

### 2. Processing progress follows an append-only ingestion order independent from state snapshots

A dedicated per-scope materialization checkpoint stores the last contiguous committed sequence from an append-only learner-state change journal, projection generation, and fencing token independently from state snapshots. Each scope has a transactional counter row. A producer locks that row before allocating the next contiguous sequence and holds the row lock until its source mutation, journal event, and counter update commit together. Producers for one scope are therefore serialized; rollback removes both event and counter increment and leaves no hole. PostgreSQL sequence/identity values and `MAX(sequence)` are explicitly forbidden as checkpoint watermarks.

Evidence creation, governed negative admission, revocation before physical source deletion, class authorization changes, recommendation completion/feedback, manual risk disposition, and other durable actions that can affect a projection or rollback append an event in the same transaction as their source mutation. Existing facts are bootstrapped into a deterministic pre-journal baseline ordered by `(createdAt, stableId)` under the same scope counter. `startedAt`, `finishedAt`, and snapshot timestamps express business time only and never determine whether a record was processed.

Under the existing per-scope advisory lock, reading journal events, classifying them, advancing the checkpoint, and writing changed projections occur in one transaction. Identical timestamps, late facts with old `startedAt`, historical backfills created after the checkpoint, and revocations after the checkpoint are consumed exactly once by journal sequence.

When a batch contains only context-only or inadmissible facts, the checkpoint advances exactly once but no state snapshot, recommendation, growth record, risk transition, summary/cache rebuild, or outbox task is created. A crash rolls back both checkpoint and state writes. A later state-changing fact begins after the committed checkpoint and affects state once. Scheduler aging candidates are removed; scheduling is driven by unprocessed source records or explicit revocation work.

### 3. Negative evidence and revocation have separate admission contracts

Evidence may decrease a dimension only when all of these hold: its source family is profile-eligible in the governed evidence catalog; the caller and target scope are authorized; required review/quality status is accepted; the fact has a non-empty profile contribution for named dimensions; a canonical negative classification is present; and rationale plus traceable source lineage pass validation. Free-form outcomes alone are insufficient. Failed admission is quarantined or treated as context-only and cannot decrease state.

Negative evidence changes only its declared dimensions through the bounded update policy. Revocation removes specified source evidence and recomputes from all remaining authorized evidence: revoking some positive evidence preserves unaffected evidence/dimensions; revoking negative evidence may increase the recomputed result; revoking class authorization changes only that class scope. Missing or unverifiable revocation lineage is `ambiguous` and blocks automatic repair.

### 4. Freshness, state coverage, and activity are distinct metrics

Responses use stable fields `effectiveSnapshotAt`, `lastStateChangingEvidenceAt`, `freshnessState`, and `freshnessAsOf`, with a named freshness policy version. Freshness may lower a displayed confidence only where that policy permits; it cannot null scores, manufacture weaknesses/reasons, or suppress recommendations based on an otherwise valid state.

Teacher metrics distinguish `enrolledStudentCount`, `effectiveStateCount`, `recentlyActiveCount` with its explicit window, `staleStateCount`, `neverEvidencedCount`, `revokedCount`, and `unresolvedCount`. Every average and distribution states its included count and denominator. Historical coverage is never labeled current activity.

### 5. Class truth uses explicit roster and event-time provenance

Current class analytics use the current roster as the displayed population, but each member contributes only evidence with valid provenance to the requested class. Historical class snapshots retain their frozen population-at-snapshot metadata and are not reinterpreted as current roster metrics. Migration reconstructs historical class participation only from `ClassSession`/session-participant or equivalent governed event-time provenance; current `StudentProfile.classId` is not evidence of past membership. A transferred student's old-class facts do not enter the new class, and unverifiable historical membership is `unresolved`, never replaced by the global portrait.

Class materialization runs only for new authorized class-scoped state changes or revocations. No change retains the effective class projection and produces no dependent work.

### 6. Migration freezes inputs at a journal cutoff and fails closed on ambiguity or drift

Audit runs in a consistent database snapshot and creates a canonically serialized, schema-versioned manifest with UTC timestamps, stable sorting, migration version, a contiguous committed journal cutoff for every scope, exact source record IDs and row checksums, scope keys, classification, proposed action, and expected output checksum. Apply consumes only this immutable manifest. Journal events after each base cutoff are excluded from baseline reconstruction and replayed into both generations before cutover.

Before each bounded scope batch, apply verifies the referenced source rows and checksums. Source drift fails that scope without partial writes; lineage ambiguity is listed record by record and blocks apply unless an authorized, reasoned override is included in the signed manifest and its checksum. Acceptance requires zero unapproved unresolved records. The migration pauses and drains only materialization workers/outboxes that could write the same projections; normal evidence ingestion may continue beyond the cutoff.

### 7. Projection generations are built side by side and activated atomically

The change follows `expand-migrate-contract`:

1. **Expand:** add the append-only change journal, independent checkpoints, versioned/shadow forms for snapshots and every mutable dependent projection, a projection-generation registry, activation pointer, and repair ledger. Deploy dual-capable readers and dual-generation processors while generation v1 remains active.
2. **Migrate:** build generation v2 from the frozen manifest without mutating v1 cache, summary, recommendation, growth, risk, or outbox state. Time-only records remain audit history and are marked superseded in the repair ledger; ambiguous records remain inactive.
3. **Verify:** compare v2 invariants, per-scope checksums, class boundaries, downstream cardinality, and representative routes while v1 still serves traffic.
4. **Catch up and activate:** continuously replay post-cutoff journal events into both generations. For final cutover, acquire a short state-change barrier covering evidence, revocation, authorization, user feedback, risk, and dependent outbox mutations; choose a final journal watermark; drain and verify both generation checkpoints and revocation backlog through that watermark; atomically switch the active generation; then release the barrier. No migration outbox is published before activation.
5. **Contract:** removal of v1 structures and pre-expansion readers is explicitly deferred to a later change after an observation window.

During the observation window, every journal event is processed into both v1 and v2. Generation-aware outbox rows carry a semantic idempotency key, activation fence epoch, and lease state. The cutover barrier prevents new claims and waits until every `CLAIMED` lease for the old epoch is acknowledged, cancelled, or expired and reclaimed; claimed work is part of backlog and can never be treated as drained. The irreversible receiver or first durable consumer validates the active fence epoch immediately before applying effects. A stale rejected delivery does not consume the semantic idempotency key, so it cannot suppress the correct active-generation payload. Inactive pending work is held or cancelled; effects already accepted under a valid semantic key are not republished.

Rollback uses the same claim barrier, in-flight lease drain, receiver fence, equal-scope-watermark, and revocation-backlog gates before atomically switching to v1. Direct rollback is forbidden if any freshness, in-flight, fence, or backlog precondition fails. The minimum rollback binary is the expanded dual-capable release; pre-expansion binaries are unsafe after migration.

### 8. Repair evidence is privacy-minimized

Journal, manifest, and ledger access is restricted to data-governance operators and protected with encryption at rest plus documented retention, archive, and destruction periods. The journal stores only pseudonymous scope, governed event type/schema version, minimal source reference, reason code, checksum, contiguous sequence, fence, and ordering metadata. After source deletion, it retains only a non-reversible tombstone reference. Journal and repair artifacts never copy raw event payload, answer or recommendation-feedback text, risk narrative, private Konling memory, hidden Arena details, email, student number, or display name. Per-student journal entries are excluded from CI artifacts, ordinary logs, dashboards, and public runtime. Published outputs use aggregate counts or pseudonyms and cannot reconstruct identity.

## Testing Strategy
Change class: high-risk
Seam status: required
Public behavior: Learner and teacher analytics retain the latest valid scoped state without new evidence, disclose state date and freshness separately, preserve downstream behavior, and atomically expose corrected projections after historical repair.
Public seam: Data-governance worker integration, active-generation migration integration, and authenticated student and teacher analytics route tests against migration fixtures and a locally imported production database.
Existing seam reused: test:data-governance, portrait-v2 incremental materialization tests, teacher insight route tests, student competency snapshot route tests, recommendation tests, and database repair verification.
AC coverage: AC-1: worker tests prove commit-safe contiguous checkpoints consume late/context-only/revocation events once while time-only batches create no state or downstream writes; AC-2: route and selector tests prove deterministic scoped effective state plus snapshot/freshness fields; AC-3: admission and revocation tests prove bounded dimension-specific changes and fail-closed ambiguity; AC-4: frozen-manifest and per-scope journal-cutoff tests prove deterministic idempotent restartable repair and drift rejection; AC-5: roster/session fixtures prove class isolation and transfer semantics; AC-6: imported-production rehearsal plus journal/repair privacy checks prove zero unapproved unresolved records and redacted evidence; AC-7: downstream tests prove recommendations, growth, risks, summaries, caches, and outboxes remain stable or change only with affected state; AC-8: dual-generation replay, equal-watermark state/claim barrier, in-flight lease drain, receiver fence, activation, metric, and rollback tests prove no mixed, stale, or post-switch old-generation effect.
Manual-only acceptance: none
Rationale: Worker and checkpoint integration exercise the authoritative write boundary, authenticated routes exercise user-visible semantics, and frozen-manifest plus dual-generation tests cover the migration, concurrency, privacy, activation, and rollback risks that helper tests cannot represent.

## Risks / Trade-offs

- [The expansion is larger than a display fix] → Keep it one coordinated vertical change because partial delivery cannot migrate safely; defer contraction.
- [A real revocation is misclassified] → Require canonical lineage and classify uncertainty as blocking `ambiguous`.
- [Concurrent evidence changes the migration source] → Freeze exact IDs/checksums at a journal cutoff and replay later events into both generations before activation.
- [Cross-class contamination or transfer ambiguity] → Require event-time class provenance and fail closed without it.
- [Context-only facts loop forever] → Persist a transactional independent checkpoint with crash/retry tests.
- [Late facts or deleted revocations escape a timestamp cursor] → Use per-scope transactional counters locked through commit; rollback leaves no gap and business timestamps never advance processing.
- [Mixed generations reach users] → Build shadow projections and switch one activation pointer atomically.
- [Rollback revives stale or revoked state] → Continuously synchronize v1, require equal final watermarks under a state-change barrier, and fence/deduplicate generation outbox delivery.
- [Journal or repair artifacts leak identities] → Enforce pseudonymization, minimal event schemas, restricted encrypted storage, redacted output, and retention/destruction controls.

## Migration Plan

1. Expand schema and deploy the append-only change journal, dual-capable readers/processors, shared selector, independent checkpoints, and generation registry with v1 active.
2. Stop aging-only scheduling and validate new incremental workers against v1 behavior without changing active truth.
3. Export production, restore locally, create a local-cutoff manifest, run v2 migrate/verify/activate/rollback rehearsal, and record redacted invariants.
4. Back up production; pause and drain conflicting projection workers/outboxes; create the authoritative production cutoff manifest in a consistent snapshot. The local and production manifests need not share checksums because their cutoffs differ.
5. Review every ambiguous/unresolved item; require zero unapproved unresolved records, or produce signed per-record overrides before apply.
6. Build and verify v2 in bounded batches while dual processors keep v1 active and replay post-cutoff journal events into both generations. Fail scopes on source drift and regenerate a new manifest/version rather than mutate the frozen one.
7. Acquire the state-change and outbox-claim barrier, choose each scope's final contiguous watermark, drain both generations, revocations, pending work, and every claimed lease; assert equal checkpoints and receiver-enforced fence epoch; atomically activate v2, then release the barrier and verify new events.
8. During the observation window keep v1 synchronized. If rollback is required, repeat the state/claim barrier, lease drain, equal-watermark, receiver-fence, and backlog gate before switching to v1. Never deploy a pre-expansion binary.

## Open Questions

- Confirm whether existing governance-operation storage can satisfy the generation registry, checkpoint, override signature, and repair-ledger contracts; otherwise add narrowly scoped models during expansion.
- Determine operational batch sizes, worker/outbox drain commands, artifact retention period, and authorized operator roles from deployment policy before production apply; these parameters cannot weaken the normative cutoff, privacy, or zero-unapproved-unresolved rules.
