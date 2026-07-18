## Why

Converted answers and AI rubric drafts do not form a grading product until teachers can review them efficiently and students can receive approved, location-aware feedback in the same assignment journey. The final change closes that governed human-review and feedback loop.

## What Changes

- Add assignment submission queues that support text and document answers, `按学生` and `按题` review, filtering, batch AI initiation, and visible progress or blocked states.
- Add a three-pane grading workbench with student/question navigation, original-versus-Markdown document review, inline anchors, sticky rubric scoring, comments, and previous/next throughput actions.
- Let teachers accept, edit, or remove AI scores, criterion decisions, annotations, and overall comments while preserving AI-versus-teacher diffs.
- Keep unapproved drafts invisible to students and require an atomic approval snapshot plus durable outbox before derivative generation, feedback release, or governed evidence writeback.
- Generate a reviewed derivative without modifying the immutable original: native Word comments for DOCX, PDF annotations for PDF, and a reviewed PDF fallback where reliable native placement is unavailable.
- Return approved question-level feedback in the student assignment detail, including rubric breakdown, anchored comments, overall evaluation, reviewed-document access, and question-scoped resubmission actions.
- Migrate assignment-bound legacy grading and feedback deep links into the assignment journey while retaining a bounded read-only adapter for unbound historical demo runs.

## Capabilities

### New Capabilities
- `assignment-review-and-feedback`: Defines teacher grading queues, review actions, approved derivative generation, student-visible assignment feedback, and resubmission closure.

### Modified Capabilities
- `document-rubric-grading-workbench`: Connects production grading drafts to assignment-scoped teacher review, reviewed derivatives, approval, and student visibility.
- `audit-remediation-student-learning-closure`: Carries approved assignment, question, criterion, feedback, resubmission, and return context through student remediation and evidence destinations.

## Impact

- Affects teacher assignment submission routes, grading workbench UI, annotation editing APIs, document derivative services, student assignment detail, feedback authorization, and evidence writeback.
- Requires immutable audit records for AI draft, teacher edits, approval, returned state, and idempotent learner-evidence materialization.
- Depends on all earlier changes in the `assignment-grading-workflow` series.
