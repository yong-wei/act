## 1. Freeze Arena and Teacher adapter inventory

- [ ] 1.1 Import the C5 writer-boundary ledger and enumerate Arena/Teacher producers, consumers, workers, reports, routes, scripts and tests.
- [ ] 1.2 Classify each path as official, preview, class-scoped read, historical audit or backfill and record its owner, transport, identity, anchors, privacy and deletion condition.
- [ ] 1.3 Resolve active OpenSpec overlaps before touching shared Arena submission, Teacher report or Learning Record files.

## 2. Move Arena evidence ownership

- [ ] 2.1 Route official submission/evaluation and preview summary mapping through the Arena domain public/application API.
- [ ] 2.2 Preserve official score/validity/constraint/leaderboard authority, preview ineligibility, hidden-scenario redaction, source anchors, revisions and dedupe.
- [ ] 2.3 Add cross-entry, duplicate, crash-before-ack, unbound-submission and preview-promotion negative tests.

## 3. Move Teacher evidence ownership

- [ ] 3.1 Route class insights, student evidence, diagnosis report input and delivery reads through the Teacher public/application API.
- [ ] 3.2 Enforce server-derived teacher/class/student scope, independent-learner suppression and truthful missing/stale/partial status.
- [ ] 3.3 Add cross-class, unauthorized student, small cohort, raw-event fallback and stale-projection negative tests.

## 4. Retire obsolete adapters

- [ ] 4.1 Migrate all route, worker, report, backfill and test callers and run static/dynamic zero-import canaries.
- [ ] 4.2 Delete or isolate only old data-governance business adapters with parity, privacy, zero-caller and rollback evidence.
- [ ] 4.3 Preserve historical facts/reports and keep audit/backfill access separately authorized and non-online.

## 5. Verify handoff to C8

- [ ] 5.1 Run Arena, Teacher, Learning Record, PostgreSQL/outbox, privacy and representative route tests including concurrent retry/restart cases.
- [ ] 5.2 Run `rtk npm run typecheck`, `rtk openspec validate move-arena-and-teacher-evidence-adapters-to-domain-owners --type change --strict` and `rtk git diff --check`.
- [ ] 5.3 Record owner/deletion/parity receipts; do not simplify ingestion or alter event contract in this change.
