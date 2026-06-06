# Redesign Report Ledger And Export Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete OpenSpec change `redesign-report-ledger-and-export-surfaces` by defining report-ledger rules, binding the report inventory to those rules, and rendering a visible export-safe data-center snapshot example.

**Architecture:** Keep source route shells owned by their existing changes. Add a report-ledger contract layer and apply it to report/snapshot output regions without moving `/data-center`, teacher/admin, learner, Arena, or classroom route ownership.

**Tech Stack:** Next.js App Router, React/TSX, Tailwind token classes, Vitest source/contract tests, OpenSpec.

---

### Task 1: Report-Ledger Contract

**Files:**
- Add: `src/lib/report-ledger-contracts.ts`
- Modify: `src/lib/platform-role-navigation.ts`
- Modify: `src/lib/__tests__/platform-role-navigation.test.ts`

- [x] Define classroom, Arena, learner, governance, and data-center report-ledger rules.
- [x] Require source quality, freshness, privacy scope, and status legend labels.
- [x] Add report category to each `PLATFORM_REPORT_SURFACE_INVENTORY` entry.
- [x] Assert report-ledger ownership remains separate from source route shell ownership.

### Task 2: Data-Center Snapshot Example

**Files:**
- Modify: `src/features/data-center/presentation-data-center.tsx`
- Modify: `src/features/data-center/__tests__/data-center-contracts.test.ts`

- [x] Render the data-center snapshot as report-ledger output.
- [x] Add low-contrast, non-interactive watermark markup.
- [x] Preserve source quality, freshness, privacy, status, and export availability labels.
- [x] Keep the data-center operation shell unchanged.

### Task 3: Verification And Archive

- [x] Run focused report-ledger/data-center/navigation tests.
- [x] Run `tsc`, `lint`, commercial UI governance, diff check, and OpenSpec strict validation.
- [x] Capture or verify representative data-center snapshot evidence.
- [x] Mark tasks complete and archive the OpenSpec change.
- [ ] Request review, fix findings, merge, mark achieved, and continue goal mode.
