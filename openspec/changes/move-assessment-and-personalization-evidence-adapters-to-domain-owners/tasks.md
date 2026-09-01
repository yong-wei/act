## 1. Freeze owner and adapter inventory

- [x] 1.1 Import the archived C1/C4 canonical-owner receipts and the C5 current write-boundary ledger.
- [x] 1.2 Enumerate Assessment and Personalization adapters under `src/lib/data-governance`, their public routes, workers, scripts, tests and dynamic imports.
- [x] 1.3 For every adapter record old entry, new domain owner/API, evidence fields, scope, dedupe/anchor behavior, parity receipt and deletion condition.

## 2. Move Assessment adapters

- [x] 2.1 Route attempt, scoring, review/provisional and assessment-to-evidence mapping through the existing Assessment public/application API.
- [x] 2.2 Preserve immutable item snapshots, durable answer identity, same-transaction LearningFact write semantics and existing external response compatibility.
- [x] 2.3 Add negative coverage for forged scope, provisional/under-reviewed evidence, duplicate/retry, cross-revision and raw answer/prompt leakage.

## 3. Move Personalization adapters

- [x] 3.1 Route learner-state, path, recommendation and intervention evidence composition through the existing Personalization reducer, path, plugin and policy owners.
- [x] 3.2 Restrict inputs to Learning Record/Assessment read ports and registered plugin context; remove direct raw Prisma or route-payload reconstruction.
- [x] 3.3 Preserve explicit missing/stale/partial/preview/low-confidence states and prove no adapter writes a duplicate fact, mastery, path or intervention record.

## 4. Remove obsolete business paths

- [x] 4.1 Migrate every route, worker, script, report and test caller and run static/dynamic zero-import canaries.
- [x] 4.2 Delete or isolate only data-governance adapters with zero production callers, output parity, privacy proof and rollback evidence.
- [x] 4.3 Keep historical read/backfill adapters only under explicit authorization and mark them as non-online business authority.

## 5. Verify handoff to C8

- [x] 5.1 Run Assessment, Personalization, Learning Record, PostgreSQL/outbox and privacy tests with concurrency and restart cases.
- [x] 5.2 Run `rtk npm run typecheck`, `rtk openspec validate move-assessment-and-personalization-evidence-adapters-to-domain-owners --type change --strict` and `rtk git diff --check`.
- [x] 5.3 Record the migrated owner map and deletion set; do not simplify canonical ingestion in this change.
