## 1. Tool Contracts

- [ ] 1.1 Define tool schemas for simulation context, run creation, trace analysis, run comparison, patch proposal, and patch application.
- [ ] 1.2 Register tools with read, analyze, run, and write tiers.
- [ ] 1.3 Require idempotency keys for run and write tools.

## 2. Scope And Approval

- [ ] 2.1 Enforce owner-user isolation for student simulation tool reads and writes.
- [ ] 2.2 Enforce teacher class-scoped read behavior without student impersonation.
- [ ] 2.3 Require approval before controller patch application.

## 3. Runtime Integration

- [ ] 3.1 Resolve tools through AgentSession and AgentToolRun.
- [ ] 3.2 Resolve simulation inputs and outputs through SimulationRun and SimulationTrace.
- [ ] 3.3 Preserve preview/official/course/standalone provenance in tool outputs.

## 4. Validation

- [ ] 4.1 Add tests for cross-user rejection, teacher scope, idempotent run creation, and approval-required patch application.
- [ ] 4.2 Add tests proving tools no longer depend on process-global simulation state.
- [ ] 4.3 Run `rtk proxy openspec validate bridge-konling-simulation-tools --strict`.
