## 1. Chart Range and Series Behavior

- [x] 1.1 Add a focused regression test showing that the time-domain auto y-range is not expanded by equal-aspect Cartesian constraints.
- [x] 1.2 Split shared Cartesian pan/zoom installation so time-domain panels opt out of equal-aspect enforcement while root-locus and Nyquist keep it.
- [x] 1.3 Reset or recompute preserved time-domain y-ranges when visible signals, selected object, response type, or analysis identity changes.
- [x] 1.4 Make time-domain curve toggles remove deselected rendered series and tooltip state.
- [x] 1.5 Make Bode curve toggles remove deselected magnitude and phase series without leaving stale ECharts state.

## 2. Panel-Local Controls and Stable Layout

- [x] 2.1 Remove remaining time-domain, Bode, root-locus, and Nyquist view-specific configuration boxes from the layout/composition panel.
- [x] 2.2 Ensure each panel header exposes the configuration controls that apply to that panel instance.
- [x] 2.3 Add a Nyquist uncorrected/corrected source switch when both sources are available.
- [x] 2.4 Stabilize chart panel wrapper dimensions so source and curve toggles do not change surrounding module height.

## 3. Parameter Drawer Tabs

- [x] 3.1 Replace simulated object/correction labels with native tab semantics or the repository's native tab component.
- [x] 3.2 Keep object and correction tab sizing, spacing, truncation, and active-state coloring stable across object, correction, and structure switches.
- [x] 3.3 Verify light and dark theme tab states remain distinct for active, inactive, hover, and focus states.

## 4. Official Submission Feedback

- [x] 4.1 Display current actual metric estimates in the official submission module before the student clicks submit.
- [x] 4.2 Compact current metric rows into a two-column or equivalently space-efficient layout that compares actual values with targets or thresholds.
- [x] 4.3 Keep official result rows, hard-constraint labels, valid zero-score explanation, and unavailable states in Chinese.
- [x] 4.4 Distinguish current preview metrics from persisted official submission results without changing scoring semantics.

## 5. Leaderboard Detail Tables

- [x] 5.1 Keep main, method, and metric board controls visible below the leaderboard summary and drive a dynamic detail table from the selected board.
- [x] 5.2 Add method and metric child-board selectors when multiple sub-boards are available.
- [x] 5.3 Restyle rows so name and student number share one compact identity cell, wide metric sets scroll horizontally, and selected method boards omit redundant method columns.
- [x] 5.4 Show concrete selected metric values in metric board rows with challenge metric labels and unit formatting when available.

## 6. Validation

- [x] 6.1 Run targeted chart and Arena unit/source tests covering time-domain range, series replacement, panel-local controls, official metrics, and leaderboard tables.
- [x] 6.2 Run lint or the closest scoped validation required by the touched files.
- [x] 6.3 Perform a browser check on the second-order challenge workbench, including time-domain y-range, curve toggles, Nyquist switch, official metrics, drawer tabs, and leaderboard table behavior.
