## Why

After Konling has auditable tool runs and simulations have canonical run envelopes, Konling needs simulation-specific tools that operate on persisted runs rather than process-global page state. This is the change that turns Konling from a chat assistant into a scoped control-experiment assistant.

## What Changes

- Add Konling simulation tools for context reads, run creation, trace analysis, run comparison, controller patch proposal, and controller patch approval/application.
- Require every simulation tool to operate within the authenticated user's run scope or authorized teacher class scope.
- Route run and write tools through AgentToolRun idempotency and approval policy.
- Ensure tool outputs reference SimulationRun, SimulationTrace, and summary evidence rather than raw page state.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: Adds simulation tool requirements grounded in AgentSession and AgentToolRun.
- `simulation-scene-trace-protocol`: Requires Konling simulation tools to resolve and reference canonical SimulationRun and SimulationTrace records.

## Impact

- Depends on `harden-konling-agent-runtime-tools` and `standardize-simulation-task-run-contract`.
- Affects Konling tool registry, `/api/ai/chat`, session message APIs, simulation orchestration APIs, and future student-facing simulation panels.
