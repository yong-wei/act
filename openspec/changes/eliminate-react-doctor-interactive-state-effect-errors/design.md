## Context

The interactive course findings include shared runtime components, activity renderers, and several unit-level student/teacher pages. These files are part of the newer manifest-first interactive course architecture and should not be repaired as generic UI snippets.

The most important implementation constraint is preserving course identity semantics: a step/module change may reset local state, while a parent re-render should not erase student answers or teacher view context.

## Goals / Non-Goals

**Goals:**

- Remove state/effect React Doctor errors from `src/features/interactive` files.
- Preserve manifest runtime contracts and visible course behavior.
- Add representative acceptance around step/module changes, answer preservation, teacher view state, and media panel state.

**Non-Goals:**

- Do not migrate legacy `src/resources/interactive-learning` courses.
- Do not change module kinds, scoring logic, or answer correctness rules.
- Do not include ARIA business-role cleanup; that is handled by the aria change.

## Decisions

1. **Treat step id, module id, activity id, and viewer role as explicit identity boundaries.**

   Local state reset is valid only when one of these identities changes. Otherwise, parent re-render should not erase local interaction state.

2. **Prefer keyed subcomponents for step/module resets.**

   When multiple state values reset together because the active step or module changes, use a keyed child component rather than effect-based reset after render.

3. **Manifest contract gates remain mandatory.**

   Any touched manifest runtime or unit page must continue to pass existing interactive manifest audits and implementation contract checks where applicable.

## Risks / Trade-offs

- **Fixes may accidentally clear student answers.** → Add tests or browser checks around answer preservation across non-identity re-renders.
- **Teacher/student branches may be coupled to prop names.** → Coordinate with the aria change if files also use business role props.
- **Course gates may expose unrelated legacy issues.** → Use the narrowest relevant interactive gates for touched units and record unrelated failures separately.
