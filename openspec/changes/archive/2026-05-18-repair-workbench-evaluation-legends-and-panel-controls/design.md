## Context

The latest Arena and comprehensive simulation workbench flow depends on a single workbench surface for exploration, correction, chart analysis, and official submission. The current UI exposes three different classes of problems:

- official evaluation feedback is hard to interpret because target values, actual values, and status are not shown together;
- chart styles are split between chart option builders, panel components, and legends, which makes line color or dash style drift;
- panel configuration is partly controlled by the shell, even though panels now own their own behavior.

One observed case is the second-order fast-stabilization challenge: the default controller can pass hard constraints and still receive score `0`. The scoring behavior is not necessarily a bug because geometric scoring can collapse when a primary metric has zero satisfaction. The UI problem is that students see a zero score without a Chinese explanation of the distinction between hard constraints and ranking score.

## Goals / Non-Goals

**Goals:**

- Make official submission results readable in Chinese, including pass/fail status, target or threshold, actual metric value, and final score explanation.
- Keep official scoring unchanged while explaining valid zero-score outcomes.
- Use one signal style registry for chart series, panel controls, and legend samples.
- Make time-domain and Bode panel controls function as the visible legend.
- Keep root-locus behavior stable and make Nyquist single-source selection match it.
- Move view-specific configuration out of the layout shell and into panel-local controls.
- Stabilize parameter drawer top labels across object/correction changes and light/dark themes.

**Non-Goals:**

- No change to official evaluation formulas, score aggregation, or hard-constraint thresholds.
- No new Arena challenge type.
- No database schema change.
- No rewrite of ECharts internals beyond option construction needed for style consistency.

## Decisions

- Keep the scoring formula as-is.
  Rationale: a valid `0` score can be a legitimate result when a ranked metric has zero satisfaction. The correct fix is to make the UI explain the result, not to silently change official ranking semantics.

- Introduce or consolidate a shared signal style preset.
  Rationale: reference, uncorrected, corrected, disturbance, and correction-device curves appear in multiple panels. The chart series and the selector/legend swatches must read from the same source.

- Use panel-local controls as legends for time-domain and Bode.
  Rationale: students configure the visible curves in those panels. Showing line color and line style directly inside the checkable controls removes the separate chart legend as another possible source of mismatch.

- Treat Nyquist like root locus for source selection.
  Rationale: overlaying uncorrected and corrected Nyquist curves can obscure the selected source. A single selected source is easier to compare with root-locus behavior.

- Leave layout composition responsible only for panel add/remove/reset.
  Rationale: the layout shell should not know the internal configuration for time-domain, Bode, root-locus, or Nyquist panels.

## Risks / Trade-offs

- [Risk] Moving controls into panels may affect responsive layout.
  Mitigation: use compact header controls and keep labels bounded with tested mobile and desktop widths.

- [Risk] Shared styles can break existing snapshots if exact colors change.
  Mitigation: centralize intentionally and update tests to assert semantic style keys rather than duplicated literals.

- [Risk] More detailed official feedback can become visually noisy.
  Mitigation: group metrics into compact target/actual/status rows and reserve status colors for threshold state, not decoration.
