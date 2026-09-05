# versioned-simulation-model-package-integration Specification

## Purpose
TBD - created by archiving change integrate-type055-nanchang-v2-model-release. Update Purpose after archive.
## Requirements
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

### Requirement: Model roles remain separate
The system SHALL preserve separate roles for ship LOD0, ship LOD1, ship LOD2, collision, weapon payload, and weapon demo. It MUST NOT merge payload or transient demo ammunition into the default ship asset lifecycle.

#### Scenario: Standard destroyer simulation loads
- **WHEN** the student opens the ordinary destroyer heading simulation
- **THEN** the loader SHALL request only the selected ship LOD
- **AND** payload, demo, and collision GLBs SHALL remain unloaded until a declared consumer requests them

### Requirement: Model interfaces are validated semantically
The system SHALL validate required node names, animation names, pivots, extras, the descriptor-declared ship animation count, the descriptor-declared demo animation count, 112 VLS loaded instances, 24 HQ-10 loaded instances, and both transparent decal textures before the candidate can be selected. Runtime bindings MUST use semantic names and metadata rather than glTF array indices or Blender-generated suffixes.

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

The new package SHALL remain a reversible candidate until production activation is authorized; after an authorized activation the activated package SHALL become the default and the legacy browser-delivery candidates SHALL remain available as an ordered fallback. In both states, failure of the versioned package SHALL NOT reduce simulation usability, and rollback to the legacy chain SHALL remain possible without a new deployment of model assets.

#### Scenario: Candidate GLB fails to load
- **WHEN** fetch, integrity, parse, interface, or rendering validation fails for the selected candidate
- **THEN** the loader SHALL fall back to the existing registered destroyer model
- **AND** simulation state, camera state, and user progress SHALL be preserved

#### Scenario: Activated package fails at runtime
- **WHEN** the activated default package fails integrity, parse, or interface validation for the selected LOD
- **THEN** the loader SHALL fall back through the legacy destroyer candidate chain
- **AND** the failure SHALL be recorded against the activated package version and artifact hash

#### Scenario: Activation is rolled back
- **WHEN** an authorized rollback is requested after activation
- **THEN** the registry SHALL restore the legacy chain as default without re-downloading or modifying model assets
- **AND** no half-switched state SHALL persist across the registry and published delivery manifest

### Requirement: Upstream model bytes are immutable in ACT
ACT SHALL NOT patch imported model meshes, materials, textures, animations, or release metadata. A confirmed asset defect MUST be returned to the 3DModels project and resolved through a new model version before re-entry.

#### Scenario: Integration exposes an asset defect
- **WHEN** ACT validation demonstrates a defect in the accepted model package rather than its local adapter
- **THEN** the candidate SHALL remain inactive or roll back
- **AND** the defect record SHALL identify the model version, artifact hash, reproduction, and required upstream revision

### Requirement: Meshopt-compressed packages decode through the shared loader

The system SHALL decode versioned packages that declare `EXT_meshopt_compression`, meshopt quantization filters, and `EXT_mesh_gpu_instancing` through the shared loader's meshopt decoder path. Quantized bounding volumes MUST NOT cause visible meshes to be culled incorrectly; the main ship model SHALL disable frustum culling or use equivalent corrected bounds. Decode failure SHALL fail closed into the declared fallback chain.

#### Scenario: v2.1.0 package loads on the high tier
- **WHEN** the v2.1.0 ship LOD0 with meshopt compression and GPU instancing is requested
- **THEN** the loader SHALL decode and mount it with all visible meshes rendered
- **AND** no payload, demo, collision, or interactive-systems GLB SHALL be requested by the default first screen

#### Scenario: Meshopt decoding is unavailable or fails
- **WHEN** the decoder cannot process the compressed package
- **THEN** the loader SHALL fall back to the declared candidate chain
- **AND** simulation state SHALL be preserved

### Requirement: Interactive-systems role has a separate lifecycle

The system SHALL register the interactive-systems GLB as a distinct role alongside ship LODs, collision, payload, and demo. It SHALL load only for an explicit consumer and SHALL NOT be merged into the default ship asset lifecycle.

#### Scenario: Standard destroyer simulation loads
- **WHEN** the student opens the ordinary destroyer heading simulation with the v2.1.0 package active
- **THEN** the loader SHALL request only the selected ship LOD
- **AND** the interactive-systems GLB SHALL remain unloaded until a declared consumer requests it

### Requirement: Activation acceptance requires visual verification

Production activation and candidate acceptance SHALL include browser visual verification: the full ship SHALL be visibly framed on the QA page and in the destroyer scene at every quality tier, skinned meshes SHALL render in correct pose, and the fallback path SHALL render the legacy model visibly. Data-level assertions (request ledgers, node transforms) alone SHALL NOT constitute acceptance.

#### Scenario: Visual acceptance runs for activation
- **WHEN** the activation acceptance suite runs
- **THEN** it SHALL assert the ship bounding box projects into the viewport at each quality tier and capture the screenshot matrix
- **AND** it SHALL assert skinned meshes retain valid bone bindings after scene cloning

#### Scenario: Visual verification fails
- **WHEN** the ship is not visibly framed or skinned meshes render with broken bindings in any accepted tier
- **THEN** activation SHALL fail closed and the legacy default SHALL remain in place

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

