## 1. Review And Release Persistence

- [ ] 1.1 Add Prisma models, enums, indexes, restrictive relations, lifecycle-policy versions, and migration for teacher working reviews, immutable approval snapshots, durable outbox, derivatives, releases, return/resubmission grants, and AI/teacher diffs.
- [ ] 1.2 Implement review versioning, optimistic concurrency, current/frozen authorization, criterion-derived totals, grading-completeness gate, audit, and approval idempotency.
- [ ] 1.3 Implement one approval transaction plus independently observable/idempotent derivative, student-release, and governed-writeback consumers with correlation/causation ids, fencing, retry, and limitation reasons.

## 2. Teacher Review Experience

- [ ] 2.1 Add `查看提交`/`进入批阅` assignment row actions and build submission queues with explicit `按学生`/`按题` previous-next semantics, filters, sorting, counts, batch AI progress, loading/empty/error states, failures, and direct next actions.
- [ ] 2.2 Build the text/document three-pane review workbench for 768px+ with queue/question navigation, source/Markdown toggle, anchor overlay, sticky rubric, comments, derived totals, 320/375px status-only handoff, keyboard focus restoration, and recoverable states.
- [ ] 2.3 Implement autosaved teacher edits for criteria, scores, levels, rationale, anchors, annotations, and overall comments while preserving machine values and diffs.
- [ ] 2.4 Implement save, return question, approve, previous/next, and `确认并进入下一份` actions with queue-context continuity.
- [ ] 2.5 Add protected mutation guards for CSRF/Origin, runtime schemas, body/field/batch bounds, resource authorization, idempotency, and rate/quotas.

## 3. Reviewed Documents And Student Feedback

- [ ] 3.1 Implement canonical annotation-to-DOCX native comment generation with range validation and immutable output metadata.
- [ ] 3.2 Implement PDF annotations plus reviewed-PDF/annotated-Markdown fallback for unsupported or imprecise source mapping.
- [ ] 3.3 Integrate partial question feedback, completeness-gated final totals, anchors, comments, reviewed assets, history, solution-release policy, and resubmission actions into the owning student's assignment detail.
- [ ] 3.4 Connect approved assignment/question/criterion context to remediation destinations and durable-outbox governed evidence writeback with independent release authorization.
- [ ] 3.5 Redirect assignment-bound legacy grading/feedback deep links, retain a read-only adapter for unbound historical/demo runs, and update central route inventory.

## 4. Verification

- [ ] 4.1 Add tests for historical teacher/student authorization, mutation security, stale edits, criterion-derived totals, and final-total blocking for never-submitted, returned-awaiting-resubmission, processing, unapproved, and audited-exemption cases, plus approval/outbox fault injection, idempotency, AI/teacher diffs, and draft invisibility.
- [ ] 4.2 Add structural tests proving reviewed derivatives preserve the original checksum and create native/fallback annotations at the declared precision.
- [ ] 4.3 Add end-to-end coverage for text/document manual review, both queue modes and navigation boundaries, single/batch AI review, edit/accept, derivative failure/retry, approval, partial/final feedback, return, resubmit, regrade, and legacy redirect query/anchor/return-context preservation.
- [ ] 4.4 Add visual and accessibility checks for teacher status handoff at 320px/375px, full review at 768px/1024px/1440px, and student feedback at 320px/375px/1024px/1440px.
- [ ] 4.5 Run Prisma validation/generation, targeted tests, `rtk npm run typecheck`, and `rtk openspec validate close-teacher-review-student-feedback-loop --strict`.
