## Context

The earlier finalization remediation centralized module 5 on `finalizeInteractiveLessonSession`, but the rest of the standard course set still calls `trackSessionFinalize(buildSessionFinalizeTelemetry(...))` from individual course files. Keeping that logic and merely wrapping it would preserve the duplication that caused inconsistent closure behavior.

## Goals / Non-Goals

**Goals:**

- Make `finalizeInteractiveLessonSession` or its successor the only supported finalization adapter for standard interactive courses.
- Remove direct course calls to `buildSessionFinalizeTelemetry`.
- Remove or replace the legacy builder if it has no remaining non-test consumer.
- Expand finalization gate coverage from module 5 to all standard courses.

**Non-Goals:**

- Do not change lesson content or page order.
- Do not fabricate missing student answers or scores during finalization.
- Do not migrate cruise-comfort here; that course is rebuilt in `rebuild-cruise-comfort-standard-course`.

## Design

1. Define one finalization adapter input contract that course files can satisfy without assembling telemetry themselves.
2. Move finalization payload assembly into the standard adapter, alongside session completion, report refresh, snapshots, cache refresh, and quality-status updates.
3. Replace each standard course finalizer with the shared adapter call.
4. Delete the legacy handwritten builder or leave it only if there is a documented non-course consumer; tests must not keep it alive as a compatibility target.
5. Add a static guard over the standard course inventory that fails on `buildSessionFinalizeTelemetry`, `trackSessionFinalize(`, or duplicated finish/report sequencing outside the adapter boundary.

## Risks

- Finalization affects live classroom closure. The implementation should preserve current teacher-visible outcomes while making the closure path uniform and observable.

## Verification

- Run finalization unit tests.
- Run `npm run test:course-data-quality-gates`.
- Run focused standard course wiring tests for affected units.
- Run `npm run lint`.
