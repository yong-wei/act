## MODIFIED Requirements

### Requirement: Fleet coordinate basis is explicit per package
The system SHALL record each fleet package’s bow axis. Hero `act-ship-release/1` packages MUST apply the declared row-major `modelToSceneMatrix` once on an inner group via `Matrix4.set`. Scene heading MUST still use one outer yaw `-heading + π/2`. Versioned mounts MUST scale by declared model length. They MUST NOT bbox-center, normalize by maximum dimension, or apply both the matrix and a second basis yaw / extra waterline translation.

#### Scenario: Hero release package is mounted
- **WHEN** an activated `act-ship-release/1` package is mounted at a platform heading
- **THEN** the outer group yaw SHALL be `-headingRad + π/2`
- **AND** the inner group SHALL use the package `modelToSceneMatrix`
- **AND** the mount SHALL NOT bbox-center the mesh

### Requirement: Tianjing dredger uses the latest received three-LOD GLB package
The system SHALL register `dredger-tianjing` 1.1.0 from `3DModels:models/act-dredger-tianjing/exports/v1.1.0` using the release `lods` entries (gltf-native LOD0/1/2). The activated default MUST point at `/assets/model-releases/dredger-tianjing/v1.1.0`. v1.0.1 MUST remain on disk. Visual scale MUST stay 120 m.

#### Scenario: Dredger activation uses the 1.1.0 LOD denominator
- **WHEN** `dredger` is activated
- **THEN** the descriptor modelVersion SHALL be `1.1.0`
- **AND** `modelLengthMeters` SHALL be 120
- **AND** the v1.0.1 package directory SHALL still exist

## ADDED Requirements

### Requirement: Hero fleet packages become the activated defaults
The system SHALL activate Xue Long 2 1.0.0, Adora 1.0.0, MSC Tessa 1.1.0, LNG Changheng 1.1.0, HYSY 981 1.1.0, Type 055 2.2.0, and Tianjing 1.1.0. Prior received versions MUST remain immutable. Adora SHALL map release LOD1/2/3 onto ship-lod0/1/2.

#### Scenario: All seven logicalIds point at hero releases
- **WHEN** `resolveVersionedDefault` is read for each simulation logicalId
- **THEN** each activation version SHALL match the hero release table
- **AND** matching descriptors SHALL exist on disk with verified SHA-256
