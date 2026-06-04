## 1. Policy Contract

- [ ] 1.1 Define path policy family ids, labels, scoring intents, constraints, and fallback semantics.
- [ ] 1.2 Add planner input/output metadata for selected policy family and multi-policy bundles.
- [ ] 1.3 Preserve current control-correction behavior through a compatibility policy.

## 2. Planner Behavior

- [ ] 2.1 Implement strategy-specific scoring weights or selectors for foundation, simulation-driven, sprint, and teacher-assigned routes.
- [ ] 2.2 Compute path diversity metrics including resource overlap, modality mix, terminal validation, and estimated effort.
- [ ] 2.3 Return explicit low-resource or low-confidence states when distinct paths cannot be produced.

## 3. Verification

- [ ] 3.1 Add planner tests for each policy family.
- [ ] 3.2 Add tests that displayed paths are meaningfully different or report fallback.
- [ ] 3.3 Add tests that privacy, teacher policy, prerequisites, and terminal validation still constrain all policies.
- [ ] 3.4 Run `rtk openspec validate extend-adaptive-path-policy-families --strict`.
