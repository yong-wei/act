## Context

The current error-only React Doctor report shows 48 diagnostics outside `src/features/interactive`:

- `src/resources/interactive-learning`: 29
- `src/resources/simulations`: 9
- `src/resources/widgets`: 9
- `src/resources/control-system`: 1

Notable clusters include lesson knowledge decks, Control Odyssey, ship model preview, destroyer simulation, Ten Drops game, analogy/argument/physics widgets, and control analysis panels.

## Goals / Non-Goals

**Goals:**

- Remove all React Doctor error diagnostics under resource, widget, simulation, and control-system resource code.
- Preserve numerical model semantics, displayed metrics, and teaching-resource behavior.
- Dispose timers, animation frames, subscriptions, and mutable dependency patterns that can leak or fail to re-run.
- Add targeted tests or smoke checks for high-risk repairs.

**Non-Goals:**

- Do not modernize all legacy resource decks.
- Do not change course content, scoring, or simulation formulas unless required to preserve existing behavior.
- Do not address advisory warning categories outside directly touched code.

## Decisions

1. **Separate UI state from model semantics.**

   Repairs may change React state ownership but must not change control model calculations, physics step behavior, route scoring, or displayed metric definitions.

2. **Use resource identity envelopes.**

   Resource decks commonly reset local state when slide/resource identity changes. Prefer keyed envelopes or component keys over prop-change effects.

3. **Treat timers and mutable dependencies as correctness issues.**

   The single `effect-needs-cleanup` and `no-mutable-in-deps` findings should be repaired directly, not suppressed.

4. **Avoid broad legacy refactors.**

   Many resources are large. Fix the flagged state/effect patterns locally and add tests around touched behavior rather than rewriting entire decks.

## Risks / Trade-offs

- **Large simulation files are easy to destabilize.** Keep changes local and validate route or component smoke behavior where unit tests are impractical.
- **Legacy decks may rely on implicit resets.** Replace implicit effect resets with explicit identity contracts.
- **Numerical semantics are not fully covered by React Doctor.** Pair lint cleanup with existing simulation or resource tests where available.
