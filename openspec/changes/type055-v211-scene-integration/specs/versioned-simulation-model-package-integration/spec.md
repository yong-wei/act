# versioned-simulation-model-package-integration Delta

## MODIFIED Requirements

### Requirement: Versioned model package identity is atomic
The system SHALL register the Type 055 Nanchang model release as one atomic package identity containing the model version, release-manifest SHA-256, accepted source identity, the declared GLB roles, and each file's SHA-256 and byte size. Registration MUST fail closed when any declared file is missing, mismatched, duplicated, or replaced.

#### Scenario: Complete v2.0.0 package is received
- **WHEN** all six GLBs and the release manifest match the declared v2.0.0 identities
- **THEN** the system SHALL produce one package receipt that binds the complete file denominator
- **AND** no artifact SHALL be registered only by filename or local path

#### Scenario: Complete v2.1.1 package is received
- **WHEN** all seven GLBs and the release manifest match the declared v2.1.1 identities (manifest SHA-256 `24f7dfdb2ec362d3fb4ac9fe0b1b6c63ce15d5c1f34b8603ddf5638932581430`)
- **THEN** the system SHALL produce one package receipt that binds the complete file denominator
- **AND** the antifouling-hull defect recorded against v2.1.0 SHALL be resolved by this new version without ACT patching any model bytes

#### Scenario: One artifact drifts
- **WHEN** one LOD, collision, payload, demo, manifest, hash, or size differs from the declared package
- **THEN** the system SHALL reject the complete candidate package
- **AND** the current destroyer model SHALL remain unchanged

### Requirement: Model interfaces are validated semantically
The system SHALL validate required node names, animation names, pivots, extras, the descriptor-declared ship animation count, the descriptor-declared demo animation count, 112 VLS loaded instances, 24 HQ-10 loaded instances, and both transparent decal textures before the candidate can be selected. Runtime bindings MUST use semantic names and metadata rather than glTF array indices or Blender-generated suffixes.

#### Scenario: Candidate interface validation passes
- **WHEN** the ACT-side validator parses the complete model package
- **THEN** all required semantic interfaces SHALL resolve uniquely
- **AND** representative visible ship and demo animations SHALL produce observable transforms or deformation when played

#### Scenario: An animation name exists with an invalid target
- **WHEN** a declared animation is present but targets a node outside the active model hierarchy or fails to move its visible component
- **THEN** the candidate SHALL fail interface validation

## ADDED Requirements

### Requirement: Model packages declare the design waterline anchor
The model package descriptor SHALL declare the design waterline as a model-local Y coordinate. The scene SHALL anchor the declared waterline to the water reference instead of deriving the vertical position from bounding-box geometry. Models without a declaration SHALL keep the existing bounding-box-derived placement.

#### Scenario: Versioned package mounts with a declared waterline
- **WHEN** the v2.1.1 ship LOD is mounted in the destroyer scene
- **THEN** the declared design waterline (model-local Y=6.6) SHALL coincide with the water reference within 0.05m
- **AND** the antifouling-to-gray hull boundary SHALL sit at the visible water surface

#### Scenario: Legacy model without a declaration
- **WHEN** a fallback model without a waterline declaration is mounted
- **THEN** its vertical placement SHALL remain byte-equivalent to the pre-existing bounding-box-derived behavior

### Requirement: Model packages declare semantic animation bindings
The model package descriptor SHALL declare semantic animation bindings: each binding names its semantic id, drive mode (`clip-loop` or `procedural`), target node names, clip name when clip-driven, local axis and angle range when procedural, and the telemetry source when procedural. Runtime animation wiring SHALL resolve bindings from this declaration by semantic name and MUST NOT hardcode model-specific node names in scene code. A binding whose nodes, clip, or source cannot be resolved SHALL fail closed individually without blocking the model or other bindings. A future parametric model that registers the same semantic ids SHALL bind to the same simulation telemetry without scene code changes.

#### Scenario: Telemetry drives the declared bindings
- **WHEN** the destroyer simulation runs with the v2.1.1 package active
- **THEN** propeller spin rate SHALL follow ship speed, rudder blade angle SHALL follow the commanded rudder angle clamped to the declared range, and antenna lean SHALL increase with ship speed
- **AND** the national flag and navigation radar clips SHALL loop continuously

#### Scenario: A binding cannot be resolved
- **WHEN** a declared binding references a node, clip, or telemetry source that does not exist
- **THEN** that binding SHALL be skipped with a recorded warning
- **AND** the ship model, remaining bindings, and the simulation SHALL continue unaffected

### Requirement: Model packages declare propulsor wake emitters
The model package descriptor SHALL declare propulsor node names for wake emission. When the active model declares propulsors, the scene SHALL emit one wake trail per propulsor, anchored each frame to the propulsor node's world position. Models without a declaration SHALL keep the profile's hand-placed wake anchors.

#### Scenario: Twin-screw ship emits twin wakes
- **WHEN** the v2.1.1 package is active and the destroyer is underway
- **THEN** two independent wake trails SHALL emit from the world positions of `PROP_PORT` and `PROP_STARBOARD`
- **AND** the trails SHALL track rudder and hull motion through turns

#### Scenario: Propulsor nodes fail to resolve
- **WHEN** a declared propulsor node is absent from the mounted model
- **THEN** the scene SHALL fall back to the profile wake anchors for that trail
- **AND** the failure SHALL be recorded against the package version
