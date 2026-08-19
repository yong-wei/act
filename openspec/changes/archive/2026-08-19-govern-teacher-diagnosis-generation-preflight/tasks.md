## 1. Persistence and deterministic preflight

- [x] 1.1 Add nullable governed audit fields, predecessor relations, and ordinary identity uniqueness to jobs and reports with a migration.
- [x] 1.2 Implement authorized canonical input collection with unique tie-break ordering, digesting, category summaries, version comparison, and public preflight projection.
- [x] 1.3 Add unit tests for first generation, new input, unchanged input, version migration, unavailable input, unrelated facts, and privacy-safe output.

## 2. Generation lifecycle integration

- [x] 2.1 Extend request validation for explicit force intent and bounded teacher reason while rejecting browser-authored audit or factual fields.
- [x] 2.2 Recompute preflight in job creation, suppress unchanged ordinary requests, serialize creation/completion by scope, reject stale predecessors, arbitrate concurrent ordinary identities, and preserve active-job/idempotency behavior.
- [x] 2.3 Persist the canonical governed input, require the provider to verify and consume that frozen snapshot, copy immutable audit fields into the formal report, and preserve them across retry and timeout recovery.
- [x] 2.4 Add generation tests for ordinary duplicate suppression, force audit, concurrency races, failure exclusion, and retry identity retention.

## 3. API and teacher interface

- [x] 3.1 Add an authenticated read-only preflight endpoint with class ownership and current-membership checks.
- [x] 3.2 Add route tests for authorization, projection safety, no-write preflight, ordinary rejection, and forced generation.
- [x] 3.3 Add the preflight confirmation and required force-reason flow to report history, keeping active/failed status visible and completed status collapsed.
- [x] 3.4 Add component tests for all preflight states, force validation, task lifecycle feedback, and refreshed report selection.

## 4. Verification and evidence

- [x] 4.1 Generate Prisma client and run targeted diagnosis generation, route, persistence, and component tests.
- [x] 4.2 Run typecheck, affected lint, strict OpenSpec validation, and the real PostgreSQL migration/constraint smoke.
- [x] 4.3 Refresh teacher diagnosis browser evidence and verify governed-source/evidence manifests when source paths require it.
