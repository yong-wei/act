# Teacher Classroom Lifecycle Remediation Evidence

Change: `audit-remediation-teacher-classroom-lifecycle`

Finding scope: lifecycle findings 81-96, 129-130, 146, and 287.

Out of scope: report export/send, prep-pack generation, KAQ diagnosis, path planning, and report-delivery remediation.

## Browser Evidence

- `playwright/class-bound-launch-dialog.png`: teacher class page launch dialog shows the class-bound classroom identity before starting.
- `playwright/class-bound-launch-dialog.json`: machine-readable evidence for route, visible identity text, screenshot path, and duplicate-session test linkage.
- `playwright/student-temporary-join-entry.png`: student role on an interactive course entry sees the classroom-code join path.
- `playwright/student-temporary-join-entry.json`: machine-readable evidence for the student-role entry route and visible join path.
- `playwright/teacher-runtime-1440.png`, `playwright/teacher-runtime-1440-collapsed.png`, and `playwright/teacher-runtime-320.png`: authenticated teacher direct runtime route `/classroom/teacher/audit-session-runtime` shows the class-bound classroom identity and protected classroom shell.
- `playwright/teacher-runtime.json`: machine-readable evidence for the direct teacher classroom runtime route, screenshot paths, and visible class identity.
- `playwright/student-runtime-1440.png`, `playwright/student-runtime-1440-collapsed.png`, and `playwright/student-runtime-320.png`: authenticated same-class student direct runtime route `/classroom/student/audit-session-runtime` shows the class-bound classroom identity and waiting state.
- `playwright/student-runtime.json`: machine-readable evidence for the direct student classroom runtime route, screenshot paths, and visible class identity.

## Automated Coverage

- `tests/classroom-lifecycle-evidence.spec.ts`
  - Captures browser evidence for the teacher class-bound launch path, the student temporary join path, and authenticated direct teacher/student classroom runtime routes.
- `artifacts/knowledge-workspace-product-qa-489/browser-evidence.json` and `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/final-product-qa.json`
  - Refresh only existing governance receipt metadata required by `npm run test`; no knowledge workspace or interactive product QA source behavior is changed by this remediation.
- `src/app/__tests__/lesson-plan-session-routes.test.ts`
  - Covers class-bound launch identity, temporary launch identity, clone-based temporary duplicate-session reuse/new-session choice, start-class logging, and teacher PATCH lifecycle evidence logging.
- `src/features/interactive/__tests__/session-state-route-auth.test.ts`
  - Covers teacher-view ownership checks, identity, roster, delivery/not-submitted state, server-derived actor roles, student-view aggregate isolation, and student/teacher lifecycle evidence fields in session state writeback.
- `src/features/interactive/__tests__/build-course-event.test.ts`
  - Covers event evidence completeness for course events.
- `src/features/interactive/__tests__/classroom-join-entry.test.ts`
  - Covers accessible names/status regions, teacher ended review state, student ended state, and launch-context request payloads.

## Verification Commands

- `rtk npm run test:unit -- src/app/__tests__/lesson-plan-session-routes.test.ts src/features/interactive/__tests__/session-state-route-auth.test.ts src/features/interactive/__tests__/build-course-event.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts`
- `rtk npx playwright test tests/classroom-lifecycle-evidence.spec.ts`
- `rtk zsh -lc 'npx tsc --noEmit --pretty false 2>&1 | rtk rg "src/(app/api/session|features/lesson-engine|features/interactive/session-framework|lib/classroom-lifecycle-contract|lib/classroom-analytics/types)"'`

The filtered TypeScript command is expected to produce no output; full-project `tsc --noEmit` still reports unrelated pre-existing errors outside this change path.
