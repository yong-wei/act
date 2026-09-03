## Context

The archived residual adjudication is internally useful: all 262 historical records have one owner and one outcome, and the result found no true cross-domain processing kernel. It is nevertheless `COMPLETE-non-qualified-BLOCKER` because the full source inventory bytes were not readable and verified. Its subject predates the current integration tree, so neither the historical member set nor its owner decisions are current migration authority.

This change reuses the existing modular-monolith charter and residual adjudicator. It follows the current payload eligibility completion to avoid concurrent interpretations of the census, but it captures its own subject after that upstream change is archived. The dependency orders work; it does not make the two subjects equal.

## Goals / Non-Goals

**Goals:**

- Freeze a clean claim-time integration subject and rebuild the current residual Data Governance member and caller denominator.
- Verify the actual full ledger bytes rather than accepting a locator or historical hash alone.
- Assign each current record exactly one existing accountable owner and one orthogonal outcome from current evidence.
- Bind payload, privacy, retention, recovery, and rollback conditions against this change's subject.
- Emit only qualified, digest-bound migration-input slices or one explicit blocker package.

**Non-Goals:**

- Moving files, rewriting imports/exports, changing public APIs, deleting the umbrella, or creating downstream Issues.
- Changing LearningFact, Assignment, Arena, Portrait, classroom, backfill, privacy, retention, Prisma, test-command, runtime, or production behavior.
- Inheriting the upstream payload subject or the archived #1883 decisions as current truth.
- Activating the charter, architecture baseline, fitness budget, or test qualification.

## Decisions

### 1. Use native dependency for serialization, not identity inheritance

The mapped upstream `complete-current-repository-payload-eligibility-classification` Issue must be closed with `status:archived` and its native `blockedBy` edge resolved before claim. This prevents both changes from editing or interpreting shared census machinery concurrently.

After the dependency gate, this change freezes its own clean `origin/integration` commit/tree and independent tool checkpoint. Upstream policy and safe classification evidence may be consumed only when rebound to the Data Governance subject or recorded as a drifted comparison.

### 2. Rebuild the current scoped denominator

The subject inventory covers every current tracked member under `src/lib/data-governance/**` and every production, test, tooling, dynamic, re-export, documentation, route, worker, scheduler, and persistence caller. It records path/blob identities, caller class, family evidence, payload identity, and justified exclusions. Historical counts are comparison data, never an acceptance constant.

The full ledger remains outside Git, but an independent verifier must read its bytes and confirm locator, byte count, SHA-256, subject/tool identities, member/caller totals, and compact projections. The previous `full-inventory-bytes-unverified` state cannot be repaired by copying its digest into a new summary.

### 3. Preserve exactly-one owner and orthogonal outcome

The adjudicator continues to use the existing charter owner catalog and the six residual outcomes. A qualified record has exactly one accountable owner and exactly one of the first five outcomes; `unresolved` is blocking, not an owner or exception.

Historical decisions may be compared path-by-path. They are accepted only when current callers, public boundaries, authority, privacy, and trust evidence independently support the same result. Families split whenever any member differs on those facts.

### 4. Rebind high-risk invariants as read-only constraints

The package records, without modifying:

- the sole online Learning Record writer, fact identity/deduplication, trusted time, outbox, pointer, and watermark;
- Assignment approved-snapshot, CAS, idempotency, processing-policy, derivative, and outbox boundaries;
- ArenaSubmission as official scoring authority and LearningFact as context-only evidence where declared;
- Portrait V2 as primary with legacy competency compatibility;
- classroom authorization, redaction, and independent-learner suppression;
- operator/backfill separation from online writers and current pointers;
- privacy, retention, recovery, and rollback obligations.

An unproved invariant leaves the affected record unresolved and the package non-qualified.

### 5. Produce migration inputs, not a migration schedule

Each qualified future slice contains exact paths, accountable owner, public boundary, all caller classes, not-touched paths, trust invariants, payload status, zero-consumer proof requirement, deletion condition, rollback, and required future authorization. A slice is an input to a later Buddy propose; it neither creates that Issue nor permits implementation.

The archived result's `processing-kernel: 0` is not hardcoded. If current evidence still yields zero kernel members, the handoff may make umbrella retirement the eventual outcome. If current evidence differs, it must remain visible rather than being forced to match the plan.

### 6. Keep projections compact and deterministic

Git receives a compact matrix, summaries, future-slice index, handoff, and actual full-ledger locator/byte-count/SHA-256/verification receipt. The decision/package digest excludes self-referential index bytes and binds the independent subject, tool, schema, frozen inputs, normalized records, and artifact index.

## Risks / Trade-offs

- **[Risk] The upstream payload package and this subject differ.** → Rebind applicable evidence to this subject and mark unproved records unresolved; never require the subjects to match or silently inherit results.
- **[Risk] Caller discovery misses dynamic or operational use.** → Enumerate every declared caller class, preserve unknown dynamic/remote use as unresolved, and require reverse denominator closure.
- **[Risk] Historical owner decisions bias the new result.** → Treat them as comparisons only and require current evidence for every owner/outcome.
- **[Risk] A qualified slice is mistaken for authorization.** → Make all outputs action-neutral and test that no source, GitHub, database, runtime, or production mutation occurs.
- **[Risk] The full ledger again becomes unavailable after delivery.** → Require deterministic regeneration plus an independently readable byte-verification receipt before qualification.
