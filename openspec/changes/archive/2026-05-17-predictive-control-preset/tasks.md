## 1. Predictive Preset

- [x] 1.1 Add a predictive-control preset module under `src/features/control-workbench/presets/`.
- [x] 1.2 Add a bounded MPC parameter panel.
- [x] 1.3 Add an optimized PID objective-weight panel.
- [x] 1.4 Add views for trajectory or template preview, control/constraint summary, and official-only metrics.

## 2. Artifact And Submission

- [x] 2.1 Generate `mpc` artifacts from MPC draft state.
- [x] 2.2 Generate `optimized-pid` artifacts from optimization draft state.
- [x] 2.3 Submit both methods through the unified submission panel and `/api/arena/evaluate`.

## 3. Verification

- [x] 3.1 Add artifact mapping tests for both predictive templates.
- [x] 3.2 Add tests that official-only hidden metrics are not displayed as local preview values.
- [x] 3.3 Run Arena controller artifact and evaluator targeted tests.
