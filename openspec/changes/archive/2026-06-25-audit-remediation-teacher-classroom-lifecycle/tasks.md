## 1. Classroom Identity

- [x] 1.1 Define shared class-bound and temporary classroom identity payloads.
- [x] 1.2 Update launch surfaces to require or display class/temporary context before starting.
- [x] 1.3 Prevent duplicate active sessions or require explicit reuse/new-session confirmation.
- [x] 1.4 Remove raw session id from primary student-facing classroom labels.

## 2. Runtime Lifecycle

- [x] 2.1 Add teacher-visible online roster, current step, freshness, release delivery, and not-submitted states.
- [x] 2.2 Bind release, page-change, copy-code, start-class, online-panel, submit, and end-class states to complete classroom event evidence fields.
- [x] 2.3 Add stable accessible names and `status/live` announcements for classroom code copy, start, page change, release, online panel, and end controls.
- [x] 2.4 Add student-visible released, submitted, and ended states.
- [x] 2.5 Route ended classrooms to ended/review surfaces instead of live projection.
- [x] 2.6 Update audit evidence with lifecycle finding ids only, excluding report-delivery scope.

## 3. Verification

- [x] 3.1 Add tests for class-bound launch, temporary launch, duplicate-session handling, event evidence completeness, control accessible names/status, and ended-state routing.
- [x] 3.2 Capture browser evidence for teacher and student roles.
- [x] 3.3 Run `rtk openspec validate audit-remediation-teacher-classroom-lifecycle --strict`.
