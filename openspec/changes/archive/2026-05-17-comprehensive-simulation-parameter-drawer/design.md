## Context

The existing correction-controls spec already requires stable parameter drawer tabs, but the current workbench needs a stricter guarantee: clicking object or correction labels must not resize the top area, and the active label must be obvious in both themes.

## Goals / Non-Goals

**Goals:**

- Make top-level object and correction labels dimensionally stable during clicks and correction-state changes.
- Keep the active drawer tab visually clear with theme-aware colors.
- Handle long object names and correction labels without stretching the drawer header.
- Preserve all existing parameter editing and locking behavior.

**Non-Goals:**

- Do not change controller formulas, parameter ranges, or simulation computation.
- Do not redesign the object selector.
- Do not change time-domain, root-locus, Nyquist, or Bode chart behavior.
- Do not alter official submission artifacts.

## Decisions

1. Treat the drawer header as a fixed-layout control row with bounded label content.
   - Rationale: tab dimensions should be determined by the component structure, not by whichever object or correction text happens to be selected.
   - Alternative considered: only shorten the labels. That would reduce one symptom while preserving the layout instability.

2. Active state uses theme-aware visual tokens rather than inline ad hoc colors.
   - Rationale: the workbench already needs consistent light and dark behavior across shared controls.
   - Alternative considered: hard-code a single saturated color. That can fail contrast in one of the themes.

3. The drawer state machine remains unchanged.
   - Rationale: this change is about stable presentation, not correction semantics.
   - Alternative considered: restructure drawer state handling. That would increase risk and overlap with unrelated controller work.

## Risks / Trade-offs

- Very long object names can still need truncation. -> Use bounded text, tooltips or accessible labels, and stable min/max sizing.
- Active-state colors can drift from object selector colors. -> Keep tab tokens local to drawer state while maintaining contrast.
- Existing tests may only inspect source strings. -> Add behavior-level assertions where the component can be rendered.
