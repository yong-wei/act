# Deprecation ledger — cutover-personalization-path-planner

Frozen at HEAD `8c3ddda916edd4b1e37a7b67d7d48b29f3a26ef6`.

## Predecessor qualification

| Change | Status | Public API / owner |
| --- | --- | --- |
| `reduce-personalization-learner-state` | archived 2026-08-28 | `@/features/personalization/learner-state/public-api` |
| `externalize-control-correction-personalization-plugin` | archived 2026-08-28 | `@/features/personalization/plugins/public-api` |
| `establish-modular-monolith-refactor-charter` | archived | charter |
| `enforce-modular-domain-dependency-contracts` | archived | architecture graphs |

Planner must consume reducer learner state and registered course plugins; it must not re-read Prisma Assessment raw answers or hard-code course IDs.

## Old entries

| Old entry | Owner | Replacement | Non-goals | Deletion gate |
| --- | --- | --- | --- | --- |
| `src/lib/adaptive-learning-path-planner.ts` | personalization | `planLearningPath` in `@/features/personalization/path-planning/public-api` | no RL, no second path schema, no production cutover switch, no facade after deletion | **met**: path deleted; production callers import the Personalization public API |
| `src/lib/act-prerequisite-path-planner/` | personalization (compat listed as platform) | same public API (`planActPrerequisitePath`, `applyLearningPathConsumerActivation`) | do not rewrite historical paths; Arena evaluator stays assessment authority | **met**: directory deleted from `src/lib`; tests and activation consumers import the Personalization module |

## Retained adapters

- Canonical output remains `AdaptiveLearningPathPlan` / persistence records. No second path or candidate schema.
- Ranking still uses `src/lib/adaptive-planning/resource-ranker.ts`; repair still uses `src/lib/adaptive-planning/path-constraint-repair.ts`.
- Control-correction capability targets live on the plugin (`capability-targets.ts`), not in a `src/lib` planner.
- Rollback is code version + immutable path history. Runtime does not keep a second planner path.

## Verification

- `rg` over `src/app`, `src/lib`, `src/features`, `scripts` found no remaining `@/lib/adaptive-learning-path-planner` or `@/lib/act-prerequisite-path-planner` production imports.
- `npm run typecheck` completed (web graph `blocked` on pre-existing documentation/tooling edges, exit 0).
- `openspec validate cutover-personalization-path-planner --type change --strict` passed.
- No deployment or production activation occurred.
