## Context

The view plugin registry already defines availability and selectable options. It does not define what each view means as design evidence.

## Goals / Non-Goals

**Goals:**

- Let each major view produce concise design evidence statements.
- Support preset-specific explanations for white-box, composite, predictive, and black-box workflows.
- Keep official scoring separate from explanatory diagnostics.

**Non-Goals:**

- Do not build a full tutoring engine.
- Do not fabricate hidden black-box target details.
- Do not change metrics or leaderboard rankings.

## Decisions

- Extend view plugin metadata with explanation providers or companion helpers.
- Keep explanations deterministic and testable.
- For black-box tasks, explain confidence and mismatch without revealing hidden scenarios.

## Risks / Trade-offs

- Overconfident explanations can mislead students. Use conservative thresholds and explicit uncertainty.
- View components may become large; prefer helper functions and small explanation panels.

## Migration Plan

1. Define explanation data structures.
2. Add explanations for the core view plugins.
3. Render explanations near relevant panels or flow evidence sections.
4. Add tests for representative sessions and hidden-target privacy boundaries.
