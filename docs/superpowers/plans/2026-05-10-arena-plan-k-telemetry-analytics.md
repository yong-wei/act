# Plan K: Arena Telemetry and Analytics Materialization

## Scope

Implement the Arena data foundation required by `docs/arena.md`:

- Complete the L0 Arena core event boundary.
- Keep Arena core events compatible with the central data-governance event registry.
- Derive compact teaching-analysis signals from real Arena submissions and official evaluation results.
- Ensure official evaluation events can materialize into `LearningFact` records.

Out of scope for this phase:

- Black-box official evaluator implementation.
- Teacher dashboard rendering for Arena analytics.
- Personal-center Arena views.
- High-frequency L2/L3 trajectory persistence.

## Success Criteria

- `ARENA_CORE_EVENT_TYPES` covers all L0 events named in `docs/arena.md`.
- Every Arena L0 event is registered as a core data-governance event.
- Arena core event payloads keep `taskId` in the payload and use `resourceKey=arena:<taskId>`.
- Available Arena detail and submission paths emit L0 events through `/api/interactive/events`; `arena_identification_model_save` is registered now and will be emitted when the black-box identification workspace gains a model-save UI.
- Arena submissions can be summarized into stability, weak metric, tradeoff, iteration, identification, and tuning-behavior signals.
- `arena_evaluation_complete` materializes into a design-oriented `LearningFact`.
- Arena open and view events remain persisted as core events but do not update competency facts.

## Verification

## Implemented Files

- `src/features/arena/telemetry.ts`
- `src/features/arena/analytics.ts`
- `src/features/arena/arena-telemetry-client.tsx`
- `src/features/arena/challenge-detail.tsx`
- `src/features/arena/submissions/arena-submission-panel.tsx`
- `src/features/arena/__tests__/arena-controller-artifact.test.ts`
- `src/features/arena/__tests__/arena-leaderboard.test.ts`
- `src/features/arena/__tests__/arena-telemetry-analytics.test.ts`
- `src/lib/data-governance/learning-fact-materialization.ts`
- `src/lib/data-governance/event-types.ts`
- `src/lib/data-governance/event-normalization.ts`
- `src/lib/data-governance/__tests__/learning-fact-materialization.test.ts`
- `docs/ProjectDescription.md`

## Red Test Evidence

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/lib/data-governance/__tests__/learning-fact-materialization.test.ts`
  - Failed before implementation because `src/features/arena/analytics.ts` did not exist.
  - Failed because `ARENA_CORE_EVENT_TYPES` still contained only 5 events.
  - Failed because `arena_evaluation_complete` did not materialize into a `LearningFact`.
- Follow-up tests after subagent review failed before fixes because:
  - `buildArenaInteractionEvent` did not exist.
  - Arena open/view events still materialized into `LearningFact`.
  - Submission and challenge-detail source guards could not find the telemetry sender wiring.

## Verification Commands

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/lib/data-governance/__tests__/learning-fact-materialization.test.ts`
  - Passed: 4 files, 30 tests.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - Passed.
- `rtk npm run lint`
  - Passed: no ESLint warnings or errors.
- `rtk npm run test`
  - Passed: smoke test, arena home entry test, arena routes test.
- `rtk npm run build`
  - First run failed on direct `Map.values()` iteration in `analytics.ts`.
  - After replacing direct iterator loops with `Array.from(...)`, passed.

## Review

- Initial independent subagent review found:
  - Blocker: Arena L0 events were defined but not emitted by production paths.
  - Important: Arena open/view core events would incorrectly materialize into competency facts.
- Fixes applied:
  - Challenge detail and submission panel now send available L0 events through `/api/interactive/events`.
  - `learning-fact-materialization.ts` excludes Arena open/view events from `LearningFact`.
  - Added tests for interaction event shape, source wiring, and fact-materialization exclusion.
- Re-review: pending.
- Re-review found no remaining blocker. It noted that `arena_identification_model_save` has no current production sender because the black-box identification workspace has no model-save UI yet; the plan wording now records that as a registered event boundary rather than a completed production path.

## Commit

- `feat: add arena telemetry analytics`
- Push result: pushed to current branch.
