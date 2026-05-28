## Context

Current AI tools can read or format simulation state, but legacy paths still depend on request-provided or process-global state. Once AgentToolRun and SimulationRun exist, Konling tools should become typed operations over persisted run scope.

## Decisions

### Tool Set

The initial bridge should expose these tools:

- `get_simulation_context`
- `run_virtual_simulation`
- `analyze_simulation_trace`
- `compare_simulation_runs`
- `propose_controller_patch`
- `apply_controller_patch`

The tool registry should classify reads and analysis as no-approval by default, run creation as idempotent run tier, and patch application as approval-required write tier.

### Scope Resolution

Every tool must resolve the authenticated actor, target owner user, class scope, resource scope, and SimulationRun ownership before returning data or creating side effects.

Student tools are owner-only. Teacher tools may inspect authorized class summaries or drilldowns but cannot act as a student unless a later spec defines an explicit teacher workflow.

### Patch Application Is Not Automatic

`propose_controller_patch` returns a candidate patch and rationale. `apply_controller_patch` records an approval-required tool run and changes only the scoped controller draft after approval. It must not silently mutate official submissions, grades, or LearningFacts.

### Output Shape

Tool outputs should return stable references and compact summaries:

- `simulationRunId`
- `traceId` or trace reference
- summary metrics
- replay status
- source provenance
- confidence and low-evidence markers

Raw high-frequency traces are outside normal tool output unless role and drilldown scope permit them.

## Risks

- Letting tools accept arbitrary run ids can create cross-user data leaks. Ownership checks must happen before fetching details.
- Applying controller patches without approval would undermine the audit model.
- Tool outputs can overstate preview or low-confidence runs. Provenance markers must be preserved.

## Verification

- Tool registry tests for permission tier and approval behavior.
- API/service tests for owner-only student access and teacher class-scoped access.
- Idempotency tests for run creation and patch application.
- Tests proving tools reference SimulationRun/Trace rather than process-global simulation state.
- `rtk proxy openspec validate bridge-konling-simulation-tools --strict`.
