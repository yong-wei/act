# Arena Plan B: Domain Model And Seed Challenges

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Define the first Arena domain model and seed challenge data without adding persistence yet.

**Architecture:** Model the Arena around `ChallengeObject`, `ChallengeTask`, `ControllerArtifact`, `MetricProfile`, and `LeaderboardPolicy`. Objects describe controlled plants; tasks define challenge goals and ranking policy.

**Tech Stack:** TypeScript, Vitest or existing smoke-style script tests.

---

## Files

- Create: `src/features/arena/types.ts`
- Create: `src/features/arena/data/seed-challenges.ts`
- Create or modify: `src/features/arena/index.ts`
- Test: `src/features/arena/__tests__/arena-domain.test.ts`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for object-task separation, allowed controller methods, metric profile shape, and leaderboard policy shape.
- [x] Run the targeted tests and confirm they fail because the model does not exist.
- [x] Implement the minimal domain types.
- [x] Add 8-12 white-box seed objects and 2-3 tasks across representative objects.
- [x] Connect Plan A hall to the seed challenge data instead of local UI-only data.
- [x] Run targeted tests.
- [x] Run `npm run lint`.
- [x] Update this plan with verification results.
- [ ] Commit and push only Plan B files plus necessary Plan A integration changes.

## Verification Record

- Targeted test: `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts` -> 1 file, 3 tests passed.
- Red test evidence: after adding Vitest include, first targeted run failed with `Cannot find module '../data/seed-challenges'`.
- Regression check: `rtk node scripts/tests/test-arena-home-entry.mjs` -> passed.
- Lint: `rtk npm run lint` -> passed with no ESLint warnings or errors.
- Commit: Pending
- Push: Pending
