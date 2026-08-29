# Deprecation ledger — externalize-control-correction-personalization-plugin

Do not edit the frozen global `docs/architecture/deprecation-ledger.md` census in this change.

| Old entry | Consumers at freeze | Replacement | Deleted at | Evidence |
| --- | --- | --- | --- | --- |
| `CONTROL_CORRECTION_COURSE_ID_VALUES` / `CONTROL_CORRECTION_ARENA_TASK_ID_VALUES` owned by learner-state `internal.ts` and re-exported from learner-state public API | Konling agent runtime, Konling KAQ graph context, db-runtime Arena/agent queries, LearningFact matchers | `@/features/personalization/plugins/public-api` (`resolvePersonalizationGoalContext`, plugin mappings, evidence port) | this change | plugin-registry tests; generic Personalization/planner/recommendation sources contain none of `3-6` / `unit-3-6-zero-design-workshop*` / `task-second-order-lead-pid` |
| Duplicate `ADAPTIVE_GOAL_SLICE_REGISTRY` public course-mapping authority | learner-state `resolveAdaptiveGoalSliceDefinition` | same slice object registered on `personalizationPluginRegistry` keyed by `goalId`; course/lesson/task mapping lives only on the plugin | this change | `plugin.sliceDefinition === ADAPTIVE_GOAL_SLICE_REGISTRY['control-correction']`; registry `list()` length 1 |

## Plugin registry manifest

| Field | Value |
| --- | --- |
| pluginId | `control-correction-personalization-plugin` |
| goalId | `control-correction` |
| version | `control-correction-personalization-plugin.v1` |
| owner | Personalization plugin package `src/features/personalization/plugins/control-correction/` |
| courseIds | `control-correction`, `3-6`, `unit-3-6-zero-design-workshop`, `unit-3-6-zero-design-workshop-v1` |
| lessonIds | same as courseIds |
| arenaTaskIds | `task-second-order-lead-pid` |
| evidence ports | Learning Record facts, Arena submissions, agent tool runs via declared read port |
| write port | in-memory idempotent adapter; no Prisma; does not grant mastery |

`ADAPTIVE_LEARNING_GOAL_DEFINITIONS` remains planner-owned (explicit non-goal of this change).
