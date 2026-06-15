## Context

Previous UI series exposed a pattern: proposals can reference product-design handoffs, but implementation changes may pass with only token usage, route registration, or nonblank screenshots. The adaptive path center requires a stronger final gate because the user explicitly wants strict visual match to the handoff and generated concepts, plus browser-based subagent validation.

## Goals / Non-Goals

**Goals:**

- Make the design handoff and concept images explicit QA inputs.
- Require fresh browser evidence for desktop/mobile, light/dark, cold-start, generated options, active path, history, Konling, and skip warning.
- Require independent visual subagent PASS.
- Fail on forbidden debug strings and control-correction-only generation.

**Non-Goals:**

- No feature implementation.
- No replacement for child-change tests.
- No GitHub issue automation inside the product runtime.

## Decisions

- Use a final QA change rather than relying only on child acceptance. This catches integrated failures such as dock overlap, fixed-width layouts, mobile squeeze-down, isolated marketing-card comparisons, or mismatch between selection and execution surfaces.
- Treat the handoff as the source of truth and concept images as referenced visual baselines. Exact generated text and mockup chrome can be rejected only where the handoff says so.
- Require browser-capable subagent evidence because this series is visual and interaction-heavy.
- Include text-string gates for forbidden engineering states because the current page leaks internal diagnostics.

## Risks / Trade-offs

- Final QA may block on unrelated active UI debt. Mitigation: scope the matrix to adaptive path center surfaces and shared shell states that they use.
- Visual comparison can be subjective. Mitigation: require explicit PASS/BLOCK categories tied to handoff sections and concept image paths.
- Browser evidence can be stale. Mitigation: require route, theme, viewport, auth state, timestamp/run id, and current source commit metadata.
