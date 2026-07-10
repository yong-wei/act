---
change_id: close-teacher-review-student-feedback-loop
claim_branch: close-teacher-review-student-feedback-loop
series: assignment-grading-workflow
coupling_group: assignment-grading-workflow
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - productionize-math-document-grading-pipeline
parent_issue: 900
blocked_by:
  - productionize-math-document-grading-pipeline
blocking: []
openspec_path: openspec/changes/close-teacher-review-student-feedback-loop
risk: high
area: assignment-grading
---

## Goal

Close the governed assignment grading loop for text and document answers with deterministic teacher queues, contextual review, criterion-derived scoring, atomic approval/outbox, reviewed derivatives, authorized student feedback, question resubmission, and evidence/remediation continuity.

## Scope

- Assignment row entry actions, deterministic `按学生`/`按题` queues, and text/document three-pane teacher review workspace.
- Teacher editing, AI/teacher diffs, criterion-derived totals, completeness gate, atomic approval/outbox, return, next-item actions, and audit.
- DOCX comments, PDF annotations, reviewed-PDF/Markdown fallback, and immutable derivatives.
- Student assignment feedback, reviewed assets, resubmission, remediation, and governed writeback.

## Out of Scope

- Automatic approval or publication of AI scores.
- Mutation of original submissions or published rubrics.
- Cross-student ranking.
- Bypassing existing learner-evidence governance.

## Acceptance Checklist

- [ ] AC-1: Assignment rows lead to deterministic by-student/by-question queues where teachers can review text and document evidence with rubric, annotations, derived totals, complete empty/error states, and efficient next-item actions. Owner: independent reviewer.
  Evidence: queue/workbench end-to-end, navigation-boundary, phone-handoff, responsive, keyboard, and accessibility evidence.
- [ ] AC-2: Teacher edits preserve machine values/diffs, totals derive only from criteria, final assignment totals require grading completeness, and only atomic approval plus durable outbox creates authoritative work. Owner: independent reviewer.
  Evidence: review versioning, stale-edit, diff, total-override rejection, never-submitted/returned/processing/unapproved/audited-exemption completeness cases, approval/outbox fault-injection, and idempotency tests.
- [ ] AC-3: Reviewed derivatives preserve originals and provide native or honest fallback annotations at supported precision. Owner: independent reviewer.
  Evidence: DOCX/PDF structure, checksum, precision, failure, retry, and fallback tests.
- [ ] AC-4: Students see only their authorized approved assignment feedback, no unreleased solution material, and can follow question-scoped return/resubmission and remediation actions across class-history changes. Owner: independent reviewer.
  Evidence: current/frozen authorization, solution-release, student end-to-end feedback/return/resubmit, and legacy-link flows.
- [ ] AC-5: Approved grading releases derivatives/feedback and writes governed evidence through distinct outbox-driven, lifecycle-governed, observable, idempotent states. Owner: independent reviewer.
  Evidence: release/writeback fault-injection, lifecycle, duplicate prevention, mutation-security, OpenSpec, Prisma, and typecheck gates.

## Tasks

- [ ] Task 1: Implement teacher working review, approval snapshot, derivative, release, return, diff, and audit persistence.
  Covers: AC-2, AC-3, AC-5
  Acceptance: Machine and teacher values remain distinct, scores derive from criteria, approvals atomically create immutable snapshots/outbox commands, and consumer stages are separately observable and lifecycle-governed.
  Evidence: migration diff and review, conflict, total/completeness, approval transaction, outbox crash/duplicate, derivative-state, and duplicate-prevention tests.
  Reviewer Check: Confirm no unapproved, stale, partial-total, or non-transactional review can become authoritative or student-visible.
- [ ] Task 2: Implement assignment submission queues and three-pane review workflow.
  Covers: AC-1, AC-2
  Acceptance: Assignment rows lead into filters and deterministic queue modes; teachers can review text/documents, edit, save, return, approve, and advance while retaining context and complete states.
  Evidence: Playwright flows, screenshots at 320/375 status handoff and 768/1024/1440 editing widths, keyboard/focus/accessibility checks, and autosave/conflict tests.
  Reviewer Check: Confirm source evidence, rubric, derived totals, actions, boundary navigation, and recovery states remain reachable without unrelated report UI or long-page action loss.
- [ ] Task 3: Implement immutable DOCX/PDF/reviewed-PDF derivative generation.
  Covers: AC-3
  Acceptance: Original checksums never change and annotations use only declared anchor precision, with explicit failure/retry/fallback.
  Evidence: native comment/annotation structure tests and sample document review evidence.
  Reviewer Check: Inspect outputs to confirm comments are real document annotations where supported and fallback placement is honest.
- [ ] Task 4: Implement approved student feedback, question return/resubmission, remediation, and governed evidence writeback.
  Covers: AC-4, AC-5
  Acceptance: Only independently authorized owning students can access approved results; reference answers obey solution policy; teacher return creates audited resubmission grants; writeback is outbox-driven and idempotent.
  Evidence: current/frozen authorization, CSRF/schema, solution-release, legacy-link, end-to-end feedback, return, regrade, remediation, and writeback tests.
  Reviewer Check: Confirm unapproved drafts, unreleased solutions, incomplete release authorization, and other students' artifacts remain inaccessible while prior attempts stay immutable.
- [ ] Task 5: Run and record all required project, visual, accessibility, and governance validation.
  Covers: AC-1, AC-4, AC-5
  Acceptance: OpenSpec, Prisma, TypeScript, targeted security/lifecycle tests, and declared viewport/accessibility evidence pass.
  Evidence: command outputs, fault-injection/lifecycle results, and captured evidence in the implementation handoff or PR.
  Reviewer Check: Independently verify every reported gate before approving the final series change.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
