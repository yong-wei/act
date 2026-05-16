## 1. Adapter Registry

- [x] 1.1 Add Arena PlantAdapter interfaces under `src/features/arena/adapters/types.ts`.
- [x] 1.2 Split the current mock cruise-roll adapter into an explicitly test-only export.
- [x] 1.3 Add a production `CruiseRollBlackBoxAdapter` that delegates public experiments and previews to existing persisted services.
- [x] 1.4 Add a `WhiteBoxTransferFunctionAdapter` placeholder for registry completeness without changing white-box evaluation.
- [x] 1.5 Add `getArenaPlantAdapterForObject` registry selection and unsupported-object errors.

## 2. API Adoption

- [x] 2.1 Route `/api/arena/blackbox-experiments` through the production registry.
- [x] 2.2 Route `/api/arena/virtual-simulation-runs` through the production registry.
- [x] 2.3 Preserve student-only access, experiment budget, persisted dataset creation, and dataset ownership checks.
- [x] 2.4 Add API tests proving production routes do not import or call the mock adapter.

## 3. Hidden Official Evaluation

- [x] 3.1 Add hidden black-box scenario-set definitions with stable scenario-set ids.
- [x] 3.2 Add deterministic hidden scenario replay for `black-box-control` cruise-roll artifacts.
- [x] 3.3 Add metric aggregation for tracking error, worst-case deviation, control energy, constraint violations, smoothness, identification fit, and disturbance recovery.
- [x] 3.4 Add Chinese hard-constraint explanations that avoid exposing hidden scenario internals.
- [x] 3.5 Switch black-box official evaluation protocol to `blackbox-official-v1`.

## 4. Persistence And Cache Boundaries

- [x] 4.1 Persist or embed scenario-set identity with official black-box evaluation results.
- [x] 4.2 Ensure `blackbox-v1` cached evaluations are not reused for `blackbox-official-v1`.
- [x] 4.3 Keep invalid black-box submissions out of official leaderboards.

## 5. Verification

- [x] 5.1 Add unit tests for registry selection, unsupported adapters, and mock boundary rules.
- [x] 5.2 Add evaluator tests for legal artifacts, malformed artifacts, hidden scenario failure, and cache separation.
- [x] 5.3 Add route tests for black-box experiment and virtual preview ownership preservation.
- [x] 5.4 Run `rtk npm run test:unit -- src/features/arena`.
- [x] 5.5 Run `rtk npm run lint`.
