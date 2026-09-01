## 1. Freeze the operational boundary

- [ ] 1.1 Capture the current-revision inventory of online readers, current-pointer writers, backfill/materialization commands, workers, schedulers, reports and tests.
- [ ] 1.2 Record each path's operation mode, owner, authorization, scope, source/capture revision, cutoff, digest, receipt, retention and deletion condition.
- [ ] 1.3 Identify old production imports and runtime registrations that must be removed, while retaining explicit audit and dedicated cutover paths.

## 2. Establish the backfill command and worker lane

- [ ] 2.1 Add explicit dry-run/apply and stable operation identity to historical evidence/materialization/report regeneration commands.
- [ ] 2.2 Freeze input/cutoff and scope, emit deterministic candidate and per-input outcomes, and persist minimal terminal/deletion receipts.
- [ ] 2.3 Enforce separate service permissions for backfill apply, raw artifact access, online reads and current-pointer publication.
- [ ] 2.4 Add restart, retry, duplicate, terminalization-before-delete and unknown-version/digest/authorization failure coverage.

## 3. Remove online dependence on backfill

- [ ] 3.1 Route normal student, teacher, AI and Personalization reads through the existing qualified current projection/read ports.
- [ ] 3.2 Reject online requests that try to invoke backfill, historical materialization or raw aggregation as a projection fallback.
- [ ] 3.3 Add guards proving ordinary backfill cannot advance live current pointers/watermarks, overwrite source anchors or emit unbound online triggers.
- [ ] 3.4 Preserve the existing explicit generation/fence/cutover contract for dedicated migrations and test that it is not inherited by ordinary tools.

## 4. Delete old production entries and verify

- [ ] 4.1 Migrate all route, worker, scheduler, report and script callers and run static/dynamic zero-import canaries.
- [ ] 4.2 Delete or isolate only old production backfill/fallback registrations with zero callers, parity, privacy, retention and rollback evidence.
- [ ] 4.3 Run affected online-read, backfill, authorization, receipt, PostgreSQL and queue tests, then `rtk npm run typecheck`.
- [ ] 4.4 Run `rtk openspec validate separate-online-learning-record-from-backfill-tools --type change --strict`, `rtk openspec validate --changes --strict` and `rtk git diff --check`.
- [ ] 4.5 Record the stable online/backfill boundary for B; do not invoke the code-simplification skill or simplify projections in this change.
