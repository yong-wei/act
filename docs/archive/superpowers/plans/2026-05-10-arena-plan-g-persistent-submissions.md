# Arena Plan G: Persistent Submissions And Real Leaderboard Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` review discipline after implementation. This phase uses one implementation pass and one independent subagent review before commit.

**Goal:** Replace hardcoded Arena leaderboard displays and process-local submission caches with database-backed submissions, evaluation runs, and real task statistics.

**Architecture:** Keep the current seed tasks as the challenge catalogue, but remove fake leaderboard numbers from task definitions. Persist controller artifacts, official evaluation runs, and submissions in Prisma-backed tables. Server pages read real submissions to compute task participant counts, top scores, and leaderboard entries; empty data renders as empty state, not sample rows.

**Tech Stack:** Next.js route handlers and server components, Prisma/PostgreSQL, Vitest, existing Arena scoring functions.

---

## Files

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260510133000_add_arena_persistence/migration.sql`
- Create: `src/features/arena/submissions/persistence.ts`
- Create: `src/features/arena/submissions/prisma-store.ts`
- Create: `src/features/arena/stats.ts`
- Modify: `src/features/arena/types.ts`
- Modify: `src/features/arena/data/seed-challenges.ts`
- Modify: `src/features/arena/arena-hall.tsx`
- Modify: `src/features/arena/challenge-detail.tsx`
- Modify: `src/features/arena/submissions/arena-submission-panel.tsx`
- Modify: `src/app/arena/page.tsx`
- Modify: `src/app/arena/challenges/[taskId]/page.tsx`
- Modify: `src/app/api/arena/evaluate/route.ts`
- Test: `src/features/arena/__tests__/arena-leaderboard.test.ts`
- Test: `src/features/arena/__tests__/arena-domain.test.ts`
- Test: `src/app/api/arena/evaluate/__tests__/route.test.ts`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [ ] Add failing tests for persistent duplicate reuse, real task stats, and removal of hardcoded hall leaderboard fields.
- [ ] Add Prisma schema and migration for controller artifacts, evaluation runs, and submissions.
- [ ] Implement store-injected persistence so unit tests can verify behavior without a live database.
- [ ] Wire the evaluate API to persisted submissions keyed by authenticated user.
- [ ] Wire `/arena` and challenge detail pages to server-side real stats and leaderboard entries.
- [ ] Replace the sample submission panel with an actual PID parameter form that posts to the API.
- [ ] Run targeted Arena tests and static route guards.
- [ ] Run lint, smoke, and build if targeted tests pass.
- [ ] Request one independent subagent review; fix confirmed issues.
- [ ] Commit and push only Arena persistence files and plan records.

## Verification Record

- Red test evidence: first targeted run failed because `src/features/arena/submissions/persistence.ts` did not exist and `ChallengeTask` seed records still contained `participantCount` / `topScore`.
- Targeted tests: `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-domain.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts` -> 3 files, 13 tests passed.
- Static route guards: `rtk node scripts/tests/test-arena-routes.mjs` -> passed; `rtk node scripts/tests/test-arena-home-entry.mjs` -> passed through `npm run test`.
- Prisma schema: `rtk npx prisma validate` -> schema valid; `rtk npx prisma generate` -> Prisma Client generated.
- Lint: `rtk npm run lint` -> passed with no warnings or errors.
- Smoke: `rtk npm run test` -> smoke, Arena home entry, and Arena route guards passed.
- Build: first build failed on `buildArenaTaskStats` `topScore` inference; fixed by explicitly typing `Record<string, ArenaTaskStats>`. Final `rtk npm run build` -> passed. Route output confirms `/arena` and `/arena/challenges/[taskId]` are dynamic server-rendered pages.

## Review Record

- Independent subagent review first pass found four blocking issues: main leaderboard ranked raw submissions instead of best-per-student entries; evaluation cache key omitted protocol version; non-student users could write into student leaderboard data; persistence errors were returned as raw 400 responses.
- Fixes added: leaderboard best-entry dedupe, protocol-versioned evaluation cache key, student-only submit API, `ArenaSubmissionInputError` domain-error boundary, generic 500 for persistence failures, and protocol-version filtering when reading current leaderboard submissions.
- Same subagent re-review result: passed, no blocking issues for Plan G submission.

## Completion

- Commit: `feat: persist arena submissions`
- Push: completed with `rtk git push`.
