## MODIFIED Requirements

### Requirement: Explicit ReleaseSet lock governs admissible packages
The system MUST validate a standard ActKG public Bundle only when its controlled repository path, Bundle identity/revision/digest, Release identity/hash, Schema version/raw hash, Manifest raw hash, and required public contract identities exactly match an explicitly reviewed ReleaseSet Lock v3 entry. Already accepted no-Manifest historical packages MUST retain their frozen exact lock and adapter and MUST NOT be rewritten as Lock v3 Bundles.

#### Scenario: Locked standard Bundle is admitted
- **WHEN** a standard Bundle and every declared identity and hash match the current Lock v3 entry
- **THEN** the system SHALL admit it to compatibility and integrity validation

#### Scenario: Unlocked, scanned, or drifted Bundle is rejected
- **WHEN** a package is discovered by directory scan, selected by latest/max-version logic, supplied as a candidate without an explicit development flag, or differs from its lock
- **THEN** the system SHALL reject it without changing any candidate or production selector

#### Scenario: Completed v0.2 package remains frozen
- **WHEN** the #1125 no-Manifest package is read or regression-tested after Lock v3 is introduced
- **THEN** the system SHALL use its existing exact lock and adapter without fabricating a Manifest or rewriting its accepted receipt

## REMOVED Requirements

### Requirement: Current release contract is validated without future abstraction
**Reason**: A fixed-version contract requires a new code path for every content-compatible Release and conflicts with the standard public Bundle contract.

**Migration**: Replace it with `Supported public Bundle contracts are explicitly registered`; retain exact adapters only for already accepted historical packages.

## ADDED Requirements

### Requirement: Supported public Bundle contracts are explicitly registered
The system MUST validate a locked public Bundle through an explicitly registered Bundle contract, Schema version/raw-hash identity, and required Artifact contracts. The system MUST accept content-compatible future Releases under those registered identities without version-specific code, and MUST block an unknown required contract or Schema identity pending the corresponding adapter update or Schema review.

#### Scenario: Compatible later Release arrives
- **WHEN** a later Bundle uses registered Bundle, Schema, and required Artifact contracts and passes all integrity gates
- **THEN** the system SHALL validate it through the existing standard adapter without adding a version-specific branch

#### Scenario: Required Artifact contract changes
- **WHEN** a later Bundle declares an unknown required role or contract
- **THEN** the system SHALL return `ADAPTER_UPDATE_REQUIRED` and SHALL NOT emit a validated Bundle

#### Scenario: Schema identity changes
- **WHEN** a later Bundle declares an unregistered Schema version/raw-hash pair
- **THEN** the system SHALL return `SCHEMA_REVIEW_REQUIRED` and SHALL NOT infer compatibility from the version string
