## ADDED Requirements

### Requirement: Versioned model package identity is atomic
The system SHALL register the Type 055 Nanchang model release as one atomic package identity containing the model version, release-manifest SHA-256, accepted source identity, six declared GLB roles, and each file's SHA-256 and byte size. Registration MUST fail closed when any declared file is missing, mismatched, duplicated, or replaced.

#### Scenario: Complete v2.0.0 package is received
- **WHEN** all six GLBs and the release manifest match the declared v2.0.0 identities
- **THEN** the system SHALL produce one package receipt that binds the complete file denominator
- **AND** no artifact SHALL be registered only by filename or local path

#### Scenario: One artifact drifts
- **WHEN** one LOD, collision, payload, demo, manifest, hash, or size differs from the declared package
- **THEN** the system SHALL reject the complete candidate package
- **AND** the current destroyer model SHALL remain unchanged

### Requirement: Model roles remain separate
The system SHALL preserve separate roles for ship LOD0, ship LOD1, ship LOD2, collision, weapon payload, and weapon demo. It MUST NOT merge payload or transient demo ammunition into the default ship asset lifecycle.

#### Scenario: Standard destroyer simulation loads
- **WHEN** the student opens the ordinary destroyer heading simulation
- **THEN** the loader SHALL request only the selected ship LOD
- **AND** payload, demo, and collision GLBs SHALL remain unloaded until a declared consumer requests them

### Requirement: Model interfaces are validated semantically
The system SHALL validate required node names, animation names, pivots, extras, 127 unique ship animations, eight unique demo animations, 112 VLS loaded instances, 24 HQ-10 loaded instances, and both transparent decal textures before the candidate can be selected. Runtime bindings MUST use semantic names and metadata rather than glTF array indices or Blender-generated suffixes.

#### Scenario: Candidate interface validation passes
- **WHEN** the ACT-side validator parses the complete model package
- **THEN** all required semantic interfaces SHALL resolve uniquely
- **AND** representative visible ship and demo animations SHALL produce observable transforms or deformation when played

#### Scenario: An animation name exists with an invalid target
- **WHEN** a declared animation is present but targets a node outside the active model hierarchy or fails to move its visible component
- **THEN** the candidate SHALL fail interface validation

### Requirement: Coordinate adaptation is explicit
The system SHALL register the package coordinate basis as glTF Y-up with the bow along local +X and SHALL convert scene heading, port/starboard semantics, waterline, wake anchors, and interaction axes through one explicit adapter. Scene components MUST NOT add independent compensating rotations.

#### Scenario: Ship is placed in the destroyer scene
- **WHEN** the v2.0.0 ship LOD is mounted at neutral heading
- **THEN** the bow, port, starboard, waterline, and wake anchors SHALL match the scene's canonical directions
- **AND** changing platform heading SHALL rotate the ship and wake consistently

### Requirement: Candidate integration preserves rollback
The new package SHALL remain a reversible candidate until a separate production activation is authorized. The existing destroyer model and browser-delivery candidates SHALL remain available as the default or fallback, and failure of the new package SHALL NOT reduce simulation usability.

#### Scenario: Candidate GLB fails to load
- **WHEN** fetch, integrity, parse, interface, or rendering validation fails for the selected candidate
- **THEN** the loader SHALL fall back to the existing registered destroyer model
- **AND** simulation state, camera state, and user progress SHALL be preserved

### Requirement: Upstream model bytes are immutable in ACT
ACT SHALL NOT patch imported model meshes, materials, textures, animations, or release metadata. A confirmed asset defect MUST be returned to the 3DModels project and resolved through a new model version before re-entry.

#### Scenario: Integration exposes an asset defect
- **WHEN** ACT validation demonstrates a defect in the accepted model package rather than its local adapter
- **THEN** the candidate SHALL remain inactive or roll back
- **AND** the defect record SHALL identify the model version, artifact hash, reproduction, and required upstream revision
