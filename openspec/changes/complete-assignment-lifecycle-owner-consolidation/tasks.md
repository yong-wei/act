## 1. Owner and caller baseline

- [ ] 1.1 Inventory Assignment lifecycle routes, features, server actions,
  workers, scripts, tests, Data Governance calls, Assessment calls, Learning
  Record calls, and dynamic imports.
- [ ] 1.2 Freeze revision/question/submission/attempt/review/snapshot/outbox
  lineage, role DTO, authorization, idempotency, CAS, approval, release, and
  AI-draft behavior.
- [ ] 1.3 Confirm Assessment attempt ownership and Learning Record current
  projection/writeback boundaries for every cross-domain caller.

## 2. Migrate callers to existing owners

- [ ] 2.1 Route all assignment authoring, publication, delivery, submission,
  review, grading, release, and resubmission calls through
  `src/lib/assignments` public API.
- [ ] 2.2 Replace direct Assessment table/internal calls with the existing
  Assessment public use cases and preserve attempt snapshots.
- [ ] 2.3 Replace direct Learning Record reads/writes with existing role-safe
  projection and governed writeback ports.
- [ ] 2.4 Preserve teacher approval, AI advisory drafts, idempotency, CAS,
  frozen ownership, outbox, privacy, and route error mapping.

## 3. Close the ownership boundary

- [ ] 3.1 Re-run production, worker, script, test, dynamic-import, and
  cross-domain inventories and record replacement/deletion conditions.
- [ ] 3.2 Remove direct Assignment persistence and internal orchestration
  imports outside the owner; do not add a forwarding facade.
- [ ] 3.3 Prepare the concrete Data Governance extraction inventory for C16
  and UI behavior baseline for C17-C19.

## 4. Verification and handoff

- [ ] 4.1 Run focused Assignment lifecycle, Assessment-attempt, Learning Record
  projection, authorization, privacy, idempotency, CAS, approval, release,
  and outbox tests.
- [ ] 4.2 Run affected route/domain suites, typecheck, lint, build, strict
  validation, and `git diff --check`.
- [ ] 4.3 Bind the owner map, behavior comparison, and zero-caller proof to one
  source revision and hand off to C16.
