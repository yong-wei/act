## ADDED Requirements

### Requirement: Simulation destinations include governed course student demo steps

The adaptive path destination contract SHALL accept a `simulation` node when its canonical target is any of: a `/simulations/*` platform route; a verified interactive resource context under `/interactive-learning/resources/`; or a governed course student demo step of the form `/interactive-learning/courses/<segment>/student/demo?step=<non-empty>`, where `<segment>` passes `isManifestCourseRouteSegment()`. Course root paths, teacher routes, unregistered segments, or demo URLs missing a non-empty `step` MUST remain blocked. A registered control-correction simulation that uses a governed course demo step MUST NOT be projected as `destination-contract-blocked`, and `planLearningPath` SHALL be able to assemble a non-empty `mainPath` that includes that simulation and the Arena terminal validation node from the real registry.

#### Scenario: Governed course demo step is a legal simulation destination

- **WHEN** a `simulation` node targets `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11`
- **THEN** the destination contract SHALL return `destination-control`
- **AND** the node SHALL NOT receive `destination-contract-blocked`

#### Scenario: Course root without student demo step stays blocked

- **WHEN** a `simulation` node targets `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`
- **THEN** the destination contract SHALL remain blocked
- **AND** the reason SHALL stay `unsupported-resource-type`

#### Scenario: Unregistered segment or missing step stays blocked

- **WHEN** a `simulation` node targets a `/student/demo` URL whose course segment fails `isManifestCourseRouteSegment()` or whose `step` query is missing or empty
- **THEN** the destination contract SHALL remain blocked

#### Scenario: Real registry produces a feasible control-correction main path

- **WHEN** `planLearningPath` runs against the unmodified control-correction resource registry for a learner who can satisfy the existing readiness gates
- **THEN** `mainPath` SHALL be non-empty
- **AND** it SHALL contain `simulation:control-correction-step-response-lab` and Arena terminal validation
- **AND** the result SHALL come from a live planner run rather than a frozen 3-node / 48-minute snapshot
