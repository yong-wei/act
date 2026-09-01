# Current-head owner mapping (C2)

Scan revision: `655789af7bd35739f658a6dd300589f03e0693d6`. Re-scan of this source tree after `path-planning/public-api.client.ts` landed. Server routes use `path-planning/public-api`; client/experience use `path-planning/public-api.client`. Production sources under `src/app`, `src/features`, `src/lib`, `scripts`. Banned needles `@/features/adaptive/` and `@/lib/adaptive-` have zero production hits (test files only assert absence). Verification on that SHA: `rtk npm run typecheck` exit 0; `legacy-adaptive-entrypoint-retirement` and path-advisor tests passing.

| Old path | Owner | Replacement | Consumers after rewrite | Deletion |
| --- | --- | --- | --- | --- |
| `src/features/adaptive/adaptive-learning-center-contracts.ts` | Personalization presentation | `src/features/personalization/experience/adaptive-learning-center-contracts.ts` | experience/app/arena | deleted old path |
| `src/features/adaptive/adaptive-path-correction-outcomes.ts` | Personalization presentation | `src/features/personalization/experience/adaptive-path-correction-outcomes.ts` | experience | deleted old path |
| `src/features/adaptive/adaptive-path-journey-contracts.ts` | Personalization presentation | `src/features/personalization/experience/adaptive-path-journey-contracts.ts` | experience/app | deleted old path |
| `src/features/adaptive/adaptive-path-journey-control.tsx` | Personalization presentation | `src/features/personalization/experience/adaptive-path-journey-control.tsx` | experience/app/arena | deleted old path |
| `src/features/adaptive/adaptive-path-timeline.tsx` | Personalization presentation | `src/features/personalization/experience/adaptive-path-timeline.tsx` | experience | deleted old path |
| `src/features/adaptive/adaptive-path-unlock-chain-view.tsx` | Personalization presentation | `src/features/personalization/experience/adaptive-path-unlock-chain-view.tsx` | experience | deleted old path |
| `src/features/adaptive/cold-start-collection-panel.tsx` | Personalization presentation | `src/features/personalization/experience/cold-start-collection-panel.tsx` | assessment practice page | deleted old path |
| `src/features/adaptive/diagnosis-surface-panel.tsx` | Personalization presentation | `src/features/personalization/experience/diagnosis-surface-panel.tsx` | teacher/profile | deleted old path |
| `src/features/adaptive/path-advisor-entrypoint-bridge.tsx` | Personalization presentation | `src/features/personalization/experience/path-advisor-entrypoint-bridge.tsx` | practice page | deleted old path |
| `src/features/adaptive/path-workspace-module.tsx` | Personalization presentation | `src/features/personalization/experience/path-workspace-module.tsx` | practice/layout | deleted old path |
| `src/lib/adaptive-cold-start-detection.ts` | Personalization path-planning | `public-api` re-export of `adaptive-cold-start-detection.ts` | public-api consumers | deleted old path |
| `src/lib/adaptive-generation-readiness.ts` | Personalization path-planning | `public-api` / `public-api.client` | path-advisor tool route; practice page | deleted old path |
| `src/lib/adaptive-learning-optimization-experiments.ts` | Personalization path-planning | `public-api` | admin experiment UI | deleted old path |
| `src/lib/adaptive-path-candidate-batches.ts` | Personalization path-planning | `public-api` | path-advisor, candidate-batch routes, konling | deleted old path |
| `src/lib/adaptive-path-candidate-limitation-copy.ts` | Personalization path-planning | `public-api` | option-display internals | deleted old path |
| `src/lib/adaptive-path-comparison.ts` | Personalization path-planning | `public-api` | path-advisor, konling | deleted old path |
| `src/lib/adaptive-path-correction-decisions.ts` | Personalization path-planning | `public-api` | correction-decisions route | deleted old path |
| `src/lib/adaptive-path-decision-evidence.ts` | Personalization path-planning | `public-api` | effect evaluation | deleted old path |
| `src/lib/adaptive-path-destination-contract.ts` | Personalization path-planning | `public-api` | assemble-plan internals | deleted old path |
| `src/lib/adaptive-path-execution-state.ts` | Personalization path-planning | `public-api` | journey/execute routes | deleted old path |
| `src/lib/adaptive-path-generation-panel.ts` | Personalization path-planning | `public-api.client` | practice page | deleted old path |
| `src/lib/adaptive-path-goal-options-client.ts` | Personalization client port | `public-api.client` | practice page, round-restore | deleted old path |
| `src/lib/adaptive-path-goal-options.ts` | Personalization path-planning | `public-api` | path-advisor, konling | deleted old path |
| `src/lib/adaptive-path-node-decisions.ts` | Personalization path-planning | `public-api` | assemble-plan internals | deleted old path |
| `src/lib/adaptive-path-option-display.ts` | Personalization path-planning | `public-api.client` | experience/practice | deleted old path |
| `src/lib/adaptive-path-round-restore.ts` | Personalization path-planning | `public-api.client` | practice restore | deleted old path |
| `src/lib/adaptive-path-unlock-chain.ts` | Personalization path-planning | `public-api.client` | unlock view | deleted old path |
| `src/lib/adaptive-planning/path-constraint-repair.ts` | Personalization path-planning | `public-api` | plan-learning-path internals | deleted old path |
| `src/lib/adaptive-planning/resource-ranker.ts` | Personalization path-planning | `public-api` | assemble-plan internals | deleted old path |
| `src/lib/adaptive-planning/item-type-terminal-validation.ts` | Assessment | `src/features/assessment/item-type-terminal-validation.ts` | assessment catalog/lifecycle | deleted old path |

Retained persistence: Prisma tables, LearningFact, outbox, path history. Rollback: `b8c2cce5f6`.
