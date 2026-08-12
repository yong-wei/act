## 1. Persistence contract and regression coverage

- [x] 1.1 Add failing route and source-contract tests for learner-scoped save, read, edit, discard, idempotency, and the absence of learning-state writeback.
- [x] 1.2 Add the `PortfolioReflectionDraft` schema, lifecycle enum, user relation, and additive PostgreSQL migration.
- [x] 1.3 Implement bounded draft request parsing and authenticated collection/item API routes.

## 2. Portfolio draft workflow

- [x] 2.1 Load active persisted reflection drafts into the portfolio reflection tab.
- [x] 2.2 Replace the local-only candidate marker with explicit save, reopen, edit, and discard actions against the draft API.
- [x] 2.3 Preserve candidate-only status and expose no automatic formal portfolio, score, `LearningFact`, or learner-portrait writeback.

## 3. Verification and delivery evidence

- [x] 3.1 Run focused route and page-contract tests, then the affected student-learning suite.
- [x] 3.2 Apply the migration to the local PostgreSQL environment and verify save/read/discard behavior with authenticated route coverage.
- [x] 3.3 Run `npm run typecheck`, strict change and repository OpenSpec validation, and `git diff --check`.
- [x] 3.4 Capture browser evidence for candidate save, refresh/reopen, edit, discard, mobile layout, keyboard focus, and no horizontal overflow.

## Verification record

- `npx vitest run src/app/__tests__/portfolio-reflection-drafts-route.test.ts src/lib/__tests__/portfolio-reflection-draft-contracts.test.ts src/lib/__tests__/ai-task-boundary-ui-source.test.ts` (13 tests passed)
- `tsx scripts/tests/test-portfolio-reflection-draft-postgres.ts` (migration, idempotent save, learner scoping, discard, and zero `LearningFact` writeback passed)
- `npx playwright test tests/portfolio-reflection-drafts-1321.spec.ts` (1440px and 320px save, reopen, edit, discard, focus, and overflow checks passed)
- `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --pretty false --incremental --tsBuildInfoFile C:\\Users\\liu20\\AppData\\Local\\Temp\\portfolio-draft-1321.tsbuildinfo` (passed)
- `npx openspec validate persist-portfolio-reflection-drafts --strict` and `npx openspec validate --specs --strict` (passed)
- `git diff --check` (passed; pre-existing CRLF warnings only)
- `node artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/capture-portfolio-reflection-drafts-evidence.mjs` (passed; capture revision `3d254b589b6da28c717625faa3789bdf10cc7a37`, 1440px and 320px screenshots with SHA-256 manifest)

## Review remediation

- [x] Restrict item updates to content and reject provenance mutation attempts.
- [x] Keep repeated idempotent saves unchanged and reject replays for discarded drafts.
- [x] Resolve concurrent idempotent saves with bounded serializable retry and identity re-read; preserve `409` for discarded replay.
- [x] Capture stable 1440px and 320px browser evidence with revision, source hashes, screenshot hashes, and fail-closed drift checks.
