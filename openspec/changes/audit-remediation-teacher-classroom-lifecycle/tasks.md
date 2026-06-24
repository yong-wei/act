## 1. Classroom Identity

- [ ] 1.1 Define shared class-bound and temporary classroom identity payloads.
- [ ] 1.2 Update launch surfaces to require or display class/temporary context before starting.
- [ ] 1.3 Prevent duplicate active sessions or require explicit reuse/new-session confirmation.
- [ ] 1.4 Remove raw session id from primary student-facing classroom labels.

## 2. Runtime Lifecycle

- [ ] 2.1 Add teacher-visible online roster, current step, freshness, release delivery, and not-submitted states.
- [ ] 2.2 Bind release, page-change, copy-code, start-class, online-panel, submit, and end-class states to complete classroom event evidence fields.
- [ ] 2.3 Add stable accessible names and `status/live` announcements for classroom code copy, start, page change, release, online panel, and end controls.
- [ ] 2.4 Add student-visible released, submitted, and ended states.
- [ ] 2.5 Route ended classrooms to ended/review surfaces instead of live projection.
- [ ] 2.6 Update audit evidence with lifecycle finding ids only, excluding report-delivery scope.

## 3. Verification

- [ ] 3.1 Add tests for class-bound launch, temporary launch, duplicate-session handling, event evidence completeness, control accessible names/status, and ended-state routing.
- [ ] 3.2 Capture browser evidence for teacher and student roles.
- [ ] 3.3 Run `rtk openspec validate audit-remediation-teacher-classroom-lifecycle --strict`.
