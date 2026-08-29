# Import / call graph — retire-legacy-adaptive-entrypoints

HEAD at inventory freeze: `a6c32f37289cdc3e2667a80589204fe645364197`.

Scan roots: `src/app`, `src/features`, `src/lib`, `scripts`. Test fixtures (`__tests__`, `*.test.*`, `*.spec.*`) and historical docs are classified out of the production denominator.

## Retired production needles (must be zero)

- `@/features/adaptive-learning`
- `features/adaptive-learning/kaq-quiz-coverage`
- `@/lib/adaptive-learning-path-planner`
- `@/lib/act-prerequisite-path-planner`
- `@/lib/data-governance/adaptive-learner-state-service`
- `@/lib/data-governance/recommendation-engine`
- `@/features/ai/companion/intervention-engine`
- `WithPersistenceFallback`
- `isAdaptiveAssessmentPersistenceEnabled`

Live gate: `src/lib/__tests__/legacy-adaptive-entrypoint-retirement.test.ts`.

## KAQ forwarding

| Kind | Path | After this change |
| --- | --- | --- |
| production | none | file deleted |
| test | former `src/features/adaptive-learning/__tests__/kaq-quiz-coverage.test.ts` | `src/features/adaptive-assessment/__tests__/kaq-quiz-foundation.test.ts` imports `../kaq-quiz-foundation` |
| frozen census | `docs/architecture/modular-monolith/baseline/dependency.md` rows for the forwarding file | historical; not rewritten |

## Canonical production callers after retirement

| Concern | Production entry | Public API |
| --- | --- | --- |
| path-owned next/submit | `src/app/api/assessment/next-question/route.ts`, `submit-answer/route.ts` | `@/features/assessment/public-api` |
| template practice generate | `src/app/api/assessment/generate-question/route.ts` | `generateQuestion` in `adaptive-engine` (retained practice store) |
| learner state | learner-state route, Konling, AI page, graph-center, demo package | `@/features/personalization/learner-state/public-api` |
| path plan | learning-paths / advisor / candidate-batch routes, Konling | `@/features/personalization/path-planning/public-api` |
| recommendation | `src/app/api/student/recommendations/route.ts` | `recommendLearning` |
| intervention | AI check/generate, Konling runtime | `decideIntervention` |
| async micro-intervention facts | data-governance worker | Learning Record `applyAllStagedMicroInterventionEvidence` |

## Explicit non-production / historical

- Characterization tests that mention retired strings as negative assertions.
- Frozen architecture census and fitness-budget allowlist identities that still name deleted files.
- Stored path `plannerVersion` values `adaptive-learning-path-planner.v1`.
