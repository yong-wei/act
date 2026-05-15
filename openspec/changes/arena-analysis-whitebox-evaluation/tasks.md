## 1. Preflight

- [ ] 1.1 Confirm `arena-evaluation-protocol-hardening` is applied or manually verify that provider/protocol selection is already centralized.
- [ ] 1.2 Run the current Arena white-box tests to capture the pre-change baseline.
- [ ] 1.3 Identify the server-callable control-analysis path that can compute `ControlAnalysisResult` without relying on browser worker state.

## 2. Analysis Service

- [ ] 2.1 Add `src/features/arena/evaluation/control-analysis-service.ts` with a `ControlAnalysisService` interface.
- [ ] 2.2 Implement the default service using the smallest deterministic server-safe control-analysis path.
- [ ] 2.3 Add service tests or fixtures proving the service returns stable `ControlAnalysisResult` for a simple second-order model.

## 3. Analysis Provider

- [ ] 3.1 Implement an analysis-backed white-box metric provider for `pid` and `serial-compensator`.
- [ ] 3.2 Use `buildArenaControlAnalysisRequest` to construct analysis requests for supported artifacts.
- [ ] 3.3 Use `extractMetricsFromAnalysisResult` to derive official metrics and source metadata.
- [ ] 3.4 Reject or explain unavailable required metrics instead of converting them to zero.
- [ ] 3.5 Keep unsupported methods on the existing template provider.

## 4. Async Evaluation Path

- [ ] 4.1 Convert `evaluateArenaSubmission` to return `Promise<ArenaEvaluationResult>`.
- [ ] 4.2 Convert `evaluateWhiteBoxSubmission` to await the selected provider when required.
- [ ] 4.3 Update `createPersistedArenaSubmission` to await official evaluation before writing `ArenaEvaluationRun`.
- [ ] 4.4 Update `/api/arena/evaluate` route tests and persistence tests for async evaluation.

## 5. Protocol and Cache Isolation

- [ ] 5.1 Switch protocol selection for `pid` and `serial-compensator` white-box tasks to `analysis-whitebox-v1`.
- [ ] 5.2 Keep `composite-compensation`, `optimized-pid`, and `mpc` on `template-whitebox-v1`.
- [ ] 5.3 Add cache reuse tests proving identical artifacts reuse only within the same protocol version.
- [ ] 5.4 Verify old template cached results do not satisfy new analysis protocol lookups.

## 6. Coverage

- [ ] 6.1 Add analysis-backed official evaluation tests for a second-order task.
- [ ] 6.2 Add analysis-backed official evaluation tests for an integrator task.
- [ ] 6.3 Add analysis-backed official evaluation tests for an unstable-object stabilization task.
- [ ] 6.4 Add tests for missing/non-finite analysis metrics.
- [ ] 6.5 Add tests documenting derived control-effort labeling.

## 7. Verification

- [ ] 7.1 Run targeted Arena evaluation tests.
- [ ] 7.2 Run targeted control-analysis service tests.
- [ ] 7.3 Run `/api/arena/evaluate` route tests.
- [ ] 7.4 Run `npm run lint`.
- [ ] 7.5 Record numerical tolerances and any unrelated existing failures.
