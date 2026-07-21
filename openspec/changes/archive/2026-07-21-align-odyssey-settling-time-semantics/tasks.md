## 1. Regression Tests

- [x] 1.1 Add a focused deterministic test proving that P Level 5 with `Kp=1.6` reports the existing 2.8-second settling time independently of the 3000-meter completion duration.
- [x] 1.2 Add user-facing copy assertions that challenge criteria and result summaries label `settlingTime` as `调节时间` and do not label it as `通关时间`.

## 2. Terminology Alignment

- [x] 2.1 Replace maintained Odyssey and Arena-facing descriptions that conflate `settlingTime` with completion time, while retaining the machine-facing telemetry field.
- [x] 2.2 Confirm the implementation leaves route distance, 2.8-second and 9-second thresholds, score calculation, credits, unlocks, and submission behavior unchanged.

## 3. Verification

- [x] 3.1 Run the focused Odyssey unit and integration tests covering telemetry, challenge criteria, and result presentation.
- [x] 3.2 Run strict OpenSpec validation for `align-odyssey-settling-time-semantics` and review the final diff for proposal-only scope.
