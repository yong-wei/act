## 1. Assignment Domain And Migration

- [ ] 1.1 Add Prisma models, enums, indexes, restrictive referential actions, archival/anonymization fields, and migration for assignment identity, revisions, audiences, question snapshots, rubric snapshots, schedules, and policies.
- [ ] 1.2 Add current-delivery versus frozen-history authorization, explicit historical teacher review grants, optimistic concurrency, and protected teacher/student projection helpers.
- [ ] 1.3 Add fixture builders for a rubric-backed subjective assignment without committing identifiable student submission content.

## 2. Authoring And Publication Services

- [ ] 2.1 Implement draft assignment and revision CRUD with version conflict handling.
- [ ] 2.2 Implement manual question authoring and governed question-catalog selection with immutable prompt, answer, rubric, source-lineage, and content-hash snapshots.
- [ ] 2.3 Implement analytic rubric editing and validation with stable criterion ids, evidence descriptions, levels, guidance, and point ranges.
- [ ] 2.4 Implement transactional publication with assignment/question/rubric score reconciliation, audience authorization, schedule validation, and immutable revision freeze.
- [ ] 2.5 Add versioned solution-release policy and shared mutation guards for authentication, Origin/CSRF, runtime schema, payload bounds, authorization, idempotency, and rate limits.

## 3. Teacher Assignment Workspace

- [ ] 3.1 Add central teacher `作业` navigation and `新建作业` quick action with route-ledger coverage.
- [ ] 3.2 Build `/teacher/assignments` lifecycle list with filters, audience, schedule, status, next actions, and loading/empty/filtered-empty/recoverable-error states.
- [ ] 3.3 Build new/edit assignment workspace with question outline, `题面`/`参考答案`/`评分标准` regions, versioned solution-release settings, preview, autosave, conflict recovery, keyboard focus restoration, and publication blockers.
- [ ] 3.4 Build governed question-bank picker with source, type, knowledge, difficulty, review, rubric-readiness, and version filters.

## 4. Verification

- [ ] 4.1 Add unit and integration tests for revision immutability, source snapshots, historical authorization, referential actions, solution release, mutation security, concurrency, and publication idempotency.
- [ ] 4.2 Add tests proving 10/20/25-style score conflicts block publication without silent rescaling.
- [ ] 4.3 Add browser coverage for assignment list/editor/publish flows at 768px, 1024px, and 1440px; verify 320/375px status fallback, empty/error states, keyboard focus restoration, and accessible names.
- [ ] 4.4 Run Prisma validation/generation, targeted tests, `rtk npm run typecheck`, and `rtk openspec validate establish-assignment-authoring-domain --strict`.
