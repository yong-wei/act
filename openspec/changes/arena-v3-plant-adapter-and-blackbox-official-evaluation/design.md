## Context

The current Arena backend has the pieces needed for black-box work: budgeted experiment persistence, dataset ownership checks, virtual preview persistence, `/api/arena/evaluate`, and `ControllerArtifact` storage. The missing boundary is that production object access is not mediated by a stable PlantAdapter registry, while `src/features/arena/adapters/plant-adapter.ts` still only exposes `createMockCruiseRollBlackBoxAdapterForTests`. The black-box official evaluator also derives metrics from submitted parameters rather than replaying hidden official scenarios.

This change is the first backend dependency for the later reporting and routing changes. It must preserve the shared control workbench contract boundary: the workbench may create `ControllerDraft` and convert it to `ControllerArtifact`, but official scoring remains owned by Arena and continues through `/api/arena/evaluate`.

## Goals / Non-Goals

**Goals:**
- Introduce a production PlantAdapter registry for Arena object access.
- Preserve experiment budget, dataset persistence, and dataset ownership guarantees.
- Add hidden scenario official evaluation for the cruise-roll black-box task.
- Version black-box official evaluation as `blackbox-official-v1`.
- Provide test coverage that proves production APIs do not use the mock adapter.

**Non-Goals:**
- No unified control workbench UI.
- No route switch to `/interactive-learning/control-workbench`.
- No teacher report or student feedback UI.
- No exposure of hidden scenario internals to students.
- No rewrite of `/api/arena/evaluate`; only the evaluator called behind that API changes.

## Decisions

- Create `src/features/arena/adapters/types.ts`, `registry.ts`, `cruise-roll-blackbox-adapter.ts`, and `whitebox-transfer-function-adapter.ts`.
  Rationale: the registry becomes the production selection boundary, while test helpers remain visibly test-only.

- Keep budgeted black-box experiment creation in `createArenaBlackBoxExperiment`.
  Rationale: budget, persistence, deterministic dataset hash, and ownership already live there; the adapter should delegate to this service rather than reimplement policy.

- Keep virtual preview creation in `createArenaVirtualSimulationPreviewRun`.
  Rationale: preview already validates dataset ownership and stores preview runs; registry adoption should not loosen that check.

- Implement hidden official evaluation as a pure evaluator module plus scenario-set metadata.
  Rationale: scoring needs deterministic tests and cacheable evaluation results; scenario details should be testable internally without becoming student-facing payload.

- Store `scenarioSetId` inside `ArenaEvaluationResult` metadata if a schema-neutral extension is feasible; otherwise add a minimal nullable `scenarioSetId` column to `ArenaEvaluationRun`.
  Rationale: later reporting needs to distinguish hidden official scoring from legacy template scoring, but a Prisma migration should be avoided unless the result payload cannot carry the data cleanly.

- Do not make workbench contracts import adapter or evaluator modules.
  Rationale: `src/features/control-workbench/contracts/` must remain React-free, Prisma-free, and server/client safe.

## Risks / Trade-offs

- [Risk] Introducing the registry could accidentally bypass budget or ownership checks. → Mitigation: route the adapter through existing services and add route-level tests that assert service/store calls still happen.
- [Risk] Hidden scenario metrics could leak scenario details in student explanations. → Mitigation: expose aggregate metric names and Chinese feedback only; keep scenario ids internal or coarse.
- [Risk] Evaluation cache could reuse legacy `blackbox-v1` results. → Mitigation: make `blackbox-official-v1` the protocol version for default black-box official evaluation and test cache separation.
- [Risk] Scenario simulation formulas may become another template estimate. → Mitigation: define scenario inputs and a deterministic closed-loop replay path, then test multiple parameter sets against expected relative outcomes.

## Migration Plan

1. Add registry and production adapters without changing API behavior.
2. Switch black-box experiment and virtual preview APIs to registry-backed calls.
3. Add hidden official evaluator and protocol version.
4. Switch black-box official submissions to the new evaluator.
5. Verify old persisted `blackbox-v1` evaluation rows are not reused for `blackbox-official-v1`.
6. Rollback path: restore the protocol selector to `blackbox-v1` and keep the registry path for public experiments if it remains green.

## Open Questions

- Whether `scenarioSetId` should live only in the evaluation result payload or be promoted to a Prisma column during implementation.
- Whether the first hidden scenario set should support only `plant-cruise-roll-blackbox` or include an adapter interface ready for future black-box objects.
