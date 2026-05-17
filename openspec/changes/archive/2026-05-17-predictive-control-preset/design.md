## Context

Arena seed tasks already include `task-ship-roll-mpc-hidden-scenarios` and `task-ship-roll-optimized-pid-robust`, and the controller artifact builder can generate bounded MPC and optimized PID artifacts. The missing part is a workbench surface that presents these as design templates rather than as generic form submissions.

## Goals / Non-Goals

**Goals:**
- Support first-version predictive-control tasks inside the unified workbench.
- Keep template parameters explicit, bounded, and reproducible.
- Submit artifacts through the official Arena path.

**Non-Goals:**
- No general-purpose MPC solver UI.
- No arbitrary cost function scripting.
- No code-controller execution or sandboxing.

## Decisions

- Start with the existing bounded templates.
  Rationale: the evaluator and artifact builder already know these shapes. A full MPC engine would be a separate numerical project.

- Use view slots that can later accept richer simulation data.
  Rationale: first version may show template summaries and preview metrics; exact prediction-window traces can be added without changing the route.

- Keep optimized PID in the predictive preset.
  Rationale: both MPC and optimized PID use hidden-scenario/parameter-template workflows and are routed today through `predictive-control`.

## Risks / Trade-offs

- [Risk] The preset name may imply full MPC simulation.
  → Mitigation: label first-version behavior as bounded parameterized templates.

- [Risk] Hidden-scenario metrics are official-only.
  → Mitigation: preview panels must distinguish local template preview from official hidden-scenario evaluation.
