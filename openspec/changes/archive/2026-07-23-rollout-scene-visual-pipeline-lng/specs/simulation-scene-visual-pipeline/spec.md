## MODIFIED Requirements

### Requirement: Simulation scenes share one visual pipeline
Simulation detail scenes SHALL mount a shared scene visual pipeline (water, wake, environment, camera, audio, quality, annotations, post-processing) whose modules are parameterized by ship profile and contain no experiment-specific hardcoding.

#### Scenario: Pipeline module is consumed by an experiment
- **WHEN** a simulation detail route mounts its scene through the pipeline
- **THEN** the scene modules SHALL resolve their parameters from that experiment's ship profile
- **AND** no pipeline module SHALL reference an experiment id, route, or profile directly in its implementation

#### Scenario: Pipeline is reused by a second experiment without module changes
- **WHEN** the lng detail route mounts its scene through the same pipeline modules after the destroyer sample
- **THEN** the integration SHALL require only the experiment's ship profile, mounting glue, and model assets
- **AND** no scene pipeline module SHALL be edited to accommodate lng

#### Scenario: New visual capability is added
- **WHEN** a scene visual capability is introduced or upgraded
- **THEN** it SHALL land in the shared pipeline modules rather than inside a single experiment component
