# Caller denominator — control-correction course/Arena IDs

Frozen at `9b57610e4` before moving mappings into the Personalization plugin package.

## Production modules that imported `CONTROL_CORRECTION_COURSE_ID_VALUES`

| Caller | Use | Replacement |
| --- | --- | --- |
| `src/features/personalization/learner-state/internal.ts` | owned the constant; legacy LearningFact where + fact matchers | plugin `mappings.ts` + `evidence-match.ts` + `db-evidence.ts` |
| `src/features/personalization/learner-state/adapters/db-runtime.ts` | Arena `taskId in [...]`, `agentToolRun.courseId in [...]` | plugin evidence port factory |
| `src/features/personalization/learner-state/public-api.ts` | re-export | delete re-export; callers use plugin public API |
| `src/lib/konling-agent-runtime.ts` | `resolveAdaptiveLearnerStateGoal` course alias → `control-correction` | `resolvePersonalizationGoalContext` |
| `src/lib/konling-kaq-graph-context.ts` | `resolveKonlingGraphContextLearningGoalId` | same resolver |

## Production modules that must not gain those IDs

| Module | Status at freeze |
| --- | --- |
| `src/lib/adaptive-learning-path-planner.ts` | no course/lesson/Arena concrete IDs; keeps `ADAPTIVE_LEARNING_GOAL_DEFINITIONS` / capability targets (planner non-goal) |
| `src/lib/data-governance/recommendation-engine.ts` | calls `readPathPlannerLearnerStateForSubject`; no course ID literals |
| `src/features/personalization/learner-state/application/read-learner-state.ts` | branches on `CONTROL_CORRECTION_GOAL_ID` only (goal key, not course alias) |

## Course / Arena literals that stay outside Personalization generic layer

Interactive lesson routes, Arena challenge pages, resource seed, and Playwright fixtures retain `unit-3-6-zero-design-workshop` / `task-second-order-lead-pid` as product identities. They are not generic Personalization/learner-state/planner/recommendation modules.

## Tests that must keep passing

- `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts`
- `src/lib/__tests__/adaptive-learner-state-service.test.ts`
- `src/features/personalization/learner-state/__tests__/learner-state-reducer.test.ts`
- `src/lib/__tests__/konling-agent-runtime.test.ts`
- `src/lib/data-governance/__tests__/kaq-objective-taxonomy.test.ts`
- `src/features/personalization/plugins/__tests__/plugin-registry.test.ts`
