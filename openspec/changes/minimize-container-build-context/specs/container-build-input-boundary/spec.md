# Container Build Input Boundary

## ADDED Requirements

### Requirement: Docker context contains only production build inputs

The local release Docker context SHALL include files required by dependency installation, Prisma generation/migration, optimized-model provenance, generated WASM verification, production Next compilation, runner assembly, and declared runtime/Authority governance artifacts. It SHALL exclude repository content already declared outside production tracing and not copied into the runner.

#### Scenario: BuildKit receives a clean repository context

- **WHEN** a release build starts from a clean committed revision
- **THEN** lesson authoring media, documentation, OpenSpec history, repository tests, course references/tooling, generated design images, and Rust build sources are not transferred
- **AND** required application and runtime-governance inputs remain available to the builder

### Requirement: Authoring knowledge is default-deny

The Docker context SHALL exclude authoring knowledge by default and re-include only the release, CourseCoverage, Authority, and sealed envelope inputs consumed by the builder or runner. Re-inclusions SHALL be explicit and covered by contract tests.

#### Scenario: A historical knowledge workspace exists locally

- **WHEN** historical review, infograph authoring, remediation, or candidate directories are present under authoring knowledge
- **THEN** they do not alter the Docker context or invalidate application build cache
- **AND** current Authority/release/CourseCoverage/envelope inputs still participate in the build key

### Requirement: Context reduction preserves release behavior

Context exclusions MUST NOT change the external runtime boundary, runner file contract, immutable OCI revision, image tar hashing, provenance generation, or atomic shared-cache publication.

#### Scenario: Build and inspect the reduced-context image

- **WHEN** the app-only release build succeeds with the reduced context
- **THEN** the image passes the existing application, Chromium, LibreOffice, Authority, projection, and provenance checks
- **AND** no deployment occurs as part of context qualification
