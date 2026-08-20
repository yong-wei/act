# actkg-public-bundle-compatibility Specification

## Purpose
TBD - created by archiving change establish-actkg-public-bundle-compatibility. Update Purpose after archive.
## Requirements
### Requirement: Public Bundle routing is deterministic
The system MUST route a controlled ActKG package by the presence and declared contract of `bundle-manifest.json`: an approved package without a Manifest SHALL use its frozen exact historical adapter, while a package with a Manifest SHALL use the registered standard adapter and MUST NOT fall back to a historical adapter after any standard validation failure.

#### Scenario: Historical package has no Manifest
- **WHEN** an explicitly locked historical package has no `bundle-manifest.json` and matches the frozen historical contract
- **THEN** the router SHALL select the exact historical adapter

#### Scenario: Standard package fails validation
- **WHEN** a package declares `actkg-public-bundle/1` but its Manifest, Artifact, Schema, or closure validation fails
- **THEN** the router SHALL reject it and SHALL NOT retry through the historical adapter

### Requirement: Bundle, Release, ReleaseSet, and Projection identities remain distinct
The compatibility layer MUST preserve separate Bundle, Release, ReleaseSet, and Projection identities and MUST validate every reference between them without substituting one identity for another.

#### Scenario: Packaging revision preserves semantic Release
- **WHEN** two Bundles have distinct revisions and digests but declare the same valid Release ID, Release hash, source dataset hash, and semantic Artifact digests
- **THEN** the compatibility layer SHALL classify them as separate Bundle identities for one semantic Release identity

#### Scenario: Projection identity drifts
- **WHEN** a Projection declares a source Release or digest inconsistent with the Bundle and Release identities
- **THEN** the complete Bundle SHALL be rejected

### Requirement: Artifact discovery follows declared roles and contracts
The standard adapter MUST discover Artifacts by Manifest role, profile, contract version, required state, and validated relative path rather than by conventional filenames.

#### Scenario: Required Artifact uses a different valid path
- **WHEN** a Manifest declares a supported required Artifact role and contract at a safe non-default relative path
- **THEN** the adapter SHALL load it from the declared path

#### Scenario: Unknown required Artifact is present
- **WHEN** a Manifest declares an unknown required role or unsupported required Artifact contract
- **THEN** the assessment SHALL be `ADAPTER_UPDATE_REQUIRED` and no validated Bundle SHALL be emitted

#### Scenario: Unknown optional Artifact is present
- **WHEN** every required contract is supported and the Manifest adds an unknown optional Artifact
- **THEN** the assessment SHALL be `COMPATIBLE_OPTIONAL_EXTENSION`, the Artifact SHALL remain available as raw input, and no runtime semantics SHALL be assigned to it

### Requirement: Projection profiles are validated independently
The standard adapter MUST preserve each declared Projection and Link Metadata Artifact independently, MUST select exactly one registered runtime profile for candidate consumption, and MUST NOT merge projections merely because their current records are equal.

#### Scenario: Runtime, domain, and review projections are present
- **WHEN** a valid Bundle declares supported runtime, domain, and review profiles
- **THEN** all three identities and raw Artifacts SHALL be retained in the validated result while only the runtime profile is selected for candidate consumption

#### Scenario: Runtime profile is absent or ambiguous
- **WHEN** no supported runtime Projection exists or more than one Artifact claims the same required runtime profile
- **THEN** the Bundle SHALL be rejected

### Requirement: Public Bundle integrity is closed over the exact file set
The compatibility layer MUST validate the raw Manifest hash, Bundle digest, `SHA256SUMS`, every declared Artifact hash, byte length and JSONL record count, and MUST require the declared Artifact set plus reserved Manifest/checksum files to equal the regular files on disk. The exact-file-set integrity gate MUST run before Authority Snapshot staging and pointer replacement; no teaching coverage or projection result may satisfy or bypass it.

#### Scenario: Extra file is present
- **WHEN** a regular file exists in the Bundle but is not declared by the Manifest and is not a reserved Manifest/checksum file
- **THEN** the Bundle SHALL be rejected

#### Scenario: Dynamic counts match
- **WHEN** actual Release, Projection, Crosswalk, component, and vocabulary counts equal the values declared by the current Manifest
- **THEN** validation SHALL pass regardless of the counts used by an earlier Release fixture

#### Scenario: Hash or required file drifts
- **WHEN** a Bundle file, manifest, schema, or checksum differs from the locked identity
- **THEN** no Authority Snapshot or current pointer SHALL be emitted

### Requirement: Bundle paths are confined to the controlled package
Every Artifact path MUST be a normalized POSIX relative path inside the controlled Bundle. Absolute paths, `..`, backslashes, duplicate paths, case-folding collisions, and symbolic-link escapes MUST be rejected.

#### Scenario: Artifact attempts path traversal
- **WHEN** a Manifest path is absolute, contains `..` or backslashes, or resolves outside the controlled Bundle
- **THEN** the Bundle SHALL be rejected before Artifact content is parsed

#### Scenario: Paths collide after case folding
- **WHEN** two declared Artifact paths differ only by case under case-folded comparison
- **THEN** the Bundle SHALL be rejected as ambiguous

### Requirement: Public semantic closures are complete
The compatibility layer MUST validate Release membership, component identity and digest agreement, Projection membership and endpoints, one-to-one Link Metadata coverage, unique Crosswalk triples, and Crosswalk published-entity membership before emitting a validated Bundle.

#### Scenario: Component identity is incomplete
- **WHEN** any component reference lacks its declared Release ID or disagrees across Release, component Manifest, and component package
- **THEN** the Bundle SHALL be rejected

#### Scenario: Link Metadata is missing or orphaned
- **WHEN** a projected relation lacks exactly one matching metadata record or metadata references no projected relation
- **THEN** the Bundle SHALL be rejected

#### Scenario: Crosswalk uses opaque retrieval identifiers
- **WHEN** a unique Crosswalk triple has a member `published_entity_id` and non-empty retrieval/citation identifiers that do not resolve inside the Bundle
- **THEN** the identifiers SHALL be preserved as opaque values and SHALL NOT be treated as a closure failure

### Requirement: Public/private data boundaries are enforced
The compatibility layer MUST reject public Artifacts that expose fields reserved for private CTKG data, including raw source text, exact quotes, full private model responses, or private review drafts, unless a future reviewed public contract explicitly authorizes them.

#### Scenario: Public Artifact exposes exact source text
- **WHEN** a current-contract public Artifact contains `raw_text`, `exact_quote`, or an equivalent prohibited private field
- **THEN** the compatibility assessment SHALL be `INTEGRITY_REJECTED`

### Requirement: Compatibility classification is explicit
The compatibility layer MUST emit exactly one assessment from `COMPATIBLE_CONTENT_UPDATE`, `COMPATIBLE_PACKAGING_REVISION`, `COMPATIBLE_OPTIONAL_EXTENSION`, `ADAPTER_UPDATE_REQUIRED`, `SCHEMA_REVIEW_REQUIRED`, or `INTEGRITY_REJECTED`, with machine-readable reasons and matched contract identities.

#### Scenario: Supported content changes
- **WHEN** Bundle, Schema, and required Artifact contracts are registered and only valid objects, relations, components, Crosswalk rows, projections, or counts change
- **THEN** the assessment SHALL be `COMPATIBLE_CONTENT_UPDATE`

#### Scenario: Schema identity is unknown
- **WHEN** the Schema version/raw-hash pair is not registered even if the version string is familiar
- **THEN** the assessment SHALL be `SCHEMA_REVIEW_REQUIRED`

### Requirement: Validated Bundle output is storage independent
On a supported assessment, the compatibility layer SHALL emit one deterministic `ValidatedActKGBundle` containing all four identities, selected runtime Projection, preserved Projections, Link Metadata, Crosswalk, components, raw Artifacts, recomputed statistics, and compatibility evidence without writing a database or changing a runtime selector. The compatibility layer MUST also expose a deterministic, immutable Authority Snapshot representation that retains Bundle, Release, ReleaseSet, Projection, schema, and source identities and is byte-stable for identical validated input.

#### Scenario: Validation succeeds
- **WHEN** every required compatibility and integrity gate passes
- **THEN** downstream candidate import SHALL receive the validated object and no database, Repository, API, graph, or production selector SHALL have changed during validation

#### Scenario: Identical Bundle is materialized twice
- **WHEN** the same validated Bundle and ReleaseSet are materialized twice
- **THEN** both Authority Snapshots SHALL have the same normalized bytes and `snapshotHash`

#### Scenario: Snapshot loses typed engineering data
- **WHEN** snapshot normalization omits a valid object type, exact predicate, endpoint, or provenance identity
- **THEN** materialization SHALL fail closed rather than emitting a lossy Authority Snapshot

### Requirement: Standard Bundle protocol majors use isolated adapters

The standard Bundle router MUST dispatch a validated Manifest declaration to
the separately registered v1 or v2 adapter. The v1 registry, accepted Schema
identity, Artifact contracts, normalized output, and negative behavior MUST
remain unchanged when v2 support is installed.

#### Scenario: A historical v1 package is routed after v2 support is added

- **WHEN** a package declares `actkg-public-bundle/1`
- **THEN** the router SHALL invoke only the existing v1 adapter and SHALL
  preserve the prior acceptance or rejection result

#### Scenario: A future unregistered protocol is declared

- **WHEN** a Manifest declares neither a registered v1 nor registered v2 contract
- **THEN** the router MUST reject it as adapter-required without guessing the closest version

