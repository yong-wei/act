## Why

Arena official white-box ranking cannot remain a heuristic estimate if it is expected to serve as the control-design authority for students, homework, and leaderboards. After the protocol hardening change separates template evaluation from future analysis evaluation, this change introduces the first real `ControlAnalysisResult`-based official white-box evaluation path.

## What Changes

- Add a server-side control-analysis service facade that computes `ControlAnalysisResult` for supported Arena transfer-function tasks.
- Convert Arena official evaluation and persisted submission creation to await analysis-backed evaluation where needed.
- Enable `analysis-whitebox-v1` only for `pid` and `serial-compensator` artifacts whose tasks expose a white-box transfer-function model.
- Keep composite compensation, optimized PID, MPC templates, black-box control, and code-controller artifacts on their existing non-analysis protocols.
- Convert supported controller artifacts to `ControlAnalysisRequest` using the existing Arena request builder.
- Extract metrics from `ControlAnalysisResult` with explicit source semantics, including overshoot, settling time, steady-state error, phase margin, gain margin, bandwidth, ITAE, and derived control-effort proxy.
- Prevent unavailable or non-finite analysis metrics from silently becoming zero in official scoring.
- Add focused tests for second-order, integrator, and unstable-object tasks.

## Capabilities

### New Capabilities

- `arena-analysis-whitebox-evaluation`: Arena official white-box evaluation can use server-side `ControlAnalysisResult` for supported PID and serial-compensator submissions.
- `arena-analysis-metric-sources`: Arena official metrics must carry or preserve source semantics so analysis values, derived values, and unavailable values are distinguishable during scoring and debugging.

### Modified Capabilities

- None. This repository currently has no active baseline specs under `openspec/specs/`.

## Impact

- `src/features/arena/evaluation/evaluator.ts`
- `src/features/arena/evaluation/whitebox-evaluator.ts`
- `src/features/arena/evaluation/whitebox-metric-provider.ts`
- `src/features/arena/evaluation/protocol.ts`
- `src/features/arena/evaluation/controller-to-analysis-request.ts`
- `src/features/arena/evaluation/metric-extraction.ts`
- New `src/features/arena/evaluation/control-analysis-service.ts`
- `src/features/arena/submissions/persistence.ts`
- `src/app/api/arena/evaluate/route.ts`
- `src/resources/control-system/analysis/*` server-callable analysis boundary
- Arena white-box and persistence tests
