## Why

The full-system Product Design audit found several P0 failures that turn normal user input or core teacher routes into runtime errors, empty live classrooms, 500 pages, or visible `Not found` blocks. These must be fixed before lower-severity workflow remediation because they block safe use of registration, lesson launch, projection, and prep-pack review.

## What Changes

- Convert registration validation failures into field-level errors instead of React runtime errors.
- Prevent empty lesson plans from being saved as launchable sessions, and block starting class from any zero-item plan.
- Remove teacher projection `Not found` exposure from audited course runtime surfaces.
- Restore teacher prep-pack and class-scoped prep-pack routes so missing `CourseEnhancementPack` storage or data becomes a product recovery state, not a 500.
- Add regression checks tied to the exact audit chapters and screenshots, then mark the relevant audit findings as remediated only after verification.

## Capabilities

### New Capabilities
- `audit-remediation-p0-stability`: P0 stabilization contract for audit-linked registration, classroom launch, teacher projection, and prep-pack route recovery.

### Modified Capabilities
- None. Existing auth, lesson, runtime, and prep-pack specs remain authoritative; this capability adds the audit remediation contract and evidence ledger.

## Impact

- Affects `/register`, teacher lesson-plan create/launch flows, interactive course teacher projection routes, `/teacher/prep-packs`, and class-scoped prep-pack deep links.
- References audit evidence in `report.md`, `chapters/09-function-state-flows.md`, `chapters/10-function-state-flows-batch2.md`, `chapters/06-course-teacher-waiting-runtime-demo-all.md`, `chapters/02-authenticated-role-flows.md`, `chapters/38-function-state-flows-batch30.md`, and `chapters/57-function-state-flows-batch49.md`.
- Requires targeted browser or Playwright verification and audit-report remediation status updates.
