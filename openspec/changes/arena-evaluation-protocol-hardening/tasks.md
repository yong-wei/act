## 1. Provider and Protocol Truth

- [x] 1.1 Replace the async `WhiteBoxMetricProvider` with a synchronous provider interface carrying `id` and `protocolVersion`.
- [x] 1.2 Implement `createHeuristicWhiteBoxMetricProvider` so `estimateMetrics` is only called inside the provider.
- [x] 1.3 Implement `selectWhiteBoxMetricProvider(method)` for all current white-box template methods.
- [x] 1.4 Update `evaluateWhiteBoxSubmission` to call the selected provider and remove the unused local provider variable.
- [x] 1.5 Update `getArenaEvaluationProtocolVersion` to read provider protocol for white-box methods and keep black-box/code-controller protocol branches isolated.

## 2. Protocol Tests and Documentation

- [x] 2.1 Add protocol tests covering `pid`, `serial-compensator`, `composite-compensation`, `optimized-pid`, `mpc`, `black-box-control`, and `code-controller`.
- [x] 2.2 Add white-box evaluator tests proving the evaluator obtains metrics through the selected provider path.
- [x] 2.3 Update Arena execution/review docs to state that `analysis-whitebox-v1` is reserved and current white-box official evaluation is template heuristic.

## 3. Legacy Leaderboard Policy

- [x] 3.1 Extend Arena submission listing options with `includeLegacyProtocols?: boolean`.
- [x] 3.2 Change default submission listing to exclude `whitebox-v1` rows.
- [x] 3.3 Add tests for default legacy exclusion and explicit legacy inclusion.
- [x] 3.4 Ensure returned records preserve enough protocol metadata for future legacy labeling or separation.

## 4. Black-box Adapter Boundary

- [x] 4.1 Identify production call sites for `createCruiseRollBlackBoxAdapter`.
- [x] 4.2 Remove random dataset generation from production-named adapters or rename it to a test-only mock.
- [x] 4.3 Ensure production black-box experiment creation uses `createArenaBlackBoxExperiment` with budget, persistence, deterministic hash, and ownership validation.
- [x] 4.4 Update black-box adapter and experiment tests for budget exhaustion, foreign dataset rejection, and legal dataset submission.

## 5. Telemetry and Module Boundaries

- [x] 5.1 Consolidate Arena core event type definitions into one source imported by telemetry and dictionary consumers.
- [x] 5.2 Add `src/features/arena/domain.ts`, `src/features/arena/client.ts`, and `src/features/arena/server.ts`.
- [x] 5.3 Move touched UI imports to `@/features/arena/domain` or `@/features/arena/client`.
- [x] 5.4 Move touched API/server imports to `@/features/arena/server` or direct server module paths.
- [x] 5.5 Add a lightweight import-boundary test or static check covering client/server entrypoint separation.

## 6. Verification

- [x] 6.1 Run targeted Arena unit tests for white-box evaluation, protocol selection, black-box experiment ownership, Prisma store listing, telemetry analytics, and workbench context.
- [x] 6.2 Run the relevant route tests for `/api/arena/evaluate` and black-box experiments.
- [x] 6.3 Run `npm run lint`.
- [x] 6.4 Run `npm run test -- --run src/features/arena`.
- [x] 6.5 Record any unrelated existing failures separately from this change.
