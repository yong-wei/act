## Context

The hardening change keeps current white-box evaluation on `template-whitebox-v1` and makes the provider/protocol boundary honest. This follow-up introduces the first analysis-backed official Arena evaluation path. Existing code already has several pieces:

- `buildArenaControlAnalysisRequest` can convert PID and serial-compensator artifacts into `ControlAnalysisRequest`.
- `extractMetricsFromAnalysisResult` can read a `ControlAnalysisResult` and mark metric sources.
- `createPersistedArenaSubmission` is already async, so awaiting official evaluation is viable.

The missing piece is a server-side facade that can compute `ControlAnalysisResult` without trusting client-reported preview metrics.

## Goals / Non-Goals

**Goals:**

- Enable `analysis-whitebox-v1` only for supported PID and serial-compensator Arena tasks.
- Compute official metrics from server-side control analysis results.
- Keep template protocols active for unsupported white-box families.
- Preserve artifact-hash and protocol-version cache isolation.
- Treat unavailable or non-finite metrics as invalid or unavailable instead of zero.

**Non-Goals:**

- Do not implement analysis-backed composite compensation, optimized PID, or MPC.
- Do not rewrite the control-analysis engine.
- Do not let client preview metrics become official metrics.
- Do not change black-box evaluation.

## Decisions

### Decision: Add a server-side `ControlAnalysisService` facade

Create `src/features/arena/evaluation/control-analysis-service.ts` with a narrow interface:

```ts
export interface ControlAnalysisService {
  compute(request: ControlAnalysisRequest): Promise<ControlAnalysisResult>;
}
```

The default service can call the existing TypeScript/Rust-backed analysis runtime if it is server-callable. If not, the implementation should add the smallest server-safe adapter around the same deterministic calculation path used by the worker.

Alternative considered: run the browser worker from the server. That is fragile and couples official evaluation to a client runtime.

### Decision: Make official evaluation async

`evaluateArenaSubmission` and `evaluateWhiteBoxSubmission` should return promises once analysis providers are introduced. `createPersistedArenaSubmission` already awaits ownership checks and storage, so the API route does not need a major shape change.

### Decision: Protocol switch is method-specific and conservative

Only `pid` and `serial-compensator` switch to `analysis-whitebox-v1`. `composite-compensation`, `optimized-pid`, and `mpc` remain on `template-whitebox-v1` until equivalent analysis semantics exist.

### Decision: Source-aware metrics are flattened only at the scoring boundary

The analysis provider should keep metric source information internally and flatten to numeric scoring metrics only after validation. Missing metrics must not become zero. A required ranking metric that is unavailable should fail evaluation with a clear hard-constraint or input error.

## Risks / Trade-offs

- [Risk] Server-side analysis may not match worker output exactly. → Add fixture tests for representative tasks and document any tolerated numerical precision.
- [Risk] Async evaluation changes many tests. → Update persistence and route tests in one pass and keep black-box/code-controller behavior unchanged.
- [Risk] Analysis metrics may lack a true control-energy signal. → Mark control effort as derived and do not present it as direct actuator energy unless the engine supplies actuator output.
- [Risk] Switching protocol invalidates cached evaluation reuse. → This is intended; `ArenaEvaluationRun` already keys by protocol version.

## Migration Plan

1. Add the control-analysis service interface and default implementation.
2. Implement analysis provider for PID and serial-compensator.
3. Convert evaluator and persistence call sites to await official evaluation.
4. Switch protocol mapping for supported methods.
5. Add tests covering second-order, integrator, and unstable objects.
6. Keep template provider tests for unsupported methods.

Rollback can switch the provider selector back to template provider for all white-box methods, which returns protocol selection to `template-whitebox-v1` and avoids reusing analysis-protocol cached results.

## Open Questions

- Which existing analysis runtime path is most appropriate for server execution: direct TypeScript analysis, Rust/WASM server adapter, or a small deterministic service wrapper?
- Should analysis metric source metadata be persisted in `ArenaEvaluationRun.metrics`, or only used during validation and explanation?
