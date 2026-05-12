# Arena Plan H: Catalogue And Evaluation Coverage

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` review discipline after implementation. This phase uses one implementation pass and one independent subagent review before commit.

**Goal:** Expand the Arena catalogue so challenge tasks and evaluation profiles cover typical objects, homework objects, Control Odyssey objects, and virtual simulation objects.

**Architecture:** Keep the Arena catalogue task-first. Extend object metadata for non-white-box sources without forcing every object into a transfer-function model. Add task profiles and leaderboard policies for homework, Odyssey growth, composite compensation, and black-box virtual simulation challenge modes. Detail pages route to the appropriate existing workspace/simulation entry instead of hardcoding the multi-representation workspace for every task.

**Tech Stack:** TypeScript seed catalogue, Next.js detail UI, Vitest domain/filter tests, static route guards.

---

## Files

- Modify: `src/features/arena/types.ts`
- Modify: `src/features/arena/data/seed-challenges.ts`
- Modify: `src/features/arena/filtering.ts`
- Modify: `src/features/arena/challenge-detail.tsx`
- Create: `src/features/arena/workspace-routing.ts`
- Modify: `src/features/arena/__tests__/arena-domain.test.ts`
- Modify: `src/features/arena/__tests__/arena-filtering.test.ts`
- Modify: `scripts/tests/test-arena-routes.mjs`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for task coverage across typical, homework, Control Odyssey, and virtual simulation sources.
- [x] Add failing tests for non-hardcoded workspace routing by workspace mode.
- [x] Extend challenge object metadata so black-box virtual simulation objects do not require public transfer functions.
- [x] Add task records and metric profiles for homework, Control Odyssey, composite compensation, and black-box virtual simulation challenges.
- [x] Wire challenge detail workspace CTAs through a routing helper.
- [x] Run targeted Arena tests and static route guards.
- [x] Run lint and build.
- [x] Request one independent subagent review; fix confirmed issues.
- [x] Commit and push only Plan H files.

## Verification Record

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts` -> 2 files, 10 tests passed.
- `rtk node scripts/tests/test-arena-routes.mjs` -> passed.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts` -> 3 files, 18 tests passed.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> smoke, home entry, and arena routes passed.
- `rtk npm run build` -> passed.

## Review Record

- Independent subagent review by `019e1223-171b-7b23-9a8d-e1257afab902` passed.
- Findings: no blocker. Confirmed no hardcoded leaderboard seed values, required source coverage, black-box virtual simulation object without public transfer-function model, optional-model handling in detail/evaluator paths, and task-aware workspace routing.
- Non-blocking reminder from review: update this review record before commit. Completed here.

## Commit Record

- Commit subject: `feat: expand arena challenge catalogue`
- Final commit hash: recorded by `git log -1` after amend.
- Push: completed.
