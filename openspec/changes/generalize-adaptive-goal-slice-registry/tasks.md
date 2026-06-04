## 1. Registry Contract

- [ ] 1.1 Define the adaptive goal-slice registry data contract and ownership boundary.
- [ ] 1.2 Register `control-correction` using its existing canonical dimensions, target levels, privacy classes, confidence policy, and evidence requirements.
- [ ] 1.3 Document how future course goals declare path, report, Konling, and grading eligibility without custom forks.

## 2. Learner-State Integration

- [ ] 2.1 Route goal-specific learner-state reads through the registry where feasible.
- [ ] 2.2 Return explicit unsupported, missing, stale, or low-confidence states for absent goal metadata.
- [ ] 2.3 Preserve existing general learner-state payload compatibility when no goal is requested.
- [ ] 2.4 Preserve registered control-correction active path context, recent path rounds, terminal validation state, and no-active-path state for downstream path consumers.

## 3. Verification

- [ ] 3.1 Add tests for registered `control-correction` parity.
- [ ] 3.2 Add tests that unknown goals and undeclared dimensions fail closed.
- [ ] 3.3 Add tests that field-family metadata declares value range, source families, privacy, confidence, and fallback behavior.
- [ ] 3.4 Add compatibility tests proving registry filtering does not remove active path context, terminal validation state, recent path references, or explicit no-active-path state.
- [ ] 3.5 Run `rtk openspec validate generalize-adaptive-goal-slice-registry --strict`.
