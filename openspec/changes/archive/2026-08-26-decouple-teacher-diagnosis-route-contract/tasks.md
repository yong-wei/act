## 1. Investigation and characterization

- [x] 1.1 Verify the exact qualified charter and dependency-contract identities plus the predecessor baseline edge IDs before editing the route or feature.
- [x] 1.2 Characterize `GET /api/teacher/classes/[classId]/diagnosis-reports` with existing route tests and response fixtures: unauthenticated, non-teacher, invalid limit, class/member scope errors, authorized empty/history success, ordering, ISO dates, and `inputSummary` omission.
- [x] 1.3 Inventory all callers of `DiagnosisReportApiItem` and `DiagnosisReportsPayload`; distinguish the two production feature imports from test-only route imports and record the expected deletion edges.

## 2. Implement the domain contract and vertical path

- [x] 2.1 Add the teacher diagnosis public API with serializable DTOs, payload/query contract, and stable error/projection types; keep it free of Prisma, Next, React, and route imports.
- [x] 2.2 Add the domain-safe reader port and application use case for report-history reads, including safe projection, date serialization, and omission of `inputSummary`.
- [x] 2.3 Add the persistence adapter that wraps the existing diagnosis reader and maps `DiagnosisReportReadModel`/scope errors without changing authorization or error semantics.
- [x] 2.4 Rewire the report-history GET route to the application use case while retaining session authentication, role checks, query parsing, `NextResponse`, existing status/body mapping, and unchanged POST generation behavior.
- [x] 2.5 Migrate `teacher-diagnosis-report-history.tsx` and `teacher-diagnosis-report-history-projection.ts` directly to the public API; update their tests to use the same canonical contract.

## 3. Delete old entry and update governance ledgers

- [x] 3.1 Remove `DiagnosisReportApiItem`/`DiagnosisReportsPayload` definitions and exports from `route.ts` after all callers are migrated.
- [x] 3.2 Delete any temporary route re-export, alias, forwarding module, or compatibility import introduced during the migration; add a negative import test proving the old path is gone.
- [x] 3.3 Update the charter deprecation ledger and dependency allowlist with the removed route-owned DTO and both deleted production feature-to-App Router edge IDs; keep unrelated diagnosis debt explicit.

## 4. Targeted and affected-domain verification

- [x] 4.1 Add public API contract tests for serialization, safe-field omission, and stable payload shape.
- [x] 4.2 Add application/port tests and route integration tests for auth, authorization, scope, validation, success ordering, error semantics, dates, and privacy behavior.
- [x] 4.3 Run teacher feature projection/view tests and the architecture fitness test proving zero production feature-to-App Router imports for this slice while test imports remain classified.
- [x] 4.4 Run affected teacher-domain tests, `rtk npm run typecheck`, and the repository's applicable route/module safety checks; record unrelated baseline failures separately.
- [x] 4.5 Run `rtk openspec validate decouple-teacher-diagnosis-route-contract --type change --strict` and `git diff --check`.
- [x] 4.6 Record the completed deletion evidence and remaining follow-up routes; do not claim, deploy, or activate production.
