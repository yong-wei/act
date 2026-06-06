# Redesign Operations And Report Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete OpenSpec change `redesign-operations-and-report-surfaces` by making teacher/admin homes action-prioritized operations consoles with role-safe navigation, route ledger evidence, and verification.

**Architecture:** Reuse the existing `teacher-admin-governance-workspaces` contract as the source of operations domains and unavailable states. Keep changes surgical: add first-viewport attention/action sections to teacher and admin homes, extend existing source-level contract tests, then archive the OpenSpec change.

**Tech Stack:** Next.js App Router, React/TSX, Tailwind utility classes, Vitest source-contract tests, OpenSpec.

---

### Task 1: Contract Tests

**Files:**
- Modify: `src/lib/__tests__/platform-ui-contracts.test.ts`
- Reference: `src/features/admin/__tests__/teacher-admin-governance-workspaces.test.ts`

- [x] Add tests asserting teacher home renders `data-operations-first-viewport="teacher-attention"`, pending actions, active work, report/evidence destinations, and honest analytics unavailable states.
- [x] Add tests asserting admin home renders `data-operations-first-viewport="admin-risk-actions"`, risk/action queue, governance/config/source repair paths, future domains, and no fabricated metrics.
- [x] Run `rtk npm run test:unit -- src/lib/__tests__/platform-ui-contracts.test.ts src/features/admin/__tests__/teacher-admin-governance-workspaces.test.ts` and confirm the new assertions fail before implementation.

### Task 2: Teacher Operations Home

**Files:**
- Modify: `src/features/teacher/teacher-dashboard.tsx`

- [x] Add a first-viewport teacher attention section before directory-style quick action grids.
- [x] Show active classroom count, pending preparation, evidence review, history/report destination, and analytics availability using existing props.
- [x] Preserve existing stats, quick actions, active session links, recent classes, recent plans, telemetry summaries, and feature-flagged analytics slots.
- [x] Run the focused tests and keep them green.

### Task 3: Admin Operations Home

**Files:**
- Modify: `src/features/admin/admin-console-home.tsx`

- [x] Add a first-viewport admin risk/action section before the four directory cards.
- [x] Use `ADMIN_OPERATIONS_CONSOLE_DOMAINS` to show available channels, source/governance repair, user/config actions, and future domains without fabricated metrics.
- [x] Preserve `AdminConsoleHeader`, navigation, user menu, and existing directory cards as secondary navigation.
- [x] Run the focused tests and keep them green.

### Task 4: OpenSpec Archive And Branch Completion

**Files:**
- Modify: `openspec/changes/redesign-operations-and-report-surfaces/tasks.md`
- Archive: `openspec/changes/redesign-operations-and-report-surfaces`
- Modify affected specs through `openspec archive`

- [x] Mark all #353 tasks complete only after implementation and verification.
- [x] Run `rtk openspec validate redesign-operations-and-report-surfaces --strict`.
- [x] Run focused teacher/admin tests, commercial UI governance, `tsc`, `lint`, `openspec validate --specs --strict`, and `openspec validate --changes --strict`.
- [x] Capture representative 1440px and 320px light/dark screenshots for `/teacher` and `/admin`.
- [ ] Request high-reasoning review, fix findings, then commit, push, open PR, wait for review clear, merge, mark achieved, and continue goal mode.
