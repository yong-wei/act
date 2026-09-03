# C16 ownership map

| Concern | Owner | Path |
| --- | --- | --- |
| AI/manual grading command coordination, frozen selection, operation CAS/idempotency | Assignment | `src/lib/assignments/assignment-grading-orchestration.ts` |
| Route/UI entry | Assignment public API | `teacherStartAssignmentAiGrading`, `teacherCreateManualQuestionGrading` |
| Worker operation refresh | Assignment public API | `refreshAssignmentAiGradingOperation` |
| Question-scoped batch, conversion retry, queue, Mathpix, derivative storage | Data Governance | `math-document-grading-*`, `teacher-assignment-review-derivative-storage` |
| LearningFact writeback | Learning Record / DG evidence policy | unchanged; Assignment does not write facts |

Approved-snapshot handoff: Assignment passes assignment/revision/question/submission/attempt identities into DG batch/persistence/queue helpers. DG revalidates actor scope and evidence eligibility. No raw answers or LearningFact writes from Assignment.

Deleted: `src/lib/data-governance/assignment-grading-orchestration.ts` and its barrel export. No forwarding facade.
