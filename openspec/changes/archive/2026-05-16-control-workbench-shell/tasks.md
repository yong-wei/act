## 1. Session Model

- [x] 1.1 Add `src/features/control-workbench/types.ts` with `WorkbenchSessionContext`, target, working model, layout, and submission policy types.
- [x] 1.2 Add a resolver that consumes `arenaTask`, `publicationId`, `preset`, and `mode` parameters and reuses `resolveArenaWorkbenchContext`.
- [x] 1.3 Encode fail-closed results for unknown task ids and incomplete Arena context.

## 2. Route And Shell

- [x] 2.1 Add `/interactive-learning/control-workbench` route and parse supported search parameters.
- [x] 2.2 Add a shell component with Chinese task context, mode status, allowed methods, metrics, and return link.
- [x] 2.3 Render a free-explore placeholder that cannot submit to official evaluation.
- [x] 2.4 Render an error state for invalid `arenaTask` without starting analysis.

## 3. Verification

- [x] 3.1 Add unit tests for session resolution in challenge, free-explore, publication-bound, and invalid-task cases.
- [x] 3.2 Add a route/source test that confirms the new route exists and old routes are not removed.
- [x] 3.3 Run `rtk npm run test:unit -- src/features/arena src/features/control-workbench` or the closest available targeted suite.
