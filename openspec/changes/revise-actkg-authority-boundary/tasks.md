## Series Dependencies

- Depends on: none (series root).

## 1. Boundary contract

- [ ] 1.1 Inventory existing Authority, CourseCoverage, canonical binding, KAQ, ReleaseSet, and selector readers; document the current global-blocking paths.
- [ ] 1.2 Define typed Authority, Teaching Projection, consumer, and legacy-audit states with stable identities and fail-closed unknown-state handling.
- [ ] 1.3 Add a decision table proving valid Bundle + empty teaching scope activates Authority, while integrity failures block all selectors.
- [ ] 1.4 Replace the declared snapshot candidate-only/prod-blocking rule and the Aggregate/profile-only full-denominator rule with explicit Authority activation and ACT-scope semantics.

## 2. Legacy audit freeze

- [ ] 2.1 Materialize the exact 34-batch/4,891-member legacy audit manifest with 11 `INCLUDE`, 4,880 `DEFER`, strategy version, capture revision, and SHA-256 digest.
- [ ] 2.2 Add immutable-read and tamper tests; verify the manifest cannot write Authority, Repository, CourseCoverage, or consumer selector state.

## 3. Contract deltas and selectors

- [ ] 3.1 Replace exhaustive Release denominator and global CourseCoverage blocking with ACT resource/core-node scope in the overlay and review contracts.
- [ ] 3.2 Scope canonical resource/KAQ gates to affected consumer packages and preserve Legacy/pinned fallback until local readiness passes.
- [ ] 3.3 Update declared snapshot status and diagnostics to expose independent Authority and teaching dependencies.

## 4. Verification

- [ ] 4.1 Add deterministic fixtures for empty projection, unresolved local binding, unprojected upstream nodes, valid Authority, and integrity drift.
- [ ] 4.2 Run focused contract/unit tests and `rtk openspec validate revise-actkg-authority-boundary --type change --strict`.
- [ ] 4.3 Run `rtk openspec validate --changes --strict` and record any unrelated pre-existing failures without widening this change.
