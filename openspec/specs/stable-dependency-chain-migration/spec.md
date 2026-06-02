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

### Requirement: Production runtime does not rely on unowned development tooling
The project SHALL make production runtime entrypoints independent from unowned development-only tooling before major dependency upgrades continue.

#### Scenario: Worker starts in production
- **WHEN** the production worker container starts
- **THEN** it SHALL run through the documented production runtime path
- **AND** that path SHALL either avoid dev-only packages or explicitly classify required tooling as production runtime dependencies.

### Requirement: Dependency classification follows runtime evidence
The project SHALL classify packages as production or development dependencies according to actual entrypoint usage.

#### Scenario: Dependency is moved between sections
- **WHEN** a package is moved between `dependencies` and `devDependencies`
- **THEN** the change SHALL cite the entrypoint, script, or build step proving the selected classification
- **AND** production validation SHALL show that required runtime packages remain available.

### Requirement: Low-risk stable package updates are isolated from major migrations
The project SHALL refresh compatible stable packages separately from framework, database, design-system, and visualization major upgrades.

#### Scenario: Low-risk package refresh is reviewed
- **WHEN** compatible package updates are applied
- **THEN** the change SHALL identify every upgraded direct dependency and whether the update is patch, minor, or lockfile-only
- **AND** it SHALL NOT include Next, React, Prisma, Tailwind, React Three Fiber, Drei, Three, ESLint major, TypeScript major, Zod major, or bcrypt major migration work.

### Requirement: Low-risk refresh records remaining dependency drift
The project SHALL record dependency drift that remains after low-risk package updates.

#### Scenario: Low-risk refresh validation completes
- **WHEN** outdated and audit commands are rerun
- **THEN** the change SHALL record resolved packages, still-outdated packages, remaining audit findings, and the owner change for each deferred major lane.

### Requirement: Next framework upgrades preserve application and deployment behavior
The project SHALL validate application routes, lint behavior, build output, and deployment assumptions when upgrading the Next framework chain.

#### Scenario: Next 16 upgrade is reviewed
- **WHEN** Next is upgraded to the selected latest stable Next 16 release
- **THEN** typecheck, lint, default tests, unit tests, build, audit reporting, and browser route checks SHALL pass or document explicit blockers
- **AND** standalone build and Docker deployment assumptions SHALL be verified or assigned to a blocking follow-up.

### Requirement: Next upgrades do not absorb unrelated major lanes
The project SHALL keep unrelated major migrations outside the Next framework change.

#### Scenario: Next framework change is scoped
- **WHEN** Next and directly related framework tooling are updated
- **THEN** React 19, Prisma 7, Tailwind 4, and 3D visualization major upgrades SHALL remain out of scope unless required by verified peer constraints.

### Requirement: React runtime upgrades validate shared UI and route rendering
The project SHALL validate shared UI primitives, client components, and representative application routes when upgrading the React runtime.

#### Scenario: React 19 upgrade is reviewed
- **WHEN** React and React DOM are upgraded to the selected latest stable React 19 line
- **THEN** typecheck, lint, default tests, unit tests, build, and browser route checks SHALL pass or document explicit blockers
- **AND** React-dependent major package upgrades SHALL remain deferred unless they are required to restore React runtime compatibility.

### Requirement: Visualization dependency upgrades validate canvas runtime behavior
The project SHALL validate browser canvas rendering and interaction when upgrading Three.js, React Three Fiber, Drei, or force-graph packages.

#### Scenario: Visualization stack upgrade is reviewed
- **WHEN** 2D or 3D visualization dependencies are upgraded to selected latest stable versions
- **THEN** typecheck, tests, build, and browser canvas checks SHALL pass or document explicit blockers
- **AND** representative canvases SHALL be verified as nonblank, correctly framed, and interactive.

### Requirement: Prisma runtime upgrades preserve database and deployment behavior
The project SHALL validate Prisma client generation, database scripts, worker access, and production migration commands when upgrading Prisma.

#### Scenario: Prisma 7 upgrade is reviewed
- **WHEN** Prisma CLI and client packages are upgraded to the selected latest stable Prisma 7 line
- **THEN** Prisma configuration, environment loading, client generation, migration deployment, and database-backed validation SHALL pass or document explicit blockers
- **AND** unrelated frontend framework and design-system upgrades SHALL remain out of scope.

### Requirement: Tailwind upgrades preserve design-system and visual behavior
The project SHALL validate platform tokens, layered CSS behavior, commercial UI governance, and representative browser rendering when upgrading Tailwind.

#### Scenario: Tailwind 4 upgrade is reviewed
- **WHEN** Tailwind and its PostCSS integration are upgraded to the selected latest stable Tailwind 4 line
- **THEN** CSS directives, PostCSS configuration, platform token behavior, commercial UI governance, build output, and browser visual checks SHALL pass or document explicit blockers
- **AND** the change SHALL record any intentional visual differences.
