# Arena Training Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface governed Arena virtual-training records in the personal center and materialize them as bounded learning-profile evidence without changing official Arena evaluation semantics.

**Architecture:** The virtual-preview store writes compact task and provenance metadata to the canonical `SimulationRun.summary`. The evidence materializer carries only this safe metadata into `LearningFact` and caps preview contributions. The profile route reads the student-owned virtual-run rows, maps them through the Arena portfolio aggregator, and the page renders a separate training section.

**Tech Stack:** Next.js 16, TypeScript, Prisma, Vitest, OpenSpec.

## Global Constraints

- Keep virtual training separate from `ArenaSubmission`, official scores, leaderboard positions, valid-submission rate, task unlocks, and formal capability attainment.
- Do not add Prisma schema changes or copy high-frequency trace samples into `LearningFact`.
- Preserve history: existing `ArenaVirtualSimulationRun` rows remain readable; do not fabricate task attribution for historical `LearningFact` rows lacking it.
- All changed behavior must have a focused Vitest regression test that fails before its implementation.
- Validate `surface-arena-training-evidence` with strict OpenSpec validation before delivery.

---

### Task 1: Governed Preview Evidence

**Files:**
- Create: `src/lib/data-governance/__tests__/simulation-arena-preview-evidence.test.ts`
- Modify: `src/features/arena/__tests__/arena-virtual-simulation-run-store.test.ts`
- Modify: `src/features/arena/blackbox/controller-preview.ts`
- Modify: `src/lib/data-governance/simulation-agent-evidence-materialization.ts`

**Interfaces:**
- Produces a canonical preview summary with `arenaTraining.taskId`, `scenarioId`, `evaluationVisibility`, `officialEligible`, and replay identifiers.
- Produces a `LearningFact` whose `moduleId` is the Arena task id and whose `contextJson.simulation` retains compact preview provenance.

- [x] **Step 1: Write failing evidence-materialization tests**

Add a completed `arena_preview` fixture containing:

```ts
summary: {
  arenaTraining: {
    taskId: 'task-cruise-roll-blackbox-identification',
    scenarioId: 'cruise-roll-controller-preview',
    evaluationVisibility: 'preview',
    officialEligible: false,
  },
  trackingError: 0.1,
  maxDeviation: 0.5,
  safetyViolations: 0,
}
```

Assert that the generated fact uses the task id as `moduleId`, retains preview and official-ineligibility fields without trace samples, and has a smaller competency contribution magnitude than the equivalent non-preview run.

- [x] **Step 2: Run the focused evidence test and verify RED**

Run: `npx vitest run src/lib/data-governance/__tests__/simulation-arena-preview-evidence.test.ts`

Expected: the new assertions fail because task context is removed and preview contributions are not capped.

- [x] **Step 3: Write the failing canonical-run store test**

Extend the existing transaction assertion to require:

```ts
summary: expect.objectContaining({
  arenaTraining: expect.objectContaining({
    taskId: preview.taskId,
    scenarioId: preview.scenarioId,
    evaluationVisibility: 'preview',
    officialEligible: false,
  }),
})
```

- [x] **Step 4: Run the focused store test and verify RED**

Run: `npx vitest run src/features/arena/__tests__/arena-virtual-simulation-run-store.test.ts`

Expected: the new assertion fails because the canonical summary contains only metrics and `previewBoundary`.

- [x] **Step 5: Implement compact preview attribution and bounded contribution**

In `controller-preview.ts`, add an `arenaTraining` object to canonical summary using `input.taskId`, `input.scenarioId`, `previewBoundary`, and replay identifiers only. In `simulation-agent-evidence-materialization.ts`, preserve these safe fields in the summary and fact context, use task id for module attribution, and multiply preview competency contributions by a fixed factor below `1`.

- [x] **Step 6: Run focused evidence and store tests**

Run: `npx vitest run src/lib/data-governance/__tests__/simulation-arena-preview-evidence.test.ts src/features/arena/__tests__/arena-virtual-simulation-run-store.test.ts`

Expected: PASS.

### Task 2: Personal Center Training Summary

**Files:**
- Modify: `src/features/arena/__tests__/arena-profile.test.ts`
- Modify: `src/features/arena/profile.ts`
- Modify: `src/app/api/user/profile/route.ts`
- Modify: `src/app/(main)/profile/page.tsx`

**Interfaces:**
- `buildArenaStudentPortfolio(submissions, userId, trainingRuns)` accepts user-scoped virtual training records.
- `ArenaStudentPortfolio.trainingSummary` exposes count, latest training time, average quality score, and preview records without modifying official aggregates.

- [x] **Step 1: Write failing portfolio and integration-source tests**

Add a virtual training fixture with task id, scenario id, preview metrics, explicit `officialEligible: false`, and a later timestamp. Assert that a student with no official submission has zero official aggregates, one training record, task attribution, preview provenance, and no official growth coverage. Extend the existing source test to require a user-scoped virtual-run query and training-summary render markers.

- [x] **Step 2: Run the focused profile test and verify RED**

Run: `npx vitest run src/features/arena/__tests__/arena-profile.test.ts src/lib/data-governance/__tests__/profile-route.test.ts`

Expected: the new portfolio fields and source assertions fail.

- [x] **Step 3: Implement portfolio training aggregation**

Define minimal read-model types in `profile.ts`, normalize only stored preview summary fields, compute a separate recent-training list and average quality score, and leave all existing official aggregation functions unchanged.

- [x] **Step 4: Implement backend query and response wiring**

In the profile API, add `prisma.arenaVirtualSimulationRun.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: ... })` to the existing independent reads. Map its payload through the portfolio function. Do not issue any class-wide training query.

- [x] **Step 5: Render distinct training evidence**

In the profile page, render the training count, recent task-labelled preview records, score/quality summary, and a non-official marker. Continue rendering the existing official growth section independently, including when only training exists.

- [x] **Step 6: Run focused profile test and related route/page tests**

Run: `npm run test:unit -- src/features/arena/__tests__/arena-profile.test.ts src/lib/data-governance/__tests__/profile-route.test.ts src/lib/data-governance/__tests__/profile-page-evidence-status.test.ts`

Expected: PASS.

### Task 3: End-to-End Verification And Delivery

**Files:**
- Modify: `openspec/changes/surface-arena-training-evidence/tasks.md`

- [x] **Step 1: Verify the complete persisted-preview path**

Run the two evidence/store tests plus the profile test. Inspect their assertions to confirm: persisted preview -> canonical run -> `LearningFact` -> personal-center training summary, while official totals, growth coverage, leaderboard, and submission rates remain unchanged.

- [x] **Step 2: Mark OpenSpec tasks complete and validate artifacts**

Mark each completed task in `tasks.md`, then run: `openspec validate surface-arena-training-evidence --type change --strict`.

Expected: strict validation passes.

- [x] **Step 3: Inspect scope and prepare delivery**

Run: `git diff --check`, `git diff --stat origin/integration...HEAD`, and inspect the staged diff. Commit only the OpenSpec records, plan, tests, and implementation. Push `codex/arena-training-evidence`, create a draft PR to `integration` containing `Closes #1040`, and do not request `@codex review` or merge.
