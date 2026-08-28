# Assignment review and feedback authority

`src/lib/assignments/public-api.ts` is the Assignment-facing review entry.
Teacher queue, open, save, approve, return, release, and original-asset routes
authenticate, protect mutations, parse bounded input, and call one use case.

Review orchestration lives in `src/lib/assignments/assignment-review.ts`.
Data Governance keeps derivative/outbox workers and LearningFact writeback
behind `PROCESS_GOVERNED_EVIDENCE`. Legacy `/api/teacher/document-grading/**`
routes remain the retirement handoff to #1607.

Receipts record source revision, output hash/reference, and conclusion only.
