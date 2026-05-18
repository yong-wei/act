## Context

The comprehensive simulation workbench now serves both free exploration and Arena challenge contexts. Several recent changes added panel-local controls, shared curve styles, official submission feedback, and leaderboard browsing, but the live UI still shows regressions that affect the same user path: choose a challenge, inspect the workbench, adjust controller/correction parameters, compare curves, submit officially, and inspect rankings.

The repeated time-domain range failure has a concrete root cause. The current time-domain range helper computes finite visible-curve extrema with margin, but both single and comparison time-domain panels install the shared Cartesian pan/zoom handler. That handler immediately enforces equal Cartesian aspect, which is correct for root-locus and Nyquist geometry but wrong for time-domain response data. With a 0-12 second x-range, equal aspect expands the y-range far beyond the response amplitude, so the curve appears as a narrow line even when the y-range calculation itself is correct.

## Goals / Non-Goals

**Goals:**

- Treat time-domain charts as data plots, not equal-aspect geometry plots.
- Make panel-local curve/source controls the single source of truth for chart series.
- Keep layout controls structural and move view-specific settings into panel headers.
- Make official submission and leaderboard evidence compact, Chinese, and useful before and after submit.
- Preserve the shared workbench across free exploration and Arena contexts.

**Non-Goals:**

- No change to official scoring formulas, hard constraints, ranking semantics, or persistence schema.
- No new workbench architecture or routing rewrite.
- No new challenge content or controller method.
- No re-archiving or reopening of previous OpenSpec changes.

## Decisions

1. Split Cartesian aspect behavior by chart type.
   - Decision: keep equal-aspect enforcement for root-locus and Nyquist, but opt time-domain charts out of it.
   - Rationale: root-locus and Nyquist axes represent the same complex-plane unit; time-domain axes represent seconds and response amplitude, so equal aspect is mathematically inappropriate.
   - Alternative rejected: tuning y-axis presets around the expanded aspect range. That would hide the symptom and break again when the x-range or chart dimensions change.

2. Reset or replace chart series when curve selections change.
   - Decision: make time-domain and Bode rendered series follow selected panel options exactly, using stable series identity or ECharts replacement semantics where needed.
   - Rationale: the UI controls already communicate selected state; stale series makes the panel visibly contradict its own controls.
   - Alternative rejected: manually hiding series through opacity. Hidden-but-present series can still affect tooltips, extents, and future updates.

3. Keep panel configuration local.
   - Decision: panel headers own view-specific controls; the layout composition layer only adds, removes, reorders, and resets panels.
   - Rationale: one workbench can contain multiple panels of the same view type, so configuration must belong to the panel instance, not the layout shell.

4. Treat official evaluation display as live diagnostic evidence.
   - Decision: the official submission panel shows current metric estimates before submit and official target/actual comparison after submit with the same compact metric vocabulary.
   - Rationale: students need to understand the gap before committing a submission; post-submit status alone is too late and too verbose.

5. Treat leaderboard detail tables as dense academic comparison tables.
   - Decision: keep category and sub-board selection visible, compact identity into name plus student number, allow horizontal scrolling, and omit redundant columns once a sub-board fixes that value.
   - Rationale: ranking pages are repeated-use comparison surfaces, not marketing cards.

## Risks / Trade-offs

- [Risk] Changing chart update semantics could affect root-locus or Nyquist overlays. -> Mitigation: scope replacement behavior to line-series panels that use selectable curves, and keep geometry panels covered by existing tests.
- [Risk] Time-domain pan/zoom behavior may preserve too much old viewport state. -> Mitigation: preserve user-selected x/y ranges only after explicit pan/zoom or refresh, and reset preserved y range when visible series or analysis identity changes.
- [Risk] Official preview metrics may be confused with official submission results. -> Mitigation: label preview/current metrics separately from persisted official result while using the same metric rows for comparison.
- [Risk] Leaderboard tables may become too dense on narrow screens. -> Mitigation: use horizontal overflow for wide metric sets and compact identity cells instead of shrinking text below readable size.

## Migration Plan

This is a frontend stabilization change. It can ship behind the existing workbench and Arena routes without data migration. Rollback is the previous workbench UI behavior; no database migration or protocol downgrade is required.

## Open Questions

- None that block implementation. If actual official metric preview data is unavailable for a challenge, the implementation should show an explicit Chinese unavailable state rather than synthesize placeholder metrics.
