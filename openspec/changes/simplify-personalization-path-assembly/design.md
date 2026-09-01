## Context

The canonical Personalization path surface already includes `path-planning/public-api.ts`, `application/plan-learning-path.ts`, ports, goal registration, and the `PlanLearningPath` pipeline. At the current HEAD, the application wrapper delegates to default ports but `internal/assemble-plan.ts` still owns a broad set of types, goal definitions/validation, cold-start adaptation, candidate filtering, hard eligibility, ranker integration, prerequisite/constraint repair, path-node assembly, policy bundles, visualization, explanation, serialization, and feedback state.

The measured implementation is 250,111 bytes and 6,182 lines. It imports legacy-looking helper paths under `src/lib` in the current tree; C2 must first establish their canonical Personalization ownership. Existing tests include `src/features/personalization/path-planning/__tests__/assemble-plan.test.ts`, `plan-learning-path.test.ts`, `control-correction-real-seed-planner.test.ts`, `prerequisite-planner.test.ts`, and path behavior tests under `src/lib/__tests__`.

The existing `personalization-path-planning-pipeline` and `adaptive-learning-path-planning` specs already define the single use case, seven-stage boundary, hard-before-soft ordering, plugin policy, deterministic Stage 1 behavior, path history, evidence, and terminal-validation semantics. This change does not restate or redesign those contracts.

## Goals / Non-Goals

**Goals:**

- Make the canonical use case easier to understand and maintain while preserving exact behavior.
- Remove duplicated normalization, guards, candidate filters, repair state, one-strategy wrappers, and explanation/serialization conversions where characterization proves equivalence.
- Keep a single entrypoint and produce a measurable net decline in production bytes and semantic concepts.
- Report before/after exports, functions, states, guards, validators, dependencies, tests, and bytes so a reviewer can distinguish simplification from file shuffling.

**Non-Goals:**

- Add a planner, ranking strategy, candidate store, goal registry, event bus, or second path schema.
- Change ranking weights, eligibility policy, prerequisite semantics, terminal-validation policy, fallback status, error text/shape, or user-facing path content.
- Move ownership, migrate Assessment/Learning Record data, change persistence, or modify production release state.
- Delete a guard protecting identity, authorization, privacy, evidence provenance, immutable revision, or numerical/path safety.

## Decisions

1. **C2 is a hard predecessor.** Do not simplify `assemble-plan.ts` or `src/lib/adaptive-planning/*` until C0/C1/C2 record the canonical Personalization owner and zero legacy business entrypoints. This avoids optimizing code that is still scheduled for deletion.
2. **Characterization precedes `code-simplification`.** Freeze representative ready, fallback, low-resource, plugin-unavailable, cold-start, completed-node, terminal-validation, policy-bundle, retry, and serialization/feedback cases using the existing tests. The skill call receives the invariant list, trust boundaries, target files, deletion set, and baseline metrics.
3. **Preserve pipeline stage order.** Normalize and load context once; apply hard eligibility before soft ranking; repair only once against the ranked candidate set; assemble the result once; derive explanation, visualization, and serialized projections from the same result. Internal helper names may change, but the public use case remains singular.
4. **Measure semantics, not only files.** Capture production bytes/LOC, public exports, function count, state variants, guards, validators, duplicate conversions, dependencies, and test count before and after. A split that keeps or increases bytes/concepts, exports a second authority, or adds a wrapper fails the acceptance condition.
5. **Review simplification separately.** Run focused regression tests after each bounded pass, then typecheck/lint and the repository's Ponytail staged review before independent review. Reject any “simplification” that changes behavior or weakens a boundary.

## Risks / Trade-offs

- [A normalization or fallback branch is removed as redundant but serves a rare path] → preserve characterization for error, empty, stale, partial, plugin-unavailable, and terminal-missing cases; keep the guard unless equivalence is demonstrated.
- [Path output remains equivalent but explanation/provenance changes] → compare serialized plans, explanations, source refs, version refs, and privacy projections byte/structure-wise for representative fixtures.
- [Files are split without reducing conceptual complexity] → require production byte and semantic-inventory net decline; stop and record the shortfall instead of claiming success.
- [Helper relocation reintroduces cross-domain or `src/lib` business imports] → rerun architecture fitness and exact owner/import scans after each pass.

## Migration Plan

1. Consume C0–C2 evidence and record the exact canonical path-planning files and deletion boundary.
2. Capture baseline metrics and run existing characterization tests without modifications.
3. Invoke `code-simplification` with the bounded target and invariants; apply one simplification pass at a time.
4. Re-run direct path tests after each pass, then compare behavior, exports, state/guard inventories, dependencies, bytes, and tests.
5. Run related path route/contract tests, typecheck, lint, architecture fitness, and Ponytail review; retain the successful measurement as the stable checkpoint.
6. Rollback by restoring the last passing implementation revision if any behavior or net-reduction condition fails. Do not reintroduce a retired planner or add a compatibility facade.

## Open Questions

- Which internal helper grouping gives the largest conceptual reduction while retaining the existing public export set and test seams?
- Can explanation/visualization/serialization share one immutable assembled result without changing any student-safe redaction or revision metadata?
