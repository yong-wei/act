# Characterization — externalize-control-correction-personalization-plugin

Captured on `externalize-control-correction-personalization-plugin` at `9b57610e4`（含已合入的 `reduce-personalization-learner-state` / #1675）。

## 1.1 Dependency gate

| Input | Status | Evidence |
| --- | --- | --- |
| `reduce-personalization-learner-state` | archived 2026-08-28, merged #1675 | `openspec/changes/archive/2026-08-28-reduce-personalization-learner-state/`；`src/features/personalization/learner-state/public-api.ts` |
| learner-state public API | `readLearnerState` / `readPathPlannerLearnerStateForSubject` / injectable `readAdaptiveLearnerState(db)` | Assessment mastery 经 Assessment public API；control-correction 证据仍走 learner-state 内硬编码课程/Arena ID |
| `establish-modular-monolith-refactor-charter` | archived 2026-08-26 | `openspec/changes/archive/2026-08-26-establish-modular-monolith-refactor-charter/` |
| `enforce-modular-domain-dependency-contracts` | archived 2026-08-26 | `openspec/changes/archive/2026-08-26-enforce-modular-domain-dependency-contracts/` |
| `adaptive-learning-governance-contracts` / mastery / diagnosis / path-planning | 正式 spec 已存在 | 本 change 不改维度评分、Arena 官方评测、path completion 或 LearningFact/Assessment schema |

本 change 不部署、不激活生产 plugin 版本，也不创建第二套 goal registry 或 evidence store。

## 1.2 Frozen control-correction mappings (pre-move)

Owner before this change: `src/features/personalization/learner-state/internal.ts`.

| Constant | Values |
| --- | --- |
| `CONTROL_CORRECTION_GOAL_ID` | `control-correction` |
| `CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION` | `control-correction-goal-slice.v1` |
| `CONTROL_CORRECTION_COURSE_ID_VALUES` | `control-correction`, `3-6`, `unit-3-6-zero-design-workshop`, `unit-3-6-zero-design-workshop-v1` |
| `CONTROL_CORRECTION_ARENA_TASK_ID_VALUES` | `task-second-order-lead-pid` |
| `CONTROL_CORRECTION_GOAL_DIMENSIONS` | 9 ids: time-domain-analysis, root-locus-reasoning, frequency-domain-margin-analysis, method-selection, constraint-tradeoff, simulation-validation, arena-transfer, reflection, ai-collaboration |
| `ADAPTIVE_GOAL_SLICE_REGISTRY` | single entry keyed by `control-correction` |

Evidence reads when `goal=control-correction`:

- explicit `LearningFact.contextJson.goalId|goal|targetGoal|learningGoal = control-correction`
- legacy facts whose `courseId` / `lessonId` / `moduleId` or nested simulation/agent/assessment paths match course IDs
- Arena submissions with `taskId in CONTROL_CORRECTION_ARENA_TASK_ID_VALUES`
- `agentToolRun.courseId in CONTROL_CORRECTION_COURSE_ID_VALUES`
- active/fallback `learningPath` with `goalId=control-correction`

Persistence: plugin does not currently own a distinct write path. Mastery, LearningFact and Arena evaluation remain Assessment / Learning Record / Arena authorities. This change freezes that: plugin write port is idempotent and port-only; it must not call Prisma or grant mastery.

## 1.3 Behaviors to preserve (parity fixtures)

| Behavior | Fixture |
| --- | --- |
| Registered slice metadata, role privacy, missing/stale evidence, path context | `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts` |
| Unknown goal → `unsupported-goal` / `unregistered-adaptive-goal` | same suite + reducer test `goal-plugin-unavailable` |
| Course alias `unit-3-6-zero-design-workshop-v1` → learner-state `goal=control-correction` | `src/lib/__tests__/konling-agent-runtime.test.ts` |
| Client hints never become mastery | `src/features/personalization/learner-state/__tests__/learner-state-reducer.test.ts` |
| Mapping / conflict / retired / version / no-authority | `src/features/personalization/plugins/__tests__/plugin-registry.test.ts` |

## 4.2 Verification notes

Targeted suites passed: plugin-registry, learner-state reducer/service, Konling agent runtime, recommendation-engine, portrait-v2, graph-center, evidence-copilot, KAQ taxonomy.

`rtk npm run typecheck` completed with zero `tsc-type-errors`. Printed `production-to-documentation` / `production-to-tooling` / `web-includes-*` codes are the existing architecture-graph baseline, not this diff.

Recommendation tests required Assessment duck-db stubs (`adaptiveMasteryUpdate.findMany`, `adaptiveAssessmentAbilityEstimate.findFirst`) after learner-state production reads go through Assessment public API.
