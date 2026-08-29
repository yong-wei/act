# Caller denominator — adaptive-learner-state-service

Production / worker / app callers of `src/lib/data-governance/adaptive-learner-state-service.ts` at `d45312070`. Tests listed so deletion cannot drop them.

## Runtime readers (`readAdaptiveLearnerState` / `readPathPlannerLearnerState` / flag)

| Caller | Symbols | Notes |
| --- | --- | --- |
| `src/app/api/adaptive/learner-state/route.ts` | flag + `readAdaptiveLearnerState` | HTTP public surface |
| `src/app/api/ai/konling-context/route.ts` | flag + `readAdaptiveLearnerState` | Konling context |
| `src/app/ai/page.tsx` | flag + `readAdaptiveLearnerState` | AI workshop page |
| `src/lib/konling-agent-runtime.ts` | flag + both readers | agent + planner |
| `src/lib/evidence-copilot-context.ts` | flag + `readAdaptiveLearnerState` | copilot evidence |
| `src/lib/data-governance/recommendation-engine.ts` | flag + `readPathPlannerLearnerState` | recommendations |
| `src/lib/data-governance/graph-center-sources.ts` | flag + `readAdaptiveLearnerState` | graph overlays |
| `src/lib/data-governance/control-correction-demo-package.ts` | flag only | demo packaging |

## Type / constant importers (no live read, still block deletion)

| Caller | Symbols |
| --- | --- |
| `src/features/adaptive/adaptive-learning-center-contracts.ts` | `AdaptiveLearnerState` type |
| `src/app/assessment/adaptive-practice/page.tsx` | type |
| `src/features/ai/ai-workshop-evidence.ts` | type |
| `src/lib/data-governance/graph-center.ts` | types |
| `src/lib/data-governance/kaq-objective-taxonomy.ts` | contracts/constants |
| `src/lib/konling-kaq-graph-context.ts` | `CONTROL_CORRECTION_COURSE_ID_VALUES` |

## Tests (must keep passing after move)

- `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts`
- `src/lib/__tests__/adaptive-learner-state-service.test.ts`
- `src/lib/data-governance/__tests__/adaptive-learner-state-route.test.ts`
- `src/lib/data-governance/__tests__/portrait-v2-model.test.ts`
- `src/lib/data-governance/__tests__/graph-center*.test.ts`
- `src/lib/data-governance/__tests__/teacher-kaq-evidence-trace.test.ts`
- `src/lib/data-governance/__tests__/kaq-objective-taxonomy.test.ts`
- `src/lib/__tests__/konling-agent-runtime.test.ts` (mocks the module)
- `src/lib/__tests__/evidence-copilot-context.test.ts`
- `src/lib/data-governance/__tests__/konling-context-route.test.ts`
- `src/lib/__tests__/adaptive-learning-center-ui.test.ts`

## Replacement after this change

All rows above MUST import `@/features/personalization/learner-state/public-api` (or types from that boundary). Zero production imports of `adaptive-learner-state-service` remain before deleting the file's public exports.

`readPathPlannerLearnerState` consumers call the same public API with system/planner scope; no private planner calculator.

## Migration result

Production readers now import `@/features/personalization/learner-state/public-api`. The old `src/lib/data-governance/adaptive-learner-state-service.ts` module has been deleted. Tests and db-injected runtimes use `readAdaptiveLearnerState(db, input)` on the public API; Prisma-backed routes use `readLearnerState` / `readPathPlannerLearnerStateForSubject`.
