## Context

The current grading workbench renders a demo grading run and exposes a partial approval action, but it has no assignment submission queue, limited editing, no production `按题` workflow, and no reviewed derivative service. Student feedback is reached through a grading-run id instead of the formal assignment journey. The production pipeline change supplies immutable text/document AnswerEvidence and AI drafts but deliberately leaves them non-authoritative.

This change makes teacher review the governing product step, owns teacher return/resubmission activation, and returns approved results through the same per-question assignment context used for submission.

## Goals / Non-Goals

**Goals:**

- Give teachers efficient assignment, student, and question review queues for text and document answers.
- Present source evidence, anchors, rubric decisions, scores, comments, and next-item actions in one workspace.
- Preserve AI output, teacher edits, approval identity, versions, and audit.
- Generate reviewed document derivatives without mutating student originals.
- Publish only teacher-approved question feedback and publish an assignment final total only when grading is complete.
- Support teacher-owned question return, student resubmission, and evidence/remediation continuity.
- Migrate assignment-bound legacy grading links without breaking historical unbound demo records.

**Non-Goals:**

- Automatic publication of AI scores.
- Direct total-score overrides outside rubric criteria.
- Editing immutable source uploads or published assignment rubrics.
- Cross-student ranking or competitive grading.
- Replacing learner-evidence governance with assignment-specific shortcuts.

## Decisions

### 1. Make teacher assignments the grading entrypoint

Published or collecting rows in `/teacher/assignments` expose `查看提交`; rows with eligible pending reviews expose `进入批阅`. They route to `/teacher/assignments/[assignmentId]/submissions`. Individual work opens `/teacher/assignments/[assignmentId]/submissions/[submissionId]/review`.

The queue supports `按学生` and `按题` with explicit sort/filter state:

- in `按学生`, previous/next moves between student submissions in the current sort/filter; question navigation stays inside the selected submission;
- in `按题`, the selected question remains fixed and previous/next moves between student answers in the current sort/filter;
- the first/last boundary disables the unavailable direction;
- approved or blocked items are skipped only when excluded by the active filter;
- after approve/return, the queue is recomputed and focus moves to the next currently eligible item or a completed/empty state.

Loading, no-submission, filtered-empty, blocked, stale/missing context, and recoverable failure states expose a valid return or retry action.

### 2. Use one evidence contract for text and documents

Text-native and converted document AnswerEvidence enter the same manual/AI review queue. Text evidence renders canonical text with block/span anchors; document evidence renders original/authorized pages plus Markdown and its declared bbox/span/block/page precision. No answer type may be submitted successfully yet lack a manual review path.

### 3. Use a three-pane desktop review workspace

From 768px upward:

- left: student queue, question navigation, status, and progress;
- center: text or original/rendered document, Markdown toggle, and annotation anchors;
- right: sticky rubric criteria, AI draft, teacher score/comment editors, derived total, and review actions.

At 320/375px, teachers may inspect queue/status and open feedback metadata, but full rubric editing and document annotation display a clear `请在平板或电脑端继续批阅` handoff. This is preferable to a misleading compressed editor. Keyboard operation at supported editing widths includes pane switching, annotation targeting, error association, save-conflict recovery, and focus restoration after previous/next or approve/return.

### 4. Preserve AI and teacher states separately and derive totals

`TeacherReview` references one `GradingRun` and stores working teacher values separately from immutable machine values. Each criterion and annotation has stable identity, origin, current status, override, and diff. Autosave uses optimistic concurrency.

Teachers adjust scores only through rubric criteria. Final question score is the sum of approved criteria; no direct question or assignment total override is allowed. If policy requires an exceptional adjustment, it must be a bounded, named, auditable adjustment criterion included in the published rubric scale.

Per-question approved feedback may be released while other questions remain under review, but the assignment remains `批阅中` and no final assignment total is published. Final total appears only when every required assignment question has a current approved submitted attempt or an explicit audited exemption with defined score/effect. A required question that was never submitted, was returned and awaits resubmission, or has a new attempt still being processed always blocks the final total.

### 5. Approval uses one transaction and a durable outbox

Approval executes one database transaction that:

1. compare-and-swaps the working review version;
2. writes the immutable approval snapshot;
3. records derived criterion/question state;
4. writes durable outbox messages for derivative generation, student release, and governed evidence processing.

Consumers read only the immutable snapshot. Each uses deterministic idempotency keys, correlation/causation ids, snapshot/evaluator/version fencing, and retryable terminal states. A crash before commit publishes nothing; duplicate delivery is harmless; derivative, release, and evidence may progress independently and remain observable. Existing `EvidenceOutbox` or a compatible generalized outbox must be reused rather than performing LearningFact writes inline with the HTTP route.

### 6. Generate format-appropriate reviewed derivatives

Canonical approved annotation records remain the source of truth.

- DOCX: create a new DOCX with native Word comments where reliable range mapping exists.
- PDF: create a new PDF with annotation objects at supported bbox/page anchors.
- Unsupported or imprecise source: create a reviewed PDF from the authorized render with page/block callouts and an annotated Markdown companion.

Derivative metadata records source checksum, approval snapshot, generator/version, output checksum, precision, lifecycle-policy version, and warnings. The original object is never overwritten. For documents, student release stays `publishing-feedback` until the required derivative succeeds; failure exposes retry or an explicit teacher-approved structured-only fallback with limitation.

### 7. Return feedback through the assignment detail

`/missions/assignments/[assignmentId]` shows the owning student's approved question results, criterion breakdown, anchored comments, overall evaluation, reviewed-document access, history, and valid next actions. Deep links target a question/anchor and preserve return to the assignment summary.

Reference answers and teacher-only rubric guidance remain hidden unless the upstream solution-release policy explicitly permits them. Incomplete student-release authorization blocks feedback and derivative access. Incomplete evidence mapping may block only governed writeback while approved feedback remains visible.

### 8. Own teacher return and resubmission activation here

Returning a question records teacher, review/run, reason, allowed response type, new deadline, authorization snapshot, and a resubmission grant. It activates only that question for a new attempt and preserves every prior attempt and other submitted question. A new attempt creates new AnswerEvidence and grading lifecycle.

### 9. Apply historical authorization and lifecycle policy

Students read their own historical approved feedback through frozen ownership. Teacher queue/review access requires current explicit assignment-review grant or audited transfer; a new class teacher does not automatically inherit prior documents. Class closure makes history read-only. Every source, draft, snapshot, derivative, release, audit, and evidence record follows the lifecycle/hold/tombstone policy established in the pipeline change.

All save, batch, return, approve, retry, fallback, and release mutations require authentication, strict Origin/CSRF checks, runtime schemas, bounded payloads, resource authorization, idempotency where applicable, and rate/quotas.

### 10. Migrate legacy grading routes deliberately

Assignment-bound `/teacher/grading-workbench?gradingRunId=...` resolves to the new review route, and assignment-bound `/assessment/document-feedback` resolves to the owning student's assignment detail. Unbound historical/demo runs remain in a read-only compatibility adapter behind a documented retirement condition. Central route inventory records the new routes and compatibility aliases.

## Risks / Trade-offs

- [Three panes become cramped] → Support full editing at 768px+ and deliberate status-only phone handoff.
- [DOCX comments cannot map exactly] → Use declared precision and reviewed-PDF fallback; never invent ranges.
- [Teacher edits race with reruns] → Bind reviews to one run and require explicit adopt/reject for a new rerun.
- [Approval succeeds but a consumer fails] → Use transaction + durable outbox, independent states, idempotent consumers, and fault-injection tests.
- [Partial feedback looks like a final grade] → Label question feedback as released while assignment remains `批阅中`; withhold final total until completeness gate passes.
- [Batch acceptance causes automation bias] → Keep item-level rubric, evidence, confidence, and outlier visibility; require teacher approval for every release.
- [Historical access leaks across class changes] → Separate frozen student ownership from explicit current/transferred teacher review grants.

## Migration Plan

1. Add teacher review, approval snapshot, outbox, derivative, release, return, resubmission grant, and audit persistence with restrictive relations and lifecycle versions.
2. Add assignment row actions, submission queues, review working-state APIs, and mutation guards behind a feature flag.
3. Build text/document three-pane workbench, queue navigation semantics, empty/error states, keyboard behavior, and phone handoff.
4. Add DOCX/PDF/reviewed-PDF derivative consumers plus failure/retry/fallback states.
5. Integrate approved feedback, completeness-gated final totals, return/resubmission, remediation, and governed outbox writeback.
6. Add legacy route redirects/read-only adapters and central route inventory entries.
7. Enable after manual text/document, AI/batch, authorization, outbox fault-injection, derivative, lifecycle, responsive, and end-to-end tests pass.

Rollback prevents new approvals and hides new review routes while preserving snapshots and already released feedback under lifecycle policy. Released evidence is reversed only through governance, never by deleting audit history.

## Open Questions

No product decision blocks the proposal. Implementation must validate the available DOCX comment library against the supplied mathematical homework sample before selecting the native-comment adapter.
