## Context

The current desktop path-selection workspace renders generated options as a field comparison grid and then renders action controls in a separate region. Mobile already uses path cards with local actions, but desktop asks students to map the action block back to the option they just reviewed. The accepted design intent is not three isolated promotional cards; it is a comparable path-choice surface where each route is a complete decision unit.

## Goals / Non-Goals

**Goals:**

- Keep path options directly comparable.
- Keep select, adjust, explain, and reject controls inside the corresponding option module.
- Make keyboard focus order match visual order.
- Bind implementation QA to the approved handoff, comparison concept, and current audit mismatch.

**Non-Goals:**

- Changing how path options are generated or persisted.
- Changing launch/return behavior after a path is selected.
- Changing path execution, completion, or latest-path recovery.

## Decisions

- Use a route-module comparison layout, not a free-form card gallery. Each module exposes the same sections: title, node preview, estimated time, resource mix, readiness, checkpoints, reason, expected outcome, risk, and actions.
- Preserve comparison affordance through aligned fields and stable labels. The design may use columns, stacked modules, or responsive sections, but the action controls cannot be detached from their option.
- Treat visual QA as a contract item: implementation must compare against the Product Design handoff and `02-path-selection-comparison.png`, and must explicitly show no detached desktop action strip remains.

## Risks / Trade-offs

- **Risk:** Self-contained modules could become too tall.  
  **Mitigation:** keep long rationale text clipped or progressively disclosed while preserving the action controls in-module.
- **Risk:** The layout could lose table-like comparability.  
  **Mitigation:** keep identical field order and labels across all route modules and include a desktop screenshot demonstrating parallel comparison.
