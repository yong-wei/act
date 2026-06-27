# Teacher Report Delivery Ledger Evidence

Issue: #678

Change: `audit-remediation-teacher-report-delivery-ledger`

This evidence records route/source coverage for teacher report delivery ledger remediation. It is route-level evidence backed by source contract tests rather than browser screenshots because the five teacher surfaces require authenticated teacher data and class/session fixtures.

## Covered Surfaces

- Teacher home: `/teacher` links analytics actions through `buildTeacherReportDeliveryHref` and marks report-delivery cards.
- Class analytics: `/teacher/classes/:classId/analytics-v2` consumes the `surface` URL parameter and exposes action id, idempotency key, opaque artifact ref, redaction policy, delivery status, desktop actions, mobile fixed actions, send/publish degraded status, grading handoff state, and retry state.
- History: `/teacher/history` adds a per-session report ledger action and missing-context recovery when a session is not archived to a class.
- Classroom review: `/classroom/teacher/:sessionId/review` adds a report delivery section and replaces the internal `/review/extracurricular-showcase` delivery exit.
- Report book: `/teacher/grading-workbench` builds its degraded/missing-context ledger entry through `teacher-report-grading-contracts` when report delivery lacks class context.

## Verification

- `rtk npm run test:unit -- src/lib/__tests__/teacher-report-grading-contracts.test.ts src/lib/__tests__/teacher-report-grading-ui-source.test.ts`

## Redaction Boundary

Ledger entries expose `student-safe-summary-only` and opaque display refs for artifact, delivery scope, idempotency key, and action report segment. They do not expose private raw evidence, internal report JSON, hidden AI context, or raw class/session/student IDs in display refs.
