## Context

The current GET/POST handler is `src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts`. It exports `DiagnosisReportApiItem` and `DiagnosisReportsPayload`, reads reports through `readDiagnosisReports`, removes `inputSummary`, serializes `evidenceCutoff` and `generatedAt`, and maps scope/validation errors to the existing status and Chinese error bodies. The production feature callers are `src/features/teacher/teacher-diagnosis-report-history.tsx` and `src/features/teacher/teacher-diagnosis-report-history-projection.ts`; their tests import the same route type. The repository already has route characterization tests at `src/app/api/teacher/classes/[classId]/diagnosis-reports/__tests__/route.test.ts` and feature projection/view tests.

This slice is intentionally limited to the report-history GET DTO and its complete caller path. The POST generation behavior and the separate preflight, job, detail, PDF, and disposition routes remain in their current contracts until separately migrated.

## Goals / Non-Goals

**Goals:**

- Make the teacher diagnosis domain public API the canonical owner of the report-history DTO and response contract.
- Put report-history orchestration behind an application use case with a pure port and an adapter around existing persistence.
- Keep Next.js/`NextResponse` in the route adapter and Prisma/persistence details in the adapter, not in the public contract or domain core.
- Preserve all observable authentication, authorization, validation, error, privacy, ordering, and serialization behavior.
- Remove the route-owned exports and both production `feature -> app` imports with no facade or re-export.
- Prove the migration through characterization, contract, integration, feature, and architecture tests.

**Non-Goals:**

- Rewriting diagnosis persistence, generation, preflight, evidence governance, report delivery, or database schema.
- Migrating every teacher diagnosis endpoint in one change.
- Adding a second DTO version, compatibility alias, route re-export, or public URL.
- Changing response fields, error messages/statuses, authorization decisions, or client polling behavior.
- Claiming repository-wide boundary compliance, deployment, or production activation.

## Decisions

### 1. Make the feature-owned public API the canonical contract

Create a teacher diagnosis public API module (for example `src/features/teacher/diagnosis/public-api.ts`) that exports the serializable `DiagnosisReportApiItem`, `DiagnosisReportsPayload`, query input, and stable error contract needed by the report-history slice. The route imports this contract; it does not define or re-export it. The two production feature callers import the same module directly. Keeping the existing type names avoids client behavior changes while moving ownership.

### 2. Separate application, ports, and infrastructure adapter

Create an application use case (for example `src/features/teacher/diagnosis/application/read-report-history.ts`) that accepts authenticated teacher scope and a `TeacherDiagnosisReportReader` port. The port returns domain-safe report records without Prisma, Next.js, React, `Request`, or `NextResponse`. A feature adapter wraps the existing persistence reader and maps `DiagnosisReportReadModel` to the port record; it may depend on `src/lib/diagnosis-persistence` because it is an infrastructure adapter. The use case performs stable projection: omits `inputSummary` and converts dates to ISO strings.

### 3. Keep route delivery and authentication semantics intact

The route continues to obtain `getServerAuthSession`, reject unauthenticated/non-teacher callers, parse `classId`, `studentId`, and positive `limit`, and return `NextResponse`. Authorization and class/member scope remain enforced by the existing persistence path through the adapter. The route maps the same scope, validation, dynamic-error, and generic failure cases to the same status and error body. The use case does not trust a client-supplied teacher identity.

### 4. Preserve privacy and response identity

The public contract includes only the existing safe report fields. `inputSummary` remains server-internal and is never serialized. `evidenceCutoff` and `generatedAt` remain ISO strings; report ordering, scope fields, risk summaries, governed report body, and optional generation metadata remain unchanged. Contract fixtures assert the omission and serialization rules rather than snapshotting private evidence.

### 5. Migrate directly and delete the old path

After the new contract is wired, remove `DiagnosisReportApiItem` and `DiagnosisReportsPayload` exports and the route-local projection type from `route.ts`. Update production feature imports and tests to the public API. Do not leave a route re-export, `index.ts` alias, type-only forwarding module, or compatibility facade. The dependency allowlist and deprecation ledger record the removed edge IDs and the direct-import verification.

### 6. Use existing formal capabilities as behavior constraints

`server-action-and-route-safety` governs authentication and GET side-effect freedom; `app-router-rendering-boundary-safety` governs route delivery boundaries; `role-based-learning-diagnosis`, `teacher-diagnosis-generation-governance`, and `teacher-diagnosis-report-delivery` govern evidence, generation, and delivery semantics. This change adds no modified requirement delta for those capabilities.

## Risks / Trade-offs

- [Risk] Moving projection code changes an error or privacy field. → Capture the current route responses first and assert status/body, ISO dates, omission, and scope behavior in contract/integration tests.
- [Risk] The adapter leaks Prisma types into the feature public API. → Keep persistence types inside the adapter and make the port/public contract structurally domain-safe.
- [Risk] A re-export is left behind to keep old imports passing. → Add a negative architecture test and require the old exports/import paths to be absent.
- [Risk] The slice is mistaken for all diagnosis migration. → Keep explicit non-goals and update only the two removed production edge records.
- [Trade-off] The route file still contains POST generation code. → Migrate only the GET report-history contract and leave unrelated handlers behaviorally unchanged.

## Migration Plan

1. Record characterization responses and the complete caller/import map.
2. Add the public API, port, application use case, and persistence adapter.
3. Rewire the GET route and the two production feature callers directly to the new contract.
4. Delete route-owned DTO exports and any forwarding module; update tests and ledgers.
5. Run contract, route integration, feature, architecture, typecheck, and OpenSpec validation. Rollback is a local code revert; no database or production state is changed.

## Open Questions

None. The exact file names may follow the existing teacher feature naming convention, but the ownership and no-facade invariants are fixed by this design.
