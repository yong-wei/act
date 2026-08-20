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
  - Evidence: `artifacts/commercial-ui/issue-1422-prompt-assessment-history/browser-evidence.json`, captured at remote-resolvable no-conflict test-merge checkpoint `20aedce7d5fc304bb81ef3c9424b98546026f669` on `2026-08-20T16:50:30.846Z`. Its parents are PR head `85840a26f54fd24d04d0e429ae632184b4ca5b31` and `integration` `8db2ee40776fc61182a8edc9a333d631741ce1ba`; the manifest records Git-blob source hashes, six desktop/320 screenshots, focus, reduced-motion, and no-overflow assertions for that intended merge snapshot.
- [x] 3.4 Record validation results, evidence checkpoint, and the post-merge OpenSpec archive responsibility in the change artifacts and Issue #1422.
  - Validation: 73 focused Vitest assertions; the authenticated Playwright capture; PostgreSQL migration/persistence verification; `npm run typecheck` with an 8 GB Node heap; strict change/spec validation; and `git diff --check` passed for the implementation checkpoint. Issue #1422 is `status:claimed` and remains open pending remote delivery.
  - Delivery responsibility: after the implementation PR is merged to `integration`, run `rtk openspec archive persist-governed-prompt-assessment-history`, validate the archived specifications strictly, then update and close Issue #1422 with the merge and verification evidence. Remote delivery and Issue mutation require explicit authorization.
- [x] 3.5 Resolve final Commercial UI governance findings caused by this change: register the prompt-assessment route, integrate its page with the platform shell, and publish its fixed-revision browser evidence to the global Commercial UI manifest.
  - Evidence: `artifacts/commercial-ui/issue-1422-prompt-assessment-history/browser-evidence.json` and the `artifacts/commercial-ui/evidence.json` route entry bind the remotely resolvable test-merge checkpoint `20aedce7d5fc304bb81ef3c9424b98546026f669`; the evidence refresh modifies only screenshots and manifests after the bound source checkpoint.
- [x] 3.6 Persist the complete quality-result snapshot and return it for history reads, including a regression whose stored analysis differs from the current evaluator output.
- [x] 3.7 Require browser evidence capture revisions to be the current remote branch tip before Playwright runs; recapture after the remediation code checkpoint is pushed and record the remotely resolvable revision in the manifest and PR body.
- [x] 3.8 Reject authenticated `TEACHER` and `ADMIN` sessions at all three evaluation history routes before any evaluation or database access; add route regressions for both roles.
- [x] 3.9 Scope prompt-assessment page history metrics, consistency targets, and local version allocation to `activeSessionId`; add a session-mixed regression.
- [x] 3.10 Compute Commercial UI source hashes from the declared Git revision and tolerate only equivalent CRLF checkout normalization; add a fail-closed source-drift regression.
- [x] 3.11 After the remediation was committed and pushed, recapture the authenticated browser evidence so `browser-evidence.json` binds the final no-conflict test-merge snapshot and Git-blob source hashes; the capture passed against the remote-resolvable checkpoint and local PostgreSQL-backed browser environment.
