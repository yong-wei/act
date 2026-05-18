## Why

The comprehensive simulation workbench has several visible regressions: official submission feedback no longer compares targets with actual metrics, a valid submission can show score `0` without explaining the scoring reason, English evaluator notes leak into student-facing text, chart legends and curve styles drift apart, and some view configuration still lives in the layout shell instead of the panel itself.

## What Changes

- Restore official submission feedback that compares target or threshold metrics with actual metrics and status colors.
- Explain valid-but-zero-score outcomes in Chinese without changing the official scoring formula.
- Remove raw English evaluator notes from student-facing official submission results.
- Centralize signal and curve style presets so chart series, selector swatches, and legends read from the same constants.
- Move time-domain and Bode configuration into panel-local controls that act as legends; remove chart-area legends for those panels.
- Keep root-locus source switching behavior, and align Nyquist with single-source selection.
- Compute time-domain vertical range from visible finite curves with approximately 10% margin and no forced aspect ratio.
- Repair parameter drawer top labels so object and correction labels remain stable and theme-aware when clicked or switched.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `arena-official-evaluation-consistency`: Adds student-facing target/actual/status comparison and valid-zero-score explanation.
- `control-workbench-view-configuration`: Strengthens chart style, panel-local configuration, time-domain auto-range, Bode legend-as-control, and Nyquist source-switching requirements.
- `arena-workbench-correction-controls`: Strengthens drawer label stability and active-state color requirements.

## Impact

- Expected impact in `src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx`.
- Expected impact in `src/features/control-workbench/shell/control-workbench-shell.tsx` and `src/features/control-workbench/views/*`.
- Expected impact in `src/resources/control-system/charts/control-analysis-panels.tsx` and Bode/Nyquist option builders.
- May add a shared signal-style module for time-domain, Bode, root-locus, Nyquist, reference, corrected, uncorrected, disturbance, and correction-device curves.
- Does not change official scoring, hard constraints, or persistence semantics.
