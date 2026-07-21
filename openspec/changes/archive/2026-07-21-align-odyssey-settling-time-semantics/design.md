## Context

The browser runtime and the server-side official simulation both derive `settlingTime` from the active reference step. Measurement starts when the reference changes, enters a candidate state when error is within the configured tolerance, and becomes settled after a 0.5-second dwell. Run victory is independent: the ship completes the level when its world position reaches the tier distance, currently 3000 meters.

Some challenge and documentation copy uses completion-time language for `settlingTime`. That wording conflates the response metric with traversal wall-clock time even though official telemetry, scoring inputs, and the deterministic simulator already use settling-time semantics.

## Goals / Non-Goals

**Goals:**
- Establish one normative meaning for `settlingTime` across Odyssey, Arena-facing descriptions, and tests.
- Present the metric as `调节时间` in Chinese user-facing challenge and result copy.
- Protect the existing challenge calibration with a deterministic regression case.

**Non-Goals:**
- Changing the 3000-meter route or distance-based victory condition.
- Changing the settling-time algorithm, tolerance, dwell duration, thresholds, score formula, credits, or unlock progression.
- Renaming the persisted/API telemetry field `settlingTime`.

## Decisions

### Keep the telemetry contract and measurement algorithm unchanged

`settlingTime` remains the machine-facing field. Browser and official simulations already implement the same reference-step measurement, so changing the field or formula would create migration and score-comparability risk without solving the wording defect.

Alternative considered: redefine the value as full-run elapsed time. Rejected because it contradicts the existing control metric implementation and would make controller-response thresholds depend on route traversal.

### Correct terminology at every human-facing boundary

Challenge criteria, score explanations, result summaries, tooltips, and maintained documentation that describe `settlingTime` will use `调节时间`. Generic timestamps and actual run duration may continue to use `时间`, but must not be labeled as this metric.

Alternative considered: use both `通关时间/调节时间`. Rejected because retaining both names preserves the ambiguity.

### Verify semantics without recalibrating challenge data

Focused tests will assert that the deterministic P Level 5 configuration with `Kp=1.6` produces the existing 2.8-second settling result and that displayed criteria identify it as settling time. Existing 2.8-second and 9-second thresholds and the 3000-meter route remain fixtures rather than values to tune.

## Risks / Trade-offs

- [Risk] A stale copy location may continue to call the metric completion time. -> Search maintained Odyssey and Arena surfaces and add focused copy assertions.
- [Risk] A test tied only to text could miss an accidental metric-formula change. -> Pair copy coverage with deterministic telemetry assertions.
- [Risk] Historical documents may intentionally preserve old wording. -> Update maintained documentation only; do not rewrite archived OpenSpec changes.
