# C16 extraction inventory

C15 closed Assignment consumer ownership. C16 moves concrete orchestration out of Data Governance into Assignment. Do not treat a forwarding facade as that move.

## Move into Assignment owner

| Current path | Callers | Behavior to preserve |
| --- | --- | --- |
| `src/lib/data-governance/assignment-grading-orchestration.ts` | Assignment `public-api` (`teacherStartAssignmentAiGrading`, `teacherCreateManualQuestionGrading`) | Batch/manual review creation, idempotency, AI-draft advisory |
| Orchestration helpers currently imported by `public-api.ts`: `retryQuestionGradingBatchItem`, `retryDocumentConversion`, `enqueueMathDocumentGradingJob` | `teacherRetryAssignmentGradingBatchItem` | Retry/CAS/queue unavailable |

## Stay in Data Governance

| Path | Reason |
| --- | --- |
| `math-document-grading-lifecycle/queue/evaluator/contracts/api` | Governed evidence policy, derivative/outbox consumers |
| `teacher-assignment-review-derivative-storage` | Approved-snapshot object read used by Assignment public API |
| Learning Record current projection / writeback ports | Not Assignment |

## Callers to retarget after the move

- `src/app/api/teacher/document-grading/**` (approve, writeback-preview, pipeline) — still Prisma/`createSubmissionObjectStore`
- `src/features/teacher/document-rubric-grading-workbench.ts` — rubric-contract + document grading
- `src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx` — object store
- C17 UI baseline: teacher/student assignment workspaces already call HTTP + public DTOs; do not restyle here

## Deletion gate

Delete `assignment-grading-orchestration.ts` only after Assignment-owned use cases have the callers above, zero required DG orchestration imports, and the same revision/snapshot/idempotency evidence.
