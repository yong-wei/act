## ADDED Requirements

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
