# Arena Plan A: Home Entry And Hall Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add Arena as a first-class task-oriented entry from the home page and create a browsable `/arena` hall shell.

**Architecture:** This phase is UI shell only. It must not introduce scoring, submissions, persistence, or black-box simulation. The hall uses local presentation data until Plan B defines shared domain types.

**Tech Stack:** Next.js App Router, React, Tailwind, lucide-react.

---

## Files

- Modify: `src/app/page.tsx`
- Create: `src/app/arena/page.tsx`
- Optional create: `src/features/arena/arena-hall.tsx`
- Test: `scripts/tests/test-arena-home-entry.mjs`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add a failing test proving the home page exposes an Arena link and `/arena` page exists.
- [x] Run the test and confirm it fails because the Arena entry is missing.
- [x] Add `Arena` or `竞技场` to the home navigation and platform entry matrix.
- [x] Create `/arena` as a task-first hall with challenge cards based on the MVP ideas from `docs/arena.md`.
- [x] Keep the page explicit that students choose challenge tasks first, not controller technologies.
- [x] Run the targeted test until it passes.
- [x] Run `npm run lint`.
- [x] Start or reuse the local app and verify `/` and `/arena` in browser or Playwright.
- [x] Update this plan with verification results.
- [ ] Commit and push only Plan A files.

## Verification Record

- Targeted test: `rtk node scripts/tests/test-arena-home-entry.mjs` -> passed.
- Red test evidence: first run failed on `首页应提供指向 /arena 的竞技场入口`.
- Lint: `rtk npm run lint` -> passed with no ESLint warnings or errors.
- Browser check: direct `next dev` on `127.0.0.1:3001`; HTTP `/` and `/arena` returned 200; Playwright verified visible `竞技场`, `竞技场大厅`, and `推荐挑战任务`.
- Commit: Pending
- Push: Pending
