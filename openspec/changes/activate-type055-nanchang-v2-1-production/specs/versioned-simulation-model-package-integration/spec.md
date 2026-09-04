# versioned-simulation-model-package-integration Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
