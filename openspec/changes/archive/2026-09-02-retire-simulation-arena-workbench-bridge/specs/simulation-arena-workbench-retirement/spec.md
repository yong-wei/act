## ADDED Requirements

### Requirement: The simulation-arena-workbench transition layer is not a production owner
After Artifact/Run consumer migration, production routes and feature implementations SHALL consume launch, session, status and route contracts from their existing Platform UI, Control Workbench, Arena, simulation or lesson owners. They SHALL NOT import `src/features/simulation-arena-workbench` as a required runtime bridge.

#### Scenario: All bridge callers are migrated
- **WHEN** the caller matrix shows every production export consumer has a verified replacement
- **THEN** the transition layer MAY be deleted with a zero-caller and rollback receipt
- **AND** the existing shell, route and status behaviors SHALL remain available through their owning modules.

#### Scenario: An unclassified caller remains
- **WHEN** a dynamic import, test-backed runtime or compatibility caller still depends on the transition layer
- **THEN** the layer SHALL remain retained with an owner and deletion condition
- **AND** the change SHALL not claim bridge retirement.

### Requirement: Bridge retirement preserves mission and evaluation boundaries
Deleting the transition layer SHALL preserve task/publication/return context, role scope, course launch provenance, replay/model status, preview-versus-official visibility and the existing Artifact/Run identity contract. Shell code SHALL not execute numerics or persist Arena evaluation results.

#### Scenario: Arena opens the Control Workbench
- **WHEN** a student launches an Arena challenge or publication into Control Workbench
- **THEN** task identity, route parameters, return target and official/preview state SHALL remain intact
- **AND** submission/evaluation SHALL continue through the existing Arena server authority.

#### Scenario: Course launches a simulation resource
- **WHEN** a DB BOPPPS lesson item launches a simulation or workbench resource
- **THEN** registry resolution, config merge order, embedded progress and fixed-step Rust/WASM runtime behavior SHALL remain intact
- **AND** the transition layer SHALL not become a second course or numerical authority.
