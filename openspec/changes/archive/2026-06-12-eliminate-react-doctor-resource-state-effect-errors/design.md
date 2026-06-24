## Context

This change covers state/effect findings in the resource layer:

- legacy `src/resources/interactive-learning/lesson-*` decks
- reusable widgets
- simulation previews and simulation pages
- control-system chart panels

These files include legacy course resources and simulation UI. Fixes must remain local and must not alter numerical model behavior, rendered instructional meaning, or resource registration semantics.

## Goals / Non-Goals

**Goals:**

- Remove React Doctor state/effect error diagnostics from resource and simulation files.
- Preserve resource content, widget interactions, and simulation control semantics.
- Add representative smoke checks that catch obvious resource, widget, and simulation regressions.

**Non-Goals:**

- Do not migrate legacy resources to manifest-first runtime.
- Do not change Rust/WASM engines, control algorithms, or simulation equations.
- Do not fix warning-level maintainability issues such as giant components or unused exports.

## Decisions

1. **Keep resource fixes local.**

   Legacy resources should receive minimal state/effect repairs. Broad resource migration belongs in a separate course/runtime change.

2. **Simulation state fixes must not alter numerical semantics.**

   For simulation components, distinguish UI state reset from model state and engine stepping. Do not change physics/control calculation paths to satisfy a React warning.

3. **Use representative smoke checks instead of exhaustive legacy coverage.**

   Because legacy resources are numerous, validate at least one resource deck, one widget, and one simulation cluster touched by the change, plus React Doctor filtered output.

## Risks / Trade-offs

- **Legacy components may lack tests.** → Add narrow smoke or component tests around the touched behavior rather than broad rewrites.
- **Simulation UI and model state can be coupled.** → Inspect state ownership before changing reset logic; avoid touching engine state unless the finding directly concerns UI state.
- **Resource behavior may be rarely used.** → Record any untestable legacy assumptions and prefer low-risk local changes.
