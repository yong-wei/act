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

- [ ] Add a failing test proving the home page exposes an Arena link and `/arena` page exists.
- [ ] Run the test and confirm it fails because the Arena entry is missing.
- [ ] Add `Arena` or `竞技场` to the home navigation and platform entry matrix.
- [ ] Create `/arena` as a task-first hall with challenge cards based on the MVP ideas from `docs/arena.md`.
- [ ] Keep the page explicit that students choose challenge tasks first, not controller technologies.
- [ ] Run the targeted test until it passes.
- [ ] Run `npm run lint`.
- [ ] Start or reuse the local app and verify `/` and `/arena` in browser or Playwright.
- [ ] Update this plan with verification results.
- [ ] Commit and push only Plan A files.

## Verification Record

- Targeted test: Pending
- Lint: Pending
- Browser check: Pending
- Commit: Pending
- Push: Pending
