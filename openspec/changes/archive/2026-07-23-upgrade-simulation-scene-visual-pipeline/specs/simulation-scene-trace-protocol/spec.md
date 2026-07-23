## ADDED Requirements

### Requirement: Presentation-layer preferences are excluded from SceneSpec and Trace
Presentation-layer preferences — environment preset, quality tier, camera mode and framing, soundscape state, and teaching-annotation visibility — SHALL NOT be part of `SceneSpec v1` or `SimulationTrace v1`; evidence and replay semantics SHALL NOT depend on them, and replay verification SHALL NOT require reproducing them.

#### Scenario: Two runs differ only in presentation preferences
- **WHEN** two simulation runs share model identity, disturbances, and inputs but differ in environment preset, quality tier, camera framing, soundscape state, or annotation visibility
- **THEN** their evidence and replay comparison SHALL treat them as equivalent
- **AND** `SceneSpec v1` and `SimulationTrace v1` SHALL remain unchanged by the introduction of the visual pipeline
