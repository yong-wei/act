## 1. Preview inventory and support matrix

- [x] 1.1 Verify R1/R2 identities and clean source revision; freeze preview routes/APIs, models, writers/readers, scripts, tests, and direct/dynamic callers.
- [x] 1.2 Isolate the one real Euler loop in `controller-preview.ts` from formatting, persistence, replay, and boundary code; inventory all white-box preview numerical helpers separately.
- [x] 1.3 Define per-method Control Engine capability, model id, request/result schema, protocol/runtime/model identity, and abs/rel tolerance; mark unsupported methods explicitly.

## 2. Black-box preview vertical slice

- [x] 2.1 Add the Rust model capability for the existing black-box preview plant/controller/wave/metric path while preserving fixed sample cadence and summary keys.
- [x] 2.2 Route preview state stepping through the client facade and remove the TS Euler loop from the active path; keep `SimulationClock` scheduling only.
- [x] 2.3 Preserve datasetHash, controllerHash, registered model, sourceExperiment, seed, checksum, `executor`, `authoritySource`, `modelRelation`, teaching semantics, `prohibitsMixedClaims`, `evaluationVisibility=preview`, and `officialEligible=false` in response and canonical run.
- [x] 2.4 Add WASM-ready/error/unsupported/non-finite tests proving no TS heuristic fallback or stale preview result is persisted.
- [x] 2.5 Enforce browser/worker `persisted=false` display-only output and route `/api/arena/virtual-simulation-runs` persistence through R1 server façade; reject client `trace`/`summary`/`checksum` before execution or writing.

## 3. White-box preview and official boundary

- [x] 3.1 Migrate each supported white-box preview numerical path through the client facade and record its capability/tolerance evidence.
- [x] 3.2 Make unsupported white-box methods return controlled unavailable and ensure preview never implies official support or changes official protocol mapping.
- [x] 3.3 Reject hidden model/scenario/reference inputs in client preview payloads and preserve server-only official evaluator boundaries.
- [x] 3.4 Add route/store/evidence tests proving preview writes no `ArenaSubmission`, `ArenaEvaluationRun`, leaderboard row, or formal capability attainment; assert server-derived executor/authority source and checksum.
- [x] 3.5 Add acceptance tests for tampered client preview fields, identity not participating in computation, fixed surrogate claiming identified model, and identified capabilities without authorized parameters consumed by Rust.

## 4. No-facade proof and verification

- [x] 4.1 Add static guards for direct generated-module imports and old TS numerical helpers in active Arena preview callers.
- [x] 4.2 Add Rust property/baseline/abs-rel tolerance tests for fixed-step trace invariants, summary metrics, constraints, finite values, identity participation, and checksum metadata without full-array exact snapshots.
- [x] 4.3 Run Arena preview/adapter/replay/profile/evidence/route tests, client façade tests, Rust/WASM build, typecheck, strict OpenSpec, and `git diff --check`.
- [x] 4.4 Publish the support matrix, baseline/tolerance receipt, no-official-write proof, and remaining unsupported methods for R6.

## 5. Rollback

- [x] 5.1 Record capability-level rollback commits and the safe unavailable behavior when the Rust capability or generated package is not ready.
- [x] 5.2 Confirm no Prisma migration, scoring/leaderboard change, historical preview recomputation, deployment, or production selector change.
