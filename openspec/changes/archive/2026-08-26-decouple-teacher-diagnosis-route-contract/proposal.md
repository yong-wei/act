## Why

The teacher diagnosis report-history feature currently imports `DiagnosisReportApiItem` and `DiagnosisReportsPayload` directly from `src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts`. This is a concrete production `feature -> app` inversion: a UI feature owns neither the route implementation nor its delivery framework, so the first vertical slice must move the contract to the teacher diagnosis domain and remove the old route export while preserving the existing API behavior.

## What Changes

- Establish a teacher-diagnosis public API and application use case for the report-history GET contract, with infrastructure-neutral ports and an explicit persistence adapter.
- Move the serializable DTO and response projection out of `route.ts`; the route remains a thin App Router delivery adapter.
- Migrate the two production callers in `src/features/teacher/teacher-diagnosis-report-history.tsx` and `teacher-diagnosis-report-history-projection.ts` to the domain public API; test-only route imports remain separately classified.
- Preserve authentication, teacher authorization, class/member scope checks, validation, status codes, error bodies, date serialization, privacy omission of `inputSummary`, and existing generation behavior.
- Add characterization, public-contract, application, route-integration, feature, and architecture fitness coverage.
- Delete the old route-owned DTO exports and any forwarding facade or re-export; this is a complete vertical migration of this contract, not an alias layer.
- Update the charter deprecation ledger and dependency allowlist with the removed production edges; do not migrate unrelated teacher diagnosis routes, claim work, deploy, or activate production.

## Capabilities

### New Capabilities

- `teacher-diagnosis-route-contract`: Defines the canonical teacher diagnosis report-history DTO/application contract and its complete route-to-domain migration.

### Modified Capabilities

None. The existing `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, `role-based-learning-diagnosis`, `teacher-diagnosis-generation-governance`, and `teacher-diagnosis-report-delivery` capabilities remain authoritative for behavior, authorization, evidence, and delivery semantics.

## Impact

- Changes the teacher diagnosis feature, the report-history route adapter, a new public API/application/ports/adapter surface, and their tests.
- Removes the two production feature-to-App Router imports that currently target the route-owned DTO; test imports of route handlers remain test-boundary observations.
- Consumes the charter and dependency-contract identities and records the deletion in their ledgers.
- Does not change Prisma schema, diagnosis evidence, generation jobs, report persistence, authentication policy, public URL, production selectors, deployment, or unrelated routes.
