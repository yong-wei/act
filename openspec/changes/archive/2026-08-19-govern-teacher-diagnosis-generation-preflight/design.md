## Context

The existing generation path already owns authorization, fixed cutoffs, durable jobs, retries, server-side evidence validation, and atomic report completion. Its provider currently reads only governed risk flags, competency snapshots, and knowledge progress. Assignment and assessment sources are intentionally shown as unavailable by the report-history contract until a governed evidence adapter exists.

## Goals / Non-Goals

**Goals:**

- Make eligibility deterministic from exactly the inputs the current provider can read.
- Preserve an immutable audit record from preflight through the formal report.
- Make ordinary concurrency safe independently of request idempotency keys.
- Keep browser preflight advisory; the generation endpoint remains authoritative.

**Non-Goals:**

- Expanding the diagnosis provider to new evidence tools.
- Changing risk or learner-portrait calculations.
- Scheduling diagnosis generation or creating interventions.

## Decisions

### 1. Canonical input snapshot and digest

Preflight authorizes the scope, fixes a cutoff, resolves current class membership, and reads the provider's eligible rows: active supported risk flags, the latest competency snapshot per member for class scope, and knowledge-progress rows. Every source query and canonical array uses a stable row identity as its final tie-breaker. The competency snapshot remains the provider's explicit non-sovereign portrait-v2 compatibility input; preflight does not promote it to a primary learner portrait. It serializes only stable identities, timestamps, and diagnosis-relevant values in a canonical order, persists that governed input on the job, and computes its SHA-256 digest. The worker passes the persisted snapshot to the provider, which verifies the digest before any model call and never rereads mutable evidence rows for that job.

The public summary contains category availability and aggregate counts only. The private canonical snapshot is not returned or persisted. This is preferred over comparing report citations because model citations can be a subset of available governed input and would misclassify unchanged inputs.

### 2. Versioned eligibility rules

`teacher-diagnosis-preflight.v1` is stored with each job and report. A generator or rule version mismatch permits ordinary generation and is labeled `version-change`. Otherwise the current digest is compared with the predecessor report digest. The first report is allowed only if at least one eligible governed input exists.

### 3. Server-authoritative request flow

The browser fetches preflight to explain the decision. POST recomputes preflight and ignores any browser-supplied counts, cutoff, digest, predecessor, or version. This closes time-of-check/time-of-use and tampering gaps. `no-effective-change` and `unavailable` exit before job creation and queue delivery.

### 4. Ordinary identity and forced audit

An ordinary identity is a hash of teacher, subject, scope, input digest, generator version, and rule version. A nullable unique database field on generation jobs arbitrates concurrent ordinary requests. Forced jobs have no ordinary identity, require a bounded teacher reason, and retain the same immutable audit fields. Job creation and report completion share a transaction-scoped advisory lock per teacher/class/student scope. After acquiring the lock, creation rechecks both the active job and latest report before inserting, so a forced request cannot bind a predecessor that became stale during preflight. Existing active-scope and request-idempotency constraints remain in force.

Reports copy the job's audit fields inside the existing completion transaction. The job foreign key remains the exact generation authority; predecessor references use restrictive relations.

### 5. Source-category semantics

Risk and learning behavior are eligible categories. Competency snapshot changes are reported under eligibility because they determine whether the generator has a current governed profile input. Assignment and assessment are always `unavailable` in v1 and never unlock generation. This is explicit rather than inferring changes from unrelated tables the provider cannot consume.

### 6. UI interaction

Generate first opens a preflight panel. Allowed ordinary states provide a confirm action. `no-effective-change` exposes a force option with a required reason. Active tasks point to the durable job. Completed lifecycle status uses a collapsed `<details>` control; failures and retry remain expanded.

## Risks / Trade-offs

- [A mutable progress row changes without a new identity] → Include diagnosis-relevant values and `lastVisited` in the canonical snapshot, not only row IDs.
- [A risk resolution removes a previously eligible row] → Digest the complete current eligible set so removals count as effective risk changes.
- [Preflight and provider queries drift] → Keep source rules explicit, test representative query predicates, and version the deterministic rule when eligibility semantics change.
- [Legacy reports have no digest] → Treat their next preflight as a version migration so the first governed report establishes the new audit baseline.
- [Database migration is rolled back after governed rows exist] → Application rollback must precede migration rollback; nullable additions allow rolling application versions during deployment.

## Migration Plan

1. Add nullable audit columns and ordinary identity uniqueness; existing jobs and reports remain readable.
2. Deploy the application so every new job and report writes governed audit fields.
3. Existing reports without audit fields trigger one `version-change` generation rather than being guessed or backfilled.
4. Roll back application code before dropping columns or indexes; no evidence truth source requires data reversal.
