# Assignment lifecycle public API

`src/lib/assignments/public-api.ts` is the teacher/student lifecycle boundary.
Routes authenticate, protect mutations, parse bounded input, and call one use
case. Prisma, assignment-service, and submission-service stay behind that
module.

Teacher review routes under `submissions/` remain an explicit handoff to
`migrate-assignment-review-feedback-authority`. Rubric-guideline generation
stays with the assignment owner but is not part of this lifecycle API because
AI providers are a non-goal of this change.

Receipts record source revision, output hash/reference, and conclusion only.
