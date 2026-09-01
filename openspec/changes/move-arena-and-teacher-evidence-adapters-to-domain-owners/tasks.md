## 1. Freeze Arena and Teacher adapter inventory

- [x] 1.1 Import the C5 writer-boundary ledger and enumerate Arena/Teacher producers, consumers, workers, reports, routes, scripts and tests.
- [x] 1.2 Classify each path as official, preview, class-scoped read, historical audit or backfill and record its owner, transport, identity, anchors, privacy and deletion condition.
- [x] 1.3 Resolve active OpenSpec overlaps before touching shared Arena submission, Teacher report or Learning Record files.

## 2. Move Arena evidence ownership

- [x] 2.1 Route official submission/evaluation and preview summary mapping through the Arena domain public/application API.
- [x] 2.2 Preserve official score/validity/constraint/leaderboard authority, preview ineligibility, hidden-scenario redaction, source anchors, revisions and dedupe.
- [x] 2.3 Add cross-entry, duplicate, crash-before-ack, unbound-submission and preview-promotion negative tests.

## 3. Move Teacher evidence ownership

- [x] 3.1 Route class insights, student evidence, diagnosis report input and delivery reads through the Teacher public/application API.
- [x] 3.2 Enforce server-derived teacher/class/student scope, independent-learner suppression and truthful missing/stale/partial status.
- [x] 3.3 Add cross-class, unauthorized student, small cohort, raw-event fallback and stale-projection negative tests.

## 4. Retire obsolete adapters

- [x] 4.1 Migrate all route, worker, report, backfill and test callers and run static/dynamic zero-import canaries.
- [x] 4.2 Delete or isolate only old data-governance business adapters with parity, privacy, zero-caller and rollback evidence.
- [x] 4.3 Preserve historical facts/reports and keep audit/backfill access separately authorized and non-online.

## 5. Verify handoff to C8

- [x] 5.1 Run Arena, Teacher, Learning Record, PostgreSQL/outbox, privacy and representative route tests including concurrent retry/restart cases.
- [x] 5.2 Run `rtk npm run typecheck`, `rtk openspec validate move-arena-and-teacher-evidence-adapters-to-domain-owners --type change --strict` and `rtk git diff --check`.
- [x] 5.3 Record owner/deletion/parity receipts; do not simplify ingestion or alter event contract in this change.
