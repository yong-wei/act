## Context

The foundation change routes free exploration and Arena-supported contexts through the same comprehensive simulation workbench. Free exploration now has a selected object and working model, but the visible selector is still too large and still relies on plain text for object model details.

## Goals / Non-Goals

**Goals:**

- Make object selection compact enough for the four-panel analysis surface.
- Preserve a clear selected object state in light and dark themes.
- Show object models as formulas and object attributes as labels.
- Keep the selected object as the same session-level context consumed by presets and parameter panels.
- Reject incompatible object selections without replacing the current valid working model.

**Non-Goals:**

- Do not redesign the parameter drawer tab layout.
- Do not change chart scaling, legends, root-locus, or Nyquist behavior.
- Do not add a new object registry or duplicate the Arena object catalog.
- Do not change official Arena evaluation or submission semantics.

## Decisions

1. The selector remains part of the shared workbench shell, not a classic-preset-only widget.
   - Rationale: free exploration and Arena mode must share the same workbench surface with different context, so object selection should live at the session boundary.
   - Alternative considered: implement the selector inside the classic four-view preset. That would make later black-box or predictive presets harder to configure consistently.

2. Object formulas are rendered from normalized model metadata, with plain-text transfer-function strings treated as fallback source data only.
   - Rationale: the UI requirement is formula presentation; the implementation should avoid treating display strings as the authoritative model.
   - Alternative considered: manually style raw strings. That would not satisfy formula rendering and would be brittle for higher-order objects.

3. Metadata uses reusable labels or badges instead of inline prose.
   - Rationale: labels allow dense comparison without expanding the selector and keep state cues visible when collapsed.
   - Alternative considered: keep descriptive text under each object. That is the source of the current space problem.

4. Incompatible selections are rejected at the selector boundary.
   - Rationale: the active analysis model should not be replaced by an object that the current preset cannot render.
   - Alternative considered: let the preset fail after selection. That would make the selected state and charts disagree.

## Risks / Trade-offs

- Formula rendering may require a shared math display helper. -> Use existing KaTeX/LaTeX helpers where available before adding a new component.
- Object compatibility rules can drift from preset mount rules. -> Reuse the same model compatibility predicates that the session resolver or preset already applies.
- Collapsed state can hide useful context. -> Keep selected object summary and labels visible in the collapsed header.
