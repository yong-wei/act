## 1. Baseline and ownership

- [ ] 1.1 Verify clean `a3e6ce7435503050146cadeae6359d6b8eb9a2a5`, tree identity, charter/dependency-contract inputs, and re-enumerate the nine raw business loaders, including Unit 5-5 `rl-training-runtime.ts`.
- [ ] 1.2 Freeze the raw-business-loader, generated-artifact, Rust source/test, route/API, and direct/reverse caller denominators; distinguish product, test, generated, and compatibility imports, and keep the Unit 5-5 runtime outside facade/build exceptions.
- [ ] 1.3 Record owner and hard/contract/soft/delete classification for each loader and each generated artifact; define the R6 retirement handoff without deleting entries.

## 2. Shared façade and lifecycle

- [ ] 2.1 Define versioned request, response, capability, runtime identity, `executor`, `authoritySource`, `modelRelation`, teaching semantics, and error-state contracts for client, worker, and server execution.
- [ ] 2.2 Implement the single client/worker/server façade boundary and ensure only its adapters/build script import generated control-engine modules.
- [ ] 2.3 Implement ready/error/timeout/unavailable transitions, request cancellation or stale-result rejection, and fixed-step pause when WASM is not ready; make browser/worker output display-only and server output the only persistence authority.
- [ ] 2.4 Route `/api/arena/virtual-simulation-runs` validation, Rust recompute, trace/summary derivation, checksum calculation, and preview write through the server façade; reject client `trace`/`summary`/`checksum` before execution.
- [ ] 2.5 Characterize `useControlEngine` `fallbackResult` as non-authoritative and prevent it from entering caches, runs, evaluation, evidence, or leaderboard inputs.

## 3. Rust and generated identity

- [ ] 3.1 Freeze current Rust exports/model ids and add internal analysis/controllers/simulation/constraints/metrics boundaries without a crate-wide rewrite.
- [ ] 3.2 Extend the WASM build identity check to bind Rust source, Cargo lock, toolchain, generated JS/types/WASM and export manifest.
- [ ] 3.3 Reject partial or hand-edited generated packages and document the build-script-only regeneration path.

## 4. Vertical slice and verification

- [ ] 4.1 Migrate and verify the generic-analysis hook/worker/server vertical slice against the shared facade while preserving current result shape.
- [ ] 4.2 Add client, worker, server, stale request, timeout, missing package, non-finite result, and fallback provenance tests, including browser display-only and server-only virtual-preview persistence.
- [ ] 4.3 Add acceptance tests for tampered client preview fields, identity not participating in computation, fixed surrogate claiming identified model, and identified capability requests without authorized model parameters.
- [ ] 4.4 Add Rust property/baseline/absolute-relative tolerance tests for representative analysis and simulation requests; avoid full-array exact snapshots.
- [ ] 4.5 Add static architecture tests proving business consumers (including Unit 5-5 RL training) do not import generated modules and that no TypeScript numerical fallback is introduced.
- [ ] 4.6 Run focused facade/Rust tests, `rtk npm run wasm:build:control-engine`, `rtk npm run typecheck`, strict OpenSpec validation, and `git diff --check`; record pre-existing failures separately.

## 5. Handoff and rollback

- [ ] 5.1 Publish the facade identity, capability matrix, caller inventory, fallback semantics, and generated-artifact receipt for R2-R5.
- [ ] 5.2 Document rollback to the prior generated package and preserve all historical SimulationRun/Arena evidence unchanged.
- [ ] 5.3 Confirm no route, Prisma model, course manifest, scoring rule, leaderboard policy, deployment selector, or production state changed.
