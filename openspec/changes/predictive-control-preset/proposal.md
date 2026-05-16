## Why

MPC and optimization-assisted PID tasks currently route to a course page even though Arena already has parameterized artifact builders and template evaluation support. They need a unified predictive-control preset that exposes the bounded templates as workbench drafts.

## What Changes

- Add a predictive-control preset for `mpc` and `optimized-pid` Arena tasks.
- Provide parameter panels for bounded linear MPC and bounded optimized PID templates.
- Render views for time trajectory, control/constraint usage, prediction or hidden-scenario summary, and objective weights.
- Generate official `mpc` or `optimized-pid` artifacts and submit through `/api/arena/evaluate`.

## Capabilities

### New Capabilities
- `control-workbench-predictive-preset`: Defines predictive-control and optimization-assisted PID template behavior inside the unified workbench.

### Modified Capabilities

## Impact

- Adds predictive preset and method panels under `src/features/control-workbench/`.
- Reuses existing artifact builder support for `mpc` and `optimized-pid`.
- Uses current template white-box evaluation unless a later change adds exact MPC simulation.
- Later routing migration will send predictive-control tasks to this preset.
