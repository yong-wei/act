# Arena Plan F: Teacher Configuration And Homework Binding

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add the first teacher-facing challenge configuration workflow and homework binding boundary.

**Architecture:** Teacher configuration publishes existing seed tasks to a class or homework context. Homework scores must not equal raw leaderboard rank; the plan records mastery, completion, and diagnostic metrics separately from competitive rank.

**Tech Stack:** Next.js App Router, route handlers if needed, TypeScript, Tailwind.

---

## Files

- Create: `src/app/teacher/arena/page.tsx`
- Create: `src/features/arena/teacher/*`
- Create or modify: `src/app/api/teacher/arena/*`
- Test: `src/features/arena/__tests__/arena-teacher-config.test.ts`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for teacher-published challenge visibility and homework grading boundary.
- [x] Run targeted tests and confirm expected failure.
- [x] Implement teacher configuration page for selecting a task, class scope, visibility, deadline, and leaderboard policy.
- [x] Implement homework binding display without treating rank as grade.
- [x] Add teacher navigation entry if consistent with existing teacher dashboard patterns.
- [x] Run targeted tests.
- [x] Run `npm run lint`.
- [x] Browser-check teacher page and student visibility path.
- [x] Update this plan with verification results.
- [ ] Commit and push only Plan F files.

## Verification Record

- Targeted tests: `rtk npm run test:unit -- src/features/arena/__tests__/arena-teacher-config.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts` -> 2 files, 7 tests passed; `rtk node scripts/tests/test-arena-routes.mjs` -> passed.
- Red test evidence: first targeted run failed with missing `../teacher/configuration`.
- Lint: `rtk npm run lint` -> passed with no ESLint warnings or errors.
- Browser check: logged in with fixed teacher account `test_teacher`; Playwright verified `/teacher/arena` shows `竞技场挑战配置`, `作业评价边界`, and `作业评价不等同排行榜名次`; student challenge detail shows `可作为作业挑战`.
- API check: `POST /api/teacher/arena/preview` returned HTTP 200 JSON with publication payload.
- Commit: Pending
- Push: Pending
