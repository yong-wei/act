## Context

The repository already defines SceneSpec v1, EvaluationSpec v1, and SimulationTrace v1 at the protocol level. The gap is the persistent run envelope: a record that lets Konling tools, Arena preview, replay, evidence materialization, and teacher diagnostics refer to the same evidence-bearing run without reading page-local state.

## Decisions

### SimulationTaskSpec Is Executable Task Input

`SimulationTaskSpec` should represent a concrete task that can be run. It should include scene id, scenario id, objectives, constraints, disturbance policy, evaluation spec reference, allowed controllers, schema version, spec hash, and optional course/class/resource/publication context.

SceneSpec remains the scene description. SimulationTaskSpec is the executable assignment or experiment specification.

### SimulationRun Is The Canonical Envelope

`SimulationRun` should be the normal reference for evidence-bearing run consumers. It should include:

- owner user
- optional class/course/session/resource/publication context
- `runKind` such as `scene_simulation`, `arena_preview`, `teacher_batch`, or `agent_experiment`
- `sourceDomain` and `sourceRefId` for domain detail records
- task spec reference or embedded immutable task spec snapshot
- controller snapshot reference
- seed, runtime version, model version, scene spec version
- status, summary, replay token, timestamps

This does not require immediate deletion of legacy domain tables. Domain tables can map to `SimulationRun` while preserving specialized fields.

### SimulationTrace Stores Envelope And References

The database should store trace envelope, compact summary, checksum, sample count, cadence, and storage reference. High-frequency samples should not become normal profile or LearningFact payloads.

### User Isolation Is A First-Class Contract

Every run and trace must have an owner user or an explicit system/teacher batch scope. Student reads are owner-only. Teacher reads require class/publication/course authorization and must not expose another user's raw trace outside permitted drilldown.

## Risks

- A generic SimulationRun can become too broad if domain-specific fields are pushed into it. Use `sourceDomain/sourceRefId` and detail tables for domain-specific data.
- If user isolation is not represented in schema and service boundaries, later tools may rely on prompt-level filtering. That is not sufficient.
- Replay verification must not leak hidden official evaluation internals.

## Verification

- Contract tests for task spec hashing and run-kind/source-reference validation.
- Access tests for owner student, teacher class scope, admin summary scope, and unauthorized cross-user requests.
- Replay tests using run envelope metadata.
- `rtk proxy openspec validate standardize-simulation-task-run-contract --strict`.
