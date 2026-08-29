# Import/call graph freeze — cutover-personalization-path-planner

- HEAD: `8c3ddda916edd4b1e37a7b67d7d48b29f3a26ef6`
- Old authorities:
  - `src/lib/adaptive-learning-path-planner.ts` (`buildAdaptiveLearningPathPlan` and goal/registry helpers)
  - `src/lib/act-prerequisite-path-planner/` (`planner.ts`, `resource-selection.ts`, `contracts.ts`, `index.ts`)

## Production assembly callers of `buildAdaptiveLearningPathPlan`

| Caller | Role |
| --- | --- |
| `src/lib/adaptive-learning-path-planner.ts` | Authority; public `buildAdaptiveLearningPathPlan` and internal replan |
| `src/lib/konling-agent-runtime.ts` | Konling tool assembles a plan |
| `src/lib/full-resource-path-readiness-gate.ts` | Path readiness gate assembles a plan to judge coverage |

## Production registry / type callers of `adaptive-learning-path-planner`

These import goal registry, types, or snapshots; they do not necessarily assemble paths:

- Routes: `src/app/api/learning-paths/plan/route.ts`, `latest/route.ts`, `route-helpers.ts`, `candidate-batches/latest/route.ts`
- Advisor: `src/app/api/adaptive/path-advisor-tool/route.ts`, `path-advisor-context/route.ts`
- Personalization: `src/features/personalization/learner-state/internal.ts`, `plugins/control-correction/slice-contract.ts`
- Adaptive UI: `src/features/adaptive/adaptive-learning-center-contracts.ts`, `src/app/assessment/adaptive-practice/page.tsx`
- Path services: `src/lib/adaptive-path-candidate-batches.ts`, `adaptive-path-decision-evidence.ts`, `adaptive-path-round-restore.ts`, `adaptive-path-goal-options.ts`, `canonical-learning-path-transition/replan.ts`, `adaptive-learning-optimization-experiments.ts`
- Evidence/governance: `src/lib/data-governance/yangfan-diagnostic-fixture.ts`, `student-evidence-feature-cache.ts`, `kaq-evidence-writeback.ts`, `learning-goal-resource-baseline-runtime.ts`, `learning-goal-assessment-coverage-runtime.ts`, `konling-kaq-graph-context.ts`

## `act-prerequisite-path-planner` callers

- Barrel: `src/lib/act-prerequisite-path-planner/index.ts`
- Internal: `planner.ts` calls `applyLearningPathConsumerActivation` while planning
- Tests: `src/lib/__tests__/act-prerequisite-path-planner.test.ts`, `activate-versioned-knowledge-consumers.test.ts`
- No production route currently imports the barrel; the deletion gate still requires the directory gone after all tests/scripts use Personalization ports

## Non-production / scripts

- Tests under `src/lib/__tests__/adaptive-learning-path-planner.test.ts` and related path/optimization/governance tests
- Scripts: `scripts/db/generate-learning-goal-assessment-coverage.ts`, `generate-resource-field-completion-audit.ts`, `scripts/data-governance/check-micro-tutoring-coverage.ts`

## Deletion gate

Zero production imports of the two old authorities, and no competing assembly/ranking entrypoint besides `PlanLearningPath`.
