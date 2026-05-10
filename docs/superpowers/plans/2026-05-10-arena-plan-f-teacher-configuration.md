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

- [ ] Add failing tests for teacher-published challenge visibility and homework grading boundary.
- [ ] Run targeted tests and confirm expected failure.
- [ ] Implement teacher configuration page for selecting a task, class scope, visibility, deadline, and leaderboard policy.
- [ ] Implement homework binding display without treating rank as grade.
- [ ] Add teacher navigation entry if consistent with existing teacher dashboard patterns.
- [ ] Run targeted tests.
- [ ] Run `npm run lint`.
- [ ] Browser-check teacher page and student visibility path.
- [ ] Update this plan with verification results.
- [ ] Commit and push only Plan F files.

## Verification Record

- Targeted tests: Pending
- Lint: Pending
- Browser check: Pending
- Commit: Pending
- Push: Pending
