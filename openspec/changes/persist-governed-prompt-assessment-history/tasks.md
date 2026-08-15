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
- [x] 3.3 Capture desktop and 320px browser evidence for authenticated prompt evaluation/history while checking keyboard focus and horizontal overflow.
  - Evidence: `artifacts/commercial-ui/issue-1422-prompt-assessment-history/browser-evidence.json`, captured from clean code checkpoint `35d534e8a616caec3abc89f66121d06a5a2aaa3c` at `2026-08-15T11:57:16.419Z`; the manifest binds both screenshots and all relevant source hashes, and records focus and no-overflow assertions.
- [x] 3.4 Record validation results, evidence checkpoint, and the post-merge OpenSpec archive responsibility in the change artifacts and Issue #1422.
  - Validation: 42 focused Vitest assertions; the authenticated Playwright capture; PostgreSQL migration/persistence verification; `rtk proxy npx cross-env NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit --pretty false`; strict change/spec validation; and `git diff --check` passed for the implementation checkpoint. Issue #1422 is `status:claimed` and remains open pending remote delivery.
  - Delivery responsibility: after the implementation PR is merged to `integration`, run `rtk openspec archive persist-governed-prompt-assessment-history`, validate the archived specifications strictly, then update and close Issue #1422 with the merge and verification evidence. Remote delivery and Issue mutation require explicit authorization.
- [x] 3.5 Resolve final Commercial UI governance findings caused by this change: register the prompt-assessment route, integrate its page with the platform shell, and publish its fixed-revision browser evidence to the global Commercial UI manifest.
  - Evidence: `artifacts/commercial-ui/issue-1422-prompt-assessment-history/browser-evidence.json` was recaptured at clean code checkpoint `45682d511a95a27ab6dacd58024b471f37a7b33c`; it binds light/dark desktop-expanded, desktop-collapsed, and 320px drawer screenshots, capture configuration and source hashes, keyboard/reduced-motion/no-overflow assertions, and the `artifacts/commercial-ui/evidence.json` route entry.
