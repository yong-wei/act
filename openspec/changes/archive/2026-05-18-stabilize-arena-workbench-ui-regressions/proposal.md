## Why

The previous comprehensive simulation workbench fixes were archived, but the current Arena and free-exploration UI still has visible regressions: time-domain curves remain flattened, curve selectors do not reliably affect rendered series, panel configuration is split across layout and panel surfaces, and the challenge leaderboard and official submission modules still do not present enough compact student-facing evidence.

This change exists as a follow-up stabilization pass. The important new investigation result is that the time-domain y-axis problem is not primarily a data-range calculation failure: the code already computes a visible-curve range, but the shared Cartesian pan/zoom installer applies an equal-aspect constraint that is appropriate for root-locus and Nyquist plots and inappropriate for time-domain response plots.

## What Changes

- Fix time-domain response auto-ranging so the default vertical range is driven by visible reference/output curves with about 10% margin and is not expanded by equal-aspect Cartesian constraints.
- Make time-domain and Bode curve controls authoritative: toggling a curve must immediately add or remove the rendered series, without stale ECharts series remaining in the chart.
- Keep view-specific configuration inside each panel header and leave the layout/composition area responsible only for panel presence, order, and reset actions.
- Add a Nyquist source switch equivalent to the root-locus uncorrected/corrected source switch.
- Keep chart panel wrappers dimensionally stable when root-locus, Nyquist, time-domain, or Bode source controls are toggled.
- Replace simulated parameter-drawer labels with stable native tab behavior so object and correction tabs keep consistent size and active-state coloring in light and dark themes.
- Improve official submission feedback so current actual metrics update before submission, use compact two-column layout, compare target and actual values together, and explain valid zero-score results in Chinese.
- Restyle challenge leaderboard detail tables with main/method/metric board switching, optional child-board selectors, compact name plus student number display, horizontal scrolling for wide tables, no redundant method column inside a selected method board, and concrete metric values in metric boards.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `control-workbench-view-configuration`: Strengthens time-domain auto-range behavior, chart series replacement behavior, panel-local configuration, Nyquist source switching, and chart-wrapper size stability.
- `arena-official-evaluation-consistency`: Strengthens dynamic target/actual metric comparison, compact official metric presentation, and Chinese valid-zero-score explanation.
- `arena-challenge-leaderboard-browser`: Strengthens leaderboard detail table layout, board switching, method/metric child board behavior, and row field display.
- `arena-workbench-correction-controls`: Strengthens parameter drawer tab semantics, native tab behavior, and stable active-state styling.

## Impact

- Expected frontend impact in `src/features/interactive/multi-representation-linkage/page-client.tsx`, `model.ts`, and `arena-submit-panel.tsx`.
- Expected chart impact in `src/resources/control-system/charts/control-analysis-panels.tsx`, `control-chart-panel.tsx`, and related Bode/Nyquist option builders.
- Expected Arena leaderboard impact in `src/features/arena/**` challenge detail and leaderboard presentation modules.
- Expected test impact in existing interactive chart and Arena tests, plus a browser verification path for `task-second-order-lead-pid`.
- No intended change to official scoring formulas, hard-threshold definitions, leaderboard ranking semantics, or persistence schema.
