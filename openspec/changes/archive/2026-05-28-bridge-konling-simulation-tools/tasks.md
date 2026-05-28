## 1. Tool Contracts

- [x] 1.1 Define tool schemas for simulation context, run creation, trace analysis, run comparison, patch proposal, and patch application.
- [x] 1.2 Register tools with read, analyze, run, and write tiers.
- [x] 1.3 Require idempotency keys for run and write tools.

## 2. Scope And Approval

- [x] 2.1 Enforce owner-user isolation for student simulation tool reads and writes.
- [x] 2.2 Enforce teacher class-scoped read behavior without student impersonation.
- [x] 2.3 Require approval before controller patch application.

## 3. Runtime Integration

- [x] 3.1 Resolve tools through AgentSession and AgentToolRun.
- [x] 3.2 Resolve simulation inputs and outputs through SimulationRun and SimulationTrace.
- [x] 3.3 Preserve preview/official/course/standalone provenance in tool outputs.

## 4. Validation

- [x] 4.1 Add tests for cross-user rejection, teacher scope, idempotent run creation, and approval-required patch application.
- [x] 4.2 Add tests proving tools no longer depend on process-global simulation state.
- [x] 4.3 Run `rtk proxy openspec validate bridge-konling-simulation-tools --strict`.
