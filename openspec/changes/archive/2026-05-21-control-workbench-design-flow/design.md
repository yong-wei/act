## Context

The current resolver already maps Arena tasks to workbench presets. The shell shows session status, object selection, panels, and submission surfaces, but not a student-facing design process.

## Goals / Non-Goals

**Goals:**

- Make challenge, assignment, explore, and review modes visible as learning states.
- Provide a design-flow sequence such as object analysis, controller design, performance comparison, constraint check, official submission, and review.
- Keep advanced panel configuration available but secondary to the design flow.

**Non-Goals:**

- Do not add new official scoring logic.
- Do not rewrite all view plugins.
- Do not implement evidence explanations beyond the flow slots needed to host them.

## Decisions

- Model flow steps as derived workbench session metadata, not as hard-coded page prose.
- Keep flow rendering in small shell subcomponents to avoid growing `ResolvedControlWorkbenchShell`.
- Preserve panel storage compatibility where possible.

## Risks / Trade-offs

- The shell is already a large component. This change should extract subcomponents rather than add another long block.
- Preset-specific flows can diverge. Keep a shared contract with preset overrides.

## Migration Plan

1. Add flow-step types and derivation helpers.
2. Integrate flow rendering in the shell.
3. Adapt major presets to provide default flow emphasis.
4. Add tests around mode labels, step visibility, and route compatibility.
