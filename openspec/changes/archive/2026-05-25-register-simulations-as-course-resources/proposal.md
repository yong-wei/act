## Why

The current repository has standalone `/simulations/*` scenes and one registered lesson simulation app, but the broader virtual simulation and Arena workbench path is not yet a first-class DB BOPPPS course resource chain. The report's strongest product recommendation is to embed simulation and Arena back into the course evidence loop.

## What Changes

- Define how the seven standalone simulations and eligible Arena challenge/workbench flows become course resources.
- Use resource registry ids and lesson item config rather than component paths in lesson plans.
- Preserve standalone routes while enabling course/class/session launch context.
- Define config merge order and launch context fallback for standalone, course, class, and session launches.
- Connect course-launched simulation completion to learning evidence.

## Capabilities

### New Capabilities
- `simulation-course-resource-integration`: Defines simulation and Arena resource registration for DB BOPPPS course launch and evidence context.

### Modified Capabilities
- None.

## Impact

- Affects `src/lib/resource-registry.tsx`, teacher preset lesson configuration, resource rendering, and evidence launch context.
- Depends on protocol and evidence-governance changes.
- Feature-cache, recommendation, and teacher-diagnostic consumers are handled by `materialize-simulation-features-for-personalization`.
