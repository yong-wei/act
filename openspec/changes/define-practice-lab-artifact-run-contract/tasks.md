## 1. Inventory and contract boundary

- [ ] 1.1 Verify clean `a3e6ce743` and the qualified charter/dependency-contract inputs; freeze model, route/API, script, test, writer, reader, and caller denominators.
- [ ] 1.2 Map `ArenaControllerArtifact`, `ArenaEvaluationRun`, `ArenaSubmission`, `ArenaVirtualSimulationRun`, `SimulationTaskSpec`, `SimulationRun`, and `SimulationTrace` to their owner and authority boundaries.
- [ ] 1.3 Inventory Practice live run/outcome and legacy `SimulationSession`/`SimulationLog` accesses without declaring either retired or official.

## 2. Canonical identity envelope

- [ ] 2.1 Define the versioned artifact/run envelope with owner, task/spec/artifact identity, controller snapshot, protocol/runtime/model/controller schema revisions, `executor`, `authoritySource`, `modelRelation`, teaching semantics, `prohibitsMixedClaims`, visibility, seed, checksum, and tolerance profile.
- [ ] 2.2 Implement deterministic canonicalization and validation without adding a second Prisma run schema or copying SceneSpec/Trace definitions.
- [ ] 2.3 Define source mappings for Arena preview, Arena official evaluation/submission, Practice outcome, and standalone SimulationRun; preserve shared Arena evaluation ownership semantics.
- [ ] 2.4 Define public/private projections that exclude black-box hidden inputs, private dataset/model/reference trajectory, raw answers, and high-frequency payloads.

## 3. Preview vertical slice and boundary enforcement

- [ ] 3.1 Adapt the existing Arena preview writer to emit the envelope while preserving `ArenaVirtualSimulationRun` and canonical `SimulationRun` references; require the `/api/arena/virtual-simulation-runs` persistence path to use the R1 server facade.
- [ ] 3.2 Enforce `evaluationVisibility=preview`, `officialEligible=false` for preview and Practice; reject attempts to create `ArenaSubmission`, `ArenaEvaluationRun`, or leaderboard rows from those envelopes.
- [ ] 3.3 Enforce browser/worker `persisted=false` display-only output, server-derived trace/summary/checksum, and rejection of client `trace`/`summary`/`checksum` before execution or writing.
- [ ] 3.4 Enforce surrogate `modelRelation=surrogate`, teaching semantics, and `prohibitsMixedClaims=true`; allow identified claims only after authorized parameters are consumed by the Rust capability.
- [ ] 3.5 Add owner, source mapping, revision drift, seed/checksum, hidden-input, identity-participation, tampered-client-preview, surrogate-claim, and idempotency tests for the preview vertical slice.
- [ ] 3.6 Add static checks proving only one envelope/hasher exists and no consumer creates a parallel run schema or treats `ArenaEvaluationRun` without accepted submission as student evidence.

## 4. Handoff and verification

- [ ] 4.1 Add property and tolerance tests for canonical identity, field ordering, finite summary values, checksum mismatch, replay metadata, executor/authority source, and model relation truthfulness.
- [ ] 4.2 Run Arena/Simulation contract, replay, evidence, persistence, and route tests; keep official scoring tests separate from preview/Practice tests.
- [ ] 4.3 Run `rtk npm run typecheck`, relevant lint/tests, strict OpenSpec validation, and `git diff --check`; record pre-existing failures separately.
- [ ] 4.4 Publish the owner/source mapping and contract identity as the required input for R3-R5, with a rollback receipt and explicit no-DB-migration statement.
