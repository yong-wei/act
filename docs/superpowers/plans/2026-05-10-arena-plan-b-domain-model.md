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

- [ ] Add failing tests for object-task separation, allowed controller methods, metric profile shape, and leaderboard policy shape.
- [ ] Run the targeted tests and confirm they fail because the model does not exist.
- [ ] Implement the minimal domain types.
- [ ] Add 8-12 white-box seed objects and 2-3 tasks across representative objects.
- [ ] Connect Plan A hall to the seed challenge data instead of local UI-only data.
- [ ] Run targeted tests.
- [ ] Run `npm run lint`.
- [ ] Update this plan with verification results.
- [ ] Commit and push only Plan B files plus necessary Plan A integration changes.

## Verification Record

- Targeted test: Pending
- Lint: Pending
- Commit: Pending
- Push: Pending
