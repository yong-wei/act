## MODIFIED Requirements

### Requirement: Model roles remain separate
The system SHALL preserve separate roles for ship LOD0, ship LOD1, ship LOD2, static ship proxy, independent propulsion anchors, collision, weapon payload, and weapon demo. It MUST NOT merge payload or transient demo ammunition into the default ship asset lifecycle.

#### Scenario: Standard destroyer simulation loads
- **WHEN** the student opens the ordinary destroyer heading simulation with an authorized proxy package
- **THEN** the loader SHALL first request the independent proxy, prepare the lowest ship LOD, and then prepare only the needed target LOD
- **AND** payload, demo, collision, and interactive-systems GLBs SHALL remain unloaded until a declared consumer requests them

### Requirement: Interactive-systems role has a separate lifecycle
The system SHALL register the interactive-systems GLB as a distinct role alongside ship LODs, proxy, propulsion anchors, collision, payload, and demo. It SHALL load only for an explicit consumer and SHALL NOT be merged into the default ship asset lifecycle.

#### Scenario: Standard destroyer simulation loads
- **WHEN** the student opens the ordinary destroyer heading simulation with a received proxy package active
- **THEN** progressive loading SHALL consume only the proxy and needed ship LODs
- **AND** the interactive-systems GLB SHALL remain unloaded until a declared consumer requests it

## ADDED Requirements

### Requirement: Proxy and propulsion anchors share one package coordinate identity
The system SHALL bind a received proxy and independent propulsion interface to the same package version, artifact hashes, mounting matrix, declared length and waterline as the formal LODs. It SHALL preserve declared design approximations and unknown physical telemetry. A static proxy MUST NOT require full-model animation interfaces to become visible.

#### Scenario: A formal LOD replaces the static proxy
- **WHEN** network, parsing and GPU preparation of the formal LOD complete
- **THEN** the replacement SHALL preserve the mounting matrix and scale
- **AND** propulsion anchors SHALL keep their semantic identities and consume existing telemetry without treating demo animation playback as physical RPM

#### Scenario: A formal LOD is delayed or unavailable
- **WHEN** a visible proxy waits for a formal LOD or material preparation fails
- **THEN** the proxy SHALL remain visible
- **AND** if the lowest LOD is unavailable a ready requested target MAY replace the proxy directly

### Requirement: Model delivery is an immutable OSS and ESA consumption closure
The system SHALL publish the authorized proxy, ship LODs, independent interface, auxiliary consumers, manifest and relative textures under one versioned private OSS prefix. Browser delivery SHALL use ESA first for the configured production Origin and preserve same-origin fallback. Published file identities SHALL be verified by SHA-256 and size, together with MIME, CORS, cache and HTTPS behavior; equal file length alone MUST NOT prove reuse.

#### Scenario: A complete seven-vessel model release is distributed
- **WHEN** all current model packages have been uploaded to their new versioned OSS prefixes
- **THEN** ESA SHALL serve their complete consumption closures with matching bytes and allowed production Origin
- **AND** anonymous direct OSS access SHALL remain denied
- **AND** object publication SHALL NOT imply application deployment or Runtime activation

#### Scenario: ESA delivery of the first proxy fails
- **WHEN** the configured Origin cannot load the ESA proxy
- **THEN** the loader SHALL consume the same version's same-origin proxy or existing ordered model fallback
- **AND** the visible model SHALL remain available while later candidates prepare
