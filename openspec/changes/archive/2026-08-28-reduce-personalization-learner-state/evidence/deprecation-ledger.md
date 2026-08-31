# Deprecation ledger — reduce-personalization-learner-state

| Old entry | Consumers at freeze | Replacement | Deleted at | Evidence |
| --- | --- | --- | --- | --- |
| `src/lib/data-governance/adaptive-learner-state-service.ts` public authority (`readAdaptiveLearnerState`, `readPathPlannerLearnerState`, types/constants) | Route, Konling, AI page, recommendation, graph-center, demo package, type importers listed in `caller-denominator.md` | `@/features/personalization/learner-state/public-api` (`readLearnerState`, `readPathPlannerLearnerStateForSubject`, db-injected `readAdaptiveLearnerState` for tests/runtime db ports, `reduceLearnerState`) | this change | production import graph of the old path is empty; Vitest learner-state/portrait/route/graph/Konling suites; `openspec validate reduce-personalization-learner-state --type change --strict` |

`readAdaptiveLearnerState(db, input)` remains on the Personalization public API as the injectable Learning Record/Assessment port adapter for tests and Konling/evidence-copilot db injection. It is not a second reducer and not a re-export of the deleted `src/lib/data-governance` module.

`readPathPlannerLearnerState(db, userId, input)` remains as the same reducer with `role: 'system'` and `portraitConsumer: 'planner'`. Production recommendation uses `readPathPlannerLearnerStateForSubject`.
