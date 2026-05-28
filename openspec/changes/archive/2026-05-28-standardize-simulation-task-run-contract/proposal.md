## Why

SceneSpec and SimulationTrace concepts already exist, but evidence-bearing simulation runs do not yet have one canonical platform envelope. Konling, Arena preview, replay verification, evidence materialization, and teacher diagnostics need the same run identity and user-isolation rules before they can share data safely.

## What Changes

- Define `SimulationTaskSpec` as the executable task contract derived from SceneSpec/EvaluationSpec plus course or assignment context.
- Define `SimulationRun` as the canonical envelope for evidence-bearing virtual simulation, Arena preview, and teacher batch runs.
- Define `SimulationTrace` storage rules that keep high-frequency samples out of normal LearningFact/profile reads while preserving replay metadata and checksums.
- Require simulation records to be isolated by owner user and scoped access rules; teacher/admin views receive only role-authorized summaries or drilldown references.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `simulation-scene-trace-protocol`: Adds canonical task, run, trace, run-kind, source-reference, and user-isolation requirements.
- `simulation-runtime-replayability`: Binds replay verification to the canonical run envelope and scoped access rules.

## Impact

- Affects Prisma schema, simulation orchestration services, future REST APIs, replay verification, Arena preview mapping, LearningFact materialization, and teacher/admin evidence drilldowns.
- Does not remove existing Arena preview tables or legacy SimulationSession/SimulationLog in this change.
