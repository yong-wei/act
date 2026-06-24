## 1. Operations Console Migration

- [x] 1.1 Migrate teacher home and representative teacher subpages to operations-console shell behavior.
- [x] 1.2 Migrate admin home and representative admin governance/config/status pages to operations-console shell behavior.
- [x] 1.3 Preserve role operations navigation, object context, account/cockpit semantics, and shared floating dock behavior.

## 2. Report Ledger Migration

- [x] 2.1 Identify report-ledger routes or embedded report components in the route ledger.
- [x] 2.2 Migrate grading, teacher report, governance snapshot, prep-pack review, and assistant effect report representative surfaces where applicable.
- [x] 2.3 Preserve source labels, privacy labels, status filtering, review actions, and export readiness.

## 3. Future Capability Alignment

- [x] 3.1 Prepare overlay preview/review/activate/archive/rollback UI slots without mutating base manifests.
- [x] 3.2 Prepare deterministic seed/reset/effect metrics slots for assistant close-loop demo reports.
- [x] 3.3 Render unavailable analytics, model, or governance data as honest empty/disabled/pending states.

## 4. Verification

- [x] 4.1 Run teacher/admin route and shell tests.
- [x] 4.2 Run report/export visual governance checks.
- [x] 4.3 Run `rtk openspec validate migrate-operations-report-ledger-surfaces --strict`.
