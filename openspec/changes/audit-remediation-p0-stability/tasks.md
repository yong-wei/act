## 1. Registration And Validation

- [ ] 1.1 Reproduce the short-password registration path from `chapters/09-function-state-flows.md` and `chapters/40-function-state-flows-batch32.md`.
- [ ] 1.2 Normalize registration validation errors into field strings and prevent rendering raw error objects.
- [ ] 1.3 Add regression coverage for short password, invalid form, and successful recovery without runtime overlay.

## 2. Empty Lesson Launch

- [ ] 2.1 Block saving or launching zero-item lesson plans at the UI boundary.
- [ ] 2.2 Add service/server protection so direct launch cannot create an empty live session.
- [ ] 2.3 Add an existing-invalid-plan repair state for zero-item plans found in lists or details.

## 3. Projection And Prep-Pack Routes

- [ ] 3.1 Fix teacher projection template paths that exposed `Not found` in `chapters/06-course-teacher-waiting-runtime-demo-all.md`.
- [ ] 3.2 Restore `/teacher/prep-packs` and class-scoped prep-pack recovery states for the P2021/500 evidence in `chapters/02-authenticated-role-flows.md`, `chapters/38-function-state-flows-batch30.md`, and `chapters/57-function-state-flows-batch49.md`.
- [ ] 3.3 Add targeted browser or Playwright coverage for the audited projection and prep-pack routes.

## 4. Audit Closure

- [ ] 4.1 Run `rtk openspec validate audit-remediation-p0-stability --strict`.
- [ ] 4.2 Add new evidence artifacts under the audit directory or a linked remediation evidence directory.
- [ ] 4.3 Mark the exact P0 findings in the audit report/chapters as remediated with evidence links, without marking unrelated P1/P2 findings fixed.
