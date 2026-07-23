# Arena Odyssey Assigned Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Arena-launched Control Odyssey runs enter only the task's assigned level without advancing ordinary Odyssey progression.

**Architecture:** A pure Arena assignment module is the sole source of truth for task-to-level and level-to-task lookup. Routing carries the assigned level for observability, the client derives its restricted session from the task mapping, and the action verifies the persisted mapping before isolating ordinary rewards while retaining Arena bridge persistence.

**Tech Stack:** TypeScript, React 19, Next.js server actions, Vitest, OpenSpec.

## Global Constraints

- Reuse the existing task mapping and official server-side telemetry flow; add no dependencies or schema migrations.
- A valid assigned session grants temporary access only; it does not modify ordinary credits, tier progress, controller unlocks, or level-chain state.
- An Arena bridge submission remains eligible only when the persisted level maps to the persisted Arena task.
- Preserve ordinary Control Odyssey free-play behavior and existing publication, retry, and idempotency protections.

---

### Task 1: Assignment Contract and Routing

**Files:**
- Create: `src/features/arena/odyssey/assignment.ts`
- Modify: `src/features/arena/odyssey/bridge.ts`
- Modify: `src/features/arena/workspace-routing.ts`
- Modify: `src/features/arena/__tests__/workspace-routing.test.ts`
- Test: `src/features/arena/__tests__/arena-odyssey-assignment.test.ts`

- [ ] **Step 1: Write failing mapping and route tests**

```ts
expect(getOdysseyLevelForArenaTask('task-odyssey-level-one-growth')).toBe('level-1');
expect(getArenaTaskForOdysseyLevel('level-1')).toBe('task-odyssey-level-one-growth');
expect(url.searchParams.get('odysseyLevelId')).toBe('level-1');
```

- [ ] **Step 2: Run the focused tests and confirm missing mapping behavior fails**

Run: `npx vitest run src/features/arena/__tests__/arena-odyssey-assignment.test.ts src/features/arena/__tests__/workspace-routing.test.ts`

- [ ] **Step 3: Add the pure mapping and have routing and bridge consume it**

```ts
export function getOdysseyLevelForArenaTask(taskId: string) {
  return ODYSSEY_ARENA_LEVEL_BY_TASK[taskId];
}
```

- [ ] **Step 4: Re-run the focused tests**

Run: `npx vitest run src/features/arena/__tests__/arena-odyssey-assignment.test.ts src/features/arena/__tests__/workspace-routing.test.ts`

### Task 2: Assigned Client Session

**Files:**
- Modify: `src/resources/interactive-learning/control-odyssey/index.tsx`
- Modify: `src/features/arena/__tests__/control-odyssey-sync.client.test.tsx`

- [ ] **Step 1: Write a failing client test for a mapped `arenaTask`**

```tsx
mocks.searchParams = new URLSearchParams('arenaTask=task-odyssey-level-one-growth');
await act(async () => root.render(<ControlOdysseyGame />));
expect(container.querySelector('input[type="range"]')).not.toBeNull();
expect(container.textContent).not.toContain('进入星域选择');
```

- [ ] **Step 2: Run the client test and confirm it fails from the introductory view**

Run: `npx vitest run src/features/arena/__tests__/control-odyssey-sync.client.test.tsx`

- [ ] **Step 3: Derive a valid Arena session from the shared mapping and restrict navigation**

```ts
const assignedArenaLevelId = arenaTaskId ? getOdysseyLevelForArenaTask(arenaTaskId) : undefined;
const isArenaAssignedSession = Boolean(assignedArenaLevelId);
```

- [ ] **Step 4: Re-run the client test**

Run: `npx vitest run src/features/arena/__tests__/control-odyssey-sync.client.test.tsx`

### Task 3: Server Progression Isolation

**Files:**
- Modify: `src/app/actions/control-odyssey.ts`
- Modify: `src/app/__tests__/control-odyssey-action.test.ts`

- [ ] **Step 1: Write a failing valid-Arena-run regression test**

```ts
await submitGameScore('level-1', 820, {}, officialSnapshot('run-arena'));
expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledTimes(1);
expect(mocks.prisma.studentProfile.upsert).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the action test and confirm ordinary profile upsert currently occurs**

Run: `npx vitest run src/app/__tests__/control-odyssey-action.test.ts`

- [ ] **Step 3: Gate reward mutations on the persisted task-level assignment pair**

```ts
const isArenaAssignedRun = Boolean(
  runId && expectedArenaTaskId && requestedArenaTaskId === expectedArenaTaskId,
);
```

- [ ] **Step 4: Re-run the action test**

Run: `npx vitest run src/app/__tests__/control-odyssey-action.test.ts`

### Task 4: Full Verification and Delivery

**Files:**
- Modify: `openspec/changes/route-arena-odyssey-to-assigned-levels/tasks.md`

- [ ] **Step 1: Run focused regression coverage**

Run: `npx vitest run src/features/arena/__tests__/arena-odyssey-assignment.test.ts src/features/arena/__tests__/workspace-routing.test.ts src/features/arena/__tests__/arena-odyssey-bridge.test.ts src/features/arena/__tests__/control-odyssey-sync.client.test.tsx src/app/__tests__/control-odyssey-action.test.ts`

- [ ] **Step 2: Run static and OpenSpec validation**

Run: `npm run typecheck && npm exec --yes --package=@fission-ai/openspec openspec -- validate route-arena-odyssey-to-assigned-levels --strict`

- [ ] **Step 3: Review and deliver**

Run: `git diff --check && git diff --stat origin/integration...HEAD`

Create a labeled `area:arena` GitHub Issue, push the branch, open a pull request to `integration`, and request `@codex review 中文回复，即使没有重大问题也必须给出显式回复`.
