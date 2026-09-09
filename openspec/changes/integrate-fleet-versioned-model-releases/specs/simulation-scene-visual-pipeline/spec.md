## ADDED Requirements

### Requirement: Activated fleet simulations mount the versioned package by default
LNG、集装箱、破冰船、邮轮、钻井与挖泥船仿真 SHALL mount the activated package through the shared fleet ship component. The legacy single-file registry MUST remain only as the ordered load-failure fallback for GLB packages. Quality tier MUST select ship LOD0/1/2. Tianjing MUST mount the received v1.0.1 act-forward GLB with the same outer yaw and DWL contract, not a vendored procedural factory.

#### Scenario: Student opens the LNG simulation
- **WHEN** `lng-carrier` has an activated versioned default
- **THEN** the scene SHALL mount `VersionedFleetShip` with `logicalId="lng-carrier"`
- **AND** the first successful load SHALL be a versioned ship LOD, not the registry `originalUrl`

#### Scenario: Versioned package fails to decode
- **WHEN** the activated fleet package cannot be fetched, decoded, or parsed
- **THEN** the loader SHALL fall back through that logicalId’s registered candidates
- **AND** simulation state SHALL be preserved

#### Scenario: Dredger mounts Tianjing v1.0.1
- **WHEN** a student opens the dredger simulation
- **THEN** the scene SHALL mount `VersionedFleetShip` with `logicalId="dredger"`
- **AND** `resolveVersionedDefault('dredger')` SHALL point at `dredger-tianjing` 1.0.1
- **AND** the first successful load SHALL be a versioned ship LOD, not `/assets/models-opt/dredger.glb` and not a procedural factory

### Requirement: Homepage preview uses the activated low LOD
The commercial homepage ship cards SHALL preview each activated logicalId with the versioned low-quality LOD. Poster images MUST resolve from that same preview path: versioned package URL prefixes map to the corresponding PNG, and unmatched legacy GLB paths keep the original poster table. HYSY 981 v1.0.2 and Tianjing v1.0.1 GLBs require MeshoptDecoder on homepage dynamic preview.

#### Scenario: Homepage preloads the destroyer card
- **WHEN** the homepage requests the destroyer preview model
- **THEN** the path SHALL be the activated package’s ship-lod2 URL
- **AND** the poster SHALL resolve from that versioned URL prefix to the destroyer PNG

#### Scenario: Homepage preloads the 981 card
- **WHEN** the homepage requests the drilling-rig preview model
- **THEN** the path SHALL be the activated hysy-981 v1.0.2 ship-lod2 URL
- **AND** the static poster SHALL be `/assets/drilling-rig.png`
- **AND** dynamic preview loading SHALL enable MeshoptDecoder

#### Scenario: Homepage preloads the dredger card
- **WHEN** the homepage requests the dredger preview model
- **THEN** the path SHALL be the activated dredger-tianjing v1.0.1 ship-lod1 URL
- **AND** the static poster SHALL be `/assets/dredger-tianjing.png`
- **AND** dynamic preview loading SHALL enable MeshoptDecoder
