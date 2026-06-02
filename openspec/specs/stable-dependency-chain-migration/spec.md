# stable-dependency-chain-migration Specification

## Purpose

Define the baseline, staging, and verification policy for moving development
and production dependency chains to latest stable package versions without
losing attribution or release signal.
## Requirements
### Requirement: Dependency migration uses explicit ownership lanes
The project SHALL assign dependency migration work to explicit owner lanes before package versions are changed.

#### Scenario: Dependency migration work is planned
- **WHEN** a dependency update is proposed
- **THEN** the owning lane SHALL be identified before implementation begins
- **AND** the expected verification commands SHALL be recorded with that lane.

### Requirement: Dependency migration baseline records current development and production state
The project SHALL establish a dependency migration baseline before moving development and production dependency chains to latest stable package versions.

#### Scenario: Baseline is prepared
- **WHEN** the baseline change is reviewed
- **THEN** it SHALL record Node, npm, package manager, engine range, lockfile state, outdated packages, audit findings, production/dev dependency boundaries, and known extraneous local packages
- **AND** it SHALL classify every tracked package into a migration lane with an owner change and expected verification command.

### Requirement: Latest-stable migration is split by coupling lane
The project SHALL split latest-stable dependency migration into serialized, reviewable changes rather than applying all major upgrades in one change.

#### Scenario: Series plan is reviewed
- **WHEN** the dependency migration baseline is complete
- **THEN** it SHALL define the execution order for production runtime separation, low-risk stable package refresh, Next, React, Prisma, Tailwind, and 3D visualization upgrades
- **AND** downstream changes SHALL name their upstream dependencies before they are claimed.

### Requirement: Compatibility validation includes browser and production checks
The project SHALL require compatibility validation beyond unit tests for dependency changes that can affect runtime, UI, database, or deployment behavior.

#### Scenario: Validation matrix is defined
- **WHEN** the migration baseline is reviewed
- **THEN** it SHALL include typecheck, unit tests, default smoke tests, build, audit governance, production Docker or Podman checks, and browser route verification lanes
- **AND** it SHALL identify which later changes require visual browser checks or canvas interaction checks.
