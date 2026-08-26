## 1. Server denominator and protocol freeze

- [ ] 1.1 Verify R1/R2 identities and clean source revision; freeze the four server consumer classes, routes/APIs, models, scripts, tests, direct/dynamic callers, and generated package.
- [ ] 1.2 Record `analysis-whitebox-v1`, `template-whitebox-v1`, and `blackbox-official-v1` mappings, cache key fixtures, accepted historical rows, and hidden-input boundaries.
- [ ] 1.3 Confirm Arena evaluator remains independent authority and that client score/trace/params are non-authoritative inputs; include `/api/arena/virtual-simulation-runs` client-field rejection and preview persistence boundary.

## 2. Generic and simulation server migration

- [ ] 2.1 Route `/api/simulation/runs` analysis mode through the typed server façade and preserve auth, context, SimulationRun persistence, and summary semantics.
- [ ] 2.2 Migrate cruise-comfort and icebreaker-robust virtual server consumers through the façade while preserving their SceneSpec, fixed dt, maxSubSteps, and metric denominator.
- [ ] 2.3 Add unavailable/error/timeout tests proving no stale or client result is written when the server runtime is not ready.

## 3. Odyssey and Arena migration

- [ ] 3.1 Migrate Control Odyssey server runtime and `official-simulation.ts` through the façade without changing phase, credit, or `phaseCrossoverStatus` behavior.
- [ ] 3.2 Adapt Arena `ControlAnalysisService` to the façade while keeping task policy, hidden context, metric extraction, hard constraints, score, and persistence inside the Arena evaluator.
- [ ] 3.3 Verify protocol-specific provider selection and prevent `analysis-whitebox-v1`/`template-whitebox-v1`/`blackbox-official-v1` cache mixing.
- [ ] 3.4 Route `/api/arena/virtual-simulation-runs` validation, Rust recompute, trace/summary derivation, checksum, and preview writes through the server façade; browser/worker output remains display-only.
- [ ] 3.5 Add tests that forged client score/trace/params/checksum and preview outputs never enter official evaluation or persistence inputs; assert `executor` and `authoritySource` are server-derived.
- [ ] 3.6 Add tests for identity participation, surrogate `modelRelation`/`prohibitsMixedClaims`, and identified-model claims requiring authorized parameters consumed by Rust.

## 4. No-facade proof and verification

- [ ] 4.1 Add static import/caller graph guards proving the four consumer classes and virtual-preview route have no direct generated-module import or duplicate server initialization.
- [ ] 4.2 Add property/baseline/tolerance tests for analysis/simulation summaries, cache identity, protocol fixtures, finite outputs, and historical read-only behavior.
- [ ] 4.3 Run focused route, Arena evaluation, simulation, Odyssey, replay/evidence, Rust/WASM, typecheck, strict OpenSpec, and `git diff --check` validation.
- [ ] 4.4 Publish server façade caller map, protocol/cache receipt, hidden-input proof, and R6 raw-loader deletion candidates.

## 5. Rollback boundary

- [ ] 5.1 Record per-slice rollback commits and confirm old loaders remain available only as bounded compatibility entries until R6.
- [ ] 5.2 Confirm no Prisma migration, historical result recomputation, Arena scoring-rule change, leaderboard mutation, deployment, or production selector change.
