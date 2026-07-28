## Context

`SmartLessonPlanWorkspace` currently mixes creation controls, task records, generation controls, and raw outputs in one surface. The domain already persists tasks, drafts, jobs, stages, revisions, course-basis versions, and publication references; this change reorganizes those facts without introducing a second workflow model.

## Goals / Non-Goals

**Goals:**

- Give each task one legible five-stage preparation path.
- Make completion, blocking state, deletion, archive, and migration deterministic.
- Keep the operations-console usable on desktop and narrow screens.

**Non-Goals:**

- Replace generation workers, editor internals, retrieval ranking, or Konling sessions.
- Add batch semester planning.

## Decisions

### 1. Derive the accordion from one task projection

The server SHALL project persisted task facts into five stage DTOs containing validity, confirmation, current state, blocking reason, and next action. The client does not infer completion from local component state.

### 2. Separate navigation from task content

The route owns two top-level views. `备课任务` uses a left searchable task index and one right-hand active task; `课程依据` retains source management. Small screens collapse the index into a drawer without changing task identity.

### 3. Treat deletion as reference-aware lifecycle behavior

Deletion checks formal publication and classroom references transactionally. A blocked deletion returns the reference type and a safe action; archive remains available. Generated or approved but unreferenced tasks remain deletable as confirmed in the interview.

### 4. Migrate by projection, not data rewriting

Existing tasks are rendered through an adapter. Valid structured outputs appear in the relevant stage, retryable failures expose resume, and invalid legacy payloads show an actionable unavailable state without raw JSON.

## Risks / Trade-offs

- [Stage validity drifts from domain validation] → Reuse server validators and test stage projection against persisted fixtures.
- [Deletion races with publication] → Check and delete in one transaction with reference constraints.
- [Large task lists slow the page] → Query summary rows separately from the active task detail.

## Migration Plan

Deploy additive projections and the new workspace, migrate no destructive data, then enable the new UI. Rollback returns to the old surface while leaving task records unchanged.

## Open Questions

None.
