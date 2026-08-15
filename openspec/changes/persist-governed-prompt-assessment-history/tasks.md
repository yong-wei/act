## 1. Persistence and contracts

- [x] 1.1 Add failing route and service regressions for unauthenticated requests, foreign user IDs, owned history, persisted consistency, restart-safe reads, and concurrent version allocation.
- [x] 1.2 Extend `PromptAssessment` with bounded task-context and consistency-result storage plus a unique student/session/version identity.
- [x] 1.3 Add an additive PostgreSQL migration with a duplicate preflight and safe unique-index creation.

## 2. Authenticated evaluation implementation

- [x] 2.1 Replace process-local prompt history with a database-backed evaluation persistence service that allocates versions transactionally with bounded conflict retry.
- [x] 2.2 Require authenticated session identity in prompt-quality and consistency routes, attach consistency only to an owned persisted attempt, and preserve response compatibility.
- [x] 2.3 Require authenticated ownership in prompt-history reads and map persisted records to the student history projection.
- [x] 2.4 Confirm the prompt-assessment page keeps its local demonstration path and does not depend on anonymous production routes.

## 3. Verification and delivery evidence

- [x] 3.1 Run focused unit and route regressions, the affected page contract test, Prisma generation, typecheck, strict change/spec validation, and `git diff --check`.
- [x] 3.2 Run database migration verification against the local PostgreSQL service, including owned persistence, restart-safe read, and no `LearningFact` side effect assertions.
- [ ] 3.3 Capture desktop and 320px browser evidence for authenticated prompt evaluation/history while checking keyboard focus and horizontal overflow.
- [ ] 3.4 Record validation results, evidence checkpoint, and the post-merge OpenSpec archive responsibility in the change artifacts and Issue #1422.
